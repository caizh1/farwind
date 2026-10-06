import {it,expect,vi} from 'vitest';
import {initialState,parseSave} from '../src/game/systems/state';
import {startWindMemory,endWindMemory,windMemoryTracked} from '../src/game/systems/windMemory';
import {ADVENTURE_ROUTES,ENCOUNTERS} from '../src/data/maps/windbell/encounters';
import {interact} from '../src/game/systems/interactions';
import {props} from '../src/data/world';
import {readFileSync} from 'node:fs';

it('四方向风忆指向第一场，逐场结算后推进；驻守已清时仍指向首领',()=>{
 const saved=parseSave(readFileSync('docs/combat-v2/evidence/four-camps-exported-save.json','utf8'));
 for(const [direction,route] of Object.entries(ADVENTURE_ROUTES)){
  const camp=ENCOUNTERS.find(d=>d.id===route[4])!;
  const state=startWindMemory({...saved,player:{...saved.player,x:camp.x,y:camp.y}},camp.direction,123);
  const active=state.windMemory.active!;
  for(const id of route){
   expect(windMemoryTracked(state)?.point.id).toBe(id);
   active.encounters.groups[id].rewarded=true;
  }
  expect(windMemoryTracked(state)?.point.id).toBe(camp.id);
  active.finished=true;expect(windMemoryTracked(state)).toBeNull();
  expect(windMemoryTracked(endWindMemory(state))).toBeNull();
  expect(state.encounters).toEqual(saved.encounters);
  expect(direction).toBe(camp.direction);
 }
 expect(windMemoryTracked(initialState())).toBeNull();
});

it('四处已清巢穴的实际交互打开风忆；未清巢穴保留战斗说明',()=>{
 for(const camp of ENCOUNTERS.filter(d=>d.kind==='camp')){
  const prop=props.find(p=>p.id===(camp.direction==='south'?'south-camp-root':`camp-root-${camp.id}`))!;
  const state=initialState(),open=vi.fn(),dialog=vi.fn();
  const world={state,ui:{open,dialog}} as unknown as ThisParameterType<typeof interact>;
  interact.call(world,prop);expect(open).not.toHaveBeenCalled();expect(dialog).toHaveBeenCalledOnce();
  state.encounters.groups[camp.id].cleared=true;dialog.mockClear();
  interact.call(world,prop);expect(open).toHaveBeenCalledWith('wind-memory');expect(dialog).not.toHaveBeenCalled();
 }
});

import {memoryStrength,memoryCoins,validateWindMemory} from '../src/game/systems/windMemory';
import {memoryHealth} from '../src/data/windMemoryDifficulty';
import {initialEncounters,activateAdventure,encounterDefinitions,settleEncounterDeath,unitState,validateEncounters} from '../src/game/systems/encounterState';
import {waveMembers,encounterUnit} from '../src/data/maps/windbell/encounters';
import {creatureMaxHP} from '../src/data/maps/windbell/elites';
import {StateCommit} from '../src/game/systems/stateCommit';
import {WildernessEncounters} from '../src/game/systems/encounterRuntime';
import {createEnemyAttack,creatureCooldown,enemyFollowup} from '../src/game/systems/enemyAttack';
import {enemyNavigation,updateEnemy,navigationBudget,type EnemyBody} from '../src/game/systems/enemy';
import {initialBossBattle} from '../src/game/systems/campBossState';
import {createBossAttack,bossParts,bossMajor,BossHazards,captureBossCombat,restoreBossCombat,updateCampBoss} from '../src/game/systems/campBossCombat';
import {CAMP_BOSSES,type CampBossKind} from '../src/data/maps/windbell/campBosses';
import {enemyProtection} from '../src/game/systems/enemyTraits';
import {takeFungalBlast,fungalBlastContact,validFungalBlastContact,FUNGAL} from '../src/game/systems/fungalCombat';
import {EnemyProjectiles} from '../src/game/systems/enemyProjectiles';
import {advanceEastLocomotion} from '../src/game/systems/eastBossLocomotion';

const cleared=()=>parseSave(readFileSync('docs/combat-v2/evidence/four-camps-exported-save.json','utf8'));
function started(n=1,direction:keyof typeof ADVENTURE_ROUTES='north'){
 let state=cleared();const camp=ENCOUNTERS.find(d=>d.id===ADVENTURE_ROUTES[direction][4])!;Object.assign(state.player,{x:camp.x,y:camp.y});
 for(let i=0;i<n;i++){state=startWindMemory(state,direction,1234);if(i+1<n)state=endWindMemory(state);}
 return state;
}
function body(type:string,x:number,y:number,level?:number,elite?:EnemyBody['elite']):EnemyBody{
 const difficulty=level?{version:1 as const,level}:undefined;
 return {id:'测试怪物',type,x,y,homeX:x,homeY:y,hp:creatureMaxHP(type,elite,undefined,difficulty),maxHP:creatureMaxHP(type,elite,undefined,difficulty),memoryDifficulty:difficulty,elite,cool:0,windup:0,staggerUntil:0,nav:enemyNavigation(),ai:'家园',disabled:false,recovered:false};
}
it.each([1,2,5,10,20])('第%d档的实际阵容、生命、攻击伤害与时钟可保存，首次事实保持不变',n=>{
 const state=started(n),saved=cleared(),active=state.windMemory.active!,difficulty=active.encounters.memoryDifficulty!;
 expect(difficulty).toEqual({version:1,level:n});expect(state.windMemory.counts).toEqual({south:0,west:0,north:n,east:0});
 expect(state.encounters).toEqual(saved.encounters);
 for(const id of ADVENTURE_ROUTES.north){
  activateAdventure(active.encounters,id);const d=ENCOUNTERS.find(d=>d.id===id)!,defs=encounterDefinitions(active.encounters,d),baseline=waveMembers(d,active.seed).filter(m=>!m.boss).length;
  expect(defs.filter(m=>!m.boss)).toHaveLength(baseline+Math.min(2*n,baseline));
  for(const m of defs){const parsed=encounterUnit(m.id)!;expect(parsed).toBeDefined();expect(unitState(active.encounters,m.id)?.hp).toBe(Math.ceil(creatureMaxHP(m.type,m.elite,m.boss)*(1+n*(m.elite||m.boss?.18:.12))));}
  // 逐场打开仅是固定规则基准，不冒充键鼠通关。
  active.encounters.groups[id].rewarded=true;
 }
 // 上面的逐场基准保持未结算状态一致，单独验证各场遭遇记录。
 for(const id of ADVENTURE_ROUTES.north)active.encounters.groups[id].rewarded=false;
 expect(validateEncounters(active.encounters).memoryDifficulty).toEqual(difficulty);
 const e=body('wolf',330,-330,n),base=createEnemyAttack('基线',1,'wolf',0,e,{x:380,y:-330});
 const original=createEnemyAttack('基线',1,'wolf',0,{x:330,y:-330},{x:380,y:-330});
 expect(base.damage).toBeCloseTo(original.damage*(1+n*.06));expect(base.contactAt).toBeLessThan(original.contactAt);
 expect(base.contactAt-base.lockAt).toBeCloseTo(original.contactAt-original.lockAt);
 expect(creatureCooldown(base)).toBeLessThan(creatureCooldown(original));expect(creatureCooldown(base)-base.recoveryUntil).toBeCloseTo((creatureCooldown(original)-original.recoveryUntil)/memoryStrength(difficulty).frequency);
 expect(memoryCoins(4,difficulty)).toBe(Math.ceil(4*(1+n*.1)));
});
it('方向独立、结束不降档、旧活动原强度迁移及下一次升级',()=>{
 let state=started(2,'east');state=endWindMemory(state);{const camp=ENCOUNTERS.find(d=>d.id===ADVENTURE_ROUTES.south[4])!;Object.assign(state.player,{x:camp.x,y:camp.y});}
 state=startWindMemory(state,'south',123);expect(state.windMemory.active!.encounters.memoryDifficulty?.level).toBe(1);expect(state.windMemory.counts.east).toBe(2);
 const old=started();delete (old.windMemory as any).counts;old.windMemory.active!.encounters=initialEncounters(1234,`memory:${old.windMemory.serial}`);
 const migrated=parseSave(JSON.stringify(old));expect(migrated.windMemory.counts.north).toBe(1);expect(migrated.windMemory.active!.encounters.memoryDifficulty).toBeUndefined();
 const next=startWindMemory(endWindMemory(migrated),'north',1234);expect(next.windMemory.active!.encounters.memoryDifficulty?.level).toBe(2);
 const idle=cleared();delete (idle.windMemory as any).counts;expect(parseSave(JSON.stringify(idle)).windMemory.counts).toEqual({south:0,west:0,north:0,east:0});
 const fresh=started(20);expect(parseSave(JSON.stringify(fresh)).windMemory).toEqual(fresh.windMemory);
 for(const change of [{version:2,level:1},{version:1,level:0},{version:1,level:NaN}]){const corrupt=started();Object.assign(corrupt.windMemory.active!.encounters.memoryDifficulty!,change);expect(()=>validateWindMemory(corrupt.windMemory)).toThrow();}
});
it('开启原子保存失败与并发点击不消耗次数，重读保持伤势、种子和奖励凭据',async()=>{
 let state=cleared();{const camp=ENCOUNTERS.find(d=>d.id===ADVENTURE_ROUTES.north[4])!;Object.assign(state.player,{x:camp.x,y:camp.y});}const before=structuredClone(state),commit=new StateCommit();
 await expect(commit.run(()=>state,s=>startWindMemory(s,'north',77),async()=>{throw Error('模拟保存失败');},next=>{state=next;})).rejects.toThrow('模拟保存失败');expect(state).toEqual(before);
 let finish!:()=>void;const saving=commit.run(()=>state,s=>startWindMemory(s,'north',77),()=>new Promise<void>(r=>{finish=r;}),next=>{state=next;});await Promise.resolve();
 await expect(commit.run(()=>state,s=>startWindMemory(s,'north',77),async()=>{},next=>{state=next;})).rejects.toThrow('正在保存');finish();await saving;
 const data=state.windMemory.active!.encounters;activateAdventure(data,ADVENTURE_ROUTES.north[0]);const member=data.groups[ADVENTURE_ROUTES.north[0]].members[0];member.hp-=5;
 const reloaded=parseSave(JSON.stringify(state));expect(reloaded.windMemory).toEqual(state.windMemory);expect(reloaded.windMemory.counts.north).toBe(1);
});
it('速度、攻速、频率封顶后生命伤害继续成长，实测移动与东侧步态上限一致',()=>{
 expect(memoryStrength({version:1,level:20})).toMatchObject({movement:1.5,attack:1.3,frequency:1.5});expect(memoryStrength({version:1,level:20},true)).toMatchObject({movement:1.5,attack:1.4,frequency:1.6});
 expect(memoryStrength({version:1,level:21}).health).toBeGreaterThan(memoryStrength({version:1,level:20}).health);
 const distances:number[]=[];
 for(const n of [undefined,10,20]){const e=body('slime',330,-330,n);e.nav.path=[{x:500,y:-330}];e.nav.next=Infinity;e.nav.mode='chase';e.nav.lastSeen={x:500,y:-330};updateEnemy(e,{x:500,y:-330},1000,100,navigationBudget(),'player',()=>false);distances.push(Math.hypot(e.x-330,e.y+330));}
 expect(distances[1]/distances[0]).toBeCloseTo(1.5);expect(distances[2]).toBeCloseTo(distances[1]);
 for(const level of [1,10,20]){const e={x:0,y:0,face:{x:1,y:0},memoryDifficulty:{version:1 as const,level}};for(let i=1;i<=40;i++)advanceEastLocomotion(e,{x:10000,y:0},i*100,100,()=>false,()=>true);expect((e as any).eastMotion.speed).toBeCloseTo(68*memoryStrength(e.memoryDifficulty).movement);}
});
it('补援遵守10/12名额及900毫秒预告，等待未出生成员，全部死亡才推进',()=>{
 const state=started(20),data=state.windMemory.active!.encounters,id=ADVENTURE_ROUTES.north[0],d=ENCOUNTERS.find(v=>v.id===id)!;activateAdventure(data,id);data.groups[id].waveWarning=0;
 const bodies:EnemyBody[]=[],view={left:d.x-650,right:d.x+650,top:d.y-650,bottom:d.y+650};let reserved=4,serial=0;
 const runtime=new WildernessEncounters({read:()=>data,bodies:()=>bodies,enabled:v=>v.id===id,reserved:()=>reserved,busy:()=>false,release:id=>{const i=bodies.findIndex(e=>e.id===id);if(i>=0)bodies.splice(i,1);},spawn:(m,u)=>bodies.push({...body(m.type,u.x,u.y,20,m.elite),id:m.id,hp:u.hp})});
 runtime.update(16,serial,{x:d.x,y:d.y},view);expect(runtime.pendingCount).toBeGreaterThan(0);expect(runtime.pendingCount).toBeLessThanOrEqual(8);expect(bodies).toHaveLength(0);
 serial+=900;runtime.update(16,serial,{x:d.x,y:d.y},view);expect(bodies.filter(e=>e.hp>0).length).toBeLessThanOrEqual(8);reserved=0;
 let rounds=0;while(data.groups[id].wave===0&&rounds++<30){
  for(const e of bodies.filter(e=>e.hp>0)){settleEncounterDeath(data,e.id,false);e.hp=0;}
  serial+=16;runtime.update(16,serial,{x:d.x,y:d.y},view);expect(bodies.filter(e=>e.hp>0).length+runtime.pendingCount).toBeLessThanOrEqual(10);
  serial+=900;runtime.update(16,serial,{x:d.x,y:d.y},view);
 }
 expect(data.groups[id].wave).toBe(1);while(!data.groups[id].rewarded&&rounds++<600){for(const e of bodies.filter(e=>e.hp>0)){settleEncounterDeath(data,e.id,false);e.hp=0;}serial+=16;runtime.update(16,serial,{x:d.x,y:d.y},view);expect(bodies.filter(e=>e.hp>0).length+runtime.pendingCount).toBeLessThanOrEqual(10);}expect(data.groups[id].rewarded).toBe(true);expect(data.groups[id].cleared).toBe(true);expect(data.groups[id].members.filter(m=>encounterUnit(m.id)&&'wave' in encounterDefinitions(data,d).find(v=>v.id===m.id)!&&(encounterDefinitions(data,d).find(v=>v.id===m.id) as any).wave===0).every(m=>m.defeated)).toBe(true);
 expect(validateEncounters(data).memoryDifficulty?.level).toBe(20);
});
it.each(Object.keys(CAMP_BOSSES) as CampBossKind[])('%s全部招式和连段强化一次，半血阈值、持续节拍与战斗快照一致',kind=>{
 const info=CAMP_BOSSES[kind],d=ENCOUNTERS.find(d=>d.id===info.camp)!,state=started(20,d.direction),data=state.windMemory.active!.encounters;
 const e={...body(info.type,d.x,d.y,20),id:`${data.instance}|${d.members.find(m=>m.boss)!.id}`,boss:kind,bossAttempt:0,maxHP:creatureMaxHP(info.type,undefined,kind,data.memoryDifficulty),bossBattle:initialBossBattle(10000)};e.hp=e.maxHP;
 for(const phase of [1,2] as const)for(let move=0;move<info.skills.length;move++)for(let part=0;part<bossParts(kind,move,phase);part++){
  Object.assign(e.bossBattle,{phase,move,part});const base={...e,memoryDifficulty:undefined},a=createBossAttack(e,10000,{x:d.x+100,y:d.y},e.bossBattle),b=createBossAttack(base,10000,{x:d.x+100,y:d.y},e.bossBattle);
  expect(a.damage).toBeCloseTo(b.damage*2.6);expect(a.contactAt-a.lockAt).toBeCloseTo(b.contactAt-b.lockAt);
  if(bossMajor(kind,move)&&!(kind==='bound-branch'&&move===8&&part>0))expect(a.contactAt-a.startedAt).toBeGreaterThanOrEqual(1000);
  if(a.bossArea||a.bossLaser||a.bossCocoon)expect(a.activeUntil-a.contactAt).toBeCloseTo(b.activeUntil-b.contactAt);
 }
 Object.assign(e.bossBattle,{phase:1,move:-1,part:0,nextAt:0,exposedUntil:0});e.hp=e.maxHP*.55;
 expect(enemyProtection(e,{x:e.x+10,y:e.y},10000).hpFloor).toBeCloseTo(e.maxHP*.55);updateCampBoss(e,{x:e.x+100,y:e.y},10000,16,'player',true);expect(e.bossBattle.phase).toBe(2);
 // 使用真实结算函数准备首领阶段的固定保存基准，不计入实机击杀。
 for(let node=0;node<5;node++){const id=ADVENTURE_ROUTES[d.direction][node];activateAdventure(data,id);for(const m of [...data.groups[id].members])if(!encounterUnit(m.id)?.boss)settleEncounterDeath(data,m.id,false);}
 data.groups[d.id].boss!.stage='battle';data.groups[d.id].boss!.warning=0;e.hp=e.maxHP;e.bossBattle=initialBossBattle(10000);e.bossBattle.move=kind==='bound-branch'?6:kind==='crag-tusk'?5:0;e.attack=createBossAttack(e,10000,{x:e.x+100,y:e.y},e.bossBattle);
 const hazards=new BossHazards(),shots=new EnemyProjectiles();hazards.launch(e,e.attack.contactAt);if(e.attack.bossShotAngles)shots.launch(e.attack,e,e.attack.contactAt);if(kind==='spore-heart'){e.bossBattle.roots=[{x:e.x+180,y:e.y,hp:96,kind:'sac',until:e.attack.contactAt+2500,serial:1}];updateBossEnvironment({enemies:[e],bossHazards:hazards,sim:e.attack.contactAt,state:{player:{x:e.x-100,y:e.y}}} as any);expect(hazards.hazards[0].damage).toBeCloseTo(22*2.6);}if(kind==='thorn-crown'){e.bossBattle.summoned=1;e.bossBattle.summons=[{id:e.id+':护猎:0:0',x:e.x+100,y:e.y,hp:memoryHealth(58,data.memoryDifficulty)}];}const saved=captureBossCombat(e,e.attack.contactAt+100,hazards,shots);data.groups[d.id].boss!.combat=saved;
 const parsed=parseSave(JSON.stringify(state));expect(parsed.windMemory.active!.encounters.groups[d.id].boss!.combat).toEqual(saved);
 const restored={...e};restoreBossCombat(restored,saved,20000,new BossHazards(),new EnemyProjectiles());expect(restored.attack?.damage).toBe(e.attack.damage);
});
it('爆炸、远程快照、术士地面及连斩读取一次强化后的伤害',()=>{
 const e=body('bomber',330,-330,20);e.attack=createEnemyAttack(e.id,1,e.type,0,e,{x:380,y:-330});const blast=takeFungalBlast(e,e.attack.bombAt!)!,contact=fungalBlastContact(blast,{...e,id:'player'})!;
 expect(contact.attack.damage).toBeCloseTo(FUNGAL.blastDamage*2.2);expect(validFungalBlastContact(contact,e,'player')).toBe(true);
 const caster=body('geomancer',330,-330,20);caster.attack=createEnemyAttack(caster.id,1,caster.type,0,caster,{x:360,y:-330},undefined,undefined,2);const h=new BossHazards();h.launch(caster,0);expect(h.hazards[0].damage).toBeCloseTo(44);
 const archer=body('archer',330,-330,20),attack=createEnemyAttack(archer.id,1,archer.type,0,archer,{x:580,y:-330}),shots=new EnemyProjectiles();shots.launch(attack,archer,attack.contactAt);expect(shots.shots[0].released.amount).toBeCloseTo(16*2.2);
 const leaf=body('leaf',330,-330,20);leaf.targetId='player';leaf.attack=createEnemyAttack(leaf.id,1,leaf.type,0,leaf,{x:380,y:-330},undefined,undefined,2);const follow=enemyFollowup(leaf,{x:380,y:-330},leaf.attack.recoveryUntil,'player',true)!;expect(follow.damage).toBe(leaf.attack.damage);expect(follow.memoryDamageScale).toBe(2.2);
});

import {memoryGold} from '../src/game/systems/windMemory';
import {updateBossEnvironment} from '../src/game/systems/bossEnvironment';
import {updateSummonSupport} from '../src/game/systems/summonSupport';
import {MAX_COINS} from '../src/data/economy';
it('场次金币按档位结算一次，封顶与刷新保持凭据；首次清剿拒绝难度快照',()=>{
 const s=started(20),before=s.coins,id=ADVENTURE_ROUTES.north[0];expect(memoryGold(s,id,4)).toBe(true);expect(s.coins).toBe(before+12);expect(memoryGold(s,id,4)).toBe(false);
 const reload=parseSave(JSON.stringify(s));expect(memoryGold(reload,id,4)).toBe(false);reload.coins=MAX_COINS-1;expect(memoryGold(reload,`${ADVENTURE_ROUTES.north[4]}:boss`,16)).toBe(true);expect(reload.coins).toBe(MAX_COINS);
 const original=cleared();original.encounters.memoryDifficulty={version:1,level:1};original.encounters.instance='memory:1';expect(()=>parseSave(JSON.stringify(original))).toThrow();
});
it('召唤怪继承档位且与同场身体和出生预告共同遵守10只上限',()=>{
 const s=started(20),data=s.windMemory.active!.encounters,id=ADVENTURE_ROUTES.north[0];data.groups[id].rulesVersion=1;const d=ENCOUNTERS.find(d=>d.id===id)!;while(!waveMembers(d,data.seed!,1,20).some(m=>m.type==='bell'))data.seed!++;activateAdventure(data,id);const g=data.groups[id],defs=encounterDefinitions(data,d);
 const summon={...g.members[0],id:defs.find(m=>m.type==='bell')!.id+':唤巢:0',hp:memoryHealth(48,data.memoryDifficulty),x:d.x+180,y:d.y};g.summons=[summon];
 expect(validateEncounters(data).groups[id].summons![0].hp).toBe(164);
 const bodies=defs.slice(0,9).map(m=>({...body(m.type,m.x,m.y,20,m.elite),id:m.id}));const arrivals=new Map([['预告',{id:defs[9].id,spawned:false}]]),created:any[]=[];
 const w={combatEncounters:data,enemies:bodies,state:{player:{x:d.x,y:d.y}},sim:0,wilderness:{arrivals,pendingCount:1},makeEnemy:(m:any)=>{const e={...body('slime',m.x,m.y,20),id:m.id};created.push(e);return e;}} as any;
 updateSummonSupport(w);expect(created).toHaveLength(0);arrivals.clear();w.wilderness.pendingCount=0;updateSummonSupport(w);expect(created).toHaveLength(1);expect(created[0].hp).toBe(164);expect(created[0].maxHP).toBe(164);expect(createEnemyAttack(summon.id,1,'slime',0,created[0],{x:d.x,y:d.y}).damage).toBe(22);
});
it('最高合法档位保存有限属性；伤势恢复不重算生命，首领撤战读取有效最大生命',()=>{
 const s=started(),n=1_000_000_000;s.windMemory.serial=n;s.windMemory.counts.north=n;s.windMemory.active!.encounters=initialEncounters(1234,`memory:${n}`,{version:1,level:n});expect(parseSave(JSON.stringify(s)).windMemory.counts.north).toBe(n);expect(()=>startWindMemory(endWindMemory(s),'north',1234)).toThrow('上限');
 const bossState=started(5,'east'),data=bossState.windMemory.active!.encounters,d=ENCOUNTERS.find(d=>d.id===ADVENTURE_ROUTES.east[4])!;
 for(const id of ADVENTURE_ROUTES.east){activateAdventure(data,id);for(const m of data.groups[id].members)if(!encounterUnit(m.id)?.boss)settleEncounterDeath(data,m.id,false);}
 const boss=encounterDefinitions(data,d).find(m=>m.boss)!,u=unitState(data,boss.id)!;data.groups[d.id].boss!.stage='battle';data.groups[d.id].boss!.warning=0;u.hp-=100;const hurt=u.hp;
 const reloaded=parseSave(JSON.stringify(bossState));expect(unitState(reloaded.windMemory.active!.encounters,boss.id)!.hp).toBe(hurt);expect(reloaded.windMemory.counts.east).toBe(5);
 const runtime=new WildernessEncounters({read:()=>data,bodies:()=>[],spawn:()=>{},release:()=>{},busy:()=>false});runtime.resetBosses();expect(u.hp).toBe(creatureMaxHP(boss.type,boss.elite,boss.boss,data.memoryDifficulty));expect(data.groups[d.id].boss?.attempt).toBe(1);expect(bossState.windMemory.counts.east).toBe(5);expect(parseSave(JSON.stringify(bossState)).windMemory.counts.east).toBe(5);
});

it('十四种普通物种统一强化伤害与攻击时钟，持续施法不压缩阶段节拍',()=>{
 for(const type of ['slime','leaf','spore','boar','raven','wolf','burrow','guardian','priest','bomber','archer','bell','shade','geomancer']){
  const root=body(type,330,-330,20),base=createEnemyAttack(root.id,1,type,1000,{x:330,y:-330},{x:450,y:-330}),scaled=createEnemyAttack(root.id,1,type,1000,root,{x:450,y:-330});
  expect(scaled.damage).toBeCloseTo(base.damage*2.2);expect(scaled.contactAt-scaled.lockAt).toBeCloseTo(base.contactAt-base.lockAt);
  expect(scaled.recoveryUntil-scaled.activeUntil).toBeCloseTo(base.recoveryUntil-base.activeUntil);
  expect(scaled.activeUntil-scaled.contactAt).toBeCloseTo((base.activeUntil-base.contactAt)/(['priest','geomancer'].includes(type)?1:1.3));
  expect(creatureCooldown(scaled)-scaled.recoveryUntil).toBeCloseTo(Math.max(0,creatureCooldown(base)-base.recoveryUntil)/1.5);
 }
});
