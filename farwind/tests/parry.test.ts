import {describe,it,expect} from 'vitest';
import {CombatController,PARRY,COMBAT,STRIKES,attackConfig,resolveStrike, type Attack, type ActionKind} from '../src/game/systems/combat';
import {adjudicateContact,defends,orderedContacts} from '../src/game/systems/contact';
import {createEnemyAttack,advanceEnemyAttack,attackTouches,type EnemyContact} from '../src/game/systems/enemyAttack';
import {CombatTimeline} from '../src/game/systems/timeline';
import {Input,type InputEvent} from '../src/game/systems/input';
import {Sprint} from '../src/game/systems/sprint';
import {staggerEnemy,updateEnemy,enemyNavigation,type EnemyBody} from '../src/game/systems/enemy';
import {TrainingDummy} from '../src/game/systems/training';
import {ParryTraining} from '../src/game/systems/parryTraining';
import {combatVisual,weaponSample,parryVisual,parryWeapon} from '../src/data/animation';
import {clearMeleeLine} from '../src/game/systems/obstacles';
import {initialState,parseSave} from '../src/game/systems/state';
import sharp from 'sharp';
const rules={valid:true,immune:false,clear:()=>true};
function arena() {
 const c=new CombatController(),p={x:0,y:0,hp:100,stamina:100},starts:Attack[]=[],hits:number[]=[];
 const tick=(prev:number,now:number)=>c.update(prev,now,0,p,[],()=>false,()=>true,(_,s,a)=>hits.push(attackConfig(a).damage),(_,a)=>starts.push(a));
 const guard=(at=0,facing:0|1|2|3=0)=>{c.requestParry(at,facing);return c.flushActions(at,p);};
 return {c,p,tick,guard,starts,hits};
}
function contact(at:number,id='slime-a',origin={x:0,y:60},player={x:0,y:0}):EnemyContact {
 const attack=createEnemyAttack(id,1,'slime',at-450,origin,player);
 advanceEnemyAttack(attack,origin,player,at-120);
 return advanceEnemyAttack(attack,origin,player,at)!;
}
describe('弹反边界、成本、缓冲和动作取消',()=>{
 for(const [at,quality] of [[0,'perfect'],[69.999,'perfect'],[70,'normal'],[70.001,'normal'],[179.999,'normal'],[180,null],[180.001,null],[259.999,null],[260,null]] as const)
  it(`窗口边界 ${at}`,()=>{const a=arena();a.guard();expect(a.c.parryQuality(at)).toBe(quality);expect(a.p.stamina).toBe(88);});
 it('空弹260恢复攻击与移动，400恢复弹反，相邻边界与预约消费',()=>{
  const a=arena();a.guard();a.c.requestAttack(10);a.c.flushActions(259.999,a.p);a.tick(0,259.999);expect(a.c.attack).toBeNull();
  a.c.flushActions(260,a.p);a.tick(259.999,260);expect(a.c.attack?.start).toBe(260);
  const b=arena();b.guard();b.c.flushActions(260,b.p);b.c.requestParry(280,0);b.c.flushActions(399.999,b.p);expect(b.c.parrySerial).toBe(1);b.c.flushActions(400,b.p);expect(b.c.parry?.start).toBe(400);expect(b.p.stamina).toBe(76);
 });
 it('缓冲从消费时扣费计时，重复请求不延期，到期等号合法，逾期不发动',()=>{
  for(const arrival of [80,79.999]) {
   const a=arena();a.c.requestDash(0,100,{x:0,y:1},0);a.c.requestParry(arrival,0);const expiry=a.c.parryPending!.until;
   a.c.requestParry(100,1);expect(a.c.parryPending!.until).toBe(expiry);a.c.flushActions(199.999,a.p);expect(a.p.stamina).toBe(100);
   a.c.flushActions(200,a.p);expect(a.c.parrySerial).toBe(arrival===80?1:0);if(arrival===80){expect(a.c.parry?.start).toBe(200);expect(a.c.parryQuality(200)).toBe('perfect');expect(a.p.stamina).toBe(88);}
  }
 });
 it('长按和重复按键只有按下沿；失焦／暂停清空所有意图',()=>{
  let time=1;const input=new Input(null,()=>time);input.keyDown('k');input.keyDown('k',true);time=90;input.keyDown('k');expect(input.events).toHaveLength(1);
  input.keyUp('k');input.keyDown('k');expect(input.events.filter(e=>e.kind==='parry')).toHaveLength(2);
  input.clear();expect(input.held.size).toBe(0);expect(input.drain()).toEqual([]);input.enabled=()=>false;input.keyDown('j');input.keyDown('k');input.keyDown('l');expect(input.drain()).toEqual([]);
  const a=arena();a.c.requestAttack(0);a.c.requestParry(0,0);a.c.clearInputs();expect(a.c.pending).toBe(false);expect(a.c.parryPending).toBeNull();
 });
 it('不足、锁定和冷却拒绝不扣费，重复消费仅一次',()=>{
  const a=arena();a.p.stamina=11.999;a.guard();expect(a.c.parry).toBeNull();expect(a.p.stamina).toBe(11.999);a.c.flushActions(121,a.p);a.p.stamina=100;a.c.flushActions(400,a.p);expect(a.c.parry).toBeNull();
  a.guard(500);a.c.flushActions(500,a.p);a.c.requestParry(550,1);a.c.flushActions(550,a.p);expect(a.p.stamina).toBe(88);expect(a.c.parry?.start).toBe(500);
 });
 for(const stage of [1,2,3])for(const phase of ['windup','active','recovery','late'] as const)
  it(`第${stage}刀${phase}取消权限`,()=>{
   const a=arena(),m=STRIKES[stage-1],total=m.windup+m.active+m.recovery;
   a.c.attack={id:1,stage,start:0,facing:0,hit:new Set()};
   const at=phase==='windup'?10:phase==='active'?m.windup+1:phase==='recovery'?m.windup+m.active+1:total-120;
   a.c.requestParry(at,1);a.c.flushActions(at,a.p);
   const immediate=stage<3?phase!=='active':phase==='late';expect(!!a.c.parry).toBe(immediate);
   if(!immediate) {const legal=stage<3?m.windup+m.active:total-120;a.c.flushActions(legal,a.p);expect(!!a.c.parry).toBe(legal<=at+120);}
  });
 it('第三刀最后120毫秒前后；风步权限不继承弹反权限',()=>{
  for(const at of [389.999,390,390.001]) {const a=arena();a.c.attack={id:1,stage:3,start:0,facing:0,hit:new Set()};a.guard(at);expect(!!a.c.parry).toBe(at>=390);}
  const a=arena();a.c.requestAttack(0);a.tick(0,0);expect(a.c.requestDash(10,100,{x:1,y:0},0)).toBe(false);a.guard(10);expect(a.c.parry?.start).toBe(10);
 });
 it('进入弹反清除旧攻击预约，只有之后新按的一刀可以衔接',()=>{
  const a=arena();a.c.requestAttack(0);a.tick(0,0);a.c.requestAttack(50);a.guard(60);expect(a.c.pending).toBe(false);
  const e=contact(100);expect(adjudicateContact(e,a.c,a.p,rules)).toBe('perfect');a.c.flushActions(160,a.p);a.tick(60,300);expect(a.starts).toHaveLength(1);
  a.c.requestAttack(300);a.tick(300,300);expect(a.c.attack?.counter).toBe('perfect');
 });
 it('同刻最高优先级失败不回退；键鼠等价请求只扣一次',()=>{
  const a=arena();a.p.stamina=10;
  const requests=(k:ActionKind,sequence:number)=>({kind:k,at:0,sequence,axis:{x:0,y:0}});
  a.c.requestActions([requests('attack',1),requests('parry',2),requests('dash',3)],0,a.p,0);a.c.flushActions(0,a.p);a.tick(0,0);
  expect(a.c.attack).toBeNull();expect(a.c.parry).toBeNull();expect(a.p.stamina).toBe(10);
  a.p.stamina=100;a.c.requestActions([requests('parry',4),requests('parry',5)],1,a.p,0);a.c.flushActions(1,a.p);expect(a.p.stamina).toBe(88);expect(a.c.parrySerial).toBe(1);
 });
 it('架剑朝向用输入或有效持剑朝向，并持续锁定',()=>{
  const a=arena();a.c.lastFacing=3;a.c.settleUntil=100;a.c.requestActions([{kind:'parry',at:0,sequence:1,axis:{x:0,y:0}}],0,a.p,1);a.c.flushActions(0,a.p);expect(a.c.parry?.facing).toBe(3);expect(a.c.effectiveFacing(100,1)).toBe(3);
  const b=arena();b.c.requestActions([{kind:'parry',at:0,sequence:1,axis:{x:-1,y:0}}],0,b.p,0);b.c.flushActions(0,b.p);expect(b.c.parry?.facing).toBe(2);
 });
});
describe('接触裁决与成功战斗闭环',()=>{
 for(const [at,kind,refund,stop,stagger] of [[69.999,'perfect',18,75,600],[70,'normal',12,55,420]] as const)
  it(`成功${kind}完整免伤、一次退款、60恢复、机会600`,()=>{
   const a=arena();a.p.stamina=95;a.guard();const e=contact(at);expect(adjudicateContact(e,a.c,a.p,rules)).toBe(kind);expect(a.p.stamina).toBe(Math.min(100,83+refund));expect(a.p.hp).toBe(100);
   expect(e.attack.cancelled).toBe(true);expect(e.attack.resolved).toBe(true);expect(adjudicateContact(e,a.c,a.p,rules)).toBe('invalid');expect(a.c.hitStopRemaining).toBe(stop);
   expect(a.c.counter?.until).toBe(at+600);expect(a.c.parry?.actionUntil).toBe(e.at+60);expect(a.c.parryCooldown).toBe(e.at+60);expect(PARRY[kind].stagger).toBe(stagger);
  });
 it('已有受击／复活／风步保护先于奖励',()=>{
  for(const source of ['external','dash']) {const a=arena();a.guard();if(source==='dash'){a.c.dashStart=0;a.c.dashUntil=200;}expect(adjudicateContact(contact(50),a.c,a.p,{...rules,immune:source==='external'})).toBe('immune');expect(a.p.stamina).toBe(88);expect(a.c.counter).toBeNull();}
 });
 for(const degrees of [0,45,79.999,80.001,120,180])
  it(`前方扇形${degrees}度`,()=>{
   const a=arena();a.guard();const angle=degrees*Math.PI/180,origin={x:Math.sin(angle)*60,y:Math.cos(angle)*60};expect(adjudicateContact(contact(60,'a',origin),a.c,a.p,rules)).toBe(degrees<=80?'perfect':'hurt');
  });
 it('范围外、隔墙、隔水均无奖励；不允许弹反攻击照常受伤',()=>{
  for(const setup of ['far','wall','water','unparryable']) {
   const a=arena();a.guard();const e=contact(30,'a',setup==='far'?{x:0,y:101}:{x:0,y:60});if(setup==='unparryable')e.attack.parryable=false;
   expect(adjudicateContact(e,a.c,a.p,{...rules,clear:()=>!['wall','water'].includes(setup)})).toBe(setup==='unparryable'?'hurt':'invalid');expect(a.p.stamina).toBe(88);expect(a.c.counter).toBeNull();
  }
  expect(clearMeleeLine({x:2500,y:950},{x:2720,y:950})).toBe(false);expect(clearMeleeLine({x:330,y:625},{x:330,y:550})).toBe(false);
 });
 it('同时间多目标按稳定编号，余势无奖励、不叠停顿，背后不保护',()=>{
  const traces=[];
  for(const reversed of [false,true]) {
   const a=arena();a.p.stamina=60;a.guard();let events=[contact(50,'b'),contact(50,'a')];if(reversed)events.reverse();
   const results=orderedContacts(events).map(e=>[e.attack.attackerId,adjudicateContact(e,a.c,a.p,rules)]);
   expect(results).toEqual([['a','perfect'],['b','afterguard']]);expect(a.p.stamina).toBe(66);expect(a.c.hitStopRemaining).toBe(75);
   expect(adjudicateContact(contact(129.999,'c'),a.c,a.p,rules)).toBe('afterguard');expect(adjudicateContact(contact(130,'d'),a.c,a.p,rules)).toBe('hurt');
   expect(adjudicateContact(contact(70,'back',{x:0,y:-60}),a.c,a.p,rules)).toBe('hurt');traces.push({results,stamina:a.p.stamina,counter:a.c.counter});
  }
  expect(traces[0]).toEqual(traces[1]);
 });
 it('开始新攻击、风步或弹反结束旧余势；移动不清机会、不续期',()=>{
  for(const action of ['attack','dash','parry'] as const) {
   const a=arena();a.guard();adjudicateContact(contact(0),a.c,a.p,rules);a.c.flushActions(60,a.p);
   if(action==='attack'){a.c.requestAttack(60);a.tick(60,60);}else if(action==='dash')a.c.requestDash(60,100,{x:1,y:0},0);else a.guard(60);
   expect(a.c.afterguard).toBeNull();if(action!=='attack')expect(a.c.counter?.until).toBe(600);
  }
 });
 it('普通受击硬直合并不能缩短弹反失衡',()=>{
  const e={staggerUntil:600};staggerEnemy(e,100,75);expect(e.staggerUntil).toBe(600);staggerEnemy(e,590,170);expect(e.staggerUntil).toBe(760);
 });
 it('恢复暂停300毫秒与耗尽锁存保留；退款可解除耗尽',()=>{
  const a=arena(),s=new Sprint();a.p.stamina=12;s.reset(1);a.guard();expect(s.update(a.p.stamina,false,0.3,false).stamina).toBe(0);expect(s.exhausted).toBe(true);
  adjudicateContact(contact(60),a.c,a.p,rules);expect(a.p.stamina).toBe(18);s.update(18,true,0);expect(s.exhausted).toBe(true);s.update(20,true,0);expect(s.exhausted).toBe(false);expect(a.c.regenUntil).toBe(300);
 });
 for(const kind of ['normal','perfect'] as const)
  it(`反击${kind}配置、动画、木桩、机会消费与二三刀`,()=>{
   const a=arena();a.guard();adjudicateContact(contact(kind==='normal'?100:50),a.c,a.p,rules);const resume=a.c.parry!.actionUntil;
   a.c.requestAttack(resume-20);a.c.flushActions(resume,a.p);a.tick(resume,resume);
   const attack=a.c.attack!,m=attackConfig(attack);expect(attack.stage).toBe(1);expect(attack.counter).toBe(kind);expect(m.damage).toBe(kind==='normal'?24:30);expect(m.windup).toBe(55);expect(m.step).toBe(18);expect(m.active).toBe(115);expect(m.recovery).toBe(145);expect(a.c.counter).toBeNull();
   expect(combatVisual(1,0,54,false,m).phase).toBe('windup');expect(combatVisual(1,0,55,false,m).phase).toBe('active');expect(weaponSample(1,0,55,m).visible).toBe(true);
   const t=new TrainingDummy();t.hit(attack,resume+55);expect(t.lastDamage).toBe(m.damage);expect(t.hit(attack,resume+56)).toBe(false);
   a.c.requestAttack(resume+60);a.tick(resume,resume+215);expect(a.c.attack?.stage).toBe(2);expect(a.c.attack?.counter).toBeUndefined();expect(attackConfig(a.c.attack!)).toEqual(resolveStrike(2));
   a.c.requestAttack(resume+230);a.tick(resume+215,resume+480);expect(a.c.attack?.stage).toBe(3);expect(attackConfig(a.c.attack!)).toEqual(resolveStrike(3));
  });
 it('挥空不退回机会，600时限相邻边界；受伤与全部会话重置清除',()=>{
  for(const at of [599.999,600]){const a=arena();a.guard();adjudicateContact(contact(0),a.c,a.p,rules);a.c.flushActions(at,a.p);a.c.requestAttack(at);a.tick(at,at);expect(a.c.attack?.counter).toBe(at<600?'perfect':undefined);a.tick(at,at+1000);expect(a.c.counter).toBeNull();}
  for(const reset of ['hurt','death','title','new','load']){const a=arena();a.guard();adjudicateContact(contact(0),a.c,a.p,rules);a.c.dashCooldown=500;if(reset==='hurt')a.c.hurt();else if(reset==='death')a.c.reset(a.c.dashCooldown);else a.c.reset();expect(a.c.counter).toBeNull();expect(a.c.parry).toBeNull();expect(a.c.afterguard).toBeNull();expect(a.c.pending).toBe(false);if(reset==='hurt')expect(a.c.dashCooldown).toBe(500);}
  const state=initialState();expect(parseSave(JSON.stringify(state))).toEqual(state);expect(JSON.stringify(state)).not.toContain('parry');
 });
});
describe('敌人攻击实例、锁向和精确接触',()=>{
 it('史莱姆450／末120，叶灵650／末150；锁向后绕背挥空',()=>{
  for(const type of ['slime','leaf']) {
   const origin={x:0,y:0},p={x:0,y:60},a=createEnemyAttack('a',1,type,0,origin,p),duration=type==='leaf'?650:450;
   expect(a.contactAt).toBe(duration);expect(a.lockAt).toBe(duration-(type==='leaf'?150:120));expect(advanceEnemyAttack(a,origin,p,a.lockAt)).toBeNull();expect(a.locked).toBe(true);
   p.y=-60;const e=advanceEnemyAttack(a,origin,p,duration)!;expect(e.at).toBe(duration);expect(attackTouches(e,p)).toBe(false);expect(advanceEnemyAttack(a,origin,p,duration+1)).toBeNull();
  }
 });
 it('取消实例绝不恢复旧接触，序号唯一，正式村庄安全区保留',()=>{
  const e:EnemyBody={id:'a',type:'slime',x:2450,y:1060,homeX:2450,homeY:1060,hp:48,cool:0,windup:0,staggerUntil:0,nav:enemyNavigation(),ai:'',disabled:false,recovered:false},p={x:2450,y:1110};
  updateEnemy(e,p,1,0);const first=e.attack!;first.cancelled=true;updateEnemy(e,p,451,450);expect(first.emitted).toBe(false);updateEnemy(e,p,452,1);expect(e.attack?.attackId).not.toBe(first.attackId);
  const v={...e,x:2000,y:1080,homeX:2000,homeY:1080,attack:null,cool:0};updateEnemy(v,{x:2010,y:1080},1000,10);expect(v.attack).toBeNull();
 });
});
function trajectory(steps:number[],at=440) {
 const a=arena(),clock=new CombatTimeline(),target={id:'enemy',x:0,y:60,hp:100},attack=createEnemyAttack('enemy',1,'slime',0,target,a.p),results:string[]=[],inputs:InputEvent[]=[{kind:'parry',at,sequence:1,axis:{x:0,y:0}},{kind:'attack',at:460,sequence:2,axis:{x:0,y:0}}];
 let wall=0,sim=0,index=0;const submitted:EnemyContact[]=[];
 const update=(prev:number,now:number)=>a.c.update(prev,now,0,a.p,[target],()=>false,()=>true,(e,_,attack)=>{e.hp-=attackConfig(attack).damage;a.c.stopOnHit(1);},(_,attack)=>a.starts.push(attack));
 while(wall<1000){const next=Math.min(1000,wall+steps[index++%steps.length]),events=inputs.filter(e=>e.at>wall&&e.at<=next);sim=clock.frame(sim,next,next-wall,events,a.c,{boundary:now=>Math.min(a.c.nextBoundary(now),...([attack.lockAt,attack.contactAt].filter(t=>t>now+1e-7))),advance:(prev,now)=>{update(prev,now);const e=advanceEnemyAttack(attack,target,a.p,now);if(e)submitted.push(e);},input:(events,now)=>a.c.requestActions(events.filter(e=>e.kind!=='axis') as any,now,a.p,0),resolve:now=>{a.c.flushActions(now,a.p);update(now,now);for(const e of submitted.splice(0)){const r=adjudicateContact(e,a.c,a.p,rules);results.push(r);if(r==='hurt'){a.p.hp-=10;a.c.hurt();}}}});wall=next;}
 return {results,hp:a.p.hp,stamina:a.p.stamina,start:a.starts.map(s=>[s.stage,s.start,s.counter]),targetHp:target.hp,sim};
}
describe('统一时间轴与停顿输入',()=>{
 for(const [at,result] of [[449,'perfect'],[450,'perfect'],[451,'hurt']] as const)
  it(`同帧输入 ${at} 与接触450排序`,()=>expect(trajectory([50],at).results).toEqual([result]));
 it('30／60／120Hz与抖动步长同事件轨迹完全一致，停顿中下一刀可靠消费',()=>{
  const values=[[1000/30],[1000/60],[1000/120],[7,41,13,29]].map(s=>trajectory(s));
  for(const v of values){expect(v.results).toEqual(values[0].results);expect(v.start).toEqual(values[0].start);expect(v.stamina).toBe(values[0].stamina);expect(v.targetHp).toBe(values[0].targetHp);expect(v.sim).toBeCloseTo(values[0].sim,7);expect(v.start[0]).toEqual([1,510,'perfect']);}
 });
 it('未冻结预算扣停顿，输入不消失，帧裁剪与暂停重置墙钟',()=>{
  const a=arena(),clock=new CombatTimeline();a.c.hitStopRemaining=75;const received:number[]=[],hooks={boundary:()=>Infinity,advance:()=>{},input:(_:InputEvent[],sim:number)=>received.push(sim),resolve:()=>{}};
  expect(clock.frame(100,50,50,[{kind:'parry',at:20,sequence:1,axis:{x:0,y:0}}],a.c,hooks)).toBe(100);expect(received).toEqual([100]);expect(a.c.hitStopRemaining).toBe(25);
  expect(clock.frame(100,100,50,[],a.c,hooks)).toBe(125);clock.reset(10000);expect(clock.frame(125,10100,100,[],a.c,hooks)).toBe(175);
 });
});
it('新动作不是挥剑染色：十二帧独立、固定根、四向镜像与成功同刻受力',async()=>{
 const {data,info}=await sharp('public/assets/animation/hero-parry.png').raw().toBuffer({resolveWithObject:true});expect([info.width,info.height]).toEqual([640,480]);
 for(let f=0;f<12;f++){let visible=0,bottom=0;for(let y=0;y<160;y++)for(let x=0;x<160;x++)if(data[((Math.floor(f/4)*160+y)*640+(f%4)*160+x)*4+3]>100){visible++;bottom=Math.max(bottom,y);}expect(visible).toBeGreaterThan(1800);expect(bottom).toBeGreaterThanOrEqual(150);expect(bottom).toBeLessThan(160);}
 const a=arena();a.guard();adjudicateContact(contact(50),a.c,a.p,rules);expect(parryVisual(a.c.parry!,50).phase).toBe('brace');expect(parryVisual(a.c.parry!,75).phase).toBe('deflect');
 for(let pose=0;pose<4;pose++){const l=parryWeapon(2,pose),r=parryWeapon(3,pose);expect(l.tip.x).toBe(-r.tip.x);expect(l.tip.y).toBe(r.tip.y);}
});
it('练习默认关闭，主动选择900／450／650节奏，生命与任务不被训练裁决修改',()=>{
 const t=new ParryTraining(),a=arena(),target={id:'training-dummy',x:0,y:60};expect(t.update(1000,a.p,a.c)).toBeNull();
 for(const [mode,duration] of [['slow',900],['slime',450],['leaf',650]] as const){t.select(mode,target,0);t.update(500,a.p,a.c);expect(t.attack!.contactAt).toBe(500+duration);t.update(t.attack!.lockAt,a.p,a.c);const event=t.update(t.attack!.contactAt,a.p,a.c)!;const before={...a.p};t.observe(event,adjudicateContact(event,a.c,a.p,rules),a.c,a.p);expect(a.p).toEqual(before);}
 t.reset();expect(t.attack).toBeNull();expect(t.mode).toBe('off');
});
it('成功停顿中可以预输入下一次弹反；成功前重复K仍不续窗',()=>{
 const a=arena();a.guard();expect(a.c.requestParry(30,0)).toBe(false);expect(a.c.parryPending).toBeNull();
 adjudicateContact(contact(50),a.c,a.p,rules);expect(a.c.requestParry(50,0)).toBe(true);expect(a.c.parryPending!.until).toBe(170);
 a.c.flushActions(109.999,a.p);expect(a.c.parry!.id).toBe(1);a.c.advanceFrame(75);a.c.flushActions(110,a.p);expect(a.c.parry!.id).toBe(2);expect(a.c.parry!.start).toBe(110);expect(a.p.stamina).toBe(88);expect(a.c.afterguard).toBeNull();
});
it('细分时间轴在碰撞边界的数值残差不使待机姿态报告移动速度',async()=>{
 const {Locomotion}=await import('../src/game/systems/locomotion');const motion=new Locomotion();motion.update({dx:0,dy:0.000217,dt:1/60,intentY:-1});expect(motion.action).toBe('idle');expect(motion.speed).toBe(0);expect(motion.phase).toBe(0);
});
it('轻击收手练习立即观察第一刀，不因菜单后500毫秒等待漏掉首次输入',()=>{
 const t=new ParryTraining(),a=arena(),target={id:'training-dummy',x:0,y:60};t.select('chain',target,0);expect(t.next).toBe(0);t.update(0,a.p,a.c);expect(t.attack).toBeNull();a.c.requestAttack(0);a.tick(0,0);t.update(0,a.p,a.c);expect(t.attack!.contactAt).toBe(450);
});
