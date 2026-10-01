import {describe,it,expect} from 'vitest';
import {CombatController,PARRY,attackConfig,facingVector,type Attack,type Target} from '../src/game/systems/combat';
import {adjudicateContact,rangedCounterDirection,orderedContacts} from '../src/game/systems/contact';
import {EnemyProjectiles} from '../src/game/systems/enemyProjectiles';
import {createEnemyAttack,sporeContactAt,SPORE,type EnemyContact} from '../src/game/systems/enemyAttack';
import {SwordWindSystem,swordWindBirth,type WindMotion} from '../src/game/systems/swordWind';
import {firstRectContact} from '../src/game/systems/swordWindGeometry';
import {resolveSwordWindConfig} from '../src/data/swordWind';
import {counterVisual} from '../src/data/animation';
import {CombatFeedback,type FeedbackEvent} from '../src/game/systems/combatFeedback';
import {outgoingDamage} from '../src/game/systems/economy';
import {initialState} from '../src/game/systems/state';
import {ParryTraining} from '../src/game/systems/parryTraining';
const noWall=()=>null;
const motion=(target:Target):WindMotion=>({target,previous:{x:target.x,y:target.y},current:{x:target.x,y:target.y}});
function setup(age=135,immune=false){
 const source={id:'spore',x:850,y:700,hp:60},p={x:1080,y:700,stamina:50},c=new CombatController(),s=new SwordWindSystem(),shots=new EnemyProjectiles();
 const attack=createEnemyAttack(source.id,1,'spore',0,source,p);shots.launch(attack,source,attack.contactAt);
 const at=sporeContactAt(shots.shots[0],attack.direction,p,attack.contactAt,attack.contactAt+SPORE.life,()=>true)!;
 c.requestParry(at-age,2);c.flushActions(at-age,p);
 const contact=shots.update(at+1,p,()=>true)[0];
 const result=adjudicateContact(contact,c,p,{valid:true,immune,clear:()=>true,attacker:source});
 c.advanceFrame(c.hitStopRemaining);
 const starts:Attack[]=[],melee:Target[]=[],releases:number[]=[];
 const tick=(prev:number,now:number,others:Target[]=[])=>c.update(prev,now,2,p,[source,...others],()=>false,()=>true,
  t=>melee.push(t),(_,a)=>starts.push(a),()=>{},()=>true,(a,root,time)=>{releases.push(time);s.launch(a,root,time,outgoingDamage(initialState(),attackConfig(a).damage));});
 const fly=(prev:number,now:number,targets:Target[]=[source],blocker=noWall)=>s.advance(prev,now,targets.map(motion),blocker);
 return {source,p,c,s,shots,attack,contact,at,result,tick,fly,starts,melee,releases};
}
const release=(a:ReturnType<typeof setup>)=>{a.tick(a.at,a.at+60);a.tick(a.at+60,a.at+115);return a.s.winds[0];};
describe('远程弹反专用剑气',()=>{
 for(const [age,result,damage,refund,stop] of [[135,'normal',24,50,55],[35,'perfect',30,56,75]] as const)it(`${result}保留退款和停顿，只在反斩有效期发射并接触后伤害`,()=>{
  const a=setup(age);expect(a.result).toBe(result);expect(a.p.stamina).toBe(refund);expect(a.c.lastHitStopRequested).toBe(stop);
  expect(a.source.hp).toBe(60);expect(a.c.autoCounter).toMatchObject({at:a.at+60,delivery:'wind',sourceContactId:a.contact.attack.attackId,target:'spore'});
  a.tick(a.at,a.at+59.999);expect(a.starts).toHaveLength(0);
  a.tick(a.at+59.999,a.at+60);expect(a.starts).toHaveLength(1);expect(a.c.attack).toMatchObject({stage:1,counter:result,delivery:'wind'});
  a.tick(a.at+60,a.at+114.999);expect(a.s.winds).toHaveLength(0);a.tick(a.at+114.999,a.at+115);
  expect(a.releases).toEqual([a.at+115]);expect(a.s.winds).toHaveLength(1);expect(a.s.winds[0].config.damage).toBe(damage);
  expect(a.fly(a.at+115,a.at+115)).toEqual([]);expect(a.source.hp).toBe(60);
  const hits=a.fly(a.at+115,a.at+450).filter(e=>e.target);expect(hits).toHaveLength(1);expect(hits[0].at).toBeGreaterThan(a.at+115);
  a.source.hp-=hits[0].wind.config.damage;expect(a.source.hp).toBe(60-damage);expect(a.melee).toEqual([]);
  expect(a.fly(a.at+450,a.at+600).filter(e=>e.target)).toEqual([]);
 });
 it('同一接触只退款一次、只产生一个反击与弹体；贴身不叠加近战伤害',()=>{
  const a=setup();const stamina=a.p.stamina;expect(adjudicateContact(a.contact,a.c,a.p,{valid:true,immune:false,clear:()=>true})).toBe('invalid');expect(a.p.stamina).toBe(stamina);
  a.source.x=1045;release(a);a.tick(a.at+115,a.at+150);expect(a.starts).toHaveLength(1);expect(a.releases).toHaveLength(1);expect(a.melee).toEqual([]);
  const w=a.s.winds[0];expect(a.s.launch(w.attack,a.p,w.born,24)).toBeNull();expect(a.fly(w.born,w.born+50).filter(e=>e.target)).toHaveLength(1);
 });
 it('无需解锁，且所有已学等级仍只发一发24伤害，不修改永久本领',()=>{
  for(const stage of [0,1,2,3,4,5] as const){const a=setup();a.c.swordWindEnabled=stage>0;a.c.swordWindConfig=stage?resolveSwordWindConfig(stage):null;
   const w=release(a);expect(a.s.winds).toHaveLength(1);expect(w.config).toMatchObject({speed:900,distance:300,width:28,maxTargets:1,damage:24,angles:[0]});
   expect(a.c.maxStage).toBe(3);expect(a.c.swordWindConfig?.stage??0).toBe(stage);
  }
 });
 it('基础反击伤害继续通过现有装备修正，发射快照不再读取后续状态',()=>{
  const a=setup(35),state=initialState();state.equipment.weapon="ironSword";
  const damage=outgoingDamage(state,30);expect(damage).toBe(34);const w=release(a);expect(w.attack.config?.damage).toBe(30);
  a.s.clear();const b=new SwordWindSystem(),copy={...w.attack,id:100};const wind=b.launch(copy,a.p,a.at+115,damage)!;
  state.equipment.weapon=null;expect(wind.config.damage).toBe(damage);expect(wind.attack.stage).toBe(1);
 });
 it('免疫与余势不产生反击剑气，多个接触的主目标与数组顺序无关',()=>{
  expect(setup(35,true).c.autoCounter).toBeNull();
  for(const reverse of [false,true]){const a=setup(),base=a.contact;
   const extra={...base,attack:{...base.attack,attackId:'z:spore',attackerId:'z',cancelled:false,resolved:false},projectileId:'z:spore'};
   expect(adjudicateContact(extra,a.c,a.p,{valid:true,immune:false,clear:()=>true})).toBe('afterguard');expect(a.p.stamina).toBe(50);expect(a.c.autoCounter?.target).toBe('spore');
   const contacts=[base,extra];if(reverse)contacts.reverse();expect(orderedContacts(contacts)[0].attack.attackerId).toBe('spore');release(a);expect(a.s.winds).toHaveLength(1);
  }
 });
 it('只结算成功主目标，途中其他敌人不获得伤害或额外奖励',()=>{
  const a=setup(),other={id:'other',x:1000,y:700,hp:100};release(a);const hits=a.fly(a.at+115,a.at+500,[other,a.source]).filter(e=>e.target);
  expect(hits.map(e=>e.target!.id)).toEqual(['spore']);expect(other.hp).toBe(100);
 });
 it('源位置只在成功时采样，目标后来离开路线允许挥空',()=>{
  const a=setup();const d={...a.c.autoCounter!.direction!};a.source.y+=100;const w=release(a);expect(w.direction).toEqual(d);
  const events=a.fly(a.at+115,a.at+600);expect(events.some(e=>e.target)).toBe(false);expect(events.at(-1)?.reason).toBe('range');
 });
 it('目标死亡或射程外时没有真实命中，剑气继续正常消散',()=>{
  for(const dead of [false,true]){const a=setup();if(dead)a.source.hp=0;else a.source.x=300;release(a);expect(a.fly(a.at+115,a.at+700).some(e=>e.target)).toBe(false);}
 });
 it('实体障碍先于目标裁决，出生扫掠也不跳过薄墙',()=>{
  const a=setup();release(a);const wall=(x:{x:number;y:number},y:{x:number;y:number})=>{const t=firstRectContact(x,y,{left:960,right:970,top:650,bottom:750});return t===null?null:{id:'wall',t};};
  const events=a.fly(a.at+115,a.at+600,[a.source],wall);expect(events).toHaveLength(1);expect(events[0].reason).toBe('obstacle');expect(events[0].target).toBeUndefined();
 });
 it('成功后的J仅预约第二刀，不重复反击；不按J不会自动三连',()=>{
  const a=setup();a.c.requestAttack(a.at);release(a);a.tick(a.at+115,a.at+275);expect(a.starts.map(s=>s.stage)).toEqual([1,2]);expect(a.starts[1].counter).toBeUndefined();expect(a.releases).toHaveLength(1);
  const b=setup();release(b);b.tick(b.at+115,b.at+600);expect(b.starts.map(s=>s.stage)).toEqual([1]);
 });
 it('发射前风步、新防御及受伤清理，不在稍后补发',()=>{
  for(const kind of ['dash','parry','hurt'] as const){const a=setup();
   if(kind==='hurt')a.c.hurt();else {if(kind==='dash')a.c.requestActions([{kind,at:a.at+20,sequence:1,axis:{x:0,y:0}}],a.at+20,a.p,2);else a.c.requestParry(a.at+20,2);a.c.flushActions(a.at+60,a.p);}
   a.tick(a.at,a.at+500);expect(a.releases).toEqual([]);expect(a.c.autoCounter).toBeNull();
  }
 });
 it('反斩前摇可按原规则取消；有效期不突然开放新权限',()=>{
  const a=setup();a.tick(a.at,a.at+60);a.c.requestParry(a.at+80,2);expect(a.c.flushActions(a.at+80,a.p)).toEqual(['parry']);a.tick(a.at+80,a.at+300);expect(a.releases).toEqual([]);
  const b=setup();release(b);b.c.requestParry(b.at+120,2);expect(b.c.flushActions(b.at+120,b.p)).toEqual([]);expect(b.c.parryLegalAt(b.at+120)).toBe(b.at+230);
 });
 it('发射后受伤不回收独立弹体，会话清理释放全部弹体与事件',()=>{
  const a=setup();release(a);a.c.hurt();expect(a.fly(a.at+115,a.at+500).filter(e=>e.target)).toHaveLength(1);a.c.reset();a.s.clear();a.shots.reset();expect(a.s.snapshot()).toEqual([]);expect(a.s.events).toEqual([]);expect(a.c.autoCounter).toBeNull();
 });
 it('近战成功仍使用原第一刀反斩，不发射剑气',()=>{
  const a=setup(),c=new CombatController(),p={x:0,y:0,stamina:50};c.requestParry(0,3);c.flushActions(0,p);
  const attack=createEnemyAttack('slime',1,'slime',0,{x:10,y:0},p),contact:EnemyContact={at:40,attack,origin:{x:10,y:0},geometry:{a:p,b:p,radius:20}};
  expect(adjudicateContact(contact,c,p,{valid:true,immune:false,clear:()=>true})).toBe('perfect');expect(c.autoCounter?.delivery).toBe('blade');expect(a.attack.cancelled).toBe(false);
 });
});
describe('方向、红刃与四向出生采样',()=>{
 it('射手绕背或不存在时使用来弹反方向，重叠也不采用任意默认朝向',()=>{
  const diagonal=rangedCounterDirection({x:0,y:0},3,{x:-1,y:0},{x:10,y:10});expect(diagonal.x).toBeCloseTo(Math.SQRT1_2,12);expect(diagonal.y).toBeCloseTo(Math.SQRT1_2,12);
  const behind=rangedCounterDirection({x:0,y:0},3,{x:-1,y:0},{x:-10,y:0});expect(behind.x).toBeCloseTo(1,12);expect(behind.y).toBeCloseTo(0,12);
  const absent=rangedCounterDirection({x:0,y:0},1,{x:0,y:1});expect(absent.x).toBeCloseTo(0,12);expect(absent.y).toBeCloseTo(-1,12);
  const overlap=rangedCounterDirection({x:0,y:0},1,{x:0,y:1},{x:0,y:0});expect(overlap.x).toBeCloseTo(0,12);expect(overlap.y).toBeCloseTo(-1,12);
 });
 for(const facing of [0,1,2,3] as const)it(`方向${facing}从正式反斩剑尖出生，保持左右镜像与固定根`,()=>{
  const [x,y]=facingVector(facing),root={x:850,y:700},a:Attack={id:1,stage:1,facing,start:60,hit:new Set(),counter:'normal',delivery:'wind',windDirection:{x,y}};
  const s=new SwordWindSystem(),w=s.launch(a,root,115,24)!,birth=swordWindBirth(a,root,w.config),tip=counterVisual(a,115,true).weapon!.tip;
  const angle=Math.atan2(y,x),anchor=w.config.art.attachments[facing===0?0:facing===1?1:2],ax=anchor[0],ay=anchor[1]*(facing===2?-1:1);
  expect(w.position.x+w.visualOffset.x+ax*Math.cos(angle)-ay*Math.sin(angle)).toBeCloseTo(root.x+tip.x,6);
  expect(w.position.y+w.visualOffset.y+ax*Math.sin(angle)+ay*Math.cos(angle)).toBeCloseTo(root.y+tip.y,6);
  expect(birth.position).toEqual(w.position);expect(root).toEqual({x:850,y:700});
 });
 it('远程成功无本体受力目标时，红刃仍按接触ID绑定正式反斩',()=>{
  const f=new CombatFeedback(),base:FeedbackEvent={id:'parry:shot',kind:'parry-contact',at:0,attackId:'shot',targetId:'',point:{x:0,y:0},incoming:{x:1,y:0},blade:{x:0,y:1},deflect:{x:0,y:1},quality:'normal',material:'slime'};
  f.emit(base);f.emit({...base,id:'counter:1',kind:'counter-start',at:60,attackId:'player:1',targetId:'spore',sourceContactId:'shot',until:375});f.advance(115,'player:1',false);
  expect(f.bladeGlow(115,{x:850,y:700},{grip:{x:0,y:-25},tip:{x:30,y:-25}},3)).toMatchObject({counterId:'player:1'});
  expect(f.reaction('spore',115,'spore')).toBeNull();expect(f.drain().some(e=>e.kind==='counter-hit')).toBe(false);
 });
 it('30/60/120Hz与抖动步长在同一发射及接触轨迹得到一致结果',()=>{
  const traces=[1000/30,1000/60,1000/120,[7,21,4,33,12]].map(step=>{const a=setup(),hits:number[]=[];let prev=a.at,i=0;
   while(prev<a.at+700){const n=Array.isArray(step)?step[i++%step.length]:step,now=Math.min(a.at+700,prev+n);a.tick(prev,now);hits.push(...a.fly(prev,now).filter(e=>e.target).map(e=>e.at));prev=now;}
   return {releases:a.releases,hits};});
  for(const t of traces){expect(t.releases).toEqual(traces[0].releases);expect(t.hits).toHaveLength(1);expect(t.hits[0]).toBeCloseTo(traces[0].hits[0],5);}
 });
 it('孢卫训练明确提示剑气，练习和正式攻击共用远程接触裁决',()=>{
  const p=new ParryTraining();p.select('spore',{id:'dummy',x:850,y:650},0,{x:850,y:820});expect(p.feedback).toContain('远程弹反自动发出剑气');expect(p.projection?.type).toBe('spore');expect(p.projection?.hp).toBe(1);p.reset();expect(p.projection).toBeNull();
 });
});
