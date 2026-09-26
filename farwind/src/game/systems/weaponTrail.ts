import { weaponSample } from "../../data/animation";
import { COMBAT, attackConfig, type Attack } from "./combat";
type Point = { x: number; y: number };
type Sample = {
  id: number;
  at: number;
  inner: Point;
  tip: Point;
  stage: number;
  facing: number;
};
// 只承载表现历史，不参与伤害；不同实例永不连接。数量受110ms寿命及8ms采样间隔约束。
export class WeaponTrail {
  samples: Sample[] = [];
  private epoch = -1;
  private previous = -1;
  private root: Point = { x: 0, y: 0 };
  private id = -1;
  private sampledAt = -1;
  update(now: number, attack: Attack | null, root: Point, epoch: number) {
    if (
      epoch !== this.epoch ||
      now < this.previous ||
      Math.hypot(root.x - this.root.x, root.y - this.root.y) > 120
    ) {
      this.samples = [];
      this.id = -1;
      this.sampledAt = -1;
    }
    this.epoch = epoch;
    this.samples = this.samples.filter((s) => now - s.at < COMBAT.trailLife);
    if (attack) {
      const m = attackConfig(attack),
        from = attack.start + m.windup,
        until = from + m.active;
      const fresh = this.id !== attack.id;
      if (fresh) {
        this.id = attack.id;
        this.sampledAt = from - 16;
      }
      const to = Math.min(now, until);
      if (now >= from) {
        for (
          let at = Math.max(
            from - 8,
            this.sampledAt + 8,
            now - COMBAT.trailLife,
          );
          at <= to;
          at += 8
        ) {
          const w = weaponSample(
            attack.stage,
            attack.facing,
            at - attack.start,
            m,
          );
          const t =
            this.previous >= 0 && now > this.previous && !fresh
              ? Math.max(
                  0,
                  Math.min(1, (at - this.previous) / (now - this.previous)),
                )
              : 1;
          const x = this.root.x + (root.x - this.root.x) * t,
            y = this.root.y + (root.y - this.root.y) * t;
          this.samples.push({
            id: attack.id,
            at,
            stage: attack.stage,
            facing: attack.facing,
            inner: {
              x: x + w.grip.x * 0.7 + w.tip.x * 0.3,
              y: y + w.grip.y * 0.7 + w.tip.y * 0.3,
            },
            tip: { x: x + w.tip.x, y: y + w.tip.y },
          });
          this.sampledAt = at;
        }
      }
    }
    this.previous = now;
    this.root = { ...root };
  }
  segments(now: number) {
    return this.samples.slice(1).flatMap((b, i) => {
      const a = this.samples[i];
      return a.id === b.id
        ? [
            {
              a,
              b,
              alpha:
                Math.max(0, 1 - (now - b.at) / COMBAT.trailLife) *
                (b.stage === 3 ? 0.86 : 0.68),
            },
          ]
        : [];
    });
  }
}
