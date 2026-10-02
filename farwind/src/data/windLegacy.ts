import type {Prop} from './world';
import type {EncounterDefinition} from './maps/windbell/encounters';
// 全部场地位于已有翡翠森林支路，不扩大边界，不改旧据点成员。
export const LEGACY_SITES={
 windRecord:{x:2400,y:1430,name:'旧风道残记'},windDevice:{x:2510,y:1580,name:'导风设施'},windExit:{x:2560,y:2070,name:'风道出口'},
 bladeRecord:{x:2830,y:760,name:'断路人的守路记'},bladePost:{x:3050,y:680,name:'旧路前哨'},bladeExit:{x:3330,y:550,name:'旧路尽头'},
 ending:{x:3600,y:1110,name:'棘枝传承遗刻'},
} as const;
export const LEGACY_ENCOUNTERS:readonly EncounterDefinition[]=[
 {id:'legacy-wind-device',name:'导风设施守敌',direction:'east',kind:'challenge',source:'east-thorn-camp',x:2580,y:1630,radius:200,cooldownMs:0,members:[{id:'legacy-device-leaf',type:'leaf',x:2320,y:1650},{id:'legacy-device-slime',type:'slime',x:2710,y:1670}],patrol:[{x:2580,y:1630}]},
 {id:'legacy-wind-passage',name:'柱间风道',direction:'east',kind:'challenge',source:'east-thorn-camp',x:2500,y:1920,radius:220,cooldownMs:0,members:[{id:'legacy-passage-guardian',type:'guardian',x:2500,y:1900},{id:'legacy-passage-leaf',type:'leaf',x:2600,y:2020},{id:'legacy-passage-slime',type:'slime',x:2380,y:2020}],patrol:[{x:2500,y:1920}]},
 {id:'legacy-blade-post',name:'封路前哨',direction:'east',kind:'challenge',source:'east-thorn-camp',x:3020,y:780,radius:200,cooldownMs:0,members:[{id:'legacy-post-guardian',type:'guardian',x:2950,y:780},{id:'legacy-post-priest',type:'priest',x:3130,y:740}],patrol:[{x:3020,y:780}]},
 {id:'legacy-blade-road',name:'旧路夹击',direction:'east',kind:'challenge',source:'east-thorn-camp',x:3340,y:570,radius:220,cooldownMs:0,members:[{id:'legacy-road-guardian',type:'guardian',x:3290,y:600},{id:'legacy-road-priest',type:'priest',x:3380,y:580},{id:'legacy-road-leaf',type:'leaf',x:3470,y:650}],patrol:[{x:3340,y:570}]},
];
export const LEGACY_PROPS:Prop[]=Object.entries(LEGACY_SITES).map(([key,p])=>({id:`legacy-${key}`,x:p.x,y:p.y,w:key==='windDevice'?60:64,h:key==='windDevice'?95:64,art:key==='windDevice'?'wind-chime-ribbon':'training-book',kind:'sign',label:p.name,ground:false}));
LEGACY_PROPS.push(
 {id:'legacy-residual-a',x:2380,y:1460,w:34,h:34,art:'rune'},
 {id:'legacy-residual-b',x:2440,y:1530,w:34,h:34,art:'rune'},
 {id:'legacy-wind-bell',x:2510,y:1500,w:25,h:65,art:'wind-chime-ribbon',ground:false},
 {id:'legacy-wind-pillar-left',x:2430,y:1840,w:55,h:110,art:'rock',solid:[40,50]},
 {id:'legacy-wind-pillar-right',x:2550,y:1840,w:55,h:110,art:'rock',solid:[40,50]},
 {id:'legacy-wind-seal',x:2490,y:1840,w:80,h:35,art:'fence',frame:'boundary',solid:[80,25]},
 {id:'legacy-blade-seal',x:3200,y:650,w:85,h:35,art:'fence',frame:'boundary',solid:[85,25]},
);
