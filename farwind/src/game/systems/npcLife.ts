import {stepXiaobaoLife} from './xiaobaoLife';
import {
  PEOPLE,
  person,
  LIFE,
  FACILITIES,
  HOMES,
  MAINTENANCE,
  PRIVATE_STORAGE,
  ACTION_LABELS,
  type ResidentId,
  type Place,
  type Activity,
  type SpaceId,
} from "../../data/npcLife";
import { GUARD_DEFS, RAID_GATES, type GuardId } from "../../data/defense";
import type { State } from "./state";
import type { EastDefense, DefenseNotice, DefenseHostile } from "./defense";
import type { GuardState } from "./defenseState";
import {
  type PersonState,
  type Action,
  type LifeEvent,
  type LifeTask,
  type Relation,
} from "./npcLifeState";
import {
  lifeNavigation,
  moveLife,
  distance,
  spaceClear,
  spaceBlocked,
  type LifeNav,
} from "./npcNavigation";
import { resolveDamage } from "./damage";
import { attackTouches, type EnemyContact } from "./enemyAttack";
import {validFungalBlastContact} from './fungalCombat';
import { clearMeleeLine } from "./obstacles";
import { chooseSpeech, type LifeSpeech } from "./npcSpeech";
import {
  socialCandidate,
  updateSocial,
  socialReady,
  finishSocial,
} from "./npcSocial";
export type Candidate = {
  kind: Activity;
  target: Place;
  facility: string | null;
  task: string | null;
  score: number;
  label: string;
  social?: Action["social"];
};
export class NpcLife {
  debugAlarmUntil = 0;
  navigation = new Map<string, LifeNav>();
  scores = new Map<string, Candidate[]>();
  metrics = { steps: 0, decisions: 0, queries: 0, ms: 0, maxMs: 0, xiaobaoDecisionMs:0, xiaobaoDecisionMaxMs:0, xiaobaoMoveMs:0, xiaobaoMoveMaxMs:0 };
  // 演武仍由小宝控制器执行，生活决策只读取这份暂态门禁。
  xiaobaoDemonstrating = false;
  messages: string[] = [];
  speech: LifeSpeech | null = null;
  constructor(
    public state: State,
    public defense: EastDefense,
  ) {
    this.restore();
  }
  get data() {
    return this.state.life;
  }
  rebind(state: State, defense = this.defense) {
    this.state = state;
    this.defense = defense;
    this.speech = null;
  }
  body(id: string): Place | null {
    if(id==='xiaobao')return {space:this.state.xiaobao.space,x:this.state.xiaobao.x,y:this.state.xiaobao.y};
    const n = this.data.people.find((n) => n.id === id);
    if (n?.body) return n.body;
    const g = this.state.defense.guards.find((g) => g.id === id);
    return g ? { space: g.space ?? "village", x: g.x, y: g.y } : null;
  }
  live(id: string) {
    if(id==='xiaobao')return this.state.xiaobao.hp>0&&!this.state.xiaobao.rest;
    const g = this.state.defense.guards.find((g) => g.id === id);
    return g
      ? !g.dead
      : this.data.people.find((n) => n.id === id)?.body?.health !== "down";
  }
  health(id: string) {
    if(id==='xiaobao')return this.state.xiaobao.hp/640*100;
    const n = this.data.people.find((n) => n.id === id);
    if (n?.body) return n.body.hp;
    const g = this.state.defense.guards.find((g) => g.id === id);
    return g ? (g.hp / GUARD_DEFS.find((d) => d.id === id)!.maxHP) * 100 : 100;
  }
  needsTreatment(id: string) {
    if(id==='xiaobao')return false;
    const body = this.data.people.find((n) => n.id === id)?.body;
    return body
      ? body.health === "hurt" || body.health === "down"
      : !this.state.defense.guards.find((g) => g.id === id)?.dead &&
          this.health(id) < 85;
  }
  nav(id: string) {
    let r = this.navigation.get(id);
    if (!r) {
      r = lifeNavigation();
      this.navigation.set(id, r);
    }
    return r;
  }
  carrying(n: PersonState) {
    return n.gear === "carried";
  }
  gearNeeded(n: PersonState, kind: Activity) {
    if(n.id==='xiaobao')return false;
    return n.id === "healer"
      ? ["work", "supply", "shelter", "treat", "escort"].includes(kind)
      : n.id === "carpenter"
        ? ["work", "repair", "habit"].includes(kind)
        : n.id === "elder"
          ? ["work", "habit"].includes(kind)
          : kind === "habit";
  }
  material(n: PersonState, kind: Activity) {
    return n.id === "healer" && kind === "treat"
      ? ("medicine" as const)
      : n.id === "carpenter" && kind === "repair"
        ? ("wood" as const)
        : null;
  }
  materialSource(material: "medicine" | "wood") {
    return FACILITIES.find(
      (f) => f.id === (material === "medicine" ? "pharmacy" : "tools"),
    )!.place;
  }
  materialReady(n: PersonState, kind: Activity) {
    const material = this.material(n, kind);
    if (!material) return true;
    const needed = material === "medicine" ? 1 : 2;
    return (
      n.supplies[material] >= needed ||
      (n.supplies[material] + this.data.stores[material] >= needed &&
        this.available(this.materialSource(material)) &&
        this.routeSafe(this.body(n.id)!, this.materialSource(material)))
    );
  }
  travelPhase(n: PersonState, a: Action) {
    const material = this.material(n, a.kind);
    const needed = material === "medicine" ? 1 : 2;
    a.phase = material && n.supplies[material] < needed ? "stock" : "travel";
    a.pickup =
      a.phase === "stock" ? { ...this.materialSource(material!) } : null;
    if (a.phase === "stock")
      a.facility = material === "medicine" ? "pharmacy" : "tools";
    else if (material) {
      this.data.reservations = this.data.reservations.filter(
        (r) => r.owner !== n.id,
      );
      a.facility = null;
    }
    a.progress = 0;
    this.navigation.delete(n.id);
  }
  available(place: Place) {
    return !this.data.unavailable.homes[place.space];
  }
  facilityFree(n: PersonState, id: string) {
    const f = FACILITIES.find((f) => f.id === id);
    return (
      !!f &&
      this.available(f.place) &&
      !this.data.unavailable.facilities.includes(id) &&
      this.data.reservations.filter(
        (r) =>
          r.facility === id &&
          r.owner !== n.id &&
          r.expires > this.data.elapsed,
      ).length < f.capacity
    );
  }
  beds(n: PersonState) {
    const own = FACILITIES.find((f) => f.id === person(n.id)!.bed)!,
      blockedHome = (space: SpaceId) =>
        n.blockedUntil > this.data.elapsed && n.blockedTarget?.space === space,
      usable = (f: typeof own) =>
        this.facilityFree(n, f.id) &&
        !blockedHome(f.place.space) &&
        this.routeSafe(this.body(n.id)!, f.place);
    if (usable(own)) return [own];
    return FACILITIES.filter((f) => f.kind === "bed" && !f.owner && usable(f));
  }
  storeCandidate(n: PersonState): Candidate | null {
    const box = PRIVATE_STORAGE.find((b) => b.owner === n.id)!;
    return this.carrying(n) &&
      this.available(box.use) &&
      !(
        n.blockedUntil > this.data.elapsed &&
        n.blockedTarget?.space === box.space
      ) &&
      this.routeSafe(this.body(n.id)!, box.use)
      ? {
          kind: "store",
          target: { ...box.use },
          facility: null,
          task: null,
          score: 100,
          label: `归还${box.item}到自己的储物箱`,
        }
      : null;
  }
  restore() {
    this.defense.eventTime = () => this.data.elapsed;
    this.defense.civilianTargets = () =>
      this.data.people.flatMap((n) =>
        n.body &&
        n.body.space === "village" &&
        n.body.hp > 0 &&
        n.body.health !== "down"
          ? [{ id: n.id, x: n.body.x, y: n.body.y, hp: n.body.hp }]
          : [],
      );
    this.defense.civilianContact = (id, source, contact) =>
      this.receiveHostileContact(id, source, contact);
    this.defense.facilityTargets = () =>
      MAINTENANCE.flatMap((f) =>
        this.data.facilities[f.id] > 0
          ? [
              {
                id: f.id,
                x: f.place.x,
                y: f.place.y,
                hp: this.data.facilities[f.id],
              },
            ]
          : [],
      );
    for (const n of this.data.people) {
      if (n.body && spaceBlocked(n.body.space, n.body.x, n.body.y)) {
        // 新空间只修复非法站位；已有室外阻挡由有限局部搜索恢复，不更改伤情。
        if (n.body.space !== "village")
          Object.assign(n.body, { x: 700, y: 910 });
      }
      if (!this.live(n.id)) this.cancel(n, "无法行动，等待救护");
      if (
        n.action &&
        n.action.kind !== "escort" &&
        this.gearNeeded(n, n.action.kind) &&
        !this.carrying(n) &&
        n.action.phase !== "collect"
      ) {
        n.action.pickup = {
          ...PRIVATE_STORAGE.find((b) => b.owner === n.id)!.use,
        };
        n.action.phase = "collect";
        n.action.progress = 0;
      }
      if (
        n.action &&
        ["travel", "perform"].includes(n.action.phase) &&
        this.carrying(n)
      ) {
        const material = this.material(n, n.action.kind);
        if (
          material &&
          n.supplies[material] < (material === "medicine" ? 1 : 2)
        )
          this.travelPhase(n, n.action);
      }
      if (
        n.action?.task &&
        !this.data.tasks.some((t) => t.id === n.action!.task)
      )
        this.cancel(n, "原任务已经结束");
    }
    this.defense.lifeMove = (g, target, ms, budget) => {
      const started = performance.now(),
        body = { space: g.space ?? "village", x: g.x, y: g.y },
        r = this.nav(g.id),
        old = { ...body },
        queries = r.queries;
      moveLife(
        body,
        target,
        ms,
        this.data.elapsed,
        budget,
        r,
        (q) => this.escapeStep(old, q),
        this.data.people
          .filter((n) => n.id !== g.id)
          .map((n) => this.body(n.id)!)
          .filter(Boolean),
        (space) => !this.data.unavailable.homes[space],
      );
      Object.assign(g, { x: body.x, y: body.y, space: body.space });
      const cost = performance.now() - started;
      this.metrics.ms += cost;
      this.metrics.maxMs = Math.max(this.metrics.maxMs, cost);
      this.metrics.queries += r.queries - queries;
      return distance(old, body);
    };
    this.syncGuardOrders();
  }
  safe(p: Place, margin: number = LIFE.dangerRadius) {
    return (
      p.space !== "village" ||
      !this.threats().some(
        (e) => e.hp > 0 && !e.disabled && distance(e, p) < margin,
      )
    );
  }
  // 驻防 hostiles 只含已接管的敌人；生活安全必须也看见附近未被卫兵接管的实体。
  threats() {
    return [...this.defense.enemies, ...this.defense.external].filter(
      (e) => e.hp > 0 && !e.disabled,
    );
  }
  routeSafe(a: Place, b: Place, margin: number = LIFE.dangerRadius) {
    if (!this.safe(b, margin)) return false;
    if (a.space !== b.space) return true;
    return !this.threats().some(
      (e) =>
        e.hp > 0 &&
        !e.disabled &&
        a.space === "village" &&
        this.segmentDistance(e, a, b) < margin &&
        distance(e, b) < distance(e, a),
    );
  }
  segmentDistance(p: Place | { x: number; y: number }, a: Place, b: Place) {
    const dx = b.x - a.x,
      dy = b.y - a.y,
      u = Math.max(
        0,
        Math.min(
          1,
          ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
        ),
      );
    return Math.hypot(p.x - a.x - dx * u, p.y - a.y - dy * u);
  }
  escapeStep(from: Place, next: Place) {
    return (
      this.safe(next, 70) ||
      (next.space === from.space &&
        this.threats().every(
          (e) =>
            e.hp <= 0 ||
            e.disabled ||
            distance(e, next) >= distance(e, from) - 0.001,
        ))
    );
  }
  relation(n: PersonState, id: string): Relation {
    return (n.relations[id] ??= {
      familiar: 0,
      trust: 0,
      wariness: 0,
      lastPositive: -1440,
    });
  }
  remember(n: PersonState, e: LifeEvent, source: "seen" | "alarm" | "report") {
    if (e.sequence <= n.receiptFloor || n.receipts.includes(e.sequence)) return;
    n.receipt = Math.max(n.receipt, e.sequence);
    n.receipts.push(e.sequence);
    n.receipts.sort((a, b) => a - b);
    if (n.receipts.length > LIFE.eventLimit)
      n.receiptFloor = n.receipts.shift()!;
    if (e.kind === "alarm") n.emotion = Math.max(n.emotion, 45);
    if (e.kind === "injury" || e.kind === "death")
      n.emotion = Math.max(n.emotion, 70);
    if (e.kind === "care" || e.kind === "clear")
      n.emotion = Math.max(0, n.emotion - 20);
    n.memories.push({
      eventId: e.id,
      sequence: e.sequence,
      kind: e.kind,
      time: e.time,
      subjects: e.subjects,
      result: e.result,
      source,
      importance: ["care", "death", "help"].includes(e.kind) ? 80 : 40,
      expires: e.time + (["death", "help"].includes(e.kind) ? 14400 : 4320),
    });
    if (n.memories.length > LIFE.memoryLimit)
      n.memories.splice(0, n.memories.length - LIFE.memoryLimit);
    if (["care", "help"].includes(e.kind) && e.subjects.includes(n.id)) {
      const r = this.relation(n, e.source);
      if (e.time - r.lastPositive >= 120) {
        r.trust = Math.min(100, r.trust + 8);
        r.familiar = Math.min(100, r.familiar + 4);
        r.lastPositive = e.time;
      }
    }
    if (e.kind === "company" && e.subjects.includes(n.id)) {
      const partner =
        e.source === n.id ? e.subjects.find((id) => id !== n.id) : e.source;
      if (partner && person(partner)) {
        const r = this.relation(n, partner);
        if (e.time - r.lastPositive >= LIFE.socialRelationMinutes) {
          r.trust = Math.min(100, r.trust + LIFE.socialTrustGain);
          r.familiar = Math.min(100, r.familiar + LIFE.socialFamiliarGain);
          r.lastPositive = e.time;
        }
      }
    }
    if (e.kind === "visit" && e.subjects.includes(n.id)) {
      const r = this.relation(n, "player");
      r.wariness = Math.min(100, r.wariness + 3);
    }
  }
  emit(
    kind: LifeEvent["kind"],
    place: Place,
    source: string,
    subjects: string[],
    result: string,
    debug = false,
  ) {
    const l = this.data,
      e: LifeEvent = {
        id: `life:${++l.sequence}`,
        sequence: l.sequence,
        time: this.state.time,
        kind,
        place: { ...place },
        source,
        subjects,
        result,
        debug,
      };
    l.events.push(e);
    if (l.events.length > LIFE.eventLimit) l.events.shift();
    for (const n of l.people) {
      const p = this.body(n.id);
      if (!p) continue;
      const heard =
        ["alarm", "clear"].includes(kind) &&
        distance(
          p.space === "village" ? p : HOMES.find((h) => h.id === p.space)!.door,
          place,
        ) < 1400;
      const seen =
        p.space === place.space &&
        distance(p, place) < LIFE.observation &&
        spaceClear(p.space, p, place);
      if (heard || seen || subjects.includes(n.id)) {
        this.remember(n, e, heard ? "alarm" : "seen");
        if (seen && ["injury", "down"].includes(kind)) {
          for (const id of subjects)
            n.known[id] = { ...place, time: this.state.time };
          n.nextDecision = l.elapsed;
        }
        if (heard) {
          n.alarm = l.alarm;
          n.nextDecision = l.elapsed;
        }
      }
    }
    return e;
  }
  report(from: ResidentId, to: ResidentId, eventId: string) {
    const sender = this.data.people.find((n) => n.id === from)!,
      receiver = this.data.people.find((n) => n.id === to)!,
      a = this.body(from)!,
      b = this.body(to)!;
    const e = this.data.events.find((e) => e.id === eventId);
    if (
      !e ||
      !sender.memories.some((m) => m.eventId === eventId) ||
      a.space !== b.space ||
      distance(a, b) > 90 ||
      !spaceClear(a.space, a, b)
    )
      return false;
    this.remember(receiver, e, "report");
    if (["injury", "down"].includes(e.kind))
      for (const id of e.subjects)
        receiver.known[id] = { ...e.place, time: e.time };
    return true;
  }
  treatmentPlace(n: PersonState, t: LifeTask): Place | null {
    const known = n.known[t.subject];
    if (
      !known ||
      known.time + LIFE.injuryKnownMinutes < this.state.time ||
      !n.memories.some(
        (m) =>
          ["injury", "down"].includes(m.kind) && m.subjects.includes(t.subject),
      )
    )
      return null;
    const observer = this.body(n.id)!,
      target = this.body(t.subject);
    if (
      target &&
      target.space === observer.space &&
      distance(observer, target) < LIFE.observation &&
      spaceClear(observer.space, observer, target)
    ) {
      n.known[t.subject] = { ...target, time: this.state.time };
      return { ...target };
    }
    if (
      n.action?.task === t.id &&
      n.action.kind === "treat" &&
      n.action.failures === 1
    )
      return {
        ...FACILITIES.find((f) => f.id === person(t.subject)!.bed)!.place,
      };
    return { space: known.space, x: known.x, y: known.y };
  }
  consumeDefense(events: readonly DefenseNotice[]) {
    for (const e of events) {
      const g = this.state.defense.guards.find((g) => g.id === e.id);
      if (!g) continue;
      const key = e.eventKey ?? `${e.kind}:${e.id}:${e.at}:${e.sourceId ?? ""}`;
      if (this.data.defenseReceipts.includes(key)) continue;
      this.data.defenseReceipts.push(key);
      if (this.data.defenseReceipts.length > 80)
        this.data.defenseReceipts.shift();
      const p = { ...this.body(g.id)!, x: e.x ?? g.x, y: e.y ?? g.y };
      if (e.kind === "hit") {
        const event = this.emit(
          "injury",
          p,
          e.sourceId ?? "enemy",
          [g.id],
          "驻防战斗受伤",
        );
        const medic = this.data.people.find((n) => n.id === "healer")!,
          mp = this.body("healer")!,
          ear =
            mp.space === "village"
              ? mp
              : HOMES.find((h) => h.id === mp.space)!.door;
        if (!g.dead && distance(p, ear) < 1400) {
          this.remember(medic, event, "report");
          medic.known[g.id] = { ...p, time: this.state.time };
          this.ensureTask("treat", g.id, p);
        }
      }
      if (e.kind === "death") {
        this.emit("death", p, e.sourceId ?? "enemy", [g.id], "守卫阵亡");
        this.data.tasks = this.data.tasks.filter((t) => t.subject !== g.id);
      }
    }
  }
  ensureTask(kind: "treat" | "repair", subject: string, place: Place) {
    const l = this.data;
    const existing = l.tasks.find(
      (t) => t.kind === kind && t.subject === subject,
    );
    if (existing) {
      existing.place = { ...place };
      return;
    }
    if (l.tasks.length >= LIFE.taskLimit) return;
    l.tasks.push({
      id: `${kind}:${subject}:${l.sequence}`,
      kind,
      subject,
      place: { ...place },
      owner: null,
      expires: 0,
      attempts: 0,
      retryAt: 0,
    });
  }
  claim(n: PersonState, t: LifeTask) {
    if ((t.owner && t.owner !== n.id) || t.retryAt > this.data.elapsed)
      return false;
    t.owner = n.id;
    t.expires = this.data.elapsed + LIFE.taskLeaseMs;
    return true;
  }
  reserve(n: PersonState, id: string) {
    const l = this.data,
      f = FACILITIES.find((f) => f.id === id);
    if (
      !f ||
      (f.kind === "bed" && f.owner && f.owner !== n.id) ||
      !this.facilityFree(n, id)
    )
      return false;
    l.reservations = l.reservations.filter((r) => r.expires > l.elapsed);
    const own = l.reservations.find(
      (r) => r.facility === id && r.owner === n.id,
    );
    if (own) {
      own.expires = l.elapsed + LIFE.reservationMs;
      return true;
    }
    if (l.reservations.filter((r) => r.facility === id).length >= f.capacity)
      return false;
    l.reservations.push({
      facility: id,
      owner: n.id,
      expires: l.elapsed + LIFE.reservationMs,
    });
    return true;
  }
  cancel(n: PersonState, reason: string) {
    const l = this.data;
    l.reservations = l.reservations.filter((r) => r.owner !== n.id);
    const t = l.tasks.find((t) => t.owner === n.id);
    if (t) {
      t.owner = null;
      t.expires = 0;
      t.attempts = Math.min(1000, t.attempts + 1);
      t.retryAt = l.elapsed + 3000;
    }
    n.action = null;
    n.reason = reason;
    n.nextDecision = l.elapsed + LIFE.decisionMs;
    // 中断只释放行动和预约；已拿到手的私人物品不会凭空回到家。
    this.navigation.delete(n.id);
  }
  begin(n: PersonState, c: Candidate) {
    const box = PRIVATE_STORAGE.find((b) => b.owner === n.id)!,
      canCollect =
        this.available(box.use) &&
        !(
          n.blockedUntil > this.data.elapsed &&
          n.blockedTarget?.space === box.space
        );
    if (
      !this.available(c.target) ||
      !this.materialReady(n, c.kind) ||
      (this.gearNeeded(n, c.kind) &&
        !this.carrying(n) &&
        !canCollect &&
        c.kind !== "shelter")
    )
      return false;
    if (c.task) {
      const t = this.data.tasks.find((t) => t.id === c.task);
      if (!t || !this.claim(n, t)) return false;
    }
    if (c.facility && !this.reserve(n, c.facility)) {
      const t = this.data.tasks.find((t) => t.id === c.task);
      if (t) t.owner = null;
      return false;
    }
    const duration =
      c.kind === "store"
        ? LIFE.transferMs
        : c.kind === "treat"
          ? LIFE.treatMs
          : c.kind === "repair"
            ? LIFE.repairMs
            : c.kind === "work" || c.kind === "habit"
              ? LIFE.workMs
              : LIFE.minActionMs;
    const collect =
      this.gearNeeded(n, c.kind) && !this.carrying(n) && canCollect;
    const pickup = collect
      ? { ...PRIVATE_STORAGE.find((b) => b.owner === n.id)!.use }
      : null;
    let target = { ...c.target };
    if (c.facility) {
      const f = FACILITIES.find((f) => f.id === c.facility)!;
      if (f.capacity > 1) {
        const index = this.data.reservations
          .filter((r) => r.facility === c.facility)
          .findIndex((r) => r.owner === n.id);
        target.x += (index % 2) * 32 - 16;
        target.y += Math.floor(index / 2) * 30;
      }
    }
    n.action = {
      id: ++n.serial,
      kind: c.kind,
      target,
      pickup,
      facility: c.facility,
      task: c.task,
      phase: collect ? "collect" : "travel",
      progress: 0,
      duration,
      started: this.data.elapsed,
      failures: 0,
      label: c.label,
      social: c.social ?? null,
    };
    if (!collect) this.travelPhase(n, n.action);
    n.reason = `${c.label}（评分 ${Math.round(c.score)}）`;
    return true;
  }
  candidates(n: PersonState): Candidate[] {
    const d = person(n.id)!,
      p = this.body(n.id)!,
      l = this.data,
      minute = this.state.time % 1440,
      list: Candidate[] = [],
      add = (
        kind: Activity,
        target: Place,
        score: number,
        label: string,
        facility: string | null = null,
        task: string | null = null,
      ) => {
        if (
          !(
            n.blockedTarget &&
            n.blockedUntil > l.elapsed &&
            n.blockedTarget.space === target.space &&
            distance(n.blockedTarget, target) < 25
          ) &&
          this.safe(
            target,
            n.id === "healer" ? LIFE.dangerRadius + 40 : LIFE.dangerRadius,
          ) &&
          this.available(target) &&
          (!facility || this.facilityFree(n, facility)) &&
          this.routeSafe(p, target, 70)
        )
          list.push({
            kind,
            target: { ...target },
            score:
              score -
              distance(p, target) * 0.018 -
              (p.space === target.space ? 0 : 8),
            label,
            facility,
            task,
          });
      };
    const danger =
      p.space === "village" &&
      !this.safe(p, person(n.id)!.traits.fear * 110 + 100 + n.emotion * 0.5);
    if (n.alarm === 2 || danger) {
      for (const f of FACILITIES.filter((f) => f.kind === "shelter"))
        add(
          n.id === "elder" ? "count" : "shelter",
          f.place,
          180 +
            d.traits.fear * 30 +
            (n.id === "elder" && f.id === "assembly" ? d.traits.duty * 25 : 0),
          n.id === "elder"
            ? "在集结处清点、报告失联者"
            : "带必需品前往安全集结处",
          f.id,
        );
      if (n.id === "healer")
        for (const t of l.tasks.filter(
          (t) => t.kind === "treat" && (!t.owner || t.owner === n.id),
        ))
          if (this.materialReady(n, "treat") && this.treatmentPlace(n, t))
            add(
              "treat",
              this.treatmentPlace(n, t)!,
              205 + d.traits.compassion * 35 - d.traits.fear * 20,
              "安全路线救护",
              null,
              t.id,
            );
      return list;
    }
    if (n.body?.health === "convalescent" || n.body?.health === "hurt")
      for (const bed of this.beds(n))
        add(
          "rest",
          bed.place,
          145,
          bed.owner ? "伤后休养" : "住所不可用，到旅馆备用床休养",
          bed.id,
        );
    for (const t of l.tasks.filter(
      (t) => (!t.owner || t.owner === n.id) && t.retryAt <= l.elapsed,
    )) {
      if (
        t.kind === "treat" &&
        d.ability.medicine &&
        this.materialReady(n, "treat") &&
        this.treatmentPlace(n, t)
      )
        add(
          "treat",
          this.treatmentPlace(n, t)!,
          140 + d.traits.compassion * 30 - d.traits.fear * 10,
          "带药箱救护",
          null,
          t.id,
        );
      if (
        t.kind === "repair" &&
        d.ability.repair &&
        this.materialReady(n, "repair") &&
        (n.memories.some((m) => m.subjects.includes(t.subject)) ||
          (p.space === t.place.space &&
            distance(p, t.place) < LIFE.observation &&
            spaceClear(p.space, p, t.place)))
      )
        add(
          "repair",
          t.place,
          125 + d.traits.duty * 30,
          "带工具与木料维修",
          null,
          t.id,
        );
    }
    if (n.needs.hunger > 65 && l.stores.food > 0)
      add(
        "eat",
        FACILITIES.find((f) => f.id === `seat:${d.home}`)!.place,
        95 + n.needs.hunger,
        "吃家庭储备",
        `seat:${d.home}`,
      );
    if (n.needs.fatigue > 80)
      for (const bed of this.beds(n))
        add(
          "sleep",
          bed.place,
          100 + n.needs.fatigue,
          bed.owner ? "疲劳休息" : "旅馆备用床补眠",
          bed.id,
        );
    const window = d.schedule.find((s) => minute >= s.from && minute < s.to);
    const company = socialCandidate(this, n);
    if (company) list.push(company);
    if (window) {
      let allowed = true;
      if (
        window.facility === "pharmacy" &&
        window.activity === "work" &&
        (l.stores.herbs < 2 ||
          l.stores.medicine +
            l.people.find((n) => n.id === "healer")!.supplies.medicine >=
            LIFE.maxMedicine)
      )
        allowed = false;
      const recent = n.memories.some(
        (m) =>
          (m.kind === "injury" ||
            (m.kind === "alarm" && m.result.startsWith("居民区威胁"))) &&
          m.time + 1440 > this.state.time,
      );
      if (
        recent &&
        n.id === "healer" &&
        window.place.space === "village" &&
        window.from >= 840
      )
        add(
          "habit",
          FACILITIES.find((f) => f.id === "pharmacy")!.place,
          85,
          "近日遇险，留在药房画图鉴",
          "pharmacy",
        );
      else if (window.activity === "sleep")
        for (const bed of this.beds(n))
          add(
            "sleep",
            bed.place,
            90,
            bed.owner ? window.label : "住所不可用，前往旅馆备用床",
            bed.id,
          );
      else if (allowed)
        add(
          window.activity === "eat" &&
            n.lastMealDay === Math.floor(this.state.time / 1440)
            ? "rest"
            : window.activity,
          window.place,
          80 +
            (window.activity === "habit"
              ? d.traits.curiosity * 20
              : d.traits.duty * 10),
          window.label,
          window.facility ?? null,
        );
    }
    if (
      window &&
      ["sleep", "eat", "rest"].includes(window.activity) &&
      n.body?.health === "healthy"
    ) {
      const store = this.storeCandidate(n);
      if (store)
        add(
          store.kind,
          store.target,
          store.score + (window.activity === "sleep" ? 100 : 0),
          store.label,
        );
    }
    add(
      "rest",
      FACILITIES.find((f) => f.id === `seat:${d.home}`)!.place,
      20,
      "窗口错过或设施忙，回家等待",
      `seat:${d.home}`,
    );
    add("rest", p, 10, "原地安全等候");
    return list;
  }
  guardAlert(id: GuardId) {
    const post = GUARD_DEFS.find((d) => d.id === id)!.post;
    return (
      this.data.alarm === 2 ||
      this.state.defense.raid?.gateId.split("-")[0] === id.split("-")[0] ||
      // 黄昏计划先召回目标门轮休者；若只等待预警，离岗会反过来阻止预警准入。
      (this.state.night.plan?.outcome === "pending" &&
        this.state.night.plan.gate.split("-")[0] === id.split("-")[0]) ||
      this.threats().some((e) => distance(e, post) < LIFE.gateAlertRadius)
    );
  }
  guardCanLeave(id: GuardId) {
    const prefix = id.split("-")[0],
      group = this.state.defense.guards.filter((g) => g.id.startsWith(prefix));
    const ready = group.filter(
      (g) =>
        !g.dead &&
        !g.offDuty &&
        (g.space ?? "village") === "village" &&
        g.hp >= GUARD_DEFS.find((d) => d.id === g.id)!.maxHP * 0.65,
    ).length;
    return (
      !this.guardAlert(id) &&
      group.filter((g) => g.offDuty).length < LIFE.maxGateAway &&
      ready > LIFE.minGateReady
    );
  }
  decide(n: PersonState) {
    const l = this.data,
      d = person(n.id)!,
      g = this.state.defense.guards.find((g) => g.id === n.id);
    this.metrics.decisions++;
    if (g) {
      if (g.dead) {
        this.cancel(n, "已阵亡");
        return;
      }
      if (g.mode === "return") {
        if (n.action) this.cancel(n, "返岗途中，完成前不重新领取轮休");
        n.reason =
          this.nav(n.id).stuck > LIFE.routeStuckMs
            ? "返岗通路受阻，安全等待并按预算重新规划"
            : "沿原路返回岗位";
        return;
      }
      if (n.action?.kind === "escort" && !this.guardAlert(g.id)) {
        n.reason = "救护协作优先，完成后沿路返岗";
        return;
      }
      const window = d.schedule.find(
        (s) =>
          this.state.time % 1440 >= s.from && this.state.time % 1440 < s.to,
      );
      if (this.guardAlert(g.id) || window?.activity === "duty" || !window) {
        if (n.action) this.cancel(n, "警戒或轮休结束，沿路召回");
        this.defense.recallGuard(g.id);
        n.reason = "值守或沿路返回岗位";
        return;
      }
      if (!g.offDuty && !this.guardCanLeave(g.id)) {
        n.reason = "守备不足或同门有人轮休，推迟离岗";
        return;
      }
      let c: Candidate = {
        kind: window.activity,
        target: window.place,
        facility: window.facility ?? null,
        task: null,
        score: 80,
        label: window.label,
      };
      if (window.activity === "habit" && d.traits.duty > 0.9)
        c = {
          kind: "habit",
          target: {
            space: "village",
            ...GUARD_DEFS.find((def) => def.id === g.id)!.post,
          },
          facility: null,
          task: null,
          score: 110,
          label: "下岗后检查村门装备",
        };
      if (window.activity === "habit" && d.traits.curiosity > 0.8) {
        const known = n.known.healer;
        if (
          known &&
          known.time + 120 > this.state.time &&
          this.routeSafe(this.body(n.id)!, known)
        )
          c = {
            kind: "talk",
            target: known,
            facility: null,
            task: null,
            score: 105,
            label: "休班与药师聊近日见闻",
          };
      }
      if (window.activity === "habit" && d.traits.compassion > 0.7) {
        c = socialCandidate(this, n) ?? c;
      }
      if (
        window.activity === "habit" &&
        d.traits.fear > 0.6 &&
        this.threats().some((e) => e.hp > 0 && distance(e, window.place) < 450)
      )
        c = {
          kind: "habit",
          target: FACILITIES.find((f) => f.id === d.bed)!.place,
          facility: d.bed,
          task: null,
          score: 110,
          label: "谨慎留在营房整理箭羽",
        };
      if (n.needs.hunger > 65 && this.data.stores.food > 0)
        c = {
          kind: "eat",
          target: FACILITIES.find((f) => f.id === "seat:barracks")!.place,
          facility: "seat:barracks",
          task: null,
          score: 120,
          label: "轮休时用餐",
        };
      if (c.kind === "sleep") {
        const bed = this.beds(n)[0];
        if (!bed) {
          if (n.action) this.cancel(n, "床位或备用住所均不可用，沿路返岗");
          if (g.offDuty) this.defense.recallGuard(g.id);
          n.reason = "没有安全空床，暂停本次普通轮休";
          return;
        }
        c.target = bed.place;
        c.facility = bed.id;
        if (!bed.owner) c.label = "营房不可用，前往旅馆备用床轮休";
      }
      if (["sleep", "eat"].includes(c.kind)) c = this.storeCandidate(n) ?? c;
      if (
        n.blockedUntil > l.elapsed &&
        n.blockedTarget?.space === c.target.space &&
        distance(n.blockedTarget, c.target) < 20
      ) {
        n.reason = "轮休路线受阻，暂停领取并等待通路恢复";
        return;
      }
      // 同名习惯也要检查地点，旧档的共用落脚点不能覆盖更新后的个人日程。
      if (
        n.action?.kind === c.kind &&
        n.action.label === c.label &&
        g.offDuty &&
        (c.kind !== "habit" ||
          (n.action.target.space === c.target.space &&
            distance(n.action.target, c.target) <= 8))
      )
        return;
      if (n.action) this.cancel(n, "轮休日程改变");
      if (this.begin(n, c)) this.defense.leaveGuard(g.id);
      else {
        n.reason = "轮休设施或私人物品不可用，保留岗位职责";
        if (g.offDuty) this.defense.recallGuard(g.id);
      }
      return;
    }
    if (n.body?.health === "down") {
      this.cancel(n, "失去行动能力，等待救护");
      return;
    }
    const candidates = this.candidates(n).sort((a, b) => b.score - a.score);
    this.scores.set(n.id, candidates);
    const a = n.action,
      current = candidates.find(
        (c) => c.kind === a?.kind && c.label === a?.label,
      ),
      top = candidates[0];
    if (
      a &&
      current &&
      (l.elapsed - a.started < LIFE.minActionMs ||
        current.score + 12 >= (top?.score ?? 0))
    )
      return;
    if (a) this.cancel(n, "目标失效或重新评估");
    for (const c of candidates) if (this.begin(n, c)) break;
  }
  complete(n: PersonState, a: Action) {
    if (
      a !== n.action ||
      a.id <= n.committed ||
      a.phase !== "perform" ||
      a.progress < a.duration ||
      (a.social && !socialReady(this, n, a)) ||
      this.body(n.id)?.space !== a.target.space ||
      distance(this.body(n.id)!, a.target) > (a.kind === "treat" ? 45 : 35) ||
      (a.kind === "treat" &&
        !spaceClear(a.target.space, this.body(n.id)!, a.target)) ||
      (this.gearNeeded(n, a.kind) && !this.carrying(n) && a.kind !== "shelter")
    )
      return;
    n.committed = a.id;
    const l = this.data;
    if (a.kind === "store") {
      const box = PRIVATE_STORAGE.find((b) => b.owner === n.id)!;
      if (
        a.target.space === box.use.space &&
        distance(this.body(n.id)!, box.use) < 6
      )
        n.gear = "locker";
    }
    if (
      a.kind === "work" &&
      n.id === "healer" &&
      a.facility === "pharmacy" &&
      l.stores.herbs >= 2 &&
      l.stores.medicine +
        l.people.find((n) => n.id === "healer")!.supplies.medicine <
        LIFE.maxMedicine
    ) {
      l.stores.herbs -= 2;
      l.stores.medicine++;
    }
    if (
      (a.kind === "work" &&
        n.id === "healer" &&
        a.target.space === "village") ||
      (a.kind === "supply" && n.id === "healer")
    ) {
      const day = Math.floor(this.state.time / 1440) + 1;
      if (n.lastSupplyDay < day) {
        l.stores.herbs = Math.min(LIFE.maxHerbs, l.stores.herbs + 4);
        n.lastSupplyDay = day;
      }
    }
    if (a.kind === "habit")
      n.project = Math.min(
        100,
        n.project +
          (n.id === "carpenter" ? 0.7 : n.id === "healer" ? 0.5 : 0.2),
      );
    if (a.kind === "eat" && l.stores.food > 0) {
      n.lastMealDay = Math.floor(this.state.time / 1440);
      l.stores.food--;
      n.needs.hunger = Math.max(0, n.needs.hunger - 60);
    }
    if (a.kind === "sleep") n.needs.fatigue = Math.max(0, n.needs.fatigue - 25);
    if (a.kind === "rest") n.needs.fatigue = Math.max(0, n.needs.fatigue - 5);
    if (a.kind === "treat") {
      const t = l.tasks.find((t) => t.id === a.task),
        target = t && this.body(t.subject),
        patient = t && l.people.find((p) => p.id === t.subject),
        guard = t && this.state.defense.guards.find((g) => g.id === t.subject);
      if (
        t &&
        target &&
        n.supplies.medicine > 0 &&
        target.space === this.body(n.id)!.space &&
        distance(target, this.body(n.id)!) < 45 &&
        spaceClear(target.space, this.body(n.id)!, target) &&
        this.safe(target) &&
        (!guard || !guard.dead) &&
        this.needsTreatment(t.subject)
      ) {
        n.supplies.medicine--;
        if (patient?.body) {
          patient.body.hp = Math.max(
            patient.body.hp,
            Math.min(85, patient.body.hp + 45),
          );
          patient.body.health = "convalescent";
          patient.body.recoverAt = this.state.time + LIFE.convalescentMinutes;
        } else if (guard) this.defense.healGuard(guard.id, 30);
        const care = this.emit(
          "care",
          target,
          n.id,
          [t.subject],
          "到场治疗，消耗从药房装入药箱的一份药品",
        );
        l.tasks = l.tasks.filter((task) => task.id !== t.id);
        if (patient?.body) {
          this.cancel(n, "急救完成，安排陪同伤员转移");
          const helper =
            !l.alarm && !this.state.defense.raid
              ? l.people.find((o) => {
                  const def = person(o.id)!,
                    g = this.state.defense.guards.find((g) => g.id === o.id),
                    p = this.body(o.id)!;
                  return (
                    g &&
                    !g.dead &&
                    !g.offDuty &&
                    def.traits.curiosity > 0.8 &&
                    def.traits.compassion > 0.8 &&
                    this.guardCanLeave(g.id) &&
                    p.space === target.space &&
                    distance(p, target) < LIFE.observation &&
                    spaceClear(p.space, p, target) &&
                    this.routeSafe(p, target) &&
                    this.routeSafe(
                      target,
                      FACILITIES.find((f) => f.id === "medical")!.place,
                    )
                  );
                })
              : undefined;
          const escort = helper ?? n;
          if (helper) {
            this.cancel(helper, "收到药师的安全护送请求");
            this.remember(helper, care, "report");
            helper.known[patient.id] = { ...target, time: this.state.time };
          }
          this.begin(escort, {
            kind: "escort",
            target: FACILITIES.find((f) => f.id === "medical")!.place,
            score: 170,
            facility: null,
            task: null,
            label: `陪同 ${t.subject} 前往救护点`,
          });
          if (helper) {
            escort.action!.phase = "collect";
            escort.action!.pickup = { ...target };
            this.defense.leaveGuard(helper.id as GuardId);
          }
          if (patient.action) this.cancel(patient, "获得急救，准备陪同转移");
          patient.reason = `由${person(escort.id)!.name}陪同转移`;
          return;
        }
      }
    }
    if (
      a.kind === "repair" &&
      this.body(n.id)!.space === a.target.space &&
      distance(this.body(n.id)!, a.target) < 35 &&
      this.safe(a.target)
    ) {
      const t = l.tasks.find((t) => t.id === a.task),
        f = MAINTENANCE.find((f) => f.id === t?.subject),
        p = this.body(n.id)!;
      if (
        t &&
        f &&
        t.kind === "repair" &&
        person(n.id)!.ability.repair &&
        p.space === f.place.space &&
        distance(p, f.place) < 35 &&
        spaceClear(p.space, p, f.place) &&
        this.safe(f.place) &&
        n.supplies.wood >= 2 &&
        l.facilities[t.subject] < 100
      ) {
        n.supplies.wood -= 2;
        l.facilities[t.subject] = Math.min(100, l.facilities[t.subject] + 50);
        this.emit(
          "repair",
          t.place,
          n.id,
          [t.subject],
          `到场维修，消耗从工坊带来的两份木料，${f.name}恢复至${l.facilities[t.subject]}%`,
        );
        l.tasks = l.tasks.filter((x) => x.id !== t.id);
      }
    }
    if (a.kind === "count") {
      const here = l.people
        .filter((p) => {
          const b = this.body(p.id);
          return b?.space === a.target.space && distance(b, a.target) < 180;
        })
        .map((p) => p.id);
      n.reason = `集结处已确认 ${here.length} 人；其余下落尚未确认`;
      // 只有近距离交谈才转述已知事实，禁止发布未知精确位置。
      const memory = n.memories.at(-1);
      if (memory)
        for (const id of here)
          if (id !== n.id) this.report(n.id, id, memory.eventId);
    }
    if (a.kind === "talk" && n.id!=='xiaobao') {
      if (a.social) finishSocial(this, n, a);
      const me = this.body(n.id)!;
      for (const other of l.people) {
        const p = this.body(other.id);
        if (other !== n && p && p.space === me.space && distance(p, me) < 90) {
          const memory = other.memories.at(-1);
          if (memory) this.report(other.id, n.id, memory.eventId);
        }
      }
    }
    l.reservations = l.reservations.filter((r) => r.owner !== n.id);
    const task = l.tasks.find((t) => t.owner === n.id);
    if (task) {
      task.owner = null;
      task.retryAt = l.elapsed + 3000;
      task.expires = 0;
    }
    n.action = null;
    n.nextDecision = l.elapsed + LIFE.decisionMs;
  }
  step(ms: number, budget: { queries: number }, paused = false) {
    if (paused || ms <= 0) return;
    const start = performance.now(),
      l = this.data;
    l.elapsed += ms;
    this.metrics.steps++;
    const day = Math.floor(this.state.time / 1440);
    if (day > l.stores.day) {
      l.stores.day = day;
      l.stores.food = Math.min(LIFE.maxFood, l.stores.food + 6);
      l.stores.wood = Math.min(
        LIFE.maxWood -
          l.people.find((n) => n.id === "carpenter")!.supplies.wood - l.people.find(n=>n.id==='xiaobao')!.supplies.wood,
        l.stores.wood + 2,
      );
    }
    const raid = this.state.defense.raid,
      hostiles = this.threats(),
      breach = hostiles.some(
        (e) =>
          RAID_GATES.some((g) => {
            const dx = g.inside.x - g.entry.x,
              dy = g.inside.y - g.entry.y,
              len = Math.hypot(dx, dy);
            return (
              ((e.x - g.inside.x) * dx + (e.y - g.inside.y) * dy) / len > 80 &&
              distance(e, g.inside) < 260
            );
          }) || distance(e, { x: 760, y: 740 }) < 380,
      ),
      failed =
        !!raid &&
        this.state.defense.guards.filter(
          (g) =>
            g.id.startsWith(raid.gateId.split("-")[0]) &&
            !g.dead &&
            !g.offDuty &&
            this.health(g.id) >= 35,
        ).length < 2;
    const level =
      breach || failed || l.elapsed < this.debugAlarmUntil
        ? 2
        : raid ||
            hostiles.some((e) =>
              RAID_GATES.some(
                (g) => distance(e, g.inside) < LIFE.villageAlertRadius,
              ),
            )
          ? 1
          : 0;
    if (level > l.alarm) {
      l.alarm = level as 1 | 2;
      l.clearSince = null;
      this.emit(
        "alarm",
        { space: "village", x: 720, y: 650 },
        "bell",
        [],
        level === 2 ? "居民区威胁，集结与救护" : "村门袭扰，保持局部警戒",
        l.elapsed < this.debugAlarmUntil,
      );
      this.messages.push(
        level === 2
          ? "风铃急响：居民正转移，救护点已启用。"
          : "村門戒备：附近居民避开危险路线。",
      );
    }
    if (level === 0 && l.alarm) {
      l.clearSince ??= l.elapsed;
      if (l.elapsed - l.clearSince >= LIFE.clearMs) {
        l.alarm = 0;
        l.clearSince = null;
        this.emit(
          "clear",
          { space: "village", x: 720, y: 650 },
          "bell",
          [],
          "持续确认安全，先救护和检修再恢复日常",
        );
        this.messages.push("危险已解除，居民正在核对同伴并恢复生活。");
      }
    }
    if (level > 0) l.clearSince = null;
    l.reservations = l.reservations.filter(
      (r) =>
        r.expires > l.elapsed &&
        l.people.some(
          (n) =>
            n.id === r.owner &&
            n.action?.facility === r.facility &&
            this.live(n.id),
        ),
    );
    for (const t of l.tasks) {
      const target = this.body(t.subject),
        owner = t.owner && this.body(t.owner);
      if (
        target &&
        owner &&
        owner.space === target.space &&
        distance(owner, target) < LIFE.observation &&
        spaceClear(owner.space, owner, target)
      )
        t.place = { ...target };
      if (t.owner && t.expires <= l.elapsed) {
        const owner = l.people.find((n) => n.id === t.owner)!;
        if (owner.action?.task === t.id)
          this.cancel(owner, "任务租约超时，等待重新分配");
        t.owner = null;
        t.expires = 0;
      }
    }
    l.tasks = l.tasks.filter((t) =>
      t.kind === "repair"
        ? l.facilities[t.subject] < 100
        : this.needsTreatment(t.subject),
    );
    for (const f of MAINTENANCE)
      if (l.facilities[f.id] < 100) this.ensureTask("repair", f.id, f.place);
    for (const n of l.people) {
      const p = this.body(n.id)!;
      n.memories = n.memories.filter((m) => m.expires >= this.state.time);
      n.emotion = Math.max(0, n.emotion - ms / 30000);
      n.needs.hunger = Math.min(100, n.needs.hunger + ms / 60000);
      n.needs.fatigue = Math.min(100, n.needs.fatigue + ms / 120000);
      if (
        n.body?.health === "convalescent" &&
        n.body.recoverAt <= this.state.time
      ) {
        n.body.hp = 100;
        n.body.health = "healthy";
      }
      if (n.body && (n.body.health === "hurt" || n.body.health === "down"))
        this.ensureTask("treat", n.id, p);
      if (l.elapsed >= n.nextDecision) {
        // 巡视发现是真实认知事件；离开现场取料后仍保留维修事实，不能因失去视线取消。
        if (person(n.id)!.ability.repair)
          for (const f of MAINTENANCE) {
            const known = [...n.memories]
              .reverse()
              .find(
                (m) =>
                  m.subjects.includes(f.id) &&
                  ["damage", "repair"].includes(m.kind),
              );
            if (
              l.facilities[f.id] < 100 &&
              known?.kind !== "damage" &&
              p.space === f.place.space &&
              distance(p, f.place) < LIFE.observation &&
              spaceClear(p.space, p, f.place)
            )
              this.emit(
                "damage",
                f.place,
                n.id,
                [f.id],
                `巡视确认${f.name}仍受损，完整度${l.facilities[f.id]}%`,
              );
          }
        for (const other of l.people) {
          const q = this.body(other.id)!;
          if (
            other !== n &&
            q.space === p.space &&
            distance(q, p) < LIFE.observation &&
            spaceClear(p.space, p, q)
          ) {
            n.known[other.id] = { ...q, time: this.state.time };
            const latest = [...n.memories]
              .reverse()
              .find(
                (m) =>
                  m.subjects.includes(other.id) &&
                  ["injury", "down", "care", "help"].includes(m.kind),
              );
            if (
              other.body &&
              ["hurt", "down"].includes(other.body.health) &&
              (!latest || !["injury", "down"].includes(latest.kind))
            )
              this.emit(
                other.body.health === "down" ? "down" : "injury",
                q,
                n.id,
                [other.id],
                "近处目击仍需救护的伤员",
              );
          }
        }
      }
      const aware = n.memories.at(-1);
      if (aware?.kind === "alarm" || aware?.kind === "clear") n.alarm = l.alarm;
      if(n.id==='xiaobao'){const started=performance.now();stepXiaobaoLife(this,ms);const cost=performance.now()-started;this.metrics.xiaobaoDecisionMs+=cost;this.metrics.xiaobaoDecisionMaxMs=Math.max(this.metrics.xiaobaoDecisionMaxMs,cost);continue;}
      const dangerous = p.space === "village" && !this.safe(p, 130);
      if (
        dangerous &&
        n.action &&
        !["shelter", "count"].includes(n.action.kind)
      ) {
        this.cancel(n, "直接危险，中止行动");
        n.nextDecision = l.elapsed;
      }
      if (
        n.alarm === 2 &&
        n.action &&
        !["shelter", "treat", "count", "escort"].includes(n.action.kind)
      ) {
        this.cancel(n, "听到集结警报，中止行动");
        n.nextDecision = l.elapsed;
      }
      if (l.elapsed >= n.nextDecision || dangerous) {
        this.decide(n);
        n.nextDecision = l.elapsed + LIFE.decisionMs;
      }
      const escorted = l.people.some(
        (o) =>
          o.action?.kind === "escort" && o.action.label.split(" ")[1] === n.id,
      );
      if (escorted) {
        if (n.action) this.cancel(n, "由救护者陪同转移");
        continue;
      }
      const a = n.action;
      if (!a || n.body?.health === "down") continue;
      if (
        !this.available(a.target) ||
        (a.facility && this.data.unavailable.facilities.includes(a.facility))
      ) {
        this.cancel(n, "住所或设施暂不可用，寻找旅馆空床或安全替代活动");
        n.nextDecision = l.elapsed;
        continue;
      }
      if (a.facility && !this.reserve(n, a.facility)) {
        this.cancel(n, "设施预约失效，选择替代活动");
        continue;
      }
      const task = l.tasks.find((t) => t.id === a.task);
      if (a.task && !task) {
        this.cancel(n, "任务已完成或目标失效");
        continue;
      }
      if (task) {
        task.expires = l.elapsed + LIFE.taskLeaseMs;
        const target =
          task.kind === "treat" ? this.treatmentPlace(n, task) : task.place;
        if (!target) {
          this.cancel(n, "伤员去向尚未确认，释放救护任务并等待报告");
          continue;
        }
        a.target = { ...target };
        if (
          task.kind === "treat" &&
          l.elapsed - a.started >
            LIFE.treatmentSearchMs + LIFE.treatMs + LIFE.transferMs * 2
        ) {
          delete n.known[task.subject];
          this.cancel(n, "救护寻找超过时间预算，报告未确认下落并等待新消息");
          continue;
        }
      }
      if (a.social && !updateSocial(this, n, a)) {
        n.social.cooldownUntil = l.elapsed + LIFE.socialRetryMs;
        this.cancel(
          n,
          "没有在安全已知位置见到清醒同伴，结束探访并重新安排日程",
        );
        continue;
      }
      if ((a.phase === "collect" || a.phase === "stock") && a.pickup) {
        if (
          !this.safe(p, 130) ||
          !this.safe(a.pickup, 70) ||
          !this.available(a.pickup)
        ) {
          if (a.kind === "shelter") {
            a.phase = "travel";
            a.progress = 0;
            n.reason = "危险迫近，放弃取物先避难";
          } else {
            this.cancel(n, "取物路线危险，等待掩护");
          }
          continue;
        }
        const guard = this.state.defense.guards.find((g) => g.id === n.id);
        if (guard) {
          if (
            p.space === a.pickup.space &&
            distance(p, a.pickup) < (a.kind === "escort" ? 35 : 6) &&
            spaceClear(p.space, p, a.pickup)
          ) {
            a.progress += ms;
            if (a.progress >= LIFE.transferMs) {
              if (a.kind !== "escort") n.gear = "carried";
              this.travelPhase(n, a);
            }
          } else if (this.nav(n.id).stuck > LIFE.routeStuckMs) {
            this.cancel(n, "救援会合通路受阻，报告并返岗");
            this.defense.recallGuard(guard.id);
          }
          continue;
        }
        if (n.body) {
          const queryCount = this.nav(n.id).queries;
          const arrived =
            (n.body.space === a.pickup.space &&
              distance(n.body, a.pickup) < 6) ||
            moveLife(
              n.body,
              a.pickup,
              ms,
              l.elapsed,
              budget,
              this.nav(n.id),
              (q) => this.escapeStep(p, q),
              [],
              (space) => !l.unavailable.homes[space],
            );
          this.metrics.queries += this.nav(n.id).queries - queryCount;
          if (arrived) {
            a.progress = Math.min(a.duration, a.progress + ms);
            if (a.progress >= LIFE.transferMs) {
              if (a.phase === "stock") {
                const material = this.material(n, a.kind)!;
                const count = Math.min(
                  (material === "medicine"
                    ? LIFE.carriedMedicine
                    : LIFE.carriedWood) - n.supplies[material],
                  l.stores[material],
                );
                n.supplies[material] += count;
                l.stores[material] -= count;
                if (n.supplies[material] < (material === "medicine" ? 1 : 2)) {
                  this.cancel(n, "补给点库存不足，保留已取得材料并等待补充");
                  continue;
                }
              } else n.gear = "carried";
              this.travelPhase(n, a);
            }
          } else if (this.nav(n.id).stuck > LIFE.routeStuckMs) {
            a.failures++;
            n.pathFailures++;
            this.nav(n.id).stuck = 0;
            if (a.failures >= LIFE.retryLimit) {
              n.blockedTarget = { ...a.pickup };
              n.blockedUntil = l.elapsed + 30000;
              this.cancel(n, "取物通路失败，等待求助");
            }
          }
        }
        continue;
      }
      const g = this.state.defense.guards.find((g) => g.id === n.id);
      let reached =
        p.space === a.target.space &&
        distance(p, a.target) < (a.kind === "treat" ? 35 : 6) &&
        (a.kind !== "treat" || spaceClear(p.space, p, a.target));
      if (reached && a.kind === "treat" && task) {
        const patient = this.body(task.subject);
        const visible =
          patient &&
          patient.space === p.space &&
          distance(patient, p) < LIFE.observation &&
          spaceClear(p.space, p, patient);
        if (!visible) {
          if (a.failures === 0) {
            a.failures = 1;
            a.phase = "travel";
            a.progress = 0;
            a.target = {
              ...FACILITIES.find((f) => f.id === person(task.subject)!.bed)!
                .place,
            };
            n.reason = "已知位置未见伤员，沿安全路线到其住所核对一次";
          } else {
            delete n.known[task.subject];
            this.cancel(
              n,
              "已知位置与住所均未见伤员，报告未知下落并等待新消息",
            );
          }
          continue;
        }
      }
      if (a.kind === "escort") {
        const patient = l.people.find((o) => o.id === a.label.split(" ")[1]);
        if (patient?.body && patient.body.health !== "down") {
          moveLife(
            patient.body,
            a.target,
            ms,
            l.elapsed,
            budget,
            this.nav(patient.id),
            (q) => this.escapeStep(p, q),
            [],
            (space) => !l.unavailable.homes[space],
          );
          const caregiver = this.body(n.id)!;
          if (
            patient.body.space === caregiver.space &&
            distance(patient.body, caregiver) > 65
          )
            continue;
        }
      }
      if (!g && !reached) {
        const beforeQueries = this.nav(n.id).queries;
        reached = moveLife(
          n.body!,
          a.target,
          ms,
          l.elapsed,
          budget,
          this.nav(n.id),
          (q) => this.escapeStep(p, q),
          l.people
            .filter(
              (o) =>
                o !== n &&
                !this.state.defense.guards.some((g) => g.id === o.id),
            )
            .map((o) => this.body(o.id)!),
          (space) => !l.unavailable.homes[space],
        );
        this.metrics.queries += this.nav(n.id).queries - beforeQueries;
      }
      if (g) {
        const r = this.nav(n.id);
        if (r.stuck > LIFE.routeStuckMs) {
          n.blockedTarget = { ...a.target };
          n.blockedUntil = l.elapsed + 30000;
          n.pathFailures++;
          this.cancel(n, "轮休通路受阻，返回岗位");
          this.defense.recallGuard(g.id);
          continue;
        }
      }
      if (!reached) {
        if (this.nav(n.id).stuck > LIFE.routeStuckMs) {
          a.failures++;
          n.pathFailures++;
          this.nav(n.id).stuck = 0;
          if (a.failures >= LIFE.retryLimit) {
            n.blockedTarget = { ...a.target };
            n.blockedUntil = l.elapsed + 30000;
            const bedFailed =
              a.kind === "sleep" ||
              (a.kind === "rest" && a.facility?.startsWith("bed:"));
            this.cancel(n, "三次通路失败，目标冷却半分钟并改用安全等待");
            if (bedFailed) {
              this.decide(n);
              continue;
            }
            this.begin(n, {
              kind: "rest",
              target: this.body(n.id)!,
              score: 10,
              facility: null,
              task: null,
              label: "通路失败后安全等候",
            });
          }
        }
        continue;
      }
      a.phase = "perform";
      if (a.kind === "sleep") {
        a.progress = Math.min(a.duration, a.progress + ms);
        n.needs.fatigue = Math.max(0, n.needs.fatigue - ms / 120);
        continue;
      }
      if ((a.kind === "shelter" || a.kind === "count") && n.alarm === 2) {
        a.progress = Math.min(a.duration, a.progress + ms);
        if (a.kind === "count") {
          const count = l.people.filter((o) => {
            const b = this.body(o.id)!;
            return b.space === p.space && distance(b, p) < 180;
          }).length;
          n.reason = `集结处已确认 ${count} 人，其余下落尚未确认`;
        }
        continue;
      }
      if (a.kind === "escort") {
        const id = a.label.split(" ")[1],
          patient = l.people.find((p) => p.id === id);
        if (
          patient?.body &&
          patient.body.health !== "down" &&
          patient.body.space === p.space
        ) {
          moveLife(
            patient.body,
            a.target,
            ms,
            l.elapsed,
            budget,
            this.nav(patient.id),
            (q) => this.escapeStep(p, q),
            [],
            (space) => !l.unavailable.homes[space],
          );
          if (distance(patient.body, a.target) > 15) continue;
        }
      }
      if (
        a.kind === "treat" &&
        (!this.safe(p, LIFE.dangerRadius) ||
          !task ||
          !this.needsTreatment(task.subject))
      ) {
        this.cancel(n, "路线或伤情变化，等待安全救护");
        continue;
      }
      a.progress = Math.min(a.duration, a.progress + ms);
      if (a.progress >= a.duration) this.complete(n, a);
    }
    this.syncGuardOrders();
    if (this.messages.length > 8)
      this.messages.splice(0, this.messages.length - 8);
    const cost = performance.now() - start;
    this.metrics.ms += cost;
    this.metrics.maxMs = Math.max(this.metrics.maxMs, cost);
  }
  syncGuardOrders() {
    for (const g of this.state.defense.guards) {
      const n = this.data.people.find((n) => n.id === g.id)!;
      if (g.dead) {
        this.defense.peaceOrders.delete(g.id);
        continue;
      }
      if (n.action && g.offDuty && !this.guardAlert(g.id))
        this.defense.peaceOrders.set(g.id, {
          ...(n.action.phase === "collect" && n.action.pickup
            ? n.action.pickup
            : n.action.target),
        });
      else this.defense.peaceOrders.delete(g.id);
    }
  }
  // 平民与有限维护点复用同一攻击接触，生活系统拥有各自生命或完整度。
  receiveHostileContact(
    id: string,
    source: DefenseHostile,
    contact: EnemyContact,
  ) {
    const n = this.data.people.find((n) => n.id === id),
      facility = MAINTENANCE.find((f) => f.id === id),
      body =
        n?.body ??
        (facility ? { ...facility.place, hp: this.data.facilities[id] } : null),
      attack = contact.attack;
    if (
      !body ||
      body.space !== "village" ||
      body.hp <= 0 ||
      n?.body?.health === "down" ||
      source.hp <= 0 ||
      source.disabled ||
      !this.defense.allHostiles().includes(source) ||
      (!validFungalBlastContact(contact,source,id)&&(source.targetId !== id || source.attack !== attack)) ||
      attack.attackerId !== source.id ||
      attack.cancelled ||
      attack.resolved ||
      !attack.emitted ||
      !attackTouches(contact, body) ||
      !clearMeleeLine(contact.origin, body, source.id)
    )
      return false;
    const hit = resolveDamage(
      {
        sourceId: source.id,
        targetId: id,
        attackId: attack.attackId,
        amount: attack.damage,
        sourceScale: this.defense.runeEnemyScale(source.id),
        sourceType: contact.blastId ? "enemy-blast" : "enemy-melee",
        eventId: source.eventId ?? null,
      },
      { id: source.id, faction: "hostile", hp: source.hp, armor: 0 },
      { id, faction: "village", hp: body.hp, armor: 0,...this.defense.protection?.(id) },
    );
    if (!hit.applied) return false;
    attack.resolved = true;
    if (hit.damage === 0) return true;
    if (facility) return this.damageFacility(id, hit.damage, false, source.id);
    if (!n?.body) return false;
    n.body.hp = hit.hp;
    n.body.health = hit.hp === 0 ? "down" : "hurt";
    n.body.recoverAt = 0;
    n.body.episode++;
    this.cancel(n, "真实攻击受伤，中止行动并等待救护");
    n.nextDecision = this.data.elapsed;
    const event = this.emit(
      hit.hp === 0 ? "down" : "injury",
      body,
      source.id,
      [id],
      hit.hp === 0
        ? "敌人实际命中，失去行动能力，等待到场急救"
        : "敌人实际命中，需要休养与救护",
    );
    // 呼救只传到近处；隔墙、室内外及远方同伴不能得到伤员坐标。
    for (const observer of this.data.people) {
      const p = this.body(observer.id)!;
      if (
        p.space === body.space &&
        distance(p, body) <= LIFE.injuryCallRadius &&
        spaceClear(p.space, p, body)
      ) {
        this.remember(observer, event, "report");
        observer.known[id] = { ...body, time: this.state.time };
        observer.nextDecision = this.data.elapsed;
      }
    }
    this.ensureTask("treat", id, body);
    this.defense.critical = true;
    return true;
  }
  // 调试伤情公开标记，不作为自然战斗验收证据。
  debugInjury(id: ResidentId, amount = 55) {
    const n = this.data.people.find((n) => n.id === id),
      p = this.body(id);
    if (!n || !p) return false;
    if (n.body) {
      const hit = resolveDamage(
        {
          sourceId: "debug-injury",
          targetId: id,
          attackId: `debug:${this.data.sequence + 1}`,
          amount,
          sourceType: "enemy-melee",
          eventId: null,
        },
        { id: "debug-injury", faction: "hostile", hp: 1, armor: 0 },
        { id, faction: "village", hp: n.body.hp, armor: 0 },
      );
      if (!hit.applied) return false;
      n.body.hp = hit.hp;
      n.body.health = hit.hp === 0 ? "down" : "hurt";
      n.body.episode++;
      this.cancel(n, "调试伤情，等待救护");
    } else
      this.defense.damageGuard(
        {
          sourceId: "debug-injury",
          targetId: id,
          attackId: `debug:${this.data.sequence + 1}`,
          amount,
          sourceType: "enemy-melee",
          eventId: null,
        },
        { id: "debug-injury", hp: 1 },
      );
    const e = this.emit(
      "injury",
      p,
      "debug-injury",
      [id],
      "开发调试伤情与医疗演练报告",
      true,
    );
    this.remember(
      this.data.people.find((n) => n.id === "healer")!,
      e,
      "report",
    );
    this.data.people.find((n) => n.id === "healer")!.known[id] = {
      ...p,
      time: this.state.time,
    };
    this.ensureTask("treat", id, p);
    return true;
  }
  damageFacility(
    id: string,
    amount: number,
    debug = false,
    source = "maintenance",
  ) {
    const f = MAINTENANCE.find((f) => f.id === id);
    if (
      !f ||
      this.data.facilities[id] <= 0 ||
      amount <= 0 ||
      !Number.isFinite(amount)
    )
      return false;
    this.data.facilities[id] = Math.max(
      0,
      this.data.facilities[id] - Math.min(100, amount),
    );
    this.emit(
      "damage",
      f.place,
      debug ? "debug-damage" : source,
      [id],
      debug
        ? "开发调试损坏"
        : `${f.name}实际受损，完整度${this.data.facilities[id]}%`,
      debug,
    );
    this.ensureTask("repair", id, f.place);
    this.defense.critical = true;
    return true;
  }
  observePlayer() {
    const p = { ...this.state.player, space: this.data.playerSpace };
    for (const n of this.data.people) {
      const b = this.body(n.id)!;
      if (
        b.space === p.space &&
        distance(b, p) < 360 &&
        spaceClear(p.space, p, b)
      ) {
        const a = n.action;
        this.data.observed[n.id] = {
          time: this.state.time,
          label: a?.label ?? n.reason,
          space: b.space,
        };
        n.known.player = { ...p, time: this.state.time };
      }
    }
    const speech = chooseSpeech(this);
    if (speech) this.speech = speech;
  }
  dialogue(id: ResidentId) {
    const n = this.data.people.find((n) => n.id === id)!,
      d = person(id)!,
      memory = [...n.memories]
        .reverse()
        .find((m) =>
          [
            "care",
            "help",
            "injury",
            "down",
            "alarm",
            "death",
            "company",
            "damage",
            "repair",
          ].includes(m.kind),
        );
    if (n.body?.health === "down")
      return "暂时无法行动，救护者正在寻找安全路线。";
    if (n.alarm === 2)
      return n.id === "healer"
        ? "先到安全集结处！我带着药箱，会沿安全路线救护。"
        : n.id === "elder"
          ? n.reason
          : "先走安全通道，财物等安全了再说。";
    if (memory?.kind === "company")
      return `${memory.source === "report" ? "听同伴说，" : "我记得，"}${memory.result}。日常会慢慢恢复，不必急着补完所有工作。`;
    if (memory?.kind === "care")
      return `${memory.source === "report" ? "听同伴说，" : "我记得，"}${person(memory.subjects[0])?.name ?? "同伴"}已经接受救治。药箱还得留些药，慢慢恢复。`;
    if (memory?.kind === "help")
      return memory.source === "report"
        ? "听小满说，你帮忙照护了伤员。谢谢。"
        : "谢谢你到场帮忙。我会记住这次照护。";
    if (memory?.kind === "injury" || memory?.kind === "down")
      return "刚才确实有人受伤，先处理伤情，再继续工作。";
    if (memory?.kind === "damage" || memory?.kind === "repair")
      return `${memory.source === "report" ? "听同伴说，" : "我记得，"}${memory.result}。先保证安全，再安排检查与维修。`;
    const stage =
      n.project >= 66
        ? "已接近完成"
        : n.project >= 33
          ? "有了清楚的轮廓"
          : "刚开始";
    return `${n.action?.label ?? n.reason}。${d.habit}。${d.wish}：${stage}。`;
  }
  helpPlayer(id: ResidentId) {
    const p = this.body(id),
      n = this.data.people.find((n) => n.id === id);
    if (
      !p ||
      !n ||
      p.space !== this.data.playerSpace ||
      distance(p, this.state.player) > 90 ||
      !spaceClear(p.space, p, this.state.player) ||
      !this.needsTreatment(id) ||
      this.data.stores.medicine <= 0 ||
      !this.safe(p)
    )
      return false;
    const g = this.state.defense.guards.find((g) => g.id === id);
    if (g?.dead) return false;
    this.data.stores.medicine--;
    if (n.body) {
      n.body.hp = Math.max(n.body.hp, Math.min(85, n.body.hp + 30));
      n.body.health = "convalescent";
      n.body.recoverAt = this.state.time + LIFE.convalescentMinutes;
    } else this.defense.healGuard(id, 30);
    this.emit("help", p, "player", [id], "玩家到场使用公共药箱照护");
    return true;
  }
  visit(space: SpaceId) {
    const h = HOMES.find((h) => h.id === space);
    if (!h) return false;
    if (this.data.unavailable.homes[space]) return false;
    if (space === "inn" || h.owners.length === 0) return true;
    const owner = this.data.people.find((n) => n.id === h.owners[0])!,
      r = this.relation(owner, "player");
    const open =
      (space === "healer-home" &&
        this.state.time % 1440 >= 360 &&
        this.state.time % 1440 < 1140) ||
      space === "barracks";
    if (
      open ||
      r.trust >= 20 ||
      (this.data.invitations[space] ?? 0) >= this.state.time
    )
      return true;
    // 敲门是有限紧急拜访，不授予物品使用权，保证任务可达。
    this.data.invitations[space] = this.state.time + 30;
    this.emit(
      "visit",
      { space: "village", ...h.door },
      "player",
      [owner.id],
      "未预约敲门；获准短时拜访",
    );
    return false;
  }
  storageText(id: string) {
    const box = PRIVATE_STORAGE.find((b) => b.id === id);
    if (!box) return "储物记录不存在。";
    const n = this.data.people.find((n) => n.id === box.owner)!;
    const supplies =
      n.id === "healer"
        ? `药箱内余药 ${n.supplies.medicine}/${LIFE.carriedMedicine}。`
        : n.id === "carpenter"
          ? `工具包内木料 ${n.supplies.wood}/${LIFE.carriedWood}。`
          : "";
    return `${box.item}：${this.carrying(n) ? "主人已取出携带" : "存放在箱中"}。${supplies}\n这是${person(n.id)!.name}的私人物品，来访许可不包含取用权。药房与工坊的公共补给需要到场领取；不会消耗玩家背包。`;
  }
  debugAccess(id: ResidentId, bed = false) {
    const p = person(id)!,
      unavailable = this.data.unavailable;
    if (bed) {
      const closed = !unavailable.facilities.includes(p.bed);
      unavailable.facilities = closed
        ? [...unavailable.facilities, p.bed]
        : unavailable.facilities.filter((f) => f !== p.bed);
      const f = FACILITIES.find((f) => f.id === p.bed)!;
      this.emit(
        "access",
        f.place,
        "开发演练",
        [p.id, p.bed],
        `调试床位${closed ? "暂不可用" : "恢复可用"}`,
        true,
      );
    } else {
      unavailable.homes[p.home] = !unavailable.homes[p.home];
      const h = HOMES.find((h) => h.id === p.home)!;
      this.emit(
        "access",
        { space: "village", ...h.door },
        "开发演练",
        [p.id, p.home],
        `调试住所通路${unavailable.homes[p.home] ? "暂不可进入" : "已恢复"}`,
        true,
      );
    }
  }
  entities(space = this.data.playerSpace) {
    return this.data.people
      .filter(n=>n.id!=='xiaobao')
      .map((n) => {
        const p = this.body(n.id)!,
          d = person(n.id)!;
        return {
          id: n.id,
          ...p,
          label: `${d.job} · ${d.name}`,
          art: d.art,
          w: 76,
          h: 90,
          kind: "npc" as const,
        };
      })
      .filter(
        (p) =>
          p.space === space &&
          !this.state.defense.guards.find((g) => g.id === p.id)?.dead,
      );
  }
  snapshot() {
    return {
      alarm: this.data.alarm,
      space: this.data.playerSpace,
      speech: this.speech,
      metrics: {
        ...this.metrics,
        pathBatches: [...this.navigation.values()].reduce(
          (sum, n) => sum + n.batches,
          0,
        ),
        maxExpandedPerBatch: Math.max(
          0,
          ...[...this.navigation.values()].map((n) => n.maxExpanded),
        ),
      },
      stores: this.data.stores,
      reservations: this.data.reservations,
      tasks: this.data.tasks,
      people: this.data.people.map((n) => ({
        id: n.id,
        body: this.body(n.id),
        action: n.action,
        reason: n.reason,
        needs: n.needs,
        alarm: n.alarm,
        candidates: this.scores.get(n.id) ?? [],
        // 调试快照也只含可复制数据，不能暴露暂停中的生成器。
        path: (() => {
          const r = this.navigation.get(n.id);
          return r
            ? {
                nav: r.nav,
                stuck: r.stuck,
                queries: r.queries,
                batches: r.batches,
                maxExpanded: r.maxExpanded,
                failure: r.failure,
                goal: r.goal,
                planning: !!r.search,
              }
            : null;
        })(),
        memories: n.memories.slice(-4),
      })),
      events: this.data.events.slice(-12),
    };
  }
}
