import type { Facing } from "./locomotion";

export const STRIKES = [
  {
    windup: 75,
    active: 115,
    recovery: 145,
    range: 92,
    angle: 1.12,
    damage: 18,
    step: 13,
    knock: 5,
    flash: 110,
    stagger: 75,
  },
  {
    windup: 90,
    active: 120,
    recovery: 155,
    range: 98,
    angle: 1.05,
    damage: 20,
    step: 16,
    knock: 7,
    flash: 110,
    stagger: 75,
  },
  {
    windup: 145,
    active: 130,
    recovery: 235,
    range: 108,
    angle: 0.95,
    damage: 30,
    step: 21,
    knock: 27,
    flash: 170,
    stagger: 170,
  },
] as const;
export const COMBAT = {
  buffer: 150,
  grace: 200,
  chainWindow: 100,
  restartWindow: 150,
  slashRadiusScale: 0.72,
  dash: {
    distance: 90,
    duration: 200,
    cost: 20,
    cooldown: 650,
    invulnStart: 40,
    invulnEnd: 140,
  },
} as const;
export type Target = { id: string; x: number; y: number; hp: number };
export type Attack = {
  id: number;
  stage: number;
  facing: Facing;
  start: number;
  hit: Set<string>;
};
export const facingVector = (d: Facing): [number, number] =>
  (
    [
      [0, 1],
      [0, -1],
      [-1, 0],
      [1, 0],
    ] as const
  )[d] as [number, number];
export function sweepMove(
  p: { x: number; y: number },
  dx: number,
  dy: number,
  blocked: (x: number, y: number) => boolean,
) {
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 6));
  for (let i = 0; i < n; i++) {
    if (!blocked(p.x + dx / n, p.y)) p.x += dx / n;
    if (!blocked(p.x, p.y + dy / n)) p.y += dy / n;
  }
}
export function inStrike(
  p: { x: number; y: number },
  e: Target,
  a: Attack,
  clearLine: (x: number, y: number, tx: number, ty: number) => boolean,
) {
  const m = STRIKES[a.stage - 1],
    [vx, vy] = facingVector(a.facing);
  const dx = e.x - p.x,
    dy = e.y - p.y,
    d = Math.hypot(dx, dy);
  return (
    e.hp > 0 &&
    d <= m.range &&
    d > 0 &&
    (dx * vx + dy * vy) / d >= Math.cos(m.angle) &&
    clearLine(p.x, p.y, e.x, e.y)
  );
}
export function enemyTint(now: number, flashUntil: number, windup: number) {
  return now < flashUntil ? 0xff8585 : windup > 0 ? 0xffce84 : null;
}
export class CombatController {
  attack: Attack | null = null;
  serial = 0;
  bufferUntil = 0;
  pending = false;
  nextStage = 1;
  chainUntil = 0;
  dashStart = -1;
  dashUntil = 0;
  dashCooldown = 0;
  dashX = 0;
  dashY = 0;
  reset(cooldown = 0) {
    this.attack = null;
    this.pending = false;
    this.bufferUntil = 0;
    this.nextStage = 1;
    this.chainUntil = 0;
    this.dashStart = -1;
    this.dashUntil = 0;
    this.dashCooldown = cooldown;
  }
  requestAttack(now: number) {
    if (this.pending && now > this.bufferUntil) this.pending = false;
    if (this.dashUntil > now || this.pending) return;
    if (
      this.attack?.stage === 3 &&
      now < this.attack.start + this.total(3) - COMBAT.restartWindow
    )
      return;
    this.pending = true;
    this.bufferUntil = now + COMBAT.buffer;
  }
  requestDash(
    now: number,
    stamina: number,
    axis: { x: number; y: number },
    facing: Facing,
  ) {
    const a = this.attack;
    if (
      now < this.dashCooldown ||
      now < this.dashUntil ||
      stamina < COMBAT.dash.cost
    )
      return false;
    if (
      a &&
      (a.stage === 3 ||
        now - a.start < this.total(a.stage) - COMBAT.chainWindow)
    )
      return false;
    this.attack = null;
    this.pending = false;
    this.nextStage = 1;
    this.chainUntil = 0;
    const len = Math.hypot(axis.x, axis.y),
      [fx, fy] = facingVector(facing);
    this.dashX = len ? axis.x / len : fx;
    this.dashY = len ? axis.y / len : fy;
    this.dashStart = now;
    this.dashUntil = now + COMBAT.dash.duration;
    this.dashCooldown = now + COMBAT.dash.cooldown;
    return true;
  }
  total(stage: number) {
    const m = STRIKES[stage - 1];
    return m.windup + m.active + m.recovery;
  }
  phase(now: number) {
    const a = this.attack;
    if (!a) return "idle";
    const t = now - a.start,
      m = STRIKES[a.stage - 1];
    return t < m.windup
      ? "windup"
      : t < m.windup + m.active
        ? "active"
        : "recovery";
  }
  invulnerable(now: number) {
    return (
      this.dashStart >= 0 &&
      now >= this.dashStart + COMBAT.dash.invulnStart &&
      now < this.dashStart + COMBAT.dash.invulnEnd
    );
  }
  update(
    prev: number,
    now: number,
    facing: Facing,
    p: { x: number; y: number },
    targets: Target[],
    blocked: (x: number, y: number) => boolean,
    clearLine: (x: number, y: number, tx: number, ty: number) => boolean,
    hit: (target: Target, stage: number) => void,
    started: (stage: number) => void,
  ) {
    const a = this.attack;
    if (a) {
      const m = STRIKES[a.stage - 1],
        from = a.start + m.windup,
        until = from + m.active;
      if (now >= from && prev < until) {
        for (const e of targets)
          if (!a.hit.has(e.id) && inStrike(p, e, a, clearLine)) {
            a.hit.add(e.id);
            hit(e, a.stage);
          }
      }
      if (now >= a.start + this.total(a.stage)) {
        this.attack = null;
        this.nextStage = a.stage < 3 ? a.stage + 1 : 1;
        this.chainUntil =
          a.stage < 3 ? a.start + this.total(a.stage) + COMBAT.grace : 0;
      }
    }
    if (this.pending && now > this.bufferUntil) this.pending = false;
    const current = this.attack;
    if (
      this.pending &&
      (!current ||
        (current.stage < 3 &&
          now >=
            current.start + this.total(current.stage) - COMBAT.chainWindow))
    ) {
      this.pending = false;
      const stage =
        !current && now > this.chainUntil
          ? 1
          : current
            ? current.stage + 1
            : this.nextStage;
      this.attack = {
        id: ++this.serial,
        stage,
        facing,
        start: now,
        hit: new Set(),
      };
      this.nextStage = 1;
      this.chainUntil = 0;
      started(stage);
    }
    if (this.dashUntil > prev) {
      const fraction =
        (Math.min(now, this.dashUntil) - Math.max(prev, this.dashStart)) /
        COMBAT.dash.duration;
      if (fraction > 0)
        sweepMove(
          p,
          this.dashX * COMBAT.dash.distance * fraction,
          this.dashY * COMBAT.dash.distance * fraction,
          blocked,
        );
    }
    if (this.dashUntil <= now) this.dashStart = -1;
  }
  diagnostic(now: number) {
    const m = this.attack ? STRIKES[this.attack.stage - 1] : null;
    return {
      phase: this.phase(now),
      stage: this.attack?.stage ?? 0,
      attackInstanceId: this.attack?.id ?? null,
      facing: this.attack?.facing ?? null,
      hitRegion: m ? { range: m.range, halfAngle: m.angle } : null,
      hitTargets: [...(this.attack?.hit ?? [])],
      buffered: this.pending,
      bufferRemaining: this.pending ? Math.max(0, this.bufferUntil - now) : 0,
      dashRemaining: Math.max(0, this.dashUntil - now),
      dashCooldownRemaining: Math.max(0, this.dashCooldown - now),
      dashInvulnerable: this.invulnerable(now),
    };
  }
}
