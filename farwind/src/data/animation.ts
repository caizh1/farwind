import type { Facing, MotionAction } from "../game/systems/locomotion";
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
  down: { idle: [9], walk: sequence(10), run: sequence(10) },
  up: { idle: [18], walk: sequence(19), run: sequence(19) },
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
    frames: clips[view][action === "attack" ? "idle" : action],
    flip: d === 2,
    name: `${cat ? "cat" : "hero"}/${action}/${d}`,
    provisional: action === "run" && d < 2,
  };
}
