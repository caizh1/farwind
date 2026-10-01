import {test,expect,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {CAMP_BOSSES,type CampBossKind} from '../src/data/maps/windbell/campBosses';
import {ENCOUNTERS} from '../src/data/maps/windbell/encounters';
import {VILLAGE_ANCHORS} from '../src/data/maps/windbell/layout';
import {clearMotionLine,motionBlocked} from '../src/game/systems/obstacles';
import {syncMapGeometry} from '../src/data/world';
import {move} from './south-navigation';
import {fight} from './field-combat';
const read=(p:Page)=>p.evaluate(()=>(window as any).__farwind());
const compact=(p:Page)=>p.evaluate(()=>{const s=(window as any).__farwind();return {p:s.state.player,mode:s.mode,sim:s.skillGrowth.sim,enemies:s.enemies,hazards:s.bossHazards,effects:s.bossEffects,contacts:s.bossContacts,groups:s.state.encounters.groups,xiaobao:s.state.xiaobao,bag:s.state.bag,stage:s.skillGrowth.combatStage,saving:s.defenseSaving};});
const keyFor=(dx:number,dy:number)=>Math.abs(dx)>Math.abs(dy)?dx<0?'a':'d':dy<0?'w':'s';
const potionCount=(bag:any[])=>bag.filter(x=>x?.id==='potion').reduce((n,x)=>n+x.count,0);
async function tapToward(page:Page,p:{x:number;y:number},point:{x:number;y:number},ms:number){const key=keyFor(point.x-p.x,point.y-p.y);await page.keyboard.down(key);await page.waitForTimeout(ms);await page.keyboard.up(key);}
async function pause(page:Page){
 for(let n=0;n<6;n++){const s=await compact(page);if(s.mode==='pause')return;if(s.mode==='dialog')await page.getByRole('button',{name:'继续 · E',exact:true}).click();else await page.keyboard.press('Escape');await page.waitForTimeout(50);}
 throw Error('未能通过正常界面进入暂停菜单。');
}
async function resumeSaved(page:Page){
 await page.getByRole('button',{name:'继续旅途',exact:true}).click();
 await page.waitForFunction(()=>['','dialog'].includes((window as any).__farwind().mode));
 for(let n=0;n<6;n++){const s=await compact(page);if(!s.mode)return;if(s.mode==='dialog')await page.getByRole('button',{name:'继续 · E',exact:true}).click();await page.waitForTimeout(80);}
 throw Error('重开后的剧情对话尚未结束。');
}
async function setup(page:Page,companion:boolean){
 await page.goto('/');await page.getByRole('button',{name:'启程 · 新游戏',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind?.().mode==='');
 await move(page,560,810);await page.keyboard.press('e');await page.getByRole('button',{name:'领取委托与启程补给',exact:true}).click();await expect(page.locator('#commission-feedback')).toContainText('委托已领取');await page.getByRole('button',{name:'合上委托簿 Esc',exact:true}).click();
 await move(page,VILLAGE_ANCHORS.general.x,VILLAGE_ANCHORS.general.y+65);await page.keyboard.press('e');await page.getByLabel('物品',{exact:true}).selectOption('potion');await page.getByLabel('数量',{exact:true}).fill('3');await page.locator('#shop-review').click();await page.locator('#shop-confirm').click();await expect(page.locator('#shop-feedback')).toContainText('已完成');await page.keyboard.press('Escape');
 await move(page,VILLAGE_ANCHORS.smith.x,VILLAGE_ANCHORS.smith.y+65);await page.keyboard.press('e');await page.getByLabel('物品',{exact:true}).selectOption('ironSword');await page.locator('#shop-review').click();await page.locator('#shop-confirm').click();await expect(page.locator('#shop-feedback')).toContainText('已完成');await page.keyboard.press('Escape');
 await page.keyboard.press('Tab');await page.locator('.slot').filter({hasText:'铁剑'}).click();await page.locator('#equip').click();await page.waitForFunction(()=>(window as any).__farwind().state.equipment.weapon==='ironSword');await page.keyboard.press('Escape');
 if(companion){await page.locator('#xiaobao-summary').click();await page.getByRole('button',{name:'与我出征',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().state.xiaobao.task==='follow');}
 const s=(await read(page)).state;expect(s.skills.swordWindStage).toBe(0);expect(s.xiaobao.task).toBe(companion?'follow':'free');
}
async function route(page:Page,kind:CampBossKind){
 const routes:Record<CampBossKind,number[][]>={
 'spore-heart':[[900,1900],[1050,2040],[1000,2450],[1250,2820]],
 'thorn-crown':[[820,120],[-80,120],[-140,1260],[-700,1340],[-1700,1490]],
 'crag-tusk':[[820,120],[560,-140],[1030,-260],[1480,-730]],
 'bound-branch':[[1980,1100],[2580,1100],[3710,1100]],
 };for(const [x,y] of routes[kind]){await move(page,x,y);if((await read(page)).state.xiaobao.task==='follow')await page.waitForFunction(()=>{const s=(window as any).__farwind().state;return Math.hypot(s.player.x-s.xiaobao.x,s.player.y-s.xiaobao.y)<240;},undefined,{timeout:15000});}
}

// 固定环境机关也只用真实方向与攻击键处理，不修改生命、坐标或事件结果。
async function breakRoot(page:Page,id:string){
 for(let n=0;n<100;n++){const s=await read(page),r=s.enemies.find((e:any)=>e.id===id&&e.hp>0);if(!r)return;
  if(s.mode)throw Error('拆根被界面中断：'+s.mode);if(s.state.player.hp<50)await page.keyboard.press('1');
  const d=Math.hypot(r.x-s.state.player.x,r.y-s.state.player.y);await tapToward(page,s.state.player,r,d>65?100:5);await page.keyboard.press('j');await page.waitForTimeout(180);
 }throw Error('普通攻击未能拆除祭根。');
}
async function induceBlast(page:Page){
 // 站到菌障附近引导锁向，看到膨胀后通过正常步行离开爆炸范围。
 for(let n=0;n<80;n++){const s=await read(page);if(s.state.southEvents.orchard===0)return;
  if(s.mode)throw Error('诱爆被界面中断：'+s.mode);const b=s.enemies.find((e:any)=>e.id==='wild-orchard-bomber'&&e.hp>0);if(!b)throw Error('滚兽在完成诱爆前死亡。');
  if(s.state.player.hp<60)await page.keyboard.press('1');const a=b.behavior.attack;
  if(a?.bombAt&&s.skillGrowth.sim>=a.activeUntil){await tapToward(page,s.state.player,{x:1670,y:2490},400);await page.waitForTimeout(600);}
  else{await tapToward(page,s.state.player,{x:1840,y:2450},Math.hypot(s.state.player.x-1840,s.state.player.y-2450)>15?120:5);await page.waitForTimeout(100);}
 }throw Error('滚兽实际爆点未能触及菌障。');
}

for(const companion of [true])for(const kind of ['spore-heart'] as CampBossKind[]){
 test('SOUTH-01',async({page},info)=>{
  syncMapGeometry(false);const root=`docs/combat-expansion/evidence/south-journey`;mkdirSync(root,{recursive:true});const errors:string[]=[],report:any={说明:'关闭测试授予的正式构建；从新游戏出发，键鼠领取、购买、穿戴、步行、识招、弹反、风步与战斗。诊断只读，不修改坐标、生命、时钟或清剿。',路径:companion?'带小宝':'独战',首领:CAMP_BOSSES[kind].name,节点:[],错误:errors,结果:'进行中'};
  await page.addInitScript(()=>{const frames:number[]=[];let last=performance.now();(window as any).__campFrameTimes=frames;const tick=(now:number)=>{frames.push(now-last);last=now;if(frames.length>18000)frames.shift();requestAnimationFrame(tick);};requestAnimationFrame(tick);});
  page.on('pageerror',e=>errors.push(e.message));const saveReport=()=>writeFileSync(root+'/gameplay.json',JSON.stringify(report,null,2));
  const snap=async(name:string,file:string)=>{if(file==='phase-two')await expect(page.locator('[data-boss-health]')).toContainText('第2阶段');const s=await read(page);report.节点.push({名称:name,模拟毫秒:s.skillGrowth.sim,玩家:s.state.player,小宝:s.state.xiaobao,遭遇:s.state.encounters.groups[CAMP_BOSSES[kind].camp],首领:s.enemies.find((e:any)=>e.id==='boss-'+kind),危险区:s.bossHazards,世界时间:s.state.time,委托:s.state.fieldQuests,魔王:s.state.demonKing,威胁:s.wilderness,采集事件:s.state.southEvents,现场敌人:s.enemies});saveReport();await page.screenshot({path:root+'/'+file+'.png'});};
  try{
   await setup(page,companion);
   const fieldFight=async(ids:string[])=>fight(page,ids);
   await move(page,900,1900);
   await move(page,1050,2040,()=>fieldFight(['wild-reed-slime','wild-reed-spore']));
   await fieldFight(['wild-reed-slime','wild-reed-spore']);
   await move(page,680,2440,()=>fieldFight(['wild-herb-priest','wild-herb-spore','wild-herb-slime','wild-margin-slime']));
   await snap('洼地组合与可攻击菌根的正式场景','herb-encounter');
   await fieldFight(['wild-herb-priest']);await fieldFight(['wild-herb-spore','wild-herb-slime','wild-margin-slime']);
   await breakRoot(page,'south-event-herb');expect((await read(page)).state.southEvents.herb).toBe(0);
   await snap('普通攻击拆除菌根，洼地采集恢复','herb-restored');
   for(const [x,y] of [[640,2390],[730,2500]]){await move(page,x,y);await page.keyboard.press('e');await page.waitForTimeout(100);}
   expect((await read(page)).state.bag.filter((x:any)=>x?.id==='herb').reduce((n:number,x:any)=>n+x.count,0)).toBeGreaterThanOrEqual(2);
   await page.locator('#xiaobao-summary').click();await page.getByRole('button',{name:'在此等候',exact:true}).click();
   await move(page,1800,2340,()=>fieldFight(['wild-orchard-worm-a','wild-orchard-worm-b']));
   await snap('沿果园路径诱导滚兽，观察实际清障与膨胀提示','orchard-encounter');
   await induceBlast(page);expect((await read(page)).state.southEvents.orchard).toBe(0);
   await snap('诱爆拆障，玩家仍存活','orchard-blast');
   await fieldFight(['wild-orchard-bomber','wild-orchard-worm-a','wild-orchard-worm-b']);
   await page.locator('#xiaobao-summary').click();await page.getByRole('button',{name:'归队',exact:true}).click();
   await move(page,1250,2820,()=>fieldFight(['wild-camp-priest','wild-camp-spore','wild-camp-slime-a','wild-camp-slime-b']));const camp=ENCOUNTERS.find(d=>d.id===CAMP_BOSSES[kind].camp)!;
   await fight(page,camp.members.filter(m=>!m.boss).map(m=>m.id));await snap('驻守杂兵全灭，清除尚未完成','guards');
   expect((await read(page)).state.encounters.groups[camp.id].cleared).toBe(false);await page.waitForFunction(id=>(window as any).__farwind().enemies.some((e:any)=>e.id===id&&e.hp>0),'boss-'+kind);
   await snap('首领第一阶段正式入场','phase-one');const start=await compact(page),wall=Date.now();let lastJ=-1e9,lastPotion=-1e9,phaseTwo=false,parries=0,dashes=0,damageTaken=0,previousHP=start.p.hp,lastSim=start.sim,advancedAt=Date.now(),progressAt=0;let resumed=false,spent=0,segmentStart=start.sim;const parried=new Set<string>(),dashed=new Set<string>(),moves=new Set<number>(),successes=new Set<string>();
   while(Date.now()-wall<300000){
    const s=await compact(page),g=s.groups[camp.id],e=s.enemies.find((e:any)=>e.id==='boss-'+kind&&e.hp>0);
    for(const c of s.contacts??[])if(c.result==='normal'||c.result==='perfect')successes.add(c.id);
    if(errors.length)throw Error('游戏运行出错：'+errors[0]);
    if(s.sim!==lastSim){advancedAt=Date.now();lastSim=s.sim;}else if(!s.mode&&!s.saving&&Date.now()-advancedAt>3000)throw Error('游戏模拟时钟停止，保留首次追踪以定位原因。');
    if(s.p.hp<previousHP)damageTaken+=previousHP-s.p.hp;previousHP=s.p.hp;
    if(g.cleared)break;
    if(s.mode==='dialog'){await page.getByRole('button',{name:'继续 · E',exact:true}).click();continue;}
    if(s.mode||s.saving){await page.waitForTimeout(60);continue;}
    if(!e||Math.hypot(s.p.x-camp.x,s.p.y-camp.y)>camp.radius+190)throw Error('首领挑战已重置，需要重新进行真实挑战。');
    if(Date.now()-progressAt>10000){progressAt=Date.now();report.战斗进度={模拟秒:(spent+s.sim-segmentStart)/1000,首领生命:e.hp,阶段:e.behavior.battle.phase,玩家生命:s.p.hp,剩余药剂:potionCount(s.bag),同行距离:Math.hypot(s.p.x-s.xiaobao.x,s.p.y-s.xiaobao.y)};saveReport();}
    if(!resumed&&e.behavior.battle.phase===2&&s.enemies.some((r:any)=>r.behavior.passiveRoot?.owner===e.id&&r.hp>0&&r.hp<96)){
      await pause(page);const paused=await compact(page);await page.waitForTimeout(400);expect((await compact(page)).sim).toBe(paused.sim);
      await page.getByRole('button',{name:'保存旅途',exact:true}).click();await expect(page.locator('#toast')).toContainText('已保存');const saved=(await read(page)).state.encounters.groups[camp.id];spent+=paused.sim-segmentStart;
      await page.reload();await resumeSaved(page);const restored=(await compact(page)).groups[camp.id];expect(restored.members.at(-1).hp).toBe(saved.members.at(-1).hp);expect(restored.boss.attempt).toBe(saved.boss.attempt);expect(restored.boss.combat.battle.phase).toBe(saved.boss.combat.battle.phase);expect(restored.boss.combat.battle.roots).toEqual(saved.boss.combat.battle.roots);expect((await read(page)).state.xiaobao.affected.some((r:any)=>r.id.includes('祭根'))).toBe(false);segmentStart=(await compact(page)).sim;lastJ=lastPotion=-1e9;lastSim=segmentStart;advancedAt=Date.now();resumed=true;await snap('二阶段祭根受伤后，暂停保存重开保持首领与祭根伤势','battle-reloaded');continue;
    }
    if(e.behavior.battle.phase===2&&!phaseTwo){phaseTwo=true;await snap('当前招式结束后进入第二阶段','phase-two');}
    if(e.behavior.battle.phase===2&&!report.二阶段特效&&s.effects?.effects.some((fx:any)=>fx.boss===kind&&fx.phase!=='蓄力'&&(fx.skill!==undefined||fx.id.includes(':地面')))){report.二阶段特效={模拟毫秒:s.sim,效果:s.effects};await page.screenshot({path:root+'/phase-two-effects.png'});saveReport();}
    if(kind==='bound-branch'&&!report.破茧特效&&e.behavior.attack?.skill===3&&e.behavior.attack.cancelled&&s.effects?.effects.some((fx:any)=>fx.kind==='风核暴露')){report.破茧特效={模拟毫秒:s.sim,效果:s.effects};await page.screenshot({path:root+'/cocoon-broken.png'});saveReport();}
    if(s.p.hp<52&&s.sim-lastPotion>1000&&potionCount(s.bag)>0){await page.keyboard.press('1');lastPotion=s.sim;await page.waitForTimeout(80);continue;}
    const a=e.behavior.attack,dist=Math.hypot(e.x-s.p.x,e.y-s.p.y),token=a?`${a.startedAt}:${a.skill}:${a.part}`:'',lead=a?a.contactAt-s.sim:Infinity;if(a)moves.add(a.skill);
    const hazards=s.hazards.filter((h:any)=>h.owner===e.id&&h.expires>s.sim),danger=hazards.find((h:any)=>{const d=Math.hypot(s.p.x-h.point.x,s.p.y-h.point.y);return s.sim>=h.activeAt-(h.kind==='circle'?530:600)&&d<h.radius+20;});
    if(danger&&!dashed.has(danger.id)){
      let dx=s.p.x-danger.point.x,dy=s.p.y-danger.point.y;if(Math.hypot(dx,dy)<1){dx=s.p.x-e.x;dy=s.p.y-e.y;if(Math.hypot(dx,dy)<1)dx=1;}const n=Math.max(1,Math.hypot(dx,dy)),distance=danger.kind==='ring'?280:90;let point={x:s.p.x+dx/n*distance,y:s.p.y+dy/n*distance};
      const choices=[[1,0],[-1,0],[0,1],[0,-1]].map(([x,y])=>({x:s.p.x+x*distance,y:s.p.y+y*distance})).filter(p=>!motionBlocked(p.x,p.y)&&clearMotionLine(s.p,p)&&Math.hypot(p.x-camp.x,p.y-camp.y)<camp.radius+55).sort((a,b)=>danger.kind==='circle'?Math.hypot(a.x-e.x,a.y-e.y)-Math.hypot(b.x-e.x,b.y-e.y):Math.hypot(b.x-danger.point.x,b.y-danger.point.y)-Math.hypot(a.x-danger.point.x,a.y-danger.point.y));if(choices.length)point=choices[0];
      dashed.add(danger.id);if(danger.kind==='circle')await tapToward(page,s.p,point,520);else{const key=keyFor(point.x-s.p.x,point.y-s.p.y);await page.keyboard.down(key);await page.keyboard.down('Space');await page.waitForTimeout(20);await page.keyboard.press('l');dashes++;await page.waitForTimeout(850);await page.keyboard.up('Space');await page.keyboard.up(key);}continue;
    }
    // 齐射的缺口在喷口前方展开；连斩贴到脚底时先后退，不能在四个喷口之间站桩。
    if(a?.shotAngles&&dist<80&&lead>100){const choices=[[1,0],[-1,0],[0,1],[0,-1]].map(([x,y])=>({x:s.p.x+x*80,y:s.p.y+y*80})).filter(p=>!motionBlocked(p.x,p.y)&&clearMotionLine(s.p,p)&&Math.hypot(p.x-camp.x,p.y-camp.y)<camp.radius+55).sort((a,b)=>Math.hypot(b.x-e.x,b.y-e.y)-Math.hypot(a.x-e.x,a.y-e.y));if(choices.length){await tapToward(page,s.p,choices[0],180);continue;}}
    const shot=g.boss.combat?.shots?.filter((shot:any)=>shot.state==='flying').find((shot:any)=>{const dx=s.p.x-shot.x,dy=s.p.y-shot.y,d=shot.attack.direction,along=dx*d.x+dy*d.y,side=Math.abs(dx*d.y-dy*d.x);return side<14&&along>0&&along/250*1000<240;});
    if(shot&&!parried.has(shot.id)){await tapToward(page,s.p,{x:shot.x,y:shot.y},20);await page.keyboard.press('k');parried.add(shot.id);parries++;await page.waitForTimeout(230);continue;}
    if(a&&!a.area&&!a.shotAngles&&a.skill!==3||a&&kind!=='bound-branch'&&!a.area&&!a.shotAngles){
      if(lead<170&&lead>-40&&dist<170&&!parried.has(token)){await tapToward(page,s.p,e,20);await page.keyboard.press('k');parried.add(token);parries++;await page.waitForTimeout(250);continue;}
    }
    const rootTarget=s.enemies.filter((r:any)=>r.behavior.passiveRoot?.owner===e.id&&r.hp>0).sort((a:any,b:any)=>Math.hypot(a.x-s.p.x,a.y-s.p.y)-Math.hypot(b.x-s.p.x,b.y-s.p.y))[0];
    if(rootTarget){
      const rootDistance=Math.hypot(rootTarget.x-s.p.x,rootTarget.y-s.p.y);
      await tapToward(page,s.p,rootTarget,rootDistance>65?100:5);
      if(rootDistance<100&&s.sim-lastJ>180){await page.keyboard.press('j');lastJ=s.sim;}
      await page.waitForTimeout(70);continue;
    }
    const safeGround=a?.area==='circle'&&lead<0&&s.stage<2&&hazards.every((h:any)=>h.kind==='circle'&&Math.hypot(s.p.x-h.point.x,s.p.y-h.point.y)>h.radius+20),exposed=e.behavior.battle.exposedUntil>s.sim,mayAttack=!a||exposed||lead>700&&!a.area&&!a.shotAngles||a?.shotAngles&&lead>650&&!s.stage||safeGround||kind==='bound-branch'&&a.skill===3&&lead<0;
    if(dist>65&&(!a||exposed||lead>420)){if(dist>130)await page.keyboard.down('Space');await tapToward(page,s.p,e,80);await page.keyboard.up('Space');continue;}
    if(mayAttack&&dist<100&&s.sim-lastJ>180){await tapToward(page,s.p,e,5);await page.keyboard.press('j');lastJ=s.sim;}
    await page.waitForTimeout(45);
   }
   const end=await compact(page);expect(end.groups[camp.id].cleared).toBe(true);expect(phaseTwo).toBe(true);expect(resumed,'祭根受伤后的正式存档恢复已验证').toBe(true);const frames=await page.evaluate(()=>(window as any).__campFrameTimes as number[]);frames.sort((a,b)=>a-b);report.帧间隔={样本数:frames.length,中位毫秒:frames[Math.floor(frames.length*.5)],百分之九十五毫秒:frames[Math.floor(frames.length*.95)],最大毫秒:frames.at(-1)};report.耗时秒=(spent+end.sim-segmentStart)/1000;report.墙钟秒=(Date.now()-wall)/1000;report.药剂消耗=potionCount(start.bag)-potionCount(end.bag);report.受到伤害=damageTaken;report.弹反输入=parries;report.弹反成功=successes.size;report.风步输入=dashes;report.观察到的技能=[...moves];
   await snap('首领死亡后正式清除，恶意只结算一次','cleared');
   if((await read(page)).mode==='victory')await page.getByRole('button',{name:'确认 · 继续旅途',exact:true}).click();
   await move(page,560,810,()=>fieldFight(['wild-reed-slime','wild-reed-spore','wild-herb-priest','wild-herb-spore','wild-herb-slime','wild-margin-slime']));
   await page.keyboard.press('e');await page.locator('#commission-event-herb').click();await expect(page.locator('#commission-feedback')).toContainText('谢礼已保存并领取');
   await page.locator('#commission-event-orchard').click();await expect(page.locator('#commission-feedback')).toContainText('谢礼已保存并领取');
   await page.locator('#commission-submit').click();await expect(page.locator('#commission-feedback')).toContainText('委托已完成');
   expect((await read(page)).state.southEvents.claimed).toEqual(['herb','orchard']);await snap('回村通过公共委托簿领取两处谢礼并交付药草','rewards');await page.locator('#close').click();
   await pause(page);await page.locator('#pause-map').click();await expect(page.locator(`[data-camp-status="${camp.id}"]`)).toContainText('已清除');await page.locator('.camp-map-status').scrollIntoViewIfNeeded();await snap('完整地图与据点清除状态同步','map-cleared');await page.locator('#close').click();await page.locator('#pause-quest').click();await expect(page.locator('#modal')).toContainText('恶意 1');if(kind==='spore-heart')await expect(page.locator('#modal')).toContainText('南路采集恢复');await snap('手记中的恶意与南路委托条件同步','journal-cleared');await page.locator('#close').click();
   await page.getByRole('button',{name:'保存旅途',exact:true}).click();await expect(page.locator('#toast')).toContainText('已保存');await page.reload();await resumeSaved(page);expect((await read(page)).state.encounters.groups[camp.id].cleared).toBe(true);expect((await read(page)).state.fieldQuests['south-supply']).toBe('complete');expect((await read(page)).state.southEvents).toEqual({herb:0,orchard:0,claimed:['herb','orchard']});await page.keyboard.press('e');await expect(page.locator('#commission-event-herb')).toHaveCount(0);await expect(page.locator('#commission-event-orchard')).toHaveCount(0);await snap('保存重开保留正式清除与奖励状态，谢礼无法重复领取','reloaded');await page.locator('#close').click();expect(errors).toEqual([]);report.结果='通过';
  }catch(error){report.结果='未通过';report.原因=(error as Error).message;report.失败时状态=await read(page);await page.screenshot({path:root+'/failure.png'});throw error;}finally{saveReport();const video=page.video();await page.close();if(video)await video.saveAs(root+'/gameplay.webm');}
 });
}
