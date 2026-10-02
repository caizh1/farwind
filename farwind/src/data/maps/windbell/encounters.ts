import {LEGACY_ENCOUNTERS} from '../../windLegacy';
import type {EliteKind} from "./elites";
import type {CampBossKind} from './campBosses';
import type { EnemyKind } from "../../enemies";
export type WildernessDirection="south"|"west"|"north"|"east";
export type EncounterDefinition={id:string;name:string;direction:WildernessDirection;kind:"patrol"|"camp"|"elite"|"challenge";after?:string;source:string;x:number;y:number;radius:number;cooldownMs:number;members:readonly {id:string;type:EnemyKind;elite?:EliteKind;boss?:CampBossKind;x:number;y:number}[];patrol:readonly {x:number;y:number}[]};
// 手工遭遇预算：南6、西6、北6、东8、遗迹5；首领在M6接通。
const BASE_ENCOUNTERS:readonly EncounterDefinition[]=[
 {id:"south-reed-patrol",name:"渡口试探",direction:"south",kind:"patrol",source:"south-spore-camp",x:1050,y:2040,radius:260,cooldownMs:480000,members:[{id:"wild-reed-slime",type:"slime",x:1080,y:2060}],patrol:[{x:1080,y:2060},{x:1170,y:2050}]},
 {id:"south-herb-patrol",name:"洼地孢卫",direction:"south",kind:"patrol",source:"south-spore-camp",x:730,y:2450,radius:300,cooldownMs:540000,members:[{id:"wild-herb-spore",type:"spore",x:620,y:2460},{id:"wild-herb-slime",type:"slime",x:810,y:2510}],patrol:[{x:620,y:2460},{x:730,y:2590}]},
 {id:"south-spore-camp",name:"孢根巢地",direction:"south",kind:"camp",source:"south-spore-camp",x:1250,y:2820,radius:360,cooldownMs:0,members:[{id:"wild-camp-spore",type:"spore",x:1220,y:2750},{id:"wild-camp-slime-a",type:"slime",x:1140,y:2870},{id:"wild-camp-slime-b",type:"slime",x:1390,y:2850},{id:"boss-spore-heart",type:"spore",boss:"spore-heart",x:1250,y:2820}],patrol:[{x:1220,y:2750},{x:1320,y:2870}]},
 {id:"south-orchard-burrows",name:"果园土丘",direction:"south",kind:"patrol",source:"south-spore-camp",x:1890,y:2340,radius:230,cooldownMs:600000,members:[{id:"wild-orchard-worm-a",type:"burrow",x:1910,y:2360},{id:"wild-orchard-worm-b",type:"burrow",x:2030,y:2490}],patrol:[{x:1910,y:2360}]},
 {id:"west-track-pack",name:"旧道双狼",direction:"west",kind:"patrol",source:"west-wolf-den",x:-540,y:1330,radius:280,cooldownMs:600000,members:[{id:"wild-track-wolf-a",type:"wolf",x:-600,y:1380},{id:"wild-track-wolf-b",type:"wolf",x:-490,y:1410}],patrol:[{x:-600,y:1380},{x:-550,y:1480}]},
 {id:"north-stone-watch",name:"山口苔甲",direction:"north",kind:"patrol",source:"north-boar-camp",x:1120,y:-390,radius:260,cooldownMs:660000,members:[{id:"wild-pass-guardian",type:"guardian",x:1130,y:-400}],patrol:[{x:1130,y:-400},{x:1250,y:-470}]},
 {id:"west-wolf-den",name:"荆狼巢穴",direction:"west",kind:"camp",source:"west-wolf-den",x:-1700,y:1490,radius:310,cooldownMs:0,members:[{id:"wild-den-wolf-a",type:"wolf",x:-1760,y:1430},{id:"wild-den-wolf-b",type:"wolf",x:-1610,y:1530},{id:"wild-den-reaper",type:"leaf",x:-1680,y:1350},{id:"boss-thorn-crown",type:"wolf",boss:"thorn-crown",x:-1700,y:1490}],patrol:[{x:-1760,y:1430},{x:-1700,y:1520}]},
 {id:"north-boar-camp",name:"裂岩兽穴",direction:"north",kind:"camp",source:"north-boar-camp",x:1480,y:-730,radius:340,cooldownMs:0,members:[{id:"wild-rock-boar",type:"boar",x:1450,y:-760},{id:"wild-rock-guardian",type:"guardian",x:1570,y:-690},{id:"boss-crag-tusk",type:"boar",boss:"crag-tusk",x:1480,y:-730}],patrol:[{x:1450,y:-760},{x:1470,y:-650}]},
 {id:"east-thorn-camp",name:"棘枝营地",direction:"east",kind:"camp",source:"east-thorn-camp",x:3710,y:1100,radius:340,cooldownMs:0,members:[{id:"wild-thorn-spore",type:"spore",x:3780,y:1000},{id:"wild-thorn-reaper",type:"leaf",x:3670,y:1200},{id:"wild-thorn-guardian",type:"guardian",x:3850,y:1180},{id:"boss-bound-branch",type:"leaf",boss:"bound-branch",x:3710,y:1100}],patrol:[{x:3780,y:1000},{x:3800,y:1110}]},
 // 南部：采集支路与堤闸，不在桥心或村门生成。
 {id:"south-reed-margin",name:"芦边巡游",direction:"south",kind:"patrol",source:"south-spore-camp",x:500,y:2150,radius:200,cooldownMs:600000,members:[{id:"wild-margin-slime",type:"slime",x:500,y:2150}],patrol:[{x:500,y:2150},{x:580,y:2130}]},
 {id:"south-weir-watch",name:"堤闸守望",direction:"south",kind:"patrol",source:"south-spore-camp",x:2160,y:2870,radius:200,cooldownMs:720000,members:[{id:"wild-weir-guardian",type:"guardian",x:2160,y:2870}],patrol:[{x:2160,y:2870},{x:2210,y:2960}]},
 // 西部：农舍、商车和侧路各有不同组合；精英为一次性挑战。
 {id:"west-farm-reaper",name:"农舍割枝声",direction:"west",kind:"patrol",source:"west-wolf-den",x:-880,y:1250,radius:240,cooldownMs:660000,members:[{id:"wild-farm-reaper",type:"leaf",x:-880,y:1250}],patrol:[{x:-880,y:1250},{x:-780,y:1190}]},
 {id:"west-cart-ambush",name:"商车兽径",direction:"west",kind:"patrol",source:"west-wolf-den",x:-1520,y:920,radius:260,cooldownMs:660000,members:[{id:"wild-cart-wolf",type:"wolf",x:-1500,y:970},{id:"wild-cart-worm",type:"burrow",x:-1620,y:920}],patrol:[{x:-1500,y:970}]},
 {id:"west-pack-clearing",name:"围猎林隙 · 荆棘头狼",direction:"west",kind:"elite",source:"west-wolf-den",x:-1240,y:1680,radius:330,cooldownMs:0,members:[{id:"elite-thorn-alpha",type:"wolf",elite:"alpha",x:-1240,y:1680}],patrol:[{x:-1240,y:1680},{x:-1180,y:1740}]},
 {id:"west-trade-scouts",name:"商路侧翼",direction:"west",kind:"patrol",source:"west-wolf-den",x:-1480,y:-60,radius:240,cooldownMs:720000,members:[{id:"wild-trade-wolf-a",type:"wolf",x:-1480,y:-60},{id:"wild-trade-wolf-b",type:"wolf",x:-1580,y:40}],patrol:[{x:-1480,y:-60},{x:-1430,y:20}]},
 // 北部：弯路预警、哨站空域、岩坪诱导冲撞。
 {id:"north-pass-charge",name:"弯路冲锋",direction:"north",kind:"patrol",source:"north-boar-camp",x:330,y:-330,radius:250,cooldownMs:660000,members:[{id:"wild-bent-boar",type:"boar",x:330,y:-330}],patrol:[{x:330,y:-330},{x:400,y:-410}]},
 {id:"north-outpost-wings",name:"哨站暮羽",direction:"north",kind:"patrol",source:"north-boar-camp",x:900,y:-740,radius:230,cooldownMs:720000,members:[{id:"wild-outpost-raven",type:"raven",x:900,y:-740}],patrol:[{x:900,y:-740},{x:820,y:-810}]},
 {id:"north-rock-arena",name:"回声石坪 · 裂岩林豕",direction:"north",kind:"elite",source:"north-boar-camp",x:1080,y:-990,radius:360,cooldownMs:0,members:[{id:"elite-rock-ram",type:"boar",elite:"ram",x:1080,y:-990}],patrol:[{x:1080,y:-990}]},
 {id:"north-lookout-tracks",name:"望台足迹",direction:"north",kind:"patrol",source:"north-boar-camp",x:-130,y:-770,radius:240,cooldownMs:720000,members:[{id:"wild-lookout-wolf",type:"wolf",x:-130,y:-770},{id:"wild-lookout-slime",type:"slime",x:-40,y:-720}],patrol:[{x:-130,y:-770},{x:-100,y:-860}]},
 // 旧森林七名敌人纳入固定遭遇槽位，稳定身份和任务材料继续保留。
 {id:"east-road-slimes",name:"林道苔团",direction:"east",kind:"challenge",source:"east-thorn-camp",x:2560,y:1140,radius:420,cooldownMs:0,members:[{id:"slime-1",type:"slime",x:2450,y:1060},{id:"slime-2",type:"slime",x:2670,y:1230}],patrol:[{x:2560,y:1140}]},
 {id:"east-brook-reapers",name:"溪口裂枝",direction:"east",kind:"challenge",source:"east-thorn-camp",x:3040,y:1010,radius:420,cooldownMs:0,members:[{id:"leaf-1",type:"leaf",x:2920,y:1070},{id:"leaf-2",type:"leaf",x:3170,y:930}],patrol:[{x:3040,y:1010}]},
 {id:"east-mushroom-watch",name:"菌林孢卫",direction:"east",kind:"challenge",source:"east-thorn-camp",x:2730,y:1840,radius:420,cooldownMs:0,members:[{id:"spore-1",type:"spore",x:2730,y:1840}],patrol:[{x:2730,y:1840}]},
 {id:"east-spring-boar",name:"石泉冲锋",direction:"east",kind:"challenge",source:"east-thorn-camp",x:3150,y:340,radius:420,cooldownMs:0,members:[{id:"boar-1",type:"boar",x:3150,y:340}],patrol:[{x:3150,y:340}]},
 {id:"east-canopy-raven",name:"林冠俯冲",direction:"east",kind:"challenge",source:"east-thorn-camp",x:3250,y:1830,radius:420,cooldownMs:0,members:[{id:"raven-1",type:"raven",x:3250,y:1830}],patrol:[{x:3250,y:1830}]},
 {id:"east-spore-ring",name:"孢环空地 · 灰冠母孢",direction:"east",kind:"elite",source:"east-thorn-camp",x:3070,y:2100,radius:290,cooldownMs:0,members:[{id:"elite-ashen-brood",type:"spore",elite:"brood",x:3070,y:2100}],patrol:[{x:3070,y:2100},{x:3170,y:2160}]},
 {id:"east-brook-burrows",name:"溪畔伏土",direction:"east",kind:"patrol",source:"east-thorn-camp",x:2840,y:1450,radius:210,cooldownMs:720000,members:[{id:"wild-brook-worm",type:"burrow",x:2840,y:1450}],patrol:[{x:2840,y:1450}]},
 // 遗迹前庭分两批，侧廊在第一批结束后给出入场预兆。首领是M6的第32组。
 {id:"ruins-gate-watch",name:"门庭石甲",direction:"east",kind:"challenge",source:"east-thorn-camp",x:2770,y:-100,radius:240,cooldownMs:0,members:[{id:"wild-ruins-gate",type:"guardian",x:2770,y:-100}],patrol:[{x:2770,y:-100},{x:2890,y:-120}]},
 {id:"ruins-court-front",name:"前庭守阵",direction:"east",kind:"challenge",source:"east-thorn-camp",x:3240,y:-350,radius:230,cooldownMs:0,members:[{id:"wild-court-guardian",type:"guardian",x:3220,y:-350},{id:"wild-court-reaper",type:"leaf",x:3340,y:-320}],patrol:[{x:3240,y:-350}]},
 {id:"ruins-court-flank",name:"前庭侧廊增援",direction:"east",kind:"challenge",after:"ruins-court-front",source:"east-thorn-camp",x:3530,y:-500,radius:340,cooldownMs:0,members:[{id:"wild-court-raven",type:"raven",x:3500,y:-530},{id:"wild-court-slime",type:"slime",x:3600,y:-470}],patrol:[{x:3530,y:-500},{x:3280,y:-480}]},
 {id:"ruins-hall-watch",name:"回音厅守望",direction:"east",kind:"challenge",source:"east-thorn-camp",x:3830,y:-680,radius:220,cooldownMs:0,members:[{id:"wild-hall-spore",type:"spore",x:3800,y:-720},{id:"wild-hall-guardian",type:"guardian",x:3910,y:-640}],patrol:[{x:3830,y:-680}]},
 {id:"ruins-exit-watch",name:"回廊伏击",direction:"east",kind:"challenge",source:"east-thorn-camp",x:4000,y:-170,radius:230,cooldownMs:0,members:[{id:"wild-exit-worm",type:"burrow",x:4020,y:-140},{id:"wild-exit-guardian",type:"guardian",x:3900,y:-240}],patrol:[{x:4000,y:-170}]},

];
// 旧批次的身份顺序永久保留，用于第十四版位置存档的无损迁移。
export const LEGACY_ENCOUNTER_IDS=Object.fromEntries([...BASE_ENCOUNTERS,...LEGACY_ENCOUNTERS].map(d=>[d.id,d.members.map(m=>m.id)]));
export const ENCOUNTER_COMPOSITION_VERSION=2;
const SOUTH_ADDITIONS:Record<string,EncounterDefinition['members']>={
 'south-reed-patrol':[{id:'wild-reed-spore',type:'spore',x:1210,y:2140}],
 'south-herb-patrol':[{id:'wild-herb-priest',type:'priest',x:730,y:2580}],
 'south-spore-camp':[{id:'wild-camp-priest',type:'priest',x:1190,y:2820}],
 'south-orchard-burrows':[{id:'wild-orchard-bomber',type:'bomber',x:1810,y:2400}],
};
export const ENCOUNTERS:readonly EncounterDefinition[]=[...BASE_ENCOUNTERS.map(d=>({...d,members:[...d.members.filter(m=>!m.boss),...SOUTH_ADDITIONS[d.id]??[],...d.members.filter(m=>m.boss)]})),...LEGACY_ENCOUNTERS];
export const ENCOUNTER_UNITS=ENCOUNTERS.flatMap(group=>group.members.map(member=>({...member,group:group.id})));
export const encounterUnit=(id:string):(EncounterDefinition['members'][number]&{group:string})|undefined=>{
 const support=/^(.+):唤巢:([0-3])$/.exec(id);if(support&&id.length<160){const owner=encounterUnit(support[1]);if(owner?.type==='bell')return {id,type:'slime',group:owner.group,x:owner.x,y:owner.y};}
 const owned=/^(.+):(祭根|护猎):(\d+):(\d+)$/.exec(id);if(owned&&id.length<160){const owner=encounterUnit(owned[1]);if(owner?.boss)return {id,type:owned[2]==='护猎'?'wolf':'priest',group:owner.group,x:owner.x,y:owner.y};}
 const instance=/^(memory:\d+)\|(.+)$/.exec(id);if(instance){const base=ENCOUNTER_UNITS.find(s=>s.id===instance[2])??dynamicEncounterUnit(instance[2]);return base?{...base,id}:undefined;}
 return ENCOUNTER_UNITS.find(s=>s.id===id)??dynamicEncounterUnit(id);
};
export const ENCOUNTER_LIMITS={active:12,activateDistance:1250,respawnDistance:1350,dropLifetimeMs:600000} as const;

// 同一地点承载完整波次；固定主线成员身份保留，新增成员由实例身份解析。
export const ADVENTURE_ROUTES:Record<WildernessDirection,readonly string[]>={
 south:['south-reed-patrol','south-herb-patrol','south-orchard-burrows','south-weir-watch','south-spore-camp'],
 west:['west-track-pack','west-farm-reaper','west-cart-ambush','west-pack-clearing','west-wolf-den'],
 north:['north-pass-charge','north-stone-watch','north-outpost-wings','north-rock-arena','north-boar-camp'],
 east:['east-road-slimes','east-brook-reapers','east-brook-burrows','east-spore-ring','east-thorn-camp'],
};
export const adventureIndex=(id:string)=>Object.values(ADVENTURE_ROUTES).find(r=>r.includes(id))?.indexOf(id)??-1;
export const COMBAT_TEMPLATES:Record<WildernessDirection,readonly (readonly EnemyKind[])[]>={
 south:[['slime','leaf','archer','bell','slime','shade'],['slime','shade','archer','geomancer','leaf','slime'],['leaf','slime','bell','burrow','wolf','slime'],['wolf','leaf','spore','raven','slime','slime'],['slime','leaf','guardian','spore','wolf','slime'],['leaf','wolf','priest','slime','spore','slime']],
 west:[['shade','leaf','archer','slime','geomancer','shade'],['leaf','wolf','bell','slime','raven','wolf'],['wolf','leaf','archer','burrow','slime','wolf'],['wolf','slime','guardian','raven','leaf','wolf'],['leaf','wolf','spore','slime','bell','wolf'],['wolf','leaf','raven','slime','boar','wolf']],
 north:[['slime','leaf','geomancer','archer','shade','slime'],['shade','leaf','boar','bell','slime','slime'],['leaf','slime','raven','guardian','wolf','slime'],['wolf','leaf','archer','burrow','slime','wolf'],['slime','leaf','bell','boar','raven','slime'],['leaf','wolf','spore','guardian','slime','slime']],
 east:[['leaf','slime','archer','geomancer','shade','slime'],['shade','leaf','bell','raven','slime','leaf'],['leaf','wolf','archer','burrow','slime','leaf'],['slime','leaf','guardian','raven','wolf','slime'],['leaf','wolf','bell','spore','slime','leaf'],['wolf','leaf','spore','boar','slime','leaf']],
};
export const combatRole=(type:EnemyKind):'melee'|'ranged'|'heavy'|'support'=>['priest','bell'].includes(type)?'support':['boar','burrow','guardian','bomber','geomancer'].includes(type)?'heavy':['spore','archer'].includes(type)?'ranged':'melee';
export const COMPOSITION_LIMITS={ranged:2,heavy:3,support:1} as const;
export type WaveMember=EncounterDefinition['members'][number]&{wave:number};
export function waveMembers(d:EncounterDefinition,seed:number):WaveMember[]{
 const node=adventureIndex(d.id);if(node<0)return d.members.map(m=>({...m,wave:0}));
 let hash=seed>>>0;for(const c of d.id)hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
 const sizes=node===0?[6,6]:node===1?[8,8]:node===2?[8,8,8]:node===3?[6,6]:[8,8];
 const result:WaveMember[]=[];
 for(const [wave,size] of sizes.entries()){
  const pattern=COMBAT_TEMPLATES[d.direction][(hash+wave)%6];
  const pinned=node===3?(wave===1?[d.members.find(m=>m.elite)??{id:`v2:${d.id}:1:0:spore`,type:'spore' as const,elite:'brood' as const,x:d.x,y:d.y}]:[]):wave===0?d.members.filter(m=>!m.boss):[];
  const roles={melee:0,ranged:0,heavy:0,support:0};
  for(let slot=0;slot<size;slot++){
   const original=pinned[slot];let type=original?.type??(slot<6?pattern[slot]:pattern[slot%2]);
   let role=combatRole(type);if(!original&&role!=='melee'&&roles[role]>=COMPOSITION_LIMITS[role]){type=slot%2===0?'leaf':'slime';role='melee';}roles[role]++;
   const angle=slot*Math.PI*2/size,radius=210+(wave%2)*35;
   result.push({...original,id:original?.id??`v2:${d.id}:${wave}:${slot}:${type}`,type,x:original?.x??d.x+Math.cos(angle)*radius,y:original?.y??d.y+Math.sin(angle)*radius,wave});
  }
 }
 const boss=d.members.find(m=>m.boss);if(boss)result.push({...boss,wave:sizes.length});
 return result;
}
export function dynamicEncounterUnit(id:string):(EncounterDefinition['members'][number]&{group:string})|undefined{
 const match=/^v2:([a-z-]+):(\d):(\d):([a-z]+)$/.exec(id);if(!match)return;
 const [,group,w,s,type]=match,d=ENCOUNTERS.find(d=>d.id===group);if(!d||adventureIndex(group)<0||Number(w)>2||Number(s)>9||!['slime','leaf','spore','boar','raven','wolf','burrow','guardian','priest','bomber','archer','bell','shade','geomancer'].includes(type))return;
 const node=adventureIndex(group),size=node===0||node===3?6:8,angle=Number(s)*Math.PI*2/size,radius=210+(Number(w)%2)*35;
 return {id,type:type as EnemyKind,group,x:d.x+Math.cos(angle)*radius,y:d.y+Math.sin(angle)*radius,...node===3&&w==='1'&&s==='0'&&type==='spore'?{elite:'brood' as const}:{}};
}
