import {clearMotionLine,motionBlocked,clearMeleeLine,type Point} from "./obstacles";
import {sweepMove,PARRY} from "./combat";
export const ENEMY_ATTACK={slime:{windup:450,lock:120,active:100,recovery:260,step:34,cooldown:1100,damage:10},leaf:{windup:650,lock:150,active:130,recovery:320,step:12,cooldown:1400,damage:18},range:100,halfAngle:80*Math.PI/180} as const;
export type AttackGeometry={a:Point;b:Point;radius:number};
export type EnemyAttack={attackId:string;attackerId:string;type:"slime"|"leaf";startedAt:number;lockAt:number;contactAt:number;activeUntil:number;recoveryUntil:number;direction:Point;locked:boolean;shape:"sweep";range:number;halfAngle:number;parryable:boolean;damage:number;cancelled:boolean;resolved:boolean;emitted:boolean;motionAt:number;scanAt:number;previousGeometry?:AttackGeometry;geometry?:AttackGeometry;actualContactAt?:number;chargeSound?:boolean;strikeSound?:boolean};
export type EnemyContact={at:number;attack:EnemyAttack;origin:Point;geometry?:AttackGeometry;normal?:Point;training?:boolean};
export function aim(origin:Point,target:Point,fallback:Point={x:0,y:1}):Point {const d=Math.hypot(target.x-origin.x,target.y-origin.y);return d>1e-7?{x:(target.x-origin.x)/d,y:(target.y-origin.y)/d}:{...fallback};}
export function createEnemyAttack(attackerId:string,serial:number,type:string,now:number,origin:Point,target:Point,windup?:number):EnemyAttack {
 const kind=type==="leaf"?"leaf":"slime",m=ENEMY_ATTACK[kind],duration=windup??m.windup;
 // contactAt只表示攻击段起点；首次真实接触另记actualContactAt。
 return {attackId:`${attackerId}:${serial}`,attackerId,type:kind,startedAt:now,lockAt:now+duration-m.lock,contactAt:now+duration,activeUntil:now+duration+m.active,recoveryUntil:now+duration+m.active+m.recovery,direction:aim(origin,target),locked:false,shape:"sweep",range:ENEMY_ATTACK.range,halfAngle:ENEMY_ATTACK.halfAngle,parryable:true,damage:m.damage,cancelled:false,resolved:false,emitted:false,motionAt:0,scanAt:now};
}
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
export function sampleEnemyAttack(a:EnemyAttack,now:number,root:Point) {
 const m=ENEMY_ATTACK[a.type];const phase:"charge"|"commit"|"active"|"recovery"=now<a.lockAt?"charge":now<a.contactAt?"commit":now<a.activeUntil?"active":"recovery";
 const start=phase==="charge"?a.startedAt:phase==="commit"?a.lockAt:phase==="active"?a.contactAt:a.activeUntil,end=phase==="charge"?a.lockAt:phase==="commit"?a.contactAt:phase==="active"?a.activeUntil:a.recoveryUntil,progress=clamp((now-start)/(end-start)),active=clamp((now-a.contactAt)/m.active),d=a.direction,angle=Math.atan2(d.y,d.x)+(a.type==="leaf"?-.85+active*1.7:0);
 const geometry:AttackGeometry=a.type==="slime"?{a:{x:root.x+d.x*12,y:root.y+d.y*12},b:{x:root.x+d.x*12,y:root.y+d.y*12},radius:28}:{a:{x:root.x+Math.cos(angle)*16,y:root.y+Math.sin(angle)*16},b:{x:root.x+Math.cos(angle)*59,y:root.y+Math.sin(angle)*59},radius:13};
 const offset=a.type==="slime"?phase==="active"?{x:0,y:-Math.sin(progress*Math.PI)*13}:phase==="recovery"?{x:0,y:-Math.sin(progress*Math.PI*2)*(1-progress)*4}:{x:0,y:phase==="commit"?-progress*3:progress*3}:{x:phase==="commit"?-d.x*progress*5:0,y:phase==="commit"?-d.y*progress*5:phase==="recovery"?Math.sin(progress*Math.PI)*2:0};
 return {phase,progress,direction:{...d},frame:phase==="charge"?1:phase==="commit"?2:phase==="active"?2:progress<.35?3:0,offset,motion:m.step*active,geometry,previousGeometry:a.previousGeometry??geometry,warningProgress:clamp((now-a.startedAt)/(a.contactAt-a.startedAt)),active:now>=a.contactAt&&now<a.activeUntil&&!a.cancelled};
}
export function geometryTouches(g:AttackGeometry,p:Point) {const dx=g.b.x-g.a.x,dy=g.b.y-g.a.y,u=clamp(((p.x-g.a.x)*dx+(p.y-g.a.y)*dy)/(dx*dx+dy*dy||1));return Math.hypot(p.x-g.a.x-dx*u,p.y-g.a.y-dy*u)<=g.radius+1e-7;}
export const attackTouches=(event:EnemyContact,p:Point)=>geometryTouches(event.geometry??sampleEnemyAttack(event.attack,event.at,event.origin).geometry,p);
export function delayEnemyAttack(a:EnemyAttack,ms:number) {
 // 全部阶段共用有效时钟；受击暂停不让缩圈或姿态继续前进。
 for(const key of ["startedAt","lockAt","contactAt","activeUntil","recoveryUntil","scanAt"] as const)a[key]+=ms;
}
export function advanceEnemyAttack(a:EnemyAttack,root:Point,target:Point,now:number,space={blocked:motionBlocked,clear:clearMotionLine,melee:clearMeleeLine}):EnemyContact|null {
 if(a.cancelled)return null;
 if(!a.locked){a.direction=aim(root,target,a.direction);if(now+1e-7>=a.lockAt)a.locked=true;}
 let cursor=Math.max(a.scanAt,a.contactAt),event:EnemyContact|null=null;const end=Math.min(now,a.activeUntil);
 // 小段扫描复用同一姿态几何；二分首次接触，不把尚未命中的候选标为已结算。
 while(cursor<=end+1e-7&&now>=a.contactAt) {
  const to=Math.min(end,cursor+5),before={x:root.x,y:root.y},fromMotion=a.motionAt,nextMotion=sampleEnemyAttack(a,to,root).motion,next={...before};
  sweepMove(next,a.direction.x*(nextMotion-fromMotion),a.direction.y*(nextMotion-fromMotion),space.blocked,space.clear);
  const direct=space.clear(before,next);
  const at=(time:number)=>{const u=to>cursor?(time-cursor)/(to-cursor):1,origin=direct?{x:before.x+(next.x-before.x)*u,y:before.y+(next.y-before.y)*u}:{...before};
   // 沿碰撞角滑动的扫掠路径不能用直线插值切入禁行区；预测与首次接触复用真实移动。
   if(!direct)sweepMove(origin,a.direction.x*(nextMotion-fromMotion)*u,a.direction.y*(nextMotion-fromMotion)*u,space.blocked,space.clear);
   return {origin,geometry:sampleEnemyAttack(a,time,origin).geometry};};
  let first:number|null=null;
  if(!a.emitted&&!a.resolved)for(let t=cursor;t<=to+1e-7;t=Math.min(to,t+1)) {
   const s=at(t);if(geometryTouches(s.geometry,target)&&space.melee(s.origin,target,a.attackerId)) {let lo=Math.max(cursor,t-1),hi=t;for(let i=0;i<18&&hi-lo>1e-6;i++){const mid=(lo+hi)/2,g=at(mid);if(geometryTouches(g.geometry,target)&&space.melee(g.origin,target,a.attackerId))hi=mid;else lo=mid;}first=hi;break;}if(t>=to)break;
  }
  a.previousGeometry=a.geometry;
  if(first!==null){const s=at(first);Object.assign(root,s.origin);a.geometry=s.geometry;a.motionAt=fromMotion+(nextMotion-fromMotion)*(to>cursor?(first-cursor)/(to-cursor):1);a.scanAt=first;a.actualContactAt=first;a.emitted=true;event={at:first,attack:a,origin:s.origin,geometry:s.geometry,normal:{x:-a.direction.x,y:-a.direction.y}};break;}
  Object.assign(root,next);a.motionAt=nextMotion;a.geometry=sampleEnemyAttack(a,to,root).geometry;a.scanAt=to;if(to>=end)break;cursor=to;
 }
 if(now>=a.activeUntil&&!event)a.resolved=true;
 return event;
}
export function predictEnemyContact(a:EnemyAttack,root:Point,target:Point,now:number,space={blocked:motionBlocked,clear:clearMotionLine,melee:clearMeleeLine},pausedFor=0) {if(a.cancelled||a.emitted||a.resolved||now>=a.activeUntil)return null;const copy:EnemyAttack={...a,direction:{...a.direction}},point={x:root.x,y:root.y};delayEnemyAttack(copy,Math.max(0,pausedFor));return advanceEnemyAttack(copy,point,target,copy.activeUntil,space)?.at??null;}
export const warningQuality=(lead:number|null)=>lead===null||lead<0?"none":lead<PARRY.precise?"perfect":lead<PARRY.active?"normal":"charge";
