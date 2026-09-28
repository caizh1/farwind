import type { ItemId } from "../../content";
// 修复后只改变对应实体阻挡，玩家仍需步行通过；材料在正式交互中一次性扣除。
export const SHORTCUTS = [
  {id:"south-weir",name:"南部堤桥",x:2080,y:2900,approach:{x:2080,y:2970},cost:{wood:3,stone:2},detail:"修好水闸旁的桥面，便能穿过深水洼地直接回到北岸，省去东侧湿地绕行。",barrier:{x:1535,y:2685,w:110,h:110}},
  {id:"north-pass",name:"北哨山道",x:1130,y:-230,approach:{x:1130,y:-170},cost:{wood:2,stone:2},detail:"清理塌落的山口护栏，接通旧哨站至村北环线的下山小道。",barrier:{x:1030,y:-55,w:130,h:90}},
  {id:"east-corridor",name:"遗迹回廊",x:2720,y:480,approach:{x:2720,y:550},cost:{wood:3,stone:1},detail:"修补溪谷吊桥，将遗迹南侧哨道接回东门外的环线，回村无需绕到主溪口。",barrier:{x:2460,y:610,w:40,h:110}},
] as const satisfies readonly {id:string;name:string;x:number;y:number;approach:{x:number;y:number};cost:Partial<Record<ItemId,number>>;detail:string;barrier:{x:number;y:number;w:number;h:number}}[];
export type ShortcutId = (typeof SHORTCUTS)[number]["id"];
export const SHORTCUT_IDS = SHORTCUTS.map(s=>s.id);
