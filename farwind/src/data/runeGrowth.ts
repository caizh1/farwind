// 四枚符文共用角色成长；分支只改变已装备符文，不增加槽位。
export const RUNE_GROWTH = {
 r31:{source:'练习场教本 · 回流训练',branches:{path:{name:'原路回返',hint:'沿去程原路回到施放地点，便于二次命中。'},anchor:{name:'引风归身',hint:'折返开始时锁定玩家位置，沿直线返回，不持续追踪。'}}},
 r33:{source:'练习场教本 · 借势训练',branches:{calm:{name:'从容接势',hint:'接势窗口延长到1100毫秒。'},chase:{name:'追身接势',hint:'窗口700毫秒，接回时前移最多32像素，障碍截断，无额外无敌。'}}},
 r32:{source:'旧风道的回声 · 恢复导风设施',branches:{focus:{name:'凝痕',hint:'半径34像素，单次90%A；风痕数量、生成与寿命不变。',damage:.9,radius:34},weave:{name:'织风',hint:'连接最近合法风痕：距离180、宽28像素、持续900毫秒、最多3条，每目标一次75%A；孤痕仍触发基础扰流。',damage:.75,distance:180,width:28,duration:900,max:3}}},
 r12:{source:'断路人的剑式 · 突破前哨',branches:{break:{name:'断势',hint:'前向140像素、宽36像素，110%A；撞障60%A，位移免疫补偿50%A。强化合法破防与打断，首领保护照常。',damage:1.1,distance:140,width:36,wall:.6,immune:.5,push:58,stagger:360},ring:{name:'环潮',hint:'周围半径100像素，50%A；撞障25%A，免疫补偿20%A。推开可位移目标，不隔墙、不移动首领。',damage:.5,radius:100,wall:.25,immune:.2,push:42}}},
} as const;
export type GrowthId=keyof typeof RUNE_GROWTH;
export type GrowthBranch='path'|'anchor'|'calm'|'chase'|'focus'|'weave'|'break'|'ring';
export const growthIds=Object.keys(RUNE_GROWTH) as GrowthId[];
export const isGrowthId=(id:string):id is GrowthId=>Object.hasOwn(RUNE_GROWTH,id);
export function branchChoices(id:GrowthId){return Object.entries(RUNE_GROWTH[id].branches) as [GrowthBranch,{name:string;hint:string}][];}
export function branchName(id:GrowthId,branch:string|null){return branchChoices(id).find(([key])=>key===branch)?.[1].name??'基础规则';}
