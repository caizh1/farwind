import type { ItemId } from "./content";
export const STARTER_COINS = 120;
export const MAX_COINS = 1_000_000;
export const equipment = {
  ironSword: { slot: "weapon", bonus: 4 },
  leatherCoat: { slot: "armor", bonus: 3 },
  windScope: { slot: "head", bonus: 0 },
} as const;
export type EquipmentId = keyof typeof equipment;
export type EquipmentSlot = "weapon" | "armor" | "head";
// 归风珠是永久绑定的系统装备，所有有效存档都拥有，不进入行囊或交易表。
export const RETURN_WIND_ORB = {
  id: "returnWindOrb",
  name: "归风珠",
  icon: "/assets/equipment/return-wind-orb.webp",
  description: "阵亡后自动在风铃村广场重生。",
  recovery: "恢复全部生命与体力，保留行囊与旅途进度。",
  rules: "不消耗 · 不占行囊格",
  quote: "风会记得回家的路。",
  message: "归风珠将你带回风铃村。行囊与旅途进度都还在。",
  respawn: { x: 670, y: 720 },
} as const;
export type ShopId = "general" | "healer" | "smith" | "inn" | "carpenter";
export const shops = {
  general: {
    name: "风铃杂货铺",
    greeting: "普通材料可以换钱。风之结晶与纪念护符不收购。",
    goods: { wood: 3, stone: 3, herb: 5, berry: 4, potion: 18, bread: 7 },
  },
  healer: {
    name: "药师 · 小满",
    greeting: "带药草两株、浆果一份，确认后我再替你调药。也可在行囊自行制作。",
    goods: { potion: 18, tea: 10 },
  },
  smith: {
    name: "溪石铁匠铺",
    greeting:
      "铁剑每次实际命中增加4点伤害，皮甲每次实际受击减少3点伤害。瞄准镜穿戴后按 I 自动瞄准剑风；装备可在行囊穿戴。",
    goods: { ironSword: 60, leatherCoat: 45, windScope: 80 },
  },
  inn: {
    name: "归风旅馆",
    greeting: "休息补给不推进时间；夜间可另购住宿，睡到清晨06:00。",
    goods: { bread: 7, tea: 10, soup: 14 },
  },
  carpenter: { name: "阿禾的木工坊", greeting: "备些木材和溪石，路标与捷径的维修会用得到。", goods: { wood: 3, stone: 3 } },
} as const;
export const salePrices: Partial<Record<ItemId, number>> = {
  wood: 2,
  stone: 2,
  herb: 3,
  berry: 1,
};
export const initialStock = (): Record<string, number> => ({
  "general:wood": 20,
  "general:stone": 20,
  "general:herb": 20,
  "general:berry": 24,
  "general:potion": 8,
  "healer:potion": 16,
  "smith:ironSword": 8,
  "smith:leatherCoat": 8,
  "smith:windScope": 1,
  "general:bread": 12,
  "healer:tea": 12,
  "inn:bread": 12,
  "inn:tea": 12,
  "inn:soup": 8,
  "carpenter:wood": 24,
  "carpenter:stone": 16,
});
export const isEquipment = (id: string): id is EquipmentId =>
  Object.hasOwn(equipment, id);
export const stackLimit = (id: ItemId) => (isEquipment(id) ? 1 : 20);
