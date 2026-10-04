import {WIND_BELL_BOUNDS} from './maps/windbell/bounds';

// 大陆规划只服务地图与后续扩建，不能用作当前移动、碰撞或存档边界。
// 城市保持真实坐标，通过扩展展示范围恢复初始图的中央城市构图。
export const WORLD_MAP_EXTENT={left:-9000,top:-13000,width:42000,height:30000} as const;
export const WORLD_PLAN_VERSION=1;
export const WORLD_PLAN_LAND=[[-7200,-1400],[-5300,-8600],[500,-11400],[11100,-11900],[20200,-10000],[27400,-5900],[29400,800],[28600,9000],[21000,13700],[12500,14800],[2700,14200],[-5300,10800],[-7000,5900]] as const;
type Rect={left:number;top:number;width:number;height:number};
export type WorldPlanRegion={id:string;name:string;point:{x:number;y:number};bounds:Rect;status:'已开放'|'部分开放'|'暂未开放'|'未知';detail:string;biome:string};
const planned=(id:string,name:string,x:number,y:number,width:number,height:number,biome:string,detail:string):WorldPlanRegion=>({id,name,point:{x,y},bounds:{left:x-width/2,top:y-height/2,width,height},status:'暂未开放',biome,detail:detail+' 区域内容暂未开放。'});
export const WORLD_PLAN_REGIONS:WorldPlanRegion[]=[
 planned('snow','雪原之境',1000,-7700,11000,6800,'雪峰与冰原','西北冰雪高地，保留冰封遗迹与雪峰轮廓。'),
 planned('mountains','北风山脉',12300,-8300,11800,6200,'高山与峡谷','位于风语城以北的群山，包含矿藏、山间聚落与隐士居所。'),
 planned('fire','赤焰荒原',24200,-5000,8200,9200,'火山与熔岩','东北火山群、赤色岩地与失落遗迹。'),
 planned('emerald','翡翠森林',-5200,1200,6400,9000,'古老密林','大陆西侧的古老森林，风铃村与原野位于其东缘，林间深处仍待探索。'),
 {id:'forest',name:'风铃原野',point:{x:1090,y:160},bounds:WIND_BELL_BOUNDS,status:'已开放',biome:'林缘与原野',detail:'翡翠森林东缘的风铃村、农田、湿地、溪谷与分散林地。沿道路向东连接商路与风语城。'},
 {id:'road',name:'林间商路',point:{x:6900,y:1050},bounds:{left:4290,top:600,width:5400,height:1900},status:'已开放',biome:'林间通道',detail:'原野至城市的现有步行路线，包含六处遭遇、两端驿站及跨河石桥。'},
 {id:'city',name:'风语城',point:{x:11790,y:1050},bounds:{left:9490,top:-400,width:4400,height:3200},status:'已开放',biome:'中央城市',detail:'大陆中央的政治与文化中心。十一处公共场所、十二处可拜访住宅、城墙巡检、地下维护区及风塔章节开放。市民与行商按日程活动，二十四岗守卫轮值；城案与十二项城市委托在城内办理。'},
 planned('lake','月影湖',23000,1800,7800,6200,'湖泊与湖岸','城市东侧的内陆青蓝湖泊，保留闭合湖岸与湖中岛屿。'),
 planned('coast','晨曦海岸',1500,7400,8700,6800,'港湾与海岸','西南海岸的渔村、港口与海上航路。'),
 planned('desert','金沙荒漠',14000,11700,15000,6500,'沙丘与遗迹','南部金色沙海，包含商队、古文明遗迹与地下城。'),
 planned('islands','云海群岛',30300,10600,4500,9200,'悬浮岛与云海','大陆东南外侧的悬浮岛屿与天空之城，岩底悬于云海之上。'),
 {id:'unknown',name:'？？？',point:{x:-6900,y:15100},bounds:{left:-8200,top:14000,width:2600,height:2200},status:'未知',biome:'黑紫雾岛',detail:'西南海域黑紫雾气笼罩的未知位置，暂未开放。'},
];

// 规划连接用于扩建约束，不生成虚假的可行走道路或解锁状态。
export const WORLD_PLAN_CONNECTIONS=[
 ['emerald','forest'],['forest','road'],['road','city'],
 ['city','mountains'],['city','lake'],['city','desert'],
 ['emerald','snow'],['emerald','coast'],['mountains','fire'],['lake','islands'],
] as const;
