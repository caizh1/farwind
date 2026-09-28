import type { Prop } from "./world";
import {
  buildingLot,
  SERVICE_SIGNS,
  type BuildingId,
} from "./maps/windbell/layout";
// 外观、门前交互和居民入口共用同一份建筑登记。
const shapes: { id: BuildingId; art: string }[] = [
  { id: "general-building", art: "shop" },
  { id: "smith-building", art: "smith-building" },
  { id: "inn-building", art: "inn-building" },
  { id: "barracks-building", art: "house" },
  { id: "resident-cottage-1", art: "house" },
  { id: "resident-cottage-2", art: "house" },
];
export const serviceBuildings: Prop[] = shapes.map((d) => {
  const b = buildingLot(d.id);
  return {
    id: d.id,
    art: d.art,
    x: b.x,
    y: b.y,
    w: b.w,
    h: b.h,
    solid: [...b.solid],
    cover: "high",
  };
});
export const serviceEntrances: Prop[] = SERVICE_SIGNS.map((s) => {
  const b = buildingLot(s.building);
  return {
    id: s.id,
    art: `plaque-${s.id}`,
    ...s.point,
    w: 112,
    h: 36,
    kind: "sign",
    label: s.name,
    ground: false,
    displayAt: { x: b.x, y: b.y - 115 },
    depth: b.y + 1,
  };
});
export { serviceRoads } from "./maps/windbell/roads";
export function serviceClearance(x: number, y: number, radius: number) {
  return ![...serviceBuildings, ...serviceEntrances].some(
    (p) =>
      Math.abs(x - p.x) < (p.solid?.[0] ?? 90) / 2 + radius + 15 &&
      y > p.y - (p.solid?.[1] ?? 40) - radius - 15 &&
      y < p.y + radius + 80,
  );
}
