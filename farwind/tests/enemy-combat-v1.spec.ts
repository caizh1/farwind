import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {move} from './map-navigation';
const dir='docs/enemy-combat-v1/evidence',read=(p:Page)=>p.evaluate(()=>(window as any).__farwind());
async function start(page:Page){await page.goto('/');await page.getByRole('button',{name:'启程 · 新游戏',exact:true}).click();const confirmation=page.getByRole('button',{name:'确认新游戏',exact:true});if(await confirmation.isVisible())await confirmation.click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');await expect(page.locator('#toast')).toContainText('风铃村欢迎你');}
async function sample(page:Page){await page.evaluate(()=>{const w=window as any;w.__enemyObservations=[];let last='';const frame=()=>{const s=w.__farwind?.();if(s?.animation){const data={at:s.session.sim,enemies:s.animation.enemies,practice:s.animation.practice,projectiles:s.animation.projectiles,contacts:s.contacts.slice(-1)},key=JSON.stringify([data.enemies.map((e:any)=>[e.id,e.art?.pose?.action,e.art?.pose?.frame]),data.practice?.pose?.action,data.practice?.pose?.frame,data.projectiles.map((s:any)=>s.state)]);if(key!==last){w.__enemyObservations.push(data);last=key;if(w.__enemyObservations.length>3000)w.__enemyObservations.shift();}}w.__enemyObserver=requestAnimationFrame(frame);};frame();});}
async function exportSample(page:Page,name:string){const frames=await page.evaluate(()=>{const w=window as any;cancelAnimationFrame(w.__enemyObserver);return w.__enemyObservations;});await writeFile(`${dir}/${name}-validation.json`,JSON.stringify({说明:'正式游戏入口，新游戏正常键盘行走和可见按钮；诊断只读，不注入角色、生命、进度或计时器。弹反输入读取接触预测用于集成检查，不能替代玩家可读性验收。',状态:'技术验证，美术待审阅',帧:frames,最终世界:await read(page)},null,2));}
async function parry(page:Page,prefix:string,lead:number){
  await page.waitForFunction(prefix=>{const s=(window as any).__farwind();return s.warnings.some((w:any)=>w.id.startsWith(prefix)&&w.lead!==null&&w.lead<=350&&w.lead>280);},prefix,{polling:5,timeout:18000});
  const s=await read(page),a=s.parryTraining?.projection??s.enemies.find((e:any)=>e.id===prefix),dx=a.x-s.state.player.x,dy=a.y-s.state.player.y;
  const key=Math.abs(dx)>Math.abs(dy)?dx<0?'a':'d':dy<0?'w':'s';await page.keyboard.down(key);await page.waitForTimeout(18);await page.keyboard.up(key);
  await page.waitForFunction(({prefix,lead})=>{const s=(window as any).__farwind();return s.warnings.some((w:any)=>w.id.startsWith(prefix)&&w.lead!==null&&w.lead<=lead+25&&w.lead>lead);},{prefix,lead},{polling:5,timeout:18000});await page.keyboard.press('k');
}
test.beforeAll(async()=>mkdir(dir,{recursive:true}));
test.afterEach(async({page},info)=>{if(info.status!==info.expectedStatus&&!page.isClosed()){await writeFile(`${dir}/${info.title}-first-cause.json`,JSON.stringify({说明:'当次失败首因，先诊断再修正',世界:await read(page).catch(()=>null),预览:await page.evaluate(()=>(window as any).__enemyPreview?.()).catch(()=>null)},null,2));await page.screenshot({path:`${dir}/${info.title}-failure.png`});}});
test('fixed-all-directions-actions',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/enemy-preview.html');await page.waitForFunction(()=>(window as any).__enemyPreview);await page.getByRole('button',{name:'暂停',exact:true}).click();const observations=[];
  for(const kind of ['slime','leaf','spore','boar','raven'])for(const facing of ['0','1','2','3'])for(const action of ['idle','walk','attack','hurt','parry','perfect','death',...(kind==='boar'?['wall']:[])]){
    await page.locator('#enemy').selectOption(kind);await page.locator('#direction').selectOption(facing);await page.locator('#action').selectOption(action);await page.locator('#scrub').press('End');const s=await page.evaluate(()=>(window as any).__enemyPreview());observations.push(s);expect(s.pose.action).toBe(action);expect(s.pose.facing).toBe(Number(facing));expect(s.root).toEqual([620,440]);
  }
  for(const kind of ['slime','leaf','spore','boar','raven']){await page.locator('#enemy').selectOption(kind);await page.locator('#direction').selectOption('3');await page.locator('#action').selectOption('parry');await page.locator('#scrub').fill('250');await page.screenshot({path:`${dir}/fixed-${kind}-parry.png`,fullPage:true});}
  await page.locator('#background').selectOption('village-night');await page.screenshot({path:`${dir}/fixed-night.png`,fullPage:true});expect(errors).toEqual([]);await writeFile(`${dir}/fixed-validation.json`,JSON.stringify({说明:'五怪四方向及所有动作通过真实控件检查，固定预览不是游戏运行截图',观察:observations,错误:errors},null,2));
});
test('training-five-enemy-parry-recovery',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await start(page);await move(page,850,720);await sample(page);const results=[];
  for(const [kind,name] of [['slime','史莱姆节奏 · 450毫秒'],['leaf','裂枝镰灵 · 650毫秒'],['spore','灰冠孢卫 · 孢子喷射'],['boar','棘甲林豕 · 直线冲锋'],['raven','暮羽鸦妖 · 跃扑']]){
    await move(page,850,720);await page.getByRole('button',{name:'迎风架剑练习',exact:true}).click();await page.getByRole('button',{name,exact:true}).click();
    for(const [lead,action] of [[135,'parry'],[35,'perfect']] as const){await move(page,850,720);await parry(page,'practice-',lead);await page.waitForFunction(action=>{const p=(window as any).__farwind().animation.practice?.pose;return p?.action===action&&p.index>=9;},action,{polling:5,timeout:18000});await page.screenshot({path:`${dir}/training-${kind}-${action}.png`});results.push({怪物:kind,动作:action,世界:await read(page)});}
  }
  expect((await read(page)).state.player.hp).toBe(100);expect(errors).toEqual([]);await exportSample(page,'training');await writeFile(`${dir}/training-results.json`,JSON.stringify({说明:'五种练习投影共用正式动画、时窗和弹反裁决；普通及精准均恢复至末段，练习不伤生命',结果:results,错误:errors},null,2));
  const databases=await page.evaluate(async()=>(await indexedDB.databases()).map(d=>d.name));expect(databases).toContain('farwind-enemy-combat-review');expect(databases).not.toContain('farwind-save');
  await page.keyboard.press('Escape');const sim=(await read(page)).session.sim;await page.waitForTimeout(200);expect((await read(page)).session.sim).toBe(sim);
});
test('wild-new-enemies-real-movement',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const observations:any[]=[];
  // 三段各从正常新游戏开始。地图只有东侧通路，连续自动寻路会跨越多个战区；不注入生命、免疫或位置。
  await start(page);await sample(page);await move(page,2550,1640);await move(page,2650,2020);
  await page.waitForFunction(()=>(window as any).__farwind().animation.projectiles.some((s:any)=>s.state==='flying'),null,{timeout:12000});await page.screenshot({path:`${dir}/wild-spore-flight.png`});await parry(page,'spore-1',135);
  await page.waitForFunction(()=>(window as any).__farwind().contacts.some((c:any)=>c.id.startsWith('spore-1')&&['normal','perfect'].includes(c.result)),null,{timeout:10000});const spore=(await read(page)).enemies.find((e:any)=>e.id==='spore-1');expect(spore.staggerRemaining).toBe(0);await page.screenshot({path:`${dir}/wild-spore-deflected.png`});
  observations.push(...await page.evaluate(()=>(window as any).__enemyObservations));await exportSample(page,'wild-spore');
  await start(page);await sample(page);await move(page,3540,1680);await move(page,3450,1910);await page.waitForFunction(()=>(window as any).__farwind().enemies.find((e:any)=>e.id==='raven-1').art.pose.action==='attack',null,{timeout:10000});await page.screenshot({path:`${dir}/wild-raven-attack.png`});
  observations.push(...await page.evaluate(()=>(window as any).__enemyObservations));await exportSample(page,'wild-raven');
  await start(page);await sample(page);await move(page,3300,510);await move(page,3280,340);await page.waitForFunction(()=>(window as any).__farwind().enemies.find((e:any)=>e.id==='boar-1').art.pose.action==='attack',null,{timeout:10000});await page.screenshot({path:`${dir}/wild-boar-attack.png`});
  observations.push(...await page.evaluate(()=>(window as any).__enemyObservations));for(const kind of ['spore','boar','raven'])expect(observations.some((s:any)=>s.enemies.some((e:any)=>e.type===kind&&e.art?.pose.action==='attack'))).toBe(true);expect(errors).toEqual([]);await exportSample(page,'wild-boar');await writeFile(`${dir}/wild-validation.json`,JSON.stringify({说明:'三个独立正常新游戏分别走向森林目标，键盘移动、真实接触与攻击；没有状态注入。',状态:'技术验证，美术待审阅',帧:observations,错误:errors},null,2));
});
test('assets-legacy-save-and-normal-entry',async({page,request})=>{
  const responses:string[]=[];page.on('response',r=>{if(r.url().includes('/assets/enemies-v1/'))responses.push(`${r.status()} ${r.url()}`);});await start(page);const s=await read(page);expect(s.enemies).toHaveLength(7);expect(s.state.quest).toBe(0);expect(await page.evaluate(()=>typeof (window as any).__slimeSample)).toBe('undefined');expect(responses).toHaveLength(7);expect(responses.every(s=>s.startsWith('200 '))).toBe(true);
  for(const name of ['moss-slime','branch-reaper','ashen-spore','armored-boar','dusk-raven','spore-projectile','spore-burst'])expect((await request.get(`/assets/enemies-v1/${name}.png`)).status()).toBe(200);
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'保存并返回标题',exact:true}).click();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');expect((await read(page)).enemies).toHaveLength(7);await writeFile(`${dir}/entry-validation.json`,JSON.stringify({说明:'正式入口装载全部图集，新游戏和读档仍保留原存档结构',素材响应:responses,状态:await read(page)},null,2));
});
test('wild-boar-hurt-death-and-reload',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await start(page);await sample(page);await move(page,3300,510);await move(page,3280,340);
  for(let i=0;i<55;i++){
    const s=await read(page),enemy=s.enemies.find((e:any)=>e.id==='boar-1');if(enemy.hp<=0)break;
    const dx=enemy.x-s.state.player.x,dy=enemy.y-s.state.player.y,key=Math.abs(dx)>Math.abs(dy)?dx<0?'a':'d':dy<0?'w':'s';
    await page.keyboard.down(key);await page.waitForTimeout(Math.hypot(dx,dy)>88?90:12);await page.keyboard.up(key);await page.keyboard.press('j');await page.waitForTimeout(155);
  }
  await page.waitForFunction(()=>(window as any).__farwind().state.killed.includes('boar-1'),null,{timeout:8000});await page.screenshot({path:`${dir}/wild-boar-death.png`});const s=await read(page),observations=await page.evaluate(()=>(window as any).__enemyObservations);
  expect(observations.some((s:any)=>s.enemies.some((e:any)=>e.id==='boar-1'&&e.art?.pose.action==='hurt'))).toBe(true);expect(observations.some((s:any)=>s.enemies.some((e:any)=>e.id==='boar-1'&&e.art?.pose.action==='death'))).toBe(true);expect(s.state.killed.filter((id:string)=>id==='boar-1')).toHaveLength(1);expect(s.state.quest).toBe(0);expect(errors).toEqual([]);await exportSample(page,'death');
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'保存并返回标题',exact:true}).click();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');expect((await read(page)).enemies.some((e:any)=>e.id==='boar-1')).toBe(false);
});
