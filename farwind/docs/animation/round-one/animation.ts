import type { Facing, MotionAction } from "../game/systems/locomotion";
export type Clip = {
  texture: string;
  frames: number[];
  flip: boolean;
  name: string;
  provisional?: boolean;
};
export function clipFor(cat: boolean, d: Facing, action: MotionAction): Clip {
  if (!cat && action === "attack")
    return {
      texture: "hero",
      frames: [d * 6 + 5],
      flip: false,
      name: `hero/attack/${d}`,
    };
  if (cat || d >= 2)
    return {
      texture: cat ? "cat-motion" : "hero-motion",
      frames: action === "idle" ? [0] : [1, 2, 3, 4, 5, 6, 7, 8],
      flip: d === 2,
      name: `${cat ? "cat" : "hero"}/${action}/${d}`,
      provisional: action !== "idle" || (cat && d < 2),
    };
  return {
    texture: "hero",
    frames:
      action === "idle"
        ? [d * 6]
        : [d * 6 + 1, d * 6 + 2, d * 6 + 3, d * 6 + 4],
    flip: false,
    name: `hero/${action}/${d}`,
    provisional: action !== "idle",
  };
}
