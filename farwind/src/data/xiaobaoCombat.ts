// 距离为世界像素，时长为有效模拟毫秒；表现与结算共享这一份定义。
export const XIAOBAO_STATS = {
  hp: 640,
  armor: 12,
  qi: 100,
  sense: 600,
  decision: 150,
  flightSpeed: 1600,
  flightRange: 5000,
  flightLift: 88,
  takeoff: 200,
  landing: 250,
} as const;
const skill = (
  name: string,
  range: number,
  cooldown: number,
  qi: number,
  times: number[],
  damage: number[],
  recovery: number,
  frames: number,
  radius = 0,
) => ({ name, range, cooldown, qi, times, damage, recovery, frames, radius });
export const XIAOBAO_SKILLS = {
  palm: skill("听风掌", 96, 900, 0, [140], [72], 540, 8),
  triple: skill(
    "三叠震山",
    112,
    4000,
    12,
    [180, 420, 700],
    [52, 64, 96],
    1020,
    12,
  ),
  star: skill("弹星指", 480, 2500, 8, [220], [96, 72], 520, 8),
  blade: skill("回风刃", 360, 5000, 14, [300], [90, 54], 600, 10),
  rock: skill(
    "星陨落石",
    480,
    9000,
    25,
    [700, 1020, 1340],
    [96, 72, 72],
    1600,
    12,
    110,
  ),
  fire: skill(
    "赤莲火域",
    400,
    12000,
    28,
    [400, 1200, 2000, 2800, 3600, 4400],
    [60, 30, 30, 30, 30, 30],
    700,
    12,
    150,
  ),
  thunder: skill("惊雷一指", 520, 6000, 18, [420], [180], 680, 8),
  chain: skill(
    "连环天雷",
    440,
    10000,
    26,
    [480, 600, 720, 840, 960],
    [144, 120, 100, 84, 72],
    1140,
    12,
  ),
  unity: skill(
    "五行归元",
    420,
    45000,
    60,
    [1200, 1600, 2000, 2400, 2800, 3200, 3400],
    [120, 24, 24, 24, 24, 24, 200],
    3700,
    18,
    200,
  ),
  guard: skill("抱圆卸风", 96, 8000, 18, [100], [0], 700, 10, 96),
  rescue: skill("踏叶救急", 140, 6000, 12, [80], [96], 480, 10, 48),
  flight: skill("踏风飞援", 5000, 30000, 0, [200], [0], 450, 18, 120),
} as const;
export type XiaobaoSkill = keyof typeof XIAOBAO_SKILLS;
export type XiaobaoTask = "free" | "guard" | "follow";
export type XiaobaoTactic = "steady" | "protect" | "full";
export const XIAOBAO_TASK_NAMES = {
  free: "自由活动",
  guard: "守卫村庄",
  follow: "随我出征",
} as const;
export const XIAOBAO_TACTIC_NAMES = {
  steady: "稳健作战",
  protect: "护人优先",
  full: "全力出手",
} as const;
export const XIAOBAO_ROADS = {
  nodes: [
    { x: 810, y: 725 },
    { x: 820, y: 850 },
    { x: 1090, y: 850 },
    { x: 1420, y: 850 },
    { x: 1740, y: 850 },
    { x: 1740, y: 1080 },
    { x: 2150, y: 1100 },
    { x: 820, y: 1080 },
    { x: 820, y: 1470 },
    { x: 950, y: 1850 },
    { x: 820, y: 340 },
    { x: 850, y: 155 },
    // 四处据点的行军路点，每段保持在局部寻路半径内。
    { x: 1050, y: 2040 }, { x: 1000, y: 2450 }, { x: 1250, y: 2820 },
    { x: 560, y: -140 }, { x: 800, y: -200 }, { x: 1030, y: -260 }, { x: 1260, y: -450 }, { x: 1480, y: -730 },
    { x: 560, y: 120 }, { x: 250, y: 120 }, { x: -80, y: 120 }, { x: -140, y: 440 }, { x: -140, y: 850 }, { x: -140, y: 1260 },
    { x: -420, y: 1340 }, { x: -700, y: 1340 }, { x: -1030, y: 1380 }, { x: -1380, y: 1430 }, { x: -1700, y: 1490 },
    { x: 2400, y: 1100 }, { x: 2580, y: 1100 }, { x: 2830, y: 1100 }, { x: 3100, y: 1100 }, { x: 3340, y: 1150 }, { x: 3600, y: 1280 }, { x: 3710, y: 1100 },
  ],
  links: [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
    [1, 7],
    [7, 8],
    [8, 9],
    [0, 10],
    [10, 11],
    [9,12],[12,13],[13,14],
    [11,15],[15,16],[16,17],[17,18],[18,19],
    [11,20],[20,21],[21,22],[22,23],[23,24],[24,25],[25,26],[26,27],[27,28],[28,29],[29,30],
    [6,31],[31,32],[32,33],[33,34],[34,35],[35,36],[36,37],
  ],
  patrol: [
    { x: 810, y: 725 },
    { x: 1090, y: 850 },
    { x: 820, y: 1080 },
    { x: 780, y: 720 },
  ],
};
export const XIAOBAO_BATTLE_CLIPS = [
  ["palm", 8],
  ["triple", 12],
  ["star", 8],
  ["blade", 10],
  ["rock", 12],
  ["fire", 12],
  ["thunder", 8],
  ["chain", 12],
  ["unity", 18],
  ["guard", 10],
  ["rescue", 10],
  ["chase", 8],
  ["takeoff", 6],
  ["cruise", 6],
  ["landing", 6],
  ["hurt", 6],
  ["rest", 8],
  ["recover", 8],
] as const;
export type XiaobaoBattleClip = (typeof XIAOBAO_BATTLE_CLIPS)[number][0];
export function xiaobaoBattlePose(
  action: XiaobaoBattleClip,
  progress: number,
  facing: number,
) {
  const index = XIAOBAO_BATTLE_CLIPS.findIndex((c) => c[0] === action),
    frames = XIAOBAO_BATTLE_CLIPS[index][1];
  const offset = XIAOBAO_BATTLE_CLIPS.slice(0, index).reduce(
    (n, c) => n + c[1],
    0,
  );
  const frameIndex = Math.min(
    frames - 1,
    Math.floor(Math.max(0, Math.min(1, progress)) * frames),
  );
  return {
    texture: `xiaobao-battle-${facing === 1 ? "back" : facing >= 2 ? "side" : "front"}`,
    frame: offset + frameIndex,
    frameIndex,
    lift: 0,
  };
}
