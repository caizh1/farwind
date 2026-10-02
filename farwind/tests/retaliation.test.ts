import {afterEach,beforeEach,describe,expect,it} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {ENCOUNTERS} from '../src/data/maps/windbell/encounters';
import {RETALIATION_ROUTES,harassmentChance,raidUnitProfile} from '../src/data/demonKing';
import {RAID_GATES,RAID_TIMING,GUARD_ARMOR} from '../src/data/defense';
import {validOutdoorPoint} from '../src/data/maps/windbell/bounds';
import {syncMapGeometry} from '../src/data/world';
import {initialState,parseSave,validate,type State} from '../src/game/systems/state';
import {settleEncounterDeath} from '../src/game/systems/encounterState';
import {pendingRetaliations} from '../src/game/systems/demonKingState';
import {mayStartRetaliation,retaliationWarningSnapshot,makeNightPlan,mayStartNight,nightWarningSnapshot} from '../src/game/systems/nightDirector';
import {EastDefense,prepareRaid} from '../src/game/systems/defense';
import {StateCommit} from '../src/game/systems/stateCommit';
import {validateDefense} from '../src/game/systems/defenseState';
const camps=ENCOUNTERS.filter(d=>d.kind==='camp');
const player={x:670,y:720,hp:100};
function clear(s:State,id=camps[0].id){
 const d=camps.find(d=>d.id===id)!,g=s.encounters.groups[id];g.activated=true;
 for(const m of d.members){if(m.boss)g.boss!.stage='battle';settleEncounterDeath(s.encounters,m.id,false);}
}
beforeEach(()=>syncMapGeometry(true));afterEach(()=>syncMapGeometry(false));
describe('据点陷落与魔王报复闭环',()=>{
 it('第一处陷落立刻派出十名一阶镰灵，第二处派出十名更强的二阶镰灵',()=>{
  let s=initialState();clear(s);s=validate(retaliationWarningSnapshot(s));
  const first=structuredClone(s.defense.raid!);
  expect(first.order).toMatchObject({retaliationLevel:1});
  expect(first.members.every(m=>m.type==='leaf'&&m.eliteLevel===1&&m.hp===94)).toBe(true);
  expect(raidUnitProfile('leaf',1).damage).toBe(22);
  clear(s,camps[1].id);expect(s.defense.raid).toEqual(first);
  new EastDefense(s.defense,0).finish();expect(s.defense.cooldownMs).toBeGreaterThan(0);
  if(process.env.FARWIND_RETALIATION_FIXTURE){mkdirSync('.retaliation-local',{recursive:true});
   writeFileSync('.retaliation-local/second-wave-save.json',JSON.stringify({...s,player:{...s.player,x:1920,y:1080},demonKing:{...s.demonKing,introduced:true},说明:'固定验收样本：两处据点已完整清剿，第一波报复已结算，第二波尚未出发。通过正式导入验证新版二阶镰灵，不代表从新游戏实际清剿。'},null,2));}
  expect(mayStartRetaliation(s)).toBe(true);s=validate(retaliationWarningSnapshot(s));
  expect(s.defense.raid!.order).toMatchObject({retaliationLevel:2});
  expect(s.defense.raid!.members.every(m=>m.type==='leaf'&&m.eliteLevel===2&&m.hp===115)).toBe(true);
  expect(raidUnitProfile('leaf',2).damage).toBe(26);
 });
 it('仅完整据点触发，首夜白天和初始冷却均不阻止报复',()=>{
  const s=initialState();expect(mayStartRetaliation(s)).toBe(false);
  const d=camps[0];s.encounters.groups[d.id].activated=true;
  for(const m of d.members.filter(m=>!m.boss))settleEncounterDeath(s.encounters,m.id,false);
  expect(pendingRetaliations(s)).toEqual([]);clear(s);
  expect(s.defense.protectionMs).toBe(RAID_TIMING.protection);expect(mayStartRetaliation(s)).toBe(true);
  if(process.env.FARWIND_RETALIATION_FIXTURE){mkdirSync('.retaliation-local',{recursive:true});
   writeFileSync('.retaliation-local/pending-save.json',JSON.stringify({...s,player:{...s.player,x:900,y:1660},demonKing:{...s.demonKing,introduced:true},说明:'固定验收样本：完整清剿南部据点、尚未派出报复、跳过已观看的初见。通过正式导入界面触发运行世界的报复、边缘行军、保存与重载；不代表从新游戏实际通关。'},null,2));}
  const next=validate(retaliationWarningSnapshot(s));expect(next.defense.raid!.members).toHaveLength(10);
  expect(next.defense.raid!.order).toMatchObject({malice:1,retaliationCamp:d.id});
  expect(pendingRetaliations(next)).toEqual([]);expect(mayStartRetaliation(next)).toBe(false);
  expect(parseSave(JSON.stringify(next)).defense.raid).toEqual(next.defense.raid);
  new EastDefense(next.defense,0).finish();expect(mayStartRetaliation(parseSave(JSON.stringify(next)))).toBe(false);
 });
 it('连续四处清剿严格排队，已有夜袭不被覆盖，每处恰好一波',()=>{
  let s=initialState();s.mapProgress.westRoad='open';s.defense=prepareRaid(s.defense,player,'east-gate');
  for(const d of camps)clear(s,d.id);expect(mayStartRetaliation(s)).toBe(false);
  expect(pendingRetaliations(s)).toHaveLength(4);new EastDefense(s.defense,0).finish();
  for(let i=0;i<4;i++){
   s=validate(retaliationWarningSnapshot(s));expect(s.defense.raid!.sequence).toBe(i+2);
   expect(s.defense.raid!.order!.retaliationCamp).toBe(camps[i].id);
   expect(s.defense.raid!.order!.retaliationLevel).toBe(i+1);
   expect(s.defense.raid!.members.every(m=>m.type==='leaf'&&m.eliteLevel===i+1)).toBe(true);
   const frozen=structuredClone(s.defense.raid);expect(()=>retaliationWarningSnapshot(s)).toThrow();expect(s.defense.raid).toEqual(frozen);
   new EastDefense(s.defense,0).finish();s=parseSave(JSON.stringify(s));
  }
  expect(s.demonKing.retaliatedCamps).toEqual(camps.map(d=>d.id));expect(mayStartRetaliation(s)).toBe(false);
 });
 it('报复不要求三名守卫健康返岗，但仍拒绝全屏可见和过多活体',()=>{
  const s=initialState();clear(s);s.defense.guards.forEach(g=>Object.assign(g,{hp:0,dead:true,mode:'dead'}));
  expect(retaliationWarningSnapshot(s).defense.raid!.members).toHaveLength(10);
  expect(()=>retaliationWarningSnapshot(s,{left:-2200,right:4400,top:-1500,bottom:3500})).toThrow();
  expect(()=>retaliationWarningSnapshot(s,undefined,Array(35).fill(player))).toThrow();
  expect(s.demonKing.retaliatedCamps).toEqual([]);expect(s.defense.sequence).toBe(0);
 });
 it('保存失败不消费据点或序号，旧存档补基线后只有新清剿会触发',async()=>{
  let s=initialState();clear(s);const old=structuredClone(s);
  await expect(new StateCommit().run(()=>s,retaliationWarningSnapshot,async()=>{throw Error('固定保存失败样本');},next=>s=next)).rejects.toThrow();
  expect(s).toEqual(old);delete old.demonKing.retaliatedCamps;
  const migrated=validate(old);expect(pendingRetaliations(migrated)).toEqual([]);clear(migrated,camps[1].id);
  expect(pendingRetaliations(parseSave(JSON.stringify(migrated)))).toEqual([camps[1].id]);
  const legacy=structuredClone(old) as any;legacy.schema_version=12;delete legacy.demonKing;
  expect(pendingRetaliations(validate(legacy))).toEqual([]);
 });
 it('近身打断预警时保留同一波，重新保存后从安全边缘出生',()=>{
  let s=initialState();clear(s);s=retaliationWarningSnapshot(s);const d=new EastDefense(s.defense,0);
  d.update(3000,3000,{...s.defense.raid!.spawns[0],hp:100},{queries:2},{left:-2200,right:4400,top:-1500,bottom:3500});
  expect(s.defense.raid!.phase).toBe('warning');expect(d.enemies).toHaveLength(0);expect(s.defense.sequence).toBe(1);
  const resumed=parseSave(JSON.stringify(s));expect(pendingRetaliations(resumed)).toEqual([]);
  const restored=new EastDefense(resumed.defense,3000);restored.acknowledged(1);restored.update(6000,3000,player,{queries:2});
  expect(restored.enemies).toHaveLength(10);expect(resumed.defense.sequence).toBe(1);
 });
 it('拒绝伪造、重复记录、错误行军进度与伪装成夜袭的报复',()=>{
  const s=initialState();clear(s);const next=retaliationWarningSnapshot(s);
  for(const edit of [(v:State)=>v.demonKing.retaliatedCamps!.push(camps[0].id),(v:State)=>v.demonKing.retaliatedCamps=[],(v:State)=>(v.demonKing as any).retaliatedCamps=null,
   (v:State)=>v.defense.raid!.members[0].marchIndex=99,(v:State)=>v.defense.raid!.order!.retaliationCamp='未知据点',
   (v:State)=>v.defense.raid!.order!.retaliationLevel=0,(v:State)=>v.defense.raid!.order!.retaliationLevel=2,
   (v:State)=>delete v.defense.raid!.order!.retaliationCamp,(v:State)=>v.defense.raid!.members[0].type='slime']){
   const bad=structuredClone(next);edit(bad);expect(()=>validate(bad)).toThrow();
  }
 });
 it.each(['warning','approach'] as const)('旧十只史莱姆的%s存档保持伤亡，后续第二波使用新版精英',phase=>{
  let s=initialState();clear(s);s=retaliationWarningSnapshot(s);const old=s.defense.raid!;
  delete old.order!.retaliationLevel;old.phase=phase;
  old.members.forEach((m,i)=>Object.assign(m,{type:'slime',eliteLevel:0,hp:i===0?13:i===1?0:48}));
  s=parseSave(JSON.stringify(s));expect(s.defense.raid).toEqual(old);
  const d=new EastDefense(s.defense,0);if(phase==='approach')expect(d.enemies.map(e=>[e.type,e.hp,e.maxHP])).toEqual(old.members.map(m=>['slime',m.hp,48]));
  d.finish();clear(s,camps[1].id);s=validate(retaliationWarningSnapshot(s));
  expect(s.defense.raid!.members.every(m=>m.type==='leaf'&&m.eliteLevel===2&&m.hp===115)).toBe(true);
 });
 it.each([1,2])('第%s波的实际攻击伤害与血条、保存恢复共用同一精英配置',level=>{
  let s=initialState();clear(s);s=retaliationWarningSnapshot(s);
  if(level===2){new EastDefense(s.defense,0).finish();clear(s,camps[1].id);s=retaliationWarningSnapshot(s);}
  const d=new EastDefense(s.defense,0);d.update(3000,3000,player,{queries:2});
  const e=d.enemies[0],g=s.defense.guards.find(g=>g.id===`${d.gate().id.split('-')[0]}-watch`)!;
  Object.assign(e,{x:g.x+45,y:g.y});d.enemies.slice(1).forEach(e=>e.hp=0);
  const hp=g.hp;d.update(3020,20,player,{queries:2});expect(e.attack).toBeTruthy();
  expect(e.maxHP).toBe(raidUnitProfile('leaf',level).maxHP);expect(e.attack!.damage).toBe(raidUnitProfile('leaf',level).damage);
  for(let now=3040;now<5200&&g.hp===hp;now+=20)d.update(now,20,player,{queries:2});
  expect(g.hp).toBe(hp-(raidUnitProfile('leaf',level).damage-GUARD_ARMOR[g.armorId]));
  d.sync();const restored=new EastDefense(parseSave(JSON.stringify(s)).defense,d.now);
  expect(restored.enemies[0]).toMatchObject({type:'leaf',hp:e.hp,maxHP:e.maxHP,eliteLevel:level});
  expect(restored.enemies.slice(1).every(e=>e.hp===0)).toBe(true);
 });
});
describe('真实地图边缘行军与后续骚扰',()=>{
 it.each(RAID_GATES.map(g=>g.id))('%s十只边缘出生、行军抵达防线、存档续接与结算',gate=>{
  const s=initialState();s.mapProgress.westRoad='open';const camp=camps.find(d=>`${d.direction}-gate`===gate)!;clear(s,camp.id);
  const next=validate(retaliationWarningSnapshot(s));expect(next.defense.raid!.gateId).toBe(gate);
  const raid=next.defense.raid!,start=RETALIATION_ROUTES[gate][0];
  expect(raid.spawns.every(p=>validOutdoorPoint(p)&&Math.hypot(p.x-start.x,p.y-start.y)<=240)).toBe(true);
  const d=new EastDefense(next.defense,0);d.acknowledged(raid.sequence);d.update(3000,3000,player,{queries:2});
  expect(d.enemies).toHaveLength(10);expect(d.enemies.every(e=>Math.hypot(e.x-start.x,e.y-start.y)<300)).toBe(true);
  const arrived=new Set<string>();let restored=false;
  for(let now=3050;now<=125000&&next.defense.raid;now+=50){
   d.update(now,50,player,{queries:2});
   for(const e of d.enemies)if(Math.hypot(e.x-RAID_GATES.find(g=>g.id===gate)!.x,e.y-RAID_GATES.find(g=>g.id===gate)!.y)<550)arrived.add(e.id);
   if(!restored&&now>=12000){d.sync();const saved=parseSave(JSON.stringify(next));const resume=new EastDefense(saved.defense,now);
    expect(resume.enemies.map(e=>[e.x,e.y,e.hp,e.marchIndex])).toEqual(d.enemies.map(e=>[e.x,e.y,e.hp,e.marchIndex]));restored=true;}
  }
  expect(arrived.size).toBe(10);expect(next.defense.raid).toBeNull();expect(next.defense.completedSequence).toBe(1);expect(validateDefense(next.defense)).toEqual(next.defense);
 },30000);
 it('西路未开放时从其它开放边缘出发，仍不吞掉西部据点报复',()=>{
  syncMapGeometry(false);const s=initialState();clear(s,'west-wolf-den');const next=retaliationWarningSnapshot(s);
  expect(next.defense.raid!.gateId).not.toBe('west-gate');expect(next.defense.raid!.order!.retaliationCamp).toBe('west-wolf-den');
 });
 it('玩家在远处行军路线上拦截时，报复魔物仍会正常反击',()=>{
  const s=initialState();clear(s);const next=retaliationWarningSnapshot(s),d=new EastDefense(next.defense,0);
  d.update(3000,3000,player,{queries:2});const enemy=d.enemies[0];
  const interceptor={x:enemy.x+45,y:enemy.y,hp:100};d.update(3020,20,interceptor,{queries:2});
  expect(enemy.targetId).toBe('player');expect(enemy.attack).toBeTruthy();expect(enemy.attack!.parryable).toBe(true);
 });
 it('恶意0～4的骚扰概率递增，首夜保持安静且每夜只生成一个计划',()=>{
  const states=[initialState()];for(const d of camps){const s=structuredClone(states.at(-1)!);clear(s,d.id);states.push(s);}
  expect(states.map((_,i)=>harassmentChance(i))).toEqual([50,60,70,80,90]);
  const counts=states.map(s=>Array.from({length:1000},(_,i)=>makeNightPlan(s,i+2)).filter(p=>p.outcome==='pending').length);
  for(let i=1;i<counts.length;i++)expect(counts[i]).toBeGreaterThan(counts[i-1]);
  for(const s of states)expect(makeNightPlan(s,1).outcome).toBe('quiet');
 });
 it('总攻结束后正常夜袭仍尊重冷却，并保持原夜间计划',()=>{
  let s=initialState();clear(s);s=retaliationWarningSnapshot(s);const d=new EastDefense(s.defense,0);d.finish();
  s.time=2460;s.night.plan=makeNightPlan(s,2);s.night.plan.outcome='pending';s.time=s.night.plan.at;
  expect(mayStartNight(s)).toBe(false);s.defense.protectionMs=s.defense.cooldownMs=0;expect(mayStartNight(s)).toBe(true);
  const next=validate(nightWarningSnapshot(s));expect(next.defense.raid!.order!.retaliationCamp).toBeUndefined();expect(next.defense.raid!.members.length).toBeGreaterThanOrEqual(6);
 });
});
