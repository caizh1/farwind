import type { PersonState } from "./npcLifeState";
import { person } from "../../data/npcLife";
import { Locomotion } from "./locomotion";

export const NPC_WALK = {
  ids: ["archer", "elder", "healer", "carpenter"],
  frameSize: 160,
  footY: 148,
  bodyHeight: 128,
  rowFrames: 7,
  walkFrames: 6,
  stride: 64,
} as const;

// 采样整帧的实际位移，不能用时间轴最后一个小片段的 moved 判断是否行走。
// 跨空间、上下塔和纠正站位不累计步幅；暂停保留当前帧。
export class NpcMotion extends Locomotion {
  previous: {
    x: number;
    y: number;
    space: string;
    at: number;
    enabled: boolean;
  } | null = null;
  sample(
    body: { x: number; y: number; space?: string },
    now: number,
    enabled = true,
  ) {
    const previous = this.previous;
    this.previous = {
      x: body.x,
      y: body.y,
      space: body.space ?? "village",
      at: now,
      enabled,
    };
    const dt = previous ? (now - previous.at) / 1000 : 0,
      dx = previous ? body.x - previous.x : 0,
      dy = previous ? body.y - previous.y : 0;
    if (
      !previous ||
      !previous.enabled ||
      previous.space !== this.previous.space ||
      !enabled ||
      dt < 0 ||
      Math.hypot(dx, dy) > 6 + Math.max(0, dt) * 150
    ) {
      this.reset();
      return;
    }
    if (dt > 0) this.update({ dx, dy, dt });
  }
}

export function npcWalkPose(id: string, motion: Locomotion) {
  const row = motion.direction === 1 ? 1 : motion.direction >= 2 ? 2 : 0,
    pose =
      motion.speed > 0
        ? 1 +
          (Math.floor(
            (motion.distance / NPC_WALK.stride) * NPC_WALK.walkFrames,
          ) %
            NPC_WALK.walkFrames)
        : 0;
  return {
    texture: `npc-motion-${id}`,
    frame: row * NPC_WALK.rowFrames + pose,
  };
}

export const LIFE_ART = {
  bed: "life-bed",
  table: "life-table",
  frameSize: 128,
  workFrames: 4,
  frameMs: 300,
} as const;

// 职业帧只跟随正在执行的行动进度；移动、取消、暂停都不会继续独立播放。
export function residentPose(n: PersonState, motion: Locomotion) {
  if (
    n.body?.health === "down" ||
    (n.action?.kind === "sleep" && n.action.phase === "perform")
  )
    return { texture: person(n.id)!.art, frame: 0 };
  const a = n.action,
    work =
      motion.speed === 0 &&
      a?.phase === "perform" &&
      ((n.id === "healer" && a.kind === "work" && a.facility === "pharmacy") ||
        (n.id === "carpenter" && ["work", "repair"].includes(a.kind)) ||
        (n.id === "elder" && a.kind === "work"));
  return work
    ? {
        texture: `${n.id}-work`,
        frame: Math.floor(a.progress / LIFE_ART.frameMs) % LIFE_ART.workFrames,
      }
    : npcWalkPose(n.id, motion);
}
