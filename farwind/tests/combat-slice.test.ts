import {describe,it,expect} from 'vitest';
import {CombatController,attackConfig,attackVector,inStrike,resolveStrike,type Attack} from '../src/game/systems/combat';
import {CombatTimeline} from '../src/game/systems/timeline';
import {CombatFeedback,type FeedbackMode} from '../src/game/systems/combatFeedback';
import {combatVisual} from '../src/data/animation';
import {sampleAttackTiming} from '../src/game/systems/attackTiming';
import {createEnemyAttack,advanceEnemyAttack,sampleEnemyAttack} from '../src/game/systems/enemyAttack';
import {EnemyProjectiles} from '../src/game/systems/enemyProjectiles';
import {adjudicateContact} from '../src/game/systems/contact';
import {SwordWindSystem} from '../src/game/systems/swordWind';
import type {InputEvent} from '../src/game/systems/input';
const space={blocked:()=>false,clear:()=>true,melee:()=>true};
const strike=(c:CombatController,p:{x:number;y:number},from:number,to:number,hit:()=>void=()=>{})=>c.update(from,to,3,p,[{id:'目标',x:55,y:55,hp:1000}],space.blocked,space.melee,hit,()=>{});

describe('战斗切片：连续瞄准与唯一阶段',()=>{
 it('斜向锁定独立于四向显示，移动意图和显示变化不改写当前攻击',()=>{
  const c=new CombatController(),p={x:0,y:0};c.setIntent({x:1,y:1});c.requestAttack(0);strike(c,p,0,0);
  const a=c.attack!;expect(a.facing).toBe(0);expect(a.aim!.x).toBeCloseTo(Math.SQRT1_2);expect(a.aim!.y).toBeCloseTo(Math.SQRT1_2);expect(Object.isFrozen(a.aim)).toBe(true);
  c.setIntent({x:-1,y:0});a.facing=1;
  expect(inStrike(p,{id:'斜前方',x:65,y:65,hp:100},a,space.melee)).toBe(true);
  expect(inStrike(p,{id:'正后方',x:-60,y:-60,hp:100},a,space.melee)).toBe(false);
  strike(c,p,0,190);expect(p.x).toBeCloseTo(p.y);expect(p.x).toBeGreaterThan(0);expect(attackVector(a)[0]).toBeCloseTo(Math.SQRT1_2);expect(attackVector(a)[1]).toBeCloseTo(Math.SQRT1_2);
 });
 it('缓冲连段在新一段起手重新采样，取消不重放旧输入或旧命中',()=>{
  const c=new CombatController(),p={x:0,y:0,stamina:100};let hits=0;
  c.setIntent({x:1,y:1});c.requestAttack(0);strike(c,p,0,0);c.requestAttack(20);c.requestAttack(21);
  c.setIntent({x:-1,y:0});strike(c,p,0,235,()=>hits++);expect(hits).toBe(1);expect(c.serial).toBe(2);expect(c.attack?.aim).toEqual({x:-1,y:0});expect(c.attack?.facing).toBe(2);
  c.requestParry(240,2);expect(c.flushActions(240,p)).toEqual(['parry']);strike(c,p,235,700,()=>hits++);
  expect(c.attack).toBeNull();expect(c.pending).toBe(false);expect(hits).toBe(1);expect(p.stamina).toBe(88);
 });
 for(const stage of [1,2,3,4])it(`第${stage}段近战判定和动画在边界一致，不释放剑风`,()=>{
  const m=resolveStrike(stage),c=new CombatController(),p={x:0,y:0};const a:Attack={id:1,stage,start:10,facing:3,aim:{x:Math.SQRT1_2,y:Math.SQRT1_2},hit:new Set(),config:m};c.attack=a;
  for(const t of [10,10+m.windup-.001,10+m.windup,10+m.windup+m.active-.001,10+m.windup+m.active]){
   expect(c.phase(t)).toBe(combatVisual(stage,a.facing,t-a.start,false,m).phase);
   expect(c.phase(t)).toBe(sampleAttackTiming(t,10,m.windup,m.active,m.recovery).phase);
  }
  let hits=0,releases=0;c.update(10,10+m.windup,3,p,[{id:'目标',x:55,y:55,hp:100}],space.blocked,space.melee,()=>hits++,()=>{},()=>{},space.clear,()=>releases++);
  c.update(10+m.windup,1000,3,p,[{id:'目标',x:55,y:55,hp:100}],space.blocked,space.melee,()=>hits++,()=>{},()=>{},space.clear,()=>releases++);
  expect(hits).toBe(1);expect(releases).toBe(0);
 });
 it('剑风出生、飞行和近战共用锁定向量，显示转向不改变路线',()=>{
  const a:Attack={id:1,stage:1,kind:"swordWind",delivery:"wind",start:0,facing:1,aim:{x:Math.SQRT1_2,y:Math.SQRT1_2},hit:new Set()};
  const system=new SwordWindSystem(),w=system.launch(a,{x:0,y:0},110,18)!;
  expect(w.direction).toEqual(a.aim);expect(w.position.x).toBeCloseTo(w.position.y);expect(system.launch(a,{x:0,y:0},111,18)).toBeNull();
 });
});

describe('战斗切片：敌人锁向、接触和远程释放',()=>{
 for(const type of ['leaf','boar','spore'] as const)it(`${type}不同更新步长的首次接触与位移一致`,()=>{
  const run=(step:number)=>{const root={x:0,y:0},target={x:type==='spore'?200:60,y:0},a=createEnemyAttack('敌人',1,type,0,root,target),shots=new EnemyProjectiles();let at:number|null=null;
   // 锁向边界属于正式时间轴事件，不能被任意外层帧跳过。
   const times=new Set([a.lockAt,a.contactAt,a.activeUntil,a.recoveryUntil+1700]);
   for(let t=0;t<a.recoveryUntil+1700;t+=step)times.add(t);
   for(const t of [...times].sort((a,b)=>a-b)){const contact=advanceEnemyAttack(a,root,target,t,space);shots.launch(a,root,t);
    const events=[...(contact?[contact]:[]),...shots.update(t,target,space.melee)];for(const e of events){expect(at).toBeNull();at=e.at;e.attack.resolved=true;if(e.projectileId)shots.settle(e.projectileId,t,false);}}
   return {at,x:root.x,y:root.y};};
  const baseline=run(5);expect(baseline.at).not.toBeNull();
  for(const step of [16,25,40,50,150]){const actual=run(step);expect(actual.at!).toBeCloseTo(baseline.at!,4);expect(actual.x).toBeCloseTo(baseline.x,4);expect(actual.y).toBeCloseTo(baseline.y,4);}
 });
 for(const type of ['leaf','boar','spore'] as const)it(`${type}锁向后侧移允许躲开；原路线命中只结算一次`,()=>{
  for(const dodge of [false,true]){
   const root={x:0,y:0},p={x:type==='spore'?200:60,y:0,stamina:100},c=new CombatController(),shots=new EnemyProjectiles();
   const a=createEnemyAttack('敌人',1,type,0,root,p);advanceEnemyAttack(a,root,p,a.lockAt,space);const direction={...a.direction};
   if(dodge)p.y=220;
   let contacts=0;
   for(let t=a.lockAt+5;t<=a.recoveryUntil+1700;t+=5){
    const contact=advanceEnemyAttack(a,root,p,t,space);shots.launch(a,root,t);
    const events=[...(contact?[contact]:[]),...shots.update(t,p,space.melee)];
    for(const event of events){expect(adjudicateContact(event,c,p,{valid:true,immune:false,clear:space.melee})).toBe('hurt');contacts++;
     expect(adjudicateContact(event,c,p,{valid:true,immune:false,clear:space.melee})).toBe('invalid');if(event.projectileId)shots.settle(event.projectileId,t,false);}
   }
   expect(a.direction).toEqual(direction);expect(contacts).toBe(dodge?0:1);
   const sample=sampleEnemyAttack(a,a.contactAt,root);expect(sample.stage).toBe('active');expect(sample.active).toBe(true);
  }
 });
});

function timelineRun(step:number,mode:FeedbackMode){
 const c=new CombatController(),timeline=new CombatTimeline(),feedback=new CombatFeedback(),p={x:0,y:0,stamina:100},target={id:'目标',x:55,y:55,hp:1000};feedback.mode=mode;
 const events:InputEvent[]=[{kind:'attack',at:0,sequence:1,axis:{x:1,y:1}},{kind:'attack',at:80,sequence:2,axis:{x:1,y:1}},{kind:'attack',at:90,sequence:3,axis:{x:1,y:1}},{kind:'dash',at:430,sequence:4,axis:{x:-1,y:0}},{kind:'parry',at:800,sequence:5,axis:{x:1,y:0}}];
 const hits:string[]=[];let sim=0,wall=0;timeline.reset(0);
 while(wall<1600-1e-7){const next=Math.min(1600,wall+step);sim=timeline.frame(sim,next,next-wall,events.filter(e=>e.at>=wall&&(e.at<next||next===1600)),c,{
  boundary:now=>c.nextBoundary(now),input:(batch,now)=>{for(const e of batch)c.setIntent(e.axis);c.requestActions(batch.filter(e=>e.kind!=='axis') as any,now,p,3);},
  resolve:now=>{c.flushActions(now,p);c.update(now,now,3,p,[target],space.blocked,space.melee,hit,()=>{});feedback.advance(now);feedback.drain();},
  advance:(prev,now)=>c.update(prev,now,3,p,[target],space.blocked,space.melee,hit,()=>{}),
 });wall=next;}
 function hit(_target:typeof target,stage:number,a:Attack){const m=attackConfig(a),at=a.start+m.windup;target.hp-=m.damage;hits.push(`${a.id}:${target.id}`);c.stopOnHit(stage,a.id);
  feedback.emit({id:`命中:${a.id}:${target.id}`,kind:'hit',at,targetId:target.id,attackId:String(a.id),point:{...target},incoming:{x:1,y:0},blade:{x:0,y:1},deflect:{x:0,y:1},quality:'normal',material:'leaf',damage:m.damage,stage});}
 return {hp:target.hp,stamina:p.stamina,x:p.x,y:p.y,serial:c.serial,hits,actions:c.actionHistory.filter(e=>e.executed!==undefined).map(e=>({kind:e.kind,at:e.at,executed:e.executed})),events:feedback.history.map(e=>e.kind)};
}
describe('战斗切片：不同步长与关闭表现的一致性',()=>{
 for(const step of [5,16,25,40,50])for(const mode of ['A','D'] as const)it(`${step}毫秒更新、反馈${mode}不改变结算与取消`,()=>{
  const expected=timelineRun(5,'D'),actual=timelineRun(step,mode);
  expect(actual.hp).toBe(expected.hp);expect(actual.stamina).toBe(expected.stamina);expect(actual.serial).toBe(2);expect(actual.hits).toEqual(expected.hits);expect(new Set(actual.hits).size).toBe(actual.hits.length);
  expect(actual.x).toBeCloseTo(expected.x,6);expect(actual.y).toBeCloseTo(expected.y,6);expect(actual.events).toEqual(expected.events);
  expect(actual.actions.map(e=>e.kind)).toEqual(['attack','attack','dash','parry']);
  for(let i=0;i<actual.actions.length;i++)expect(actual.actions[i].executed).toBeCloseTo(expected.actions[i].executed!,6);
 });
});
