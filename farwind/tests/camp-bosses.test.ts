import {describe,it,expect} from 'vitest';
import {CAMP_BOSSES,BOSS_RULES,type CampBossKind} from '../src/data/maps/windbell/campBosses';
import {enemyLeashRadius} from '../src/data/enemyPursuit';
import {ENCOUNTERS,ENCOUNTER_UNITS} from '../src/data/maps/windbell/encounters';
import {initialState,validate,parseSave} from '../src/game/systems/state';
import {initialEncounters,settleEncounterDeath,validateEncounters,unitState} from '../src/game/systems/encounterState';
import {WildernessEncounters} from '../src/game/systems/encounterRuntime';
import {enemyNavigation,companionControl,updateEnemy,type EnemyBody} from '../src/game/systems/enemy';
import {initialBossBattle} from '../src/game/systems/campBossState';
import {BossHazards,bossHazardGeometry,bossParts,createBossAttack,captureBossCombat,restoreBossCombat} from '../src/game/systems/campBossCombat';
import {EnemyProjectiles} from '../src/game/systems/enemyProjectiles';
import {geometryTouches,advanceEnemyAttack,sampleEnemyAttack,sporeDirections,sporeOrigin} from '../src/game/systems/enemyAttack';
import {enemyProtection} from '../src/game/systems/enemyTraits';
import {reactToEnemyHit} from '../src/game/systems/enemyReaction';
import {STRIKES} from '../src/game/systems/combat';
import {resolveDamage} from '../src/game/systems/damage';
import {regionalThreat} from '../src/game/systems/wildThreat';
import {demonMalice} from '../src/game/systems/demonKingState';
import {motionBlocked} from '../src/game/systems/obstacles';
import {StateCommit} from '../src/game/systems/stateCommit';
import {EastDefense,prepareRaid} from '../src/game/systems/defense';
import {sourceAllowsRaid} from '../src/game/systems/wildThreat';
import {SPRINT} from '../src/game/systems/sprint';
import {XIAOBAO_ROADS,XIAOBAO_SKILLS} from '../src/data/xiaobaoCombat';
import {syncMapGeometry,solidPropAt} from '../src/data/world';

const kinds=Object.keys(CAMP_BOSSES) as CampBossKind[],view={left:-4000,right:5000,top:-2000,bottom:4000};
function body(kind:CampBossKind):EnemyBody{const d=CAMP_BOSSES[kind],camp=ENCOUNTERS.find(c=>c.id===d.camp)!;return {id:'boss-'+kind,type:d.type,boss:kind,bossAttempt:0,bossBattle:initialBossBattle(0),hp:d.hp,x:camp.x,y:camp.y,homeX:camp.x,homeY:camp.y,leashRadius:camp.radius,cool:0,windup:0,staggerUntil:0,nav:enemyNavigation(),ai:'首领',disabled:false,recovered:false};}
function harness(kind:CampBossKind,occupied:readonly {x:number;y:number}[]=[]){const state=initialState(),data=state.encounters,camp=ENCOUNTERS.find(d=>d.id===CAMP_BOSSES[kind].camp)!,g=data.groups[camp.id],hazards=new BossHazards(),shots=new EnemyProjectiles();let bodies:EnemyBody[]=[],resets=0,entrances=0;const player={x:camp.x+160,y:camp.y};
 const runtime=new WildernessEncounters({read:()=>data,bodies:()=>bodies,occupied:()=>occupied,bossEnter:()=>{entrances++;},spawn:(d,u)=>{const e=body(d.boss??kind);Object.assign(e,{id:d.id,type:d.type,boss:d.boss,x:u.x,y:u.y,hp:u.hp,attackSerial:u.serial,bossAttempt:g.boss!.attempt});if(d.boss)restoreBossCombat(e,g.boss!.combat,0,hazards,shots);bodies.push(e);},release:id=>{bodies=bodies.filter(e=>e.id!==id);},busy:()=>true,bossCapture:(e,now)=>captureBossCombat(e,now,hazards,shots),bossReset:id=>{resets++;hazards.clear(id);shots.shots=shots.shots.filter(s=>s.attack.attackerId!==id);}});
 g.activated=true;for(const m of camp.members.filter(m=>!m.boss))settleEncounterDeath(data,m.id,false);
 return {state,data,camp,g,player,runtime,hazards,shots,bodies:()=>bodies,setBodies:(b:EnemyBody[])=>bodies=b,resets:()=>resets,entrances:()=>entrances};}
function enter(h:ReturnType<typeof harness>){for(let now=20;now<=2500;now+=20)h.runtime.update(20,now,h.player,view);}
function hit(e:EnemyBody,amount:number,now=0){const result=resolveDamage({sourceId:'xiaobao',targetId:e.id,attackId:'样本'+now,amount,sourceType:'companion-element',eventId:null},{id:'xiaobao',hp:640,faction:'village',armor:0},{id:e.id,hp:e.hp,faction:'hostile',armor:0,...enemyProtection(e,{x:e.x+70,y:e.y},now)});e.hp=result.hp;return result;}

describe('四据点首领清除与恢复',()=>{
 it.each(kinds)('%s：退出旧营地小圈六秒仍保持本次挑战和伤势',kind=>{
  const h=harness(kind);enter(h);h.bodies()[0].hp=700;
  const direction=kind==='thorn-crown'?1:-1,far={x:h.camp.x+direction*1000,y:h.camp.y};
  for(let now=2520;now<=8520;now+=20)h.runtime.update(20,now,far,view);
  expect(h.g.boss!.stage).toBe('battle');expect(h.g.boss!.attempt).toBe(0);expect(h.bodies().find(e=>e.boss)!.hp).toBe(700);expect(h.resets()).toBe(0);
 });
 it.each(kinds)('%s：离出生点一千距离的追击伤势可保存恢复',kind=>{
  const h=harness(kind);enter(h);const e=h.bodies()[0];e.hp=700;e.x=h.camp.x+(kind==='thorn-crown'?1:-1)*1000;h.runtime.capture(2520);
  const saved=parseSave(JSON.stringify(h.state));expect(saved.encounters.groups[h.camp.id].members.at(-1)!.x).toBe(e.x);expect(saved.encounters.groups[h.camp.id].members.at(-1)!.hp).toBe(700);
 });
 it.each(kinds)('%s：显形时不能攻击、扣血或控制，结束后保留首招前摇',kind=>{
  const e=body(kind),target={x:e.x+80,y:e.y},hazards=new BossHazards(),shots=new EnemyProjectiles();restoreBossCombat(e,null,1000,hazards,shots);
  const start={x:e.x,y:e.y},end=1000+BOSS_RULES.appearance;
  for(const now of [1000,1400,end-1]){updateEnemy(e,target,now,20);expect(e.attack).toBeFalsy();expect(e.ai).toBe('首领现身');expect({x:e.x,y:e.y}).toEqual(start);expect(hit(e,10000,now).damage).toBe(0);companionControl(e,now,2000);expect(e.staggerUntil).toBe(0);}
  updateEnemy(e,target,end+649,20);expect(e.attack).toBeFalsy();updateEnemy(e,target,end+650,1);expect(e.attack).toBeTruthy();expect(e.attack!.contactAt-e.attack!.startedAt).toBeGreaterThanOrEqual(650);expect(hit(e,22,end+651).damage).toBeGreaterThan(0);
 });
 it('显形时保存重开继续剩余时长；早期第14版存档不补演入场',()=>{
  const h=harness('spore-heart');enter(h);const e=h.bodies()[0];restoreBossCombat(e,null,1000,h.hazards,h.shots);h.runtime.capture(1400);
  const saved=parseSave(JSON.stringify(h.state)).encounters.groups[h.camp.id].boss!.combat!,copy=body('spore-heart');expect(saved.battle.entryUntil).toBe(1000);
  restoreBossCombat(copy,saved,9000,new BossHazards(),new EnemyProjectiles());expect(copy.bossBattle!.entryUntil).toBe(10000);expect(captureBossCombat(copy,9000,new BossHazards(),new EnemyProjectiles())).toEqual(saved);
  const old=structuredClone(h.state);delete (old.encounters.groups[h.camp.id].boss!.combat!.battle as Partial<typeof saved.battle>).entryUntil;
  const migrated=parseSave(JSON.stringify(old)).encounters.groups[h.camp.id].boss!.combat!;expect(migrated.battle.entryUntil).toBe(0);restoreBossCombat(copy,migrated,9000,new BossHazards(),new EnemyProjectiles());expect(copy.bossBattle!.entryUntil).toBe(9000);
 });
 it('入场声音事件仅在新挑战触发，恢复已有实例不重复播放',()=>{
  const h=harness('spore-heart');enter(h);expect(h.entrances()).toBe(1);h.runtime.capture(2500);h.setBodies([]);h.runtime.restore(h.player);expect(h.entrances()).toBe(1);
  h.runtime.update(BOSS_RULES.retreat,2500+BOSS_RULES.retreat,{x:h.camp.x-2100,y:h.camp.y},view);enter(h);expect(h.entrances()).toBe(2);
 });
 it('小宝可沿有界行军路点抵达四处据点，新增路点合法且图连通',()=>{
  const nodes=XIAOBAO_ROADS.nodes;for(const p of nodes.slice(12))expect(motionBlocked(p.x,p.y),`路点 ${p.x},${p.y}`).toBe(false);
  const seen=new Set([0]),queue=[0];for(let n=0;n<queue.length;n++)for(const [a,b] of XIAOBAO_ROADS.links){const next=a===queue[n]?b:b===queue[n]?a:-1;if(next>=0&&!seen.has(next)){seen.add(next);queue.push(next);}}
  for(const kind of kinds){const camp=ENCOUNTERS.find(d=>d.id===CAMP_BOSSES[kind].camp)!;expect(nodes.some((p,i)=>seen.has(i)&&Math.hypot(p.x-camp.x,p.y-camp.y)<60)).toBe(true);}
  for(const [a,b] of XIAOBAO_ROADS.links.filter(([a,b])=>a>=12||b>=12))expect(Math.hypot(nodes[a].x-nodes[b].x,nodes[a].y-nodes[b].y)).toBeLessThan(480);
 });
 it.each(kinds)('%s：杂兵全灭、预警和预算等待均不能提前结算；入场仅一次',kind=>{
  const h=harness(kind),id='boss-'+kind;expect(h.g.boss!.stage).toBe('warning');expect(h.g.cleared).toBe(false);expect(settleEncounterDeath(h.data,id,true)).toBe(false);expect(demonMalice(h.data)).toBe(0);
  for(let now=20;now<2500;now+=20)h.runtime.update(20,now,h.player,view);expect(h.bodies()).toHaveLength(0);
  h.runtime.update(20,2500,h.player,view);expect(h.bodies()).toHaveLength(1);expect(h.g.boss!.stage).toBe('battle');const e=h.bodies()[0];expect(Math.hypot(e.x-h.player.x,e.y-h.player.y)).toBeGreaterThanOrEqual(110);expect(motionBlocked(e.x,e.y)).toBe(false);
  h.runtime.update(20,2520,h.player,view);h.runtime.restore(h.player);expect(h.bodies()).toHaveLength(1);
  e.hp=0;expect(settleEncounterDeath(h.data,id,true)).toBe(true);expect(settleEncounterDeath(h.data,id,true)).toBe(false);expect(h.g.cleared).toBe(true);expect(demonMalice(h.data)).toBe(1);expect(regionalThreat(h.data,h.camp.direction).raidBudget).toBe(0);expect(validateEncounters(h.data)).toEqual(h.data);
 });
 it('活动预算为12，满额时首领继续待入场且不能清除',()=>{
  const h=harness('spore-heart');h.setBodies(ENCOUNTER_UNITS.filter(m=>!m.boss&&!unitState(h.data,m.id)!.defeated).slice(0,12).map(m=>({...body('spore-heart'),boss:undefined,bossBattle:undefined,id:m.id,type:m.type,x:m.x,y:m.y,hp:unitState(h.data,m.id)!.hp,nav:{...enemyNavigation(),mode:'chase' as const}})));
  enter(h);expect(h.g.boss!.stage).toBe('warning');expect(h.g.boss!.warning).toBe(0);expect(h.g.cleared).toBe(false);
  h.setBodies(h.bodies().slice(1));h.runtime.update(20,2520,h.player,view);expect(h.bodies()).toHaveLength(12);expect(h.bodies().filter(e=>e.boss)).toHaveLength(1);
 });
 it('入场避开小宝等其他活体，不能只检查敌人的占地',()=>{
  const camp=ENCOUNTERS.find(d=>d.id===CAMP_BOSSES['spore-heart'].camp)!,companion={x:camp.x,y:camp.y},h=harness('spore-heart',[companion]);enter(h);
  expect(h.bodies()).toHaveLength(1);expect(Math.hypot(h.bodies()[0].x-companion.x,h.bodies()[0].y-companion.y)).toBeGreaterThanOrEqual(60);
 });
 it('重开优先恢复进行中的首领，邻近历史巡游不能占满全部12个槽位',()=>{
  const h=harness('spore-heart');enter(h);h.bodies()[0].hp=770;h.runtime.capture(2500);h.setBodies([]);
  const members=ENCOUNTER_UNITS.filter(m=>!m.boss&&!unitState(h.data,m.id)!.defeated).slice(0,12);
  for(const m of members)h.data.groups[m.group].activated=true;
  h.runtime.restore(h.player);expect(h.bodies().filter(e=>e.boss)).toHaveLength(1);expect(h.bodies().find(e=>e.boss)!.hp).toBe(770);expect(h.bodies().length).toBeLessThanOrEqual(12);
 });
 it.each(kinds)('%s：真正离开战斗大范围八秒或死亡重置；已清杂兵保持死亡',kind=>{
  const h=harness(kind);enter(h);const e=h.bodies()[0];e.hp=300;e.attack=createBossAttack(e,2600,h.player,{...e.bossBattle!,move:0});h.shots.launch(e.attack,e,e.attack.contactAt);
  const away={x:h.camp.x+enemyLeashRadius(e)+1,y:h.camp.y};for(let elapsed=20;elapsed<BOSS_RULES.retreat;elapsed+=20)h.runtime.update(20,2600+elapsed,away,view);expect(h.bodies()).toHaveLength(1);h.runtime.update(20,2600+BOSS_RULES.retreat,away,view);
  expect(h.g.boss!.stage).toBe('warning');expect(h.g.boss!.attempt).toBe(1);expect(h.bodies()).toHaveLength(0);expect(h.shots.shots).toHaveLength(0);expect(h.g.members.at(-1)!.hp).toBe(CAMP_BOSSES[kind].hp);expect(h.g.members.slice(0,-1).every(m=>m.defeated)).toBe(true);
  enter(h);h.runtime.resetBosses();expect(h.g.boss!.attempt).toBe(2);expect(h.resets()).toBe(2);expect(validate(h.state).encounters).toEqual(h.data);
 });
 it('战斗大范围不扩大入场预警；撤离宽限内回来清零计时，暂停存档保留剩余宽限',()=>{
  const h=harness('spore-heart'),far={x:h.camp.x-1000,y:h.camp.y};
  for(let now=20;now<=10000;now+=20)h.runtime.update(20,now,far,view);
  expect(h.bodies()).toHaveLength(0);expect(h.g.boss!.stage).toBe('warning');expect(h.g.boss!.warning).toBe(BOSS_RULES.entry);enter(h);
  const away={x:h.camp.x-2100,y:h.camp.y};h.bodies()[0].hp=700;
  h.runtime.update(6000,8500,away,view);expect(h.g.boss!.away).toBe(6000);expect(parseSave(JSON.stringify(h.state)).encounters.groups[h.camp.id].boss!.away).toBe(6000);
  h.runtime.update(20,8520,far,view);expect(h.g.boss!.away).toBe(0);h.runtime.update(7999,16519,away,view);expect(h.g.boss!.stage).toBe('battle');expect(h.bodies()[0].hp).toBe(700);
  h.runtime.update(1,16520,away,view);expect(h.g.boss!.attempt).toBe(1);h.runtime.update(16000,32520,away,view);expect(h.g.boss!.attempt).toBe(1);expect(h.resets()).toBe(1);
 });
 it('旧13档保留历史清除、奖励、恶意和在途状态；未清档追加首领',()=>{
  const old:any=initialState();old.schema_version=13;old.coins=144;
  for(const d of ENCOUNTERS.filter(d=>d.kind==='camp')){const g=old.encounters.groups[d.id];g.members.pop();delete g.boss;if(d.direction==='south'){g.activated=g.cleared=true;for(const m of g.members)Object.assign(m,{hp:0,defeated:true});}}
  const next=validate(old);expect(next.schema_version).toBe(initialState().schema_version);const south=next.encounters.groups['south-spore-camp'];expect(south.boss!.stage).toBe('legacy');expect(south.members.at(-1)!.defeated).toBe(false);expect(next.encounters.groups['west-wolf-den'].boss!.stage).toBe('guards');expect(next.coins).toBe(144);expect(demonMalice(next.encounters)).toBe(1);expect(validate(next)).toEqual(next);expect(next.defense).toEqual(old.defense);
 });
 it('暂停与存档只移动相对时钟，保留阶段、招序、地面效果和弹丸',()=>{
  const h=harness('spore-heart');enter(h);const e=h.bodies()[0];e.bossBattle!.phase=2;e.bossBattle!.move=0;e.bossBattle!.next=6;e.attack=createBossAttack(e,10000,h.player,e.bossBattle!);h.shots.launch(e.attack,e,10900);
  const saved=captureBossCombat(e,11000,h.hazards,h.shots);h.g.boss!.combat=saved;h.g.members.at(-1)!.hp=e.hp;
  const serialized=parseSave(JSON.stringify(h.state)).encounters.groups[h.camp.id].boss!.combat!,copy=body('spore-heart'),hazards=new BossHazards(),shots=new EnemyProjectiles();restoreBossCombat(copy,serialized,500,hazards,shots);
  expect(copy.bossBattle!.phase).toBe(2);expect(copy.bossBattle!.next).toBe(6);expect(copy.attack!.contactAt).toBe(400);expect(shots.shots).toHaveLength(3);expect(captureBossCombat(copy,500,hazards,shots)).toEqual(saved);
  e.bossBattle!.move=1;e.attack=createBossAttack(e,12000,h.player,e.bossBattle!);h.hazards.launch(e,12000);h.runtime.capture(12100);expect(parseSave(JSON.stringify(h.state)).encounters.groups[h.camp.id].boss!.combat!.hazards).toHaveLength(1);
 });
 it('保存失败不发布清除副本，满包不改变首领死亡事实',async()=>{
  const h=harness('bound-branch');enter(h);h.state.bag=Array(24).fill({id:'wood',count:20});settleEncounterDeath(h.data,'boss-bound-branch',true);const before=structuredClone(h.state);let live=h.state;
  await expect(new StateCommit().run(()=>live,validate,async()=>{throw Error('保存失败样本');},next=>live=next)).rejects.toThrow('保存失败');expect(live).toEqual(before);expect(live.encounters.groups[h.camp.id].cleared).toBe(true);expect(live.encounters.groups[h.camp.id].members.at(-1)!.drop).toBe(true);
 });
 it('首领交战和撤战不暂停在途袭村；正式清除保留原事件且阻止新当地来源',()=>{
  const h=harness('spore-heart');enter(h);h.state.defense=prepareRaid(h.state.defense,{x:670,y:720},'south-gate',1);const defense=new EastDefense(h.state.defense,2500),id=h.state.defense.raid!.id,sequence=h.state.defense.raid!.sequence;
  defense.external=h.bodies();expect(defense.ownsFixed(h.bodies()[0])).toBe(false);
  h.bodies()[0].hp=700;for(let now=2520;now<=2700;now+=20){h.runtime.update(20,now,h.player,view);defense.update(now,20,{...h.player,hp:100},{queries:2});}
  const age=h.state.defense.raid!.ageMs;expect(age).toBeGreaterThan(0);expect(h.g.boss!.stage).toBe('battle');expect(sourceAllowsRaid(h.data,'south-gate')).toBe(true);
  for(let now=2720;now<=2720+BOSS_RULES.retreat;now+=20){h.runtime.update(20,now,{x:670,y:720},view);defense.update(now,20,{x:670,y:720,hp:100},{queries:2});}
  expect(h.g.boss!.stage).toBe('warning');if(h.state.defense.raid){expect(h.state.defense.raid.id).toBe(id);expect(h.state.defense.raid.ageMs).toBeGreaterThan(age);}else expect(h.state.defense.completedSequence).toBe(sequence);enter(h);
  const raid=structuredClone(h.state.defense.raid);settleEncounterDeath(h.data,'boss-spore-heart',true);expect(h.state.defense.raid).toEqual(raid);expect(sourceAllowsRaid(h.data,'south-gate')).toBe(false);expect(demonMalice(h.data)).toBe(1);expect(h.g.members.slice(0,-1).every(m=>m.defeated)).toBe(true);
 });
 it('拒绝损坏的首领阶段、攻击时钟和跨战斗残留',()=>{
  const h=harness('spore-heart');enter(h);const e=h.bodies()[0];e.bossBattle!.move=0;e.attack=createBossAttack(e,100,h.player,e.bossBattle!);h.runtime.capture(200);
  for(const alter of [(s:any)=>s.boss.stage='defeated',(s:any)=>s.boss.combat.attack.contactAt=null,(s:any)=>s.boss.combat.attack.bossAttempt=1,(s:any)=>s.boss.combat.hazards=Array(20).fill({})]){const raw=structuredClone(h.state);alter(raw.encounters.groups[h.camp.id]);expect(()=>validate(raw)).toThrow();}
 });
});

describe('首领攻击、阶段与控制抗性',()=>{
 it.each(kinds)('%s：实际显示对象参与近战后，几何与战斗快照仍是可保存的纯数据',kind=>{
  const e=Object.assign(body(kind),{sprite:{addToDisplayList(){},scene:{update(){}}}}),target={x:e.x+50,y:e.y};e.bossBattle!.move=kind==='spore-heart'?2:kind==='thorn-crown'?1:kind==='crag-tusk'?1:0;e.attack=createBossAttack(e,0,target,e.bossBattle!);
  advanceEnemyAttack(e.attack,e,target,e.attack.contactAt,{blocked:()=>false,clear:()=>true,melee:()=>true});expect(Object.keys(e.attack.geometry!.a).sort()).toEqual(['x','y']);expect(()=>captureBossCombat(e,e.attack.contactAt,new BossHazards(),new EnemyProjectiles())).not.toThrow();
 });
 it.each(kinds)('%s：四技能前摇、独立身份和两阶段连招定义',kind=>{
  const e=body(kind),target={x:e.x+90,y:e.y};const ids=[];
  for(let move=0;move<4;move++){const a=createBossAttack(e,1000,target,{...e.bossBattle!,move});ids.push(a.attackId);expect(a.contactAt-a.startedAt).toBeGreaterThanOrEqual(a.bossArea||a.bossShotAngles?900:650);expect(a.bossSkill).toBe(move);expect(a.damage).toBeGreaterThanOrEqual(22);expect(a.parryable).toBe(!a.bossArea&&!a.bossCocoon);}
  expect(new Set(ids).size).toBe(4);expect(bossParts(kind,0,2)).toBeGreaterThanOrEqual(bossParts(kind,0,1));
 });
 it('扇形、危险圈、扩散环的命中与安全区共用几何',()=>{
  expect(geometryTouches({kind:'sector',a:{x:0,y:0},b:{x:0,y:0},radius:100,direction:{x:1,y:0},halfAngle:.6},{x:80,y:0})).toBe(true);
  expect(geometryTouches({kind:'sector',a:{x:0,y:0},b:{x:0,y:0},radius:100,direction:{x:1,y:0},halfAngle:.6},{x:-80,y:0})).toBe(false);
  expect(geometryTouches({kind:'ring',a:{x:0,y:0},b:{x:0,y:0},radius:100,inner:78},{x:70,y:0})).toBe(false);expect(geometryTouches({kind:'ring',a:{x:0,y:0},b:{x:0,y:0},radius:100,inner:78},{x:90,y:0})).toBe(true);
 });
 it.each(kinds)('%s：每种攻击沿正式命中路径结算，单段和危险区不能重复伤害',kind=>{
  for(let move=0;move<4;move++){
   const e=body(kind),target={x:e.x+80,y:e.y};e.face={x:1,y:0};e.bossBattle!.move=move;e.attack=createBossAttack(e,0,target,e.bossBattle!);const a=e.attack;
   if(a.bossCocoon){expect(enemyProtection(e,target,a.contactAt+1).reduction).toBe(.8);continue;}
   if(a.bossArea){const h=new BossHazards();h.launch(e,0);advanceEnemyAttack(a,e,target,a.lockAt);
    const point=a.bossArea==='circle'?target:{x:e.x+70,y:e.y},at=a.contactAt+(a.bossArea==='ring'?210:1);
    expect(h.update(a.lockAt,at,[e],[{...point,id:'player',previous:point}])).toHaveLength(1);expect(h.update(at,at+20,[e],[{...point,id:'player',previous:point}])).toHaveLength(0);
   }else if(a.bossShotAngles){advanceEnemyAttack(a,e,target,a.contactAt);const shots=new EnemyProjectiles(),d=sporeDirections(a)[0],origin=sporeOrigin(e,d),point={x:origin.x+d.x*60,y:origin.y+d.y*60};shots.launch(a,e,a.contactAt);
    const events=shots.update(a.contactAt+300,point,()=>true);expect(events.length).toBeGreaterThan(0);expect(shots.update(a.contactAt+310,point,()=>true)).toHaveLength(0);
   }else{if(kind==='thorn-crown'&&move===2)target.x=e.x-80;
    expect(advanceEnemyAttack(a,e,target,a.lockAt,{blocked:()=>false,clear:()=>true,melee:()=>true})).toBe(null);
    const event=advanceEnemyAttack(a,e,target,a.activeUntil,{blocked:()=>false,clear:()=>true,melee:()=>true});expect(event).not.toBe(null);expect(event!.attack.parryable).toBe(true);a.cancelled=true;expect(advanceEnemyAttack(a,e,target,a.activeUntil,{blocked:()=>false,clear:()=>true,melee:()=>true})).toBe(null);
   }
  }
 });
 it('多弹齐射身份独立，真实命中可分别结算，锁向后不追踪',()=>{
  const e=body('spore-heart'),a=createBossAttack(e,0,{x:e.x+250,y:e.y},{...e.bossBattle!,move:0}),shots=new EnemyProjectiles();advanceEnemyAttack(a,e,{x:e.x+250,y:e.y},a.lockAt);const direction={...a.direction};advanceEnemyAttack(a,e,{x:e.x,y:e.y+250},a.contactAt);expect(a.direction).toEqual(direction);shots.launch(a,e,a.contactAt);shots.launch(a,e,a.contactAt);expect(shots.shots).toHaveLength(3);expect(new Set(shots.shots.map(s=>s.id)).size).toBe(3);
  const contacts=shots.update(a.contactAt+900,{x:e.x+250,y:e.y},()=>true);expect(contacts).toHaveLength(1);expect(contacts[0].attack.attackId).toContain(':spore:1');
 });
 it('扩散环从危险带出发，预警内圈全程安全，而环带仍真实命中',()=>{
  const e=body('spore-heart'),h=new BossHazards();e.bossBattle!.move=3;e.attack=createBossAttack(e,0,{x:e.x+70,y:e.y},e.bossBattle!);h.launch(e,0);const ring=h.hazards[0],inside={x:e.x+12,y:e.y},band={x:e.x+35,y:e.y};expect(bossHazardGeometry(ring,ring.activeAt-1).inner).toBe(24);
  expect(h.update(0,ring.expires,[e],[{...inside,id:'player',previous:inside},{...band,id:'xiaobao',previous:band}]).map(c=>c.targetId)).toEqual(['xiaobao']);
 });
 it('地面伤害独立去重，小宝控制暂停未释放的危险区',()=>{
  const e=body('spore-heart'),h=new BossHazards(),target={x:e.x+80,y:e.y};e.bossBattle!.move=1;e.attack=createBossAttack(e,0,target,e.bossBattle!);h.launch(e,0);companionControl(e,100,1000);updateEnemy(e,target,300,200);h.update(100,300,[e],[{...target,id:'player',previous:target}]);expect(h.hazards[0].activeAt).toBe(1100);
  expect(h.update(300,1099,[e],[{...target,id:'player',previous:target}])).toHaveLength(0);expect(h.update(1099,1101,[e],[{...target,id:'player',previous:target}])).toHaveLength(1);expect(h.update(1101,1120,[e],[{...target,id:'player',previous:target}])).toHaveLength(0);
  e.bossAttempt=1;h.update(1120,1130,[e],[]);expect(h.hazards).toHaveLength(0);
 });
 it('地面标记锁定后留出步行安全路线，走出危险圈能真实免伤',()=>{
  for(const kind of ['spore-heart','crag-tusk','bound-branch'] as const){
   const e=body(kind),target={x:e.x+70,y:e.y},h=new BossHazards();e.bossBattle!.move=kind==='bound-branch'?2:kind==='crag-tusk'?2:1;e.attack=createBossAttack(e,0,target,e.bossBattle!);
   const a=e.attack;expect(a.contactAt-a.lockAt).toBe(550);h.launch(e,0);advanceEnemyAttack(a,e,target,a.lockAt);
   const safe={x:target.x+SPRINT.walkSpeed*(a.contactAt-a.lockAt-100)/1000,y:target.y};
   expect(h.update(a.lockAt,a.contactAt,[e],[{...safe,id:'player',previous:target}])).toHaveLength(0);
  }
 });
 it('半血门槛不会被小宝单套爆发越过；当前招式结束后转换',()=>{
  const e=body('thorn-crown'),target={x:e.x+60,y:e.y},half=CAMP_BOSSES['thorn-crown'].hp*.5;hit(e,10000);expect(e.hp).toBe(half);e.bossBattle!.move=0;e.attack=createBossAttack(e,0,target,e.bossBattle!);
  updateEnemy(e,target,100,20);expect(e.bossBattle!.phase).toBe(1);updateEnemy(e,target,1500,20);expect(e.bossBattle!.move).toBe(0);updateEnemy(e,target,1700,20);expect(e.bossBattle!.phase).toBe(1);
  e.attack=null;e.bossBattle!.move=-1;e.bossBattle!.nextAt=0;updateEnemy(e,target,2000,0);expect(e.bossBattle!.phase).toBe(2);expect(hit(e,10000,2100).damage).toBe(0);expect(e.hp).toBe(half);
 });
 it('当前小宝技能整套最高伤害小于任一首领半血，不能直接跳过两阶段',()=>{
  const full=Math.max(...Object.values(XIAOBAO_SKILLS).map(s=>s.damage.reduce((n,v)=>n+v,0)));
  for(const kind of kinds)expect(full).toBeLessThan(CAMP_BOSSES[kind].hp*.5);
 });
 it('半血在完整招式结束后立即转换，不多等空档，转换不吞掉大招弱点时间',()=>{
  const e=body('spore-heart'),target={x:e.x+70,y:e.y};e.hp=CAMP_BOSSES['spore-heart'].hp*.5;e.bossBattle!.move=3;e.attack=createBossAttack(e,0,target,e.bossBattle!);const end=e.attack.recoveryUntil;
  updateEnemy(e,target,end-1,1);expect(e.bossBattle!.phase).toBe(1);
  updateEnemy(e,target,end,1);updateEnemy(e,target,end,0);expect(e.bossBattle!.phase).toBe(2);expect(e.bossBattle!.transformUntil).toBe(end+1200);expect(e.bossBattle!.exposedUntil).toBe(end+1200+1500);expect(e.bossBattle!.nextAt).toBe(end+1200+1500);
 });
 it('普通受击不打断首领，小宝控制至多400毫秒并有3秒抗性',()=>{
  const e=body('thorn-crown');e.bossBattle!.move=0;e.attack=createBossAttack(e,0,{x:e.x+100,y:e.y},e.bossBattle!);reactToEnemyHit(e,10,STRIKES[0],{x:1,y:0},false,true);expect(e.staggerUntil).toBe(0);expect(e.attack.cancelled).toBe(false);companionControl(e,100,800);expect(e.staggerUntil).toBe(500);companionControl(e,400,800);expect(e.staggerUntil).toBe(500);companionControl(e,3499,800);expect(e.staggerUntil).toBe(500);companionControl(e,3500,800);expect(e.staggerUntil).toBe(3900);
 });
 it('弹反只截住当前连招段；普通收招保持护体，完整大招提供1.5秒弱点',()=>{
  const e=body('thorn-crown'),target={x:e.x+80,y:e.y};e.bossBattle!.move=0;e.attack=createBossAttack(e,0,target,e.bossBattle!);e.attack.cancelled=true;e.bossBattle!.exposedUntil=1300;e.staggerUntil=1300;
  updateEnemy(e,target,1400,20);expect(e.bossBattle!.move).toBe(0);expect(e.bossBattle!.part).toBe(1);
  const normal=body('spore-heart');normal.bossBattle!.move=2;normal.attack=createBossAttack(normal,0,{x:normal.x+70,y:normal.y},normal.bossBattle!);updateEnemy(normal,{x:normal.x+70,y:normal.y},normal.attack.recoveryUntil,20);expect(normal.bossBattle!.exposedUntil).toBe(0);
  normal.bossBattle!.move=3;normal.attack=createBossAttack(normal,3000,target,normal.bossBattle!);const end=normal.attack.recoveryUntil;updateEnemy(normal,target,end,20);expect(normal.bossBattle!.exposedUntil).toBe(end+1500);
 });
 it('护心茧正面减伤，重击或绕后可靠破茧，基础护体为60%',()=>{
  const e=body('bound-branch'),front={x:e.x+80,y:e.y};expect(enemyProtection(e,front,0).reduction).toBe(.6);e.bossBattle!.move=3;e.attack=createBossAttack(e,0,front,e.bossBattle!);expect(enemyProtection(e,front,1000).reduction).toBe(.8);expect(enemyProtection(e,{x:e.x-80,y:e.y},1000).reduction).toBe(0);expect(e.attack.cancelled).toBe(true);expect(e.bossBattle!.exposedUntil).toBe(2500);
 });
 it('首领冲锋撞真实障碍会失衡，没有精英穿石豁免',()=>{
  const e=body('crag-tusk');e.bossBattle!.move=0;const a=createBossAttack(e,0,{x:e.x+300,y:e.y},e.bossBattle!);a.locked=true;const x=e.x;advanceEnemyAttack(a,e,{x:x+300,y:e.y},a.activeUntil,{blocked:(px)=>px>x+100,clear:(_a,b)=>b.x<=x+100,melee:()=>true,wall:()=>true});expect(a.wallAt).toBeDefined();expect(e.x).toBeLessThanOrEqual(x+100);expect(a.cancelled).toBe(true);
 });
 it('正式石障仍阻挡首领，锁向后横移诱导冲锋会真实撞墙并暴露弱点',()=>{
  syncMapGeometry(false);const e=body('crag-tusk');Object.assign(e,{x:1080,y:-990,homeX:1080,homeY:-990,leashRadius:360});e.bossBattle!.move=0;const target={x:1080,y:-885};e.attack=createBossAttack(e,0,target,e.bossBattle!);const a=e.attack;
  updateEnemy(e,target,a.lockAt,0);expect(a.locked).toBe(true);
  for(let now=a.lockAt+16;now<=a.activeUntil+100&&!e.wallHit;now+=16)updateEnemy(e,{x:1210,y:-885},now,16,{queries:2});
  expect(a.wallAt).toBeDefined();expect(a.cancelled).toBe(true);expect(e.wallHit).toBeDefined();expect(e.bossBattle!.exposedUntil).toBeGreaterThan(a.wallAt!);expect(solidPropAt(1080,-790)).toBe(true);
 });
});
