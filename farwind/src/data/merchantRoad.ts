import type {ItemId} from './content';
import type {Prop} from './world';
export const ROAD_GENERAL={x:9560,y:1750};
export const ROAD_NEST={x:6100,y:1050,name:'裂牙巢穴'};
export const ROAD_POSTS=[{x:4500,y:1750,name:'林缘哨岗'},{x:6510,y:1820,name:'桥西哨岗'},{x:8780,y:1790,name:'疏林哨岗'}];
export const ROAD_BRANCHES=[{x:5650,y:1000,name:'密林旧货点',reward:20},{x:8010,y:2040,name:'河岸旧货点',reward:25},{x:9150,y:2180,name:'城外旧货点',reward:30}];
// 路线含村门、桥口与城门的真实脚底锚点；长途只作短段寻路。
export const MERCHANT_PATH=[{x:750,y:840},{x:1270,y:720},{x:1390,y:820},{x:1710,y:820},{x:1870,y:980},{x:1910,y:1060},{x:3000,y:1060},{x:3610,y:1060},{x:3990,y:1440},{x:4230,y:1600},{x:4500,y:1600},{x:4790,y:1540},{x:5630,y:1350},{x:6490,y:1600},{x:6730,y:1620},{x:7100,y:1620},{x:7450,y:1620},{x:7750,y:1600},{x:8650,y:1400},{x:9250,y:1600},{x:9500,y:1770},{x:9690,y:1610},{x:9840,y:1450},{x:10200,y:1420},{x:10700,y:1610}];
export type MerchantDefinition={id:string;name:string;specialty:string;art:string;goods:Partial<Record<ItemId,{price:number;stock:number}>>;supply:readonly ('wood'|'stone'|'herb'|'potion'|'bread'|'tea')[];demand:Partial<Record<ItemId,number>>};
export const MERCHANTS:MerchantDefinition[]=[
 {id:'visitor-0',name:'陆衡',specialty:'材料行商',art:'merchant',goods:{wood:{price:3,stock:12},stone:{price:3,stock:12}},supply:['wood','stone'],demand:{wood:3,stone:3}},
 {id:'visitor-1',name:'苏苓',specialty:'药材行商',art:'herbalist',goods:{herb:{price:5,stock:10},berry:{price:4,stock:10},potion:{price:18,stock:6}},supply:['herb','potion'],demand:{herb:4}},
 {id:'visitor-2',name:'唐穗',specialty:'食粮行商',art:'traveler',goods:{bread:{price:8,stock:8},tea:{price:11,stock:6},soup:{price:15,stock:4}},supply:['bread','tea'],demand:{}},
 {id:'visitor-3',name:'沈砾',specialty:'旅行装备行商',art:'artisan',goods:{ironSword:{price:66,stock:1},leatherCoat:{price:50,stock:1},brookShoes:{price:33,stock:2},deerBoots:{price:88,stock:1}},supply:[],demand:{}},
];
export const merchantDefinition=(id:string)=>MERCHANTS.find(m=>m.id===id);
export const ROAD_DECOR:Prop[]=[
 {id:'road-nest-marker',art:'city-complete-notice-board',x:5840,y:1230,w:70,h:100,kind:'sign',label:'裂牙巢穴 · 密林支路'},
 {id:'road-nest-den',art:'nest-north',x:ROAD_NEST.x,y:ROAD_NEST.y-60,w:350,h:220},
 {id:'road-nest-ruin',art:'fence',x:6220,y:1170,w:130,h:50},
 {id:'road-nest-cargo',art:'city-complete-cargo-crates',x:6250,y:1120,w:80,h:80},
 ...ROAD_POSTS.flatMap((p,i)=>[
 {id:`road-post-${i}-flag`,art:'city-complete-city-flag',x:p.x-90,y:p.y-75,w:60,h:140},
 {id:`road-post-${i}-shelter`,art:'city-complete-cloth-stall',x:p.x,y:p.y-110,w:160,h:140},
 {id:`road-post-${i}-cargo`,art:'city-complete-cargo-crates',x:p.x+105,y:p.y-30,w:65,h:65},
 ]),
 ...ROAD_BRANCHES.map((p,i)=>({id:`road-branch-${i}`,art:'city-complete-cargo-crates',x:p.x,y:p.y-20,w:65,h:65,kind:'sign' as const,label:`${p.name} · 护送取货`})),
];

// 独立商路守备范围：道路沿线与出兵时经过的城内街区；不借用城墙岗位限制。
export function roadGuardStanding(p:{x:number;y:number},travelling=false){
 if(!Number.isFinite(p.x)||!Number.isFinite(p.y))return false;
 if(travelling&&p.x>=9690&&p.x<=13860&&p.y>=-350&&p.y<=2800)return true;
 if(p.x<4210||p.x>9820||p.y<700||p.y>2380)return false;
 return MERCHANT_PATH.slice(9).some((b,i)=>{const a=MERCHANT_PATH[i+8],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t)<=700;});
}
