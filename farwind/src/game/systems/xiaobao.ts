import { XIAOBAO, XIAOBAO_CLIPS, xiaobaoPose, type XiaobaoClip } from "../../data/xiaobao";
import { Locomotion } from "./locomotion";
import type { Point } from "./obstacles";

type Stage = { action: XiaobaoClip | "walk"; duration?: number; to?: Point };
const routine: Stage[] = [
  { action: "idle", duration: 3000 }, { action: "wave", duration: 1200 },
  { action: "walk", to: { x: 870, y: 725 } }, { action: "laugh", duration: 1400 },
  { action: "bow", duration: 1500 }, { action: "walk", to: { x: 870, y: 685 } },
  { action: "meditate", duration: 4200 }, { action: "palm", duration: 1050 },
  { action: "guard", duration: 1200 }, { action: "step", duration: 1050 },
  { action: "walk", to: { x: 810, y: 685 } }, { action: "walk", to: XIAOBAO.home },
];

export class Xiaobao {
  x = XIAOBAO.home.x as number;
  y = XIAOBAO.home.y as number;
  elapsed = 0;
  action: XiaobaoClip = "idle";
  motion = new Locomotion();
  demonstration = false;
  night = false;
  private stages: Stage[] = routine;
  private index = 0;
  private blockedTime = 0;
  private turnLeft = false;

  reset() {
    this.x = XIAOBAO.home.x; this.y = XIAOBAO.home.y;
    this.elapsed = 0; this.index = 0; this.blockedTime = 0;
    this.action = "idle"; this.stages = routine; this.demonstration = this.night = this.turnLeft = false;
    this.motion.reset(); this.motion.direction = 0;
  }
  perform(kind: "palm" | "step" | "all", player: Point) {
    // 对话关闭后从当前地面根开始演示，绝不瞬移回家或改动玩家数值。
    const keys: XiaobaoClip[] = kind === "all"
      ? ["bow", "palm", "guard", "step", "laugh", "wave"]
      : kind === "palm" ? ["bow", "palm", "guard", "laugh"] : ["bow", "step", "wave"];
    this.stages = keys.map((action) => ({ action, duration: XIAOBAO_CLIPS[action].duration }));
    this.demonstration = true; this.index = 0; this.elapsed = 0; this.blockedTime = 0;
    this.action = keys[0]; this.turnLeft = player.x < this.x; this.motion.reset();
  }
  update(dt: number, minute: number, clear: (a: Point, b: Point) => boolean) {
    if (!(dt > 0) || !Number.isFinite(dt)) return;
    const night = minute % 1440 >= 1260 || minute % 1440 < 360;
    if (night !== this.night) {
      this.night = night;
      if (!this.demonstration) { this.elapsed = 0; this.index = 0; }
    }
    if (night && !this.demonstration) {
      this.action = "sleep"; this.elapsed += dt; this.motion.update({ dx: 0, dy: 0, dt: dt / 1000 }); return;
    }
    // 大帧也按行动边界推进，步态只读实际自主位移。
    let remaining = Math.min(dt, 1000);
    while (remaining > 0.001) {
      const stage = this.stages[this.index], moving = stage.action === "walk";
      const distance = moving ? Math.hypot(stage.to!.x - this.x, stage.to!.y - this.y) : 0;
      const duration = moving ? distance / 36 * 1000 : stage.duration! - this.elapsed;
      const slice = Math.min(remaining, Math.max(0, duration));
      let dx = 0, dy = 0;
      if (moving && distance > 0.001) {
        const next = { x: this.x + (stage.to!.x - this.x) * Math.min(1, slice / 1000 * 36 / distance), y: this.y + (stage.to!.y - this.y) * Math.min(1, slice / 1000 * 36 / distance) };
        if (clear(this, next)) { dx = next.x - this.x; dy = next.y - this.y; this.x = next.x; this.y = next.y; this.blockedTime = 0; }
        else this.blockedTime += slice;
      }
      this.elapsed += slice;
      this.motion.update({ dx, dy, dt: slice / 1000 });
      this.action = moving && Math.hypot(dx, dy) > 0
        ? this.motion.direction === 0 ? "walkDown" : this.motion.direction === 1 ? "walkUp" : "walkSide"
        : moving ? "idle" : stage.action as XiaobaoClip;
      remaining -= slice;
      if (moving ? Math.hypot(stage.to!.x - this.x, stage.to!.y - this.y) < 0.01 || this.blockedTime >= 2500 : this.elapsed >= stage.duration!) {
        this.elapsed = 0; this.blockedTime = 0; this.index++;
        if (this.index >= this.stages.length) { this.stages = routine; this.index = 0; this.demonstration = false; }
      } else if (slice === 0) break;
    }
  }
  get flip() { return this.action === "walkSide" || this.action === "carry" ? this.motion.direction === 2 : ["palm", "guard", "step"].includes(this.action) && this.turnLeft; }
  get pose() { return xiaobaoPose(this.action, this.elapsed, this.motion.distance); }
  target() { return { id: XIAOBAO.id, label: `${XIAOBAO.name} · ${XIAOBAO.title}`, art: this.pose.texture, x: this.x, y: this.y, w: XIAOBAO.displaySize, h: XIAOBAO.displaySize, kind: "npc" as const }; }
  snapshot() { return { ...this.target(), action: this.action, actionName: XIAOBAO_CLIPS[this.action].name, elapsed: this.elapsed, distance: this.motion.distance, flip: this.flip, ...this.pose, demonstration: this.demonstration, night: this.night, anchor: [80, XIAOBAO.footY] }; }
}
