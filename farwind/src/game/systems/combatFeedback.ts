import type {CounterKind} from './combat';
import type {Point} from './obstacles';
export type FeedbackMode='A'|'B'|'C'|'D';
export type FeedbackKind='guard-start'|'enemy-charge'|'enemy-strike'|'parry-contact'|'parry-perfect-contact'|'deflect-release'|'counter-start'|'counter-swing'|'counter-hit'|'afterguard';
export type FeedbackMaterial='slime'|'leaf'|'straw';
export type FeedbackEvent=Readonly<{id:string;kind:FeedbackKind;at:number;targetId:string;attackId:string;point:Readonly<Point>;incoming:Readonly<Point>;blade:Readonly<Point>;deflect:Readonly<Point>;quality:CounterKind;material:FeedbackMaterial;until?:number;alive?:boolean;depth?:number;legacyHit?:'hit'|'straw'}>;
export const FEEDBACK={history:96,effects:32,reactions:24,contactLife:150,hitLife:115,afterguardLife:65,peak:60,recover:160,secondaryLife:95,release:20,counterMotion:20} as const;
// 仅影响成功反馈；红刃在拨开后建立，沿正式反斩的收势衰减，不表示额外伤害。
export const BLADE_GLOW={start:20,rise:40,fade:145,maxLife:450,width:6,edgeWidth:2.6} as const;
export const feedbackVisual=(mode:FeedbackMode)=>mode==='C'||mode==='D';
export const feedbackAudio=(mode:FeedbackMode)=>mode==='B'||mode==='D';
// 来招已被截住：保留出手事实，声音提交时只移除同一攻击的冲撞；其他威胁仍完整发声。
export function audibleFeedback(events:readonly FeedbackEvent[]) {
 const intercepted=new Set(events.filter(e=>['parry-contact','parry-perfect-contact','afterguard'].includes(e.kind)).map(e=>e.attackId));
 return events.filter(e=>e.kind!=='enemy-strike'||!intercepted.has(e.attackId));
}
// 接触小亮边位于两名角色的局部接触层，轨迹仍按武器原前后层；不升到全场景顶层。
export const feedbackContactDepth=(playerY:number,targetY=playerY)=>Math.max(playerY,targetY)+.15;
export function unit(p:Point,fallback:Point={x:1,y:0}):Point {const n=Math.hypot(p.x,p.y);return n>1e-7?{x:p.x/n,y:p.y/n}:{...fallback};}
// 几何接触投影到真实防御刃的25%至85%，避开剑柄；仅作表现，不修改伤害几何。
export function parryContactPoint(root:Point,weapon:{grip:Point;tip:Point},attackPoint:Point) {
 const blade=unit({x:weapon.tip.x-weapon.grip.x,y:weapon.tip.y-weapon.grip.y}),length=Math.hypot(weapon.tip.x-weapon.grip.x,weapon.tip.y-weapon.grip.y),grip={x:root.x+weapon.grip.x,y:root.y+weapon.grip.y};
 const u=Math.max(.25,Math.min(.85,((attackPoint.x-grip.x)*blade.x+(attackPoint.y-grip.y)*blade.y)/length));
 return {point:{x:grip.x+blade.x*length*u,y:grip.y+blade.y*length*u},blade};
}
export function deflectDirection(incoming:Point,blade:Point) {const b=unit(blade),d=unit(incoming);const sign=b.x*d.y-b.y*d.x>=0?1:-1;return unit({x:b.x*sign*.9-d.x*.25,y:b.y*sign*.9-d.y*.25});}
export class CombatFeedback {
 mode:FeedbackMode='D'; generation=0;resetAt=0;
 history:FeedbackEvent[]=[];effects:FeedbackEvent[]=[];private queue:FeedbackEvent[]=[];
 private seen=new Set<string>();private release:FeedbackEvent[]=[];
 private swings:FeedbackEvent[]=[];
 private glow:{event:FeedbackEvent;counterId?:string;until:number}|null=null;
 private reactions=new Map<string,{parry:FeedbackEvent;hit?:FeedbackEvent}>();
 emit(value:FeedbackEvent) {
  const id=`${this.generation}:${value.id}`;if(this.seen.has(id))return false;
  // 输入快照深拷贝并冻结；受击后的根位移不会倒改接触位置。
  const event=Object.freeze({...value,id,point:Object.freeze({...value.point}),incoming:Object.freeze({...value.incoming}),blade:Object.freeze({...value.blade}),deflect:Object.freeze({...value.deflect})});
  this.seen.add(id);this.queue.push(event);if(this.queue.length>FEEDBACK.history)this.queue.shift();this.history.push(event);
  if(this.history.length>FEEDBACK.history){const old=this.history.shift()!;this.seen.delete(old.id);}
  if(['parry-contact','parry-perfect-contact','counter-hit','afterguard'].includes(event.kind)) {this.effects.push(event);if(this.effects.length>FEEDBACK.effects)this.effects.shift();}
  if(event.kind==='parry-contact'||event.kind==='parry-perfect-contact') {
   this.glow={event,until:event.at+BLADE_GLOW.maxLife};
   this.reactions.set(event.targetId,{parry:event});if(this.reactions.size>FEEDBACK.reactions)this.reactions.delete(this.reactions.keys().next().value!);
   this.release.push(event);if(this.release.length>FEEDBACK.effects)this.release.shift();
  }
  if(event.kind==='counter-hit') {const r=this.reactions.get(event.targetId);if(r&&event.alive!==false)r.hit=event;else if(event.alive===false)this.reactions.delete(event.targetId);}
  if(event.kind==='guard-start')this.glow=null;
  if(event.kind==='counter-start'){
   if(this.glow&&this.glow.event.targetId===event.targetId)this.glow={...this.glow,counterId:event.attackId,until:Math.min(this.glow.until,event.until??this.glow.until)};
   this.swings.push(event);if(this.swings.length>FEEDBACK.effects)this.swings.shift();
  }
  return true;
 }
 advance(now:number,activeCounterId?:string|null,deflecting?:boolean) {
  if(this.glow&&(now>=this.glow.until||(deflecting===false&&activeCounterId!==this.glow.counterId)))this.glow=null;
  // 正式攻击已经启动，且仍在执行，首个实际起势姿态到达时只消费一次破风事件。
  for(const event of this.swings)if(now>=event.at+FEEDBACK.counterMotion&&(activeCounterId===undefined||activeCounterId===event.attackId))this.emit({...event,id:`swing:${event.attackId}`,kind:'counter-swing',at:event.at+FEEDBACK.counterMotion});
  this.swings=this.swings.filter(e=>now<e.at+FEEDBACK.counterMotion&&(activeCounterId===undefined||activeCounterId===e.attackId));
  for(const event of this.release.filter(e=>now>=e.at+FEEDBACK.release))this.emit({...event,id:`release:${event.attackId}`,kind:'deflect-release',at:event.at+FEEDBACK.release});
  this.release=this.release.filter(e=>now<e.at+FEEDBACK.release);
  this.effects=this.effects.filter(e=>now-e.at<(e.kind==='counter-hit'?FEEDBACK.hitLife:e.kind==='afterguard'?FEEDBACK.afterguardLife:FEEDBACK.contactLife));
  for(const [id,r] of this.reactions)if(now>=(r.parry.until??r.parry.at)||r.parry.alive===false)this.reactions.delete(id);
 }
 drain(){const events=this.queue;this.queue=[];return events;}
 cancelRelease(){this.release=[];this.swings=[];this.glow=null;}
 bladeGlow(now:number,root:Point,weapon:{grip:Point;tip:Point}|null,facing:number) {
  const g=this.glow;if(!g||!weapon||!feedbackVisual(this.mode)||now<g.event.at+BLADE_GLOW.start||now>=g.until)return null;
  const rise=Math.min(1,(now-g.event.at-BLADE_GLOW.start)/BLADE_GLOW.rise),fade=g.counterId?Math.min(1,(g.until-now)/BLADE_GLOW.fade):1;
  const alpha=rise*fade;if(alpha<=0)return null;
  return {id:g.event.id,quality:g.event.quality,alpha,counterId:g.counterId,
   // 剑柄不发光；每帧读取已提交姿态的实际剑尖，镜像由武器采样统一提供。
   start:{x:root.x+weapon.grip.x+(weapon.tip.x-weapon.grip.x)*.22,y:root.y+weapon.grip.y+(weapon.tip.y-weapon.grip.y)*.22},
   tip:{x:root.x+weapon.tip.x,y:root.y+weapon.tip.y},depth:root.y+(facing===1?-.05:.08),edgeDepth:root.y+.08};
 }
 reaction(id:string,now:number,type:string,alive=true) {
  const r=this.reactions.get(id);if(!r||!alive||now>=(r.parry.until??r.parry.at))return null;
  const e=r.parry,age=Math.max(0,now-e.at),remaining=e.until!-now;
  const strength=age<FEEDBACK.peak?.55+.45*(1-(1-age/FEEDBACK.peak)**2):remaining<FEEDBACK.recover?Math.max(0,remaining/FEEDBACK.recover):1;
  const secondary=r.hit?Math.max(0,1-(now-r.hit.at)/FEEDBACK.secondaryLife):0;
  const side=unit(e.deflect),incoming=unit(e.incoming),leaf=type==='leaf';
  return {x:(-incoming.x*7+side.x*(leaf?9:6))*strength-incoming.x*secondary*3,y:(-incoming.y*4+side.y*3)*strength-incoming.y*secondary*2,rotation:(side.x<0?-1:1)*(leaf?.28:.18)*strength+Math.sin(age/38)*.025*strength,frame:remaining<FEEDBACK.recover/2?0:3,strength,secondary,phase:age<FEEDBACK.peak?'impact':remaining<FEEDBACK.recover?'recover':'unbalanced'};
 }
 attackAudible(startedAt:number,root:Point|undefined,player:Point){return startedAt>=this.resetAt&&(!root||Math.hypot(root.x-player.x,root.y-player.y)<600);}
 reset(now=0){this.generation++;this.resetAt=now;this.history=[];this.queue=[];this.effects=[];this.release=[];this.swings=[];this.glow=null;this.seen.clear();this.reactions.clear();}
 snapshot(){return {mode:this.mode,generation:this.generation,events:this.history,effects:this.effects,pending:this.queue.length,delayed:this.release.length+this.swings.length,reactions:this.reactions.size,bladeGlow:this.glow};}
}
