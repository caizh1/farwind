import type { ItemId } from "./content";
export const STARTER_COINS = 120;
export const MAX_COINS = 1_000_000;
export const equipment = {
  ironSword: { slot: "weapon", bonus: 4 },
  leatherCoat: { slot: "armor", bonus: 3 },
} as const;
export type EquipmentId = keyof typeof equipment;
export type EquipmentSlot = "weapon" | "armor";
export type ShopId = "general" | "healer" | "smith" | "inn";
export const shops = {
  general: {
    name: "风铃杂货铺",
    greeting: "普通材料可以换钱。风之结晶与纪念护符不收购。",
    goods: { wood: 3, stone: 3, herb: 5, berry: 4, potion: 18 },
  },
  healer: {
    name: "药师 · 小满",
    greeting: "带药草两株、浆果一份，确认后我再替你调药。也可在行囊自行制作。",
    goods: { potion: 18 },
  },
  smith: {
    name: "溪石铁匠铺",
    greeting:
      "铁剑每次实际命中增加4点伤害，皮甲每次实际受击减少3点伤害。装备可在行囊穿戴。",
    goods: { ironSword: 60, leatherCoat: 45 },
  },
  inn: {
    name: "归风旅馆",
    greeting: "休息补给不推进时间；夜间可另购住宿，睡到清晨06:00。",
    goods: {},
  },
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
});
export const isEquipment = (id: string): id is EquipmentId =>
  Object.hasOwn(equipment, id);
export const stackLimit = (id: ItemId) => (isEquipment(id) ? 1 : 20);
