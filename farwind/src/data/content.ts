export const items = {
  wood: { name: "木材", description: "干燥的风杉木，可修复路标。" },
  stone: { name: "石材", description: "带有淡青纹理的溪石。" },
  herb: { name: "药草", description: "两株药草与一份浆果可调制药剂。" },
  berry: { name: "浆果", description: "食用恢复 12 点生命。" },
  potion: { name: "恢复药剂", description: "恢复 50 点生命。" },
  crystal: { name: "风之结晶", description: "叶灵留下的风，修复路标所需。" },
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
