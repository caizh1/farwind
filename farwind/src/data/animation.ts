import type { Facing, MotionAction } from "../game/systems/locomotion";
export const COMBAT_ART = {
  frameSize: 160,
  displaySize: 110,
  footY: 154,
} as const;
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
