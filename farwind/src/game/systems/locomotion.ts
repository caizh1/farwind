export type Facing = 0 | 1 | 2 | 3;
export type MotionAction = "idle" | "walk" | "run" | "attack";
export type MotionSample = {
  dx: number;
  dy: number;
  dt: number;
  intentX?: number;
  intentY?: number;
  attack?: boolean;
};
// 只累计自主位移。帧率、世界时钟、传送和受击闪烁均不驱动步态。
export class Locomotion {
  direction: Facing = 0;
  action: MotionAction = "idle";
  phase = 0;
  speed = 0;
  distance = 0;
  changes = 0;
  constructor(public cat = false) {
    if (cat) this.direction = 3;
  }
  reset() {
    this.action = "idle";
    this.phase = 0;
    this.speed = 0;
    this.distance = 0;
  }
  update(s: MotionSample) {
    if (!(s.dt > 0)) return;
    const distance = Math.hypot(s.dx, s.dy);
    this.speed = distance / s.dt;
    const moving =
      this.speed > (this.action === "walk" || this.action === "run" ? 1.5 : 4);
    // 碰撞扫掠的数值残差不作为动画速度；实际脚底位移仍由碰撞系统决定。
    if (!moving) this.speed = 0;
    const x = moving ? s.dx : (s.intentX ?? 0),
      y = moving ? s.dy : (s.intentY ?? 0),
      ax = Math.abs(x),
      ay = Math.abs(y);
    if (ax + ay > 1e-7) {
      if (ax > ay * 1.2) this.direction = x < 0 ? 2 : 3;
      else if (ay > ax * 1.2) this.direction = y < 0 ? 1 : 0;
      else if (this.direction >= 2 && ax > 0) this.direction = x < 0 ? 2 : 3;
      else if (ay > 0) this.direction = y < 0 ? 1 : 0;
    }
    const running =
      this.speed >
      (this.action === "run" ? (this.cat ? 155 : 175) : this.cat ? 180 : 190);
    const action: MotionAction = s.attack
      ? "attack"
      : moving
        ? running
          ? "run"
          : "walk"
        : "idle";
    if (action !== this.action) {
      this.changes++;
      if (action === "idle") this.phase = 0;
      this.action = action;
    }
    if (action === "walk" || action === "run") {
      // 新竖向跑步短于侧向步幅：避免同速度下小步素材缓慢滑行。
      const stride =
        running && this.direction < 2
          ? this.cat
            ? 72
            : 110
          : this.cat
            ? running
              ? 108
              : 76
            : running
              ? 142
              : 96;
      this.distance += distance;
      this.phase = (this.phase + distance / stride) % 1;
    }
  }
  get frameIndex() {
    return this.action === "idle" ? 0 : Math.floor(this.phase * 8) % 8;
  }
  get flipX() {
    return this.direction === 2;
  }
}
