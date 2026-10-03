import type {CampBossKind} from '../../data/maps/windbell/campBosses';
import type {EnemyAttack} from './enemyAttack';

// 连续关节姿态只改变画面；攻击实例仍独占锁向、碰撞、伤害和位移。
export type BossMotionPose={lean:number;compress:number;head:number;left:number;right:number;lift:number;stride:number;sway:number};
const neutral=():BossMotionPose=>({lean:0,compress:0,head:0,left:0,right:0,lift:0,stride:0,sway:0});
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const smooth=(x:number)=>{const u=clamp(x);return u*u*(3-2*u);};
const mix=(a:BossMotionPose,b:BossMotionPose,u:number):BossMotionPose=>{
 const result=neutral();for(const k of Object.keys(result) as (keyof BossMotionPose)[])result[k]=a[k]+(b[k]-a[k])*u;return result;
};
const pose=(values:Partial<BossMotionPose>):BossMotionPose=>({...neutral(),...values});

function attackPoses(kind:CampBossKind,a:EnemyAttack):[BossMotionPose,BossMotionPose]{
 const skill=a.bossSkill??0,side=(a.bossPart??0)%2?-1:1;
 if(kind==='thorn-crown'){
  if(skill===0||skill===3||skill===5)return [pose({lean:-.045,compress:.09,head:-.09,left:-.24,right:-.24}),pose({lean:.09,compress:-.045,head:.13,left:.34,right:.28,lift:skill===3?.065:.035})];
  if(skill===1)return [pose({lean:-.025,head:-.08}),pose({lean:.035,head:.06})];
  if(skill===2)return [pose({lean:.025,sway:-.09,head:.12}),pose({lean:-.025,sway:.16,head:-.18,left:.2,right:-.2})];
  return [pose({compress:.04,head:.05}),pose({compress:-.05,head:-.32,lean:-.025,left:-.1,right:-.1})];
 }
 if(kind==='crag-tusk'){
  if(skill===0)return [pose({lean:-.035,compress:.065,head:.16,left:-.13,right:-.13}),pose({lean:.08,compress:.025,head:.25,left:.23,right:.2})];
  if(skill===1)return [pose({head:-.23,sway:-.05*side,lean:-.02}),pose({head:.26,sway:.08*side,lean:.045})];
  if(skill===2||skill===3)return [pose({lean:-.02,compress:-.07,head:-.14,left:-.25,right:-.25,lift:.02}),pose({compress:.12,head:.2,left:.15,right:.15,lean:.035})];
  if(skill===4)return [pose({compress:-.04,head:-.12,left:-.2,right:-.2}),pose({compress:.09,head:.13,lean:.02})];
  return [pose({compress:.04,head:.16}),pose({compress:-.045,head:-.24,lean:.025,left:.15,right:-.15})];
 }
 if(kind==='spore-heart'){
  if(skill===2)return [pose({lean:-.025,sway:-.07*side,left:-.32*side,right:.25*side}),pose({lean:.04,sway:.1*side,left:.4*side,right:-.33*side,head:.1})];
  if(skill===1)return [pose({compress:-.055,left:-.32,right:.32,head:-.07}),pose({compress:.085,left:.28,right:-.28,head:.1})];
  if(skill===3)return [pose({compress:.075,head:-.1,left:.2,right:-.2}),pose({compress:-.06,head:.14,left:-.28,right:.28})];
  if(skill===4)return [pose({compress:-.03,left:-.26,right:.26,head:-.07}),pose({compress:.045,left:.26,right:-.26,head:.08})];
  if(skill===5)return [pose({sway:-.035,left:-.25,right:.08}),pose({sway:.045,left:.25,right:-.18,compress:.05})];
  return [pose({compress:.055,head:-.1,left:-.16,right:.16,sway:-.025}),pose({compress:-.045,head:.15,left:.22,right:-.22,lean:.035})];
 }
 if(skill===0)return [pose({sway:-.055*side,left:-.48*side,right:.32*side,head:-.06}),pose({sway:.075*side,left:.5*side,right:-.42*side,head:.1})];
 if(skill===3)return [pose({compress:.025,left:.16,right:-.16}),pose({compress:.07,left:.4,right:-.4,head:.08})];
 if(skill===2)return [pose({compress:-.035,left:-.35,right:.35}),pose({compress:.055,left:.32,right:-.32,head:.08})];
 if(skill===4)return [pose({sway:-.04,lean:-.025,left:-.15,right:.2}),pose({sway:.055,lean:.035,left:.18,right:-.25})];
 if(skill===5)return [pose({compress:.04,left:.2,right:-.2,head:.05}),pose({compress:-.04,left:-.35,right:.35,lift:.025,head:-.08})];
 return [pose({lean:-.025,head:-.08,left:-.26,right:.26}),pose({lean:.025,head:.12,left:.3,right:-.3})];
}

export function sampleBossMotion(kind:CampBossKind,a:EnemyAttack|null|undefined,now:number,distance:number,walking:boolean):BossMotionPose{
 const quadruped=kind==='thorn-crown'||kind==='crag-tusk',t=(a&&!a.cancelled?now-a.startedAt:now)/1000;
 const breath=Math.sin(t*(quadruped?2.6:2)),idle=pose({compress:breath*.009,head:Math.sin(t*1.8)*.018,sway:Math.sin(t*1.3)*.009,left:Math.sin(t*2-.6)*.025,right:Math.sin(t*2+.6)*.025});
 if(a&&!a.cancelled&&now>=a.startedAt&&now<a.recoveryUntil){
  const [anticipate,strike]=attackPoses(kind,a),release=Math.min(100,(a.contactAt-a.startedAt)*.16),peak=a.contactAt+Math.min(90,(a.activeUntil-a.contactAt)*.4);
  let result:BossMotionPose;
  if(now<a.contactAt-release)result=mix(idle,anticipate,smooth((now-a.startedAt)/(a.contactAt-release-a.startedAt)));
  else if(now<peak)result=mix(anticipate,strike,smooth((now-(a.contactAt-release))/(peak-(a.contactAt-release))));
  else if(now<a.activeUntil)result=mix(strike,mix(strike,anticipate,.18),smooth((now-peak)/(a.activeUntil-peak)));
  else result=mix(mix(strike,anticipate,.18),idle,smooth((now-a.activeUntil)/(a.recoveryUntil-a.activeUntil)));
  // 长施法仍有枝叶、冠部和呼吸的独立运动，不停成一张姿势图。
  result.head+=Math.sin(t*5)*.012;result.sway+=Math.sin(t*4-.7)*.006;return result;
 }
 if(walking){const cycle=distance/(quadruped?68:52)*Math.PI*2;idle.stride=Math.sin(cycle);idle.lift=Math.abs(Math.sin(cycle))*(quadruped?.012:.018);idle.lean=quadruped?.015:Math.sin(cycle)*.014;idle.left+=Math.sin(cycle)*.1;idle.right-=Math.sin(cycle)*.1;idle.head+=Math.sin(cycle-.5)*.025;}
 return idle;
}

// 坐标以主体高度归一、脚底为零；权重在关节周围平滑过渡，避免切片缝隙。
export function deformBossPoint(kind:CampBossKind,sideView:boolean,x:number,y:number,width:number,p:BossMotionPose):[number,number]{
 const v=1+y,upper=smooth(-y/.75),quadruped=kind==='thorn-crown'||kind==='crag-tusk';
 let dx=p.lean*upper,dy=p.compress*(-y)-p.lift*upper;
 const rotate=(cx:number,cy:number,angle:number,weight:number)=>{const bx=x-cx,by=y-cy,c=Math.cos(angle),s=Math.sin(angle);dx+=(bx*c-by*s-bx)*weight;dy+=(bx*s+by*c-by)*weight;};
 if(quadruped){
  const leg=smooth((v-.55)/.26),spread=sideView?1:smooth((Math.abs(x)/width-.12)/.2),sign=Math.tanh(x/width*6);
  dx+=p.stride*.045*sign*leg*spread;dy-=Math.max(0,p.stride*sign)*.04*leg*spread;
  const front=sideView?smooth((x/width+.1)/.5):smooth((v-.22)/.4);
  rotate(sideView?width*.2:0,-.42,p.head,front*(1-leg*.7)*.55);
  rotate(sign*width*.24,-.37,p.left+(p.right-p.left)*smooth((x/width+.15)/.3),leg*.6);
  dx+=p.sway*smooth((-x/width-.12)/.5)*(1-leg);
 }else{
  const arm=smooth((Math.abs(x)/width-.12)/.4)*smooth((v-.27)/.24),sign=x>=0?1:-1;
  rotate(sign*width*.23,-.56,x>=0?p.right:p.left,arm*.65);
  const leg=smooth((v-.72)/.22),legSide=Math.tanh(x/width*6);dx+=p.stride*.035*legSide*leg;dy-=Math.max(0,p.stride*legSide)*.027*leg;
  rotate(0,-.62,p.head,smooth((-y-.58)/.26)*.75);
 }
 dx+=p.sway*upper*upper;
 return [x+dx,y+dy];
}

// 只缓存表现过渡；重复采样、暂停和时间回退不会累计动画或推进战斗。
export class BossMotion{
 current=neutral();now?:number;
 sample(kind:CampBossKind,a:EnemyAttack|null|undefined,now:number,distance:number,walking:boolean){
  const target=sampleBossMotion(kind,a,now,distance,walking),dt=this.now===undefined?Infinity:now-this.now;
  if(dt<0||dt>250||kind==='thorn-crown'&&a?.bossSkill===1&&!a.cancelled)this.current=target;
  else if(dt>0)this.current=mix(this.current,target,1-Math.exp(-dt/45));
  this.now=now;return this.current;
 }
}
