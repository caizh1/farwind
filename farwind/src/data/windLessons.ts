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
    hint: "在南侧木桥边读教本，面向北方，按 I／鼠标中键独立送风，触动水面风铃。",
    next: "西门外旧农庄的两枚铜铃，被藤蔓缠住了铃绳。",
  },
  {
    id: LESSON_IDS[1],
    stage: 2,
    name: "两铃相继",
    source: "西部旧农庄的串联风铃",
    x: -600,
    y: 1780,
    stand: { x: -600, y: 1720 },
    hint: "西门外旧农庄，藤蔓缠住了第一枚铃。解开铃绳，看同一阵风先后吹响两枚铜铃。",
    next: "北门外山口的听风径，落枝挡住了远铃的风。",
  },
  {
    id: LESSON_IDS[2],
    stage: 3,
    name: "长风不息",
    source: "北部山口的听风径",
    x: 550,
    y: -335,
    stand: { x: 550, y: -400 },
    hint: "北门外山口，落枝挡住了铃间的小径。清走落枝，看风一路吹响三枚铜铃。",
    next: "南门外田野的双铃架，相隔很远，等待一股展开的风。",
  },
  {
    id: LESSON_IDS[3],
    stage: 4,
    name: "展风于野",
    source: "南部田野的双铃架",
    x: 1900,
    y: 2465,
    stand: { x: 1900, y: 2400 },
    hint: "南门外田野，两枚铜铃分挂在左右。站上浅色铺垫，面向北方，按 I，让独立施放的宽幅剑风同时吹响它们。",
    next: "远端风之遗迹的分流庭，两面歪倒的风帆挡住了左右铜铃。",
  },
  {
    id: LESSON_IDS[4],
    stage: 5,
    name: "一风三向",
    source: "远端遗迹的三向分流庭",
    x: 3870,
    y: -355,
    // 独立剑风不再借前三刀前移；宽剑风起点须离开教本实体膨胀边界。
    stand: { x: 3910, y: -430 },
    hint: "远端遗迹，中央铜铃正随风摆动。扶正左右两面风帆，让风也吹到两侧的铃；三铃齐响时记录这段传承。",
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
export const BUILD_LESSONS=['melee','finisher','wind-advance','resume-advance'] as const;
export type BuildLesson=(typeof BUILD_LESSONS)[number];
export type SkillState = {
  meleeFinisher:boolean;
  buildLessons:BuildLesson[];
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
  meleeFinisher:false,buildLessons:[],
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
  w: 72,
  h: 64,
  art: "training-book",
  kind: "sign",
  label: `传承 · ${l.name}`,
}));
lessonProps.push({
  id: "lesson-through-barrier",
  x: WIND_LESSONS[2].stand.x+330,
  y: WIND_LESSONS[2].stand.y+40,
  w: 32,
  h: 132,
  art: "rock",
  solid: [24, 120],
  label: "长风道尽头石障",
});
for(const [side,dx] of [['left',-70],['right',70]] as const)lessonProps.push({
  id:`lesson-sail-${side}`,x:WIND_LESSONS[4].stand.x+dx,y:WIND_LESSONS[4].stand.y,
  w:22,h:72,art:'wind-chime-ribbon',ground:false,kind:'sign',label:`扶正${side==='left'?'左':'右'}侧风帆`,
});
