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
export const PARRY = {
  precise: 70,
  active: 180,
  recovery: 260,
  cooldown: 400,
  buffer: 120,
  speed: 60,
  halfAngle: (80 * Math.PI) / 180,
  cost: 12,
  bonus: 6,
  regenPause: 300,
  resume: 60,
  afterguard: 80,
  opportunity: 600,
  normal: { stagger: 420, stop: 55, knock: 6, damage: 24 },
  perfect: { stagger: 600, stop: 75, knock: 8, damage: 30 },
  counter: { windup: 55, step: 18 },
} as const;
export type CounterKind = "normal" | "perfect";
export type StrikeConfig = { [K in keyof typeof STRIKES[0]]: number };
// 一个攻击实例解析一次；动画、剑风、命中和木桩读取同一份配置。
export function resolveStrike(stage: number, counter?: CounterKind): StrikeConfig {
  const base = STRIKES[stage - 1];
  return stage === 1 && counter
    ? { ...base, ...PARRY.counter, damage: PARRY[counter].damage }
    : { ...base };
}
export const attackConfig = (a: Pick<Attack, "stage" | "counter" | "config">) =>
  a.config ?? resolveStrike(a.stage, a.counter);
export const strikeDuration = (m: StrikeConfig) => m.windup + m.active + m.recovery;
export type ParryAction = {
  id: number; start: number; facing: Facing; actionUntil: number;
  successAt?: number; quality?: CounterKind;
};
export type ActionKind = "attack" | "parry" | "dash";
export const actionPriority = { attack: 1, parry: 2, dash: 3 } as const;
export type ActionRequest = { kind: ActionKind; at: number; sequence: number; axis: {x:number;y:number} };
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
  counter?: CounterKind;
  config?: StrikeConfig;
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
  const m = attackConfig(a),
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
  parry: ParryAction | null = null;
  lastParry: ParryAction | null = null;
  parrySerial = 0;
  parryCooldown = 0;
  lastParryRequestAt: number | null = null;
  regenUntil = 0;
  actionLockUntil = 0;
  parryPending: {at:number;until:number;facing:Facing} | null = null;
  dashPending: {at:number;until:number;axis:{x:number;y:number};facing:Facing} | null = null;
  afterguard: {until:number;facing:Facing} | null = null;
  counter: {until:number;kind:CounterKind} | null = null;
  lastRejection = "";
  attack: Attack | null = null;
  serial = 0;
  comboSerial = 0;
  bufferUntil = 0;
  requestedAt = 0;
  reservationOwner: number | null = null;
  hitStopRemaining = 0;
  lastHitStopRequested = 0;
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
  clearInputs() {
    this.pending = false;
    this.bufferUntil = 0;
    this.reservationOwner = null;
    this.parryPending = null;
    this.dashPending = null;
  }
  cancelAttack() {
    this.attack = null;
    this.clearInputs();
    this.nextStage = 1;
    this.chainUntil = 0;
    this.readyUntil = 0;
    this.settleUntil = 0;
    this.carryUntil = 0;
    this.epoch++;
  }
  hurt() {
    this.cancelAttack();
    this.parry = null;
    this.actionLockUntil=0;
    this.counter = null;
    this.afterguard = null;
    this.dashUntil = 0;
    this.dashStart = -1;
    this.dashArmed = false;
    // 受伤不重置风步冷却、恢复暂停或模拟时钟。
  }
  parryLegalAt(now: number) {
    const a = this.attack;
    let legal = Math.max(now, this.dashUntil, this.parryCooldown, this.actionLockUntil);
    if (a) {
      const m = attackConfig(a), elapsed = now-a.start;
      if (a.stage === 3) legal = Math.max(legal,a.start+strikeDuration(m)-120);
      else if (elapsed >= m.windup && elapsed < m.windup+m.active)
        legal = Math.max(legal,a.start+m.windup+m.active);
    }
    return legal;
  }
  requestParry(now: number, facing: Facing) {
    if (this.parryPending && now > this.parryPending.until) this.parryPending = null;
    if (this.parryPending || (this.parry && this.parry.successAt === undefined && now < this.parry.actionUntil)) return false;
    this.lastParryRequestAt=now;
    this.parryPending = {at:now,until:now+PARRY.buffer,facing};
    this.lastRejection = "";
    return true;
  }
  // 同时输入在共同入口只取最高优先级；拒绝不会转为下一种动作。
  requestActions(requests: ActionRequest[], now: number, p: {stamina:number}, fallback: Facing) {
    const top = [...requests].sort((a,b)=>actionPriority[b.kind]-actionPriority[a.kind] || a.sequence-b.sequence)[0];
    if (!top) return;
    const {axis} = top, facing: Facing = Math.hypot(axis.x,axis.y)
      ? Math.abs(axis.x)>Math.abs(axis.y) ? axis.x<0?2:3 : axis.y<0?1:0
      : this.effectiveFacing(now,fallback);
    if (top.kind === "parry") this.requestParry(now,facing);
    else if (top.kind === "attack") this.requestAttack(now);
    else {
      if (this.dashPending && now <= this.dashPending.until) return;
      this.parryPending = null;
      this.pending = false;
      this.dashPending = {at:now,until:now+COMBAT.buffer,axis:{...axis},facing};
    }
  }
  flushActions(now: number, p: {stamina:number}) {
    const started: ActionKind[] = [];
    if (this.counter && now >= this.counter.until) this.counter = null;
    if (this.afterguard && now >= this.afterguard.until) this.afterguard = null;
    if (this.parry && now >= this.parry.actionUntil) this.parry = null;
    const dash = this.dashPending;
    if (dash) {
      if (now > dash.until) this.dashPending = null;
      else if (this.requestDash(now,p.stamina,dash.axis,dash.facing)) {
        p.stamina -= COMBAT.dash.cost;
        this.dashPending = null;
        started.push("dash");
      } else if (!(this.parry && now < this.parry.actionUntil) && this.hitStopRemaining <= 0) {
        this.lastRejection = p.stamina < COMBAT.dash.cost ? "体力不足" : "风步尚不可用";
        this.dashPending = null;
      }
    }
    const request = this.parryPending;
    if (request && !this.dashPending) {
      if (now > request.until) this.parryPending = null;
      else if (now >= this.parryLegalAt(now) && p.stamina >= PARRY.cost) {
        this.cancelAttack();
        this.parry = {id:++this.parrySerial,start:now,facing:request.facing,actionUntil:now+PARRY.recovery};
        this.actionLockUntil=now+PARRY.recovery;
        this.lastParry = this.parry;
        this.parryCooldown = now+PARRY.cooldown;
        this.regenUntil = now+PARRY.regenPause;
        this.afterguard = null;
        this.lastFacing = request.facing;
        p.stamina -= PARRY.cost;
        started.push("parry");
      } else this.lastRejection = p.stamina < PARRY.cost ? "体力不足" : "动作不可取消";
    }
    return started;
  }
  parryQuality(now: number): CounterKind | null {
    const a = this.parry;
    if (!a || a.successAt !== undefined || now < a.start || now >= a.start+PARRY.active) return null;
    return now < a.start+PARRY.precise ? "perfect" : "normal";
  }
  succeedParry(now: number, kind: CounterKind, p: {stamina:number}) {
    const a = this.parry;
    if (!a || a.successAt !== undefined) return false;
    a.successAt = now;
    a.quality = kind;
    a.actionUntil = now+PARRY.resume;
    this.actionLockUntil=a.actionUntil;
    this.parryCooldown = a.actionUntil;
    this.afterguard = {until:now+PARRY.afterguard,facing:a.facing};
    this.counter = {until:now+PARRY.opportunity,kind};
    p.stamina = Math.min(100,p.stamina+PARRY.cost+(kind==="perfect"?PARRY.bonus:0));
    this.hitStopRemaining = Math.max(this.hitStopRemaining,PARRY[kind].stop);
    this.lastHitStopRequested=PARRY[kind].stop;
    this.readyUntil = a.actionUntil+COMBAT.ready;
    this.settleUntil = this.readyUntil+COMBAT.settle;
    this.lastStage = 1;
    this.lastFacing = a.facing;
    return true;
  }
  nextBoundary(now: number) {
    const boundaries: number[] = [];
    const a = this.attack;
    if(a) {
      const m=attackConfig(a),end=a.start+strikeDuration(m);
      boundaries.push(a.start+m.windup,a.start+m.windup+m.active,end,end-(a.stage<3?COMBAT.chainWindow:0),end-120);
    }
    if(this.parryPending) boundaries.push(this.parryLegalAt(now),this.parryPending.until);
    if(this.pending) boundaries.push(this.requestedAt,this.bufferUntil);
    if(this.dashPending) boundaries.push(this.parry?.actionUntil??0,this.dashPending.until);
    if(this.parry)boundaries.push(this.parry.actionUntil,this.parry.start+PARRY.precise,this.parry.start+PARRY.active);
    boundaries.push(this.dashUntil,this.dashStart+COMBAT.dash.invulnStart,this.dashStart+COMBAT.dash.invulnEnd,this.regenUntil);
    return Math.min(...boundaries.filter(t=>t>now+1e-7));
  }
  reset(cooldown = 0) {
    this.parry = null;
    this.lastParry = null;
    this.parryCooldown = 0;
    this.lastParryRequestAt=null;
    this.regenUntil = 0;
    this.actionLockUntil=0;
    this.parryPending = null;
    this.dashPending = null;
    this.afterguard = null;
    this.counter = null;
    this.attack = null;
    this.pending = false;
    this.bufferUntil = 0;
    this.requestedAt = 0;
    this.reservationOwner = null;
    this.hitStopRemaining = 0;
    this.lastHitStopRequested = 0;
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
      this.parry && now < this.parry.actionUntil
        ? Math.max(now, this.parry.actionUntil) + COMBAT.buffer
        : a && a.stage < 3
        ? Math.max(now, a.start + this.total(a.stage) - COMBAT.chainWindow) +
          COMBAT.buffer
        : now + COMBAT.buffer;
  }
  // 表现停顿冻结整个世界模拟；使用未冻结的帧delta扣减，不累计多目标时长。
  stopOnHit(stage: number) {
    this.lastHitStopRequested=COMBAT.hitStop[stage-1];
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
      || now < this.actionLockUntil
    )
      return false;
    if (
      a &&
      (a.stage === 3 ||
        now - a.start < this.total(a.stage) - COMBAT.chainWindow)
    )
      return false;
    this.dashArmed = !!a || now < this.settleUntil || now < this.carryUntil;
    this.afterguard = null;
    this.parry = null;
    this.parryPending = null;
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
      (this.parry && now < this.parry.actionUntil ? this.parry.facing : undefined) ??
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
    return strikeDuration(this.attack?.stage === stage ? attackConfig(this.attack) : resolveStrike(stage));
  }
  phase(now: number) {
    const a = this.attack;
    if (!a) return "idle";
    const t = now - a.start,
      m = attackConfig(a);
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
      const startAt = this.pending && !this.parryPending && !this.dashPending
        ? Math.max(cursor, this.requestedAt, legal, this.actionLockUntil, this.dashUntil)
        : Infinity;
      const consumeAt = startAt <= this.bufferUntil ? startAt : Infinity;
      const stop = Math.min(now, end, consumeAt);
      if (a) {
        const m = attackConfig(a);
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
        const counter = this.counter && consumeAt < this.counter.until ? this.counter.kind : undefined;
        const stage = counter ? 1 : a
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
          counter,
          config: resolveStrike(stage, counter),
        };
        this.counter = null;
        this.afterguard = null;
        this.parry = null;
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
    const m = this.attack ? attackConfig(this.attack) : null;
    return {
      parry: this.parry ? {...this.parry, elapsed:now-this.parry.start, remaining:Math.max(0,this.parry.actionUntil-now)} : null,
      parrySerial: this.parrySerial,
      parryBuffered: this.parryPending,
      parryCooldownRemaining: Math.max(0,this.parryCooldown-now),
      regenPaused: now < this.regenUntil,
      afterguard: this.afterguard && now < this.afterguard.until ? this.afterguard : null,
      counter: this.counter && now < this.counter.until ? this.counter : null,
      attackConfig: m,
      counterAttack: this.attack?.counter ?? null,
      lastRejection: this.lastRejection,
      phase: this.phase(now),
      effectiveFacing: this.effectiveFacing(now, this.lastFacing),
      ready: !this.attack && now >= this.dashUntil && now < this.readyUntil,
      reservationOwner: this.pending ? this.reservationOwner : null,
      hitStopRemaining: this.hitStopRemaining,
      lastHitStopRequested: this.lastHitStopRequested,
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
