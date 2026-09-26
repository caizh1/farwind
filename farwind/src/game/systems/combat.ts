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
  ready: 200,
  settle: 160,
  trailLife: 110,
  hitStop: [36, 36, 58],
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
  comboId?: number;
  stage: number;
  facing: Facing;
  start: number;
  hit: Set<string>;
  sounded?: boolean;
  enter?: boolean;
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
  clear: (
    a: { x: number; y: number },
    b: { x: number; y: number },
  ) => boolean = () => true,
) {
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 6));
  for (let i = 0; i < n; i++) {
    const horizontal = { x: p.x + dx / n, y: p.y };
    if (!blocked(horizontal.x, horizontal.y) && clear(p, horizontal))
      p.x = horizontal.x;
    const vertical = { x: p.x, y: p.y + dy / n };
    if (!blocked(vertical.x, vertical.y) && clear(p, vertical))
      p.y = vertical.y;
  }
}
export function inStrike(
  p: { x: number; y: number },
  e: Target,
  a: Attack,
  clearLine: (
    x: number,
    y: number,
    tx: number,
    ty: number,
    targetId: string,
  ) => boolean,
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
    clearLine(p.x, p.y, e.x, e.y, e.id)
  );
}
export function enemyTint(now: number, flashUntil: number, windup: number) {
  return now < flashUntil ? 0xff8585 : windup > 0 ? 0xffce84 : null;
}
export class CombatController {
  attack: Attack | null = null;
  serial = 0;
  comboSerial = 0;
  bufferUntil = 0;
  requestedAt = 0;
  reservationOwner: number | null = null;
  hitStopRemaining = 0;
  readyUntil = 0;
  settleUntil = 0;
  carryUntil = 0;
  epoch = 0;
  lastStage = 1;
  lastFacing: Facing = 0;
  pending = false;
  nextStage = 1;
  chainUntil = 0;
  dashStart = -1;
  dashArmed = false;
  dashUntil = 0;
  dashCooldown = 0;
  dashX = 0;
  dashY = 0;
  reset(cooldown = 0) {
    this.attack = null;
    this.pending = false;
    this.bufferUntil = 0;
    this.requestedAt = 0;
    this.reservationOwner = null;
    this.hitStopRemaining = 0;
    this.readyUntil = 0;
    this.settleUntil = 0;
    this.carryUntil = 0;
    this.epoch++;
    this.nextStage = 1;
    this.chainUntil = 0;
    this.dashStart = -1;
    this.dashArmed = false;
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
    this.requestedAt = now;
    const a = this.attack;
    this.reservationOwner = a?.id ?? null;
    this.bufferUntil =
      a && a.stage < 3
        ? Math.max(now, a.start + this.total(a.stage) - COMBAT.chainWindow) +
          COMBAT.buffer
        : now + COMBAT.buffer;
  }
  // 表现停顿冻结整个世界模拟；使用未冻结的帧delta扣减，不累计多目标时长。
  stopOnHit(stage: number) {
    this.hitStopRemaining = Math.max(
      this.hitStopRemaining,
      COMBAT.hitStop[stage - 1],
    );
  }
  advanceFrame(delta: number) {
    const spent = Math.min(Math.max(0, delta), this.hitStopRemaining);
    this.hitStopRemaining -= spent;
    return Math.max(0, delta - spent);
  }
  requestDash(
    now: number,
    stamina: number,
    axis: { x: number; y: number },
    facing: Facing,
  ) {
    const a = this.attack;
    facing = this.effectiveFacing(now, facing);
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
    this.dashArmed = !!a || now < this.settleUntil || now < this.carryUntil;
    this.attack = null;
    this.pending = false;
    this.nextStage = 1;
    this.chainUntil = 0;
    this.readyUntil = 0;
    this.settleUntil = 0;
    this.carryUntil = 0;
    this.epoch++;
    const len = Math.hypot(axis.x, axis.y),
      [fx, fy] = facingVector(facing);
    this.dashX = len ? axis.x / len : fx;
    this.dashY = len ? axis.y / len : fy;
    this.dashStart = now;
    this.dashUntil = now + COMBAT.dash.duration;
    this.dashCooldown = now + COMBAT.dash.cooldown;
    if (this.dashArmed) {
      this.lastFacing =
        Math.abs(this.dashX) > Math.abs(this.dashY)
          ? this.dashX < 0
            ? 2
            : 3
          : this.dashY < 0
            ? 1
            : 0;
      this.lastStage = 1;
      this.readyUntil = this.dashUntil + COMBAT.ready;
      this.settleUntil = this.readyUntil + COMBAT.settle;
    }
    return true;
  }
  effectiveFacing(now: number, fallback: Facing): Facing {
    return (
      this.attack?.facing ??
      (now < this.settleUntil ? this.lastFacing : fallback)
    );
  }
  leaveReady(now = 0) {
    if (this.settleUntil > now) this.carryUntil = now + COMBAT.settle;
    this.readyUntil = 0;
    this.settleUntil = 0;
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
  update<T extends Target>(
    prev: number,
    now: number,
    facing: Facing,
    p: { x: number; y: number },
    targets: T[],
    blocked: (x: number, y: number) => boolean,
    clearLine: (
      x: number,
      y: number,
      tx: number,
      ty: number,
      targetId: string,
    ) => boolean,
    hit: (target: T, stage: number, attack: Attack) => void,
    started: (stage: number, attack: Attack) => void,
    swung: (stage: number) => void = () => {},
    motionClear: (
      a: { x: number; y: number },
      b: { x: number; y: number },
    ) => boolean = () => true,
  ) {
    // 按事件时刻推进：请求到达、可衔接、结束、到期，等于到期仍合法。
    let cursor = prev;
    for (let guard = 0; guard < 8; guard++) {
      const a = this.attack;
      const end = a ? a.start + this.total(a.stage) : Infinity;
      const legal = a ? end - (a.stage < 3 ? COMBAT.chainWindow : 0) : cursor;
      const startAt = this.pending
        ? Math.max(cursor, this.requestedAt, legal)
        : Infinity;
      const consumeAt = startAt <= this.bufferUntil ? startAt : Infinity;
      const stop = Math.min(now, end, consumeAt);
      if (a) {
        const m = STRIKES[a.stage - 1];
        const from = a.start + m.windup,
          until = from + m.active;
        const overlap = Math.max(
          0,
          Math.min(stop, until) - Math.max(cursor, from),
        );
        const [vx, vy] = facingVector(a.facing);
        // 移动前后都检测，避免长步长先越过目标才检测扇形。
        const resolve = () => {
          for (const e of targets)
            if (!a.hit.has(e.id) && inStrike(p, e, a, clearLine)) {
              a.hit.add(e.id);
              hit(e, a.stage, a);
            }
        };
        if (stop >= from && cursor < until) {
          if (!a.sounded) {
            a.sounded = true;
            swung(a.stage);
          }
          resolve();
          const steps = Math.max(1, Math.ceil((m.step * overlap) / m.active));
          for (let i = 0; i < steps; i++) {
            sweepMove(
              p,
              (vx * m.step * overlap) / m.active / steps,
              (vy * m.step * overlap) / m.active / steps,
              blocked,
              motionClear,
            );
            resolve();
          }
        }
        if (stop >= end) {
          this.attack = null;
          this.nextStage = a.stage < 3 ? a.stage + 1 : 1;
          this.chainUntil = a.stage < 3 ? end + COMBAT.grace : 0;
          this.lastStage = a.stage;
          this.lastFacing = a.facing;
          this.readyUntil = end + COMBAT.ready;
          this.settleUntil = this.readyUntil + COMBAT.settle;
        }
      }
      if (consumeAt <= now && consumeAt <= end) {
        const stage = a
          ? a.stage < 3
            ? a.stage + 1
            : 1
          : consumeAt <= this.chainUntil
            ? this.nextStage
            : 1;
        this.pending = false;
        this.attack = {
          id: ++this.serial,
          comboId: stage === 1 ? ++this.comboSerial : this.comboSerial,
          stage,
          facing,
          start: consumeAt,
          enter: !a && consumeAt >= this.settleUntil,
          hit: new Set(),
        };
        this.lastFacing = facing;
        this.lastStage = stage;
        this.readyUntil = 0;
        this.settleUntil = 0;
        this.carryUntil = 0;
        this.nextStage = 1;
        this.chainUntil = 0;
        started(stage, this.attack);
      }
      cursor = stop;
      if (stop >= now) break;
    }
    if (this.pending && now > this.bufferUntil) this.pending = false;
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
          motionClear,
        );
    }
    if (this.dashUntil <= now) this.dashStart = -1;
  }
  diagnostic(now: number) {
    const m = this.attack ? STRIKES[this.attack.stage - 1] : null;
    return {
      phase: this.phase(now),
      effectiveFacing: this.effectiveFacing(now, this.lastFacing),
      ready: !this.attack && now >= this.dashUntil && now < this.readyUntil,
      reservationOwner: this.pending ? this.reservationOwner : null,
      hitStopRemaining: this.hitStopRemaining,
      bufferArrivedAt: this.pending ? this.requestedAt : null,
      bufferExpiresAt: this.pending ? this.bufferUntil : null,
      stage: this.attack?.stage ?? 0,
      attackInstanceId: this.attack?.id ?? null,
      comboId: this.attack?.comboId ?? null,
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
