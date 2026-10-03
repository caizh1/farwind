import {ARENA_STONES} from "./elites";
import { SHORTCUTS } from "./shortcuts";
import { ENCOUNTERS } from './encounters';
import { CAMP_NESTS } from '../../campNests';
import { MASTER_PLAN, PLANNED_POIS } from "./layout";
import { planToWorld } from "./bounds";
import type { Prop } from "../../world";
// M2只接通地形与路线；据点、精英及任务的完成事实由后续系统拥有。
export const WILDERNESS_POIS = PLANNED_POIS.map((p) => ({
  ...p,
  ...planToWorld(p.x, p.y),
}));
const routeIds = [
  "outer-ring",
  "west-north-trade",
  "north-east-watch",
  "south-gathering",
  "west-old-road",
  "north-mountain",
  "east-valley",
];
export const WILDERNESS_ROADS = MASTER_PLAN.routes.map((r, i) => ({
  id: routeIds[i],
  width: r.kind === "ring" ? 85 : r.kind === "cross" ? 75 : 100,
  service: false,
  points: r.points.map(([x, y]) => {
    const p = planToWorld(x, y);
    return [p.x, p.y];
  }),
}));
WILDERNESS_ROADS.find((r) => r.id === "south-gathering")!.points = [
  [900, 1820],
  [990, 2010],
  [1000, 2110],
  [1000, 2450],
  [670, 2740],
  [1650, 3010],
];

WILDERNESS_ROADS.find((r) => r.id === "outer-ring")!.points = [
  [-60, 120],
  [1090, 50],
  [2230, 130],
  [2270, 1120],
  [2170, 1260],
  [2170, 1680],
  [2180, 1960],
  [990, 2010],
  [-70, 1890],
  [-60, 120],
];
WILDERNESS_ROADS.find((r) => r.id === "west-north-trade")!.points = [
  [-1510, 920],
  [-1730, 760],
  [-1710, 240],
  [-1300, -40],
  [-1030, -200],
  [30, -720],
  [960, -640],
];
WILDERNESS_ROADS.find((r) => r.id === "west-old-road")!.points = [
  [80, 1430],
  [-70, 1430],
  [-610, 1220],
  [-1020, 1270],
  [-1370, 1180],
  [-1510, 920],
];
WILDERNESS_ROADS.find((r) => r.id === "north-east-watch")!.points = [
  [960, -640],
  [2050, -500],
  [2600, 140],
  [2850, 560],
  [3070, 700],
  [3070, 1000],
];
WILDERNESS_ROADS.find((r) => r.id === "east-valley")!.points = [
  [2100, 1080],
  [2270, 1080],
  [3000, 1040],
  [3190, 1020],
  [3280, 1030],
  [3620, 520],
  [3250, -20],
  [3400, -760],
];
WILDERNESS_ROADS.push(
  {
    id: "west-door-link",
    width: 85,
    service: false,
    points: [
      [220, 1450],
      [80, 1430],
    ],
  },
  {
    id: "south-field-loop",
    width: 80,
    service: false,
    points: [
      [990, 2010],
      [1800, 2300],
      [2030, 2380],
      [2080, 2730],
      [1980, 2950],
      [1650, 3010],
      [670, 2740],
      [670, 2400],
      [690, 2190],
      [700, 2050],
      [990, 2010],
    ],
  },
  {
    id: "west-farm-loop",
    width: 75,
    service: false,
    points: [
      [-70, 1430],
      [-390, 1080],
      [-960, 1200],
      [-1700, 1490],
      [-1240, 1680],
      [-600, 1700],
      [-70, 1890],
    ],
  },
  {
    id: "north-outpost-loop",
    width: 75,
    service: false,
    points: [
      [600, -260],
      [330, -250],
      [-130, -770],
      [830, -640],
      [1080, -990],
      [1480, -730],
      [2050, -500],
    ],
  },
  {
    id: "east-south-loop",
    width: 75,
    service: false,
    points: [
      [2670, 1430],
      [2770, 1200],
      [3150, 1260],
      [3320, 1560],
      [3150, 1920],
      [3800, 2030],
      [3710, 1100],
      [3620, 520],
    ],
  },
  {
    id: "ruins-approach",
    width: 85,
    service: false,
    points: [
      [3740, 440],
      [3840, 440],
      [3840, 200],
      [3250, -20],
      [3100, -420],
      [3400, -760],
      [3840, -920],
      [4010, -390],
      [3560, -200],
    ],
  },
);
WILDERNESS_ROADS.find(r=>r.id==="north-mountain")!.points=[[820,220],[820,150],[560,0],[560,-140],[600,-260],[960,-640]];
WILDERNESS_ROADS.push(
 {id:"south-weir-link",width:70,service:false,points:[[1980,2950],[1650,2910],[1535,2910],[1535,2400],[1800,2300]]},
 {id:"north-pass-link",width:70,service:false,points:[[830,-640],[1030,-380],[1030,20],[820,150]]},
 {id:"east-corridor-link",width:70,service:false,points:[[2270,560],[2720,560],[2850,560]]},
);
export const WILD_WATERS = [
  {id:"east-cliff-pool",x:2460,y:560,rx:180,ry:300},
  { id: "south-reed-pool", x: 1000, y: 2280, rx: 260, ry: 110 },
  { id: "south-deep-pool", x: 1620, y: 2630, rx: 270, ry: 180 },
  { id: "west-pond", x: -1320, y: 420, rx: 260, ry: 150 },
] as const;
export const WILD_BRIDGES = [
  { x: 945, y: 2140, w: 110, h: 280 },
  { x: 1480, y: 2410, w: 110, h: 440 },
  { x: 2240, y: 500, w: 440, h: 110 },
] as const;
const tree = (id: string, x: number, y: number): Prop => ({
  id,
  art: "tree",
  x,
  y,
  w: 230,
  h: 290,
  solid: [50, 42],
  cover: "high",
});
const rock = (id: string, x: number, y: number, w = 125, h = 100): Prop => ({
  id,
  art: "rock",
  x,
  y,
  w,
  h,
  solid: [w * 0.75, h * 0.48],
  cover: "low",
});
export const WILDERNESS_PROPS: Prop[] = [
 ...ARENA_STONES.map(p=>({...p,art:"rock",solid:[...p.solid] as [number,number],cover:"low" as const})),
  ...ENCOUNTERS.filter(d=>d.kind==='camp').map((d):Prop=>({id:d.direction==='south'?'south-camp-root':`camp-root-${d.id}`,art:CAMP_NESTS[d.direction].texture,x:d.x,y:d.y,w:180,h:135,displayAt:{x:d.x,y:d.y-CAMP_NESTS[d.direction].lift},kind:'sign',ground:false,label:d.name})),
  ...SHORTCUTS.flatMap((s):Prop[]=>[
    {id:`repair-${s.id}`,art:"carpenter-workbench",x:s.x,y:s.y,w:85,h:75,kind:"sign",label:`修复 · ${s.name}`},
    {id:`barrier-${s.id}`,art:"wood",x:s.barrier.x,y:s.barrier.y,w:s.barrier.w+20,h:s.barrier.h+15,solid:[s.barrier.w,s.barrier.h],cover:"low"},
  ]),
  ...[650,740,830,920,1140,1230,1320,1410].map((x,i)=>rock(`north-ridge-${i}`,x,-55,130,150)),
  {
    id: "west-road-survey",
    art: "wood",
    x: -390,
    y: 1040,
    w: 110,
    h: 85,
    kind: "sign",
    label: "旧道路口 · 断栅与车辙",
  },
  {
    id: "old-farm-house",
    art: "house",
    x: -1080,
    y: 1140,
    w: 260,
    h: 270,
    solid: [205, 90],
    cover: "high",
  },
  {
    id: "old-farm-well",
    art: "well",
    x: -1150,
    y: 1400,
    w: 105,
    h: 120,
    solid: [70, 48],
  },
  {
    id: "north-outpost-tower",
    art: "tower",
    x: 720,
    y: -690,
    w: 220,
    h: 300,
    solid: [110, 75],
    cover: "high",
  },
  {
    id: "north-lookout-bench",
    art: "village-bench",
    x: -240,
    y: -810,
    w: 120,
    h: 75,
    solid: [100, 20],
  },
  { id: "ruins-outer-arch", art: "arch", x: 3100, y: -500, w: 330, h: 270 },
  { id: "ruins-final-arch", art: "arch", x: 3900, y: -1020, w: 390, h: 310 },
  ...[
    [-1780, 590],
    [-1490, 750],
    [-1120, 520],
    [-850, 600],
    [-650, 850],
    [-1380, 1320],
    [-1810, 1650],
    [-930, 1770],
    [-410, 1600],
    [1800, 2110],
    [2020, 2260],
    [1770, 2440],
    [1850, 2770],
    [2930, 1610],
    [3000, 1410],
    [3500, 1770],
    [3880, 1820],
    [4040, 1390],
    [2870, 480],
    [2790, 840],
    [3500, 270],
  ].map(([x, y], i) => tree(`wild-tree-${i + 1}`, x, y)),
  ...[
    [-1400, -210],
    [-1050, -600],
    [-530, -940],
    [170, -550],
    [510, -550],
    [940, -1080],
    [1360, -980],
    [1630, -300],
    [1810, -660],
    [2170, -740],
    [2550, -850],
    [2740, -330],
    [3600, -1130],
    [4070, -1140],
  ].map(([x, y], i) => rock(`wild-rock-${i + 1}`, x, y, 180, 155)),
  ...[
    [650, 2380],
    [740, 2500],
    [1760, 2180],
    [1830, 2470],
    [-1030, 1320],
    [-920, 1120],
    [-790, 1280],
    [-300, 1000],
    [730, -470],
    [970, -740],
    [3210, 1500],
    [3480, 1620],
  ].map(([x, y], i): Prop => ({
    id: `wild-resource-${i + 1}`,
    art: i < 4 ? "herb" : i < 8 ? "wood" : "berry",
    item: i < 4 ? "herb" : i < 8 ? "wood" : "berry",
    kind: "resource",
    label: i < 4 ? "药草" : i < 8 ? "枯枝" : "野生浆果",
    x,
    y,
    w: 70,
    h: 60,
  })),
];
