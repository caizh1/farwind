export const items = {
  wood: { name: "木材", description: "干燥的风杉木，可修复路标。" },
  stone: { name: "石材", description: "带有淡青纹理的溪石。" },
  herb: { name: "药草", description: "两株药草与一份浆果可调制药剂。" },
  berry: { name: "浆果", description: "食用恢复 12 点生命。" },
  potion: { name: "恢复药剂", description: "恢复 50 点生命。" },
  bread: { name: "麦香面包", description: "恢复20点生命与10点体力。适合短途补给。" },
  tea: { name: "清叶茶", description: "恢复35点体力。生命已满也可使用。" },
  soup: { name: "热蔬汤", description: "恢复20点生命与50点体力。适合长途前的补给。" },
  crystal: { name: "风之结晶", description: "叶灵留下的风，修复路标所需。" },
  ironSword: {
    name: "风杉铁剑",
    description: "武器 · 每次命中增加4点伤害。需在行囊穿戴才生效。",
  },
  leatherCoat: {
    name: "旅人皮甲",
    description: "护甲 · 每次受击减少3点伤害，至少受到1点。需穿戴才生效。",
  },
  windScope: { name: "寻风瞄准镜", description: "头部 · 学会剑风并穿戴后，按住 I 自动瞄准射程内无遮挡的怪物。中键保留手动瞄准，不增加伤害、射程或速度。" },
  windBoots: { name: "轻风靴", description: "鞋子 · 行走与奔跑速度提升25%。购买后需穿戴才生效，不额外消耗体力。" },
  charm: { name: "旅风护符", description: "黑猫发现的纪念品。" },
} as const;
export type ItemId = keyof typeof items;
export const objectives = [
  "与广场的守风人交谈",
  "沿东侧石路调查森林异响",
  "采集药草与浆果，在背包制作恢复药剂",
  "击退森林的叶灵，取得风之结晶",
  "前往东北遗迹，依照线索唤醒风石",
  "修复遗迹中央的风之路标",
  "经捷径回到风铃村，向守风人报平安",
  "风重新吹向远方 · 主线已完成",
];

// 沿用旧素材；皮甲以物品文字展示，避免错误图标。
export const itemIcon = (id: ItemId) =>
  id === "windBoots" ? "/assets/equipment/wind-boots.webp" :
  id === "windScope" ? "/assets/equipment/wind-scope.webp" :
  ["bread", "tea", "soup"].includes(id)
    ? `/assets/village-interiors/${id}.webp`
    : id === "leatherCoat"
    ? null
    : `/assets/icon-${id === "ironSword" ? "sword" : id}.png`;

export const consumables: Partial<Record<ItemId, { hp: number; stamina: number }>> = {
  potion: { hp: 50, stamina: 0 }, berry: { hp: 12, stamina: 0 },
  bread: { hp: 20, stamina: 10 }, tea: { hp: 0, stamina: 35 }, soup: { hp: 20, stamina: 50 },
};
