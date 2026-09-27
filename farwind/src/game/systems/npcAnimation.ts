import type { PersonState } from "./npcLifeState";
import { person } from "../../data/npcLife";

export const LIFE_ART = {
  bed: "life-bed",
  table: "life-table",
  frameSize: 128,
  workFrames: 4,
  frameMs: 300,
} as const;

// 职业帧只跟随正在执行的行动进度；移动、取消、暂停都不会继续独立播放。
export function residentPose(n: PersonState, moved: boolean, now: number) {
  const a = n.action,
    work =
      !moved &&
      a?.phase === "perform" &&
      ((n.id === "healer" && a.kind === "work" && a.facility === "pharmacy") ||
        (n.id === "carpenter" && ["work", "repair"].includes(a.kind)) ||
        (n.id === "elder" && a.kind === "work"));
  return work
    ? {
        texture: `${n.id}-work`,
        frame: Math.floor(a.progress / LIFE_ART.frameMs) % LIFE_ART.workFrames,
      }
    : {
        texture: person(n.id)!.art,
        frame: moved ? Math.floor(now / 350) % 2 : 0,
      };
}
