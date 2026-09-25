import type { ItemId } from "./content";
export type Prop = {
  id: string;
  art: string;
  x: number;
  y: number;
  w: number;
  h: number;
  solid?: [number, number];
  kind?: "npc" | "resource" | "chest" | "stone" | "sign" | "shortcut";
  item?: ItemId;
  label?: string;
  index?: number;
};
export const props: Prop[] = [
  { id: "ruins-arch", art: "arch", x: 3150, y: 300, w: 330, h: 270 },
  {
    id: "ruins-pillar-left",
    art: "rune",
    x: 3000,
    y: 300,
    w: 65,
    h: 100,
    solid: [45, 45],
  },
  {
    id: "ruins-pillar-right",
    art: "rune",
    x: 3300,
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
    x: 1020,
    y: 590,
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
  { id: "well", art: "well", x: 930, y: 820, w: 135, h: 155, solid: [90, 60] },
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
    x: 1040,
    y: 720,
    w: 74,
    h: 90,
    kind: "npc",
    label: "药师 · 小满",
  },
  {
    id: "carpenter",
    art: "carpenter",
    x: 400,
    y: 970,
    w: 76,
    h: 90,
    kind: "npc",
    label: "木匠 · 阿禾",
  },
  {
    id: "village-chest",
    art: "chest",
    x: 1150,
    y: 1020,
    w: 68,
    h: 62,
    kind: "chest",
    label: "旧木箱",
  },
  {
    id: "herb-v1",
    art: "herb",
    x: 790,
    y: 820,
    w: 60,
    h: 55,
    kind: "resource",
    item: "herb",
    label: "药草",
  },
  {
    id: "berry-v1",
    art: "berry",
    x: 500,
    y: 900,
    w: 78,
    h: 65,
    kind: "resource",
    item: "berry",
    label: "浆果",
  },
  {
    id: "wood-v1",
    art: "wood",
    x: 360,
    y: 1080,
    w: 75,
    h: 55,
    kind: "resource",
    item: "wood",
    label: "枯枝",
  },
  {
    id: "stone-v1",
    art: "rock",
    x: 1100,
    y: 1080,
    w: 75,
    h: 55,
    kind: "resource",
    item: "stone",
    label: "溪石",
  },
  {
    id: "herb-f1",
    art: "herb",
    x: 1700,
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
    x: 1900,
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
    x: 1750,
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
    x: 2260,
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
    x: 2400,
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
    x: 2000,
    y: 1660,
    w: 68,
    h: 62,
    kind: "chest",
    label: "藤蔓下的宝箱",
  },
  {
    id: "clue",
    art: "sign",
    x: 2770,
    y: 830,
    w: 100,
    h: 140,
    kind: "sign",
    label: "古老碑文",
  },
  {
    id: "wind-0",
    art: "rune",
    x: 2910,
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
    x: 3160,
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
    x: 3370,
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
    x: 3140,
    y: 680,
    w: 140,
    h: 180,
    kind: "sign",
    label: "风之路标",
  },
  {
    id: "shortcut",
    art: "rune",
    x: 2900,
    y: 920,
    w: 85,
    h: 110,
    kind: "shortcut",
    label: "归乡风径",
  },
];
const trees: [[number, number], ...Array<[number, number]>] = [
  [160, 530],
  [1300, 540],
  [140, 930],
  [1280, 1080],
  [520, 480],
  [880, 440],
  [200, 1250],
  [780, 1180],
  [1190, 1330],
  [1520, 580],
  [1700, 620],
  [1900, 740],
  [2120, 650],
  [2400, 740],
  [2530, 980],
  [1670, 1430],
  [1860, 1520],
  [2250, 1490],
  [2440, 1390],
  [2130, 1800],
  [1700, 1830],
  [2740, 530],
  [2810, 300],
  [3430, 840],
  [3450, 320],
];
trees.forEach(([x, y], i) =>
  props.push({
    id: `tree-${i}`,
    art: i === 4 || i === 6 ? "pink" : "tree",
    x,
    y,
    w: i < 9 ? 200 : 245,
    h: i < 9 ? 240 : 280,
    solid: [38, 27],
  }),
);
for (let i = 0; i < 8; i++)
  props.push({
    id: `fence-${i}`,
    art: "fence",
    x: i < 2 ? 190 + i * 110 : 240 + i * 120,
    y: i < 2 ? 860 : 1160,
    w: 110,
    h: 68,
    solid: [108, 15],
  });
for (let i = 0; i < 36; i++) {
  const x = 100 + ((i * 317) % 3300),
    y = 280 + ((i * 193) % 1600);
  if (
    (x < 1400 && Math.abs(y - 780) < 130) ||
    (x > 1400 && Math.abs(y - 1100) < 120)
  )
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
export const roads = [
  [
    [650, 200],
    [650, 780],
    [1050, 800],
    [1570, 1080],
    [2200, 1100],
    [2560, 1000],
    [2880, 760],
    [3150, 660],
  ],
  [
    [250, 680],
    [650, 780],
    [460, 1040],
  ],
  [
    [1030, 540],
    [1030, 800],
    [1150, 1020],
  ],
  [
    [2200, 1100],
    [2070, 1430],
    [2000, 1700],
  ],
  [
    [3150, 660],
    [3140, 400],
  ],
  [
    [2910, 540],
    [3140, 600],
    [3370, 570],
  ],
] as number[][][];
export const enemyDefs = [
  { id: "slime-1", x: 1850, y: 1060, type: "slime" },
  { id: "slime-2", x: 2070, y: 1230, type: "slime" },
  { id: "leaf-1", x: 2320, y: 1070, type: "leaf" },
  { id: "leaf-2", x: 2570, y: 930, type: "leaf" },
] as const;
export function region(x: number) {
  return x < 1450 ? "风铃村" : x < 2700 ? "翡翠森林" : "风之遗迹";
}

// 交互物只阻挡实际占地，互动视线忽略目标本体。
props.forEach((p) => {
  if (p.kind === "chest") p.solid = [45, 28];
  if (p.kind === "stone" || p.kind === "sign" || p.kind === "shortcut")
    p.solid = [35, 28];
});
