import {fortressHeight,CITY_FORTRESS,FORTRESS_ARCHERS,FORTRESS_SOLIDS,FORTRESS_STAIR} from '../cityFortress';
import {ROAD_DECOR,ROAD_NEST,ROAD_POSTS} from '../merchantRoad';
import type { Prop } from '../world';
import {CITY_BUILDING_PROPS,CITY_STREET_PROPS,CITY_WALL} from '../cityLayout';

export const CITY = { left: 9690, right: 13860, top: -400, bottom: 2800, gate: { x: 9690, y: 1600 }, plaza: { x: 11790, y: 1600 } } as const;
export const TRADE_ROAD_NODES = [
  { name: '林缘', x: 4790, y: 1540, scale: 1 },
  { name: '密林', x: 5630, y: 1350, scale: 1.1 },
  { name: '河西岸', x: 6490, y: 1600, scale: 1.2 },
  { name: '桥东岸', x: 7750, y: 1600, scale: 1.35 },
  { name: '城外疏林', x: 8650, y: 1400, scale: 1.5 },
  { name: '门前道路', x: 9250, y: 1600, scale: 1.65 },
] as const;
export const TRADE_ROADS = [
  { id: 'city-trade-main', width: 230, service: false, points: [[4000,1600], ...TRADE_ROAD_NODES.map(n=>[n.x,n.y]), [9500,1770], [9690,1610], [9840,1450], [10200,1420], [10620,1600], [11790,1600]] },
  { id: 'city-trade-north', width: 110, service: false, points: [[4550,1540],[4900,1120],[5650,1000],[6280,1220],[6490,1600]] },
  { id: 'city-trade-nest', width: 90, service: false, points: [[6280,1220],[6100,1200],[6100,1050]] },
  { id: 'city-trade-cargo', width: 90, service: false, points: [[9150,1900],[9150,2180]] },
  { id: 'city-trade-south', width: 110, service: false, points: [[7750,1600],[8010,2040],[8660,2060],[9150,1900],[9470,1600]] },
  { id: 'city-square', width: 260, service: false, points: [[10500,1600],[11790,1600],[13000,1600]] },
  { id: 'city-north-street', width: 220, service: false, points: [[10800,2150],[10800,500],[11790,500],[13000,500],[13000,2200]] },
  { id: 'city-plaza-street', width: 240, service: false, points: [[11790,2200],[11790,1500],[11790,800],[13000,800]] },
] as const;
export const TRADE_RIVER = { id: 'trade-river', x: 7100, y: 1600, rx: 245, ry: 2200 };
// 石桥素材为740×400，地面根与桥面、栏杆、柱脚共用世界坐标。
export const TRADE_BRIDGE = { x: 6730, y: 1510, w: 740, h: 180 };
export const CITY_BRIDGE_FRAMES = [
  {name:'north-rail',x:48,y:30,w:644,h:74,solid:[644,26],foot:1510},
  {name:'south-rail',x:48,y:293,w:644,h:107,solid:[644,43],foot:1728},
  {name:'north-west',x:0,y:0,w:48,h:177,solid:[48,70],foot:1577},
  {name:'north-east',x:692,y:0,w:48,h:177,solid:[48,70],foot:1577},
  // 前柱切帧包含高出的灯饰，实体从柱帽开始，不把灯饰高度计入占地。
  {name:'south-west',x:0,y:230,w:48,h:170,solid:[48,133],foot:1800},
  {name:'south-east',x:692,y:230,w:48,h:170,solid:[48,133],foot:1800},
] as const;
export const CITY_ASSETS = ['gate-north','gate-south','gate-beam','wind-tower','wall','stone-bridge'] as const;
export const CITY_STOCK = { potion: 12, bread: 12, tea: 12, wood: 24, stone: 24, herb: 24, berry: 24 } as const;
export const CITY_PRICES = { potion: 18, bread: 7, tea: 10, wood: 4, stone: 4, herb: 5, berry: 3 } as const;
export const CITY_GUARD_POSTS = [
  ...[0,1,2,3].map(i=>({slot:`melee-${i}`,role:'melee' as const,x:9460+(i%2)*100,y:i<2?1660:1850,maxHP:600,armor:12})),
  ...FORTRESS_ARCHERS.map((p,i)=>({slot:`archer-${i}`,role:'archer' as const,...p,maxHP:300,armor:6})),
];
// 梯道上下端与墙顶走道共用地面投影；岗位只能由这两处出入。
export const CITY_WALL_ACCESS=[FORTRESS_STAIR,FORTRESS_STAIR] as const;
export const CITY_WALL_HEIGHT=CITY_FORTRESS.elevation;
export const cityWallAccess=(slot:string)=>CITY_WALL_ACCESS[Number(slot.split('-')[1])<3?0:1];
export const CITY_PATROL_ROUTES=[[[9970,1600],[10800,1600],[10800,720],[9970,720]],[[10800,1600],[11790,1600],[11790,700],[10800,700]],[[11790,1600],[13000,1600],[13000,850],[12150,850],[12150,1400]],[[10800,2200],[11790,2200],[13000,2280],[13000,1600],[10800,1600]]] as const;
CITY_GUARD_POSTS.push(...Array.from({length:8},(_,i)=>({slot:`patrol-${i}`,role:'melee' as const,x:CITY_PATROL_ROUTES[Math.floor(i/2)][0][0]+i%2*48,y:CITY_PATROL_ROUTES[Math.floor(i/2)][0][1]+i%2*40,maxHP:600,armor:12})),...[[13350,850],[13450,850],[12800,600],[11790,-80],[13520,1600],[11790,2570]].map(([x,y],i)=>({slot:`post-${i}`,role:'melee' as const,x,y,maxHP:600,armor:12})));
export const cityGuardId=(slot:string,serial:number)=>`city-guard:${slot}:${serial}`;
export const CITY_SERVICES = [
  {id:'city-person-merchant',name:'城西补给商 · 芦锦',art:'carpenter',x:10730,y:1820},
  {id:'city-person-innkeeper',name:'候风驿站 · 林姨',art:'healer',x:10580,y:1105},
  {id:'city-person-keeper',name:'守塔人 · 望岚',art:'elder',x:11600,y:1480},
] as const;
export const CITY_PROPS: Prop[] = [
  ...ROAD_DECOR,
  ...FORTRESS_SOLIDS.map(p=>({id:p.id,art:'city-gate-beam',x:p.x,y:p.y,w:p.w,h:p.h,solid:[p.w,p.h] as [number,number],ground:false})),
  {id:'city-stone-bridge',art:'city-stone-bridge',x:7100,y:1800,w:740,h:400,ground:true,depth:1400},
  ...CITY_BRIDGE_FRAMES.map(f=>({id:`city-bridge-${f.name}`,art:'city-stone-bridge',frame:f.name,x:TRADE_BRIDGE.x+f.x+f.w/2,y:f.foot,w:f.w,h:f.h,displayAt:{x:TRADE_BRIDGE.x+f.x+f.w/2,y:1400+f.y+f.h},solid:[...f.solid] as [number,number],ground:true,depth:f.foot,cover:'low' as const})),
  {id:'road-rest-west',art:'sign',x:4330,y:1870,w:70,h:95,kind:'sign',label:'原野驿站 · 休整商路'},
  {id:'road-rest-east',art:'sign',x:9960,y:1880,w:70,h:95,kind:'sign',label:'西门驿站 · 休整商路'},
  {id:'road-entry-sign',art:'sign',x:4180,y:1810,w:70,h:95,kind:'sign',label:'通往风语城 · 林间商路'},
  ...CITY_BUILDING_PROPS, ...CITY_STREET_PROPS,
  // 梯身占地只挡街道移动；弓卫通过已有高处路线登梯，玩家从梯前入口进入巡检空间。

];
for(let i=0;i<29;i++){
  const y=-260+i*110;
  // 街道侧墙缘为局部横坐标166，东墙镜像后为4；实体覆盖到该边缘，角色不能走进侧立面。
  if(y<1350||y>=2380)CITY_PROPS.push({id:`city-west-wall-${i}`,art:'city-complete-wall-vertical',x:y<1350?8920:9720,y,w:170,h:240,solid:[162,110],cover:'high'});
  CITY_PROPS.push({id:`city-east-wall-${i}`,art:'city-complete-wall-vertical',x:13680,y,w:170,h:240,solid:[162,110],cover:'high'});
}
for(let i=0;i<24;i++){
  const x=9900+i*155;
  for(const y of [-220,2680])if(y<0||x>=9720)CITY_PROPS.push({id:`city-edge-${i}-${y}`,art:'city-complete-wall-horizontal',x,y,w:190,h:180,solid:[155,70],cover:'high'});
}
for(let x=8970;x<9850;x+=155)CITY_PROPS.push({id:`city-edge-extension-${x}`,art:'city-complete-wall-horizontal',x,y:-220,w:190,h:180,solid:[155,70],cover:'high'});
// 转角同时接住纵墙和横墙的实体；不在中途重复门塔。
for(const y of [-220,2780])for(const x of [y<0?8920:9770,13610])CITY_PROPS.push({id:`city-corner-${x}-${y}`,art:'city-complete-wall-corner',x,y,w:200,h:240,solid:[180,y<0?110:170],cover:'high'});
// 固定种子装饰，先检查主路与支路净空；不会随读档变化。
let seed=1837;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
function distanceToRoad(x:number,y:number){return Math.min(...TRADE_ROADS.flatMap(r=>r.points.slice(1).map((b,i)=>{const a=r.points[i],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t)-r.width/2;})));}
for(let i=0;i<280;i++){
  const x=4380+random()*5000,y=720+random()*1670;
  if(distanceToRoad(x,y)<95||Math.abs(x-7100)<310||TRADE_ROAD_NODES.some(n=>Math.hypot(n.x-x,n.y-y)<320)||x>8500&&random()<.55)continue;
  if([ROAD_NEST,...ROAD_POSTS].some(p=>Math.hypot(p.x-x,p.y-y)<240))continue;
  CITY_PROPS.push({id:`trade-tree-${i}`,art:'tree',x,y,w:180+random()*60,h:220+random()*80,solid:[35,28],cover:'high'});
}
for(let i=0;i<35;i++)for(const y of [600,2500])CITY_PROPS.push({id:`trade-cliff-${i}-${y}`,art:'rock',x:4400+i*150,y,w:160,h:160,solid:[150,100],cover:'low'});
for(let i=0;i<26;i++){
  const x=10020+random()*3300,y=100+random()*2400;
  if(distanceToRoad(x,y)<100||CITY_PROPS.some(p=>p.solid&&Math.abs(p.x-x)<(p.solid[0]/2+80)&&Math.abs(p.y-y)<170))continue;
  CITY_PROPS.push({id:`city-garden-${i}`,art:i%3?'tree':'pink',x,y,w:170,h:220,solid:[28,24],cover:'high'});
}

// 每个射击口只豁免自身墙／塔上的短穿口，离口后所有实体继续挡箭。
export const CITY_FIRING_PORTS=CITY_GUARD_POSTS.filter(p=>p.role==='archer').map(p=>{
 const structures=CITY_PROPS.filter(w=>w.id.startsWith('city-fortress-foot-')&&w.solid&&Math.abs(w.x-p.x)<30&&p.y>=w.y-w.solid[1]-40&&p.y<=w.y+60);
 const y=Math.max(p.y,...structures.map(w=>w.y))+14;
 return {slot:p.slot,x:p.x,y,structureIds:structures.map(w=>w.id)};
});

// 连续墙顶共用踏面高度；梯道连续升降，不按守卫模式切换高度。
export function cityWallElevation(point:{x:number;y:number;slot?:string;mode?:string;peace?:number;stair?:number}){
 const a=cityWallAccess(point.slot??'archer-0');
 if(point.mode==='recover'||point.mode==='replacement'&&point.peace===0||point.mode==='retreat'&&point.stair===2)return 0;
 if(['post','intercept','down'].includes(point.mode??'')||point.mode==='replacement'&&(point.peace??0)>=2||point.mode==='retreat'&&(point.stair??0)===0)return fortressHeight(point.x);
 if(!point.mode&&Math.hypot(point.x-a.bottom.x,point.y-a.bottom.y)<1)return 0;
 if(!point.mode&&point.slot)return fortressHeight(point.x);
 return CITY_WALL_HEIGHT*Math.max(0,Math.min(1,(a.bottom.x-point.x)/(a.bottom.x-a.top.x)));
}
