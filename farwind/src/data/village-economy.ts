import type { Prop } from "./world";
// 六栋增量建筑：脚底、院门与短路单独定义，不用全村概念图替代通行数据。
export const serviceBuildings: Prop[] = [
  {
    id: "general-building",
    art: "shop",
    x: 930,
    y: 1130,
    w: 210,
    h: 235,
    solid: [170, 70],
    cover: "high",
  },
  {
    id: "smith-building",
    art: "smith-building",
    x: 1950,
    y: 1510,
    w: 205,
    h: 250,
    solid: [160, 75],
    cover: "high",
  },
  {
    id: "inn-building",
    art: "inn-building",
    x: 1630,
    y: 1580,
    w: 210,
    h: 255,
    solid: [160, 75],
    cover: "high",
  },
  {
    id: "barracks-building",
    art: "house",
    x: 1995,
    y: 600,
    w: 170,
    h: 220,
    solid: [140, 70],
    cover: "high",
  },
  {
    id: "resident-cottage-1",
    art: "house",
    x: 550,
    y: 600,
    w: 180,
    h: 235,
    solid: [130, 70],
    cover: "high",
  },
  {
    id: "resident-cottage-2",
    art: "house",
    x: 840,
    y: 1370,
    w: 180,
    h: 235,
    solid: [130, 70],
    cover: "high",
  },
];
export const serviceEntrances: Prop[] = [
  {
    id: "service-general",
    art: "sign",
    x: 975,
    y: 1190,
    w: 55,
    h: 78,
    kind: "sign",
    label: "风铃杂货铺 · 买卖材料",
  },
  {
    id: "service-smith",
    art: "sign",
    x: 2005,
    y: 1570,
    w: 55,
    h: 78,
    kind: "sign",
    label: "溪石铁匠铺 · 武器与护甲",
  },
  {
    id: "service-inn",
    art: "sign",
    x: 1685,
    y: 1640,
    w: 55,
    h: 78,
    kind: "sign",
    label: "归风旅馆 · 休息补给",
  },
  {
    id: "barracks-sign",
    art: "sign",
    x: 2030,
    y: 655,
    w: 50,
    h: 70,
    kind: "sign",
    label: "风铃营房",
  },
];
export const serviceRoads = [
  [
    [650, 1100],
    [735, 1220],
    [945, 1220],
  ],
  [
    [860, 1470],
    [840, 1430],
  ],
  [
    [550, 650],
    [650, 780],
  ],
  [
    [1550, 1400],
    [1480, 1530],
    [1630, 1650],
  ],
  [
    [1680, 1210],
    [1720, 1340],
    [1790, 1590],
    [1950, 1590],
  ],
  [
    [1760, 900],
    [1870, 820],
    [2030, 780],
    [2030, 700],
  ],
];
export function serviceClearance(x: number, y: number, radius: number) {
  return ![...serviceBuildings, ...serviceEntrances].some(
    (p) =>
      Math.abs(x - p.x) < (p.solid?.[0] ?? 90) / 2 + radius + 15 &&
      y > p.y - (p.solid?.[1] ?? 40) - radius - 15 &&
      y < p.y + radius + 80,
  );
}
