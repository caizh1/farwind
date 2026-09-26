import type { Facing, MotionAction } from "../game/systems/locomotion";
import { STRIKES } from "../game/systems/combat";
export const COMBAT_ACTION_ART = {
  frameSize: 160,
  displaySize: 145,
  footY: 154,
} as const;
export type CombatVisual = {
  weapon?: ReturnType<typeof weaponSample>;
  texture: string;
  frame: number;
  clip: string;
  frameIndex: number;
  facing: Facing;
  phase: "windup" | "active" | "recovery" | "ready";
  phaseProgress: number;
  provisional: boolean;
};
export function combatVisual(
  stage: number,
  facing: Facing,
  elapsed: number,
): CombatVisual {
  const move = STRIKES[stage - 1];
  const activeEnd = move.windup + move.active;
  const total = activeEnd + move.recovery;
  const t = Math.max(0, Math.min(elapsed, total));
  const phase =
    t < move.windup ? "windup" : t < activeEnd ? "active" : "recovery";
  const phaseStart =
    phase === "windup" ? 0 : phase === "active" ? move.windup : activeEnd;
  const phaseDuration =
    phase === "windup"
      ? move.windup
      : phase === "active"
        ? move.active
        : move.recovery;
  const phaseProgress = Math.min(1, (t - phaseStart) / phaseDuration);
  const view = facing === 0 ? 0 : facing === 1 ? 1 : 2;
  const boundaries = [
    0,
    move.windup * 0.55,
    move.windup,
    move.windup + move.active * 0.5,
    activeEnd,
    activeEnd + move.recovery * 0.5,
  ];
  let frameIndex = 0;
  for (let i = 1; i < boundaries.length; i++)
    if (t >= boundaries[i]) frameIndex = i;
  return {
    texture: "hero-combat-action",
    frame: view * 18 + (stage - 1) * 6 + frameIndex,
    clip: `hero/combat/${facing}/${stage}`,
    frameIndex,
    facing,
    phase,
    phaseProgress,
    provisional: true,
  };
}
export type Clip = {
  texture: string;
  frames: number[];
  flip: boolean;
  name: string;
  provisional?: boolean;
};
const sequence = (start: number) =>
  Array.from({ length: 8 }, (_, i) => start + i);
const clips = {
  side: { idle: [0], walk: sequence(1), run: sequence(27) },
  down: { idle: [9], walk: sequence(10), run: sequence(35) },
  up: { idle: [18], walk: sequence(19), run: sequence(43) },
};
export function clipFor(cat: boolean, d: Facing, action: MotionAction): Clip {
  if (!cat && action === "attack")
    return {
      texture: "hero",
      frames: [d * 6 + 5],
      flip: false,
      name: `hero/attack/${d}`,
    };
  const view = d === 0 ? "down" : d === 1 ? "up" : "side";
  return {
    texture: cat ? "cat-motion" : "hero-motion",
    frames:
      cat && view === "up" && action === "run"
        ? [43, 44, 45, 46, 47, 48]
        : clips[view][action === "attack" ? "idle" : action],
    flip: d === 2,
    name: `${cat ? "cat" : "hero"}/${action}/${d}`,
    provisional: false,
  };
}

// 当前图集有效期两姿态的手工标注（160×160，原点为画布左上）。
// 正背视图独立标注；左向只在根局部坐标下水平镜像。仍为待美术校准原型。
const activeWeaponPoints = [
  [
    [
      [72, 119, 42, 89],
      [75, 137, 76, 166],
    ],
    [
      [82, 139, 49, 108],
      [83, 88, 115, 40],
    ],
    [
      [74, 68, 47, 26],
      [83, 150, 109, 180],
    ],
  ],
  [
    [
      [67, 106, 35, 74],
      [64, 98, 32, 66],
    ],
    [
      [72, 110, 46, 72],
      [76, 102, 42, 52],
    ],
    [
      [76, 83, 76, 38],
      [66, 104, 36, 62],
    ],
  ],
  [
    [
      [76, 104, 44, 74],
      [100, 122, 139, 117],
    ],
    [
      [91, 128, 130, 96],
      [94, 81, 120, 40],
    ],
    [
      [73, 78, 35, 43],
      [92, 150, 122, 170],
    ],
  ],
] as const;
export function weaponSample(stage: number, facing: Facing, elapsed: number) {
  const sample = combatVisual(stage, facing, elapsed);
  const view = facing === 0 ? 0 : facing === 1 ? 1 : 2;
  const index = sample.frameIndex < 3 ? 0 : 1;
  const [gx, gy, tx, ty] = activeWeaponPoints[view][stage - 1][index];
  const scale = COMBAT_ACTION_ART.displaySize / COMBAT_ACTION_ART.frameSize;
  const point = (x: number, y: number) => ({
    x: (x - 80) * scale * (facing === 2 ? -1 : 1),
    y: (y - COMBAT_ACTION_ART.footY) * scale,
  });
  return {
    grip: point(gx, gy),
    tip: point(tx, ty),
    visible: sample.phase === "active",
    progress: sample.phaseProgress,
    // 每个实际姿态内短暂亮起后衰减，不独立旋转一条悬空圆弧。
    alpha:
      sample.phase === "active"
        ? 0.5 * (1 - ((sample.phaseProgress * 2) % 1))
        : 0,
    provisional: true,
  };
}
