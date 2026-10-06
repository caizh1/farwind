import {memoryStrength,type WindMemoryDifficulty} from '../../data/windMemoryDifficulty';
import type {Point} from './obstacles';
import {sweepMove} from './combat';
export type EastLocomotion={heading:number;speed:number;distance:number;now:number;turn?:{from:number;sign:number;elapsed:number;support:'left'|'right'}};
type Body=Point&{memoryDifficulty?:WindMemoryDifficulty;face?:Point;eastMotion?:EastLocomotion};
const SECTOR=Math.PI/4;
// 第四版游戏相机下，支撑脚实测横向一周期 59.56 单位；纵向投影为其 0.4852 倍。
export const eastWalkStride=(heading:number)=>59.56*(Math.sin(heading)**2+.4852*Math.cos(heading)**2);
const angleDelta=(a:number,b:number)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export function stopEastLocomotion(e:Body,now:number){if(e.eastMotion){e.eastMotion.speed=0;e.eastMotion.turn=undefined;e.eastMotion.now=now;if(e.face)e.eastMotion.heading=Math.round(Math.atan2(e.face.x,e.face.y)/SECTOR)*SECTOR;}}
// 转向与自主位移共享一个时钟；受击、攻击步进及传送不计入行走里程。
export function advanceEastLocomotion(e:Body,target:Point,now:number,dtMs:number,blocked:(x:number,y:number)=>boolean,clear:(a:Point,b:Point)=>boolean,brakingDistance=Infinity){
 const dt=Math.max(0,Math.min(.1,dtMs/1000));let m=e.eastMotion;
 if(!m||now<m.now||now-m.now>500)m=e.eastMotion={heading:Math.round(Math.atan2(e.face?.x??0,e.face?.y??1)/SECTOR)*SECTOR,speed:0,distance:m?.distance??0,now};
 m.now=now;const dx=target.x-e.x,dy=target.y-e.y,length=Math.hypot(dx,dy);if(!dt||length<.001)return;
 const desired=Math.atan2(dx,dy),sector=Math.round(m.heading/SECTOR),diff=angleDelta(desired,sector*SECTOR);
 const goal=Math.abs(diff)<SECTOR/2+Math.PI/36?sector*SECTOR:Math.round(desired/SECTOR)*SECTOR;
 const error=angleDelta(goal,m.heading),reverse=Math.abs(error)>Math.PI/2+.001;
 const wanted=reverse?0:Math.min(68*memoryStrength(e.memoryDifficulty).movement,Math.sqrt(2*340*Math.max(0,brakingDistance)));
 const oldSpeed=m.speed;m.speed+=Math.max(-340*dt,Math.min(200*dt,wanted-m.speed));
 if(!m.turn&&Math.abs(error)>.001&&(!reverse||m.speed<.1))m.turn={from:sector,sign:Math.sign(error),elapsed:0,support:(m.distance/eastWalkStride(m.heading))%1<.5?'left':'right'};
 if(m.turn){const turn=m.turn;turn.elapsed=Math.min(200,turn.elapsed+dt*1000);m.heading=(turn.from+turn.sign*turn.elapsed/200)*SECTOR;if(turn.elapsed>=200)m.turn=undefined;}
 const step=Math.min(length,(oldSpeed+m.speed)*.5*dt),before={x:e.x,y:e.y};
 if(step>0){if(length<=step+.001)sweepMove(e,dx,dy,blocked,clear);else sweepMove(e,Math.sin(m.heading)*step,Math.cos(m.heading)*step,blocked,clear);}
 const actual=Math.hypot(e.x-before.x,e.y-before.y);m.distance+=actual;
 if(step>.001&&actual<step*.1)m.speed=0;
 e.face={x:Math.sin(m.heading),y:Math.cos(m.heading)};
 return actual;
}
