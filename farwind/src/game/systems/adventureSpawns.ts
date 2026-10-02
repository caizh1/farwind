import {clearMotionLine,motionBlocked,type Point} from './obstacles';
import type {EncounterDefinition} from '../../data/maps/windbell/encounters';
export function adventureExit(d:Point,player:Point):Point|undefined{
 const angle=Math.atan2(player.y-d.y,player.x-d.x);
 for(let n=0;n<16;n++){
  const a=angle+n*Math.PI/8,p={x:d.x+Math.cos(a)*380,y:d.y+Math.sin(a)*380};
  if(!motionBlocked(p.x,p.y)&&clearMotionLine(d,p))return p;
 }
}
export function exitClearance(p:Point,a:Point,b:Point){
 const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
 return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
}
// 每次最多检查一百六十个候选；直线通路是可复核的可达路径，不在正式帧里同步寻全图。
export function adventureSpawn(d:Pick<EncounterDefinition,'x'|'y'>,player:Point,occupied:readonly Point[],slot:number):Point|undefined{
 // 出生时留出一条宽一百二十像素的真实地形通道，避免整波围住出口。
 const exit=adventureExit(d,player);if(!exit)return;
 for(let n=0;n<160;n++){
  const angle=(n+slot*11)*Math.PI/20,radius=120+Math.floor(n/40)*65;
  const p={x:d.x+Math.cos(angle)*radius,y:d.y+Math.sin(angle)*radius};
  if(Math.hypot(p.x-player.x,p.y-player.y)<220||exitClearance(p,d,exit)<60||motionBlocked(p.x,p.y)||!clearMotionLine(p,d)||occupied.some(e=>Math.hypot(e.x-p.x,e.y-p.y)<65))continue;
  return p;
 }
}
