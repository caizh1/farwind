import {GUARD_DEFS,RAID_GATES,TOWERS} from "./defense";
import {WORLD_BOUNDS as B} from "./maps/windbell/bounds";
export type Point = { x: number; y: number };
export const VILLAGE_BOUNDS = {
  left: 80,
  right: 2100,
  top: 220,
  bottom: 1820,
} as const;
export const VILLAGE_PORTALS = [
  {
    id: "east-gate",
    name: "东门",
    x: 2100,
    y: 1080,
    axis: "x",
    open: true,
    outsideRegion: "forest",
  },
  {
    id: "north-gate",
    name: "北门",
    x: 820,
    y: 220,
    axis: "y",
    open: true,
    outsideRegion: "north",
  },
  {
    id: "south-gate",
    name: "南门",
    x: 900,
    y: 1820,
    axis: "y",
    open: true,
    outsideRegion: "south",
  },
  {
    id: "west-gate",
    name: "西门旧道",
    x: 80,
    y: 1430,
    axis: "x",
    open: false,
    outsideRegion: "west",
  },
] as const;
// 两柱中心相距216；各柱宽38，扣除玩家24宽脚底后净通行宽154。
export const GATE_POST_OFFSET = 108;
export const GATE_WALL_CUT = GATE_POST_OFFSET + 19;
const rectangle = (
  left: number,
  top: number,
  right: number,
  bottom: number,
): Point[] => [
  { x: left, y: top },
  { x: right, y: top },
  { x: right, y: bottom },
  { x: left, y: bottom },
];
export const MAP_REGIONS = [
  {
    id: "village",
    name: "风铃村",
    polygon: rectangle(80, 220, 2100, 1820),
    dangerous: false,
  },
  {
    id: "north",
    name: "北部山林与旧哨站",
    polygon: rectangle(B.left,B.top,2450,220),
    dangerous: true,
  },
  {
    id: "south",
    name: "南部田野与湿地",
    polygon: rectangle(B.left,1820,2100,B.bottom),
    dangerous: true,
  },
  {
    id: "west",
    name: "西部旧农庄与林缘",
    polygon: rectangle(B.left,220,80,1820),
    dangerous: true,
  },
  {
    id: "forest",
    name: "翡翠森林",
    polygon: rectangle(2100,220,B.right,B.bottom),
    dangerous: true,
  },
  {
    id: "ruins",
    name: "风之遗迹",
    polygon: rectangle(2450,B.top,B.right,220),
    dangerous: true,
  },
] as const;
export function inPolygon(point: Point, polygon: readonly Point[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j],
      b = polygon[i];
    const cross = (point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x);
    if (
      Math.abs(cross) < 1e-8 &&
      point.x >= Math.min(a.x, b.x) &&
      point.x <= Math.max(a.x, b.x) &&
      point.y >= Math.min(a.y, b.y) &&
      point.y <= Math.max(a.y, b.y)
    )
      return true;
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
  }
  return inside;
}
export function regionAt(point: Point) {
  return MAP_REGIONS.find((r) => inPolygon(point, r.polygon)) ?? MAP_REGIONS[1];
}
export function portalAnchor(
  portal: (typeof VILLAGE_PORTALS)[number],
  outside: boolean,
): Point {
  const sign = portal.id === "north-gate" || portal.id === "west-gate" ? -1 : 1;
  const offset =
    sign * (outside ? (portal.id === "north-gate" ? 100 : 160) : -160);
  return {
    x: portal.x + (portal.axis === "x" ? offset : 0),
    y: portal.y + (portal.axis === "y" ? offset : 0),
  };
}
export type WallRun = { id: string; a: Point; b: Point };
export const VILLAGE_WALLS: WallRun[] = [];
const { left, right, top, bottom } = VILLAGE_BOUNDS;
for (const [id, a, b, portal] of [
  ["north-wall", { x: left, y: top }, { x: right, y: top }, VILLAGE_PORTALS[1]],
  [
    "south-wall",
    { x: left, y: bottom },
    { x: right, y: bottom },
    VILLAGE_PORTALS[2],
  ],
  [
    "east-wall",
    { x: right, y: top },
    { x: right, y: bottom },
    VILLAGE_PORTALS[0],
  ],
  [
    "west-wall",
    { x: left, y: top },
    { x: left, y: bottom },
    VILLAGE_PORTALS[3],
  ],
] as const) {
  {
    const horizontal = a.y === b.y;
    VILLAGE_WALLS.push(
      {
        id: `${id}-a`,
        a,
        b: {
          x: horizontal ? portal.x - GATE_WALL_CUT : a.x,
          y: horizontal ? a.y : portal.y - GATE_WALL_CUT,
        },
      },
      {
        id: `${id}-b`,
        a: {
          x: horizontal ? portal.x + GATE_WALL_CUT : a.x,
          y: horizontal ? a.y : portal.y + GATE_WALL_CUT,
        },
        b,
      },
    );
  }
}
// 未来地块只是可进入的空院／苗圃，不提供未实现的服务按钮。
export const RESERVED_PARCELS = [
  {
    id: "parcel-residents",
    name: "西巷菜园",
    x: 200,
    y: 1660,
    w: 550,
    h: 140,
  },
  {
    id: "parcel-workshop",
    name: "工坊苗圃",
    x: 1100,
    y: 1640,
    w: 250,
    h: 150,
  },
  {
    id: "parcel-guild",
    name: "临水菜地",
    x: 1400,
    y: 1650,
    w: 250,
    h: 140,
  },
  {
    id: "parcel-activities",
    name: "旅馆后院",
    x: 1810,
    y: 1650,
    w: 190,
    h: 140,
  },
] as const;
// 建筑净空、门口、塔位与实际驻防共用数据，不保留固定三门分支。
export const DEFENSE_LAYOUT = VILLAGE_PORTALS.map(portal=>({
  portalId:portal.id,towerId:`${portal.id}-tower`,
  tower:TOWERS.find(t=>t.gateId===portal.id)!,
  posts:GUARD_DEFS.filter(g=>g.id.startsWith(portal.id.split('-')[0]+'-')&&g.role==='melee').map(g=>g.post),
  route:[RAID_GATES.find(g=>g.id===portal.id)!.entry,{x:portal.x,y:portal.y},RAID_GATES.find(g=>g.id===portal.id)!.inside],
}));
export function villageClearance(x: number, y: number, radius: number) {
  const point = { x, y };
  if (
    VILLAGE_PORTALS.some(
      (p) =>
        Math.abs(x - p.x) < (p.axis === "x" ? 180 : 145) + radius &&
        Math.abs(y - p.y) < (p.axis === "y" ? 180 : 145) + radius,
    )
  )
    return false;
  if (
    DEFENSE_LAYOUT.some((d) =>
      [...d.posts, d.tower].some(
        (p) => Math.hypot(x - p.x, y - p.y) < 65 + radius,
      ),
    )
  )
    return false;
  if (
    RESERVED_PARCELS.some(
      (p) =>
        x > p.x - radius &&
        x < p.x + p.w + radius &&
        y > p.y - radius &&
        y < p.y + p.h + radius,
    )
  )
    return false;
  return !VILLAGE_WALLS.some(({ a, b }) => {
    const dx = b.x - a.x,
      dy = b.y - a.y,
      t = Math.max(
        0,
        Math.min(
          1,
          ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy),
        ),
      );
    return Math.hypot(x - a.x - t * dx, y - a.y - t * dy) < 35 + radius;
  });
}
