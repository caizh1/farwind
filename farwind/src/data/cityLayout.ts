import type {Prop} from './world';

// 城市楼址沿用世界规划；视觉脚底、实体占地与可达门点分别登记。
export type CitySpace = `city:${string}`;
export type CityBuilding = {id:string;name:string;art:string;x:number;y:number;w:number;h:number;door:{x:number;y:number};space:CitySpace;owner:string;private:boolean};
const building=(id:string,name:string,art:string,x:number,y:number,w:number,h:number,owner:string,privateRoom=false):CityBuilding=>({id,name,art,x,y,w,h,door:{x,y:y+55},space:`city:${id}`,owner,private:privateRoom});
export const CITY_BUILDINGS:CityBuilding[]=[
 building('inn','候风驿站','inn-building',10220,2010,380,325,'innkeeper'),
 building('market','市场商馆','market-building',10730,2010,340,290,'merchant'),
 building('guild','商旅行会','guild-hall',10350,570,440,340,'guildmaster'),
 building('forge','锻造坊','smith-building',10170,1050,330,280,'smith'),
 building('clinic','叶蘅药坊','clinic-building',10960,2400,320,290,'herbalist'),
 building('tea','阿荞茶馆','tea-house',11330,2400,320,290,'tea'),
 building('hall','议事厅','council-hall',12920,420,580,440,'councillor'),
 building('archive','风语档案馆','archive-hall',12500,1050,390,350,'archivist'),
 building('barracks','城防兵营','barracks',13350,700,420,330,'captain'),
 building('tower','中央风塔','wind-tower',11790,1230,270,640,'keeper'),
 building('underground','地下维护区','room-open-door',13000,1100,180,200,'clerk'),
 ...Array.from({length:12},(_,i)=>building(`house-${i}`,['周婶的家','陆伯的家','沐禾的家','青萝的家','砚生的家','南音的家','阿铎的家','小栎的家','绫月的家','桑实的家','麦叔的家','闻溪的家'][i],`house-variant-${['a','b','c'][i%3]}`,i===5?12800:i<6?11000+(i%3)*800:12250+(i%3)*430,i<3?310:i<6?960:i<9?2110:2460,270,260,['zhou','lu','mu','qing','yan','nan','apprentice-a','apprentice-b','cloth','fruit','cook','storyteller'][i],true)),
];
// 城墙步道使用独立空间，入口是已登记的梯道；不开放城外区域。
export const CITY_WALL:CityBuilding={...building('wall','西城墙巡检步道','wall-stairs',10020,1190,140,140,'captain'),door:{x:10020,y:1225}};
export const cityBuilding=(space:unknown)=>space===CITY_WALL.space?CITY_WALL:CITY_BUILDINGS.find(b=>b.space===space);
export const isCitySpace=(space:unknown):space is CitySpace=>!!cityBuilding(space);
export const CITY_BUILDING_PROPS:Prop[]=CITY_BUILDINGS.map(b=>({id:`city-building-${b.id}`,art:`city-complete-${b.art}`,x:b.x,y:b.y,w:b.w,h:b.h,solid:[b.id==='tower'?150:b.w*.58,b.id==='underground'?60:90],cover:'high'}));
export type CityFurniture={id:string;art:string;x:number;y:number;w:number;h:number;solid?:[number,number];text:string;use?:string;mounted?:boolean};
export function cityFurniture(space:unknown):CityFurniture[]{
 const b=cityBuilding(space);if(!b)return [];
 const f=(id:string,art:string,x:number,y:number,w:number,h:number,text:string,use?:string,solid:[number,number]=[w*.65,40]):CityFurniture=>({id,art,x,y,w,h,text,use,solid});
 if(b.id==='wall')return [f('wall-north','firing-platform',470,590,135,135,'北侧射击口，通向西门北段的实际弓卫岗位。','wall-north'),f('wall-south','firing-platform',940,820,135,135,'南侧射击口，俯瞰西门南段道路。','wall-south')];
 const mounted=(item:CityFurniture):CityFurniture=>({...item,mounted:true,solid:undefined});
 const common=[mounted(f('lamp','wall-lamp',970,490,36,78,'墙灯映着青蓝旗饰。')),f('storage','storage-chest',940,700,76,68,`${b.name}的具名储物，物品属于${b.owner}，不能擅自取走。`),f('table','round-table',500,800,110,88,'桌上有热茶和来往客人的留言。','talk')];
 if(b.private)return [...common,f('bed','bed-blue',470,590,96,130,'住户的床铺，拜访许可不包含使用床铺。'),f('personal',b.id==='house-0'?'letter-box':b.id==='house-6'?'tool-bag':'bookcase',820,590,90,120,'旧信、工具与笔记记录着住户的生活。',b.id==='house-0'?'letter-a':b.id==='house-1'?'letter-b':b.id==='house-6'?'tools':'home')];
 const specific:Record<string,CityFurniture[]>={
 inn:[f('bed','bed-red',470,590,96,130,'驿站留给旅人的干净客房。','sleep'),f('counter','tavern-counter',810,590,150,105,'登记住宿并购买餐食。','service')],
 market:[f('counter','market-counter',810,590,150,120,'商馆货单和本城独立库存。','service'),f('crate','cargo-crates',470,590,90,95,'货箱的风纹封条有不寻常的裂痕。','market-evidence')],
 guild:[f('desk','guild-desk',810,590,150,110,'委托登记处，每笔奖励保存后才发放。','quests'),f('ledger','notice-board',470,590,90,110,'本城十二项委托。','quests')],
 forge:[f('forge','forge-furnace',470,590,115,150,'炉火保持着适合锻造的温度。'),f('anvil','forge-anvil',810,680,110,100,'木材四份、石材四份、风之结晶一份可制作铁剑。','forge')],
 clinic:[f('bed','clinic-bed',470,590,100,130,'药坊急救床。'),f('medicine','medicine-cabinet',810,590,110,150,'药草两份、浆果一份可调制药剂。','medicine')],
 tea:[f('counter','tavern-counter',810,590,150,100,'热茶、面包和街坊线索。','service')],
 hall:[f('desk','writing-desk',810,590,150,100,'议事厅的入城登记册。','register'),mounted(f('emblem','city-emblem',470,490,100,100,'市民与城防共同守护这座城。'))],
 archive:[f('shelf','bookcase',470,590,115,150,'风塔维护档案的页码出现空缺。','archive-evidence'),f('desk','writing-desk',810,590,150,100,'登记缺页并核对城案。','archive')],
 barracks:[f('rack','weapon-rack',470,590,110,140,'具名武器架，非任务物品不能取用。'),f('supply','supply-bag',810,590,85,90,'向两个岗位送去换岗补给。','supply')],
 tower:[f('console','wind-console',810,590,130,140,'风塔控制台与地下风管相连。','tower'),f('core','crystal-pedestal',470,590,100,135,'维护记录藏在晶座背面。','tower-evidence')],
 underground:[f('valve-0','broken-valve',470,590,85,90,'第一处泄风阀，需要石材一份。','valve-0'),f('valve-1','broken-valve',810,590,85,90,'第二处泄风阀，需要石材一份。','valve-1'),f('valve-2','broken-valve',940,820,85,90,'第三处泄风阀，需要石材一份。','valve-2')],
 };
 return [...(b.id==='underground'?[]:common),...specific[b.id]??[]];
}
export const CITY_LAMPS=[{id:'lamp-west',x:10040,y:1690},{id:'lamp-market',x:11000,y:1760},{id:'lamp-plaza',x:12140,y:1710}] as const;
export const CITY_OUTDOOR_USES=[
 {id:'closed-north',label:'北门 · 山路整备中',x:11790,y:-80},
 {id:'closed-east',label:'东门 · 湖区通路整备中',x:13520,y:1600},
 {id:'closed-south',label:'南门 · 沙路整备中',x:11790,y:2570},
 {id:'board',label:'城市公示板 · 城案与委托',x:10590,y:685},
 ...CITY_LAMPS.map(l=>({id:l.id,label:'街灯 · 维修',x:l.x,y:l.y+25})),
 {id:'crate',label:'误放货箱 · 调查',x:10490,y:2220},{id:'stall',label:'市场摊位 · 布置',x:10500,y:1845},
 {id:'wall-stair',label:'内侧梯道 · 登上城墙',...CITY_WALL.door},
 {id:'post-west',label:'西门岗位 · 交接补给',x:9920,y:1650},{id:'post-hall',label:'行政岗 · 交接补给',x:12800,y:635},
];
export const CITY_STREET_PROPS:Prop[]=[
 {id:'city-check-booth',art:'city-complete-check-booth',x:10120,y:1440,w:155,h:150,solid:[95,40],cover:'high'},
 {id:'city-market-cart',art:'city-complete-cargo-cart',x:10420,y:2380,w:160,h:150,solid:[105,40],cover:'high'},
 ...[{x:10040,y:1370},{x:12600,y:670}].map((p,i)=>({...p,id:`city-flag-${i}`,art:'city-complete-city-flag',w:65,h:165,solid:[12,12] as [number,number],cover:'high' as const})),
 ...[{id:'north',x:11790,y:-220},{id:'east',x:13680,y:1600},{id:'south',x:11790,y:2680}].map(p=>({...p,id:`city-closed-${p.id}`,art:'city-complete-room-door',w:115,h:145,cover:'high' as const})),
 ...CITY_LAMPS.map(p=>({...p,art:'city-complete-street-lamp',w:58,h:150,solid:[22,18] as [number,number]})),
 ...[{id:'fruit',art:'fruit-stall',x:10500,y:1800},{id:'herb',art:'herb-stall',x:10920,y:1830},{id:'cloth',art:'cloth-stall',x:11230,y:1820}].map(p=>({...p,id:`city-stall-${p.id}`,art:`city-complete-${p.art}`,w:150,h:145,solid:[110,50] as [number,number],cover:'high' as const})),
 {id:'city-cargo',art:'city-complete-cargo-crates',x:10490,y:2190,w:85,h:90},
 {id:'city-board',art:'city-complete-notice-board',x:10590,y:660,w:100,h:145,solid:[50,20]},
 {id:'city-herbs-a',art:'herb',x:10770,y:2240,w:72,h:62,kind:'resource',item:'herb',label:'药坊种植药草'},
 {id:'city-herbs-b',art:'herb',x:10880,y:2240,w:72,h:62,kind:'resource',item:'herb',label:'药坊种植药草'},
 {id:'city-berries',art:'bush',x:10760,y:2350,w:85,h:75,kind:'resource',item:'berry',label:'药坊浆果丛'},
 ...[{x:11400,y:1570},{x:12200,y:1570}].map((p,i)=>({...p,id:`city-bench-${i}`,art:'city-complete-street-bench',w:120,h:75,solid:[95,35] as [number,number]})),
 ...[{x:11490,y:1300},{x:12100,y:1300},{x:12800,y:570}].map((p,i)=>({...p,id:`city-planter-${i}`,art:'city-complete-city-planter',w:145,h:100,solid:[105,55] as [number,number]})),
 {id:'city-wall-stairs',art:'city-complete-wall-stairs',x:10020,y:1190,w:140,h:140,solid:[55,45]},
];
export const CITY_CITIZENS=[
 ['captain','岚铎','captain','barracks'],['merchant','芦锦','merchant','market'],['innkeeper','林姨','innkeeper','inn'],['keeper','望岚','keeper','tower'],
 ['guildmaster','常青','merchant','guild'],['smith','石衡','artisan','forge'],['herbalist','叶蘅','herbalist','clinic'],['tea','阿荞','innkeeper','tea'],
 ['cargo','秦舟','merchant','market'],['cloth','绫月','citizen','house-8'],['fruit','桑实','citizen','house-9'],['cook','麦叔','artisan','house-10'],
 ['zhou','周婶','innkeeper','house-0'],['lu','陆伯','keeper','house-1'],['mu','沐禾','citizen','house-2'],['qing','青萝','herbalist','house-3'],
 ['yan','砚生','scholar','house-4'],['nan','南音','citizen','house-5'],['apprentice-a','阿铎','apprentice','house-6'],['apprentice-b','小栎','apprentice','house-7'],
 ['councillor','顾川','scholar','hall'],['archivist','书宁','scholar','archive'],['clerk','卓然','captain','underground'],['storyteller','闻溪','keeper','house-11'],
].map(([id,name,art,home])=>({id,name,art,home:CITY_BUILDINGS.find(b=>b.id===home)!.space}));
export const CITY_MAIN_HINTS=['议事厅办理入城登记','市场商馆调查异常货箱','档案馆查阅维护记录','地下维护区修复三个风阀','中央风塔完成蓄能','启动风塔守护装置挑战','风塔领取首胜奖励','风塔稳定，城市恢复庆典'];
export const CITY_QUESTS=[
 ['supply','商队缺货',40,['货单','交付木材四份、石材三份']],['escort','迟到行商',50,['在西门外集合','护送到西门']],['stall','摊位重开',30,['调查误放货箱','搬回市场摊位']],
 ['forge','炉火试炼',45,['制作铁剑']],['medicine','药坊急需',35,['采集药草','调制药剂','交付两瓶药剂']],['tools','学徒工具',30,['拜访阿铎','找回工具','交还工作点']],
 ['lamps','夜归灯路',45,['维修西门灯','维修市场灯','维修广场灯']],['letter','邻里旧信',30,['周婶旧信','陆伯笔记','交回旧信']],['wall','城墙巡检',40,['登上梯道','巡检北射击口','巡检南射击口']],
 ['relief','换岗补给',40,['领取兵营补给','西门交接','行政岗交接']],['valves','地下泄风',60,['修复第一阀','修复第二阀','修复第三阀']],['pages','档案缺页',45,['档案馆证据','市场证据','风塔证据','归档']],
].map(([id,name,reward,steps])=>({id:id as string,name:name as string,reward:reward as number,steps:steps as string[]}));
