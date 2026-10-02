import {describe,it,expect} from "vitest";
import {ENCOUNTERS,ENCOUNTER_UNITS} from "../src/data/maps/windbell/encounters";
import {initialEncounters,validateEncounters,settleEncounterDeath,advanceEncounters,resetEncounter,unitState} from "../src/game/systems/encounterState";
import {regionalThreat,sourceAllowsRaid} from "../src/game/systems/wildThreat";
import {WildernessEncounters} from "../src/game/systems/encounterRuntime";
import {ENEMY_PURSUIT,enemyLeashRadius,enemyNavigation,type EnemyBody} from "../src/game/systems/enemy";
import {motionBlocked,clearMotionLine} from "../src/game/systems/obstacles";
const outsideView={left:0,right:1600,top:0,bottom:1400};
function harness(){const data=initialEncounters(42);delete data.seed;let bodies:EnemyBody[]=[];const busy=new Set<string>();const runtime=new WildernessEncounters({read:()=>data,bodies:()=>bodies,spawn:(d,s)=>{bodies.push({...d,hp:s.hp,x:s.x,y:s.y,homeX:d.x,homeY:d.y,cool:0,windup:0,staggerUntil:0,attackSerial:s.serial,nav:enemyNavigation(),ai:"家园",disabled:false,recovered:false});},release:id=>{bodies=bodies.filter(e=>e.id!==id);},busy:id=>busy.has(id)});return {data,runtime,bodies:()=>bodies,busy};}
describe("首条荒野遭遇与据点闭环",()=>{
 it("固定组与成员身份唯一，出生和巡逻路径不穿越实际地形",()=>{
  expect(new Set(ENCOUNTERS.map(g=>g.id)).size).toBe(ENCOUNTERS.length);expect(new Set(ENCOUNTER_UNITS.map(u=>u.id)).size).toBe(ENCOUNTER_UNITS.length);
  for(const d of ENCOUNTERS)for(const m of d.members){expect(motionBlocked(m.x,m.y),m.id).toBe(false);for(const p of d.patrol){const target={x:m.x+p.x-d.patrol[0].x,y:m.y+p.y-d.patrol[0].y};expect(motionBlocked(target.x,target.y),m.id).toBe(false);expect(clearMotionLine(m,target),m.id).toBe(true);}}
 });
 it("初次出现遵守距离与视野，不反复生成同一身体",()=>{
  const h=harness();h.runtime.update(20,20,{x:900,y:1000},{left:-2110,right:4290,top:-1380,bottom:3420});expect(h.bodies()).toHaveLength(0);
  h.runtime.update(20,40,{x:900,y:1000},outsideView);expect(h.bodies().map(e=>e.id)).toEqual(["wild-reed-slime","wild-reed-spore","wild-margin-slime"]);
  h.runtime.restore({x:900,y:1000});h.runtime.update(20,60,{x:900,y:1000},outsideView);expect(h.bodies()).toHaveLength(3);expect(new Set(h.bodies().map(e=>e.id)).size).toBe(3);expect(validateEncounters(h.data)).toEqual(h.data);
 });
 it("远处休眠保留伤势与身份，交战或在途事件不被卸载",()=>{
  const h=harness(),reed=()=>h.bodies().filter(e=>e.id==='wild-reed-slime');h.runtime.update(20,20,{x:900,y:1000},outsideView);reed()[0].hp=19;h.busy.add("wild-reed-slime");h.runtime.update(20,40,{x:-1800,y:1000},outsideView);expect(reed()).toHaveLength(1);
  h.busy.clear();h.runtime.update(20,60,{x:-1800,y:1000},outsideView);expect(reed()).toHaveLength(0);expect(unitState(h.data,"wild-reed-slime")!.hp).toBe(19);
  h.runtime.restore({x:900,y:1000});expect(reed()).toHaveLength(1);expect(reed()[0].hp).toBe(19);expect(validateEncounters(h.data)).toEqual(h.data);
 });
 it("多条死亡通知只结算一次，卫兵代杀不创建可刷取掉落",()=>{
  const s=initialEncounters();s.groups["south-reed-patrol"].activated=true;
  expect(settleEncounterDeath(s,"wild-reed-slime",false)).toBe(true);expect(settleEncounterDeath(s,"wild-reed-slime",true)).toBe(false);expect(unitState(s,"wild-reed-slime")!.drop).toBe(false);expect(validateEncounters(s)).toEqual(s);
 });
 it("首次清剿不会因冷却或读档重生，长跨度不回放离线时间",()=>{
  const s=initialEncounters(),g=s.groups["south-reed-patrol"];g.activated=true;g.members[0].serial=7;for(const m of ENCOUNTERS.find(d=>d.id==="south-reed-patrol")!.members)settleEncounterDeath(s,m.id,true);
  expect(resetEncounter(s,"south-reed-patrol")).toBe(false);advanceEncounters(s,1e9);expect(s.elapsed).toBe(250);
  for(let i=0;i<2400;i++)advanceEncounters(s,250);
  expect(resetEncounter(s,"south-reed-patrol")).toBe(false);expect(g.members).toHaveLength(2);expect(g.cycle).toBe(0);expect(g.members[0].serial).toBe(7);expect(validateEncounters(s)).toEqual(s);
 });
 it("清剿永久据点减少巡游与南门预算，重复读档不恢复据点",()=>{
  const s=initialEncounters(),camp=ENCOUNTERS.find(d=>d.kind==="camp")!;const before=regionalThreat(s,"south");
  s.groups[camp.id].activated=true;camp.members.forEach(m=>{if(m.boss)s.groups[camp.id].boss!.stage='battle';settleEncounterDeath(s,m.id,true);});const next=validateEncounters(JSON.parse(JSON.stringify(s)));
  expect(regionalThreat(next,"south").pressure).toBeLessThan(before.pressure);expect(regionalThreat(next,"south").renewablePatrols).toBe(0);expect(sourceAllowsRaid(next,"south-gate")).toBe(false);expect(sourceAllowsRaid(next,"east-gate")).toBe(true);
  expect(resetEncounter(next,camp.id)).toBe(false);next.groups["south-reed-patrol"].activated=true;settleEncounterDeath(next,"wild-reed-slime",false);for(let i=0;i<2400;i++)advanceEncounters(next,250);expect(resetEncounter(next,"south-reed-patrol")).toBe(false);
 });
 it("损坏状态拒绝，外部冗余字段不进入长期记录",()=>{
  const s=initialEncounters();s.groups["south-reed-patrol"].members[0].hp=0;expect(()=>validateEncounters(s)).toThrow();
  const clean=initialEncounters(42);(clean as any).unbounded=Array(500).fill("多余记录");expect(validateEncounters(clean)).toEqual(initialEncounters(42));
 });
});

import {initialState,validate,add,count} from "../src/game/systems/state";
import {southQuestSnapshot} from "../src/game/systems/fieldQuest";
import {StateCommit} from "../src/game/systems/stateCommit";
import {makeNightPlan,advanceNight,mayStartNight} from "../src/game/systems/nightDirector";
function clearCamp(s:ReturnType<typeof initialState>){const d=ENCOUNTERS.find(g=>g.kind==="camp")!;s.encounters.groups[d.id].activated=true;for(const u of d.members){if(u.boss)s.encounters.groups[d.id].boss!.stage='battle';settleEncounterDeath(s.encounters,u.id,false);}}
describe("南路委托保存与来源调度",()=>{
 it("药师倒下时公共委托簿仍可接取和完成，一次发放启程补给与奖励",()=>{
  const s=initialState();Object.assign(s.player,{x:560,y:810});const healer=s.life.people.find(p=>p.id==="healer")!.body!;Object.assign(healer,{hp:0,health:"down"});
  const accepted=southQuestSnapshot(s,"accept");expect(count(accepted,"potion")).toBe(2);expect(count(s,"potion")).toBe(0);expect(()=>southQuestSnapshot(accepted,"accept")).toThrow("已领取");
  clearCamp(accepted);add(accepted,"herb",2);const finished=validate(southQuestSnapshot(accepted,"complete"));expect(finished.fieldQuests["south-supply"]).toBe("complete");expect(finished.coins).toBe(s.coins+24);expect(count(finished,"potion")).toBe(4);expect(count(finished,"herb")).toBe(0);expect(finished.life.people.find(p=>p.id==="healer")!.body!.hp).toBe(0);expect(()=>southQuestSnapshot(finished,"complete")).toThrow("已经结算");
 });
 it("满包和存储失败不扣任务材料、不提前结算",async()=>{
  let s=initialState();Object.assign(s.player,{x:560,y:810});s=southQuestSnapshot(s,"accept");clearCamp(s);add(s,"herb",3);
  const before=structuredClone(s);await expect(new StateCommit().run(()=>s,v=>southQuestSnapshot(v,"complete"),async()=>{throw Error("存储失败样本");},v=>s=v)).rejects.toThrow();expect(s).toEqual(before);
  s.bag=Array.from({length:24},(_,i)=>i?{id:"wood" as const,count:20}:{id:"herb" as const,count:3});const full=structuredClone(s);expect(()=>southQuestSnapshot(s,"complete")).toThrow("奖励空间");expect(s).toEqual(full);
 });
 it("已经制定的南门夜计划因来源被清剿而安静，不跳转到其他门补刷",()=>{
  const s=initialState();s.time=2460;s.night.plan=makeNightPlan(s,2);Object.assign(s.night.plan,{gate:"south-gate",outcome:"pending"});s.time=s.night.plan.at;s.defense.protectionMs=s.defense.cooldownMs=0;
  expect(mayStartNight(s)).toBe(true);clearCamp(s);expect(mayStartNight(s)).toBe(false);expect(advanceNight(s,s.time-.1)).toBe(true);expect(s.night.plan.outcome).toBe("quiet");expect(validate(s).night.plan).toEqual(s.night.plan);expect(s.defense.sequence).toBe(0);
 });
});

import {updateEnemy} from "../src/game/systems/enemy";
it("巡逻不取消正常仇恨，脱离活动范围后按原家园返回",()=>{
 const h=harness();h.runtime.update(20,20,{x:900,y:1000},outsideView);const e=h.bodies()[0];e.patrolTarget={x:1170,y:2050};e.leashRadius=260;
 for(let now=20;now<1500;now+=20)updateEnemy(e,{x:900,y:1000},now,20,{queries:2});expect(e.x).toBeGreaterThan(1080);
 const target={x:e.x+140,y:e.y+25};updateEnemy(e,target,1520,20,{queries:2});expect(e.nav.mode).toBe("chase");
 updateEnemy(e,{x:3000,y:3000},1540,20,{queries:2});expect(e.nav.returning).toBe(false);
 updateEnemy(e,{x:3000,y:3000},1540+ENEMY_PURSUIT.lostDelay,ENEMY_PURSUIT.lostDelay,{queries:2});expect(e.nav.returning).toBe(true);
});
it('普通遭遇在扩大范围内保存伤势，仍拒绝范围外及世界外坐标',()=>{
 const s=initialEncounters(),d=ENCOUNTERS.find(d=>d.id==='south-reed-margin')!,g=s.groups[d.id],u=g.members[0];g.activated=true;u.x=-800;u.hp=19;
 expect(validateEncounters(s).groups[d.id].members[0]).toEqual(u);
 u.x=d.members[0].x-enemyLeashRadius({leashRadius:d.radius})-101;expect(()=>validateEncounters(s)).toThrow('荒野遭遇存档');
 u.x=-2200;expect(()=>validateEncounters(s)).toThrow('荒野遭遇存档');
});
it("小宝影响的遭遇单位保留同一份伤势与成员身份，死者不能在读档中复活",()=>{
 const s=initialState(),u=s.encounters.groups["south-reed-patrol"].members[0];s.encounters.groups["south-reed-patrol"].activated=true;u.hp=24;
 s.xiaobao.affected=[{id:"wild-reed-slime",hp:24,x:u.x,y:u.y,control:0,controlGrace:0,controlLimit:0,space:"village"}];
 expect(validate(s).xiaobao.affected).toEqual(s.xiaobao.affected);settleEncounterDeath(s.encounters,"wild-reed-slime",false);expect(()=>validate(s)).toThrow("小宝存档");
 s.xiaobao.affected=[];expect(validate(s).encounters.groups["south-reed-patrol"].members[0].defeated).toBe(true);
});

it("前庭增援以真实清剿触发，预警期间无身体，结束后只生成一次",()=>{
 const h=harness(),front=ENCOUNTERS.find(d=>d.id==='ruins-court-front')!,flank=ENCOUNTERS.find(d=>d.id==='ruins-court-flank')!,g=h.data.groups[flank.id],player={x:3240,y:-350},view={left:2600,right:4200,top:-1200,bottom:300};
 h.runtime.update(20,20,player,view);expect(g.warning).toBeNull();expect(g.activated).toBe(false);
 h.data.groups[front.id].activated=true;for(const m of front.members)settleEncounterDeath(h.data,m.id,false);
 h.runtime.update(20,40,player,view);expect(g.warning).toBe(2500);expect(h.bodies().filter(e=>flank.members.some(m=>m.id===e.id))).toHaveLength(0);
 for(let i=1;i<=9;i++)h.runtime.update(250,40+i*250,player,view);expect(g.activated).toBe(false);
 h.runtime.update(250,2540,player,view);expect(g.activated).toBe(true);expect(g.warning).toBeNull();
 h.runtime.update(20,2560,player,view);expect(h.bodies().filter(e=>flank.members.some(m=>m.id===e.id))).toHaveLength(2);expect(validateEncounters(h.data)).toEqual(h.data);
});
