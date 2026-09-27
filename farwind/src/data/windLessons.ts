import type { Prop } from "./world";
import type { SwordWindStage } from "./swordWind";

export const LESSON_IDS = [
  "windLessonResolved",
  "serialWindCircuitRestored",
  "longWindRouteRestored",
  "wideWindOutletRestored",
  "threeWayWindSplitResolved",
] as const;
export type LessonId = (typeof LESSON_IDS)[number];
export const WIND_LESSONS = [
  {
    id: LESSON_IDS[0],
    stage: 1,
    name: "临水送风",
    source: "临水草坡的守风教本",
    x: 1380,
    y: 1500,
    stand: { x: 1310, y: 1400 },
    hint: "在南侧木桥边读教本，面向北方，以三连斩后的第四击触动水面风铃。",
    next: "森林溪边的两枚旧风铃，仍在等待同一股风。",
  },
  {
    id: LESSON_IDS[1],
    stage: 2,
    name: "两铃相继",
    source: "森林串联风铃",
    x: 2460,
    y: 900,
    stand: { x: 2460, y: 920 },
    hint: "观察两铃之间的风痕，调整旁路，让自然风先后经过两枚风铃。",
    next: "沿森林北侧的细长风痕，寻找中途泄散的风。",
  },
  {
    id: LESSON_IDS[2],
    stage: 3,
    name: "长风不息",
    source: "森林长风道",
    x: 2920,
    y: 830,
    stand: { x: 2890, y: 830 },
    hint: "顺着连续风痕寻找裂开的导风口，封闭泄口，让气流一直流到尽头。",
    next: "遗迹南侧的扩流风口，可以把细风展开。",
  },
  {
    id: LESSON_IDS[3],
    stage: 4,
    name: "展风于野",
    source: "遗迹扩流装置",
    x: 3610,
    y: 1175,
    stand: { x: 3610, y: 1110 },
    hint: "在铺垫处面向北方，试用宽幅剑风，一次触动远处左右两枚风铃；右侧另有窄通道对照。",
    next: "遗迹东侧的分流庭，记着一风三向的传承。",
  },
  {
    id: LESSON_IDS[4],
    stage: 5,
    name: "一风三向",
    source: "遗迹三向分流庭",
    x: 3910,
    y: 1095,
    stand: { x: 3910, y: 1050 },
    hint: "中央风道已经连通；分别把左右分流闸导向左前与右前，让三枚风铃同时回应。",
    next: "已经掌握三向疾风斩。继续在真实旅途中尝试新的解法。",
  },
] as const;
export const lessonById = (id: LessonId) =>
  WIND_LESSONS[LESSON_IDS.indexOf(id)];
export const WIND_NAMES = [
  "未学习",
  "一线斩",
  "一线斩·双穿",
  "一线斩·贯通",
  "疾风斩",
  "三向疾风斩",
] as const;
export const WIND_EFFECTS = [
  "尚未正式掌握剑风",
  "最多命中一个敌人；可触动风敏机关",
  "按路径先后命中最多两个不同敌人",
  "贯通有限路径内的有效敌人，仍被实体障碍阻挡",
  "贯通风刃更宽、更远：宽64，距离420",
  "一次释放三道疾风，左右各偏30°，同一敌人只受击一次",
] as const;
export type SkillState = {
  swordWindStage: SwordWindStage;
  completedLessons: LessonId[];
  discoveredLessons: LessonId[];
  legacySwordWind: boolean;
  devices: {
    serialValve: 0 | 1 | 2;
    leakClosed: boolean;
    splitLeft: 0 | 1 | 2;
    splitRight: 0 | 1 | 2;
  };
};
export const initialSkills = (): SkillState => ({
  swordWindStage: 0,
  completedLessons: [],
  discoveredLessons: [],
  legacySwordWind: false,
  devices: { serialValve: 0, leakClosed: false, splitLeft: 0, splitRight: 0 },
});
export function earnedWindStage(s: SkillState): SwordWindStage {
  let stage = s.legacySwordWind ? 1 : 0;
  while (stage < 5 && s.completedLessons.includes(LESSON_IDS[stage])) stage++;
  return stage as SwordWindStage;
}

export const lessonProps: Prop[] = WIND_LESSONS.map((l) => ({
  id: `lesson-${l.id}`,
  x: l.x,
  y: l.y,
  w: 62,
  h: 86,
  art: "sign",
  kind: "sign",
  label: `传承 · ${l.name}`,
}));
lessonProps.push({
  id: "lesson-through-barrier",
  x: 3220,
  y: 1220,
  w: 32,
  h: 132,
  art: "rock",
  solid: [24, 120],
  label: "长风道尽头石障",
});

for (const [side, x] of [
  ["left", 3675],
  ["right", 3725],
] as const)
  lessonProps.push({
    id: `lesson-wide-channel-${side}`,
    x,
    y: 1070,
    w: 22,
    h: 68,
    art: "rock",
    solid: [12, 40],
    label: "扩流窄道石柱",
  });
