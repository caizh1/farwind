import {initialState,validate} from '../src/game/systems/state';
import {createTradeRoad} from '../src/game/systems/tradeRoadState';
import {offerWindGift} from '../src/game/systems/windGifts';
import {test,expect,type Page} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root='docs/windwhisper-city/evidence/';
const read=(page:Page)=>page.evaluate(()=>JSON.parse(document.querySelector('#combat-observation')!.textContent!));
async function move(page:Page,x:number,y:number){
 let stuck=0,last:any=null;
 for(let i=0;i<220;i++){
  const s=await read(page),p=s.位置,dx=x-p.x,dy=y-p.y,d=Math.hypot(dx,dy),bridge=p.x>6700&&p.x<7500;if(d<(bridge?10:20))return;
  if(s.生命<55){await page.keyboard.press('1');}
  if(p.x<1000&&x>3000)throw Error('旅人在通行过程中阵亡，已回村。');
  if(s.暂停){const close=page.locator('#close');if(await close.isVisible())await close.click();await page.waitForTimeout(150);continue;}
  const diagonal=Math.abs(dx)>30&&Math.abs(dy)>30&&Math.abs(dx/dy)>.6&&Math.abs(dx/dy)<1.65,keys=diagonal?[dx>0?'d':'a',dy>0?'s':'w']:[Math.abs(dx)>Math.abs(dy)?dx>0?'d':'a':dy>0?'s':'w'];
  for(const key of keys)await page.keyboard.down(key);if(d>120)await page.keyboard.down('Space');await page.waitForTimeout(Math.min(320,Math.max(bridge?60:140,(Math.abs(dx)>Math.abs(dy)?Math.abs(dx):Math.abs(dy))*3.2)));for(const key of keys)await page.keyboard.up(key);await page.keyboard.up('Space');
  if(last&&Math.hypot(p.x-last.x,p.y-last.y)<2)stuck++;else stuck=0;last=p;
  if(stuck>8)throw Error(`真实通行受阻：${JSON.stringify({当前位置:p,目标:{x,y},生命:s.生命})}`);
 }
 throw Error('键盘通行超时');
}
test('city-continuous-walk',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await mkdir(root,{recursive:true});
 await page.goto('/?combatObservation=1');await page.getByRole('button',{name:'启程 · 新游戏',exact:true}).click();await page.waitForSelector('#combat-observation',{state:'attached'});
 const route=JSON.parse(await readFile(root+'walk-route.json','utf8'));const records=[];
 for(const p of route.补给.slice(1))await move(page,p.x,p.y);await expect.poll(async()=>(await read(page)).交互).toBe('service-general');await page.keyboard.press('e');await page.getByLabel('物品',{exact:true}).selectOption('potion');await page.getByLabel('数量',{exact:true}).fill('6');await page.getByRole('button',{name:'核对交易',exact:true}).click();await page.getByRole('button',{name:'确认购买',exact:true}).click();await expect(page.locator('#shop-feedback')).toContainText('交易已完成并保存');await page.keyboard.press('Escape');for(const p of [...route.补给].reverse().slice(1))await move(page,p.x,p.y);
 for(const p of route.原野.slice(1))await move(page,p.x,p.y);records.push(await read(page));await page.screenshot({path:root+'road-entry.png'});console.log('已从村庄真实步行到原野东口');
 await move(page,4330,1800);await page.keyboard.press('e');await page.getByRole('button',{name:'确认休整商路',exact:true}).click();await expect.poll(async()=>(await read(page)).生命).toBeGreaterThanOrEqual(100);await move(page,4230,1600);
 for(const [i,p]of route.商路.slice(1).entries()){if(p.x===7410&&p.y===1680){await move(page,7100,1680);await page.screenshot({path:root+'bridge-runtime.png'});}await move(page,p.x,p.y);records.push(await read(page));console.log('通行节点',i,Math.round(p.x),Math.round(p.y));if(p.x>5500&&p.x<6200)await page.screenshot({path:root+'forest-runtime.png'});if(p.x>7050&&p.x<7350)await page.screenshot({path:root+'bridge-runtime.png'});if(p.x>9200&&p.x<9650)await page.screenshot({path:root+'gate-runtime.png'});if(p.x>11700)await page.screenshot({path:root+'city-runtime.png'});}
 const city=await read(page);expect(city.城市.visited).toBe(true);expect(city.城市.guards).toHaveLength(10);expect(city.商路.seed).not.toBeNull();expect(city.性能.活动单位峰值).toBeLessThanOrEqual(12);
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'保存旅途',exact:true}).click();await expect(page.locator('#toast')).toContainText('旅途已保存');const saved=await read(page);await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await page.waitForSelector('#combat-observation',{state:'attached'});await expect.poll(async()=>(await read(page)).商路.seed).toBe(saved.商路.seed);const loaded=await read(page);expect(loaded.商路.seed).toBe(saved.商路.seed);expect(loaded.城市.stock).toEqual(saved.城市.stock);expect(loaded.位置.x).toBeGreaterThan(11000);
 for(const p of [...route.商路].reverse().slice(1))await move(page,p.x,p.y);await move(page,4230,1600);records.push(await read(page));
 for(const p of [...route.原野].reverse().slice(1))await move(page,p.x,p.y);records.push(await read(page));expect(errors).toEqual([]);expect((await read(page)).商路.seed).toBe(city.商路.seed);await writeFile(root+'real-walk.json',JSON.stringify({说明:'新档开始，仅真实键盘行走、正常交互和正式保存；未授予能力、伤害免疫或修改坐标。',运行错误:errors,记录:records},null,2));await page.screenshot({path:root+'return-runtime.png'});
});

// 合法导入夹具建立城市服务与保存前提；与新档真实往返录像分别记录。
async function importFixture(page:Page,s:ReturnType<typeof initialState>){
 page.once('dialog',d=>d.accept());const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入存档',exact:true}).click();await(await chooser).setFiles({name:'city-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(validate(s)))});await page.waitForSelector('#combat-observation',{state:'attached'});await expect.poll(async()=>(await read(page)).活动).toBe(true);
}
test('city-services-reload',async({page})=>{
 await page.goto('/?combatObservation=1');const s=initialState();s.player.x=10660;s.player.y=1830;s.tradeRoad=createTradeRoad(3,764);s.city.guards[4].hp=0;s.city.guards[4].mode='down';s.city.guards[4].replacement=20000;
 const n=s.tradeRoad.nodes[0];n.active=true;n.wave=3;n.cleared=true;n.rewarded=true;for(const u of n.units){u.spawned=true;u.defeated=true;u.hp=0;u.participated=true;}offerWindGift(s.windGifts,'商路:3:0',764,false);
 await importFixture(page,s);await expect.poll(async()=>(await read(page)).交互).toBe('city-person-merchant');await page.keyboard.press('e');await page.locator('#city-buy-tea').click();await expect(page.locator('#toast')).toContainText('补给已保存');await page.screenshot({path:root+'shop-runtime.png'});await page.locator('#close').click();const bought=await read(page);expect(bought.城市.stock.tea).toBe(11);expect(bought.金币).toBe(s.coins-10);
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'保存旅途',exact:true}).click();await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await page.waitForSelector('#combat-observation',{state:'attached'});await expect.poll(async()=>(await read(page)).商路.seed).toBe(764);const restored=await read(page);expect(restored.城市.stock).toEqual(bought.城市.stock);expect(restored.行囊).toEqual(bought.行囊);expect(restored.风赐.pending).toEqual(bought.风赐.pending);expect(restored.商路.seed).toBe(764);expect(restored.城市.guards[4].hp).toBe(0);
 await move(page,10660,1600);await move(page,10220,1600);await move(page,10220,1740);await page.keyboard.press('e');await page.getByRole('button',{name:'确认休整商路',exact:true}).click();await expect.poll(async()=>(await read(page)).商路.serial).toBe(4);const rested=await read(page);expect(rested.城市.stock.tea).toBe(11);expect(rested.风赐.pending).toEqual(bought.风赐.pending);
 await move(page,10040,1440);await page.keyboard.press('e');await expect(page.locator('#dialog-text')).toContainText('四名近卫');await page.locator('#close').click();await move(page,11600,1560);await page.keyboard.press('e');await expect(page.locator('#dialog-text')).toContainText('暂未开放');await page.locator('#close').click();
 await move(page,12200,1560);await move(page,12200,1100);await page.screenshot({path:root+'wind-tower-runtime.png'});await move(page,12200,1600);
 await move(page,10000,1600);await expect.poll(async()=>(await read(page)).城市.guards[4].serial,{timeout:35000}).toBe(2);await expect.poll(async()=>(await read(page)).城市.guards[4].mode,{timeout:15000}).toBe('post');
 await move(page,10000,1600);await move(page,9800,1480);await page.setViewportSize({width:1280,height:1400});await page.waitForTimeout(250);await page.screenshot({path:root+'gate-interior-runtime.png'});await page.keyboard.press('m');await expect(page.locator('#world-map')).toHaveAttribute('data-area','city');await page.screenshot({path:root+'city-map-runtime.png'});await page.locator('#close').click();await writeFile(root+'city-services.json',JSON.stringify({说明:'生产构建通过正式导入合法存档夹具，真实键鼠购买、交谈、休整、补员、保存与刷新；不属于新档通关证明。',购买后:bought,刷新后:restored,休整后:rested,最后:await read(page)},null,2));
});

test('city-defense-real-mixed-crowd',async({page})=>{
 await page.goto('/?combatObservation=1');const s=initialState();s.player.x=9550;s.player.y=1600;
 let seed=1;for(;seed<1000;seed++){const trial=createTradeRoad(1,seed);if(new Set([4,5].flatMap(i=>trial.nodes[i].units.filter(u=>u.wave===2).slice(0,6).map(u=>u.type))).size===3)break;}s.tradeRoad=createTradeRoad(1,seed);
 let index=0;for(const i of [4,5]){const n=s.tradeRoad.nodes[i];n.active=true;n.wave=2;for(const u of n.units){u.spawned=true;if(u.wave<2||Number(u.id.split(':').at(-1))===6){u.defeated=true;u.hp=0;}else{u.x=9340+index%4*55;u.y=1460+Math.floor(index/4)*100;u.cooldown=800;index++;}}}
 await importFixture(page,s);await page.setViewportSize({width:1280,height:1400});await page.screenshot({path:root+'gate-crowd-arrival.png'});await expect.poll(async()=>(await read(page)).城防箭矢,{timeout:4000,intervals:[80,80,100]}).toBeGreaterThan(0);await page.screenshot({path:root+'gate-arrow-runtime.png'});await page.keyboard.press('l');await move(page,10100,1600);const frames=[];
 for(let i=0;i<6;i++){await page.waitForTimeout(5000);frames.push(await read(page));if(i===0)await page.screenshot({path:root+'gate-battle-runtime.png'});}
 const result=await read(page);expect(result.商路.nodes[4].cleared).toBe(true);expect(result.商路.nodes[5].cleared).toBe(true);expect(result.城市.guards.filter((g:any)=>g.hp>0)).toHaveLength(10);expect(result.金币).toBe(s.coins);expect(result.风赐.pending).toEqual([]);expect(result.性能.活动单位峰值).toBeLessThanOrEqual(12);
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'保存旅途',exact:true}).click();await expect(page.locator('#toast')).toContainText('旅途已保存');await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await expect.poll(async()=>(await read(page)).商路.seed).toBe(seed);const restored=await read(page);expect(restored.商路.nodes[5].cleared).toBe(true);expect(restored.风赐.pending).toEqual([]);expect(restored.城市.guards.map((g:any)=>g.serial)).toEqual(result.城市.guards.map((g:any)=>g.serial));await page.screenshot({path:root+'gate-after-battle-runtime.png'});
 await writeFile(root+'city-defense-runtime.json',JSON.stringify({说明:'生产构建正式导入12只混合追击敌人的合法存档；真实键盘从门外进城，未改变运行生命、伤害、坐标或进度。守军实际攻击与箭矢结算，观察30秒；纯守军击杀无奖励。',敌种:[...new Set([4,5].flatMap(i=>s.tradeRoad.nodes[i].units.filter(u=>!u.defeated).map(u=>u.type)))],固定种子:seed,初始旅途:s.tradeRoad,记录:frames,结束:result,刷新:restored},null,2));
});

test('city-save-abort-and-legacy-import',async({page})=>{
 await page.addInitScript(()=>{const original=IDBObjectStore.prototype.put;let failed=false;IDBObjectStore.prototype.put=function(value,key){const request=original.call(this,value,key);if(!failed&&value.city?.stock?.tea===11){failed=true;request.addEventListener('success',()=>this.transaction.abort(),{once:true});}return request;};});
 await page.goto('/?combatObservation=1');const legacy:any=initialState();legacy.schema_version=21;legacy.map_version=8;legacy.player.x=1060;legacy.player.y=790;legacy.coins=77;delete legacy.city;delete legacy.tradeRoad;
 page.once('dialog',d=>d.accept());const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入存档',exact:true}).click();await(await chooser).setFiles({name:'city-legacy-21.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});await expect.poll(async()=>(await read(page)).金币).toBe(77);const migrated=await read(page);expect(migrated.位置.x).toBeCloseTo(1060);expect(migrated.位置.y).toBeCloseTo(790);expect(migrated.商路.seed).toBeNull();await page.screenshot({path:root+'legacy-import-runtime.png'});
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'保存并返回标题',exact:true}).click();await expect(page.getByRole('button',{name:'启程 · 新游戏',exact:true})).toBeVisible();const s=initialState();s.player.x=10660;s.player.y=1830;s.tradeRoad=createTradeRoad(1,764);await importFixture(page,s);await expect.poll(async()=>(await read(page)).交互).toBe('city-person-merchant');await page.keyboard.press('e');await page.locator('#city-buy-tea').click();await expect(page.locator('#toast')).toContainText('保存失败');await page.screenshot({path:root+'save-failure-runtime.png'});await page.locator('#close').click();const failed=await read(page);expect(failed.金币).toBe(s.coins);expect(failed.城市.stock.tea).toBe(12);expect(failed.行囊).toEqual(s.bag);
 await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await expect.poll(async()=>(await read(page)).商路.seed).toBe(764);const restored=await read(page);expect(restored.金币).toBe(s.coins);expect(restored.城市.stock.tea).toBe(12);expect(restored.行囊).toEqual(s.bag);await writeFile(root+'save-failure-runtime.json',JSON.stringify({说明:'旧21/地图8备份通过正式文件导入；真实购买时让IndexedDB事务在请求成功后中止一次，验证未扣金币、未改库存与行囊，刷新仍读取上一份有效档。',旧档迁移:migrated,失败时:failed,刷新后:restored},null,2));
});

test('city-retreat-chaser-save-reload',async({page})=>{
 await page.goto('/?combatObservation=1');const s=initialState();s.player.x=4230;s.player.y=1600;s.tradeRoad=createTradeRoad(1,764);const n=s.tradeRoad.nodes[0];n.active=true;const u=n.units.find(u=>u.wave===0&&u.type==='canyonHunter')!;for(const m of n.units.filter(m=>m.wave===0)){m.spawned=true;if(m!==u){m.hp=0;m.defeated=true;}else {m.x=4380;m.y=1600;m.cooldown=800;}}
 await importFixture(page,s);await move(page,4130,1600);await expect.poll(async()=>(await read(page)).商路.nodes[0].units.find((e:any)=>e.id===u.id).x).toBeLessThan(4260);await page.keyboard.press('Escape');await page.getByRole('button',{name:'保存旅途',exact:true}).click();await expect(page.locator('#toast')).toContainText('旅途已保存');const saved=await read(page);await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await expect.poll(async()=>(await read(page)).商路.seed).toBe(764);const loaded=await read(page);expect(loaded.敌人.some((e:any)=>e.身份===u.id)).toBe(true);expect(loaded.商路.nodes[0].units.find((e:any)=>e.id===u.id).x).toBeLessThan(4260);await page.screenshot({path:root+'retreat-chaser-runtime.png'});await writeFile(root+'retreat-chaser-runtime.json',JSON.stringify({说明:'正式导入单个合法追击者，仅真实键盘撤回原野并保存刷新；验证追到旧原野范围的商路敌人坐标可保存、身体恢复。',保存:saved,刷新:loaded},null,2));
});
