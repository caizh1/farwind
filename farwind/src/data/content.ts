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
  brookShoes: { name: "溪行布鞋", description: "鞋子 · 行走与奔跑速度提升8%。亚麻鞋面与麻绳系带，轻便的第一双远行鞋。购买后需穿戴，不额外消耗体力。" },
  deerBoots: { name: "鹿踪皮靴", description: "鞋子 · 行走与奔跑速度提升15%。柔韧鹿皮、交叉绑带与鹿角铜扣，为林间赶路而制。购买后需穿戴，不额外消耗体力。" },
  mistBoots: { name: "踏岚长靴", description: "鞋子 · 行走与奔跑速度提升35%。银白云纹与羽形护片，让漫长旅途轻盈起来。购买后需穿戴，不额外消耗体力。" },
  starShoes: { name: "星渡履", description: "鞋子 · 行走与奔跑速度提升45%。银线星图与月白宝石，将远方缝进脚下。购买后需穿戴，不额外消耗体力。" },
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

// 沿用已有物品素材，皮甲复用装备页的旅行皮衣。
export const itemIcon = (id: ItemId) =>
  id === "brookShoes" ? "/assets/equipment/brook-walk-shoes.webp" :
  id === "deerBoots" ? "/assets/equipment/deer-trail-boots.webp" :
  id === "mistBoots" ? "/assets/equipment/miststride-boots.webp" :
  id === "starShoes" ? "/assets/equipment/starferry-slippers.webp" :
  id === "windBoots" ? "/assets/equipment/lightwind-boots.webp" :
  id === "windScope" ? "/assets/equipment/wind-scope.webp" :
  ["bread", "tea", "soup"].includes(id)
    ? `/assets/village-interiors/${id}.webp`
    : id === "leatherCoat"
    ? "/assets/equipment/traveler-coat.webp"
    : `/assets/icon-${id === "ironSword" ? "sword" : id}.png`;

export const consumables: Partial<Record<ItemId, { hp: number; stamina: number }>> = {
  potion: { hp: 50, stamina: 0 }, berry: { hp: 12, stamina: 0 },
  bread: { hp: 20, stamina: 10 }, tea: { hp: 0, stamina: 35 }, soup: { hp: 20, stamina: 50 },
};
