import {describe,it,expect} from 'vitest';
import {ENCOUNTERS,ADVENTURE_ROUTES,adventureIndex,waveMembers,combatRole} from '../src/data/maps/windbell/encounters';
import {RETALIATION_COMPOSITIONS,raidMembers,raidUnitProfile} from '../src/data/demonKing';
import {initialState,parseSave,validate} from '../src/game/systems/state';
import {initialEncounters,activateAdventure,encounterDefinitions,settleEncounterDeath} from '../src/game/systems/encounterState';
import {createTradeRoad,roadDefeat} from '../src/game/systems/tradeRoadState';
import {createEnemyAttack,advanceEnemyAttack,enemyFollowup,projectileProfile,sporeContactAt,predictEnemyContact} from '../src/game/systems/enemyAttack';
import {EnemyProjectiles} from '../src/game/systems/enemyProjectiles';
import {enemyNavigation,type EnemyBody} from '../src/game/systems/enemy';
import {playerAttackPermitted,type AttackPressure} from '../src/game/systems/encounterTempo';
import {reactToEnemyHit} from '../src/game/systems/enemyReaction';
import {SWORD_WIND} from '../src/data/swordWind';
import {NpcLife} from '../src/game/systems/npcLife';
import {encounterState} from './npc-combat-fixtures';
import {tacticalDestination} from '../src/game/systems/enemyTactics';
import {CombatController} from '../src/game/systems/combat';
import {adjudicateContact} from '../src/game/systems/contact';
import {BossHazards,createBossAttack} from '../src/game/systems/campBossCombat';
import {initialBossBattle} from '../src/game/systems/campBossState';
import {validateDefense} from '../src/game/systems/defenseState';
import {EastDefense,prepareRaid} from '../src/game/systems/defense';
import {resolveReleasedDamage} from '../src/game/systems/damage';
import {retaliationWarningSnapshot} from '../src/game/systems/nightDirector';
import {adventureExit,adventureSpawn,exitClearance} from '../src/game/systems/adventureSpawns';
import {validOutdoorPoint} from '../src/data/maps/windbell/bounds';
import {CityDefense} from '../src/game/systems/cityDefense';
import {initialCity} from '../src/game/systems/tradeRoadState';
const p={x:3300,y:1500};
function body(id='怪',type='leaf',tier:0|1|2=2):EnemyBody{return {id,type,...p,hp:400,homeX:p.x,homeY:p.y,cool:0,windup:0,staggerUntil:0,nav:enemyNavigation(),ai:'试验',disabled:false,recovered:false,targetId:'player',combatTier:tier};}
const open={blocked:()=>false,clear:()=>true,melee:()=>true};
describe('普通波次强化专项',()=>{
 it('一百个固定种子：编队、规则快照、身份、逃离通道、击杀和奖励不重抽',()=>{
  for(let seed=0;seed<100;seed++){
   const s=initialState();s.encounters=initialEncounters(seed);
   for(const route of Object.values(ADVENTURE_ROUTES))for(const id of route){
    const d=ENCOUNTERS.find(g=>g.id===id)!;activateAdventure(s.encounters,id);
    const defs=encounterDefinitions(s.encounters,d),g=s.encounters.groups[id];
    for(let wave=0;wave<4;wave++){
     const members=defs.filter(m=>!m.boss&&'wave' in m&&m.wave===wave);if(!members.length)continue;
     expect(members.length).toBeLessThanOrEqual(12);expect(members.every(validOutdoorPoint)).toBe(true);
     expect(members.filter(m=>combatRole(m.type)==='ranged').length).toBeLessThanOrEqual(2);
     expect(members.filter(m=>combatRole(m.type)==='support').length).toBeLessThanOrEqual(1);
     // 原始布点保留逃离开口，未围成贴身封闭圈。
     const hero={x:d.x+60,y:d.y},exit=adventureExit(d,hero),occupied:{x:number;y:number}[]=[];
     for(let slot=0;slot<members.length;slot++){const point=adventureSpawn(d,hero,occupied,slot);if(point){expect(exit).toBeDefined();expect(exitClearance(point,d,exit!)).toBeGreaterThanOrEqual(60);expect(Math.hypot(point.x-hero.x,point.y-hero.y)).toBeGreaterThanOrEqual(220);occupied.push(point);}else if(!exit)expect(point).toBeUndefined();}
    }
    expect(new Set(defs.map(m=>m.id)).size).toBe(defs.length);g.members[0].hp=Math.max(1,g.members[0].hp-7);
    const saved=parseSave(JSON.stringify(s));expect(saved.encounters.groups[id]).toEqual(g);expect(encounterDefinitions(saved.encounters,d)).toEqual(defs);
    const victim=g.members.find(m=>!defs.find(d=>d.id===m.id)?.boss)!;expect(settleEncounterDeath(s.encounters,victim.id,true)).toBe(true);expect(settleEncounterDeath(s.encounters,victim.id,true)).toBe(false);for(const m of g.members){if(defs.find(d=>d.id===m.id)?.boss)g.boss!.stage='battle';if(!m.defeated)settleEncounterDeath(s.encounters,m.id,false);}
   }
   const road=createTradeRoad(1,seed);const first=road.nodes[0].units[0];expect(roadDefeat(road,first.id,true)).not.toBeNull();expect(roadDefeat(road,first.id,true)).toBeNull();
   for(let level=1;level<=4;level++){
    const order={source:'demon-king' as const,malice:level,profileVersion:2 as const,retaliationLevel:level,retaliationCamp:'south-spore-camp'};
    const defs=raidMembers(order,10);expect(defs.map(m=>m.type)).toEqual(RETALIATION_COMPOSITIONS[level-1]);expect(raidUnitProfile('priest',level,2).damage).toBe(0);
    const defense=prepareRaid(s.defense,s.player,'east-gate',10,false,undefined,[],order);const copy=structuredClone(s);copy.defense=defense;copy.demonKing.retaliatedCamps=['south-spore-camp'];
    // 独立校验防务快照，完整世界的恶意来源另由旧回归覆盖。
    expect(validateDefense(defense)).toEqual(defense);expect(defense.raid!.members.map(m=>m.type)).toEqual(defs.map(m=>m.type));expect(defense.raid!.spawns.every(validOutdoorPoint)).toBe(true);
   }
  }
 },60000);
 it('一百个种子：起手错开、在途弹体和持续区保留预算，扇射不重复占槽',()=>{
  for(let seed=0;seed<100;seed++)for(const tier of [1,2] as const){
   const kinds=['leaf','wolf','shade','archer','spore','guardian','boar','geomancer','priest','leaf','wolf','leaf'];
   const peers=kinds.map((type,i)=>body(`${seed}:${i}`,type,tier));const pressure:AttackPressure[]=[];
   for(let now=1000;now<6000;now+=50){
    for(const e of peers){if(e.attack&&now>=e.attack.activeUntil)e.attack=null;if(e.attack||!playerAttackPermitted(e,'player',p,peers,now,undefined,pressure))continue;
     const a=createEnemyAttack(e.id,1,e.type,now,e,p,undefined,undefined,tier);e.attack=a;e.lastAttackStarted=now;
     if(['archer','spore','geomancer'].includes(e.type))for(let j=0;j<3;j++)pressure.push({...p,owner:e.id,type:e.type,group:a.attackId,until:now+2300});
    }
    const groups=new Map(pressure.filter(q=>q.until>now).map(q=>[q.group,combatRole(q.type)]));for(const e of peers)if(e.attack&&e.attack.activeUntil>now)groups.set(e.attack.attackId,combatRole(e.type));
    const roles=[...groups.values()].filter(r=>r!=='support');expect(roles.length).toBeLessThanOrEqual(tier===1?2:3);expect(roles.filter(r=>r==='ranged').length).toBeLessThanOrEqual(1);expect(roles.filter(r=>r==='heavy').length).toBeLessThanOrEqual(1);
   }
  }
 },60000);
 it.each([1,2] as const)('第%s档弹体同一参数快照：锁向、擦边、预测、慢帧与四百射程',tier=>{
  const root={x:0,y:0},target={x:300,y:0},a=createEnemyAttack('射手',1,'archer',0,root,target,undefined,undefined,tier),profile=projectileProfile(a);
  expect(profile.speed).toBe(tier===1?350:400);expect(profile.radius).toBe(tier===1?18:20);expect(profile.speed*profile.life/1000).toBe(400);expect(a.contactAt-a.lockAt).toBeGreaterThanOrEqual(250);
  advanceEnemyAttack(a,root,target,a.lockAt,open);const direction={...a.direction};advanceEnemyAttack(a,root,{x:0,y:300},a.contactAt,open);expect(a.direction).toEqual(direction);
  const shots=new EnemyProjectiles();shots.launch(a,root,a.contactAt);const hit=shots.update(a.contactAt+1000,{x:300,y:profile.radius},()=>true)[0];expect(hit.geometry?.radius).toBe(profile.radius);
  expect(sporeContactAt({x:24,y:0},direction,{x:300,y:profile.radius},a.contactAt,a.contactAt+profile.life,()=>true,profile.speed,profile.radius)).toBeCloseTo(hit.at,5);
  shots.settle(hit.projectileId!,hit.at,false);expect(shots.update(hit.at+500,target,()=>true)).toHaveLength(0);
  const missed=new EnemyProjectiles(),b=createEnemyAttack('射手',1,'archer',0,root,target,undefined,undefined,tier);missed.launch(b,root,b.contactAt);expect(missed.update(b.contactAt+4000,{x:445,y:0},()=>true)).toHaveLength(0);expect(missed.shots[0]?.state).not.toBe('flying');
 });
 it('高速扫掠先撞墙，扩大轮廓包含擦墙；移动目标横穿路径仍命中',()=>{
  const wall=(a:{x:number;y:number},b:{x:number;y:number})=>!(Math.min(a.x,b.x)<=100&&Math.max(a.x,b.x)>=100&&Math.max(a.y,b.y)>=-10&&Math.min(a.y,b.y)<=10);
  const fire=(y=0)=>{const a=createEnemyAttack('孢卫',1,'spore',0,{x:0,y},{x:300,y},undefined,undefined,2),shots=new EnemyProjectiles();shots.launch(a,{x:0,y},a.contactAt);return {a,shots};};
  for(const y of [0,25]){const {a,shots}=fire(y);expect(shots.update(a.contactAt+1000,{x:300,y},wall)).toHaveLength(0);expect(shots.shots[0].state).toBe('burst');}
  const {a,shots}=fire();shots.update(a.contactAt,{x:200,y:-70},()=>true);expect(shots.update(a.contactAt+880,{x:200,y:70},()=>true)).toHaveLength(1);
 });
 it('新版大弹体正常与精准弹反；暂停不推进，不重复结算；首领维持原参数',()=>{
  for(let seed=0;seed<100;seed++)for(const age of [20,100]){const a=createEnemyAttack(`孢卫:${seed}`,seed+1,'spore',seed*17,{x:0,y:0},{x:150,y:0},undefined,undefined,2),shots=new EnemyProjectiles(),hero={x:150,y:0,stamina:100};shots.launch(a,{x:0,y:0},a.contactAt);const before={x:shots.shots[0].x,y:shots.shots[0].y};shots.update(a.contactAt,hero,()=>true);expect({x:shots.shots[0].x,y:shots.shots[0].y}).toEqual(before);
   const center=shots.shots.find(s=>Math.abs(s.attack.direction.y)<1e-7)!,at=sporeContactAt(center,center.attack.direction,hero,a.contactAt,a.contactAt+1000,()=>true,400,20)!,c=new CombatController();c.requestParry(at-age,2);c.flushActions(at-age,hero);const hit=shots.update(at+1,hero,()=>true).find(c=>c.projectileId===center.id)!;expect(adjudicateContact(hit,c,hero,{valid:true,immune:false,clear:()=>true})).toBe(age===20?'perfect':'normal');
  }
  const boss=createEnemyAttack('首领',1,'spore',0,p,p,undefined,undefined,2);boss.boss='spore-heart';expect(projectileProfile(boss)).toMatchObject({speed:250,radius:14,size:20,needleSize:36});
 });
 it('锁向至结束只抗轻击，重击和弹反取消两段镰斩',()=>{
  for(let seed=0;seed<100;seed++){
  const wolf=body(`狼:${seed}`,'wolf'),a=createEnemyAttack(wolf.id,seed+1,wolf.type,1000+seed*17,wolf,{x:p.x+50,y:p.y},undefined,undefined,2);wolf.attack=a;
  reactToEnemyHit(wolf,a.lockAt,SWORD_WIND.strike,{x:1,y:0},false,false);expect(wolf.staggerUntil).toBe(0);expect(wolf.recoil).toBeUndefined();
  reactToEnemyHit(wolf,a.lockAt+1,SWORD_WIND.strike,{x:1,y:0},false,true);expect(a.cancelled).toBe(true);
  const leaf=body(),first=createEnemyAttack(leaf.id,1,'leaf',1000,leaf,p,undefined,undefined,2);leaf.attack=first;first.emitted=true;
  const next=enemyFollowup(leaf,p,first.recoveryUntil,'player',true)!;expect(next.contactAt-next.startedAt).toBe(450);expect(next.contactAt-next.lockAt).toBe(250);
  reactToEnemyHit(leaf,first.activeUntil+1,SWORD_WIND.strike,{x:1,y:0},false,true);expect(enemyFollowup(leaf,p,first.recoveryUntil+1000,'player',true)).toBeNull();
  first.cancelled=true;expect(enemyFollowup(leaf,p,first.recoveryUntil+1000,'player',true)).toBeNull();
  }
 });
 it('术士锁定最后三百五十毫秒，脚下与两侧交替、最多三个区、可打断',()=>{
  const h=new BossHazards(),e=body('术士','geomancer');
  for(const serial of [1,2]){e.attack=createEnemyAttack(e.id,serial,e.type,serial*5000,e,p,undefined,undefined,2);const a=e.attack;expect(a.contactAt-a.startedAt).toBe(1000);expect(a.contactAt-a.lockAt).toBe(350);
   advanceEnemyAttack(a,e,{x:p.x+20,y:p.y},a.lockAt-1,open);advanceEnemyAttack(a,e,{x:p.x+50,y:p.y},a.lockAt,open);const fixed={...a.bossGeometry!.point};advanceEnemyAttack(a,e,{x:p.x+200,y:p.y},a.lockAt+1,open);expect(a.bossGeometry!.point).toEqual(fixed);
   h.launch(e,a.lockAt);expect(h.hazards).toHaveLength(serial===1?1:3);expect(h.hazards.length).toBeLessThanOrEqual(3);
  }
  e.attack!.cancelled=true;h.update(9999,10500,[e],[]);expect(h.hazards.length).toBeLessThanOrEqual(1);
 });
 it('旧二十四版已激活遭遇和在途报复保留伤亡，未激活使用新版且重复读档稳定',()=>{
  const old:any=initialState();old.schema_version=24;for(const g of Object.values(old.encounters.groups) as any[])delete g.rulesVersion;delete old.tradeRoad.rulesVersion;delete old.merchantRoad.nest.rulesVersion;old.encounters.groups['east-road-slimes'].activated=true;old.encounters.groups['east-road-slimes'].members[0].hp=7;
  old.defense=prepareRaid(old.defense,old.player,'east-gate',10,false,undefined,[],{source:'demon-king',malice:1,profileVersion:1,retaliationCamp:'south-spore-camp',retaliationLevel:1});
  const camp=ENCOUNTERS.find(d=>d.id==='south-spore-camp')!;const g=old.encounters.groups[camp.id];g.activated=true;g.cleared=true;g.boss!.stage='defeated';g.members.forEach(m=>Object.assign(m,{hp:0,defeated:true}));old.demonKing.retaliatedCamps=[camp.id];old.defense.raid!.members[0].hp=13;
  const next=parseSave(JSON.stringify(old));expect(next.schema_version).toBe(25);expect(next.defense.raid).toEqual(old.defense.raid);expect(next.encounters.groups['east-road-slimes'].rulesVersion).toBe(1);expect(next.encounters.groups['east-mushroom-watch'].rulesVersion).toBe(2);expect(next.encounters.groups['east-road-slimes'].members).toEqual(old.encounters.groups['east-road-slimes'].members);expect(parseSave(JSON.stringify(next))).toEqual(next);
 });
 it('袭村弹体按事件快照正式伤害守卫，射手死亡仍结算一次；地面攻击覆盖居民',()=>{
  const s=initialState();s.defense=prepareRaid(s.defense,s.player,'east-gate',3,false,undefined,[],{source:'wild',malice:0,profileVersion:2});const d=new EastDefense(s.defense,0),e=body('袭村射手','archer');d.external=[e as any];const g=s.defense.guards[0],hp=g.hp,a=createEnemyAttack(e.id,1,e.type,0,g,g,undefined,undefined,2);a.eventId=s.defense.raid!.id;
  const shots=new EnemyProjectiles();shots.launch(a,g,a.contactAt);const shot=shots.shots[0];e.hp=0;const event={sourceId:e.id,targetId:g.id,attackId:shot.id,amount:shot.released.amount,sourceType:'enemy-shot' as const,eventId:a.eventId};expect(d.damageGuard(event,e,shot.released)).toBe(true);expect(g.hp).toBeLessThan(hp);
  expect(resolveReleasedDamage({...event,eventId:null},shot.released,{id:g.id,hp:g.hp,faction:'village',armor:0}).applied).toBe(false);
 });
 it('普通术士地面与在途袭村弹体对居民正式结算、去重且保留事件身份',()=>{
  const s=encounterState(),d=new EastDefense(s.defense,0),life=new NpcLife(s,d),e=d.enemies[0],n=s.life.people[0],target=n.body!,before=target.hp;
  e.type='spore';e.combatTier=2;const a=createEnemyAttack(e.id,1,e.type,0,e,target,undefined,undefined,2);a.eventId=e.eventId;
  const shots=new EnemyProjectiles();shots.launch(a,e,a.contactAt);const event=shots.update(a.contactAt+500,{x:-10000,y:-10000},()=>true,[{id:n.id,...target}])[0],shot=shots.shots[0];
  e.hp=0;expect(life.receiveHostileContact(n.id,e,event,shot.released)).toBe(true);expect(target.hp).toBeLessThan(before);const hp=target.hp;expect(life.receiveHostileContact(n.id,e,event,shot.released)).toBe(false);expect(target.hp).toBe(hp);
  e.hp=100;e.type='geomancer';e.attack=createEnemyAttack(e.id,3,e.type,2000,e,target,undefined,undefined,2);e.attack.eventId=e.eventId;
  const hazards=new BossHazards();hazards.launch(e,2000);const contact=hazards.update(2990,3001,[e],[{id:n.id,...target,previous:target}])[0];expect(contact).toBeDefined();expect(life.receiveHostileContact(n.id,e,contact)).toBe(true);expect(target.hp).toBeLessThan(hp);expect(contact.attack.eventId).toBe(e.eventId);
 });
 it('普通地面攻击覆盖城市守卫，首领危险区不扩大城市结算范围',()=>{
  const city=initialCity(),engine=new CityDefense(()=>city,()=>{}),guard=city.guards[0];Object.assign(guard,p);const target=engine.targets()[0],e=body('城市术士','geomancer');
  e.attack=createEnemyAttack(e.id,1,e.type,0,e,target,undefined,undefined,2);const hazards=new BossHazards();hazards.launch(e,0);
  const contact=hazards.update(990,1001,[e],[{...target,previous:target,ordinaryOnly:true}])[0];expect(contact).toBeDefined();const hp=guard.hp;engine.receive(contact,e);expect(guard.hp).toBeLessThan(hp);const remaining=guard.hp;engine.receive(contact,e);expect(guard.hp).toBe(remaining);
  const boss=body('城市范围外首领','spore');boss.boss='spore-heart';boss.bossAttempt=0;boss.attack=createEnemyAttack(boss.id,1,'geomancer',2000,boss,target);Object.assign(boss.attack,{boss:boss.boss,bossAttempt:0});const old=new BossHazards();old.launch(boss,2000);expect(old.update(2990,3001,[boss],[{...target,previous:target,ordinaryOnly:true}])).toEqual([]);
  boss.boss='bound-branch';boss.bossBattle=initialBossBattle(0);boss.bossBattle.move=6;boss.attack=createBossAttack(boss,0,target,boss.bossBattle);const laser=new BossHazards();laser.launch(boss,0);expect(laser.update(boss.attack.contactAt-1,boss.attack.contactAt+1,[boss],[{...target,previous:target,ordinaryOnly:true}])).toEqual([]);
 });
 it('慢帧跨过锁向点时按轨迹固定方向，术士已发布的预警仍可被轻击打断',()=>{
  const e=body('术士','geomancer'),a=createEnemyAttack(e.id,1,e.type,0,e,p,undefined,undefined,2);e.attack=a;
  advanceEnemyAttack(a,e,{x:p.x+100,y:p.y+100},900,open);expect(a.bossGeometry!.point.x).toBeCloseTo(p.x+100*650/900);const point={...a.bossGeometry!.point};advanceEnemyAttack(a,e,{x:p.x+300,y:p.y+300},1000,open);expect(a.bossGeometry!.point).toEqual(point);
  const caster=body('预警术士','geomancer');caster.attack=createEnemyAttack(caster.id,1,caster.type,0,caster,p,undefined,undefined,2);const h=new BossHazards();h.launch(caster,0);expect(caster.attack.launched).toBe(true);reactToEnemyHit(caster,300,SWORD_WIND.strike,{x:1,y:0},false,false);expect(caster.attack.cancelled).toBe(true);h.update(300,400,[caster],[]);expect(h.hazards).toHaveLength(0);
 });

 it('同组狼与猎手从相反侧面接近，弩灵换位且射击起手停步',()=>{
  const wolf=body('侧翼甲','wolf'),shade=body('侧翼乙','shade');Object.assign(wolf,{x:p.x+300});Object.assign(shade,{x:p.x-300});
  const peers=[wolf,shade],a=tacticalDestination(wolf,p,peers,0,()=>true),b=tacticalDestination(shade,p,peers,0,()=>true);
  expect(Math.hypot(a.x-p.x,a.y-p.y)).toBeCloseTo(130);expect(a.x+b.x).toBeCloseTo(p.x*2);expect(a.y+b.y).toBeCloseTo(p.y*2);
  const archer=body('弩灵','archer');archer.x+=220;const point=tacticalDestination(archer,p,[archer],0,()=>true);expect(Math.hypot(point.x-archer.x,point.y-archer.y)).toBeCloseTo(80);
  for(const serial of [1,2]){const attack=createEnemyAttack(archer.id,serial,archer.type,0,archer,p,undefined,undefined,2);expect(attack.shotAngles).toHaveLength(serial===1?1:3);const old={x:archer.x,y:archer.y};advanceEnemyAttack(attack,archer,p,attack.activeUntil,open);expect({x:archer.x,y:archer.y}).toEqual(old);}
 });

});
