import {afterAll,describe,expect,it,vi} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {CAMP_BOSSES,type CampBossKind} from '../src/data/maps/windbell/campBosses';
import {initialBossBattle} from '../src/game/systems/campBossState';
import {BossHazards,createBossAttack,updateCampBoss} from '../src/game/systems/campBossCombat';
import {advanceEnemyAttack,predictEnemyContact,SPORE} from '../src/game/systems/enemyAttack';
import {EnemyProjectiles} from '../src/game/systems/enemyProjectiles';
import {enemyNavigation,updateEnemy,type EnemyBody} from '../src/game/systems/enemy';

// 固定无障碍样本只隔离地图碰撞；保留正式首领状态机、锁向和伤害几何。
vi.mock('../src/game/systems/obstacles',async original=>({...await original<object>(),motionBlocked:()=>false,clearMotionLine:()=>true,clearMeleeLine:()=>true}));
const samples:object[]=[],stage=process.env.BOSS_ACCURACY_STAGE??'after',root='docs/camp-bosses/evidence/accuracy';
afterAll(()=>{mkdirSync(root,{recursive:true});writeFileSync(`${root}/${stage}.json`,JSON.stringify({说明:'固定无障碍逻辑样本；玩家位置始终不变，读取正式起手、移动、弹丸和接触结果。修复前后使用同一断言，不以命中弹道上的人工目标替代瞄准目标。',样本:samples},null,2));});
function body(kind:CampBossKind):EnemyBody{return {id:'boss-'+kind,type:CAMP_BOSSES[kind].type,boss:kind,bossAttempt:0,bossBattle:initialBossBattle(0),hp:CAMP_BOSSES[kind].hp,x:0,y:0,homeX:0,homeY:0,leashRadius:1000,cool:0,windup:0,staggerUntil:0,nav:enemyNavigation(),ai:'首领',disabled:false,recovered:false,face:{x:1,y:0}};}
const tooFar:readonly [CampBossKind,number,number][]=[['spore-heart',2,130],['spore-heart',3,300],['thorn-crown',0,300],['thorn-crown',1,280],['thorn-crown',3,300],['crag-tusk',3,300]];
describe('静止玩家与首领真实起手距离',()=>{
 it.each(tooFar)('%s 技能%d：距离%d超出实际几何时应先接近', (kind,move,distance)=>{
  const e=body(kind),target={x:distance,y:0};Object.assign(e.bossBattle!,{move,nextAt:0});
  const result=updateCampBoss(e,target,1000,20,'player',true),a=e.attack;
  const contact=a?advanceEnemyAttack(a,{x:0,y:0},target,a.activeUntil,{blocked:()=>false,clear:()=>true,melee:()=>true}):null;
  samples.push({首领:CAMP_BOSSES[kind].name,技能:CAMP_BOSSES[kind].skills[move],目标距离:distance,是否提前出招:!!a,应先接近:result===undefined,身体接触:contact?.at??null,攻击:a});
  expect(result).toBeUndefined();expect(e.attack).toBeFalsy();expect(e.attackSerial).toBeUndefined();
 });
 it.each(['spore-heart','bound-branch'] as const)('%s 第一轮齐射真实威胁锁向的静止玩家并保留通行缺口',kind=>{
  const e=body(kind),target={x:280,y:0},move=kind==='spore-heart'?0:1,a=createBossAttack(e,1000,target,{...e.bossBattle!,move}),shots=new EnemyProjectiles();
  advanceEnemyAttack(a,e,target,a.lockAt);advanceEnemyAttack(a,e,target,a.contactAt);shots.launch(a,e,a.contactAt);
  const contacts=shots.update(a.contactAt+SPORE.life,target,()=>true);
  samples.push({首领:CAMP_BOSSES[kind].name,技能:CAMP_BOSSES[kind].skills[move],目标距离:280,弹道:a.bossShotAngles,真实接触:contacts.map(c=>({身份:c.attack.attackId,时刻:c.at}))});
  expect(contacts).toHaveLength(1);expect(a.bossShotAngles!.some(v=>v===0)).toBe(true);expect(a.bossShotAngles!.some((v,i,all)=>i>0&&v-all[i-1]>.3)).toBe(true);
 });
 it.each(['spore-heart','bound-branch'] as const)('%s 贴近喷口不会落入人工弹丸盲区',kind=>{
  const e=body(kind),target={x:8,y:0},a=createBossAttack(e,1000,target,{...e.bossBattle!,move:kind==='spore-heart'?0:1}),shots=new EnemyProjectiles();advanceEnemyAttack(a,e,target,a.lockAt);shots.launch(a,e,a.contactAt);
  const contacts=shots.update(a.contactAt+SPORE.life,target,()=>true);samples.push({首领:CAMP_BOSSES[kind].name,目标距离:8,近身真实接触:contacts.length});expect(contacts.length).toBeGreaterThan(0);
 });
});
const damaging=Object.keys(CAMP_BOSSES).flatMap(kind=>[1,2].flatMap(phase=>[0,1,2,3].filter(move=>!(kind==='thorn-crown'&&move===2||kind==='bound-branch'&&(move===2||move===3))).map(move=>[kind,phase,move] as [CampBossKind,1|2,number])));
describe('远处站桩、正式接近和两个阶段的技能接触',()=>{
 it.each(damaging)('%s 第%d阶段技能%d应从远处接近后真实命中静止目标', (kind,phase,move)=>{
  const e=body(kind),target={x:330,y:0},shots=new EnemyProjectiles(),hazards=new BossHazards();Object.assign(e.bossBattle!,{phase,move,nextAt:0});if(phase===2)e.hp=CAMP_BOSSES[kind].hp/2;
  let first:any,contact:any;
  for(let now=0;now<=15000;now+=10){const bodyContact=updateEnemy(e,target,now,10,undefined,'player',()=>true);if(e.attack){first??={时刻:now,距离:Math.hypot(e.x-target.x,e.y-target.y),半径:e.attack.bossGeometry!.radius,移动:e.attack.step};shots.launch(e.attack,e,now);hazards.launch(e,now);}
   contact=bodyContact??shots.update(now,target,()=>true)[0]??hazards.update(now-10,now,[e],[{...target,id:'player',previous:target}])[0];
   if(contact)break;
  }
  samples.push({首领:CAMP_BOSSES[kind].name,阶段:phase,技能:CAMP_BOSSES[kind].skills[move],静止目标:target,首次起手:first,真实接触:contact?.at??null,命中技能:contact?.attack.bossSkill});
  expect(contact).toBeTruthy();expect(contact.attack.bossSkill).toBe(move);expect(contact.attack.parryable).toBe(!contact.bossHazardId);
 });
 it('甩尾前方和护心结茧不伪造伤害；甩尾真正威胁身后目标',()=>{
  for(const behind of [false,true]){const e=body('thorn-crown'),target={x:behind?-130:130,y:0},a=createBossAttack(e,0,target,{...e.bossBattle!,move:2});const event=advanceEnemyAttack(a,e,target,a.activeUntil,{blocked:()=>false,clear:()=>true,melee:()=>true});expect(!!event).toBe(behind);}
  const e=body('bound-branch'),target={x:100,y:0},a=createBossAttack(e,0,target,{...e.bossBattle!,move:3});expect(advanceEnemyAttack(a,e,target,a.activeUntil)).toBe(null);expect(a.bossCocoon).toBe(true);
 });
 it.each(['spore-heart','bound-branch'] as const)('%s 喷口、预测与飞行接触保持一致，锁向后移动可真实躲避',kind=>{
  for(const distance of [0,8,70,280,330]){const e=body(kind),target={x:distance,y:0},a=createBossAttack(e,0,target,{...e.bossBattle!,move:kind==='spore-heart'?0:1}),shots=new EnemyProjectiles();advanceEnemyAttack(a,e,target,a.lockAt);const predicted=predictEnemyContact(a,e,target,a.lockAt,{blocked:()=>false,clear:()=>true,melee:()=>true});advanceEnemyAttack(a,e,target,a.contactAt);shots.launch(a,e,a.contactAt);const events=shots.update(a.contactAt+SPORE.life,target,()=>true);expect(events.length).toBeGreaterThan(0);expect(Math.min(...events.map(c=>c.at))).toBeCloseTo(predicted!,4);}
  const e=body(kind),target={x:280,y:0},a=createBossAttack(e,0,target,{...e.bossBattle!,move:kind==='spore-heart'?0:1}),shots=new EnemyProjectiles();advanceEnemyAttack(a,e,target,a.lockAt);advanceEnemyAttack(a,e,{x:0,y:-280},a.contactAt);expect(a.direction).toEqual({x:1,y:0});shots.launch(a,e,a.contactAt);expect(shots.update(a.contactAt+SPORE.life,{x:0,y:-280},()=>true)).toHaveLength(0);
 });
});
