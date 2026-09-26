import {describe,it,expect} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {initialState,validate,type State} from '../src/game/systems/state';
import {EastDefense,prepareRaid} from '../src/game/systems/defense';
import {GUARD_DEFS,RAID_GATES} from '../src/data/defense';
import {motionBlocked} from '../src/game/systems/obstacles';
const observer={x:930,y:1220,hp:100};
const stable=(s:State)=>[s.player,s.bag,s.hotbar,s.quest,s.killed,s.pendingDrops,s.collected,s.equipment,s.coins,s.economyRevision,s.defense.guards.map(g=>[g.id,g.hp,g.dead])];
describe('M5集成迁移与恢复',()=>{
 it('真实旧结构和地图组合反复序列化不重复平移、不丢物品装备与伤亡',()=>{
  for(const schema of [1,2,3,4])for(const map of [undefined,2,3,4,5,6]){
   const old:any=initialState();old.schema_version=schema;old.map_version=map;old.player.x=2300;
   old.bag[0]={id:'herb',count:7};old.quest=3;old.crafted=true;old.killed=['leaf-1'];old.pendingDrops=[{enemyId:'leaf-1',item:'crystal',x:2320,y:1070}];
   if(schema===1){for(const k of ['coins','equipment','shopStock','economyRevision','defense','skills'])delete old[k];}
   if(schema===2)delete old.defense;
   if(schema===3){old.defense={guards:old.defense.guards.slice(0,3),sequence:0,completedSequence:0,raid:null};Object.assign(old.defense.guards[0],{hp:0,dead:true,mode:'dead'});old.defense.guards[1].hp=73;}
   let next=validate(old);expect(next.player.x).toBe(map===undefined?2900:2300);expect(next.pendingDrops[0].x).toBe(map===undefined?2920:2320);
   expect([next.schema_version,next.map_version]).toEqual([4,6]);expect(next.bag[0]).toEqual(old.bag[0]);
   if(schema===3){expect(next.defense.guards[0].dead).toBe(true);expect(next.defense.guards[1].hp).toBe(73);}
   const first=stable(next);for(let n=0;n<10;n++)next=validate(JSON.parse(JSON.stringify(next)));expect(stable(next)).toEqual(first);
  }
 });
 it('各门活跃阶段恢复不复活成员、不重放飞箭、不改变结算号',()=>{
  for(const gate of RAID_GATES)for(const phase of ['warning','approach','fighting','retreat']as const){
   const s=initialState();s.player={...s.player,...observer};s.defense=prepareRaid(s.defense,s.player,gate.id,4,phase==='warning');
   s.defense.raid!.phase=phase;s.defense.raid!.ageMs=phase==='retreat'?119900:2000;s.defense.raid!.members[0].hp=0;s.defense.raid!.members[1].hp=17;
   const clean=validate(s),d=new EastDefense(clean.defense,1000);expect(d.arrows).toEqual([]);expect(d.state.raid!.members[0].hp).toBe(0);expect(d.state.raid!.members[1].hp).toBe(17);
   d.update(1010,10,observer,{queries:2});expect(d.state.sequence).toBe(1);expect(d.state.completedSequence,`${gate.id} ${phase}`).toBe(phase==='retreat'?1:0);expect(d.state.guards.every(g=>!g.dead)).toBe(true);
   validate({...clean,defense:d.state});
  }
 });
 it('合法历史档的失效位置按正式碰撞修复，死亡和HP不被恢复器覆盖',()=>{
  const s=initialState();s.defense=prepareRaid(s.defense,observer,'north-gate',4);
  const living=s.defense.guards[1];living.x=2100;living.y=1188;living.hp=71;
  Object.assign(s.defense.guards[0],{hp:0,dead:true,mode:'dead',x:2100,y:1188});
  Object.assign(s.defense.raid!.members[0],{x:2030,y:885,hp:23});
  const d=new EastDefense(validate(s).defense,0);const g=d.state.guards[1],e=d.enemies[0];
  expect(motionBlocked(g.x,g.y)).toBe(false);expect(g.hp).toBe(71);expect(Math.hypot(g.x-GUARD_DEFS[1].post.x,g.y-GUARD_DEFS[1].post.y)).toBeLessThan(300);
  expect(motionBlocked(e.x,e.y)).toBe(false);expect(e.hp).toBe(23);expect(d.state.guards[0]).toMatchObject({hp:0,dead:true,mode:'dead'});
 });
 it('三门全灭历史只结算一次；重复恢复保持冷却、任务与固定死亡隔离',()=>{
  for(const gate of RAID_GATES){
   const s=initialState();s.defense=prepareRaid(s.defense,observer,gate.id,4);s.defense.raid!.members.forEach(m=>m.hp=0);
   const d=new EastDefense(s.defense,0);d.update(20,20,observer,{queries:2});expect(d.state.raid).toBeNull();expect(d.state.completedSequence).toBe(1);
   const finished=structuredClone(d.state);for(let n=0;n<5;n++){d.restore(20);expect(d.state).toEqual(finished);expect(d.enemies).toEqual([]);}
   expect(s.killed).toEqual([]);expect(s.pendingDrops).toEqual([]);
  }
 });
 it('生成可复用的正式历史档样本，浏览器只通过导入建立条件',()=>{
  const base=initialState();Object.assign(base.player,observer);const probes=RAID_GATES.map(g=>{const s=structuredClone(base);s.defense=prepareRaid(s.defense,s.player,g.id,4);s.defense.raid!.members[3].type='leaf';s.defense.raid!.members[3].hp=72;Object.assign(s.player,g.inside);return validate(s);});
  const deaths=RAID_GATES.map((g,i)=>{const s=structuredClone(base);s.defense=prepareRaid(s.defense,s.player,g.id,3);s.defense.guards[i*3].hp=1;Object.assign(s.defense.raid!.members[0],{x:GUARD_DEFS[i*3].post.x+8,y:GUARD_DEFS[i*3].post.y+7});return validate(s);});
  mkdirSync('.parry-local/m5',{recursive:true});writeFileSync('.parry-local/m5/fixtures.json',JSON.stringify({说明:'仅建立合法起始档；伤害、死亡、波次与时间由正式运行推进。',base,probes,deaths},null,2));expect(probes).toHaveLength(3);
 });
});
