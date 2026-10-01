import {beforeEach,afterEach} from "vitest";
import {syncMapGeometry} from "../src/data/world";
// 本组防御回归以四门开放后的正式几何为条件；关门准入另在地图测试覆盖。
beforeEach(()=>syncMapGeometry(true));afterEach(()=>syncMapGeometry(false));
import {legacyDefense} from './safety-fixtures';
import {advanceNight,makeNightPlan,mayStartNight,nightWarningSnapshot} from '../src/game/systems/nightDirector';
import {advanceTime,dayNumber} from '../src/game/systems/worldClock';
import {NpcLife} from '../src/game/systems/npcLife';
import {describe,it,expect} from 'vitest';
import {initialDefense,validateDefense} from '../src/game/systems/defenseState';
import {EastDefense,prepareRaid,nextRandom} from '../src/game/systems/defense';
import {GUARD_DEFS,RAID_GATES,RAID_TIMING,DEFENSE_RULES} from '../src/data/defense';
import {zoneFor,inProtected,inActivity,locallyProtected} from '../src/data/defenseZones';
import {enemyNavigation,updateEnemy} from '../src/game/systems/enemy';
import {initialState,validate} from '../src/game/systems/state';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import {props,type Prop} from '../src/data/world';
import {shotLineBlocker} from '../src/game/systems/obstacles';
import {createEnemyAttack} from '../src/game/systems/enemyAttack';
const evidenceRoot=process.env.FARWIND_EVIDENCE_ROOT??resolve('docs/first-map/evidence-m2/defense');
mkdirSync(evidenceRoot,{recursive:true});
const step=(d:EastDefense,ms:number,dt=20)=>{for(let n=0;n<ms;n+=dt){d.update(d.now+dt,dt,player,{queries:2});if(d.critical){validateDefense(d.state);d.acknowledged(d.state.sequence);d.critical=false;}}};
const fixed=(x=2450,y=1060)=>({id:'slime-1',type:'slime',x,y,hp:48,homeX:2450,homeY:1060,cool:0,windup:0,staggerUntil:0,flashUntil:0,nav:enemyNavigation(),ai:'家园',disabled:false,recovered:false});
const player={x:670,y:720,hp:100};
// 调用正式夜间提交入口；只建立可序列化的起始计划，不伪造运行生命或位置。
const permit=(d:EastDefense)=>{const s=initialState();s.defense=d.state;s.time=2460;advanceNight(s,2459);s.night.plan!.outcome='pending';s.time=s.night.plan!.at;const next=nightWarningSnapshot(s,undefined,[],d);Object.assign(d.state,next.defense);};
const defer=(d:EastDefense)=>{expect(()=>permit(d)).toThrow();d.state.retryMs=RAID_TIMING.retry;};
const ready=()=>{const s=initialDefense();s.protectionMs=s.cooldownMs=0;return s;};
describe('安全防御反例与正常对照',()=>{
 it('健康正常的防线允许正式调度预警',()=>{const s=ready(),d=new EastDefense(s,0);permit(d);expect(s.raid?.phase).toBe('warning');});
 it('全员低血不会创建新预警',()=>{const s=ready();s.guards.forEach(g=>g.hp=1);const d=new EastDefense(s,0);defer(d);expect(s.raid).toBeNull();expect(s.retryMs).toBeGreaterThan(0);});
 it('永久全员死亡不会创建新预警或复活',()=>{const s=ready();s.guards.forEach(g=>Object.assign(g,{hp:0,dead:true,mode:'dead'}));const d=new EastDefense(s,0);defer(d);expect(s.raid).toBeNull();expect(validateDefense(s).guards.every(g=>g.dead)).toBe(true);});
 it('真正入侵且在射程内可放箭，移出射程不能新放箭',()=>{const d=new EastDefense(prepareRaid(initialDefense(),player,'east-gate'),0),g=d.state.guards[2],e=d.enemies[0];Object.assign(e,{x:2260,y:1090});d.update(5,5,player,{queries:2});d.fire(g,e,'正常箭');expect(d.arrows).toHaveLength(1);Object.assign(e,{x:2590,y:1090});d.fire(g,e,'越界箭');expect(d.arrows).toHaveLength(1);});
 it('射手死亡取消新射击，已经射出的箭继续有限飞行',()=>{const d=new EastDefense(prepareRaid(initialDefense(),player,'east-gate'),0),g=d.state.guards[2],e=d.enemies[0];Object.assign(e,{x:2260,y:1090});d.update(5,5,player,{queries:2});d.fire(g,e,'在途箭');expect(d.arrows).toHaveLength(1);d.damageGuard({sourceId:'hostile',targetId:g.id,attackId:'致死',amount:1000,sourceType:'enemy-melee',eventId:null},{id:'hostile',hp:10});expect(d.arrows).toHaveLength(1);d.fire(g,e,'死后新箭');expect(d.arrows).toHaveLength(1);d.updateArrows(1000);expect(e.hp).toBe(26);expect(d.arrows).toEqual([]);});
 it('正式新事件可以只有一只弱怪',()=>{const s=prepareRaid(initialDefense(),player,'north-gate',1,true);expect(s.raid?.members).toHaveLength(1);expect(s.raid?.members[0].type).toBe('slime');});
 it('一门缺员可选其他门，三门缺员只延期且序号不变',()=>{const s=ready();Object.assign(s.guards[0],{hp:0,dead:true,mode:'dead'});const d=new EastDefense(s,0);permit(d);expect(s.raid?.gateId).not.toBe('east-gate');expect(s.raid).not.toBeNull();const broken=ready();for(const g of broken.guards.filter(g=>g.id.endsWith('-watch')))Object.assign(g,{hp:0,dead:true,mode:'dead'});const x=new EastDefense(broken,0);defer(x);expect(broken.raid).toBeNull();expect(broken.sequence).toBe(0);expect(broken.retryMs).toBe(RAID_TIMING.retry);});
 it('预警期间真实受伤导致同编号取消；已生成敌人受伤后不被移除',()=>{const s=ready(),d=new EastDefense(s,0);permit(d);const r=s.raid!,g=s.guards.find(g=>g.id.startsWith(r.gateId.split('-')[0]))!;d.damageGuard({sourceId:'hostile',targetId:g.id,attackId:'压低健康',amount:50,sourceType:'enemy-melee',eventId:null},{id:'hostile',hp:48});step(d,3000);expect(s.raid).toBeNull();expect(s.completedSequence).toBe(r.sequence);expect(s.retryMs).toBeGreaterThan(0);expect(d.enemies).toEqual([]);
  const live=new EastDefense(prepareRaid(initialDefense(),player,'east-gate',1),0);live.damageGuard({sourceId:'hostile',targetId:live.state.guards[0].id,attackId:'战中伤害',amount:50,sourceType:'enemy-melee',eventId:null},{id:'hostile',hp:48});step(live,20);expect(live.enemies).toHaveLength(1);
 });
 it('普通家园怪不因近郊漫步被唤醒；静止入侵者由真实防御处理',()=>{const s=initialDefense(),d=new EastDefense(s,0),e=fixed();d.external=[e];const walk={x:2230,y:1080,hp:100};for(let n=20;n<=2000;n+=20){d.update(n,20,walk,{queries:2});if(!d.manages(e))updateEnemy(e,walk,n,20,{queries:2});}expect(e.x).toBe(2450);expect(d.history.filter(h=>h.kind==='shot')).toEqual([]);
  Object.assign(e,{x:2210,y:1080});expect(d.ownsFixed(e)).toBe(true);step(d,12000);writeFileSync(`${evidenceRoot}/fixed-intruder-fixed.json`,JSON.stringify({说明:'失败首因只读现场',外部:e,运行:d.snapshot()},null,2));expect(e.hp).toBeLessThan(48);
 });
 it('外沿横向路过只观察，持续沿入口逼近才形成Threat',()=>{const d=new EastDefense(initialDefense(),0),e=fixed(2420,1110);d.external=[e];for(let n=150;n<=750;n+=150){e.y+=1;d.now=n;d.scanThreats();}expect(d.threats.get(e.id)?.reason).toBe('observe');expect(d.history.filter(h=>h.kind==='shot')).toEqual([]);
  for(let n=900;n<=1500;n+=150){e.x-=8;d.now=n;d.scanThreats();}expect(d.threats.get(e.id)?.approachMs).toBeGreaterThanOrEqual(DEFENSE_RULES.approach);writeFileSync(`${evidenceRoot}/approach-fixed.json`,JSON.stringify({说明:'接近反例只读现场',外部:e,运行:d.snapshot()},null,2));expect(d.threatReason('east-gate',e)).toBe('approach');
 });
 it('单目标外侧拦截时守门人保持内侧；撤离后回岗并有重获滞回',()=>{const d=new EastDefense(prepareRaid(initialDefense(),player,'east-gate',1),0);step(d,2000);const watch=d.state.guards[0];expect(locallyProtected('east-gate',watch)).toBe(true);expect(watch.x).toBeLessThanOrEqual(2100);const patrol=d.state.guards[1];expect(patrol.x).toBeGreaterThan(2100);
  const enemy=d.enemies[0];d.state.raid!.phase='retreat';enemy.x=2530;enemy.y=1150;step(d,1000);expect(d.runtime.get(patrol.id)!.attack).toBeNull();step(d,5000);writeFileSync(`${evidenceRoot}/return-fixed.json`,JSON.stringify({说明:'归岗反例只读现场',运行:d.snapshot()},null,2));expect(Math.hypot(patrol.x-GUARD_DEFS[1].post.x,patrol.y-GUARD_DEFS[1].post.y)).toBeLessThan(90);
 });
 it('未释放攻击在目标退出Threat、射界或射程时取消，不换靶补发',()=>{for(const point of [{x:2590,y:1090},{x:1960,y:1090},{x:2320,y:1260}]){const d=new EastDefense(prepareRaid(initialDefense(),player,'east-gate',1),0),e=d.enemies[0];Object.assign(e,{x:2260,y:1090});d.update(5,5,player,{queries:2});expect(d.runtime.get('east-archer')!.attack).not.toBeNull();Object.assign(e,point);d.update(505,500,player,{queries:2});expect(d.history.filter(h=>h.kind==='shot')).toEqual([]);}});
 it('在途箭命中资格独立于Threat且重载不补箭',()=>{const d=new EastDefense(prepareRaid(initialDefense(),player,'east-gate',1),0),e=d.enemies[0],g=d.state.guards[2];Object.assign(e,{x:2279,y:1090});d.fire(g,e,'释放快照');Object.assign(e,{x:2290,y:1111});expect(d.threatReason('east-gate',e)).toBeNull();d.updateArrows(1000);expect(e.hp).toBe(26);d.updateArrows(1000);expect(e.hp).toBe(26);expect(new EastDefense(validateDefense(d.state),0).arrows).toEqual([]);});
 it('生产初始参数和旧计时反复保存兼容，防御规则保留当前地图与结构版本',()=>{const s=initialState();expect(s.defense.protectionMs).toBe(300000);expect(s.defense.cooldownMs).toBeGreaterThanOrEqual(480000);expect(s.defense.cooldownMs).toBeLessThanOrEqual(900000);s.defense.protectionMs=17000;s.defense.cooldownMs=123456;s.defense.guards[0].hp=80;let next=s;for(let n=0;n<5;n++)next=validate(JSON.parse(JSON.stringify(next)));expect([next.schema_version,next.map_version,next.defense.protectionMs,next.defense.cooldownMs,next.defense.guards[0].hp]).toEqual([16,8,17000,123456,80]);for(const gate of RAID_GATES){expect(inProtected(gate.spawns[0])).toBe(false);expect(inActivity(gate.id,zoneFor(gate.id).intercept)).toBe(true);}});
 it('每个岗位精确80%边界、恢复状态、失效位置和缺员都走共用准入',()=>{for(const gate of RAID_GATES){const s=ready(),d=new EastDefense(s,0),defs=GUARD_DEFS.filter(g=>g.id.startsWith(gate.id.split('-')[0]));expect(d.canScheduleAtGate(gate.id,player,gate.spawns.slice(0,1))).toBe(true);for(const def of defs){const g=s.guards.find(g=>g.id===def.id)!;g.hp=def.maxHP*.8;expect(d.canScheduleAtGate(gate.id,player,gate.spawns.slice(0,1))).toBe(true);g.hp-=.01;expect(d.canScheduleAtGate(gate.id,player,gate.spawns.slice(0,1))).toBe(false);g.hp=def.maxHP;g.mode='recover';expect(d.canScheduleAtGate(gate.id,player,gate.spawns.slice(0,1))).toBe(false);g.mode='post';const x=g.x;g.x=3500;expect(d.canScheduleAtGate(gate.id,player,gate.spawns.slice(0,1))).toBe(false);g.x=x;}}});
 it('预警期间真实死亡保持死亡和结算号，序列化后不会补刷同一事件',()=>{const s=ready(),d=new EastDefense(s,0);permit(d);const raid=s.raid!,g=s.guards.find(g=>g.id.startsWith(raid.gateId.split('-')[0]))!;d.damageGuard({sourceId:'hostile',targetId:g.id,attackId:'预警致死',amount:1000,sourceType:'enemy-melee',eventId:null},{id:'hostile',hp:48});step(d,3000);expect(s.raid).toBeNull();expect(s.completedSequence).toBe(raid.sequence);const restored=new EastDefense(validateDefense(JSON.parse(JSON.stringify(s))),0);step(restored,100);expect(restored.state.sequence).toBe(raid.sequence);expect(restored.state.guards.find(x=>x.id===g.id)?.dead).toBe(true);});
 it('拉弓之后出现高墙，释放取消；已放箭墙和单位按实际顺序处理',()=>{const wall:Prop={id:'controlled-wall',art:'house',x:2200,y:910,w:20,h:30,solid:[20,30],cover:'high'};
  const d=new EastDefense(prepareRaid(initialDefense(),player,'east-gate',1),0),e=d.enemies[0],g=d.state.guards[2];Object.assign(e,{x:2280,y:1090});d.update(5,5,player,{queries:2});expect(d.runtime.get(g.id)!.attack).not.toBeNull();props.push(wall);try{d.update(505,500,player,{queries:2});expect(d.history.filter(h=>h.kind==='shot')).toEqual([]);}finally{props.splice(props.indexOf(wall),1);}
  for(const before of [true,false]){const x=new EastDefense(prepareRaid(initialDefense(),player,'east-gate',1),0),victim=x.enemies[0],archer=x.state.guards[2];Object.assign(victim,{x:2280,y:1090});x.fire(archer,victim,'墙序');const obstacle={...wall,x:before?2200:2310,y:before?910:1140};props.push(obstacle);try{x.updateArrows(1600);expect(victim.hp).toBe(before?48:26);expect(x.arrows).toEqual([]);}finally{props.splice(props.indexOf(obstacle),1);}}
 });
 it('同一外侧目标归岗滞回，重新侵入保护区立即解除抑制',()=>{const d=new EastDefense(prepareRaid(initialDefense(),player,'east-gate',1),0),e=d.enemies[0],g=d.state.guards[1],r=d.runtime.get(g.id)!;Object.assign(e,{x:2370,y:1090});d.threats.set(e.id,{id:e.id,gateId:'east-gate',reason:'approach',lastSeen:0,lastProgress:0,progress:300,approachMs:600,assigned:[]});r.targetId=e.id;d.returnGuard(g);d.update(20,20,player,{queries:2});expect(r.targetId).toBeNull();Object.assign(e,{x:2230,y:1080});d.update(40,20,player,{queries:2});expect(r.targetId).toBe(e.id);});
 it('近战释放时目标已撤出交战区，取消未释放动作；远方玩家战斗不触发出击',()=>{const d=new EastDefense(initialDefense(),0),e=fixed(2200,1080);d.external=[e];const g=d.state.guards[1];Object.assign(g,{x:2190,y:1100});d.update(5,5,player,{queries:2});expect(d.runtime.get(g.id)!.attack).not.toBeNull();Object.assign(e,{x:2500,y:1350});d.update(505,500,player,{queries:2});expect(e.hp).toBe(48);
  const remote=fixed(2600,1110);remote.attack=createEnemyAttack(remote.id,1,'slime',0,remote,{x:2650,y:1110});remote.targetId='player';const x=new EastDefense(initialDefense(),0);x.external=[remote];x.update(20,20,{x:2650,y:1110,hp:100},{queries:2});expect(x.manages(remote)).toBe(false);expect(x.state.guards.every(g=>['post','patrol'].includes(g.mode))).toBe(true);
 });
});

it('居民轮休、正式夜间许可与健康准入共同调度40场，四门各10场，无手工补血',()=>{
 const s=initialState(),before=structuredClone(s),d=new EastDefense(s.defense,0),life=new NpcLife(s,d),records:any[]=[];
 s.mapProgress.westRoad='open';
 const seeds:any[]=[];let chosenNight=0;
 const seedFor=(night:number,gate:number,count:number)=>{for(let seed=1;seed<200000;seed++){const trial={...s,defense:{...s.defense,seed}},p=makeNightPlan(trial,night);if(p.outcome==='pending'&&p.gate===RAID_GATES[gate].id&&p.count===count)return seed;}throw Error('未找到确定随机序列');};
 let minimum:Record<string,number>={},distance:Record<string,number>={};
 const advance=(dt:number)=>{
  const previous=s.time,next=advanceTime(previous,dt),night=dayNumber(next);
  if(night>1&&Math.floor((previous-1020)/1440)<Math.floor((next-1020)/1440)&&night>chosenNight){
   const gate=records.length%RAID_GATES.length,count=1+Math.floor(records.length/RAID_GATES.length)%3,seed=seedFor(night,gate,count);s.defense.seed=seed;chosenNight=night;seeds.push({夜次:night,种子:seed,目标门:RAID_GATES[gate].id,数量:count});
  }
  s.time=next;advanceNight(s,previous);const budget={queries:2};
  d.update(d.now+dt,dt,player,budget);life.step(dt,budget);life.consumeDefense(d.drainNotices());
  for(const g of s.defense.guards){minimum[g.id]=Math.min(minimum[g.id]??g.hp,g.hp);const def=GUARD_DEFS.find(x=>x.id===g.id)!;if(!g.offDuty)distance[g.id]=Math.max(distance[g.id]??0,Math.hypot(g.x-def.post.x,g.y-def.post.y));}
  if(d.critical){validate(s);d.acknowledged(s.defense.sequence);d.critical=false;}
  if(mayStartNight(s)){try{const n=nightWarningSnapshot(s,undefined,[],d);validate(n);Object.assign(s,n);d.rebind(s.defense);life.rebind(s,d);}catch(e){s.defense.retryMs=RAID_TIMING.retry;}}
 };
 for(let n=0;n<40;n++){
  minimum={};distance={};const waitStart=d.now;
  while(!s.defense.raid&&d.now-waitStart<4800000)advance(1000);
  expect(s.defense.raid,`第${n+1}场夜间调度可达`).not.toBeNull();const event=structuredClone(s.defense.raid!),start=d.now;
  expect(event.gateId).toBe(RAID_GATES[n%RAID_GATES.length].id);expect(event.members).toHaveLength(1+Math.floor(n/RAID_GATES.length)%3);expect(event.members.every(e=>e.type==='slime')).toBe(true);
  const admission=s.defense.guards.map(g=>({id:g.id,hp:g.hp,离岗:!!g.offDuty,空间:g.space??'village'}));
  for(const def of GUARD_DEFS.filter(g=>g.id.startsWith(event.gateId.split('-')[0])))expect(admission.find(g=>g.id===def.id)!.hp).toBeGreaterThanOrEqual(def.maxHP*.8);
  while(s.defense.raid&&d.now-start<130000)advance(20);
  expect(s.defense.raid,`第${n+1}场正常结束`).toBeNull();expect(s.defense.guards.every(g=>!g.dead)).toBe(true);
  for(const def of GUARD_DEFS)expect(distance[def.id]??0,def.id).toBeLessThanOrEqual(def.leash+.001);
  records.push({场次:n+1,事件序号:event.sequence,夜次:s.night.plan!.night,门:event.gateId,数量:event.members.length,等待毫秒:start-waitStart,预警与击退毫秒:d.now-start,准入生命:admission,最低生命:minimum,最大在岗离岗距离:distance,结束生命:s.defense.guards.map(g=>({id:g.id,hp:g.hp,模式:g.mode})),后续冷却:s.defense.cooldownMs});
  writeFileSync(`${evidenceRoot}/forty-progress.json`,JSON.stringify({说明:'合并源码正式夜间调度进行中，尚非最终结论。',记录:records},null,2));
 }
 expect([s.quest,s.killed,s.coins,s.bag,s.pendingDrops]).toEqual([before.quest,before.killed,before.coins,before.bag,before.pendingDrops]);validate(s);
 writeFileSync(`${evidenceRoot}/forty-events.json`,JSON.stringify({说明:'正式advanceNight、mayStartNight、nightWarningSnapshot、canScheduleAtGate、预警二次检查与居民生活共同运行。黄昏使用记录的确定随机序列；不调用prepareRaid直接准备40场，不补血。等待1000毫秒，战斗20毫秒；模拟关键提交仅在validate成功后确认。轮休步行不算交战离岗，战斗每步仍受固定岗位和活动域约束。非数小时实等及性能测量。',有效模拟总毫秒:d.now,门别分布:{东门:10,北门:10,南门:10,西门:10},数量分布:{一只:16,两只:12,三只:12},随机序列:seeds,记录:records},null,2));
},600000);

it('内侧静止入侵者直接协防，不要求守门人先到域外拦截点',()=>{const d=new EastDefense(initialDefense(),0),e=fixed(1920,1060);d.external=[e];step(d,12000);expect(e.hp).toBe(0);expect(d.state.guards[0].x).toBeLessThanOrEqual(2100);});

it('低血按正式脱战回血恢复准入，永久缺员保持延期，室内轮休者必须返岗',()=>{
 for(const missing of [false,true]){const s=ready();s.guards.forEach(g=>g.hp=1);if(missing)s.guards.filter(g=>g.id.endsWith('-archer')).forEach(g=>Object.assign(g,{hp:0,dead:true,mode:'dead'}));const d=new EastDefense(s,0);defer(d);step(d,190000,1000);
  if(missing){expect(()=>permit(d)).toThrow();expect(s.guards.filter(g=>g.id.endsWith('-archer')).every(g=>g.dead&&g.hp===0)).toBe(true);}
  else{permit(d);expect(s.raid?.phase).toBe('warning');const gate=s.raid!.gateId;for(const def of GUARD_DEFS.filter(g=>g.id.startsWith(gate.split('-')[0])))expect(s.guards.find(g=>g.id===def.id)!.hp).toBeGreaterThanOrEqual(def.maxHP*.8);}
 }
 const s=ready(),d=new EastDefense(s,0),g=s.guards[2];g.offDuty=true;g.mode='life';g.space='barracks';expect(d.canScheduleAtGate('east-gate',player,RAID_GATES[0].spawns.slice(0,1))).toBe(false);
});

it('固定怪准备攻击近郊玩家立即识别，交还野怪AI不转嫁旧守卫攻击',()=>{const d=new EastDefense(initialDefense(),0),e=fixed(2287,1080),near={x:2275,y:1080,hp:100};d.external=[e];updateEnemy(e,near,20,20,{queries:2});expect(e.targetId).toBe('player');d.update(40,20,near,{queries:2});expect(d.threatReason('east-gate',e)).toBe('attack');
 e.targetId='east-patrol';e.attack=createEnemyAttack(e.id,2,'slime',40,e,d.state.guards[1]);updateEnemy(e,{x:2650,y:1110},60,20,{queries:2});expect(e.attack).toBeNull();
});

it('历史已出生四怪的夜间存档保持四人，未出生旧计划采用新上限且版本不降级',()=>{
 const s=initialState();s.time=2460;advanceNight(s,2459);s.night.plan!.outcome='pending';s.night.plan!.count=4;s.time=s.night.plan!.at;s.defense.protectionMs=s.defense.cooldownMs=0;
 const next=nightWarningSnapshot(s);expect(next.defense.raid!.members).toHaveLength(3);expect(next.night.plan!.count).toBe(3);validate(next);
 const old=legacyDefense(s.defense,'east-gate');s.defense=old;Object.assign(s.night.plan!,{gate:'east-gate',count:4,outcome:'started',raidSequence:old.sequence});expect(validate(s).defense.raid!.members).toHaveLength(4);expect(validate(s).schema_version).toBe(16);
});
