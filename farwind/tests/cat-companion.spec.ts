import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {move as navigate} from './skill-navigation';
// 按键释放受共享机器负载影响时，沿实际当前位置重新规划，不修改坐标。
const move=(page:Page,x:number,y:number)=>navigate(page,x,y,async()=>{});
import {motionBlocked,clearMotionLine} from '../src/game/systems/obstacles';
const root='docs/cat-companion/after';
const read=(page:Page)=>page.evaluate(()=>(window as any).__farwind());
async function start(page:Page){await page.goto('/');await page.getByRole('button',{name:'启程 · 新游戏',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');}
async function resume(page:Page){await page.keyboard.press('Escape');if((await read(page)).mode==='pause')await page.locator('#close').click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');}
async function importState(page:Page,s:unknown,name:string){await page.keyboard.press('Escape');const chooser=page.waitForEvent('filechooser');await page.locator('#import').click();await(await chooser).setFiles({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(s))});await page.waitForFunction(()=>(window as any).__farwind().mode==='');}
test.beforeEach(async({page})=>{await mkdir(root,{recursive:true});page.on('dialog',d=>d.accept());});
test('cat-normal-exploration-care-save-responsive',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await start(page);
 await page.locator('#cat-summary').click();await expect(page.locator('.cat-companion-panel')).toContainText('默契 0 / 100');
 await page.locator('#cat-pet').click();await expect(page.locator('#cat-care-feedback')).toContainText('默契已保存');await expect(page.locator('#cat-pet')).toBeDisabled();
 await expect(page.locator('#cat-feed')).toBeDisabled();expect((await read(page)).state.catBond.score).toBe(2);await page.locator('#close').click();
 // 鼠标退出伙伴页后立即奔跑，空格不能被入口按钮截获。
 const runStart=await read(page);await page.keyboard.down('Space');await page.keyboard.down('d');await page.waitForTimeout(300);const runEnd=await read(page);await page.keyboard.up('d');await page.keyboard.up('Space');
 expect(runEnd.mode).toBe('');expect(runEnd.state.player.stamina).toBeLessThan(runStart.state.player.stamina);expect(runEnd.state.player.x).toBeGreaterThan(runStart.state.player.x+25);
 // 新档正常行走，不导入或修改玩家状态；探索村内新的路段。
 await move(page,560,720);await move(page,560,850);await move(page,680,960);
 const before=(await read(page)).state.catBond.score;expect(before).toBeGreaterThan(2);
 // 通过原有采集交互获取浆果，再从小黑页正常分享。
 await move(page,780,1040);await page.keyboard.press('e');
 const state=await read(page);
 if(!state.state.bag.some((slot:any)=>slot?.id==='berry')){
  // 实际可见资源来自正式地图，不预置物品。
  const {props}=await import('../src/data/world');const berry=props.filter(p=>p.kind==='resource'&&p.item==='berry').sort((a,b)=>Math.hypot(a.x-state.state.player.x,a.y-state.state.player.y)-Math.hypot(b.x-state.state.player.x,b.y-state.state.player.y))[0];
  await move(page,berry.x,berry.y+35);await page.keyboard.press('e');
 }
 await expect.poll(async()=>((await read(page)).state.bag as any[]).filter(s=>s?.id==='berry').reduce((n,s)=>n+s.count,0)).toBeGreaterThan(0);
 await page.waitForTimeout(2200);await page.locator('#cat-summary').click();await page.locator('#cat-feed').click();await expect(page.locator('#cat-care-feedback')).toContainText('默契已保存');await expect(page.locator('#cat-feed')).toBeDisabled();
 const earned=(await read(page)).state.catBond.score;await page.screenshot({path:root+'/normal-care.png'});
 await page.setViewportSize({width:390,height:844});const bounds=await page.locator('.cat-companion-panel').evaluate(e=>({可视宽度:e.clientWidth,内容宽度:e.scrollWidth}));expect(bounds.内容宽度).toBeLessThanOrEqual(bounds.可视宽度+1);await page.locator('#close').scrollIntoViewIfNeeded();await page.screenshot({path:root+'/narrow-care.png'});
 await page.setViewportSize({width:1280,height:720});await resume(page);await page.keyboard.press('Escape');await page.locator('#save').click();await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');
 expect((await read(page)).state.catBond.score).toBe(earned);await page.locator('#cat-summary').click();await expect(page.locator('#cat-pet')).toBeDisabled();await expect(page.locator('#cat-feed')).toBeDisabled();
 expect(errors).toEqual([]);await writeFile(root+'/normal-flow.json',JSON.stringify({说明:'新档正常键盘探索、采集浆果、鼠标摸猫喂食，真实保存刷新；没有预置默契、道具或坐标。',获得默契:earned,窄屏:bounds,页面异常:errors},null,2));
});
test('cat-legacy-migration-stages-sniff-cooldown',async({page})=>{
 await start(page);const initial=(await read(page)).state;const old:any=structuredClone(initial);old.schema_version=19;delete old.catBond;old.coins=47;
 await importState(page,old,'legacy-cat-sample.json');expect((await read(page)).state.schema_version).toBe(20);expect((await read(page)).state.catBond.score).toBe(0);expect((await read(page)).state.coins).toBe(47);
 for(const score of [20,45,75,100]){
  const fixture=structuredClone(initial);fixture.catBond.score=score;fixture.player.x=490;fixture.player.y=1355;fixture.catBond.guardCooldown=score>=75?48000:0;fixture.catBond.clawCooldown=score>=45?12000:0;
  await importState(page,fixture,`cat-stage-${score}.json`);await page.waitForFunction(()=>(window as any).__farwind().catCompanion.hint!==null);
  await page.locator('#cat-summary').click();expect(await page.locator('.cat-ability:not(.cat-locked)').count()).toBe(Math.min(score===20?2:score===45?3:4,4));await page.screenshot({path:root+`/stage-${score}.png`});
  const saved=(await read(page)).state.catBond.guardCooldown;if(score>=75)expect(saved).toBeGreaterThan(0);await resume(page);await page.keyboard.press('Escape');await page.locator('#save').click();await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');
  if(score>=75)expect((await read(page)).state.catBond.guardCooldown).toBeGreaterThan(saved-4000);
 }
 await writeFile(root+'/fixture-scope.json',JSON.stringify({说明:'此项通过正式导入代表性旧档与等级存档验证迁移、逐级解锁、嗅迹和冷却持久化；不代表从新档自然培养到满级。'},null,2));
});
test('cat-real-combat-mark-boost-guard',async({page})=>{
 await start(page);const fixture=(await read(page)).state;fixture.catBond.score=75;const home={x:2920,y:1070};const stand=[{x:home.x,y:home.y+85},{x:home.x-85,y:home.y},{x:home.x+85,y:home.y},{x:home.x,y:home.y-85}].find(p=>!motionBlocked(p.x,p.y)&&clearMotionLine(p,home));expect(stand).toBeDefined();fixture.player={...stand!,hp:28,stamina:100};fixture.quest=2;fixture.xiaobao.task='free';fixture.encounters.groups['east-brook-reapers'].activated=true;
 // 正式导入战斗存档后只用键盘，不访问可写调试入口。
 await importState(page,fixture,'cat-combat-sample.json');const loaded=await read(page);expect(Math.hypot(loaded.state.player.x-stand!.x,loaded.state.player.y-stand!.y)).toBeLessThan(5);
 await page.waitForFunction(()=>(window as any).__farwind().skillGrowth.enemies.some((e:any)=>e.id==='leaf-1'&&e.hp>0&&!e.disabled));
 // 先承受一次真实敌击，低血护盾必须由实际受伤触发。
 await page.waitForFunction(()=>(window as any).__farwind().catCompanion.metrics.guard>0);await page.screenshot({path:root+'/combat-guard.png'});
 let markShot=false;const begin=Date.now();
 while(Date.now()-begin<50000){
  const d=await read(page);if(d.mode==='dialog'){await page.getByRole('button',{name:'继续 · E',exact:true}).click();continue;}
  if(d.catCompanion.metrics.guard>0&&d.catCompanion.metrics.boosts>0)break;
  const enemies=d.skillGrowth.enemies.filter((e:any)=>e.hp>0&&!e.disabled&&Math.hypot(e.x-d.state.player.x,e.y-d.state.player.y)<220);
  const target=enemies.sort((a:any,b:any)=>Math.hypot(a.x-d.state.player.x,a.y-d.state.player.y)-Math.hypot(b.x-d.state.player.x,b.y-d.state.player.y))[0];
  if(target){const dx=target.x-d.state.player.x,dy=target.y-d.state.player.y;await page.keyboard.press(Math.abs(dx)>Math.abs(dy)?dx<0?'a':'d':dy<0?'w':'s');}
  await page.keyboard.press('j');await page.waitForTimeout(110);
  const after=await read(page);if(after.catCompanion.mark&&!markShot){await page.screenshot({path:root+'/combat-mark.png'});markShot=true;}
 }
 const outcome=await read(page);await page.screenshot({path:root+'/combat-result.png'});await writeFile(root+'/combat.json',JSON.stringify({说明:'代表性低血高默契存档由正式导入进入，之后仅真实键盘战斗。',小黑参与:outcome.catCompanion,护盾状态:outcome.state.catBond,玩家:outcome.state.player},null,2));
 expect(outcome.catCompanion.metrics.marks).toBeGreaterThan(0);expect(outcome.catCompanion.metrics.boosts).toBeGreaterThan(0);expect(outcome.catCompanion.metrics.guard).toBeGreaterThan(0);
});
test('cat-real-shield-absorption-save-cooldown',async({page})=>{
 await start(page);const fixture=(await read(page)).state;fixture.catBond.score=75;fixture.player={x:2855,y:1070,hp:28,stamina:100};fixture.quest=2;fixture.xiaobao.task='free';fixture.encounters.groups['east-brook-reapers'].activated=true;
 await importState(page,fixture,'cat-shield-sample.json');
 await page.waitForFunction(()=>(window as any).__farwind().catCompanion.metrics.absorbed>0,undefined,{timeout:20000});
 await page.keyboard.press('Escape');const outcome=await read(page);
 expect(outcome.catCompanion.metrics.guard).toBe(1);expect(outcome.catCompanion.metrics.absorbed).toBeGreaterThan(0);expect(outcome.state.player.hp).toBeLessThan(28);expect(outcome.state.player.hp).toBeGreaterThan(0);
 expect(outcome.state.catBond.guardCooldown).toBeGreaterThan(0);await page.screenshot({path:root+'/shield-absorbed.png'});
 await page.locator('#save').click();const saved=outcome.state.catBond.guardCooldown;await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');await page.keyboard.press('Escape');
 expect((await read(page)).state.catBond.guardCooldown).toBeGreaterThan(saved-4000);
 await writeFile(root+'/shield-absorption.json',JSON.stringify({说明:'正式导入进行中的低血战斗存档，不攻击敌人，承受真实敌击触发护盾并再次受击。暂停保存、刷新后冷却继续保留。',护主次数:outcome.catCompanion.metrics.guard,实际抵挡:outcome.catCompanion.metrics.absorbed,受击后生命:outcome.state.player.hp,保存时冷却:outcome.state.catBond.guardCooldown,重载后冷却:(await read(page)).state.catBond.guardCooldown},null,2));
});
