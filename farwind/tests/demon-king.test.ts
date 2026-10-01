import {beforeEach,afterEach,describe,it,expect} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {DEMON_KING,demonFormation,raidUnitProfile,historicalRaidMember,type RaidOrder} from '../src/data/demonKing';
import {ENCOUNTERS} from '../src/data/maps/windbell/encounters';
import {RAID_GATES,GUARD_ARMOR} from '../src/data/defense';
import {syncMapGeometry} from '../src/data/world';
import {initialState,validate,parseSave,type State} from '../src/game/systems/state';
import {demonMalice,demonKingIntroduction,demonKingSummary} from '../src/game/systems/demonKingState';
import {settleEncounterDeath,resetEncounter} from '../src/game/systems/encounterState';
import {makeNightPlan,nightWarningSnapshot,advanceNight,mayStartNight} from '../src/game/systems/nightDirector';
import {EastDefense,prepareRaid,raidSpawnPoints,spawnLegal} from '../src/game/systems/defense';
import {validateDefense} from '../src/game/systems/defenseState';
import {StateCommit} from '../src/game/systems/stateCommit';
import {initialXiaobao,validateXiaobao} from '../src/game/systems/xiaobaoState';
import {sourceAllowsRaid} from '../src/game/systems/wildThreat';

beforeEach(()=>syncMapGeometry(true));afterEach(()=>syncMapGeometry(false));
const camps=ENCOUNTERS.filter(d=>d.kind==='camp'),player={x:670,y:720,hp:100};
const order=(malice:number):RaidOrder=>({source:'demon-king',malice,profileVersion:1});
function clear(s:State,id=camps[0].id,reward=false){const d=ENCOUNTERS.find(d=>d.id===id)!;s.encounters.groups[id].activated=true;for(const m of d.members){if(m.boss&&!s.encounters.groups[id].cleared)s.encounters.groups[id].boss!.stage='battle';settleEncounterDeath(s.encounters,m.id,reward);}}
function planned(){const s=initialState();clear(s);s.time=2460;s.night.plan=makeNightPlan(s,2);s.night.plan.outcome='pending';s.time=s.night.plan.at;s.defense.protectionMs=s.defense.cooldownMs=0;return s;}
describe('魔王恶意的清剿事实与恢复',()=>{
 it.each([true,false])('末击奖励归属为%s，完整清剿只增加一次且读档不重复',reward=>{
  const s=initialState(),d=camps[0];s.encounters.groups[d.id].activated=true;
  for(const m of d.members.slice(0,-1))settleEncounterDeath(s.encounters,m.id,reward);
  expect(demonMalice(s.encounters)).toBe(0);s.encounters.groups[d.id].boss!.stage='battle';settleEncounterDeath(s.encounters,d.members.at(-1)!.id,reward);
  expect(demonMalice(s.encounters)).toBe(1);expect(settleEncounterDeath(s.encounters,d.members.at(-1)!.id,reward)).toBe(false);
  expect(resetEncounter(s.encounters,d.id)).toBe(false);expect(demonMalice(parseSave(JSON.stringify(s)).encounters)).toBe(1);
  clear(s,camps[1].id);expect(demonMalice(validate(s).encounters)).toBe(2);expect(demonKingSummary(s)).toContain('？？？');
 });
 it('巡游、精英挑战和防御死亡不增加据点恶意',()=>{
  const s=initialState();for(const d of ENCOUNTERS.filter(d=>d.kind!=='camp'))clear(s,d.id);
  s.defense=prepareRaid(s.defense,player,'east-gate');s.defense.raid!.members.forEach(m=>m.hp=0);
  expect(demonMalice(s.encounters)).toBe(0);expect(validate(s).demonKing.introduced).toBe(false);
 });
 it('结构12迁移保留旧在途普通事件、伤亡、清剿和时间',()=>{
  const old:any=planned();old.schema_version=12;delete old.demonKing;old.night.plan=null;
  old.defense=prepareRaid(old.defense,player,'east-gate');old.defense.raid.members[0].hp=13;old.defense.raid.members[1].hp=0;
  Object.assign(old.defense.guards[0],{hp:0,dead:true,mode:'dead'});
  const next=validate(old);expect(next.schema_version).toBe(16);expect(next.defense).toEqual(old.defense);expect(next.time).toBe(old.time);
  expect(demonMalice(next.encounters)).toBe(1);expect(next.demonKing.introduced).toBe(false);expect(validate(next)).toEqual(next);
 });
 it('初见在完整观看后持久化，失败不会消费，不能在零恶意时伪造初见',async()=>{
  let s=planned();const before=structuredClone(s);
  await expect(new StateCommit().run(()=>s,demonKingIntroduction,async()=>{throw Error('保存失败样本');},next=>s=next)).rejects.toThrow();
  expect(s).toEqual(before);s=validate(demonKingIntroduction(s));expect(parseSave(JSON.stringify(s)).demonKing.introduced).toBe(true);expect(()=>demonKingIntroduction(s)).toThrow();
  const zero=initialState();zero.demonKing.introduced=true;expect(()=>validate(zero)).toThrow('初见');
 });
 it('旧九组目录升级只补新槽位，清剿和旧森林伤亡保持，掉落不重复',()=>{
  const old:any=planned();old.schema_version=12;delete old.demonKing;delete old.encounters.broken;
  const ids=['south-reed-patrol','south-herb-patrol','south-spore-camp','south-orchard-burrows','west-track-pack','north-stone-watch','west-wolf-den','north-boar-camp','east-thorn-camp'];
  old.encounters.groups=Object.fromEntries(Object.entries(old.encounters.groups).filter(([id])=>ids.includes(id)));Object.values(old.encounters.groups).forEach((g:any)=>delete g.warning);
  old.killed=['leaf-1'];old.pendingDrops=[{enemyId:'leaf-1',item:'crystal',x:2920,y:1070}];
  const next=validate(old);expect(demonMalice(next.encounters)).toBe(1);expect(Object.keys(next.encounters.groups)).toHaveLength(ENCOUNTERS.length);
  const d=ENCOUNTERS.find(d=>d.members.some(m=>m.id==='leaf-1'))!,i=d.members.findIndex(m=>m.id==='leaf-1');
  expect(next.encounters.groups[d.id].members[i]).toMatchObject({hp:0,defeated:true,drop:false});expect(next.pendingDrops).toEqual(old.pendingDrops);expect(next.killed).toEqual(['leaf-1']);expect(validate(next)).toEqual(next);
  delete old.encounters.groups['south-spore-camp'];expect(()=>validate(old)).toThrow('旧据点');
 });
});
describe('魔王派遣与夜间调度',()=>{
 it('同一随机夜计划在恶意1时精确增加5只，首夜仍然安静',()=>{
  const s=initialState();for(let night=1;night<=30;night++){
   const before=makeNightPlan(s,night),angered=structuredClone(s);clear(angered);const after=makeNightPlan(angered,night);
   expect(after.count).toBe(before.count+5);expect(after.at).toBe(before.at);expect(after.order).toEqual(order(1));if(night===1)expect(after.outcome).toBe('quiet');
  }
 });
 it.each([[0,0,1,3,0,0],[1,1,6,8,0,0],[9,1,6,8,0,0],[10,2,7,9,1,1],[19,2,7,9,1,1],[20,3,8,10,2,2],[30,4,9,10,3,2],[40,5,10,10,4,3],[60,7,10,10,6,4]])('恶意%s对应档位、总量与精英', (malice,tier,min,max,level,elites)=>{
  expect(demonFormation(malice,1)).toEqual({tier,count:min,eliteLevel:level,elites});expect(demonFormation(malice,3).count).toBe(max);
 });
 it('全部当地据点清剿后王令仍可计划，单夜单事件且在途编队冻结',()=>{
  const s=planned();for(const d of camps)clear(s,d.id);expect(RAID_GATES.every(g=>!sourceAllowsRaid(s.encounters,g.id))).toBe(true);
  expect(mayStartNight(s)).toBe(true);expect(advanceNight(s,s.time-.1)).toBe(false);
  const next=validate(nightWarningSnapshot(s));expect(next.defense.raid!.order).toEqual(order(1));expect(next.defense.raid!.members).toHaveLength(s.night.plan!.count);
  expect(mayStartNight(next)).toBe(false);expect(()=>nightWarningSnapshot(next)).toThrow();
  expect(demonMalice(next.encounters)).toBe(camps.length);expect(parseSave(JSON.stringify(next)).defense.raid).toEqual(next.defense.raid);
 });
 it('失败保存不发布预警、不消费序号；预警保存未确认时不出生',async()=>{
  let s=planned();const before=structuredClone(s),commit=new StateCommit();
  await expect(commit.run(()=>s,nightWarningSnapshot,async()=>{throw Error('预警保存失败样本');},next=>s=next)).rejects.toThrow();expect(s).toEqual(before);
  s=nightWarningSnapshot(s);const d=new EastDefense(s.defense,0);d.awaitingCheckpoint=true;d.update(4000,4000,s.player,{queries:2});expect(d.enemies).toHaveLength(0);
  d.acknowledged(s.defense.sequence);d.update(7000,3000,s.player,{queries:2});expect(d.enemies).toHaveLength(s.night.plan!.count);
  expect(d.enemies.every(e=>e.maxHP===48&&e.hp===48)).toBe(true);
 });
 it('安全门禁、路口、人口、视口仍可延期，预警被近身打断不补刷',()=>{
  const s=planned();expect(()=>nightWarningSnapshot(s,{left:-2110,right:4290,top:-1380,bottom:3420})).toThrow();
  expect(()=>nightWarningSnapshot(s,undefined,Array(24).fill(player))).toThrow();s.defense.guards.forEach(g=>g.hp*=.7);expect(()=>nightWarningSnapshot(s)).toThrow();
  const next=nightWarningSnapshot(planned()),d=new EastDefense(next.defense,0);d.update(3000,3000,{...next.defense.raid!.spawns[0],hp:100},{queries:2});
  expect(next.defense.raid).toBeNull();expect(next.defense.completedSequence).toBe(1);expect(d.enemies).toEqual([]);
 });
 it('损坏或伪造来源、档位、编队与超出真实清剿数的存档被拒绝',()=>{
  const next=nightWarningSnapshot(planned());for(const edit of [
   (s:State)=>s.defense.raid!.order!.malice=10,
   (s:State)=>s.night.plan!.order!.malice=2,
   (s:State)=>s.defense.raid!.members[0].eliteLevel=1,
   (s:State)=>s.defense.raid!.members[0].hp=49,
   (s:State)=>s.defense.raid!.spawns[1]={...s.defense.raid!.spawns[0]},
  ]){const bad=structuredClone(next);edit(bad);expect(()=>validate(bad)).toThrow();}
 });
 it('六只事件结束后小宝未消失的技能和命令仍可保存，不导致世界暂停',async()=>{
  let s=nightWarningSnapshot(planned());const target=s.defense.raid!.members.at(-1)!.id;
  s.xiaobao.command={kind:'focus',target,center:{x:1140,y:2060},remaining:1000};
  s.xiaobao.effects=[{id:'xiaobao:1',skill:'blade',age:200,stage:1,released:true,fixedCenter:false,origin:{x:1140,y:2060},center:{x:1140,y:2060},direction:{x:1,y:0},target,task:'free',hit:[],last:{x:1140,y:2060},returnAt:0,travelled:0}];
  expect(validate(s).xiaobao.effects[0].target).toBe(target);
  new EastDefense(s.defense,0).finish();expect(s.defense.raid).toBeNull();let written:State|undefined;
  await new StateCommit().run(()=>s,v=>structuredClone(v),async next=>{written=next;},next=>s=next);
  expect(written!.defense.completedSequence).toBe(1);expect(parseSave(JSON.stringify(s)).xiaobao.effects[0].target).toBe(target);
 });
 it('历史目标只接受十名以内的合法编号；事件清理不扩成无限目标白名单',()=>{
  for(const id of ['raid-1:6','raid-1:10','east-raid-1000000000:10']){
   expect(historicalRaidMember(id)).toBe(true);const x=initialXiaobao();x.command={kind:'focus',target:id,center:{x:1140,y:2060},remaining:1000};expect(validateXiaobao(x,[],[]).command!.target).toBe(id);
  }
  for(const id of ['raid-1:0','raid-1:11','raid-01:6','raid-1000000001:10','raid-1:010']){expect(historicalRaidMember(id)).toBe(false);const x=initialXiaobao();x.command={kind:'focus',target:id,center:{x:1140,y:2060},remaining:1000};expect(()=>validateXiaobao(x,[],[])).toThrow();}
 });
});
describe('真实几何下的编队与精英战斗配置',()=>{
 it.each(RAID_GATES.map(g=>g.id))('%s首档最大八只结算及真实伤亡保持，重开不复活守卫',gate=>{
  const s=prepareRaid(initialState().defense,player,gate,8,false,undefined,[],order(1)),d=new EastDefense(s,0),spawned=d.enemies.slice();
  for(let now=50;now<=125000&&s.raid;now+=50)d.update(now,50,player,{queries:2});
  const guards=s.guards.filter(g=>g.id.startsWith(gate.split('-')[0]));
  mkdirSync('docs/demon-king-design/evidence',{recursive:true});
  writeFileSync(`docs/demon-king-design/evidence/first-tier-${gate}.json`,JSON.stringify({说明:'固定基准：恶意一点，八只普通派遣，十二名健康卫兵，开放道路；按正式防御模拟推进，未加入生活排班或主角助战。',模拟毫秒:d.now,来袭结算号:s.completedSequence,在途事件:s.raid,派遣单位:spawned.map(e=>({身份:e.id,剩余生命:e.hp})),守卫:guards,通知:d.history},null,2));
  expect(s.raid).toBeNull();expect(s.completedSequence).toBe(1);expect(spawned.every(e=>e.hp===0)).toBe(true);
  expect(guards.filter(g=>!g.dead&&g.hp>0).length).toBeGreaterThanOrEqual(2);expect(validateDefense(s)).toEqual(s);
  const restored=new EastDefense(validateDefense(JSON.parse(JSON.stringify(s))),0);expect(restored.state.guards).toEqual(s.guards);expect(restored.enemies).toEqual([]);
 },20000);
 it.each(RAID_GATES.map(g=>g.id))('%s足量10个城外站位与互斥安全间距',gate=>{
  const spawns=raidSpawnPoints(gate,10,player,undefined,[],order(40));expect(spawns).toHaveLength(10);expect(spawnLegal(gate,spawns,player)).toBe(true);
  expect(spawns.every((p,i)=>spawns.slice(0,i).every(q=>Math.hypot(p.x-q.x,p.y-q.y)>=DEMON_KING.spawnGap))).toBe(true);
  const s=prepareRaid(initialState().defense,player,gate,10,false,undefined,[],order(40));expect(validateDefense(s).raid!.members).toHaveLength(10);
  expect(s.raid!.members.filter(m=>m.eliteLevel===4)).toHaveLength(3);expect(s.raid!.members[0].hp).toBe(158);
  expect(raidSpawnPoints(gate,10,player,{left:-2110,right:4290,top:-1380,bottom:3420},[],order(40))).toEqual([]);
 });
 it('精英攻击实际扣卫兵生命，保存重建不补血不复活，前摇与弹反保留',()=>{
  const s=prepareRaid(initialState().defense,player,'east-gate',7,false,undefined,[],order(10)),d=new EastDefense(s,0),elite=d.enemies[0],g=s.guards.find(g=>g.id==='east-watch')!;
  Object.assign(elite,{x:g.x+45,y:g.y,hp:71});d.enemies.slice(1).forEach(e=>e.hp=0);
  d.update(20,20,player,{queries:2});expect(elite.attack).toBeTruthy();expect(elite.attack!.damage).toBe(raidUnitProfile('leaf',1).damage);expect(elite.attack!.parryable).toBe(true);expect(elite.attack!.contactAt).toBeGreaterThan(20);
  const hp=g.hp;for(let now=40;now<1200&&g.hp===hp;now+=20)d.update(now,20,player,{queries:2});
  expect(g.hp).toBe(hp-Math.max(1,raidUnitProfile('leaf',1).damage-GUARD_ARMOR[g.armorId]));
  d.sync();const restored=new EastDefense(validateDefense(JSON.parse(JSON.stringify(s))),0);expect(restored.enemies[0].hp).toBe(elite.hp);expect(restored.enemies[0].maxHP).toBe(94);expect(restored.enemies.slice(1).every(e=>e.hp===0)).toBe(true);
 });
});
