import type {EnemyAttack} from './enemyAttack';
import {isBossLaser,laserHazard,laserSample} from './bossLaser';
import type {WolfClawSkin,WolfClawPose} from './wolfClaw';
import type {Point} from './obstacles';

// 沿现有正面高清树臂轮廓分离双臂，抬肘时不拉扯面具、胸核和腿部。
const point=(x:number,y:number)=>({x:(x-223.36487570168404)/480,y:(y-488)/480});
const arm=(outline:number[],shoulder:number[],elbow:number[],tip:number[]):WolfClawSkin=>({outline:Array.from({length:outline.length/2},(_,i)=>point(outline[i*2],outline[i*2+1])),shoulder:point(shoulder[0],shoulder[1]),elbow:point(elbow[0],elbow[1]),tip:point(tip[0],tip[1]),bend:1});
export const BOSS_FLEX_ARMS=[
 arm([172,151,155,202,137,240,126,283,140,334,196,424,169,440,60,405,15,345,2,300,2,250,45,200,100,170,145,151],[158,176],[85,240],[160,396]),
 arm([283,160,320,175,359,200,400,227,442,272,447,328,434,376,395,426,340,444,329,430,343,390,351,341,326,296,315,260,298,219,280,198],[294,181],[355,254],[361,412]),
];
export function deformBossFlex(skin:WolfClawSkin,p:Point,pose:WolfClawPose):Point{
 const smooth=(x:number)=>{const u=Math.max(0,Math.min(1,x));return u*u*(3-2*u);};
 const turn=(p:Point,c:Point,angle:number)=>{const x=p.x-c.x,y=p.y-c.y;return {x:c.x+x*Math.cos(angle)-y*Math.sin(angle),y:c.y+x*Math.sin(angle)+y*Math.cos(angle)};};
 // 镰刃末端向内弯，不能用狼的直腿投影判断前臂，否则半片镰刃会留在原位。
 const elbow=smooth((p.y-skin.elbow.y+.06)/.12),root=smooth((p.y-skin.shoulder.y)/.08),bent=turn(p,skin.elbow,pose.elbow*elbow),rotated=turn(bent,skin.shoulder,pose.shoulder);
 return {x:p.x+(rotated.x-p.x)*root,y:p.y+(rotated.y-p.y)*root};
}
export function sampleBossFlex(a:EnemyAttack|null|undefined,now:number,arm:number):WolfClawPose{
 if(!isBossLaser(a)||a!.cancelled||now<a!.startedAt||now>=a!.recoveryUntil)return {shoulder:0,elbow:0};
 const attack=a!,smooth=(x:number)=>{const u=Math.max(0,Math.min(1,x));return u*u*(3-2*u);};
 const lower=attack.contactAt+laserSample(laserHazard(attack),now).echo,u=now<attack.contactAt?smooth((now-attack.startedAt)/(attack.contactAt-attack.startedAt)):now<lower?1:1-smooth((now-lower)/(attack.recoveryUntil-lower));
 if(u===0)return {shoulder:0,elbow:0};
 return {shoulder:(arm===0?.7:-.7)*u,elbow:(arm===0?-3.4:3.9)*u};
}
