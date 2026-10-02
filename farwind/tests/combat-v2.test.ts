import {bossGroundContains,bossGroundBlocks,meleeBody,bodyIntersectsSector} from '../src/game/systems/meleeGeometry';
import {sweptBossBodyContact} from '../src/game/systems/swordWindGeometry';
import {adventureSpawn,adventureExit,exitClearance} from '../src/game/systems/adventureSpawns';
import {clearMotionLine,motionBlocked} from '../src/game/systems/obstacles';
import {giftChoiceSnapshot,advanceGiftCooldowns} from '../src/game/systems/windGifts';
import {startWindMemory,endWindMemory,memoryGold} from '../src/game/systems/windMemory';
import {StateCommit} from '../src/game/systems/stateCommit';
import {updateCampBoss,bossEngagementRange} from '../src/game/systems/campBossCombat';
import {describe,it,expect} from 'vitest';
import {initialState,validate,parseSave,MAX_SAVE_BYTES} from '../src/game/systems/state';
import {ENCOUNTERS,ADVENTURE_ROUTES,waveMembers,encounterUnit,COMBAT_TEMPLATES,combatRole,COMPOSITION_LIMITS} from '../src/data/maps/windbell/encounters';
import {initialEncounters,activateAdventure,settleEncounterDeath,validateEncounters,unitState,advanceAdventureWave,campBossLocksAt} from '../src/game/systems/encounterState';
import {runeSnapshot} from '../src/game/systems/runeState';
import {initialWindGifts,offerWindGift,chooseWindGift,validateWindGifts} from '../src/game/systems/windGifts';
import {CAMP_BOSSES} from '../src/data/maps/windbell/campBosses';
import {initialBossBattle,shiftBossBattle,validateCampBoss} from '../src/game/systems/campBossState';
import {bossParts,createBossAttack,selectBossMove} from '../src/game/systems/campBossCombat';
import type {EnemyBody} from '../src/game/systems/enemy';
import {enemyNavigation} from '../src/game/systems/enemy';
import {updateBossEnvironment,defeatBossSummon} from '../src/game/systems/bossEnvironment';
import {BossHazards,bossHazardPoints,captureBossCombat,clearBossPendingAttacks} from '../src/game/systems/campBossCombat';
import {createEnemyAttack,advanceEnemyAttack,predictEnemyContact} from '../src/game/systems/enemyAttack';
import {EnemyProjectiles} from '../src/game/systems/enemyProjectiles';
import {reactToEnemyHit} from '../src/game/systems/enemyReaction';
import {STRIKES} from '../src/game/systems/combat';
import {synthBossArrival} from '../src/game/systems/bossArrivalAudio';
import {activeHostileCount} from '../src/game/systems/combatUnitBudget';
import {WildernessEncounters} from '../src/game/systems/encounterRuntime';
import {EastDefense} from '../src/game/systems/defense';
import {combatResourceDrop,settleEncounterCoins} from '../src/game/systems/combatCoins';

describe('第二版战斗存档与随机遭遇',()=>{
 it.each([undefined,'memory:1'])('首次和风忆撤离后的首领记录只封锁场地，脱战限制仍然有效：%s',instance=>{
  const s=initialState(),encounters=initialEncounters(123,instance),camp=ENCOUNTERS.find(d=>d.id==='south-spore-camp')!;
  s.runes.owned=['r01'];
  const safe={combat:false,boss:false,defense:false,trial:false,story:false,action:false};
  for(const stage of ['battle','warning'] as const){
   encounters.groups[camp.id].boss!.stage=stage;
   expect(campBossLocksAt(encounters,camp)).toBe(true);
   expect(()=>runeSnapshot(s,{kind:'equip',slot:0,id:'r01'},{...safe,boss:campBossLocksAt(encounters,camp)})).toThrow('首领封锁');
   for(const p of [{x:732,y:720},{x:3710,y:1100}]){
    expect(campBossLocksAt(encounters,p)).toBe(false);
    const safety={...safe,boss:campBossLocksAt(encounters,p)};
    expect(runeSnapshot(s,{kind:'equip',slot:0,id:'r01'},safety).runes.slots[0]).toBe('r01');
    expect(()=>runeSnapshot(s,{kind:'equip',slot:0,id:'r01'},{...safety,combat:true})).toThrow('脱战八秒');
   }
  }
 });
 it('风忆正式控制器推进第二波，已带实例身份的运行成员不会被再次加前缀',()=>{
  const data=initialEncounters(123,'memory:1'),id='north-pass-charge',d=ENCOUNTERS.find(v=>v.id===id)!;
  activateAdventure(data,id);data.groups[id].waveWarning=0;
  const bodies:EnemyBody[]=[];
  const runtime=new WildernessEncounters({read:()=>data,bodies:()=>bodies,enabled:v=>v.id===id,busy:()=>false,release:()=>{},spawn:(definition,u)=>bodies.push({...definition,hp:u.hp,x:u.x,y:u.y,homeX:definition.x,homeY:definition.y,cool:0,windup:0,staggerUntil:0,nav:enemyNavigation(),ai:'家园',disabled:false,recovered:false})});
  runtime.update(16,16,{x:d.x,y:d.y},{left:d.x-600,right:d.x+600,top:d.y-600,bottom:d.y+600});
  expect(bodies).toHaveLength(6);
  for(const e of bodies){expect(settleEncounterDeath(data,e.id,false)).toBe(true);e.hp=0;}
  runtime.update(16,32,{x:d.x,y:d.y},{left:d.x-600,right:d.x+600,top:d.y-600,bottom:d.y+600});
  expect(data.groups[id].wave).toBe(1);expect(data.groups[id].waveWarning).toBe(2000);
  for(let i=0;i<8;i++)runtime.update(250,282+i*250,{x:d.x,y:d.y},{left:d.x-600,right:d.x+600,top:d.y-600,bottom:d.y+600});
  expect(bodies.filter(e=>e.hp>0)).toHaveLength(6);
  for(const e of bodies.filter(e=>e.hp>0)){expect(settleEncounterDeath(data,e.id,false)).toBe(true);e.hp=0;}
  expect(data.groups[id].rewarded).toBe(true);expect(data.groups[id].cleared).toBe(true);
  expect(validateEncounters(data).groups[id].cleared).toBe(true);
 });
 it('普通资源按固定实例抽取，任务结晶必掉，重复死亡和重开不重新发放',()=>{
  let drops=0;
  for(let seed=0;seed<100;seed++){
   const s=initialState();s.encounters=initialEncounters(seed);activateAdventure(s.encounters,'south-reed-patrol');
   const member=s.encounters.groups['south-reed-patrol'].members[0],id=member.id;
   const drop=combatResourceDrop(id,seed);drops+=Number(drop);
   expect(combatResourceDrop('leaf-1',seed,true)).toBe(true);
   expect(combatResourceDrop('leaf-2',seed,true)).toBe(true);
   expect(settleEncounterCoins(s,id,true,drop)).not.toBeNull();
   const restored=parseSave(JSON.stringify(s)),before=restored.coins;
   expect(unitState(restored.encounters,id)!.drop).toBe(drop);
   expect(settleEncounterCoins(restored,id,true,!drop)).toBeNull();
   expect(restored.coins).toBe(before);expect(unitState(restored.encounters,id)!.drop).toBe(drop);
  }
  expect(drops).toBeGreaterThan(10);expect(drops).toBeLessThan(40);
 });
 it('完整路线导出的大备份可以恢复，超限按中文 UTF-8 字节拒绝',()=>{
  const s=initialState();
  for(const route of Object.values(ADVENTURE_ROUTES))for(const id of route){
   activateAdventure(s.encounters,id);s.encounters.groups[id].rewarded=true;
  }
  const text=JSON.stringify(s,null,4),bytes=new TextEncoder().encode(text).byteLength;
  expect(bytes).toBeGreaterThan(200000);expect(bytes).toBeLessThan(MAX_SAVE_BYTES);
  expect(parseSave(text).encounters).toEqual(s.encounters);
  const oversized=JSON.stringify({...s,说明:'风'.repeat(Math.ceil(MAX_SAVE_BYTES/3))});
  expect(oversized.length).toBeLessThan(MAX_SAVE_BYTES);
  expect(()=>parseSave(oversized)).toThrow('2 MB');
 });
 it('一百个固定种子下四条路线数量、身份、读档和清剿一致',()=>{
  expect(Object.values(COMBAT_TEMPLATES).flat()).toHaveLength(24);
  for(let seed=0;seed<100;seed++){
   const s=initialState();s.encounters=initialEncounters(seed);expect(validate(s).content_version).toBe(2);
   for(const route of Object.values(ADVENTURE_ROUTES))for(const id of route){
    expect(activateAdventure(s.encounters,id)).toBe(true);const d=ENCOUNTERS.find(d=>d.id===id)!,g=s.encounters.groups[id],defs=waveMembers(d,seed);
    expect(new Set(defs.map(m=>m.id)).size).toBe(defs.length);expect(defs.every(m=>!!encounterUnit(m.id))).toBe(true);
    const sizes=Array.from({length:id===route[2]?3:2},(_,w)=>defs.filter(m=>m.wave===w&&!m.boss).length);
    for(let wave=0;wave<sizes.length;wave++)for(const role of ['ranged','heavy','support'] as const)expect(defs.filter(m=>m.wave===wave&&!m.boss&&combatRole(m.type)===role).length).toBeLessThanOrEqual(COMPOSITION_LIMITS[role]);
    expect(sizes).toEqual(id===route[0]||id===route[3]?[6,6]:id===route[2]?[8,8,8]:[8,8]);
    expect(validateEncounters(s.encounters).groups[id].members).toEqual(g.members);
    for(let wave=0;wave<sizes.length;wave++){advanceAdventureWave(s.encounters,d,2000);for(const m of defs.filter(m=>m.wave===wave&&!m.boss))expect(settleEncounterDeath(s.encounters,m.id,false)).toBe(true);if(wave<sizes.length-1)advanceAdventureWave(s.encounters,d,0);}
    expect(g.rewarded).toBe(true);const boss=defs.find(m=>m.boss);if(boss){expect(g.boss!.stage).toBe('warning');g.boss!.stage='battle';g.boss!.warning=0;settleEncounterDeath(s.encounters,boss.id,false);}
    expect(g.cleared).toBe(true);expect(validate(s).encounters.groups[id].cleared).toBe(true);
   }
   expect(parseSave(JSON.stringify(s)).encounters).toEqual(s.encounters);
  }
 },60000);
 it('原任务敌人和结晶保底身份保留，旧备份拒绝导入',()=>{const s=initialState();const route=ADVENTURE_ROUTES.east;activateAdventure(s.encounters,route[0]);s.encounters.groups[route[0]].rewarded=true;activateAdventure(s.encounters,route[1]);expect(unitState(s.encounters,'leaf-1')).toBeDefined();expect(unitState(s.encounters,'leaf-2')).toBeDefined();const old={...s,content_version:1};expect(()=>parseSave(JSON.stringify(old))).toThrow('旧战斗');});
});
describe('长期风赐',()=>{
 it('保存候选，领取去重，升级和满六项替换',()=>{
  const s=initialWindGifts();expect(offerWindGift(s,'首次:南一',42,false)).toBe(true);const candidates=[...s.pending[0].candidates];expect(candidates).not.toContain('gale');expect(new Set(candidates).size).toBe(3);expect(offerWindGift(s,'首次:南一',43,true)).toBe(false);expect(validateWindGifts(s).pending[0].candidates).toEqual(candidates);chooseWindGift(s,'首次:南一',candidates[0]);expect(()=>chooseWindGift(s,'首次:南一',candidates[0])).toThrow();
  s.held=[{id:'blade',level:1},{id:'gale',level:2},{id:'stride',level:1},{id:'armor',level:2},{id:'spring',level:1},{id:'poise',level:2}];s.receipts.push('升级','替换');s.pending=[{receipt:'升级',candidates:['blade','shock','chain']},{receipt:'替换',candidates:['potion','shock','chain']}];chooseWindGift(s,'升级','blade');expect(s.held[0].level).toBe(2);expect(()=>chooseWindGift(s,'替换','potion')).toThrow('替换');chooseWindGift(s,'替换','potion','armor');expect(s.held).toHaveLength(6);expect(s.held.some(g=>g.id==='armor')).toBe(false);expect(validateWindGifts(s)).toEqual(s);
 });
});
describe('六招与阶段时钟',()=>{
 it('四首领六招锁向均提前至少350毫秒，技能冷却保存后保持',()=>{
  for(const [kind,info] of Object.entries(CAMP_BOSSES))for(const phase of [1,2] as const)for(let move=0;move<6;move++){
   expect(info.skills).toHaveLength(6);const b=initialBossBattle(10000);b.phase=phase;b.move=move;const e={id:'boss-'+kind,type:info.type,boss:kind,hp:info.hp,x:info.camp==='south-spore-camp'?1250:info.camp==='west-wolf-den'?-1700:info.camp==='north-boar-camp'?1480:3710,y:info.camp==='south-spore-camp'?2820:info.camp==='west-wolf-den'?1490:info.camp==='north-boar-camp'?-730:1100,attackSerial:0,bossAttempt:0,bossBattle:b} as EnemyBody;
   for(let part=0;part<bossParts(e.boss!,move,phase);part++){b.part=part;const a=createBossAttack(e,10000,{x:e.x+100,y:e.y},b);expect(a.contactAt-a.lockAt).toBeGreaterThanOrEqual(350);expect(a.contactAt-a.startedAt).toBeGreaterThanOrEqual(700);validateCampBoss({stage:'battle',warning:0,attempt:0,away:0,combat:{battle:shiftBossBattle(b,-10000),attack:null,hazards:[],shots:[],stagger:0,parried:null}},e.id);}
   b.lastSkill=move;b.cooldowns=Array(6).fill(0);expect(selectBossMove(e,{x:e.x+100,y:e.y},10000)).not.toBe(move);
  }
 });
});

describe('正式实例边界与保存失败反证',()=>{
 it('夜袭与新波次共用十二名额，名额不足延后而不删已保存成员',()=>{
  const state=initialState(),d=ENCOUNTERS.find(d=>d.id==='south-reed-patrol')!;activateAdventure(state.encounters,d.id);state.encounters.groups[d.id].waveWarning=0;
  const bodies:EnemyBody[]=[];let reserved=7;
  const runtime=new WildernessEncounters({read:()=>state.encounters,bodies:()=>bodies,reserved:()=>reserved,enabled:g=>g.id===d.id,busy:()=>false,release:()=>{},spawn:(m,u)=>bodies.push({...m,hp:u.hp,nav:enemyNavigation()} as EnemyBody)});
  const player={x:d.x,y:d.y+350},view={left:-5000,right:5000,top:-5000,bottom:5000};runtime.update(16,16,player,view);expect(bodies).toHaveLength(0);expect(state.encounters.groups[d.id].members.filter(u=>u.defeated)).toHaveLength(0);
  reserved=6;runtime.update(16,32,player,view);expect(bodies).toHaveLength(6);expect(activeHostileCount({enemies:bodies,defense:{enemies:Array.from({length:reserved},()=>({hp:48}))}})).toBe(12);
  const defense=new EastDefense(state.defense,0);defense.hostileLimit=12;
  // 超额在常规健康／地形条件之前拒绝，正式导演仍保留原计划等待。
  expect(defense.canScheduleAtGate('east-gate',player,Array.from({length:10},()=>player),undefined,Array.from({length:3},()=>player))).toBe(false);
 });
 it('一百个种子的所有波次出生点距主角至少220、彼此分离并有连续通路',()=>{
  for(let seed=0;seed<100;seed++)for(const route of Object.values(ADVENTURE_ROUTES))for(const id of route){
   const d=ENCOUNTERS.find(d=>d.id===id)!;
   for(const sign of [-1,0,1]){
    const player={x:d.x+sign*200,y:d.y},points:{x:number;y:number}[]=[],exit=adventureExit(d,player);
    expect(exit,`${id}的真实出口`).toBeDefined();if(!exit)continue;expect(clearMotionLine(d,exit)).toBe(true);
    const sizes=[...new Set(waveMembers(d,seed).filter(m=>!m.boss).map(m=>m.wave))].map(wave=>waveMembers(d,seed).filter(m=>m.wave===wave&&!m.boss).length);
    for(const [wave,size] of sizes.entries()){points.length=0;for(let slot=0;slot<size;slot++){const p=adventureSpawn(d,player,points,slot);expect(p,`${id}:${seed}:${slot}`).toBeDefined();if(!p)continue;expect(motionBlocked(p.x,p.y)).toBe(false);expect(clearMotionLine(p,d)).toBe(true);expect(exitClearance(p,d,exit)).toBeGreaterThanOrEqual(60);expect(Math.hypot(p.x-player.x,p.y-player.y)).toBeGreaterThanOrEqual(220);expect(points.every(q=>Math.hypot(q.x-p.x,q.y-p.y)>=65)).toBe(true);points.push(p);}}
   }
  }
 },60000);
 it('保存失败不发布风赐，冷却重开保持，重试只有一次生效',async()=>{
  let state=initialState();offerWindGift(state.windGifts,'保存边界',23,false);const before=structuredClone(state),id=state.windGifts.pending[0].candidates[0],commit=new StateCommit();
  await expect(commit.run(()=>state,s=>giftChoiceSnapshot(s,'保存边界',id),async()=>{throw Error('保存失败');},s=>state=s)).rejects.toThrow('保存失败');expect(state).toEqual(before);
  await commit.run(()=>state,s=>giftChoiceSnapshot(s,'保存边界',id),async()=>{},s=>state=s);expect(state.windGifts.held).toHaveLength(1);expect(state.windGifts.pending).toHaveLength(0);
  state.windGifts.cooldowns.shock=800;const reopened=parseSave(JSON.stringify(state));expect(reopened.windGifts.cooldowns.shock).toBe(800);advanceGiftCooldowns(reopened.windGifts,250);expect(reopened.windGifts.cooldowns.shock).toBe(550);
 });
 it('风忆实例独立、死亡继续不重抽、首次清剿和材料事实不能被重写',()=>{
  const state=initialState(),route=ADVENTURE_ROUTES.south,camp=ENCOUNTERS.find(d=>d.id===route[4])!;
  // 固定状态基准只验证保存与结算规则；不计入真实键鼠通关证据。
  for(const id of route){activateAdventure(state.encounters,id);const g=state.encounters.groups[id];for(const m of [...g.members])if(!encounterUnit(m.id)?.boss)settleEncounterDeath(state.encounters,m.id,false);if(g.boss){g.boss.stage='battle';g.boss.warning=0;settleEncounterDeath(state.encounters,g.members.find(m=>encounterUnit(m.id)?.boss)!.id,false);}}
  Object.assign(state.player,{x:camp.x,y:camp.y});const first=structuredClone(state.encounters),next=startWindMemory(state,'south',1234),a=next.windMemory.active!;expect(activateAdventure(a.encounters,route[0])).toBe(true);const ids=a.encounters.groups[route[0]].members.map(m=>m.id);expect(ids.every(id=>id.startsWith('memory:1|'))).toBe(true);expect(parseSave(JSON.stringify(next)).windMemory.active!.encounters.groups[route[0]].members.map(m=>m.id)).toEqual(ids);
  const coins=next.coins;expect(memoryGold(next,route[0],4)).toBe(true);expect(memoryGold(next,route[0],4)).toBe(false);expect(next.coins).toBe(coins+4);expect(next.encounters).toEqual(first);const end=endWindMemory(next);expect(end.windMemory.active).toBeNull();expect(end.encounters).toEqual(first);expect(end.windGifts).toEqual(next.windGifts);
 });
 it('无直接伤害的召唤与筑岩不会卡在零距离起手条件',()=>{
  for(const kind of ['thorn-crown','crag-tusk','spore-heart'] as const){const info=CAMP_BOSSES[kind],d=ENCOUNTERS.find(d=>d.id===info.camp)!,b=initialBossBattle(0);b.move=kind==='spore-heart'?5:4;b.nextAt=0;const e={id:d.members.find(m=>m.boss)!.id,type:info.type,boss:kind,hp:info.hp,x:d.x,y:d.y,homeX:d.x,homeY:d.y,bossBattle:b,staggerUntil:0,attackSerial:0,nav:{path:[]}} as unknown as EnemyBody;
   expect(bossEngagementRange(kind,b)).toBeGreaterThan(200);updateCampBoss(e,{x:d.x+160,y:d.y},1000,16,'player',true);expect(e.attack?.bossSkill).toBe(b.move);}
 });
});

describe('高清首领正式受击面',()=>{
 it('猎王侧伸前腿可被贴身近战和剑风命中，镜像一致且尾端不扩大身体',()=>{
  for(const facing of [2,3] as const){
   const sign=facing===2?-1:1,target={x:0,y:0,boss:'thorn-crown',hurtboxFacing:facing};
   expect(bodyIntersectsSector(meleeBody(target)!,{x:sign*200,y:-28},{x:-sign,y:0},55,.6)).toBe(true);
   expect(sweptBossBodyContact({x:sign*165,y:-20},{x:sign*180,y:-20},target,target,target,8)).not.toBeNull();
   expect(sweptBossBodyContact({x:-sign*190,y:-70},{x:-sign*170,y:-70},target,target,target,8)).toBeNull();
   const inside={x:sign*110,y:0},outside={x:sign*160,y:0};
   expect(bossGroundContains(target,inside)).toBe(true);
   expect(bossGroundBlocks(target,outside,inside)).toBe(true);
   expect(bossGroundBlocks(target,inside,outside)).toBe(false);
  }
 });
 it('剑风连续扫过腿部与躯干都命中，远离身体的武器与尾端不扩大命中面',()=>{
  for(const [kind,info] of Object.entries(CAMP_BOSSES)){
   const target={x:0,y:0,boss:kind};
   expect(sweptBossBodyContact({x:-250,y:0},{x:250,y:0},target,target,target,15)).not.toBeNull();
   expect(sweptBossBodyContact({x:-250,y:-info.height*.4},{x:250,y:-info.height*.4},target,target,target,15)).not.toBeNull();
   expect(sweptBossBodyContact({x:-250,y:-info.height-40},{x:250,y:-info.height-40},target,target,target,15)).toBeNull();
   expect(sweptBossBodyContact({x:-250,y:info.height*.4},{x:250,y:info.height*.4},target,target,target,15)).toBeNull();
  }
 });
});

describe('首领地面占位脱离',()=>{
 it('首领挤入主角后允许向外脱离，仍禁止向核心穿入',()=>{
  for(const kind of Object.keys(CAMP_BOSSES)){
   const boss={x:0,y:0,boss:kind},inside={x:12,y:0};
   expect(bossGroundContains(boss,inside)).toBe(true);
   expect(bossGroundBlocks(boss,inside,{x:18,y:0})).toBe(false);
   expect(bossGroundBlocks(boss,inside,{x:6,y:0})).toBe(true);
   expect(bossGroundBlocks(boss,{x:100,y:0},{x:12,y:0})).toBe(true);
  }
 });
});

describe('机关、召唤与新增敌人的正式运行入口',()=>{
 it('护猎死亡计数跨召唤补充保持，每击败两只暴露一次，重复通知不延长窗口',()=>{
  const b=initialBossBattle(0),owner={bossBattle:b,staggerUntil:0} as EnemyBody;
  b.summoned=2;b.summons=[{id:'第一只',hp:58,x:0,y:0},{id:'第二只',hp:58,x:0,y:0}];
  expect(defeatBossSummon(owner,'第一只',1000)).toBe(false);
  b.summons=b.summons.filter(s=>s.hp>0);b.summoned=3;b.summons.push({id:'第三只',hp:58,x:0,y:0});
  expect(defeatBossSummon(owner,'第二只',2000)).toBe(true);expect(b.exposedUntil).toBe(4000);
  expect(defeatBossSummon(owner,'第二只',2500)).toBe(false);expect(b.exposedUntil).toBe(4000);
  b.summons=b.summons.filter(s=>s.hp>0);b.summoned=4;b.summons.push({id:'第四只',hp:58,x:0,y:0});
  expect(defeatBossSummon(owner,'第三只',5000)).toBe(false);expect(defeatBossSummon(owner,'第四只',6000)).toBe(true);expect(b.exposedUntil).toBe(8000);
 });
 function sample(kind:keyof typeof CAMP_BOSSES,move:number,phase:1|2=2){
  const info=CAMP_BOSSES[kind],camp=ENCOUNTERS.find(d=>d.id===info.camp)!;
  const boss={id:'boss-'+kind,type:info.type,boss:kind,bossAttempt:0,bossBattle:initialBossBattle(0),hp:info.hp,x:camp.x,y:camp.y,homeX:camp.x,homeY:camp.y,attackSerial:1,staggerUntil:0,nav:enemyNavigation(),face:{x:1,y:0},disabled:false} as EnemyBody;
  boss.bossBattle!.phase=phase;boss.bossBattle!.move=move;
  const state=initialState();state.player.x=camp.x+340;state.player.y=camp.y;
  boss.attack=createBossAttack(boss,0,state.player,boss.bossBattle!);
  const w={state,enemies:[boss],sim:boss.attack.contactAt,bossHazards:new BossHazards(),makeEnemy:(d:object)=>({...d,hp:48,sprite:{destroy(){}},shadow:{destroy(){}}})} as unknown as Parameters<typeof updateBossEnvironment>[0];return {w,boss};
 }
 it('阶段转换取消旧未命中弹丸与未生效预警，其他来源和已生效区域保留',()=>{
  const {w,boss}=sample('spore-heart',0,1),shots=new EnemyProjectiles();shots.launch(boss.attack!,boss,w.sim);
  expect(shots.shots).toHaveLength(3);const other=structuredClone(shots.shots[0]);other.id='其他敌人';other.attack.attackerId='其他敌人';shots.shots.push(other);
  const active={id:'已生效',owner:boss.id,attempt:0,kind:'circle' as const,point:{x:boss.x,y:boss.y},born:0,activeAt:500,expires:3000,radius:44,speed:0,damage:22,used:[]};
  w.bossHazards.hazards=[active,{...active,id:'未生效',activeAt:1500},{...active,id:'其他来源',owner:'其他敌人',activeAt:1500}];
  clearBossPendingAttacks(boss,1000,w.bossHazards,shots);
  expect(shots.shots.map(s=>s.id)).toEqual(['其他敌人']);expect(w.bossHazards.hazards.map(h=>h.id)).toEqual(['已生效','其他来源']);
  expect(shots.update(1800,{x:boss.x+100,y:boss.y},()=>true).every(c=>c.attack.attackerId!==boss.id)).toBe(true);
 });
 it('双祭根、双孢囊、三岩柱、双祭印数量有界，重复更新不重复生成',()=>{
  for(const [kind,move,node,count] of [['spore-heart',5,'sac',2],['crag-tusk',4,'rock',3],['bound-branch',5,'sigil',2]] as const){
   const {w,boss}=sample(kind,move);updateBossEnvironment(w);const before=structuredClone(boss.bossBattle!.roots);updateBossEnvironment(w);
   expect(boss.bossBattle!.roots).toEqual(before);expect(before!.filter(r=>r.kind===node&&r.hp>0)).toHaveLength(count);
   if(kind==='spore-heart'){expect(before!.filter(r=>r.kind==='root')).toHaveLength(2);expect(w.bossHazards.hazards).toHaveLength(2);}
  }
 });
 it('十二个活动槽位已满时不创建机关，释放槽位后补足双祭根',()=>{
  const {w,boss}=sample('spore-heart',2);for(let i=0;i<11;i++)w.enemies.push({id:'占位'+i,hp:1,x:boss.x+1000+i*70,y:boss.y} as typeof w.enemies[number]);updateBossEnvironment(w);expect(boss.bossBattle!.roots??[]).toHaveLength(0);
  w.enemies=w.enemies.slice(0,1);updateBossEnvironment(w);expect(boss.bossBattle!.roots!.filter(r=>r.kind==='root')).toHaveLength(2);
  const shared=sample('spore-heart',2);shared.w.defense={enemies:Array.from({length:11},()=>({hp:48}))} as typeof shared.w.defense;updateBossEnvironment(shared.w);expect(shared.boss.bossBattle!.roots??[]).toHaveLength(0);
 });
 it('护猎狼同时最多两只、全战最多四只，既有铃妖召唤物占用同一上限',()=>{
  const {w,boss}=sample('thorn-crown',4);w.enemies.push({id:'既有:唤巢:0',hp:48,x:boss.x+900,y:boss.y} as typeof w.enemies[number]);updateBossEnvironment(w);
  expect(w.enemies.filter(e=>e.hp>0&&(e.bossSummon||e.id.includes(':唤巢:')))).toHaveLength(2);
  w.enemies.find(e=>e.id==='既有:唤巢:0')!.hp=0;updateBossEnvironment(w);expect(w.enemies.filter(e=>e.hp>0&&e.bossSummon)).toHaveLength(2);
  for(let cast=0;cast<3;cast++){for(const e of w.enemies.filter(e=>e.bossSummon))e.hp=0;updateBossEnvironment(w);boss.attackSerial!++;boss.attack=createBossAttack(boss,w.sim,w.state.player,boss.bossBattle!);w.sim=boss.attack.contactAt;updateBossEnvironment(w);expect(w.enemies.filter(e=>e.hp>0&&e.bossSummon).length).toBeLessThanOrEqual(2);}
  expect(boss.bossBattle!.summoned).toBe(4);
 });
 it('根带正式两侧命中而中央安全，预警落点与危险区完全一致',()=>{
  const {w,boss}=sample('bound-branch',2);const a=boss.attack!;advanceEnemyAttack(a,boss,w.state.player,a.lockAt);const points=bossHazardPoints(a);w.bossHazards.launch(boss,0);
  expect(points).toHaveLength(2);expect(w.bossHazards.hazards.map(h=>h.point)).toEqual(points);
  const center={...a.bossGeometry!.point,id:'通道',previous:a.bossGeometry!.point};expect(w.bossHazards.update(a.lockAt,a.contactAt+1,[boss],[center])).toHaveLength(0);
  expect(w.bossHazards.update(a.contactAt+1,a.contactAt+2,[boss],points.map((p,i)=>({...p,id:'两侧'+i,previous:p})))).toHaveLength(2);
 });
 it('弩灵锁向后横移真实免伤，留在弹道真实接触且可弹反',()=>{
  const origin={x:1050,y:2040},target={x:origin.x+250,y:origin.y},a=createEnemyAttack('弩灵',1,'archer',0,origin,target);
  advanceEnemyAttack(a,origin,target,a.lockAt);advanceEnemyAttack(a,origin,{x:target.x,y:target.y+150},a.contactAt);expect(a.direction).toEqual({x:1,y:0});
  const locked=structuredClone(a),predicted=predictEnemyContact(a,origin,target,a.lockAt,{blocked:()=>false,clear:()=>true,melee:()=>true});const shots=new EnemyProjectiles();shots.launch(a,origin,a.contactAt);expect(shots.update(a.contactAt+1200,{x:target.x,y:target.y+150},()=>true)).toHaveLength(0);
  const hit=new EnemyProjectiles();hit.launch(locked,origin,locked.contactAt);const contacts=hit.update(locked.contactAt+1200,target,()=>true);expect(contacts).toHaveLength(1);expect(contacts[0].attack.type).toBe('archer');expect(contacts[0].attack.parryable).toBe(true);expect(contacts[0].at).toBeCloseTo(predicted!,4);
 });
 it('铃妖和岩脉术士的施法可由原生近战打断',()=>{
  for(const type of ['bell','geomancer'] as const){const e={id:type,type,hp:84,x:1050,y:2040,nav:enemyNavigation(),staggerUntil:0} as EnemyBody;e.attack=createEnemyAttack(e.id,1,type,0,e,{x:e.x+250,y:e.y});reactToEnemyHit(e,100,STRIKES[0],{x:1,y:0},false,true);expect(e.attack.cancelled).toBe(true);}
 });
 it('护猎失衡结束时不重复追加暴露或等待时间',()=>{
  const {boss}=sample('thorn-crown',4,1),deadline=3000;boss.attack!.cancelled=true;boss.staggerUntil=deadline;boss.bossBattle!.exposedUntil=deadline;boss.bossBattle!.nextAt=deadline;
  updateCampBoss(boss,{x:boss.x+100,y:boss.y},deadline-1,16,'player',true);expect(boss.bossBattle!.exposedUntil).toBe(deadline);
  updateCampBoss(boss,{x:boss.x+100,y:boss.y},deadline,1,'player',true);expect(boss.bossBattle!.exposedUntil).toBe(deadline);expect(boss.bossBattle!.nextAt).toBe(deadline);
 });
 it('真实显示对象作为目标时，危险圈只保存坐标而不混入精灵或回调',()=>{
  const {boss}=sample('spore-heart',1),actor={x:boss.x+180,y:boss.y,sprite:{scene:{update(){}}}};boss.attack=createBossAttack(boss,0,actor,boss.bossBattle!);updateCampBoss(boss,actor,boss.attack.lockAt,0,'guard',true);
  expect(Object.keys(boss.attack!.bossGeometry!.point).sort()).toEqual(['x','y']);expect(()=>captureBossCombat(boss,900,new BossHazards(),new EnemyProjectiles())).not.toThrow();
  const caster=createEnemyAttack('术士',1,'geomancer',0,boss,actor);expect(Object.keys(caster.bossGeometry!.point).sort()).toEqual(['x','y']);expect(()=>structuredClone(caster)).not.toThrow();
 });
});

describe('专属入场声的资源与信号边界',()=>{
 it('四种声音可重现、有限幅、首尾无突变且互不相同',()=>{
  const voices=Object.keys(CAMP_BOSSES).map(kind=>synthBossArrival(kind as keyof typeof CAMP_BOSSES,24000));
  for(const [i,data] of voices.entries()){expect(data).toHaveLength(30000);expect([...data].every(x=>Number.isFinite(x)&&Math.abs(x)<=.85)).toBe(true);expect(Math.abs(data[0])).toBe(0);expect(Math.abs(data.at(-1)!)).toBeLessThan(.00001);expect(data).toEqual(synthBossArrival(Object.keys(CAMP_BOSSES)[i] as keyof typeof CAMP_BOSSES,24000));expect(data.reduce((sum,x)=>sum+x*x,0)/data.length).toBeGreaterThan(.001);}
  for(let i=0;i<voices.length;i++)for(let j=i+1;j<voices.length;j++)expect(voices[i].reduce((sum,x,k)=>sum+(x-voices[j][k])**2,0)/voices[i].length).toBeGreaterThan(.001);
 });
});
