import { ROOM, type SpaceId } from "./npcLife";
import type { ShopId } from "./economy";
export const INTERIOR_ASSETS = [
  "bookcase",
  "herb-cabinet",
  "tools-rack",
  "food-shelf",
  "stove",
  "weapons-rack",
  "linen-cabinet",
  "crate-stack",
  "travel-cabinet",
  "wall-map",
  "windbell",
  "rug",
  "counter",
  "bread",
  "tea",
  "soup",
] as const;
type Asset = (typeof INTERIOR_ASSETS)[number];
export type InteriorFurniture = {
  id: string;
  space: SpaceId;
  asset: Asset;
  x: number;
  y: number;
  width: number;
  height: number;
  ground?: boolean;
  solid?: boolean;
  label: string;
  description: string;
  shop?: ShopId;
};
export const INTERIOR_SERVICE = { x: 830, y: 800 } as const;
const furniture: InteriorFurniture[] = [];
function put(
  space: SpaceId,
  asset: Asset,
  x: number,
  y: number,
  label: string,
  description: string,
  width = 120,
  height = 145,
  solid = true,
  shop?: ShopId,
) {
  furniture.push({
    id: `${space}:${asset}`,
    space,
    asset,
    x,
    y,
    width,
    height,
    solid,
    label,
    description,
    shop,
  });
}
function rug(space: SpaceId) {
  furniture.push({
    id: `${space}:rug`,
    space,
    asset: "rug",
    x: 690,
    y: 850,
    width: 210,
    height: 100,
    ground: true,
    label: "织毯",
    description: "",
  });
}
put(
  "old-home",
  "bookcase",
  680,
  560,
  "旧书柜",
  "书页记录着风铃村的旧地名。屋子里的物品只供查看。",
);
put(
  "old-home",
  "stove",
  940,
  610,
  "旧宅炉火",
  "炉边摆着柴薪，回来时可以停一停脚。",
  100,
  140,
);
put(
  "old-home",
  "linen-cabinet",
  460,
  800,
  "生活柜",
  "叠好的布料和陶罐仍有生活的痕迹。",
);
rug("old-home");
put(
  "elder-home",
  "bookcase",
  680,
  555,
  "长者的藏书",
  "旧风塔的记录与村史被仔细保存；这些书不能拿走。",
);
put(
  "elder-home",
  "windbell",
  940,
  645,
  "窗边风铃",
  "长者在这里听风辨认来访者的脚步。",
  75,
  120,
  false,
);
rug("elder-home");
put(
  "carpenter-home",
  "tools-rack",
  680,
  555,
  "阿禾的工具架",
  "锯、刨与木槌已经收好，维修材料请到木工坊购买。",
);
put(
  "carpenter-home",
  "crate-stack",
  940,
  650,
  "木料箱",
  "阿禾留给日常修补的木料，不属于旅人的行囊。",
  100,
  90,
);
rug("carpenter-home");
put(
  "south-home",
  "linen-cabinet",
  680,
  560,
  "针线与布料",
  "柜里是针线、折好的衣物和家用陶罐。",
);
put(
  "south-home",
  "stove",
  940,
  630,
  "小屋灶台",
  "灶上的汤锅已经收起，旅馆会出售热蔬汤。",
  100,
  140,
);
rug("south-home");
put(
  "general-shop",
  "food-shelf",
  520,
  610,
  "补给货架",
  "面包、浆果与恢复药剂可在柜台购买。",
  150,
  180,
);
put(
  "general-shop",
  "crate-stack",
  680,
  565,
  "材料陈列",
  "木材、溪石与药草用于沿途制作和维修。",
  115,
  100,
);
put(
  "general-shop",
  "counter",
  830,
  778,
  "杂货铺柜台",
  "购买旅途补给，出售普通材料，也可购买低阶符文。",
  104,
  90,
  false,
  "general",
);
rug("general-shop");
put(
  "wood-workshop",
  "tools-rack",
  530,
  590,
  "木工工具墙",
  "锯、刨与木槌各归其位。阿禾的居所与工作坊分开。",
  150,
  165,
);
put(
  "wood-workshop",
  "crate-stack",
  690,
  575,
  "修路木料",
  "修复路标、村门和捷径需要随身携带的材料。",
  125,
  100,
);
put(
  "wood-workshop",
  "counter",
  830,
  778,
  "木工坊柜台",
  "购买木材和溪石，价格与杂货铺一致。",
  104,
  90,
  false,
  "carpenter",
);
rug("wood-workshop");
put(
  "smith-shop",
  "stove",
  500,
  625,
  "锻造炉",
  "炉火映亮铁器；当前出售的铁剑与皮甲可以在行囊穿戴。",
  135,
  190,
);
put(
  "smith-shop",
  "weapons-rack",
  700,
  590,
  "武器陈列",
  "铁剑命中伤害增加4，皮甲受击伤害减少3。",
  140,
  165,
);
put(
  "smith-shop",
  "counter",
  830,
  778,
  "铁匠铺柜台",
  "购买后在行囊穿戴。这里不会直接替换已装备的物品。",
  104,
  90,
  false,
  "smith",
);
rug("smith-shop");
put(
  "healer-home",
  "herb-cabinet",
  680,
  565,
  "药师药柜",
  "药草、药瓶与研钵分层摆放；公共药品用于居民照护。",
  145,
  175,
);
put(
  "healer-home",
  "food-shelf",
  945,
  640,
  "清叶茶架",
  "清叶茶恢复35点体力，柜台购买后可从行囊使用。",
  100,
  140,
);
put(
  "healer-home",
  "counter",
  830,
  778,
  "药房柜台",
  "购买药剂和清叶茶；药草两株、浆果一份可调制一瓶药。",
  104,
  90,
  false,
  "healer",
);
rug("healer-home");
put(
  "barracks",
  "weapons-rack",
  945,
  650,
  "守卫武器架",
  "值勤与休息的守卫共用器械；营房保留十二个真实床位。",
  100,
  155,
);
put(
  "barracks",
  "wall-map",
  940,
  480,
  "守备地图",
  "东门、北塔与各处集结点都被标在地图上。",
  100,
  65,
  false,
);
put(
  "barracks",
  "crate-stack",
  940,
  825,
  "公共补给箱",
  "营房补给用于守卫勤务，不能从这里拿走物品。",
  100,
  90,
);
put(
  "inn",
  "travel-cabinet",
  950,
  590,
  "旅客行李架",
  "旅人留下的包裹和备用被褥。旅馆保留六个真实床位。",
  100,
  145,
);
put(
  "inn",
  "stove",
  470,
  850,
  "旅馆炉火",
  "炉边暖和，柜台可购买面包、清叶茶和热蔬汤。",
  100,
  145,
);
put(
  "inn",
  "counter",
  830,
  778,
  "旅馆柜台",
  "购买食物、休息补给，或在夜间付费睡到次日清晨。",
  104,
  90,
  false,
  "inn",
);
export const INTERIOR_FURNITURE: readonly InteriorFurniture[] = furniture;
// 显示尺寸与碰撞底座共用同一数据；高柜只有脚底占据通路。
export function interiorBounds(f: InteriorFurniture) {
  return {
    left: f.x - f.width * 0.42,
    right: f.x + f.width * 0.42,
    top: f.y - 45,
    bottom: f.y,
  };
}

// 旧存档恰好站在新增高柜底座时，迁移到原房间安全入口，不改动生命或行动事实。
export function migrateInteriorPosition(
  space: SpaceId,
  p: { x: number; y: number },
) {
  if (
    INTERIOR_FURNITURE.some((f) => {
      const r = interiorBounds(f);
      return (
        f.space === space &&
        f.solid &&
        p.x > r.left &&
        p.x < r.right &&
        p.y > r.top &&
        p.y < r.bottom
      );
    })
  )
    Object.assign(p, ROOM.entry);
}

export const INTERIOR_BEDS = [
  { space: "old-home", x: 460, y: 560 },
  { space: "south-home", x: 460, y: 560 },
] as const;
