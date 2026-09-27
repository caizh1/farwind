import {inPolygon,regionAt,type Point} from './village';
import type {GateId} from './defense';
const rect=(l:number,t:number,r:number,b:number):Point[]=>[{x:l,y:t},{x:r,y:t},{x:r,y:b},{x:l,y:b}];
// 保护／警戒是独立覆盖层；保留所有地理区域ID、世界和碰撞几何。
export const DEFENSE_ZONES = [
 {gateId:'east-gate',near:rect(2100,990,2280,1200),alert:rect(2280,990,2510,1250),
  activity:rect(1880,950,2300,1250),inside:rect(1880,950,2100,1250),intercept:{x:2190,y:1100},
  route:[{x:2470,y:1140},{x:2370,y:1090},{x:2140,y:1080}],spawn:rect(2340,1030,2510,1250)},
 // 北门纵深仅140像素，使用横向接入走廊，不机械复制东门的圆形半径。
 {gateId:'north-gate',near:rect(740,135,900,220),alert:rect(580,85,900,190),
  activity:rect(700,95,1000,520),inside:rect(700,220,1000,520),intercept:{x:850,y:155},
  route:[{x:620,y:120},{x:800,y:130},{x:820,y:180}],spawn:rect(590,85,710,140)},
 {gateId:'south-gate',near:rect(800,1820,1040,1960),alert:rect(800,1920,1290,2140),
  activity:rect(760,1580,1130,2000),inside:rect(760,1580,1130,1820),intercept:{x:950,y:1900},
  route:[{x:1240,y:2070},{x:1050,y:2000},{x:900,y:1860}],spawn:rect(1120,2020,1290,2140)},
] satisfies {gateId:GateId;near:Point[];alert:Point[];activity:Point[];inside:Point[];intercept:Point;route:Point[];spawn:Point[]}[];
export const zoneFor=(id:GateId)=>DEFENSE_ZONES.find(z=>z.gateId===id)!;
export const inProtected=(p:Point)=>regionAt(p).id==='village'||DEFENSE_ZONES.some(z=>inPolygon(p,z.near));
export const locallyProtected=(id:GateId,p:Point)=>inPolygon(p,zoneFor(id).near)||inPolygon(p,zoneFor(id).inside);
export const inAlert=(id:GateId,p:Point)=>inPolygon(p,zoneFor(id).alert);
export const inActivity=(id:GateId,p:Point)=>inPolygon(p,zoneFor(id).activity);
export const safetyAt=(p:Point)=>regionAt(p).id==='village'?'村内保护区':inProtected(p)?'巡逻近郊':DEFENSE_ZONES.some(z=>inPolygon(p,z.alert))?'门外警戒带':'荒野';
// 沿折线路线的剩余距离；横向绕树也保留进度，不用单帧朝向判定逼近。
export function routeRemaining(id:GateId,p:Point){
 const route=zoneFor(id).route;let remaining=0,best=Infinity,result=Infinity;
 for(let i=route.length-2;i>=0;i--){const a=route[i],b=route[i+1],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),u=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(len*len)));
  const distance=Math.hypot(p.x-a.x-dx*u,p.y-a.y-dy*u);
  if(distance<best){best=distance;result=remaining+len*(1-u)+distance;}remaining+=len;
 }return result;
}
