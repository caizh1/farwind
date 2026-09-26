import { FIELD_TARGETS, TRAINING } from "../game/systems/training";
import type { ItemId } from "./content";
import { VILLAGE_WALLS, VILLAGE_PORTALS, GATE_POST_OFFSET, RESERVED_PARCELS, villageClearance, regionAt } from "./village";
export const WORLD = {
  width: 4200,
  height: 2200,
  forest: 2050,
  ruins: 3300,
} as const;
export const POND = { x: 1280, y: 1120, rx: 260, ry: 230 } as const;
export const BRIDGES = [
  { x: 1030, y: 900, w: 120, h: 550 },
  { x: 1260, y: 1300, w: 100, h: 200 },
];
export const VILLAGE_GATE = { x: 1870, y: 1010, postOffset: 88 } as const;
export const villageAreas = [
  { id: "A", name: "风铃广场", x: 670, y: 780, detail: "接任务、辨方向、回村" },
  { id: "B", name: "西侧生活巷", x: 320, y: 990, detail: "木匠委托、收集木材" },
  {
    id: "C",
    name: "南侧果园",
    x: 470,
    y: 1450,
    detail: "浆果、花圃与隐蔽宝箱",
  },
  { id: "D", name: "药师小院", x: 1120, y: 540, detail: "采药、兑换恢复药剂" },
  { id: "E", name: "临水草坡", x: 1330, y: 1470, detail: "环湖散步、临水捷径" },
  {
    id: "F",
    name: "东北练习场",
    x: 1640,
    y: 540,
    detail: "四向攻击、三连击与风步",
  },
  { id: "G", name: "东村口", x: 1880, y: 980, detail: "沿石路向东进入森林" },
] as const;
export type Prop = {
  id: string;
  art: string;
  x: number;
  y: number;
  w: number;
  h: number;
  frame?: string;
  depth?: number;
  cover?: "low" | "high";
  owner?: "village";
  role?: "boundary" | "decoration";
  solid?: [number, number];
  kind?: "npc" | "resource" | "chest" | "stone" | "sign" | "shortcut";
  item?: ItemId;
  label?: string;
  index?: number;
};
export const props: Prop[] = [
  {
    id: TRAINING.id,
    art: "training-base",
    x: TRAINING.x,
    y: TRAINING.y,
    w: 90,
    h: 22,
    solid: [26, 14],
  },
  { id: "ruins-arch", art: "arch", x: 3750, y: 300, w: 330, h: 270 },
  {
    id: "ruins-pillar-left",
    art: "rune",
    x: 3600,
    y: 300,
    w: 65,
    h: 100,
    solid: [45, 45],
  },
  {
    id: "ruins-pillar-right",
    art: "rune",
    x: 3900,
    y: 300,
    w: 65,
    h: 100,
    solid: [45, 45],
  },
  {
    id: "home",
    art: "house",
    x: 330,
    y: 590,
    w: 280,
    h: 310,
    solid: [225, 100],
  },
  {
    id: "shop",
    art: "shop",
    x: 1120,
    y: 400,
    w: 290,
    h: 310,
    solid: [235, 95],
  },
  {
    id: "tower",
    art: "tower",
    x: 680,
    y: 470,
    w: 200,
    h: 240,
    solid: [160, 90],
  },
  { id: "well", art: "well", x: 940, y: 445, w: 135, h: 155, solid: [90, 60] },
  {
    id: "elder",
    art: "elder",
    x: 670,
    y: 620,
    w: 78,
    h: 92,
    kind: "npc",
    label: "守风人 · 岚爷爷",
  },
  {
    id: "healer",
    art: "healer",
    x: 1110,
    y: 570,
    w: 74,
    h: 90,
    kind: "npc",
    label: "药师 · 小满",
  },
  {
    id: "carpenter",
    art: "carpenter",
    x: 330,
    y: 1010,
    w: 76,
    h: 90,
    kind: "npc",
    label: "木匠 · 阿禾",
  },
  {
    id: "village-chest",
    art: "chest",
    x: 580,
    y: 1570,
    w: 68,
    h: 62,
    kind: "chest",
    label: "旧木箱",
  },
  {
    id: "herb-v1",
    art: "herb",
    x: 1180,
    y: 520,
    w: 60,
    h: 55,
    kind: "resource",
    item: "herb",
    label: "药草",
  },
  {
    id: "berry-v1",
    art: "berry",
    x: 350,
    y: 1370,
    w: 78,
    h: 65,
    kind: "resource",
    item: "berry",
    label: "浆果",
  },
  {
    id: "wood-v1",
    art: "wood",
    x: 270,
    y: 1110,
    w: 75,
    h: 55,
    kind: "resource",
    item: "wood",
    label: "枯枝",
  },
  {
    id: "stone-v1",
    art: "rock",
    x: 1730,
    y: 1170,
    w: 75,
    h: 55,
    kind: "resource",
    item: "stone",
    label: "溪石",
  },
  {
    id: "herb-f1",
    art: "herb",
    x: 2300,
    y: 1040,
    w: 65,
    h: 58,
    kind: "resource",
    item: "herb",
    label: "药草",
  },
  {
    id: "herb-f2",
    art: "herb",
    x: 2500,
    y: 1250,
    w: 65,
    h: 58,
    kind: "resource",
    item: "herb",
    label: "药草",
  },
  {
    id: "berry-f1",
    art: "berry",
    x: 2350,
    y: 1180,
    w: 78,
    h: 65,
    kind: "resource",
    item: "berry",
    label: "浆果",
  },
  {
    id: "wood-f1",
    art: "wood",
    x: 2860,
    y: 1140,
    w: 75,
    h: 55,
    kind: "resource",
    item: "wood",
    label: "枯枝",
  },
  {
    id: "stone-f1",
    art: "rock",
    x: 3000,
    y: 1030,
    w: 75,
    h: 55,
    kind: "resource",
    item: "stone",
    label: "溪石",
  },
  {
    id: "hidden-chest",
    art: "chest",
    x: 2600,
    y: 1660,
    w: 68,
    h: 62,
    kind: "chest",
    label: "藤蔓下的宝箱",
  },
  {
    id: "clue",
    art: "sign",
    x: 3370,
    y: 830,
    w: 100,
    h: 140,
    kind: "sign",
    label: "古老碑文",
  },
  {
    id: "wind-0",
    art: "rune",
    x: 3510,
    y: 540,
    w: 90,
    h: 120,
    kind: "stone",
    index: 0,
    label: "晨风石 · 一",
  },
  {
    id: "wind-1",
    art: "rune",
    x: 3760,
    y: 390,
    w: 90,
    h: 120,
    kind: "stone",
    index: 1,
    label: "林风石 · 二",
  },
  {
    id: "wind-2",
    art: "rune",
    x: 3970,
    y: 570,
    w: 90,
    h: 120,
    kind: "stone",
    index: 2,
    label: "暮风石 · 三",
  },
  {
    id: "waymark",
    art: "sign",
    x: 3740,
    y: 680,
    w: 140,
    h: 180,
    kind: "sign",
    label: "风之路标",
  },
  {
    id: "shortcut",
    art: "rune",
    x: 3500,
    y: 920,
    w: 85,
    h: 110,
    kind: "shortcut",
    label: "归乡风径",
  },
];
// 树冠与围栏沿道路边缘布置，入口保留至少 120 像素通路。
const trees = [
  [140, 530],
  [520, 460],
  [200, 820],
  [160, 1230],
  [800, 1160],
  [190, 1560],
  [680, 1560],
  [830, 330],
  [1300, 350],
  [1440, 260],
  [1660, 1040],
  [1800, 1290],
  [1530, 1510],
  [980, 1540],
  [1940, 700],
  [2120, 580],
  [2300, 620],
  [2500, 740],
  [2720, 650],
  [3000, 740],
  [3130, 980],
  [2270, 1430],
  [2460, 1520],
  [2850, 1490],
  [3040, 1390],
  [2730, 1800],
  [2300, 1830],
  [3340, 530],
  [3410, 300],
  [4030, 840],
  [4050, 320],
];
trees.forEach(([x, y], i) =>
  props.push({
    id: `tree-${i}`,
    art: i % 5 === 1 ? "pink" : "tree",
    x,
    y: i === 7 ? 980 : y,
    w: i < 15 ? 190 : 245,
    h: i < 15 ? 230 : 280,
    solid: [38, 27],
  }),
);
props.push(
  {
    id: "carpenter-workbench",
    art: "carpenter-workbench",
    x: 412.5,
    y: 975,
    w: 117,
    h: 66,
    role: "decoration",
  },
  // 沿用原地面长椅的脚底中心；无交互、无新增阻挡。
  { id: "pond-bench-west", art: "village-bench", x: 940, y: 1380, w: 90, h: 50, role: "decoration" },
  { id: "pond-bench-east", art: "village-bench", x: 1540, y: 1350, w: 90, h: 50, role: "decoration" },
  {
    id: "plaza-fountain",
    art: "fountain",
    x: 680,
    y: 890,
    w: 130,
    h: 130,
    solid: [100, 45],
  },
  {
    id: "west-cottage",
    art: "house",
    x: 310,
    y: 850,
    w: 230,
    h: 255,
    solid: [190, 85],
  },
  {
    id: "carpenter-workshop",
    art: "shop",
    x: 180,
    y: 1040,
    w: 195,
    h: 210,
    solid: [150, 75],
  },
  // 横梁与两柱分层，碰撞只落在两个柱脚上，门洞沿南北主路通行。
  {
    id: "village-gate",
    art: "village-gate",
    frame: "beam",
    x: 1871,
    y: 870,
    w: 122,
    h: 75,
    depth: 1050,
  },
  {
    id: "village-gate-post-west",
    art: "village-gate",
    frame: "west",
    x: VILLAGE_GATE.x - VILLAGE_GATE.postOffset,
    y: VILLAGE_GATE.y,
    w: 55,
    h: 215,
    solid: [38, 26],
  },
  {
    id: "village-gate-post-east",
    art: "village-gate",
    frame: "east",
    x: VILLAGE_GATE.x + VILLAGE_GATE.postOffset,
    y: VILLAGE_GATE.y,
    w: 53,
    h: 215,
    solid: [38, 26],
  },
  { id: "herb-bed-west", art: "herb-bed", x: 1220, y: 510, w: 132, h: 99 },
  { id: "herb-bed-east", art: "herb-bed", x: 1310, y: 565, w: 132, h: 99 },
  {
    id: "village-guide",
    art: "sign",
    x: 2000,
    y: 1210,
    w: 75,
    h: 110,
    kind: "sign",
    label: "东村口路牌",
  },
  {
    id: "training-guide",
    art: "sign",
    x: 1740,
    y: 700,
    w: 70,
    h: 100,
    kind: "sign",
    label: "练习场须知",
  },
  {
    id: "herb-garden-1",
    art: "herb",
    x: 1220,
    y: 450,
    w: 65,
    h: 58,
    kind: "resource",
    item: "herb",
    label: "药圃 · 药草",
  },
  {
    id: "herb-garden-2",
    art: "herb",
    x: 1310,
    y: 510,
    w: 65,
    h: 58,
    kind: "resource",
    item: "herb",
    label: "药圃 · 药草",
  },
  {
    id: "orchard-berry-1",
    art: "berry",
    x: 490,
    y: 1320,
    w: 80,
    h: 70,
    kind: "resource",
    item: "berry",
    label: "果园 · 浆果",
  },
  {
    id: "orchard-berry-2",
    art: "berry",
    x: 670,
    y: 1390,
    w: 80,
    h: 70,
    kind: "resource",
    item: "berry",
    label: "果园 · 浆果",
  },
  {
    id: "wood-yard-1",
    art: "wood",
    x: 440,
    y: 1110,
    w: 80,
    h: 60,
    kind: "resource",
    item: "wood",
    label: "木工区 · 木材",
  },
  {
    id: "wood-yard-2",
    art: "wood",
    x: 220,
    y: 1180,
    w: 80,
    h: 60,
    kind: "resource",
    item: "wood",
    label: "木工区 · 木材",
  },
);
FIELD_TARGETS.forEach((t) =>
  props.push({
    id: t.id,
    art: "training-base",
    x: t.x,
    y: t.y,
    w: 90,
    h: 22,
    solid: [26, 14],
  }),
);
// 闭合村界和三门来自同一组数据，西侧没有通行缺口。
for (const run of VILLAGE_WALLS) {
  const horizontal=run.a.y===run.b.y;
  const length=Math.hypot(run.b.x-run.a.x,run.b.y-run.a.y),n=Math.ceil(length/150);
  for(let i=0;i<n;i++) {
    const start=i*length/n,end=(i+1)*length/n;
    props.push({
      id:`${run.id}-${i}`,art:horizontal?"fence":"vertical-fence",frame:horizontal?"boundary":"trim",
      x:horizontal?run.a.x+(start+end)/2:run.a.x,
      y:horizontal?run.a.y+11:run.a.y+end,
      w:horizontal?end-start+2:38,h:horizontal?72:end-start+2,
      solid:horizontal?[end-start+2,22]:[22,end-start+2],
      role:"boundary",cover:"low",owner:"village",
    });
  }
}
for(const portal of VILLAGE_PORTALS) {
  for(const [index,offset] of [-GATE_POST_OFFSET,GATE_POST_OFFSET].entries()) {
    const x=portal.x+(portal.axis==="y"?offset:0),y=portal.y+(portal.axis==="x"?offset:0)+13;
    props.push({id:`${portal.id}-post-${index}`,art:"village-gate",frame:index?"east":"west",x,y,w:55,h:215,solid:[38,26],role:"boundary",cover:"high",owner:"village"});
  }
  // 南北门的高横梁在背景层；东西门两柱沿道路两侧排序，保留横向通行。
  if(portal.axis==="y") props.push({id:`${portal.id}-beam`,art:"village-gate",frame:"beam",x:portal.x,y:portal.y-135,w:165,h:76,depth:portal.y-30});
  const signX=portal.axis==="x"?portal.x+(portal.id==="west-gate"?100:-100):portal.x+155;
  const signY=portal.axis==="x"?portal.y+(portal.id==="west-gate"?70:175):portal.y+100*(portal.id==="north-gate"?1:-1);
  props.push({id:`${portal.id}-sign`,art:"sign",x:signX,y:signY,w:65,h:90,kind:"sign",label:portal.open?`${portal.name}路牌`:`${portal.name} · 暂不开放`});
}
for(const parcel of RESERVED_PARCELS) {
  props.push({id:`${parcel.id}-sign`,art:"sign",x:parcel.x+30,y:parcel.y+40,w:52,h:72,kind:"sign",label:parcel.name});
  // 短栏及空院保留生活尺度，入口开放，不伪造未实现的交互。
  for(const [part,a,b] of [[0,0,parcel.w/2-60],[1,parcel.w/2+60,parcel.w]] as const){
    const n=Math.ceil((b-a)/125);
    for(let i=0;i<n;i++){
      const w=(b-a)/n;
      props.push({id:`${parcel.id}-rim-${part}-${i}`,art:"fence",frame:"boundary",x:parcel.x+a+w*(i+0.5),y:parcel.y+parcel.h,w:w+2,h:40,solid:[w+2,15],role:"boundary",cover:"low",owner:"village"});
    }
  }
}
for (const [i, x] of [230, 390, 550, 710].entries())
  props.push({
    id: `orchard-tree-${i}`,
    art: i % 2 ? "pink" : "tree",
    x,
    y: 1280,
    w: 145,
    h: 180,
    solid: [28, 22],
  });
const fences: number[][] = [
  ...[180, 290, 400, 510, 620, 730].map((x) => [x, 1620]),
  ...[1480, 1590, 1700, 1810].map((x) => [x, 330]),
];
fences.forEach(([x, y], i) =>
  props.push({
    id: `fence-${i}`,
    art: "fence",
    x,
    y,
    w: 110,
    h: 68,
    solid: [108, 15],
    cover:"low",owner:"village",
  }),
);
// 连续低栏围合院落与练习场，南侧各留一个入口；复用现有木栏和树篱。
function lowFence(id: string, x: number, y: number, w = 110) {
  props.push({
    id,
    art: "fence",
    x,
    y,
    w,
    h: 68,
    solid: [w - 2, 15],
    cover:"low",owner:"village",
    role: "boundary",
  });
}
function hedgeLine(id: string, a: number[], b: number[]) {
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 30);
  for (let i = 0; i <= n; i++)
    props.push({
      id: `${id}-${i}`,
      art: "bush",
      x: a[0] + ((b[0] - a[0]) * i) / n,
      y: a[1] + ((b[1] - a[1]) * i) / n,
      w: 55,
      h: 45,
      solid: [30, 30],
      cover:"low",owner:"village",
      role: "boundary",
    });
}
for (const [i, x] of [950, 1058, 1166, 1274, 1360].entries())
  lowFence(`court-back-${i}`, x, 350, i === 4 ? 60 : 110);
lowFence("court-front-west", 1000, 600, 100);
lowFence("court-front-east", 1280, 650, 220);
hedgeLine("court-west", [900, 350], [900, 540]);
hedgeLine("court-corner", [900, 540], [950, 600]);
hedgeLine("court-gate-west", [1040, 600], [1040, 650]);
hedgeLine("court-east", [1390, 350], [1390, 650]);
for (const [i, x] of [1460, 1568, 1742, 1850].entries())
  lowFence(`field-front-${i}`, x, 760, i === 1 || i === 2 ? 70 : 110);
hedgeLine("field-west", [1400, 330], [1400, 760]);
hedgeLine("field-east", [1900, 330], [1900, 760]);
lowFence("gate-fence-west", 1707, 1010, 110);
lowFence("gate-fence-east", 1990, 1010, 60);
export const roads = [
  [
    [820, 120],
    [820, 320],
    [820, 560],
    [800, 600],
    [800, 730],
    [650, 780],
    [900, 780],
    [1120, 750],
    [1390, 860],
    [1600, 860],
    [1760, 900],
    [1870, 920],
    [1870, 1080],
    [2170, 1080],
    [2800, 1100],
    [3160, 1000],
    [3480, 760],
    [3750, 660],
  ],
  [
    [330, 620],
    [330, 780],
    [470, 850],
    [470, 1030],
    [650, 1100],
    [670, 1440],
    [860, 1470],
    [1040, 1500],
    [1280, 1480],
    [1550, 1400],
    [1680, 1210],
    [1870, 1080],
  ],
  [
    [650, 780],
    [650, 1100],
  ],
  [
    [470, 1030],
    [300, 1030],
    [300, 1450],
    [670, 1440],
  ],
  [
    [1110, 750],
    [1110, 640],
  ],
  [
    [860, 1470],
    [1090, 1450],
    [1090, 900],
    [1090, 820],
    [1120, 750],
  ],
  [
    [1280, 1480],
    [1300, 1370],
  ],
  [
    [2800, 1100],
    [2670, 1430],
    [2600, 1700],
  ],
  [
    [3750, 660],
    [3740, 400],
  ],
  [
    [3510, 540],
    [3740, 600],
    [3970, 570],
  ],
  [
    [1640, 860],
    [1640, 710],
  ],
  [[860,1470],[900,1640],[900,2100]],
] as number[][][];
export const roadWidth = (index: number) =>
  index === 0 ? 170 : index === 4 || index === 10 ? 80 : 115;
export const showLayoutLabels = (development: boolean, search: string) =>
  development && new URLSearchParams(search).get("layoutDebug") === "1";
export const inReworkArea = (x: number, y: number) =>
  x >= 880 && x <= 2120 && y >= 250 && y <= 1110;

// 以正式区域覆盖新村界和门外缓冲区，森林、遗迹沿用旧布置。
export const inVillageDecorArea = (x: number, y: number) =>
  ["village", "north", "south", "west"].includes(regionAt({ x, y }).id);
// 生成装饰使用同一套路宽与保留空间；结构性围栏不属于随机装饰。
export function canDecorate(x: number, y: number, radius = 12) {
  if(!villageClearance(x,y,radius))return false;
  for (const [i, path] of roads.entries())
    for (let j = 1; j < path.length; j++) {
      const [ax, ay] = path[j - 1],
        [bx, by] = path[j];
      const dx = bx - ax,
        dy = by - ay;
      const t = Math.max(
        0,
        Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)),
      );
      if (
        Math.hypot(x - ax - t * dx, y - ay - t * dy) <
        roadWidth(i) / 2 + 8 + radius
      )
        return false;
    }
  if (
    BRIDGES.some(
      (b) =>
        x > b.x - radius &&
        x < b.x + b.w + radius &&
        y > b.y - radius &&
        y < b.y + b.h + radius,
    )
  )
    return false;
  if (
    Math.abs(x - VILLAGE_GATE.x) < 75 + radius &&
    Math.abs(y - VILLAGE_GATE.y) < 115 + radius
  )
    return false;
  if (
    props.some(
      (p) => p.kind === "npc" && Math.hypot(x - p.x, y - p.y) < 65 + radius,
    )
  )
    return false;
  return [TRAINING, ...FIELD_TARGETS].every(
    (t) => Math.hypot(x - t.x, y - t.y) >= 105 + radius,
  );
}
export const shoreFlowers = Array.from({ length: 75 }, (_, i) => {
  const a = i * 2.399;
  return {
    x: 1280 + Math.cos(a) * 320,
    y: 1120 + Math.sin(a) * 300,
    pink: i % 2 === 1,
  };
}).filter((p) => canDecorate(p.x, p.y, 12));
for (let i = 0; i < 45; i++) {
  const x = 120 + ((i * 337) % 3900),
    y = 280 + ((i * 193) % 1600);
  if (x < 2050 && y < 1600) continue;
  // 只清理东村口过渡区的生成装饰，森林与遗迹内部的旧布置保留。
  if ((inReworkArea(x, y) || inVillageDecorArea(x, y)) && !canDecorate(x, y, (65 + (i % 3) * 12) / 2))
    continue;
  props.push({
    id: `bush-${i}`,
    art: "bush",
    x,
    y,
    w: 65 + (i % 3) * 12,
    h: 65,
  });
}
export const villageRoutes = [
  {
    name: "主线出发路线",
    points: [
      [670, 780],
      [900, 780],
      [1120, 750],
      [1390, 860],
      [1600, 860],
      [1760, 900],
      [1870, 920],
      [1870, 1080],
      [2110, 1080],
    ],
  },
  {
    name: "生活探索环线",
    points: [
      [670, 780],
      [470, 850],
      [470, 1030],
      [300, 1030],
      [300, 1450],
      [670, 1440],
      [860, 1470],
      [1280, 1480],
      [1550, 1400],
      [1680, 1210],
      [1870, 1080],
      [1870, 920],
      [1760, 900],
      [1600, 860],
      [1390, 860],
      [1120, 750],
      [900, 780],
      [670, 780],
    ],
  },
  {
    name: "临水小径",
    points: [
      [1280, 1480],
      [1090, 1450],
      [1090, 900],
      [1090, 820],
      [1120, 750],
      [900, 780],
      [670, 780],
    ],
  },
];
export function routeSeconds(points: number[][]) {
  return Math.round(
    points
      .slice(1)
      .reduce(
        (n, p, i) => n + Math.hypot(p[0] - points[i][0], p[1] - points[i][1]),
        0,
      ) / 150,
  );
}
export const enemyDefs = [
  { id: "slime-1", x: 2450, y: 1060, type: "slime" },
  { id: "slime-2", x: 2670, y: 1230, type: "slime" },
  { id: "leaf-1", x: 2920, y: 1070, type: "leaf" },
  { id: "leaf-2", x: 3170, y: 930, type: "leaf" },
] as const;
export function region(x: number, y: number) {
  return regionAt({x,y}).name;
}

// 交互物只阻挡实际占地，互动视线忽略目标本体。
props.forEach((p) => {
  if (p.kind === "chest") p.solid = [45, 28];
  if (p.kind === "stone" || p.kind === "sign" || p.kind === "shortcut")
    p.solid = [35, 28];
});

// 24×20脚底占地；近战使用原实体矩形，二者均与树冠无关。
export const FOOT = { halfWidth: 12, halfHeight: 10 } as const;
export function propBounds(p: Prop, motion = false) {
  const [w, h] = p.solid!;
  const x = motion ? FOOT.halfWidth : 0,
    y = motion ? FOOT.halfHeight : 0;
  return {
    left: p.x - w / 2 - x,
    right: p.x + w / 2 + x,
    top: p.y - h - y,
    bottom: p.y + y,
  };
}
// 只允许忽略明确目标的本体占地；其他实体仍参与碰撞。
export function solidPropAt(x: number, y: number, ignore?: string) {
  return props.some(
    (p) =>
      p.id !== ignore &&
      p.solid &&
      Math.abs(x - p.x) < p.solid[0] / 2 + FOOT.halfWidth &&
      y > p.y - p.solid[1] - FOOT.halfHeight &&
      y < p.y + FOOT.halfHeight,
  );
}

// 地形与渲染使用同一份池塘和桥梁尺寸，桥面优先于水域阻挡。
export function terrainBlocked(x: number, y: number) {
  if (x < 30 || x > WORLD.width - 30 || y < 80 || y > WORLD.height - 30)
    return true;
  const bridge = BRIDGES.some(
    (b) => x >= b.x + 12 && x <= b.x + b.w - 12 && y >= b.y && y <= b.y + b.h,
  );
  if (
    !bridge &&
    ((x - POND.x) / (POND.rx + 10)) ** 2 +
      ((y - POND.y) / (POND.ry + 10)) ** 2 <
      1
  )
    return true;
  if (y >= 650 && y <= 1580 && !(y >= 1010 && y <= 1180)) {
    const t = (y - 650) / 930;
    const streamX =
      (1 - t) ** 3 * 2620 +
      3 * (1 - t) ** 2 * t * 2540 +
      3 * (1 - t) * t * t * 2700 +
      t ** 3 * 2570;
    if (Math.abs(x - streamX) < 40) return true;
  }
  return false;
}
