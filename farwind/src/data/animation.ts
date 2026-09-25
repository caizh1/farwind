import type { Facing, MotionAction } from "../game/systems/locomotion";
import { STRIKES } from "../game/systems/combat";
export const COMBAT_ACTION_ART = {
  frameSize: 160,
  displaySize: 145,
  footY: 154,
} as const;
export type CombatVisual = {
  texture: string;
  frame: number;
  clip: string;
  frameIndex: number;
  facing: Facing;
  phase: "windup" | "active" | "recovery";
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
