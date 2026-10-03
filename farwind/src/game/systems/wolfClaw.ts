import type {EnemyAttack} from './enemyAttack';
import type {Point} from './obstacles';
import {sampleBossMotion,deformBossPoint} from './bossMotion';
import {CAMP_BOSSES} from '../../data/maps/windbell/campBosses';

const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const smooth=(n:number)=>{const u=clamp(n);return u*u*(3-2*u);};
export type WolfClawPose={shoulder:number;elbow:number};
export type WolfClawSkin={outline:Point[];shoulder:Point;elbow:Point;tip:Point;bend:number};
const skin=(foot:Point,outline:number[],shoulder:number[],elbow:number[],tip:number[],bend=1):WolfClawSkin=>{
 const point=(x:number,y:number)=>({x:(x-foot.x)/480,y:(y-foot.y)/480});
 return {outline:Array.from({length:outline.length/2},(_,i)=>point(outline[i*2],outline[i*2+1])),shoulder:point(...shoulder as [number,number]),elbow:point(...elbow as [number,number]),tip:point(...tip as [number,number]),bend};
};
// 轮廓沿现有图集的前腿外缘切分。坐标与主体一样以脚底为零，不新增纹理。
const right=skin({x:303.2361809045226,y:488},[340,275,385,276,423,310,456,391,488,423,565,440,600,467,600,495,417,495,392,450,366,399,338,346],[378,309],[437,408],[555,470]);
const downNear=skin({x:251.92156862745097,y:488},[249,296,284,301,313,332,287,374,244,413,224,447,225,490,132,490,134,454,174,405,203,355,222,319],[267,321],[224,385],[180,465],-1);
const downFar=skin({x:251.92156862745097,y:488},[105,346,130,349,147,374,116,402,95,446,87,465,3,467,3,431,54,398,81,364],[113,359],[75,410],[41,448],-1);
const up=skin({x:233.63934426229508,y:488},[376,216,401,217,417,269,420,325,433,372,460,405,461,440,394,442,377,401,382,353,371,287],[393,249],[399,342],[430,422]);
export function wolfClawSkin(view:string,part=0){return view==='down'?part%2?downFar:downNear:view==='up'?up:right;}
export const isWolfClaw=(a:EnemyAttack|null|undefined)=>a?.boss==='thorn-crown'&&a.bossSkill===1;

// 出手前160毫秒已经开始挥爪；到正式攻击段起点，前爪完成伸展才释放波刃。
export const wolfClawView=(a:EnemyAttack)=>Math.abs(a.direction.x)>Math.abs(a.direction.y)?'right':a.direction.y>0?'down':'up';
export function sampleWolfClaw(a:EnemyAttack|null|undefined,now:number,view=a?wolfClawView(a):'right'):WolfClawPose{
 if(!isWolfClaw(a)||a!.cancelled||now<a!.startedAt||now>=a!.recoveryUntil)return {shoulder:0,elbow:0};
 const attack=a!,swing=attack.contactAt-160;
 const raised={shoulder:-.52,elbow:-1.75},released={shoulder:view==='down'?-.05:view==='up'?-2.5:-.68,elbow:view==='down'?.45:.34},follow={shoulder:.12,elbow:-.26};
 const mix=(p:WolfClawPose,q:WolfClawPose,u:number)=>({shoulder:p.shoulder+(q.shoulder-p.shoulder)*u,elbow:p.elbow+(q.elbow-p.elbow)*u});
 if(now<swing)return mix({shoulder:0,elbow:0},raised,smooth((now-attack.startedAt)/(swing-attack.startedAt)));
 if(now<attack.contactAt)return mix(raised,released,smooth((now-swing)/160));
 if(now<attack.activeUntil)return mix(released,follow,smooth((now-attack.contactAt)/(attack.activeUntil-attack.contactAt)));
 return mix(follow,{shoulder:0,elbow:0},smooth((now-attack.activeUntil)/(attack.recoveryUntil-attack.activeUntil)));
}
export function deformWolfClaw(skin:WolfClawSkin,p:Point,pose:WolfClawPose):Point{
 const turn=(p:Point,c:Point,angle:number)=>{const x=p.x-c.x,y=p.y-c.y;return {x:c.x+x*Math.cos(angle)-y*Math.sin(angle),y:c.y+x*Math.sin(angle)+y*Math.cos(angle)};};
 const upper={x:skin.elbow.x-skin.shoulder.x,y:skin.elbow.y-skin.shoulder.y},length=Math.hypot(upper.x,upper.y),along=((p.x-skin.shoulder.x)*upper.x+(p.y-skin.shoulder.y)*upper.y)/length;
 const elbow=smooth((along-length+.045)/.09),root=smooth(along/.065),bent=turn(p,skin.elbow,pose.elbow*skin.bend*elbow),rotated=turn(bent,skin.shoulder,pose.shoulder*skin.bend);
 return {x:p.x+(rotated.x-p.x)*root,y:p.y+(rotated.y-p.y)*root};
}
export const wolfClawTravel=(a:EnemyAttack,now:number)=>clamp((now-a.contactAt)/(a.activeUntil-a.contactAt));
export function wolfClawTip(a:EnemyAttack,now:number,root:Point=a.bossGeometry!.point,view=wolfClawView(a)){
 const skin=wolfClawSkin(view,a.bossPart),tip=deformWolfClaw(skin,skin.tip,sampleWolfClaw(a,now,view)),p=sampleBossMotion('thorn-crown',a,now,0,false),width=view==='down'?505/480:view==='up'?468/480:607/480,[x,y]=deformBossPoint('thorn-crown',view==='right',tip.x,tip.y,width,p),height=CAMP_BOSSES['thorn-crown'].height;
 return {x:root.x+x*height*(view==='right'&&a.direction.x<0?-1:1),y:root.y+y*height};
}
// 释放点不再绑定当前前爪。画面与正式范围共同沿这条轨迹推进，终点位于预警内。
export function wolfClawWave(a:EnemyAttack,now:number){
 const root=a.bossGeometry!.point,angle=Math.atan2(a.direction.y,a.direction.x)+(a.bossGeometry!.offset??0),direction={x:Math.cos(angle),y:Math.sin(angle)},origin=wolfClawTip(a,a.contactAt),lift=CAMP_BOSSES['thorn-crown'].height*.25,u=wolfClawTravel(a,now),end={x:root.x+direction.x*(a.bossGeometry!.radius-12),y:root.y+direction.y*(a.bossGeometry!.radius-12)-lift},point={x:origin.x+(end.x-origin.x)*u,y:origin.y+(end.y-origin.y)*u},ground={x:point.x,y:point.y+lift};
 return {origin,point,ground,direction,travel:Math.hypot(point.x-origin.x,point.y-origin.y)};
}
export function wolfClawRadius(a:EnemyAttack,now:number){const wave=wolfClawWave(a,now),root=a.bossGeometry!.point;return Math.min(a.bossGeometry!.radius,Math.hypot(wave.ground.x-root.x+wave.direction.x*12,wave.ground.y-root.y+wave.direction.y*12));}
