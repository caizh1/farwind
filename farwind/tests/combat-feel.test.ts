import {describe,it,expect,vi} from 'vitest';
import {CombatController,attackConfig,COMBAT,STRIKES,resolveStrike,strikeDuration,type Attack} from '../src/game/systems/combat';
import {CombatTimeline} from '../src/game/systems/timeline';
import {SaveQueue} from '../src/game/systems/saveQueue';
import {initialState} from '../src/game/systems/state';
import {StateCommit} from '../src/game/systems/stateCommit';
import {enemyNavigation,updateEnemy,type EnemyBody} from '../src/game/systems/enemy';
import {reactToEnemyHit,advanceEnemyRecoil,ENEMY_REACTION} from '../src/game/systems/enemyReaction';
import {enemyProtection,GUARDIAN} from '../src/game/systems/enemyTraits';
import {CombatFeedback,hitFeedbackKind,type FeedbackEvent} from '../src/game/systems/combatFeedback';
import {createEnemyAttack} from '../src/game/systems/enemyAttack';
import {EnemyAnimation} from '../src/game/systems/enemyAnimation';
import {playerAttackPermitted} from '../src/game/systems/encounterTempo';
import {resolveDamage} from '../src/game/systems/damage';
import {synthFeedback} from '../src/game/systems/feedbackAudio';

const body=(id='a',type='slime'):EnemyBody=>({id,type,x:3300,y:1500,hp:100,homeX:3300,homeY:1500,cool:0,windup:0,staggerUntil:0,nav:enemyNavigation(),ai:'家园',disabled:false,recovered:false,targetId:'player'});

const attack=(stage:number,start=0):Attack=>({id:stage,stage,start,facing:3,hit:new Set(),config:resolveStrike(stage)});
function arena(){
 const c=new CombatController(),p={x:0,y:0,stamina:100},starts:Attack[]=[];
 const tick=(prev:number,now:number)=>{c.flushActions(now,p);c.update(prev,now,3,p,[],()=>false,()=>true,()=>{},(_,a)=>starts.push(a));};
 return {c,p,starts,tick};
}
describe('输入衔接的有限预约与承诺',()=>{
 for(const delta of [5,16.667,33.333,50])it(`风步尾部攻击在合法边界执行且不重复，步长${delta}`,()=>{
  const a=arena();a.c.requestDash(0,100,{x:1,y:0},3);a.c.requestAttack(60);
  for(let t=0;t<300;t+=delta)a.tick(t,Math.min(300,t+delta));
  expect(a.starts).toHaveLength(1);expect(a.starts[0].start).toBe(200);expect(a.p.stamina).toBe(100);
 });
 it('风步早按明确拒绝，尾部缓冲按一次只发动一次',()=>{
  const a=arena();a.c.requestDash(0,100,{x:1,y:0},3);a.c.requestAttack(59);expect(a.c.pending).toBe(false);
  a.c.requestAttack(61);a.c.requestAttack(62);a.tick(0,200);a.tick(200,700);expect(a.starts).toHaveLength(1);
 });
 it('诊断明确区分重复预约和暂停清理，不改变执行语义',()=>{
  const a=arena();a.c.requestDash(0,100,{x:1,y:0},3);a.c.requestAttack(70);a.c.requestAttack(80);expect(a.c.lastRejection).toBe('已有同实例预约');
  a.c.clearInputs('暂停',90);expect(a.c.actionHistory.at(-1)).toMatchObject({kind:'attack',at:70,legal:200,cleared:90,reason:'已清理：暂停'});a.tick(90,500);expect(a.starts).toEqual([]);
 });
 for(const stage of [1,2,3,4])it(`第${stage}段风步合法边界前后，缓冲只在收招扣体力`,()=>{
  const a=arena();a.c.swordWindEnabled=true;a.c.attack=attack(stage);const legal=a.c.dashLegalAt(0);
  a.c.requestActions([{kind:'dash',at:legal-100,sequence:1,axis:{x:0,y:1}}],legal-100,a.p,3);
  expect(a.c.flushActions(legal-1,a.p)).toEqual([]);expect(a.p.stamina).toBe(100);
  expect(a.c.flushActions(legal,a.p)).toEqual(['dash']);expect(a.p.stamina).toBe(80);
  expect(a.c.flushActions(legal+1,a.p)).toEqual([]);expect(a.c.attack).toBeNull();
 });
 it('缓冲过期不复活，不足体力不扣费，多动作拒绝不执行低优先级',()=>{
  const a=arena();a.c.attack=attack(3);a.c.requestActions([{kind:'dash',at:0,sequence:1,axis:{x:1,y:0}}],0,a.p,3);
  a.c.flushActions(151,a.p);a.tick(151,600);expect(a.c.dashStart).toBe(-1);expect(a.p.stamina).toBe(100);
  a.p.stamina=0;a.c.requestActions(['attack','parry','dash'].map((kind,sequence)=>({kind:kind as any,at:600,sequence,axis:{x:1,y:0}})),600,a.p,3);
  a.tick(600,800);expect(a.starts).toEqual([]);expect(a.p.stamina).toBe(0);
 });
 it('新按弹反替换尚未消费的旧风步，不发生旧动作抢占',()=>{
  const a=arena();a.p.stamina=10;a.c.requestActions([{kind:'dash',at:0,sequence:1,axis:{x:1,y:0}}],0,a.p,3);a.c.flushActions(0,a.p);
  a.p.stamina=100;a.c.requestParry(1,3);expect(a.c.flushActions(1,a.p)).toEqual(['parry']);expect(a.p.stamina).toBe(88);expect(a.c.dashStart).toBe(-1);
 });
 for(const cleanup of ['clearInputs','hurt','reset'] as const)it(`${cleanup}清除跨动作输入`,()=>{
  const a=arena();a.c.requestDash(0,100,{x:1,y:0},3);a.c.requestAttack(70);a.c[cleanup]();a.tick(70,500);expect(a.starts).toEqual([]);
 });
 it('第三段只开放最后110毫秒，轻击保留接触阶段承诺',()=>{
  const a=arena();a.c.attack=attack(3);expect(a.c.dashLegalAt(0)).toBe(400);
  expect(a.c.requestDash(399,100,{x:1,y:0},3)).toBe(false);expect(a.c.requestDash(400,100,{x:1,y:0},3)).toBe(true);
  a.c.reset();a.c.attack=attack(1);expect(a.c.requestDash(STRIKES[0].windup+STRIKES[0].active-1,100,{x:1,y:0},3)).toBe(false);
 });
 it('轻击弹反合法点消耗一次，成功反斩或撤离不重复退款',()=>{
  const a=arena();a.c.attack=attack(1);a.c.requestParry(160,3);expect(a.c.flushActions(189,a.p)).toEqual([]);
  expect(a.c.flushActions(190,a.p)).toEqual(['parry']);expect(a.p.stamina).toBe(88);
  expect(a.c.succeedParry(200,'normal',a.p,'e')).toBe(true);expect(a.c.succeedParry(201,'normal',a.p,'e')).toBe(false);expect(a.p.stamina).toBe(100);
  a.c.requestActions([{kind:'dash',at:250,sequence:1,axis:{x:1,y:0}}],250,a.p,3);a.tick(250,260);a.tick(260,700);
  expect(a.starts).toEqual([]);expect(a.p.stamina).toBe(80);
 });
 it('独立剑风合法发射后取消，已释放实例只发送一次且旧预约清理',()=>{
  const a=arena();a.c.swordWindEnabled=true;a.c.attack={...attack(4),kind:'swordWind',delivery:'wind',stage:1,config:{...resolveStrike(1),windup:110,active:100,recovery:190}};const releases:number[]=[];
  const m=attackConfig(a.c.attack);a.c.update(0,m.windup,3,a.p,[],()=>false,()=>true,()=>{},()=>{},()=>{},()=>true,x=>releases.push(x.id));
  expect(a.c.requestDash(a.c.dashLegalAt(m.windup),100,{x:1,y:0},3)).toBe(true);
  a.c.update(m.windup,strikeDuration(m)+200,3,a.p,[],()=>false,()=>true,()=>{},()=>{},()=>{},()=>true,x=>releases.push(x.id));
  expect(releases).toEqual([4]);expect(a.c.pending).toBe(false);
 });
 it('不规则墙钟帧保留输入次序与合法等待，同一请求不多帧延迟',()=>{
  const a=arena(),timeline=new CombatTimeline();let sim=0,wall=0;timeline.reset(0);a.c.requestDash(0,100,{x:1,y:0},3);
  for(const dt of [17,31,12,49,8,33,20,50,16,41]){
   const next=wall+dt,events=wall<100&&next>=100?[{kind:'attack' as const,at:100,sequence:1,axis:{x:1,y:0}}]:[];
   sim=timeline.frame(sim,next,dt,events,a.c,{boundary:n=>a.c.nextBoundary(n),advance:(p,n)=>a.tick(p,n),input:(_,n)=>a.c.requestAttack(n),resolve:n=>a.tick(n,n)});wall=next;
  }
  expect(a.starts).toHaveLength(1);expect(a.starts[0].start).toBe(200);
 });
});

describe('正式结算后的反应与有界反馈',()=>{
 it('普通受创延后而不取消，原来招仍可读；真正打断取消未释放攻击',()=>{
  const e=body('guard','guardian'),animation=new EnemyAnimation();e.attack=createEnemyAttack(e.id,1,e.type,0,e,{x:3350,y:1500});animation.sample(e,e.attack,20);
  e.hp-=18;const soft=reactToEnemyHit(e,30,resolveStrike(1),{x:1,y:0},false,false);
  expect(soft.interrupted).toBe(false);expect(e.attack.cancelled).toBe(false);expect(animation.sample(e,e.attack,30).action).toBe('attack');
  const hard=reactToEnemyHit(e,40,resolveStrike(3),{x:1,y:0},false,true);expect(hard.interrupted).toBe(true);expect(e.attack.cancelled).toBe(true);
 });
 it('弱史莱姆未释放扑击可被轻击压制，已进入接触期仍保留承诺',()=>{
  const e=body();e.attack=createEnemyAttack(e.id,1,e.type,0,e,{x:3350,y:1500});
  expect(reactToEnemyHit(e,100,resolveStrike(1),{x:1,y:0},false,false).interrupted).toBe(true);expect(e.cool).toBe(340);
  e.attack=createEnemyAttack(e.id,2,e.type,0,e,{x:3350,y:1500});
  expect(reactToEnemyHit(e,e.attack.contactAt,resolveStrike(1),{x:1,y:0},false,false).interrupted).toBe(false);
 });
 it('已独立发射的孢子不被普通受创或重击撤销，击杀仍唯一',()=>{
  const e=body('spore','spore');e.attack=createEnemyAttack(e.id,1,e.type,0,e,{x:3350,y:1500});e.attack.launched=true;
  expect(reactToEnemyHit(e,600,resolveStrike(3),{x:1,y:0},false,true).interrupted).toBe(false);
  const event={sourceId:'player',targetId:e.id,attackId:'刀',amount:200,sourceType:'player-melee' as const,eventId:null},source={id:'player',faction:'village' as const,hp:100,armor:0};
  const first=resolveDamage(event,source,{id:e.id,faction:'hostile',hp:e.hp,armor:0});e.hp=first.hp;
  const second=resolveDamage({...event,sourceId:'guard'}, {...source,id:'guard'},{id:e.id,faction:'hostile',hp:e.hp,armor:0});expect(first.killed).toBe(true);expect(second.applied).toBe(false);
 });
 it('守卫正面减伤、第三段破防窗口真实且不被持续刷新',()=>{
  const e=body('guard','guardian');e.face={x:-1,y:0};const origin={x:3250,y:1500};
  expect(enemyProtection(e,origin,10).reduction).toBe(.65);enemyProtection(e,origin,20,true);reactToEnemyHit(e,20,resolveStrike(3),{x:1,y:0},false,true,true);
  expect(e.staggerUntil).toBe(1220);enemyProtection(e,origin,400,true);expect(e.guardOpenUntil).toBe(1220);expect(enemyProtection(e,origin,1221).reduction).toBe(.65);
 });
 it('击退有过程、受真实碰撞约束；连续重启限幅，不漂移或无限移动',()=>{
  const e=body();reactToEnemyHit(e,0,resolveStrike(3),{x:1,y:0},false,true);expect(e.x).toBe(3300);
  advanceEnemyRecoil(e,30,x=>x>3310,()=>true);expect(e.x).toBeGreaterThan(3300);expect(e.x).toBeLessThanOrEqual(3310);
  for(let t=35;t<200;t+=5){reactToEnemyHit(e,t,resolveStrike(3),{x:1,y:0},false,true);expect(Math.hypot(e.recoil!.vector.x,e.recoil!.vector.y)).toBeLessThanOrEqual(ENEMY_REACTION.maxDisplacement);advanceEnemyRecoil(e,t+5,x=>x>3310,()=>true);}
  advanceEnemyRecoil(e,1000,x=>x>3310,()=>true);expect(e.recoil).toBeUndefined();const x=e.x;advanceEnemyRecoil(e,2000);expect(e.x).toBe(x);
 });
 it('多目标同攻击只有一次停顿请求，后来的目标不续满',()=>{
  const c=new CombatController();expect(c.stopOnHit(1,10)).toBe(true);c.advanceFrame(20);expect(c.stopOnHit(1,10)).toBe(false);expect(c.hitStopRemaining).toBe(16);expect(c.stopOnHit(3,11)).toBe(true);expect(c.hitStopRemaining).toBe(58);
 });
 for(const kind of ['hit','protected-hit','guard-break','interrupt','kill'] as const)it(`${kind}效果唯一、冻结快照、目标删除后有限结束，不改变生命`,()=>{
  const f=new CombatFeedback(),e=body(),event:FeedbackEvent={id:'同一次接触',kind,at:10,targetId:e.id,attackId:'一刀',point:{x:1,y:2},incoming:{x:1,y:0},blade:{x:0,y:1},deflect:{x:1,y:0},quality:'normal',material:kind==='protected-hit'?'armor':'slime',damage:18,killed:kind==='kill'};
  f.emit(event);f.emit(event);expect(f.effects).toHaveLength(1);expect(f.history[0].point).not.toBe(event.point);f.advance(1000);expect(f.effects).toEqual([]);expect(e.hp).toBe(100);
  const pcm=synthFeedback(kind,event.material);expect(Math.max(...pcm.map(Math.abs))).toBeGreaterThan(.02);expect(pcm[0]).toBe(0);
 });
 it('结果语义重击不等于击杀，音色区别不是再扣一次血',()=>{
  expect(hitFeedbackKind({killed:false,guarded:false,interrupted:false,guardBroken:false})).toBe('hit');
  expect(hitFeedbackKind({killed:true,guarded:true,interrupted:true,guardBroken:true})).toBe('kill');
  expect(Array.from(synthFeedback('hit'))).not.toEqual(Array.from(synthFeedback('kill')));
 });
});

describe('近场威胁协调的作用域与释放',()=>{
 it('零时长裁决边界也使用出手许可，不绕过相邻正式实例',()=>{
  const a=body('a'),b=body('b'),p={x:3340,y:1500};a.attack=createEnemyAttack(a.id,1,a.type,0,a,p);
  updateEnemy(b,p,20,0,{queries:2},'player',(e,id)=>playerAttackPermitted(e,id,p,[a,b],20));expect(b.attack).toBeUndefined();
  updateEnemy(b,p,20,0,{queries:2},'player',()=>true);expect(b.attack?.attackId).toBe('b:1');
 });
 for(const release of ['cancel','death','recovery','target','far'])it(`${release}立即释放近场许可，无持久锁`,()=>{
  const a=body('a'),b=body('b'),p={x:3340,y:1500};a.attack=createEnemyAttack(a.id,1,a.type,0,a,p);expect(playerAttackPermitted(b,'player',p,[a,b],20)).toBe(false);
  let now=20;if(release==='cancel')a.attack.cancelled=true;if(release==='death')a.hp=0;if(release==='recovery')now=a.attack.activeUntil;if(release==='target')a.targetId='guard';if(release==='far')a.x=5000;
  expect(playerAttackPermitted(b,'player',p,[a,b],now)).toBe(true);
 });
 it('一个远程和一个近战共存，远处驻防和小宝目标不受全局名额限制',()=>{
  const a=body('a'),b=body('b','spore'),p={x:3340,y:1500};a.attack=createEnemyAttack(a.id,1,a.type,0,a,p);
  expect(playerAttackPermitted(b,'player',p,[a,b],20)).toBe(true);expect(playerAttackPermitted(body('c'),'guard',p,[a],20)).toBe(true);expect(playerAttackPermitted(body('d'),'xiaobao',p,[a],20)).toBe(true);
  const far=body('far');far.x=5000;expect(playerAttackPermitted(far,'player',p,[a],20)).toBe(true);
 });
 it('屏外新来招受启动限制，已承诺来招由正式实例继续，不被协调撤销',()=>{
  const e=body(),p={x:3300,y:1600};expect(playerAttackPermitted(e,'player',p,[],0,{left:0,right:100,top:0,bottom:100})).toBe(false);
  e.attack=createEnemyAttack(e.id,1,e.type,0,e,{x:3350,y:1500});const id=e.attack.attackId;updateEnemy(e,{x:3350,y:1500},100,20,{queries:2},'player',()=>false);expect(e.attack?.attackId).toBe(id);expect(e.attack?.cancelled).toBe(false);
 });
});

describe('战斗快照与事务共用串行写入',()=>{
 it('旧写入完成时，尚未请求下一次快照的新变化仍保持未保存',async()=>{
  let release!:()=>void;const q=new SaveQueue(async()=>{await new Promise<void>(ok=>release=ok);}),s=initialState();
  const first=q.enqueue(s,true);s.player.hp=70;q.markDirty();release();await first;
  expect(q.snapshot().dirty).toBe(true);expect(q.snapshot().current).toBeGreaterThan(q.snapshot().persisted);
  const next=q.enqueue(s,true);release();await next;expect(q.snapshot().dirty).toBe(false);
 });
 it('快照独立，旧完成不能清除新dirty，失败保留最后有效副本',async()=>{
  let release!:()=>void,disk=initialState();const q=new SaveQueue(async s=>{await new Promise<void>(ok=>release=ok);disk=s;});
  const live=initialState(),first=q.enqueue(live,true);live.player.hp=70;const last=q.enqueue(live,true);live.player.hp=60;
  release();await first;expect(disk.player.hp).toBe(100);expect(q.snapshot().dirty).toBe(true);release();await last;
  expect(disk.player.hp).toBe(70);expect(live.player.hp).toBe(60);expect(q.snapshot().dirty).toBe(false);
  const bad=new SaveQueue(async()=>{throw Error('写入失败');});await expect(bad.enqueue(live)).rejects.toThrow('写入失败');expect(disk.player.hp).toBe(70);expect(bad.snapshot().dirty).toBe(true);
 });
 it('合并未启动快照，合并调用者不提前成功；关键请求保留独立确认与顺序',async()=>{
  const callbacks:(()=>void)[]=[],written:number[]=[];const q=new SaveQueue(async s=>{written.push(s.coins);await new Promise<void>(ok=>callbacks.push(ok));});
  const s=initialState(),a=q.enqueue(s,true);s.coins=121;const b=q.enqueue(s,true);s.coins=122;const c=q.enqueue(s,true);expect(c).toBe(b);
  const done=vi.fn();void b.then(done);s.coins=123;const critical=q.enqueue(s);s.coins=124;const d=q.enqueue(s,true);
  callbacks.shift()!();await a;expect(done).not.toHaveBeenCalled();callbacks.shift()!();await c;expect(done).toHaveBeenCalledTimes(1);
  callbacks.shift()!();await critical;callbacks.shift()!();await d;expect(written).toEqual([120,122,123,124]);expect(q.snapshot().queued).toBe(0);
 });
 it('旧会话先结束真实写入，新会话不会被旧档覆盖，排队旧请求取消',async()=>{
  let release!:()=>void;const written:number[]=[];const q=new SaveQueue(async s=>{await new Promise<void>(ok=>release=ok);written.push(s.coins);});
  const s=initialState(),a=q.enqueue(s,true),b=q.enqueue(s,true);const cancelled=expect(b).rejects.toThrow('旧旅途');
  const switcher=q.switchSession(),ready=vi.fn();void switcher.then(ready);expect(ready).not.toHaveBeenCalled();release();await a;await switcher;await cancelled;
  s.coins=150;const newSave=q.enqueue(s);release();await newSave;expect(written).toEqual([120,150]);expect(q.snapshot().persisted).toBe(1);
 });
 for(const delay of [300,1000])it(`写入延迟${delay}毫秒时正式控制器持续攻击、风步、弹反`,async()=>{
  vi.useFakeTimers();try{
   const q=new SaveQueue(async()=>{await new Promise(ok=>setTimeout(ok,delay));}),s=initialState(),a=arena();
   const saved=q.enqueue(s,true);a.c.requestAttack(0);a.tick(0,0);a.c.requestAttack(30);a.tick(0,235);
   expect(a.starts.map(x=>x.stage)).toEqual([1,2]);a.c.requestActions([{kind:'dash',at:500,sequence:1,axis:{x:1,y:0}}],500,a.p,3);a.tick(235,500);
   a.c.requestParry(680,3);a.c.flushActions(700,a.p);expect(a.c.parry).not.toBeNull();expect(q.snapshot().writing).toBe(true);
   await vi.advanceTimersByTimeAsync(delay);await saved;expect(q.snapshot().writing).toBe(false);
  }finally{vi.useRealTimers();}
 });
 it('交易锁仍冻结并等待前方自动快照，写失败不发布或扣款',async()=>{
  let release!:()=>void;const q=new SaveQueue(async()=>{await new Promise<void>(ok=>release=ok);}),lock=new StateCommit();let state=initialState();
  const a=q.enqueue(state,true);const commit=lock.run(()=>state,s=>({...s,coins:100}),s=>q.enqueue(s),s=>state=s);
  await Promise.resolve();expect(lock.busy).toBe(true);expect(state.coins).toBe(120);release();await a;release();await commit;expect(state.coins).toBe(100);expect(lock.busy).toBe(false);
  await expect(lock.run(()=>state,s=>({...s,coins:90}),async()=>{throw Error('事务失败');},s=>state=s)).rejects.toThrow('事务失败');expect(state.coins).toBe(100);
 });
 it('队列有界，故障不会无限重试或阻断后续显式保存',async()=>{
  let release!:()=>void;const q=new SaveQueue(async()=>{await new Promise<void>(ok=>release=ok);}),s=initialState();const waiting=[q.enqueue(s)];
  for(let i=0;i<8;i++)waiting.push(q.enqueue(s));await expect(q.enqueue(s)).rejects.toThrow('队列已满');
  for(const p of waiting){release();await p;}expect(q.snapshot().writing).toBe(false);
 });
});
