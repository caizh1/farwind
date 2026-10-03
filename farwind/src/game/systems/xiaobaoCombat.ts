import { Xiaobao } from "./xiaobao";
import { XIAOBAO } from "../../data/xiaobao";
import {
  XIAOBAO_SKILLS as SKILLS,
  XIAOBAO_STATS as STATS,
  XIAOBAO_ROADS,
  xiaobaoBattlePose,
  type XiaobaoSkill,
  type XiaobaoBattleClip,
  type XiaobaoTask,
} from "../../data/xiaobaoCombat";
import { zoneFor, inActivity, inAlert, inProtected } from "../../data/defenseZones";
import { regionAt } from "../../data/village";
import { RAID_GATES, type GateId } from "../../data/defense";
import {
  clearMeleeLine,
  clearMotionLine,
  motionBlocked,
  type Point,
} from "./obstacles";
import { enemyNavigation, type EnemyBody } from "./enemy";
import { aim, attackTouches, type EnemyContact } from "./enemyAttack";
import {
  initialXiaobao,
  type XiaobaoState,
  type XiaobaoCast,
  type XiaobaoEffect,
} from "./xiaobaoState";
import type { DamageEvent, ReleasedAttack } from "./damage";
// 封闭村门在内侧守候；开门后才走到外侧拦截点，避免反复尝试穿越门障。
export function xiaobaoGatePoint(id:GateId){const gate=RAID_GATES.find(g=>g.id===id)!;return clearMotionLine(gate.entry,gate.inside)?zoneFor(id).intercept:gate.inside;}
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const point = (p: Point): Point => ({ x: p.x, y: p.y });
export type XiaobaoAlly = Point & {
  id: string;
  hp: number;
  maxHP: number;
  role: "player" | "guard" | "resident" | "self" | "facility";
  threatAt: number | null;
};
export type XiaobaoFront = {
  key: string;
  gate: GateId;
  major: boolean;
  confirmed?: boolean;
  priority: number;
  point: Point;
  enemies: string[];
  injured: boolean;
  contactAt?: number;
};
export type XiaobaoEvent = {
  id: string;
  kind:
    "release" | "hit" | "flight" | "landing" | "shield" | "rest" | "recover";
  skill: XiaobaoSkill;
  at: number;
  point: Point;
  from?: Point;
  target?: string;
  damage?: number;
  stage?: number;
};
export type XiaobaoEnvironment = {
  now: number;
  minute: number;
  player: Point & { hp: number; outside: boolean; region: string };
  enemies: EnemyBody[];
  allies: XiaobaoAlly[];
  fronts: () => XiaobaoFront[];
  recent: { id: string; at: number } | null;
  playerThreats?: string[];
  move: (
    body: Point,
    nav: EnemyBody["nav"],
    target: Point,
    speed: number,
    dt: number,
    budget: { queries: number },
    allowed: (p: Point) => boolean,
    peers?: Point[],
  ) => number;
  hit: (
    enemy: EnemyBody,
    event: DamageEvent,
    released: ReleasedAttack,
    control: number,
    knock: number,
    task: XiaobaoTask,
    at: number,
  ) => { applied: boolean; killed: boolean; damage: number };
  blocked?: (p: Point) => boolean;
  clear?: (a: Point, b: Point) => boolean;
  melee?: (a: Point, b: Point) => boolean;
  takeoffClear?: (p: Point) => boolean;
  checkpoint?: (flightId: string) => void;
  message: (s: string) => void;
  lifeMove?: (ms:number,budget:{queries:number})=>void;
  lifeEmergency?: (active:boolean)=>void;
  lifeHelp?: (id:string)=>void;
};
// 日常序列保持原实现。长期任务与短时动作分开，释放实例与施法者生命分开。
export class XiaobaoCombat extends Xiaobao {
  data: XiaobaoState = initialXiaobao();
  nav = enemyNavigation();
  facing = 0;
  status = "听风待机";
  targetId: string | null = null;
  private nextDecision = 0;
  private fronts: XiaobaoFront[] = [];
  private hurtUntil = 0;
  private stuck = 0;
  private patrol = 0;
  private now = 0;
  private road: Point[] = [];
  private roadGoal: Point | null = null;
  private flightSaved: string | null = null;
  private regrouping = false;
  private guardPlayer = false;
  private get support() {
    return this.guardPlayer && !this.data.life.emergency ? null : this.data.support;
  }
  events: XiaobaoEvent[] = [];
  visuals: XiaobaoEvent[] = [];
  history: XiaobaoEvent[] = [];
  metrics = {
    decisions: 0,
    hits: 0,
    flights: 0,
    cancelled: 0,
    landingChecks: 0,
    steps: 0,
  };
  constructor() {
    super();
  }
  bind(state: XiaobaoState, restore = false) {
    this.data = state;
    this.x = state.x;
    this.y = state.y;
    if (restore) {
      this.events = [];
      this.visuals = [];
      this.history = [];
      this.nav = enemyNavigation();
      this.nextDecision = state.clock;
      this.targetId = null;
      this.fronts = [];
      this.stuck = 0;
      this.demonstration = false;
      this.road = [];
      this.roadGoal = null;
      this.flightSaved = state.flight?.id ?? null;
      this.hurtUntil = 0;
      this.nextLandingCheck = 0;
      this.patrol = 0;
      this.now = 0;
      this.regrouping = false;
      this.guardPlayer = false;
      this.metrics = {
        decisions: 0,
        hits: 0,
        flights: 0,
        cancelled: 0,
        landingChecks: 0,
        steps: 0,
      };
      this.facing = state.cast
        ? this.direction(state.cast.direction)
        : state.flight
          ? this.direction(aim(this, state.flight.goal))
          : 0;
      this.status = state.rest
        ? "护风调息"
        : state.flight
          ? "踏风飞援"
          : "听风待机";
      this.elapsed = 0;
      this.motion.reset();
      // 未支付的前摇统一取消；已释放近战、弹体和领域只推进余下阶段。
      if (state.cast && !state.cast.released) {
        state.cast = null;
        state.recovery = Math.max(state.recovery, 300);
      }
      if (state.space==='village' && !this.airborne && motionBlocked(this.x, this.y)) {
        const safe = this.candidates(this).find(
          (p) => !motionBlocked(p.x, p.y),
        );
        if (safe) {
          this.x = safe.x;
          this.y = safe.y;
          state.x = safe.x;
          state.y = safe.y;
        }
      }
    }
  }
  override reset() {
    super.reset();
    this.bind(initialXiaobao(), true);
  }
  get airborne() {
    return !!this.data.flight && this.data.flight.stage !== "takeoff";
  }
  get available() {
    return this.data.space === "village" && this.data.hp > 0 && !this.data.rest && !this.airborne;
  }
  get busy() {
    return (
      !!this.data.cast ||
      !!this.data.flight ||
      !!this.data.command ||
      this.data.effects.length > 0
    );
  }
  protection(id: string) {
    return {
      shield: this.data.shields.find((s) => s.id === id && s.remaining > 0),
      reduction: id === "xiaobao" && this.data.reduction > 0 ? 0.8 : 0,
    };
  }
  emit(event: Omit<XiaobaoEvent, "at">) {
    const e = { ...event, at: this.data.clock };
    this.events.push(e);
    this.visuals.push(e);
    this.history.push(e);
    if (this.visuals.length > 48) this.visuals.shift();
    if (this.history.length > 96) this.history.shift();
  }
  drain() {
    return this.events.splice(0);
  }
  cancel(recovery = 300) {
    if (this.data.cast) this.metrics.cancelled++;
    this.data.cast = null;
    this.data.recovery = Math.max(this.data.recovery, recovery);
  }
  taskChanged() {
    if (this.data.cast && !this.data.cast.released) this.cancel();
    this.data.command = null;
    this.data.wait = null;
    this.targetId = null;
    this.demonstration = false;
    this.nav = enemyNavigation();
    this.road = [];
    this.roadGoal = null;
    this.regrouping = false;
    this.guardPlayer = false;
  }
  command(
    kind: NonNullable<XiaobaoState["command"]>["kind"] | "wait" | "return",
    env: XiaobaoEnvironment,
  ) {
    if(this.data.life.emergency)throw Error("村庄仍有危险，小宝正在优先护村。");
    if (this.data.task !== "follow") throw Error("请先委托小宝与你出征。");
    if (kind === "wait") {
      this.data.wait = { ...point(this), region: env.player.region };
      this.data.command = null;
      this.regrouping = false;
      this.guardPlayer = false;
      return;
    }
    if (kind === "return") {
      this.data.wait = null;
      this.data.command = null;
      this.targetId = null;
      this.regrouping = false;
      return;
    }
    const target =
      env.recent && env.now - env.recent.at <= 1500
        ? env.enemies.find(
            (e) => e.id === env.recent!.id && e.hp > 0 && !e.disabled,
          )
        : undefined;
    if (kind !== "protect" && (!env.player.outside || !target))
      throw Error("请先攻击一个仍存活的敌人，再下达指令。");
    if (kind !== "focus" && kind !== "protect") {
      if (!this.available) throw Error("小宝当前正在飞援或调息，无法施法。");
      if (this.data.qi < SKILLS[kind].qi)
        throw Error(
          `${SKILLS[kind].name}需要${SKILLS[kind].qi}真气，当前不足。`,
        );
      if (this.data.cooldowns[kind] > 5000)
        throw Error(
          `${SKILLS[kind].name}还需冷却${(this.data.cooldowns[kind] / 1000).toFixed(1)}秒。`,
        );
      if (
        ["rock", "fire", "unity"].includes(kind) &&
        this.data.effects.filter((e) =>
          ["rock", "fire", "unity"].includes(e.skill),
        ).length >= 2
      )
        throw Error("已有两个范围领域，请等待一个领域结束。");
    }
    this.data.command = {
      kind,
      target: target?.id ?? null,
      center: point(target ?? env.player),
      remaining: 5000,
    };
    this.data.wait = null;
  }
  transitioned(destination: Point, env?: XiaobaoEnvironment) {
    if (this.data.task !== "follow") return;
    this.data.wait = null;
    this.data.command = null;
    this.targetId = null;
    this.regrouping = false;
    this.guardPlayer = false;
    this.cancel();
    if (this.data.flight) {
      const safe = this.candidates(destination).find(
        (p) => !(env?.blocked?.(p) ?? motionBlocked(p.x, p.y)),
      );
      if (safe) {
        this.data.flight.active = false;
        this.data.flight.goal = safe;
        this.data.flight.safe = safe;
        this.data.flight.origin = point(this);
        this.data.flight.leg = distance(this, safe);
        this.data.flight.stage = "cruise";
        this.data.flight.age = 0;
      }
      return;
    }
    const safe = this.candidates({
      x: destination.x + 150,
      y: destination.y + 25,
    }).find((p) => !(env?.blocked?.(p) ?? motionBlocked(p.x, p.y)));
    if (safe) {
      this.x = safe.x;
      this.y = safe.y;
      this.data.x = safe.x;
      this.data.y = safe.y;
      this.motion.reset();
      this.nav = enemyNavigation();
    }
  }
  receive(
    contact: EnemyContact,
    source: EnemyBody,
    damage: (event: DamageEvent) => {
      applied: boolean;
      hp: number;
      damage: number;
    },
    now: number,
  ) {
    if (
      !this.available ||
      (!contact.projectileId && source.hp <= 0) ||
      source.disabled ||
      contact.attack.cancelled ||
      contact.attack.resolved ||
      !attackTouches(contact, this) ||
      !clearMeleeLine(contact.origin, this)
    )
      return false;
    const hit = damage({
      sourceId: source.id,
      targetId: "xiaobao",
      attackId: contact.attack.attackId,
      amount: contact.attack.damage,
      sourceType: contact.projectileId ? "enemy-shot" : contact.blastId ? "enemy-blast" : "enemy-melee",
      eventId: contact.projectileId
        ? null
        : ((source as EnemyBody & { eventId?: string }).eventId ?? null),
    });
    if (!hit.applied) return false;
    contact.attack.resolved = true;
    this.data.hp = hit.hp;
    this.data.peace = 0;
    this.hurtUntil = this.data.clock + 180;
    if (hit.hp === 0) {
      this.cancel(0);
      this.data.flight = null;
      this.data.command = null;
      this.data.rest = 30000;
      this.status = "护风调息";
      this.emit({
        id: `rest:${++this.data.serial}`,
        kind: "rest",
        skill: "guard",
        point: point(this),
      });
    }
    this.now = now;
    return true;
  }
  can(skill: Exclude<XiaobaoSkill, "flight">, reserve = false) {
    const s = SKILLS[skill];
    if (
      !this.available ||
      this.data.recovery > 0 ||
      this.data.cooldowns[skill] > 0 ||
      this.data.qi < s.qi + (reserve && s.qi > 0 ? 18 : 0)
    )
      return false;
    if (
      ["star", "blade"].includes(skill) &&
      this.data.effects.filter((e) => ["star", "blade"].includes(e.skill))
        .length >= 2
    )
      return false;
    if (
      ["rock", "fire", "unity"].includes(skill) &&
      this.data.effects.filter((e) =>
        ["rock", "fire", "unity"].includes(e.skill),
      ).length >= 2
    )
      return false;
    if (skill === "chain" && this.data.effects.some((e) => e.skill === "chain"))
      return false;
    return true;
  }
  start(
    skill: Exclude<XiaobaoSkill, "flight">,
    target: EnemyBody | null,
    center?: Point,
  ) {
    if (this.data.cast || !this.can(skill)) return false;
    const goal = point(center ?? target ?? this),
      id = `xiaobao:${++this.data.serial}`;
    this.data.cast = {
      id,
      skill,
      age: 0,
      stage: 0,
      released: false,
      fixedCenter: !!center,
      origin: point(this),
      center: goal,
      direction: aim(this, goal),
      target: target?.id ?? null,
      task: this.data.task,
    };
    this.facing = this.direction(this.data.cast.direction);
    this.demonstration = false;
    this.status = SKILLS[skill].name;
    return true;
  }
  direction(d: Point) {
    return Math.abs(d.x) > Math.abs(d.y) ? (d.x < 0 ? 2 : 3) : d.y < 0 ? 1 : 0;
  }
  valid(e: EnemyBody, env: XiaobaoEnvironment, origin: Point, range: number) {
    return (
      e.hp > 0 &&
      !e.disabled &&
      distance(origin, e) <= range + 1e-7 &&
      (env.melee ?? clearMeleeLine)(origin, e)
    );
  }
  shield(env: XiaobaoEnvironment, radius: number, ms: number, id: string) {
    const allies = env.allies
      .filter(
        (a) => a.hp > 0 && a.role !== "facility" && distance(this, a) <= radius,
      )
      .sort(
        (a, b) =>
          Number(b.threatAt !== null) - Number(a.threatAt !== null) ||
          a.hp / a.maxHP - b.hp / b.maxHP ||
          distance(this, a) - distance(this, b) ||
          a.id.localeCompare(b.id),
      )
      .slice(0, 5);
    for (const a of allies) {
      const old = this.data.shields.find((s) => s.id === a.id);
      if (old) {
        old.amount = Math.max(old.amount, 120);
        old.remaining = Math.max(old.remaining, ms);
      } else this.data.shields.push({ id: a.id, amount: 120, remaining: ms });
      if(a.threatAt!==null && (a.role==='resident'||a.role==='guard'))env.lifeHelp?.(a.id);
      this.emit({
        id: `${id}:${a.id}`,
        kind: "shield",
        skill: "guard",
        point: point(a),
        target: a.id,
      });
    }
  }
  hit(
    e: EnemyBody,
    c: XiaobaoCast,
    stage: number,
    amount: number,
    env: XiaobaoEnvironment,
    control = 0,
    knock = 0,
    from = c.center,
  ) {
    if (e.hp <= 0 || e.disabled) return false;
    const event: DamageEvent = {
      sourceId: "xiaobao",
      targetId: e.id,
      attackId: `${c.id}:${stage}:${e.id}`,
      amount,
      sourceType: ["palm", "triple", "rescue"].includes(c.skill)
        ? "companion-melee"
        : ["star", "blade"].includes(c.skill)
          ? "companion-shot"
          : "companion-element",
      eventId: (e as EnemyBody & { eventId?: string }).eventId ?? null,
      origin:{...from},
      breaksGuard:control>0||c.skill==='rock'||c.skill==='unity',
    };
    const source: ReleasedAttack = Object.freeze({
      sourceId: "xiaobao",
      faction: "village",
      attackId: event.attackId,
      amount,
      sourceType: event.sourceType as ReleasedAttack["sourceType"],
      eventId: event.eventId,
    });
    const hit = env.hit(
      e,
      event,
      source,
      Math.min(800, control),
      knock,
      c.task,
      this.now,
    );
    if (!hit.applied) return false;
    this.data.peace = 0;
    this.metrics.hits++;
    const support = this.support;
    if (support) {
      support.hits++;
      if (hit.killed) support.kills++;
    }
    this.emit({
      id: event.attackId,
      kind: "hit",
      skill: c.skill,
      point: point(e),
      from: point(from),
      target: e.id,
      damage: hit.damage,
      stage,
    });
    return true;
  }
  castTick(dt: number, env: XiaobaoEnvironment) {
    const c = this.data.cast;
    if (!c) return;
    const s = SKILLS[c.skill];
    c.age += dt;
    if (
      !c.released &&
      c.fixedCenter &&
      (distance(this, c.center) > s.range ||
        (env.melee ?? clearMeleeLine)(this, c.center) === false)
    ) {
      this.cancel();
      env.message("施法落点超出范围或被地形遮挡，已取消，未扣真气。");
      return;
    }
    if (
      !c.released &&
      c.target &&
      !env.enemies.some(
        (e) => e.id === c.target && this.valid(e, env, this, s.range),
      )
    ) {
      this.cancel();
      return;
    }
    while (
      c.stage < (c.skill === "triple" ? 3 : 1) &&
      c.age + 1e-7 >= s.times[c.stage]
    ) {
      const target = env.enemies.find((e) => e.id === c.target);
      if (!c.released) {
        if (
          !this.can(c.skill) ||
          (c.target && (!target || !this.valid(target, env, this, s.range)))
        ) {
          this.cancel();
          return;
        }
        if (target) {
          c.direction = aim(this, c.fixedCenter ? c.center : target);
          this.facing = this.direction(c.direction);
          if (!c.fixedCenter) c.center = point(target);
        }
        c.released = true;
        this.data.qi -= s.qi;
        this.data.cooldowns[c.skill] = s.cooldown;
        this.emit({
          id: c.id,
          kind: "release",
          skill: c.skill,
          point: point(this),
          from: point(c.center),
        });
      }
      if (c.skill === "palm" || c.skill === "triple") {
        if (c.skill === "triple")
          this.groundStep(c.direction.x * 12, c.direction.y * 12, env);
        const candidates = env.enemies
          .filter(
            (e) =>
              this.valid(e, env, this, s.range) &&
              ((e.x - this.x) * c.direction.x +
                (e.y - this.y) * c.direction.y) /
                Math.max(0.001, distance(this, e)) >=
                Math.cos((50 * Math.PI) / 180),
          )
          .sort(
            (a, b) =>
              distance(this, a) - distance(this, b) || a.id.localeCompare(b.id),
          )
          .slice(0, 3);
        for (const e of candidates)
          this.hit(
            e,
            c,
            c.stage,
            s.damage[c.stage],
            env,
            c.skill === "palm" ? 180 : c.stage === 2 ? 350 : 120,
            c.skill === "palm" ? 18 : c.stage === 2 ? 30 : 0,
            this,
          );
      } else if (c.skill === "guard") {
        this.shield(env, 96, 2500, c.id);
        this.data.reduction = 600;
      } else if (
        c.skill === "thunder" &&
        target &&
        this.valid(target, env, this, s.range)
      )
        this.hit(target, c, 0, 180, env, 600, 0, this);
      else if (c.skill !== "rescue") {
        const effect: XiaobaoEffect = {
          ...structuredClone(c),
          age: s.times[0] - dt,
          stage: 0,
          hit: [],
          last: point(this),
          returnAt: s.range,
          travelled: 0,
        };
        this.data.effects.push(effect);
      }
      c.stage++;
    }
    if (c.skill === "rescue" && c.released && c.stage === 1) {
      const d = distance(this, c.center),
        step = Math.min(
          d,
          (700 * dt) / 1000,
          Math.max(0, 140 - distance(c.origin, this)),
        );
      this.groundStep(c.direction.x * step, c.direction.y * step, env);
      if (distance(this, c.center) <= 2 || c.age >= 280 || step < 0.001) {
        for (const e of env.enemies
          .filter((e) => this.valid(e, env, this, 48))
          .sort(
            (a, b) =>
              distance(this, a) - distance(this, b) || a.id.localeCompare(b.id),
          )
          .slice(0, 2))
          this.hit(e, c, 0, 96, env, 400, 0, this);
        c.stage = 2;
      }
    }
    if (c.age + 1e-7 >= s.recovery) this.data.cast = null;
  }
  groundStep(dx: number, dy: number, env: XiaobaoEnvironment) {
    const to = { x: this.x + dx, y: this.y + dy };
    if (
      !(env.blocked?.(to) ?? motionBlocked(to.x, to.y)) &&
      (env.clear ?? clearMotionLine)(this, to)
    ) {
      this.x = to.x;
      this.y = to.y;
    }
  }
  effectStages(
    e: XiaobaoEffect,
    env: XiaobaoEnvironment,
    fireHits = new Set<string>(),
  ) {
    const s = SKILLS[e.skill];
    while (e.stage < s.times.length && e.age + 1e-7 >= s.times[e.stage]) {
      const stage = e.stage++;
      if (e.skill === "chain") {
        const target =
          stage === 0
            ? env.enemies.find(
                (t) => t.id === e.target && this.valid(t, env, e.origin, 440),
              )
            : env.enemies
                .filter(
                  (t) =>
                    !e.hit.includes(t.id) && this.valid(t, env, e.last, 150),
                )
                .sort(
                  (a, b) =>
                    distance(e.last, a) - distance(e.last, b) ||
                    a.id.localeCompare(b.id),
                )[0];
        if (!target || e.hit.includes(target.id)) {
          e.stage = s.times.length;
          break;
        }
        const from = point(stage === 0 ? e.origin : e.last);
        e.hit.push(target.id);
        e.last = point(target);
        this.hit(target, e, stage, s.damage[stage], env, 250, 0, from);
      } else {
        const radius = e.skill === "rock" && stage > 0 ? 70 : s.radius;
        for (const t of env.enemies
          .filter((t) => this.valid(t, env, e.center, radius))
          .sort((a, b) => a.id.localeCompare(b.id))) {
          const key = `${stage}:${t.id}`;
          if (e.hit.includes(key)) continue;
          e.hit.push(key);
          const fire =
            e.skill === "fire" ||
            (e.skill === "unity" && stage > 0 && stage < 6);
          const fireKey = `${this.now}:${t.id}`;
          if (fire && fireHits.has(fireKey)) continue;
          if (fire) fireHits.add(fireKey);
          this.hit(
            t,
            e,
            stage,
            s.damage[stage],
            env,
            e.skill === "rock" && stage === 0
              ? 450
              : e.skill === "unity" && stage === 6
                ? 600
                : 0,
          );
        }
        this.emit({
          id: `${e.id}:pulse:${stage}`,
          kind: "release",
          skill: e.skill,
          point: point(e.center),
          stage,
        });
      }
    }
  }
  effectsTick(dt: number, env: XiaobaoEnvironment) {
    const fireHits = new Set<string>();
    // 同时同源领域先处理伤害较大的实例，避免重叠火域重复扣血。
    for (const e of [...this.data.effects].sort(
      (a, b) =>
        Number(b.skill === "fire") - Number(a.skill === "fire") ||
        a.id.localeCompare(b.id),
    )) {
      e.age += dt;
      if (["star", "blade"].includes(e.skill)) this.shot(e, dt, env);
      else this.effectStages(e, env, fireHits);
    }
    this.data.effects = this.data.effects.filter((e) =>
      ["star", "blade"].includes(e.skill)
        ? e.stage < 2
        : e.stage < SKILLS[e.skill].times.length,
    );
  }
  shot(e: XiaobaoEffect, dt: number, env: XiaobaoEnvironment) {
    const blade = e.skill === "blade",
      range = blade ? e.returnAt : 480,
      speed = blade ? 600 : 700;
    let remaining = (speed * dt) / 1000;
    while (remaining > 1e-7 && e.stage < 2) {
      const phase = blade ? e.stage : 0,
        limit = phase ? e.returnAt * 2 : range,
        length = Math.min(remaining, Math.max(0, limit - e.travelled));
      const direction = {
          x: e.direction.x * (phase ? -1 : 1),
          y: e.direction.y * (phase ? -1 : 1),
        },
        old = point(e.last);
      const next = {
        x: old.x + direction.x * length,
        y: old.y + direction.y * length,
      };
      let wall = 1;
      if (!(env.melee ?? clearMeleeLine)(old, next)) {
        let lo = 0,
          hi = 1;
        for (let i = 0; i < 16; i++) {
          const u = (lo + hi) / 2,
            p = {
              x: old.x + (next.x - old.x) * u,
              y: old.y + (next.y - old.y) * u,
            };
          if ((env.melee ?? clearMeleeLine)(old, p)) lo = u;
          else hi = u;
        }
        wall = lo;
      }
      const touches = env.enemies
        .filter(
          (t) => t.hp > 0 && !t.disabled && !e.hit.includes(`${phase}:${t.id}`),
        )
        .map((t) => {
          const dx = next.x - old.x,
            dy = next.y - old.y,
            fx = old.x - t.x,
            fy = old.y - t.y,
            a = dx * dx + dy * dy,
            b = 2 * (fx * dx + fy * dy),
            c = fx * fx + fy * fy - (blade ? 22 : 10) ** 2,
            disc = b * b - 4 * a * c;
          return {
            t,
            u:
              c <= 0
                ? 0
                : a > 0 && disc >= 0
                  ? (-b - Math.sqrt(disc)) / (2 * a)
                  : Infinity,
          };
        })
        .filter(
          (h) =>
            h.u >= 0 &&
            h.u <= wall &&
            h.u <= 1 &&
            (env.melee ?? clearMeleeLine)(old, h.t),
        )
        .sort((a, b) => a.u - b.u || a.t.id.localeCompare(b.t.id));
      for (const { t, u } of touches) {
        const count = e.hit.filter((k) => k.startsWith(`${phase}:`)).length,
          cap = blade ? 4 : 2;
        if (count >= cap) break;
        e.hit.push(`${phase}:${t.id}`);
        this.hit(
          t,
          e,
          phase,
          blade ? (phase ? 54 : 90) : count ? 72 : 96,
          env,
          0,
          0,
          old,
        );
        if (!blade && count + 1 === cap) {
          e.stage = 2;
          e.last = {
            x: old.x + (next.x - old.x) * u,
            y: old.y + (next.y - old.y) * u,
          };
          return;
        }
      }
      e.last = {
        x: old.x + (next.x - old.x) * wall,
        y: old.y + (next.y - old.y) * wall,
      };
      e.travelled += length * wall;
      remaining -= length;
      if (wall < 1 || e.travelled + 1e-7 >= limit) {
        if (blade && !phase) {
          e.returnAt = e.travelled;
          e.stage = 1;
        } else e.stage = 2;
      }
      if (length < 1e-7) {
        if (blade && !phase) e.stage = 1;
        else e.stage = 2;
      }
    }
    if (e.age > SKILLS[e.skill].times[0] + 1500) e.stage = 2;
  }
  candidates(center: Point) {
    return [
      point(center),
      ...Array.from({ length: 15 }, (_, i) => ({
        x: center.x + Math.cos((i * Math.PI) / 4) * (i < 8 ? 88 : 130),
        y: center.y + Math.sin((i * Math.PI) / 4) * (i < 8 ? 88 : 130),
      })),
    ];
  }
  landingPoints(center: Point, env: XiaobaoEnvironment) {
    return this.candidates(center)
      .filter((p) => {
        this.metrics.landingChecks++;
        return (
          !(env.blocked?.(p) ?? motionBlocked(p.x, p.y)) &&
          !env.allies.some(
            (a) => a.id !== "xiaobao" && a.hp > 0 && distance(p, a) < 30,
          ) &&
          !env.enemies.some(
            (e) => e.hp > 0 && !e.disabled && distance(p, e) < 34,
          )
        );
      })
      .slice(0, 3);
  }
  beginFlight(front: XiaobaoFront, env: XiaobaoEnvironment) {
    if (
      this.data.rest ||
      this.data.cooldowns.flight ||
      this.data.flight ||
      !this.available
    )
      return false;
    if (env.takeoffClear && !env.takeoffClear(this)) return false;
    const choices = this.landingPoints(front.point, env),
      safe = this.landingPoints(xiaobaoGatePoint(front.gate), env)[0];
    if (!choices.length || !safe || distance(this, choices[0]) > 5000)
      return false;
    this.cancel(100);
    this.demonstration = false;
    this.targetId = null;
    const key = `${this.data.alarmCycle}:${front.key}`;
    this.data.flight = {
      id: `flight:${++this.data.serial}`,
      key,
      gate: front.gate,
      priority: front.priority,
      stage: "takeoff",
      age: 0,
      origin: point(this),
      goal: choices[0],
      backups: choices.slice(1),
      safe,
      travelled: 0,
      leg: distance(this, choices[0]),
      rerouted: false,
      active: true,
      imprint: false,
    };
    this.data.support = {
      key: front.key,
      gate: front.gate,
      age: 0,
      hits: 0,
      kills: 0,
      injured: front.injured,
    };
    this.status = "踏风飞援 · 起飞";
    this.flightSaved = env.checkpoint ? null : this.data.flight.id;
    // 起飞检查点在本轮推进中同步提交；不能等循环末尾才发布地面根。
    this.data.x = this.x;
    this.data.y = this.y;
    env.checkpoint?.(this.data.flight.id);
    return true;
  }
  flightTick(dt: number, env: XiaobaoEnvironment) {
    const f = this.data.flight;
    if (!f) return;
    f.age += dt;
    const front = this.fronts.find(
      (t) => t.gate === f.gate && t.key === this.data.support?.key,
    );
    if (!front && f.active) {
      f.active = false;
      if (f.stage === "takeoff") {
        this.data.flight = null;
        this.status = "危机已解除";
        return;
      }
      const nearby = this.landingPoints(this, env)[0];
      if (nearby) {
        f.goal = nearby;
        f.origin = point(this);
        f.leg = distance(this, nearby);
        f.stage = "cruise";
        f.age = 0;
      }
    }
    if (f.stage === "takeoff") {
      if (f.age >= 200) {
        if (this.flightSaved !== f.id) {
          f.age = 200;
          this.status = "飞援准备 · 正在保存";
          return;
        }
        this.data.cooldowns.flight = 30000;
        this.data.responded.push(f.key);
        this.data.responded = this.data.responded.slice(-32);
        f.stage = "cruise";
        f.age = 0;
        this.metrics.flights++;
        this.emit({
          id: f.id,
          kind: "flight",
          skill: "flight",
          point: point(this),
          from: point(f.goal),
        });
      }
      return;
    }
    if (f.stage === "cruise") {
      if (f.active && f.travelled + distance(this, f.goal) > 5000 + 1e-7) {
        f.active = false;
        f.backups = [];
        const safe = this.landingPoints(this, env)[0];
        if (safe) {
          f.goal = safe;
          f.origin = point(this);
          f.leg = distance(this, safe);
          f.age = 0;
        } else {
          f.stage = "hover";
          f.age = 0;
        }
        return;
      }
      const d = distance(this, f.goal),
        step = Math.min(d, (Math.min(1600, f.leg / 0.2) * dt) / 1000);
      if (d > 0) {
        this.facing = this.direction(aim(this, f.goal));
        this.x += ((f.goal.x - this.x) / d) * step;
        this.y += ((f.goal.y - this.y) / d) * step;
        f.travelled = Math.min(5000, f.travelled + step);
      }
      this.status = "踏风飞援 · 巡航";
      if (distance(this, f.goal) < 0.001 && f.age >= 200) {
        if (
          this.landingPoints(f.goal, env).some((p) => distance(p, f.goal) < 1)
        ) {
          f.stage = "landing";
          f.age = 0;
        } else {
          const backup = f.backups.find((p) =>
            this.landingPoints(p, env).some((q) => distance(p, q) < 1),
          );
          if (backup) {
            f.origin = point(this);
            f.goal = backup;
            f.leg = distance(this, backup);
            f.age = 0;
            f.backups = f.backups.filter((p) => p !== backup);
          } else {
            f.stage = "hover";
            f.age = 0;
          }
        }
      }
      return;
    }
    if (f.stage === "hover") {
      this.status = "飞援待降 · 寻找安全地面";
      if (f.age >= 1000 && this.data.clock >= this.nextLandingCheck) {
        this.nextLandingCheck = this.data.clock + 150;
        const safe = this.landingPoints(f.safe, env)[0];
        if (safe) {
          f.goal = safe;
          f.origin = point(this);
          f.leg = distance(this, safe);
          f.stage = "cruise";
          f.age = 0;
          f.active = false;
        }
      }
      return;
    }
    this.status = "踏风飞援 · 降落";
    if (f.age >= 250) {
      if (
        !this.landingPoints(f.goal, env).some((p) => distance(p, f.goal) < 1)
      ) {
        f.stage = "hover";
        f.age = 0;
        return;
      }
      if (f.active && front && !f.imprint) {
        f.imprint = true;
        this.shield(env, 120, 2000, `${f.id}:imprint`);
      }
      this.emit({
        id: `${f.id}:land`,
        kind: "landing",
        skill: "flight",
        point: point(this),
      });
      this.data.flight = null;
      this.data.recovery = 0;
    }
  }
  private nextLandingCheck = 0;
  confirmFlight(id: string) {
    if (this.data.flight?.id === id) this.flightSaved = id;
  }
  choose(env: XiaobaoEnvironment) {
    this.metrics.decisions++;
    let following = this.data.task === "follow" && !this.data.wait &&
      env.player.outside && env.player.hp > 0 && !this.data.life.emergency;
    const threatensPlayer = (e: EnemyBody) => e.targetId === "player" ||
      env.playerThreats?.includes(e.id) || (e.playerAggroUntil ?? 0) > env.now;
    this.guardPlayer = following && env.enemies.some(e =>
      this.valid(e, env, env.player, 320) && threatensPlayer(e));
    this.fronts = env
      .fronts()
      .filter(f=>f.major||f.confirmed===true)
      .sort(
        (a, b) =>
          b.priority - a.priority ||
          (a.contactAt ?? Infinity) - (b.contactAt ?? Infinity) ||
          distance(this, a.point) - distance(this, b.point) ||
          a.key.localeCompare(b.key),
      );
    const danger=this.fronts.length>0;
    const life=this.data.life;
    if(danger){
      if(!life.emergency){life.emergency=true;env.lifeEmergency?.(true);if(this.data.cast&&!this.data.cast.released)this.cancel(0);}
      life.clearSince=null;this.guardPlayer=false;following=false;this.demonstration=false;
      this.data.wait=null;this.data.command=null;
    }else if(life.emergency){
      life.clearSince??=this.data.clock;
      if(this.data.clock-life.clearSince>=10000){life.emergency=false;life.clearSince=null;life.aftercareUntil=env.minute+180;env.lifeEmergency?.(false);}
    }
    const major = this.fronts;
    if(this.data.space!=='village')return;
    if (major.length && !this.data.alarmActive) {
      this.data.alarmActive = true;
      this.data.alarmCycle++;
      this.data.responded = [];
    }
    if (!major.length) this.data.alarmActive = false;
    const urgent = env.allies
      .filter(
        (a) =>
          a.hp > 0 &&
          (!life.emergency||a.role!=='player') &&
          a.threatAt !== null &&
          a.threatAt - env.now <= 600 &&
          distance(this, a) < 600,
      )
      .sort(
        (a, b) =>
          (life.emergency ? Number(b.role==='resident')-Number(a.role==='resident') : 0) ||
          (following ? Number(b.role === "player") - Number(a.role === "player") : 0) ||
          a.threatAt! - b.threatAt! ||
          a.hp / a.maxHP - b.hp / b.maxHP ||
          a.id.localeCompare(b.id),
      )[0];
    const protectPlayer = !life.emergency && (
      this.guardPlayer || (env.player.hp < 30 &&
      env.allies.some(
        (a) =>
          a.id === "player" &&
          a.threatAt !== null &&
          a.threatAt - env.now <= 600,
      )));
    const front = major[0];
    if (this.data.flight) {
      const f = this.data.flight;
      if (
        f.active &&
        front &&
        front.priority > f.priority &&
        f.stage === "cruise" &&
        !f.rerouted &&
        f.age < Math.max(200, (f.leg / 1600) * 1000) / 2 &&
        f.travelled + distance(this, front.point) <= 5000
      ) {
        const choices = this.landingPoints(front.point, env),
          safe = this.landingPoints(xiaobaoGatePoint(front.gate), env)[0],
          landing = choices[0];
        if (landing && safe && f.travelled + distance(this, landing) <= 5000) {
          f.goal = landing;
          f.backups = choices.slice(1);
          f.safe = safe;
          f.origin = point(this);
          f.leg = distance(this, landing);
          f.age = 0;
          f.rerouted = true;
          f.gate = front.gate;
          f.priority = front.priority;
          f.key = `${this.data.alarmCycle}:${front.key}`;
          this.data.responded.push(f.key);
          this.data.support = {
            key: front.key,
            gate: front.gate,
            age: 0,
            hits: 0,
            kills: 0,
            injured: front.injured,
          };
        }
      }
      return;
    }
    if (!this.available) return;
    if (
      this.data.task === "follow" &&
      env.player.outside &&
      env.player.hp <= 0 && !life.emergency
    ) {
      if (this.data.cast && !this.data.cast.released) this.cancel();
      return;
    }
    if (
      front &&
      !protectPlayer
    ) {
      if (!this.data.responded.includes(`${this.data.alarmCycle}:${front.key}`) && distance(this, front.point) > 240 && this.beginFlight(front, env))
        return;
      if(this.data.support&&this.data.support.gate!==front.gate){
        const previous=this.data.support;
        this.data.reports.push({event:previous.key,gate:previous.gate,hits:previous.hits,kills:previous.kills,injured:previous.injured,result:'转往更紧急的防线',time:env.minute});
        this.data.reports=this.data.reports.slice(-10);this.data.support=null;this.targetId=null;
        if(this.data.cast&&!this.data.cast.released)this.cancel(0);
      }
      this.data.support ??= {
        key: front.key,
        gate: front.gate,
        age: 0,
        hits: 0,
        kills: 0,
        injured: front.injured,
      };
      if (this.data.cooldowns.flight > 0) this.status = "飞援冷却 · 沿地面支援";
    }
    if (this.data.task === "guard" && !this.data.support) {
      const regular = this.fronts.find(
        (f) => this.data.gate === "all" || this.data.gate === f.gate,
      );
      if (regular)
        this.data.support = {
          key: regular.key,
          gate: regular.gate,
          age: 0,
          hits: 0,
          kills: 0,
          injured: regular.injured,
        };
    }
    if (protectPlayer) this.status = "先护住旅人";
    // 尚未释放的进攻可让位给主角遇险；已释放实例仍正常结算。
    if (!life.emergency && this.guardPlayer && this.data.cast && !this.data.cast.released &&
      this.data.cast.target && !env.enemies.some(e =>
        e.id === this.data.cast!.target && threatensPlayer(e))) this.cancel(0);
    if (
      urgent &&
      distance(this, urgent) <= 96 &&
      this.can("guard") &&
      (!this.data.cast || !this.data.cast.released)
    ) {
      if (this.data.cast) this.cancel(0);
      this.start("guard", null);
      return;
    }
    if (this.data.cast) return;
    const pending = this.data.command;
    if (pending) {
      const target = env.enemies.find((e) => e.id === pending.target);
      if (pending.kind === "protect") {
        if (
          urgent &&
          distance(this, urgent) <= 96 &&
          this.start("guard", null)
        ) {
          this.data.command = null;
          return;
        }
      } else if (
        !target ||
        target.hp <= 0 ||
        target.disabled ||
        !env.player.outside
      ) {
        this.data.command = null;
        env.message("指定目标已失效，指令已取消。");
      } else if (pending.kind === "focus") this.targetId = target.id;
      else if (this.valid(target, env, this, SKILLS[pending.kind].range)) {
        if (this.start(pending.kind, target, pending.center)) {
          this.data.command = null;
          return;
        }
      } else if (!(env.melee ?? clearMeleeLine)(this, target)) {
        this.data.command = null;
        env.message("指定目标被地形遮挡，指令已取消。");
      }
    }
    if (urgent && distance(this, urgent) <= 96 && this.can("guard")) {
      this.start("guard", null);
      return;
    }
    const anchor = this.anchor(env),
      support = this.support,
      gate =
        support?.gate ??
        (this.data.gate === "all" ? this.fronts[0]?.gate : this.data.gate);
    const candidates = env.enemies.filter(
      (e) =>
        this.valid(e, env, this, 600) &&
        this.allowed(e, env, anchor, gate) &&
        (this.data.task === "follow" && !support && !life.emergency
          ? env.player.outside &&
            (e.targetId === "player" ||
              env.playerThreats?.includes(e.id) ||
              e.targetId === "xiaobao" ||
              (e.playerAggroUntil ?? 0) > env.now ||
              (env.recent?.id === e.id && env.now - env.recent.at <= 1500) ||
              this.data.command?.target === e.id)
          : this.fronts.some((f) => f.enemies.includes(e.id)) ||
            (life.emergency && !!support && e.id === this.targetId) ||
            e.targetId === "xiaobao" ||
            env.allies.some((a) => a.threatAt !== null && e.targetId === a.id)),
    );
    const victim = (e: EnemyBody) =>
      env.allies.find((a) => a.id === e.targetId && a.threatAt !== null);
    candidates.sort(
      (a, b) =>
        (life.emergency ? Number(victim(b)?.role==='resident')-Number(victim(a)?.role==='resident') : 0) ||
        (following && !life.emergency
          ? Number(!!b.attack && !b.attack.cancelled && !b.attack.resolved && b.targetId === "player") -
              Number(!!a.attack && !a.attack.cancelled && !a.attack.resolved && a.targetId === "player") ||
            Number(b.id === this.data.command?.target) - Number(a.id === this.data.command?.target) ||
            Number(!!threatensPlayer(b)) - Number(!!threatensPlayer(a))
          : 0) ||
        (this.data.tactic === "protect"
          ? Number(!!victim(b)) - Number(!!victim(a)) ||
            (victim(a)?.hp ?? Infinity) / (victim(a)?.maxHP ?? 1) -
              (victim(b)?.hp ?? Infinity) / (victim(b)?.maxHP ?? 1)
          : 0) ||
        Number(!!b.attack && !b.attack.cancelled && !b.attack.resolved) -
          Number(!!a.attack && !a.attack.cancelled && !a.attack.resolved) ||
        Number(b.id === this.targetId) - Number(a.id === this.targetId) ||
        distance(this, a) - distance(this, b) ||
        a.id.localeCompare(b.id),
    );
    const target = candidates[0];
    if (!target) {
      this.targetId = null;
      return;
    }
    this.targetId = target.id;
    this.data.peace = 0;
    const d = distance(this, target),
      cluster = candidates.filter((e) => distance(target, e) <= 110).length,
      wide = candidates.filter((e) => distance(target, e) <= 200).length;
    const reserve =
      this.data.tactic === "protect" ||
      (this.data.tactic === "steady" && !!urgent);
    const picks: Exclude<XiaobaoSkill, "flight">[] = [];
    if (urgent && distance(this, urgent) <= 140 && distance(this, urgent) > 96)
      picks.push("rescue");
    if (
      (this.data.tactic === "full" && wide >= 4) ||
      (wide >= 3 && urgent && urgent.hp / urgent.maxHP < 0.3)
    )
      picks.push("unity");
    if (cluster >= 3) picks.push("rock");
    if (cluster >= 2) picks.push("fire");
    if (candidates.length >= 3) picks.push("chain", "blade");
    if (target.type === "spore" || urgent) picks.push("thunder");
    if (d <= 96 && target.hp <= 72) picks.push("palm");
    if (d <= 112 && target.hp > 72) picks.push("triple");
    picks.push("star", "palm");
    for (const skill of picks)
      if (d <= SKILLS[skill].range && this.can(skill, reserve)) {
        this.start(
          skill,
          target,
          skill === "rescue" ? point(urgent ?? target) : undefined,
        );
        return;
      }
  }
  anchor(env: XiaobaoEnvironment): Point {
    if (this.support) return xiaobaoGatePoint(this.support.gate);
    if (this.data.task === "follow" && !this.data.life.emergency) return this.data.wait ?? env.player;
    if (this.data.task === "guard" && this.data.gate !== "all")
      return xiaobaoGatePoint(this.data.gate);
    return XIAOBAO.home;
  }
  allowed(p: Point, env: XiaobaoEnvironment, anchor: Point, gate?: GateId) {
    // 已确认的门外攻击也要拦截；沿警戒带赶赴，仍不追出防线进入荒野。
    if(this.data.life.emergency)return inProtected(p)||!!gate&&(inActivity(gate,p)||inAlert(gate,p));
    if (this.data.wait && !this.support)
      return distance(p, this.data.wait) <= 120;
    if (this.data.task === "follow" && !this.support)
      return distance(p, env.player) <= 320;
    if (gate)
      return inActivity(gate, p) || distance(p, xiaobaoGatePoint(gate)) <= 80;
    return this.data.task === "guard" || distance(p, anchor) <= 600;
  }
  travel(env: XiaobaoEnvironment, dt: number, budget: { queries: number }) {
    this.action = "idle";
    const anchor = this.anchor(env),
      front = this.fronts.find(
        (f) =>
          this.data.gate === "all" ||
          this.data.gate === f.gate ||
          this.support?.gate === f.gate,
      );
    let destination: Point = anchor,
      speed = 170;
    const target = env.enemies.find(
      (e) => e.id === this.targetId && e.hp > 0 && !e.disabled,
    );
    if (target) {
      this.regrouping = false;
      destination = target;
      speed = 230;
      this.status = "就近护卫";
      if (distance(this, target) < 80) return;
    } else if (this.support || (front && this.data.task !== "follow")) {
      destination = front?.point ?? anchor;
      speed = 420;
    } else if (this.data.task === "follow" && !this.data.life.emergency) {
      this.status = this.data.wait ? "原地等候" : "留距巡护";
      if (this.data.wait) {
        destination = this.data.wait;
        if (distance(this, destination) < 10) return;
      } else {
        const gap = distance(this, env.player);
        // 留出护卫空间；越出距离带才归队，停在带内后不跟着微小移动抖动。
        if (gap < 120 || gap > 220) this.regrouping = true;
        if (Math.abs(gap - 160) < 8) this.regrouping = false;
        if (!this.regrouping) return;
        const angle = gap > 0.001 ? Math.atan2(this.y - env.player.y, this.x - env.player.x) : 0;
        destination = [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, Math.PI]
          .map(turn => ({ x: env.player.x + Math.cos(angle + turn) * 160,
            y: env.player.y + Math.sin(angle + turn) * 160 }))
          .find(p => !(env.blocked?.(p) ?? motionBlocked(p.x, p.y))) ?? env.player;
        speed = gap > 360 ? 280 : 170;
      }
    } else if (this.data.task === "guard" && this.data.gate === "all") {
      const route = XIAOBAO_ROADS.patrol;
      destination = route[this.patrol % route.length];
      speed = 90;
      if (distance(this, destination) < 12) {
        this.patrol++;
        return;
      }
    } else if (distance(this, anchor) < 10) return;
    // 正式村道长途先到近处路点，再在480局部半径内绕障。
    destination = this.route(destination, env);
    const gate =
        this.support?.gate ??
        (this.data.task === "follow" ? undefined : this.data.gate === "all" ? front?.gate : this.data.gate),
      travelAnchor = gate ? xiaobaoGatePoint(gate) : anchor;
    const entering =
        (!!gate && !inActivity(gate, this) && distance(this, travelAnchor) > 80) ||
        (this.data.task === "follow" && !this.support && !this.allowed(this, env, anchor, gate)),
      bound = distance(this, travelAnchor) + 80;
    const old = point(this),
      allowed = (p: Point) =>
        !target ||
        (entering
          ? distance(p, travelAnchor) <= bound
          : this.allowed(p, env, anchor, gate));
    env.move(
      this,
      this.nav,
      destination,
      speed,
      dt / 1000,
      budget,
      allowed,
      env.allies.filter((a) => a.id !== "xiaobao"),
    );
    const dx = this.x - old.x,
      dy = this.y - old.y;
    this.motion.update({ dx, dy, dt: dt / 1000 });
    if (Math.hypot(dx, dy) > 0.001) {
      this.facing = this.motion.direction;
      this.action =
        this.facing === 0
          ? "walkDown"
          : this.facing === 1
            ? "walkUp"
            : "walkSide";
      this.stuck = 0;
      this.status =
        speed >= 420 ? "赶赴防线" : speed >= 280 ? "风行追赶" : "归队／巡护";
    } else {
      this.stuck += dt;
      this.action = "idle";
      if (this.stuck >= 2000) {
        this.nav.path = [];
        this.nav.target = undefined;
        this.nav.next = 0;
        this.status = "小宝正在找路";
        this.stuck = 0;
      }
    }
  }
  route(goal: Point, env: Pick<XiaobaoEnvironment,'clear'>) {
    if (
      distance(this, goal) < 430 ||
      (env.clear ?? clearMotionLine)(this, goal)
    ) {
      this.road = [];
      this.roadGoal = null;
      return goal;
    }
    if (!this.roadGoal || distance(goal, this.roadGoal) > 120) {
      this.road = [];
      this.roadGoal = point(goal);
    }
    while (this.road.length && distance(this, this.road[0]) < 26)
      this.road.shift();
    if (this.road.length) return this.road[0];
    // 连通村道骨架，按目标方向选择相邻节点；局部路径仍使用共享查询预算。
    const nodes = XIAOBAO_ROADS.nodes;
    const nearest = nodes.reduce((a, b) =>
      distance(this, a) < distance(this, b) ? a : b,
    );
    const links = XIAOBAO_ROADS.links;
    const start = nodes.indexOf(nearest),
      end = nodes.indexOf(
        nodes.reduce((a, b) => (distance(goal, a) < distance(goal, b) ? a : b)),
      );
    const queue = [[start]],
      seen = new Set([start]);
    while (queue.length) {
      const path = queue.shift()!,
        last = path[path.length - 1];
      if (last === end) {
        this.road = path.map((i) => nodes[i]);
        while (this.road.length && distance(this, this.road[0]) < 26)
          this.road.shift();
        return this.road[0] ?? goal;
      }
      for (const [a, b] of links) {
        const next = a === last ? b : b === last ? a : -1;
        if (next >= 0 && !seen.has(next)) {
          seen.add(next);
          queue.push([...path, next]);
        }
      }
    }
    return goal;
  }
  tick(dt: number, env: XiaobaoEnvironment, budget: { queries: number }) {
    if (!(dt > 0) || !Number.isFinite(dt)) return;
    let left = dt;
    let lifeMoved=false;
    while (left > 1e-7) {
      const slice = Math.min(5, left),
        priorCast = this.data.cast,
        priorFlight = this.data.flight;
      left -= slice;
      this.now = env.now - left;
      this.metrics.steps++;
      this.data.clock += slice;
      for (const skill of Object.keys(SKILLS) as XiaobaoSkill[])
        this.data.cooldowns[skill] = Math.max(
          0,
          this.data.cooldowns[skill] - slice,
        );
      this.data.recovery = Math.max(0, this.data.recovery - slice);
      this.data.reduction = Math.max(0, this.data.reduction - slice);
      this.data.shields = this.data.shields.filter((s) => {
        s.remaining = Math.max(0, s.remaining - slice);
        return s.remaining > 0;
      });
      if (this.data.command) {
        this.data.command.remaining -= slice;
        if (this.data.command.remaining <= 0) {
          this.data.command = null;
          env.message("指令等待超过5秒，已取消。");
        }
      }
      if (
        this.data.wait &&
        (!env.player.outside || env.player.region !== this.data.wait.region)
      )
        this.data.wait = null;
      if (
        this.data.task === "follow" &&
        !env.player.outside &&
        this.data.cast &&
        !this.data.cast.released
      )
        this.cancel();
      this.visuals = this.visuals.filter((e) => this.data.clock - e.at < 800);
      if (this.data.clock >= this.nextDecision) {
        this.nextDecision = this.data.clock + 150;
        this.choose(env);
      }
      if (this.data.rest) {
        this.effectsTick(slice, env);
        this.data.rest = Math.max(0, this.data.rest - slice);
        this.status = "护风调息";
        if (!this.data.rest) {
          this.data.hp = 320;
          this.data.qi = 50;
          this.data.recovery = 1000;
          const safe = this.data.space==='village' ? this.landingPoints(this, env)[0] : undefined;
          if (safe) {
            this.x = safe.x;
            this.y = safe.y;
          }
          this.emit({
            id: `recover:${this.data.serial}`,
            kind: "recover",
            skill: "guard",
            point: point(this),
          });
        }
        continue;
      }
      if (this.data.flight) {
        this.effectsTick(slice, env);
        if (this.data.flight === priorFlight) this.flightTick(slice, env);
        continue;
      }
      if(this.demonstration&&!this.data.life.emergency){
        super.update(slice,env.minute,env.clear??clearMotionLine);
        continue;
      }
      if(this.data.space!=='village'){
        if(!lifeMoved){env.lifeMove?.(dt,budget);lifeMoved=true;}
        continue;
      }
      const fighting =
        !!this.targetId ||
        env.allies.some((a) => a.threatAt !== null && distance(this, a) < 600);
      this.data.peace = fighting ? 0 : Math.min(6000, this.data.peace + slice);
      this.data.qi = Math.min(
        100,
        this.data.qi + ((fighting ? 6 : 10) * slice) / 1000,
      );
      if (this.data.peace >= 6000)
        this.data.hp = Math.min(640, this.data.hp + (9.6 * slice) / 1000);
      if (this.data.support) {
        this.data.support.age += slice;
        const matching = this.fronts.find(
          (f) => f.gate === this.data.support!.gate,
        );
        if (matching) {
          this.data.support.injured ||= matching.injured;
          this.data.support.age = 0;
        } else if (!this.data.life.emergency && this.data.support.age >= 1500) {
          const s = this.data.support;
          this.data.reports.push({
            event: s.key,
            gate: s.gate,
            hits: s.hits,
            kills: s.kills,
            injured: s.injured,
            result: s.hits ? "威胁已解除" : "查探后归队",
            time: env.minute,
          });
          this.data.reports = this.data.reports.slice(-10);
          this.data.support = null;
          this.targetId = null;
        }
      }
      if (this.data.cast) {
        if (this.data.cast === priorCast) this.castTick(slice, env);
        this.effectsTick(slice, env);
        continue;
      }
      this.effectsTick(slice, env);
      if (this.data.recovery > 0) continue;
      if(env.lifeMove && this.data.task==='free' && !this.data.life.emergency && !this.targetId && !this.data.support && !this.demonstration && !this.data.effects.length){
        if(!lifeMoved){env.lifeMove(dt,budget);lifeMoved=true;}
      }else if (
        this.data.task === "free" &&
        !this.data.support &&
        !this.data.life.emergency &&
        !this.targetId &&
        distance(this, XIAOBAO.home) < 180
      ) {
        super.update(slice, env.minute, env.clear ?? clearMotionLine);
        this.status = this.night ? "安心小憩" : "听风待机";
      } else this.travel(env, slice, budget);
    }
    this.data.x = this.x;
    this.data.y = this.y;
  }
  get battleAction(): {
    clip: XiaobaoBattleClip;
    progress: number;
    lift: number;
  } | null {
    const f = this.data.flight;
    if (f)
      return {
        clip:
          f.stage === "takeoff"
            ? "takeoff"
            : f.stage === "landing"
              ? "landing"
              : "cruise",
        progress:
          f.stage === "takeoff"
            ? f.age / 200
            : f.stage === "landing"
              ? f.age / 250
              : (f.age % 600) / 600,
        lift:
          f.stage === "takeoff"
            ? (88 * f.age) / 200
            : f.stage === "landing"
              ? 88 * (1 - f.age / 250)
              : 88,
      };
    if (this.data.rest)
      return {
        clip: "rest",
        progress: (this.data.clock % 1600) / 1600,
        lift: 0,
      };
    if (this.data.recovery > 500)
      return {
        clip: "recover",
        progress: 1 - this.data.recovery / 1000,
        lift: 0,
      };
    if (this.data.clock < this.hurtUntil)
      return {
        clip: "hurt",
        progress: 1 - (this.hurtUntil - this.data.clock) / 180,
        lift: 0,
      };
    if (this.data.cast)
      return {
        clip: this.data.cast.skill,
        progress: this.data.cast.age / SKILLS[this.data.cast.skill].recovery,
        lift:
          this.data.cast.skill === "rescue"
            ? Math.sin((Math.PI * this.data.cast.age) / 480) * 10
            : 0,
      };
    if (this.status.includes("追赶") || this.status.includes("防线"))
      return {
        clip: "chase",
        progress: (this.motion.distance % 42) / 42,
        lift: 0,
      };
    return null;
  }
  override get pose() {
    const action = this.battleAction;
    return action
      ? {
          ...xiaobaoBattlePose(action.clip, action.progress, this.facing),
          lift: action.lift,
        }
      : super.pose;
  }
  override get flip() {
    return this.battleAction ? this.facing === 2 : super.flip;
  }
  override snapshot() {
    return {
      ...super.snapshot(),
      space:this.data.space,
      life:this.data.life,
      state: structuredClone(this.data),
      status: this.status,
      airborne: this.airborne,
      battleAction: this.battleAction,
      targetId: this.targetId,
      metrics: { ...this.metrics },
      events: [...this.history],
      effects: structuredClone(this.data.effects),
      navigation: {
        path: this.nav.path,
        queries: this.nav.queries,
        failed: this.nav.failed,
      },
      eta: this.data.flight
        ? distance(this, this.data.flight.goal) / 1600 +
          (this.data.flight.stage === "takeoff"
            ? (200 - this.data.flight.age) / 1000
            : 0) +
          0.25
        : 0,
    };
  }
}
