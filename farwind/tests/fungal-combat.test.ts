import {describe,it,expect} from 'vitest';
import {ENCOUNTERS,LEGACY_ENCOUNTER_IDS} from '../src/data/maps/windbell/encounters';
import {initialEncounters,validateEncounters,unitState,settleEncounterDeath} from '../src/game/systems/encounterState';
import {initialState,validate,count} from '../src/game/systems/state';
import {enemyNavigation,updateEnemy,type EnemyBody} from '../src/game/systems/enemy';
import {createEnemyAttack,advanceEnemyAttack,predictEnemyContact} from '../src/game/systems/enemyAttack';
import {refreshFungalShields,updateFungalPriest,takeFungalBlast,fungalBlastContact,validFungalBlastContact,FUNGAL} from '../src/game/systems/fungalCombat';
import {enemyProtection} from '../src/game/systems/enemyTraits';
import {reactToEnemyHit} from '../src/game/systems/enemyReaction';
import {attackConfig} from '../src/game/systems/combat';
import {resolveDamage,resolveBlastDamage} from '../src/game/systems/damage';
import {playerAttackPermitted} from '../src/game/systems/encounterTempo';
import {initialBossBattle,validateCampBoss} from '../src/game/systems/campBossState';
import {captureBossCombat,restoreBossCombat,BossHazards,createBossAttack} from '../src/game/systems/campBossCombat';
import {EnemyProjectiles} from '../src/game/systems/enemyProjectiles';
import {southEventRewardSnapshot} from '../src/game/systems/fieldQuest';
import {SOUTH_EVENTS,southResourceBlock} from '../src/game/systems/southEvents';
import {EastDefense} from '../src/game/systems/defense';
import {NpcLife} from '../src/game/systems/npcLife';
import {XiaobaoCombat} from '../src/game/systems/xiaobaoCombat';
import {encounterState} from './npc-combat-fixtures';
import {StateCommit} from '../src/game/systems/stateCommit';
import {motionBlocked} from '../src/game/systems/obstacles';
const open={blocked:()=>false,clear:()=>true,melee:()=>true};
const body=(id:string,type='slime',x=900,y=700):EnemyBody=>({id,type,x,y,hp:96,homeX:x,homeY:y,staggerUntil:0,cool:0,windup:0,nav:enemyNavigation(),ai:'家园',disabled:false,recovered:false});
const oldEncounters=()=>{const s:any=initialEncounters();for(const d of ENCOUNTERS){const g=s.groups[d.id];delete g.composition;g.members=LEGACY_ENCOUNTER_IDS[d.id].map(id=>{const u=structuredClone(unitState(s,id)!);delete u.id;return u;});}return s;};
describe('新增组合保持真实旧档事实',()=>{
 it('第十四版位置旧档保留伤势、掉落、串号，并把新成员延后至下一批次',()=>{
  const old=oldEncounters(),g=old.groups['south-reed-patrol'];g.activated=true;Object.assign(g.members[0],{hp:19,serial:7,cooldown:510});
  const s=validateEncounters(old);expect(unitState(s,'wild-reed-slime')).toMatchObject({hp:19,serial:7,cooldown:510});expect(unitState(s,'wild-reed-spore')).toMatchObject({hp:0,defeated:true,drop:false});expect(s.groups['south-reed-patrol'].cleared).toBe(false);expect(validateEncounters(s)).toEqual(s);
 });
 it('未激活旧组获得新配置，进行中据点保留首领状态而不突然增添祭司',()=>{
  const old=oldEncounters();const camp=old.groups['south-spore-camp'];camp.activated=true;const s=validateEncounters(old);
  expect(unitState(s,'wild-herb-priest')!.hp).toBe(96);expect(unitState(s,'wild-camp-priest')!.defeated).toBe(true);expect(s.groups['south-spore-camp'].boss).toEqual(camp.boss);expect(s.groups['south-spore-camp'].members.at(-1)!.id).toBe('boss-spore-heart');
 });
 it('当前身份错位、旧槽位缺失或伪造版本不能被迁移掩盖',()=>{
  const swapped=initialEncounters();[swapped.groups['south-herb-patrol'].members[0],swapped.groups['south-herb-patrol'].members[1]]=[swapped.groups['south-herb-patrol'].members[1],swapped.groups['south-herb-patrol'].members[0]];expect(()=>validateEncounters(swapped)).toThrow();
  const lost=oldEncounters();lost.groups['south-herb-patrol'].members.pop();expect(()=>validateEncounters(lost)).toThrow();const version=initialEncounters();version.groups['south-reed-patrol'].composition=9;expect(()=>validateEncounters(version)).toThrow();
 });
 it('新据点守军必须包含祭司，原三只守军全灭不能提前唤出首领',()=>{
  const s=initialEncounters(),g=s.groups['south-spore-camp'];g.activated=true;for(const id of ['wild-camp-spore','wild-camp-slime-a','wild-camp-slime-b'])settleEncounterDeath(s,id,false);
  expect(g.boss!.stage).toBe('guards');settleEncounterDeath(s,'wild-camp-priest',false);expect(g.boss!.stage).toBe('warning');expect(validateEncounters(s)).toEqual(s);
 });
});
describe('祭司的护盾可读且可中断',()=>{
 it('只护一名普通同伴，排除首领、祭根和另一祭司',()=>{
  const priest=body('priest','priest'),ally=body('ally','spore',1000),boss={...body('boss','spore',1050),boss:'spore-heart' as const},root={...body('root','priest',1010),passiveRoot:{owner:boss.id,index:0,attempt:0}};
  const peers=[priest,ally,boss,root,body('other','priest',990)];updateFungalPriest(priest,peers,{x:1080,y:700},0,0,'player',()=>true);expect(priest.attack!.supportTarget).toBe('ally');
  refreshFungalShields(peers,900);expect(enemyProtection(ally,{x:1100,y:700},900).reduction).toBe(FUNGAL.reduction);expect(root.fungalShield).toBeUndefined();expect(boss.fungalShield).toBeUndefined();
 });
 it('普通攻击打断施法，死亡和越界立即撤盾，不保留缓存保护',()=>{
  const priest=body('priest','priest'),ally=body('ally','spore',1000),peers=[priest,ally];updateFungalPriest(priest,peers,{x:1080,y:700},0,0,'player',()=>true);refreshFungalShields(peers,1000);
  reactToEnemyHit(priest,1000,attackConfig({stage:1} as any),{x:1,y:0},false,false);expect(priest.attack!.cancelled).toBe(true);expect(enemyProtection(ally,undefined,1000).reduction).toBe(0);
  priest.attack!.cancelled=false;priest.staggerUntil=0;priest.hp=0;expect(enemyProtection(ally,undefined,1000).reduction).toBe(0);priest.hp=96;ally.x=1400;expect(enemyProtection(ally,undefined,1000).reduction).toBe(0);
 });
 it('护盾不叠加，第二祭司和相邻遭遇同时施法受预算限制',()=>{
  const p=body('p','priest'),q=body('q','priest',850),ally=body('ally','spore',1000);updateFungalPriest(p,[p,q,ally],ally,0,0,'player',()=>true);
  expect(playerAttackPermitted(q,'player',ally,[p,q,ally],100)).toBe(false);refreshFungalShields([p,q,ally],1000);expect(ally.fungalShield).toBe(p);
 });
 it('祭司的正式攻击不产生近战接触，也不向玩家单独放盾',()=>{
  const p=body('p','priest');updateEnemy(p,{x:1000,y:700},1,1,undefined,'player',()=>true,[]);expect(p.attack).toBeUndefined();
  const a=createEnemyAttack(p.id,1,'priest',0,p,{x:1000,y:700});expect(advanceEnemyAttack(a,p,p,a.activeUntil,open)).toBeNull();
 });
});
describe('滚兽固定方向、膨胀与诱爆',()=>{
 it('滚动后至少一秒膨胀预警，锁向后移动目标不改变方向',()=>{
  const e=body('b','bomber'),a=e.attack=createEnemyAttack(e.id,1,e.type,0,e,{x:1200,y:700});advanceEnemyAttack(a,e,{x:1200,y:700},a.lockAt,open);const d={...a.direction};advanceEnemyAttack(a,e,{x:900,y:1000},a.activeUntil,open);
  expect(a.direction).toEqual(d);expect(e.x).toBeCloseTo(1080);expect(a.bombAt!-a.activeUntil).toBeGreaterThanOrEqual(800);expect(takeFungalBlast(e,a.bombAt!-1)).toBeNull();
 });
 it('膨胀阶段把真实爆炸威胁提供给伙伴，死亡祭司不能重新施法',()=>{
  const e=body('b','bomber'),a=e.attack=createEnemyAttack(e.id,1,e.type,0,e,e);
  expect(predictEnemyContact(a,e,{x:930,y:700},a.bombAt!-400,open)).toBe(a.bombAt);expect(predictEnemyContact(a,e,{x:1030,y:700},a.bombAt!-400,open)).toBeNull();a.cancelled=true;expect(predictEnemyContact(a,e,e,a.bombAt!-100,open)).toBeNull();
  const p={...body('p','priest'),hp:0};updateFungalPriest(p,[p,body('ally')],e,1000,20,'player',()=>true);expect(p.attack).toBeUndefined();
 });
 it('爆点使用真实击退位置，同一爆炸只有一个结算实例',()=>{
  const e=body('b','bomber'),a=e.attack=createEnemyAttack(e.id,1,e.type,0,e,{x:1200,y:700});e.x+=30;const blast=takeFungalBlast(e,a.bombAt!)!;
  expect(blast.point.x).toBe(930);expect(takeFungalBlast(e,a.bombAt!+1)).toBeNull();expect(fungalBlastContact(blast,{id:'player',x:930,y:700})).toMatchObject({attack:{parryable:false},geometry:{radius:94}});expect(fungalBlastContact(blast,{id:'player',x:1030,y:700})).toBeNull();
 });
 it('范围爆炸命中未锁定的平民、卫兵与伙伴，伪造爆点和重复实例仍拒绝',()=>{
  const s=encounterState(),d=new EastDefense(s.defense,0),life=new NpcLife(s,d),e={...body('b','bomber',850,500),kind:'enemy' as const,targetId:'player'};
  d.external=[e];const a=e.attack=createEnemyAttack(e.id,1,e.type,0,e,s.player),blast=takeFungalBlast(e,a.bombAt!)!;
  const person=s.life.people[0],contact=fungalBlastContact(blast,{...person.body!,id:person.id})!;
  expect(validFungalBlastContact({...contact,origin:{x:0,y:0}},e,person.id)).toBe(false);
  expect(life.receiveHostileContact(person.id,e,contact)).toBe(true);expect(person.body!.hp).toBe(74);expect(life.receiveHostileContact(person.id,e,contact)).toBe(false);
  const guard=s.defense.guards.find(g=>!g.dead)!;Object.assign(guard,{x:850,y:530});const gc=fungalBlastContact(blast,guard)!;const hp=guard.hp;
  expect(d.damageGuard({sourceId:e.id,targetId:guard.id,attackId:gc.attack.attackId,amount:gc.attack.damage,sourceType:'enemy-blast',eventId:null},e)).toBe(true);expect(guard.hp).toBeLessThan(hp);
  Object.assign(s.xiaobao,{x:850,y:525,task:'follow'});const cat=new XiaobaoCombat();cat.bind(s.xiaobao,true);const cc=fungalBlastContact(blast,{x:cat.x,y:cat.y,id:'xiaobao'})!,before=cat.data.hp;
  const damage=(ev:any)=>resolveDamage(ev,{id:e.id,hp:e.hp,faction:'hostile',armor:0},{id:'xiaobao',hp:cat.data.hp,faction:'village',armor:12});
  expect(cat.receive(cc,e,damage,blast.at)).toBe(true);expect(cat.data.hp).toBe(before-14);expect(cat.receive(cc,e,damage,blast.at)).toBe(false);expect(takeFungalBlast(e,blast.at+1)).toBeNull();
 });
 it('重击取消膨胀，普通攻击只改变位置；伤害系统明确限制同阵营伤害入口',()=>{
  const e=body('b','bomber'),a=e.attack=createEnemyAttack(e.id,1,e.type,0,e,{x:1200,y:700});reactToEnemyHit(e,a.activeUntil,attackConfig({stage:3} as any),{x:1,y:0},false,true);expect(takeFungalBlast(e,a.bombAt!+50)).toBeNull();
  const source={id:'b',hp:96,faction:'hostile' as const,armor:0},target={id:'other',hp:64,faction:'hostile' as const,armor:0},ev={sourceId:'b',targetId:'other',attackId:'blast:1',amount:80,sourceType:'enemy-blast' as const,eventId:null};
  expect(resolveDamage(ev,source,target).applied).toBe(false);expect(resolveBlastDamage(ev,source,target)).toMatchObject({applied:true,killed:true});expect(resolveBlastDamage({...ev,sourceType:'enemy-melee'},source,target).applied).toBe(false);expect(resolveBlastDamage(ev,{...source,hp:0},target).applied).toBe(false);
 });
 it('混战最多一只重型准备出手，首领战最多一名普通敌人追加攻击',()=>{
  const p={x:1000,y:700},a=body('a','bomber'),b=body('b','boar',1050),spore=body('s','spore',1100);a.attack=createEnemyAttack(a.id,1,a.type,0,a,p);a.targetId='player';
  expect(playerAttackPermitted(b,'player',p,[a,b,spore],1200)).toBe(false);expect(playerAttackPermitted(spore,'player',p,[a,b,spore],1200)).toBe(true);
  const boss={...body('boss','spore',1150),boss:'spore-heart' as const};expect(playerAttackPermitted(spore,'player',p,[a,spore,boss],1200)).toBe(false);
 });
});
describe('祭根与采集事件的正式保存边界',()=>{
 it('祭根受击保持固定脚点，不生成跨重载漂移',()=>{
  const e={...body('root','priest'),passiveRoot:{owner:'event:herb',index:0,attempt:0}};
  reactToEnemyHit(e,100,attackConfig({stage:3} as any),{x:1,y:0},false,true);expect(e.recoil).toBeUndefined();expect([e.x,e.y]).toEqual([900,700]);
 });
 it('已有两片危险区时，多点招式也不能突破全局三片上限',()=>{
  const e={...body('boss','leaf',1250,2820),boss:'bound-branch' as const,bossAttempt:0,bossBattle:{...initialBossBattle(0),move:2,phase:2 as const}};
  e.attack=createBossAttack(e,100,{x:1250,y:2820},e.bossBattle);const h=new BossHazards();h.launch(e,100);expect(h.hazards.length).toBe(3);
  h.hazards.pop();e.attack=createBossAttack(e,200,{x:1250,y:2820},e.bossBattle);h.launch(e,200);expect(h.hazards.length).toBe(3);
 });

 it('祭根伤势深拷贝保存，重载不补血，拆根真实改变保护',()=>{
  const e={...body('boss-spore-heart','spore',1250,2820),boss:'spore-heart' as const,bossAttempt:0,bossBattle:{...initialBossBattle(0),phase:2 as const,roots:[{x:1090,y:2820,hp:36},{x:1410,y:2820,hp:0}]}};
  const saved=captureBossCombat(e,1000,new BossHazards(),new EnemyProjectiles());e.bossBattle.roots[0].hp=0;expect(saved.battle.roots![0].hp).toBe(36);
  const copy={...e,bossBattle:undefined};restoreBossCombat(copy,saved,9000,new BossHazards(),new EnemyProjectiles());expect(copy.bossBattle!.roots![0].hp).toBe(36);
  expect(enemyProtection(copy,undefined,9000).reduction).toBeCloseTo(.35);copy.bossBattle!.roots![0].hp=0;expect(enemyProtection(copy,undefined,9000).reduction).toBe(.15);
  expect(()=>validateCampBoss({stage:'battle',warning:0,attempt:0,away:0,combat:saved},e.id)).not.toThrow();
  saved.battle.roots![0].hp=1000;expect(()=>validateCampBoss({stage:'battle',warning:0,attempt:0,away:0,combat:saved},e.id)).toThrow();
 });
 it('合法追击边缘出现的祭根也可保存，越过统一余量仍拒绝',()=>{
  const e={...body('boss-spore-heart','spore',3250,2820),boss:'spore-heart' as const,bossAttempt:0,bossBattle:{...initialBossBattle(0),phase:2 as const,roots:[{x:3410,y:2820,hp:96}]}};
  const saved=captureBossCombat(e,1000,new BossHazards(),new EnemyProjectiles());expect(()=>validateCampBoss({stage:'battle',warning:0,attempt:0,away:0,combat:saved},e.id)).not.toThrow();
  saved.battle.roots![0].x=3550;expect(()=>validateCampBoss({stage:'battle',warning:0,attempt:0,away:0,combat:saved},e.id)).toThrow();
 });
 it('事件出生点实际可站立，采集封锁只作用于指定南线资源',()=>{
  const s=initialState();for(const d of Object.values(SOUTH_EVENTS))expect(motionBlocked(d.x,d.y),d.name).toBe(false);
  expect(southResourceBlock(s.southEvents,'wild-resource-1')).toBe('herb');expect(southResourceBlock(s.southEvents,'herb-1')).toBeUndefined();s.southEvents.herb=0;expect(southResourceBlock(s.southEvents,'wild-resource-1')).toBeUndefined();
 });
 it('谢礼只在回村后发放一次，满包和保存失败不消费领取资格',async()=>{
  const s=initialState();s.southEvents.herb=0;Object.assign(s.player,{x:560,y:810});const next=southEventRewardSnapshot(s,'herb');expect(next.coins-s.coins).toBe(12);expect(count(next,'potion')).toBe(1);expect(()=>southEventRewardSnapshot(next,'herb')).toThrow();
  const full=structuredClone(s);full.bag=Array(24).fill({id:'wood',count:99});expect(()=>southEventRewardSnapshot(full,'herb')).toThrow();expect(full.southEvents.claimed).toEqual([]);
  const commit=new StateCommit();let current=s;await expect(commit.run(()=>current,v=>southEventRewardSnapshot(v,'herb'),async()=>{throw Error('保存失败');},v=>{current=v;})).rejects.toThrow();expect(current).toBe(s);expect(current.southEvents.claimed).toEqual([]);
 });
 it('历史清剿旧档不会再次封锁资源或重新发放事件奖励',()=>{
  const s:any=initialState();delete s.southEvents;const d=ENCOUNTERS.find(d=>d.id==='south-spore-camp')!,g=s.encounters.groups[d.id];g.activated=true;for(const m of d.members){if(m.boss)g.boss.stage='battle';settleEncounterDeath(s.encounters,m.id,false);}
  expect(validate(s).southEvents).toEqual({herb:0,orchard:0,claimed:['herb','orchard']});
 });
});
