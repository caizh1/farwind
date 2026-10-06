import {test,expect,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root='docs/east-boss-combat-enhancement/evidence';
const read=(page:Page)=>page.evaluate(()=>{const s=(window as any).__farwind();const e=s.enemies.find((e:any)=>e.id==='boss-bound-branch');return {now:s.session.sim,player:s.state.player,boss:e&&{...e,behavior:{...e.behavior,art:e.art,ai:e.ai,attack:e.attack}},fx:s.bossEffects,hazards:s.bossHazards,contacts:s.bossContacts,runes:s.runes,battle:s.state.encounters.groups['east-thorn-camp'].boss,combat:s.session.combat,mode:s.mode,fps:s.fps};});
async function load(page:Page,name:string,url='http://127.0.0.1:5368/'){
 await page.goto(url);await page.getByRole('button',{name:'启程 · 新游戏',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind?.().mode==='');await page.waitForTimeout(80);await page.keyboard.press('Escape');await page.getByRole('button',{name:'导入存档',exact:true}).waitFor({state:'visible',timeout:10000});const file=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入存档',exact:true}).click();await(await file).setFiles(resolve(`docs/east-boss-combat-enhancement/fixtures/${name}.json`));await page.getByRole('button',{name:'继续旅途',exact:true}).waitFor({state:'hidden'}).catch(()=>{});await page.waitForFunction(()=>['','dialog'].includes((window as any).__farwind?.().mode));
 for(let i=0;i<8&&(await read(page)).mode==='dialog';i++){await page.getByRole('button',{name:'继续 · E',exact:true}).click();}
 await page.waitForFunction(()=>(window as any).__farwind?.().mode==='');
 await expect.poll(async()=>{const s=await read(page);return s.boss?.behavior.art?.continuous?.mode;},{timeout:30000}).toBe('八方向预渲染动画');
 if(await page.locator('#minimap-toggle').getAttribute('aria-expanded')==='true')await page.locator('#minimap-toggle').click();
}
async function saveVideo(page:Page,name:string){const video=page.video();await page.close();if(video)await video.saveAs(`${root}/${name}.webm`);}
function summary(samples:any[]){const fps=(samples.at(-1)?.fps??[]).filter((n:any)=>typeof n==='number'&&n>0);const times=fps.map((n:number)=>1000/n).sort((a:number,b:number)=>a-b);const resources=samples.map(s=>s.boss?.behavior.art?.continuous?.resources).filter(Boolean);return {帧时间中位数:times[Math.floor(times.length*.5)],帧时间P95:times[Math.floor(times.length*.95)],帧时间最大值:times.at(-1),纹理峰值MiB:Math.max(0,...resources.map(r=>r.peakBytes))/1048576,关键缺帧:Math.max(0,...resources.map(r=>r.criticalMisses)),特效峰值:Math.max(0,...samples.map(s=>s.fx?.laserMaterials?.visible??0))};}
test.beforeEach(async({page})=>{mkdirSync(root,{recursive:true});page.on('dialog',d=>d.accept());});
for(const [name,fixture,url,modern] of [['baseline','laser-one','http://127.0.0.1:5367/',false],['phase-one','laser-one','http://127.0.0.1:5368/',true],['phase-two','laser-two','http://127.0.0.1:5368/',true],['png','laser-one','http://127.0.0.1:5368/?eastBossTexture=png',true]] as const){
 test(`真实巢穴 ${name} 光柱、刻线、追爆与存档恢复`,async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await load(page,fixture,url);console.log('已通过正式导入进入战斗：',name);const samples:any[]=[],seen=new Set<string>();let saved=false;const end=Date.now()+35000;
  while(Date.now()<end){const s=await read(page);samples.push(s);if(s.mode==='dialog'){await page.getByRole('button',{name:'继续 · E',exact:true}).click();continue;}if(s.player.hp<65)await page.keyboard.press('1');const h=s.hazards.find((h:any)=>h.laser);const stage=s.boss?.behavior.ai;
   if(h){expect(h.laser.version===2).toBe(modern);expect(s.fx.laserMaterials.visible).toBeLessThanOrEqual(64);}
   if(['八向激光','环形刻线','地面追爆'].includes(stage)&&!seen.has(stage)){seen.add(stage);console.log('实战阶段：',name,stage,s.now);await page.screenshot({path:`${root}/${name}-${stage==='八向激光'?'rays':stage==='环形刻线'?'etch':'echo'}.png`});}
   if(modern&&stage==='环形刻线'&&!saved){await page.keyboard.press('Escape');const before=await read(page);await page.waitForTimeout(150);expect((await read(page)).now).toBe(before.now);await page.getByRole('button',{name:'保存旅途',exact:true}).click();await expect(page.locator('#toast')).toContainText('已保存');const snap=await read(page);await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();const after=await read(page);expect(after.battle.attempt).toBe(snap.battle.attempt);expect(after.battle.combat.hazards[0].laser.radii).toEqual([140,250,360]);expect(after.battle.combat.hazards[0].point).toEqual(snap.battle.combat.hazards[0].point);saved=true;}
   if(seen.size===3&&(!modern||saved))break;await page.waitForTimeout(35);
  }
  expect([...seen].sort()).toEqual(['八向激光','地面追爆','环形刻线'].sort());expect(errors).toEqual([]);const metrics=summary(samples);expect(metrics.纹理峰值MiB).toBeLessThanOrEqual(192);writeFileSync(`${root}/${name}.json`,JSON.stringify({说明:'独立端口，初始样本经正式导入。正常键鼠、保存和刷新；未直接改写运行状态。',指标:metrics,暂停读档:saved,错误:errors,样本:samples},null,2));await saveVideo(page,name);
 });
}
test('施法中真实黑洞牵引，不换受击动作、不重复牵引、不漂移赤环',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await load(page,'black-hole','http://127.0.0.1:5368/?blackHoleArena=1');await page.locator('#black-hole-guaranteed').uncheck();await page.locator('#black-hole-guaranteed').check();await page.locator('#black-hole-arena summary').click();await page.keyboard.down('w');await page.waitForTimeout(15);await page.keyboard.up('w');await page.keyboard.down('i');const samples:any[]=[],end=Date.now()+23000;let pulled=false,locked:any,lastWind=-Infinity;
 while(Date.now()<end){const s=await read(page);samples.push(s);if(s.mode==='dialog'){await page.getByRole('button',{name:'继续 · E',exact:true}).click();continue;}if(s.player.hp<60)await page.keyboard.press('1');if(s.now-lastWind>850){await page.keyboard.up('i');await page.keyboard.press('i');lastWind=s.now;}if(s.runes.blackHole.metrics.pulled>5&&s.boss.behavior.attack?.bossLaser&&!s.boss.behavior.attack.cancelled)pulled=true;const h=s.hazards.find((h:any)=>h.laser?.centerLocked);if(h){locked??=h.point;if(h.id===samples.find(s=>s.hazards.some((h:any)=>h.laser?.centerLocked))?.hazards[0]?.id)expect(h.point).toEqual(locked);}
  if(pulled&&s.runes.blackHole.rifts.length&&s.boss.behavior.ai==='八向激光'){expect(s.boss.behavior.art.continuous.pose.clip).toBe('laser-hold');if(!samples.some(x=>x.已截图)){s.已截图=true;await page.screenshot({path:`${root}/black-hole-casting.png`});}}
  if(pulled&&locked&&s.boss.behavior.ai==='地面追爆')break;await page.waitForTimeout(50);
 }
 await page.keyboard.up('i');writeFileSync(`${root}/black-hole-diagnostic.json`,JSON.stringify({说明:'牵引检查原始采样，用于定位样本站位与运行规则。',样本:samples},null,2));expect(pulled).toBe(true);expect(locked).toBeTruthy();expect(errors).toEqual([]);writeFileSync(`${root}/black-hole.json`,JSON.stringify({说明:'通过开发复选框确定触发，只设置触发随机数；Boss、位移、施法、伤害和碰撞全部由正式系统推进。',指标:summary(samples),施法中受牵引:pulled,锁定圆心:locked,错误:errors,样本:samples},null,2));await saveVideo(page,'black-hole');
});
test('近战连续命中护心茧仍持续',async({page})=>{
 await load(page,'cocoon');const samples:any[]=[],end=Date.now()+16000;let damaged=false;await page.keyboard.down('w');await page.waitForTimeout(550);await page.keyboard.up('w');
 while(Date.now()<end){const s=await read(page);samples.push(s);const a=s.boss.behavior.attack;if(a?.bossSkill===3&&s.now>=a.contactAt)await page.keyboard.press('j');if(s.boss.hp<2500&&a?.bossSkill===3&&s.now>=a.contactAt){damaged=true;expect(s.boss.behavior.attack.cancelled).toBe(false);expect(s.boss.behavior.art.continuous.pose.clip).not.toBe('hurt');expect(s.combat.hitStopRemaining).toBe(0);}if(damaged)break;await page.waitForTimeout(80);}
 expect(damaged).toBe(true);await page.screenshot({path:`${root}/cocoon-hit.png`});writeFileSync(`${root}/cocoon.json`,JSON.stringify({说明:'真实走近并近战命中，检查招式继续与受击动画。',样本:samples},null,2));await saveVideo(page,'cocoon');
});

for(const [name,fixture,lead,quality] of [['parry-normal','parry-scythe',160,'normal'],['parry-perfect','parry-right',45,'perfect']] as const){
 test(`扩大扇形的真实 ${name} 中断`,async({page})=>{
  await load(page,fixture);await page.keyboard.down('w');await page.waitForTimeout(15);await page.keyboard.up('w');const samples:any[]=[],end=Date.now()+25000;let sent='',success=false;
  while(Date.now()<end){const s=await read(page);samples.push(s);if(s.mode==='dialog'){await page.getByRole('button',{name:'继续 · E',exact:true}).click();continue;}const a=s.boss.attack;if(a?.bossSkill===0&&!a.cancelled&&a.attackId!==sent&&a.contactAt-s.now<=lead&&a.contactAt-s.now>10){await page.keyboard.press('k');sent=a.attackId;}if(s.contacts.some((c:any)=>c.result===quality)){success=true;await page.screenshot({path:`${root}/${name}.png`});break;}if(s.player.hp<60)await page.keyboard.press('1');await page.waitForTimeout(8);}
  expect(success).toBe(true);const last=await read(page);expect(last.boss.attack?.cancelled??true).toBe(true);writeFileSync(`${root}/${name}.json`,JSON.stringify({说明:'正式架剑按键，按实际攻击时钟决定输入时刻，没有强写弹反状态。',样本:samples,结果:last},null,2));await saveVideo(page,name);
 });
}
test('真实障碍边缘挥镰与离开攻击范围',async({page})=>{
 await load(page,'obstacle');const samples:any[]=[];for(let i=0;i<60;i++){const s=await read(page);samples.push(s);if(s.player.hp<60)await page.keyboard.press('1');await page.waitForTimeout(50);}
 await page.screenshot({path:`${root}/obstacle.png`});expect(samples.some(s=>s.boss.attack?.bossSkill===0)).toBe(true);await page.keyboard.down('a');await page.keyboard.down('Space');await page.waitForTimeout(4000);await page.keyboard.up('a');await page.keyboard.up('Space');writeFileSync(`${root}/obstacle.json`,JSON.stringify({说明:'导入障碍边缘样本后正常键鼠；记录根点与动作，随后离开攻击范围。',样本:samples,结束:await read(page)},null,2));await saveVideo(page,'obstacle');
});

test('死亡取消招式并清理危险区',async({page})=>{
 await load(page,'death');await page.waitForFunction(()=>{const e=(window as any).__farwind().enemies.find((e:any)=>e.id==='boss-bound-branch');return e?.ai==='八向激光';});await page.keyboard.down('w');await page.waitForTimeout(500);await page.keyboard.up('w');const samples:any[]=[],end=Date.now()+18000;
 while(Date.now()<end){const s=await read(page);samples.push(s);if(s.battle.stage==='defeated')break;await page.keyboard.press('j');await page.waitForTimeout(100);}
 const last=await read(page);expect(last.battle.stage).toBe('defeated');expect(last.hazards.filter((h:any)=>h.owner==='boss-bound-branch')).toEqual([]);expect(last.boss?.attack?.cancelled??true).toBe(true);await page.screenshot({path:`${root}/death.png`});writeFileSync(`${root}/death.json`,JSON.stringify({说明:'低生命初始样本通过普通攻击击杀，清理由正式死亡系统执行。',样本:samples,结束:last},null,2));await saveVideo(page,'death');
});
test('离开据点后撤退清理正在释放的招式',async({page})=>{
 await load(page,'laser-one');const samples:any[]=[],end=Date.now()+25000;await page.keyboard.down('d');await page.keyboard.down('Space');let started=false;
 while(Date.now()<end){const s=await read(page);samples.push(s);if(s.player.hp<60)await page.keyboard.press('1');if(s.mode==='dialog'){await page.getByRole('button',{name:'继续 · E',exact:true}).click();continue;}
  if(s.battle.away>0&&!started){started=true;await page.keyboard.up('d');await page.keyboard.up('Space');}
  if(started&&s.battle.stage!=='battle')break;await page.waitForTimeout(80);
 }
 await page.keyboard.up('d');await page.keyboard.up('Space');const last=await read(page);writeFileSync(`${root}/retreat.json`,JSON.stringify({说明:'真实方向键与疾跑离开据点，等待正式撤退时钟；未改写位置。',样本:samples,结束:last},null,2));expect(started).toBe(true);expect(last.battle.stage).toBe('warning');expect(last.hazards.filter((h:any)=>h.owner==='boss-bound-branch')).toEqual([]);await page.screenshot({path:`${root}/retreat.png`});await saveVideo(page,'retreat');
});
test('降低闪光与简化装饰仍保留完整三环',async({page})=>{
 await load(page,'laser-one');await page.keyboard.press('Escape');await page.getByRole('button',{name:'设置',exact:true}).click();await page.locator('#rune-simple').check();await page.locator('#rune-low-flash').check();await page.getByRole('button',{name:'返回',exact:true}).click();await page.keyboard.press('Escape');const samples:any[]=[],end=Date.now()+18000;let shown=false;
 while(Date.now()<end){const s=await read(page);samples.push(s);if(s.player.hp<60)await page.keyboard.press('1');if(s.boss?.behavior.ai==='地面追爆'){expect(s.hazards.find((h:any)=>h.laser)?.laser.radii).toEqual([140,250,360]);expect(s.fx.laserMaterials.visible).toBeLessThanOrEqual(64);shown=true;break;}await page.waitForTimeout(50);}
 expect(shown).toBe(true);await page.screenshot({path:`${root}/simple-low-flash.png`});writeFileSync(`${root}/simple-low-flash.json`,JSON.stringify({说明:'正常设置界面启用两项偏好，地面攻击仍按正式三环几何显示。',指标:summary(samples),样本:samples},null,2));await saveVideo(page,'simple-low-flash');
});
test('祭印击破仍保留仪式与危险区',async({page})=>{
 await load(page,'sigil');const samples:any[]=[],end=Date.now()+16000;let broken=false;await page.keyboard.down('w');await page.waitForTimeout(300);await page.keyboard.up('w');
 while(Date.now()<end){const s=await read(page);samples.push(s);const a=s.boss?.attack;if(a?.bossSkill===5&&s.now>a.contactAt&&s.now<a.activeUntil){await page.keyboard.press('j');}if(s.boss?.behavior.battle.roots?.filter((r:any)=>r.kind==='sigil').every((r:any)=>r.hp<=0)&&s.boss.behavior.battle.roots.length){broken=true;expect(a.cancelled).toBe(false);expect(s.hazards.length).toBeGreaterThan(0);expect(s.boss.behavior.art.continuous.pose.clip).toBe('ritual-hold');break;}await page.waitForTimeout(60);}
 writeFileSync(`${root}/sigil.json`,JSON.stringify({说明:'样本祭印预设残血，正式近战击破；检查减防暴露与招式继续同时成立。',样本:samples},null,2));expect(broken).toBe(true);await page.screenshot({path:`${root}/sigil-broken.png`});await saveVideo(page,'sigil');
});

for(const [name,fixture,url] of [['baseline-continuous','laser-one','http://127.0.0.1:5367/'],['laser-continuous','laser-one','http://127.0.0.1:5368/'],['scythe-continuous','scythe','http://127.0.0.1:5368/']] as const){
 test(`完整正常速度录像 ${name}`,async({page})=>{
  const start=Date.now();await load(page,fixture,url);const samples:any[]=[],end=Date.now()+20000;let attack='',finished=false,parts=new Set<number>();
  while(Date.now()<end){const s=await read(page);s.录像时间毫秒=Date.now()-start;samples.push(s);if(s.mode==='dialog'){await page.getByRole('button',{name:'继续 · E',exact:true}).click();continue;}if(s.player.hp<60)await page.keyboard.press('1');const a=s.boss?.attack;if(a){attack||=a.attackId;parts.add(a.bossPart);}if(attack&&!a&&s.boss?.behavior.ai==='首领破防窗口'){finished=true;break;}await page.waitForTimeout(35);}
  expect(finished).toBe(true);if(name==='scythe-continuous')expect(parts.has(1)).toBe(true);writeFileSync(`${root}/${name}.json`,JSON.stringify({说明:'不暂停、不刷新的一次正式完整招式，墙钟只用于裁剪视频；战斗仍按正式时钟结算。',指标:summary(samples),样本:samples},null,2));await page.screenshot({path:`${root}/${name}-end.png`});await saveVideo(page,name);
 });
}

test('树墙边的施法牵引遵守实际扫掠阻挡',async({page})=>{
 await load(page,'black-hole-wall','http://127.0.0.1:5368/?blackHoleArena=1');await page.locator('#black-hole-guaranteed').uncheck();await page.locator('#black-hole-guaranteed').check();await page.locator('#black-hole-arena summary').click();await page.keyboard.down('s');await page.waitForTimeout(15);await page.keyboard.up('s');const samples:any[]=[],end=Date.now()+11000;let last=-Infinity;
 while(Date.now()<end){const s=await read(page);samples.push(s);if(s.player.hp<60)await page.keyboard.press('1');if(s.now-last>850){await page.keyboard.press('i');last=s.now;}await page.waitForTimeout(60);}
 const first=samples[0],lastState=samples.at(-1),distance=Math.hypot(lastState.boss.x-first.boss.x,lastState.boss.y-first.boss.y);expect(lastState.runes.blackHole.metrics.procs).toBeGreaterThan(0);expect(distance).toBeLessThan(34);expect(lastState.boss.y).toBeGreaterThanOrEqual(920);expect(samples.some(s=>s.boss.attack?.bossLaser&&!s.boss.attack.cancelled)).toBe(true);writeFileSync(`${root}/black-hole-wall.json`,JSON.stringify({说明:'地图工具查得向前迈步受阻的树墙初始点；正式剑风生成裂缝，牵引不能穿过该障碍。',指标:summary(samples),位移:distance,样本:samples},null,2));await page.screenshot({path:`${root}/black-hole-wall.png`});await saveVideo(page,'black-hole-wall');
});
