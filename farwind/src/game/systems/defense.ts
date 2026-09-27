import { GUARD_LANDINGS, type Place } from '../../data/npcLife';
import type {GuardId} from '../../data/defense';
import { DEFENSE, TOWERS, RAID_GATES, RAID_TIMING, GUARD_DEFS, GUARD_WEAPONS, GUARD_ARMOR, type GateId } from "../../data/defense";
import { props } from "../../data/world";
import { regionAt } from "../../data/village";
import { localPath, nearestStanding, enemyNavigation, enemyAttackSpace, type EnemyBody, NAV } from "./enemy";
import { motionBlocked, clearMotionLine, clearMeleeLine, shotLineBlocker, type Point, type Rect, type FiringPort } from "./obstacles";
import { createEnemyAttack, advanceEnemyAttack, delayEnemyAttack, type EnemyContact } from "./enemyAttack";
import { resolveDamage, type DamageEvent } from "./damage";
import type { DefenseState, GuardState } from "./defenseState";
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export type DefenseEnemy = EnemyBody & { kind: "defense-enemy"; eventId: string; flashUntil: number;
  targetId: string | null; playerAggroUntil: number; maxHP: number };
export type DefenseHostile = EnemyBody & {eventId?:string; flashUntil:number; maxHP?:number};
type GuardAttack = { id: string; start: number; contact: number; end: number; targetId: string; hit: boolean; direction: Point };
type GuardRuntime = { nav: EnemyBody["nav"]; attack: GuardAttack | null; serial: number; patrol: number;
  facing: 0 | 1 | 2 | 3; moved: number; distance: number; flashUntil: number };
export type DefenseArrow = { id: string; sourceId: string; eventId: string; x: number; y: number;
  origin: Point; vx: number; vy: number; age: number; damage: number; travelled: number; hit: Set<string> };
export type DefenseNotice = { kind: "hit" | "death" | "ended" | "shot" | "warning" | "started" | "delayed"; id: string; sourceId?: string; eventKey?:string;
  at: number; damage?: number; x?: number; y?: number };

export function nextRandom(seed: number) {
  seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0;
}
export function spawnLegal(gateId: GateId, spawns: readonly Point[], player: Point, view?: Rect, occupied: readonly Point[] = []) {
  const gate = RAID_GATES.find(g => g.id === gateId)!;
  return spawns.every(p => {
    const region = regionAt(p).id;
    if (region !== (gateId === "east-gate" ? "forest" : gateId === "north-gate" ? "north" : "south") ||
      dist(p, player) < 220 || occupied.some(q => dist(p, q) < 60) || motionBlocked(p.x, p.y) ||
      view && p.x > view.left - 100 && p.x < view.right + 100 && p.y > view.top - 100 && p.y < view.bottom + 100) return false;
    return !!localPath(p, q => dist(q, gate.entry) < 25 && clearMotionLine(q, gate.entry), gate.entry, q => dist(q, gate) <= 480).path;
  }) && !!localPath(gate.entry, q => dist(q, gate.inside) < 25 && clearMotionLine(q, gate.inside),
    gate.inside, q => dist(q, gate) <= 480).path;
}
export function prepareRaid(s: DefenseState, player: Point, gateId: GateId, count = 3, warning = false, view?: Rect, occupied: readonly Point[] = []): DefenseState {
  if (s.raid) throw Error("已有演练或来袭正在进行，不能重复生成。");
  if (s.sequence >= 1e9) throw Error("来袭序号已到上限。");
  if (!Number.isInteger(count) || count < 2 || count > DEFENSE.unitLimit) throw Error("来袭人数无效。");
  const gate = RAID_GATES.find(g => g.id === gateId);
  if (!gate) throw Error("出口未开放。");
  const spawns = gate.spawns.slice(0, count).map(p => ({...p}));
  if (!spawnLegal(gateId, spawns, player, view, occupied)) throw Error("城外生成点近身、在视口内或不可达，请稍后再试。");
  const next = structuredClone(s), sequence = ++next.sequence, id = gateId === "east-gate" && !warning ? `east-raid-${sequence}` : `raid-${sequence}`;
  next.raid = { id, sequence, gateId, spawns, phase: warning ? "warning" : "approach", ageMs: 0,
    members: spawns.map((p, i) => ({ id: `${id}:${i + 1}`, type: warning && i === count - 1 && count >= 3 ? "leaf" : "slime",
      ...p, hp: warning && i === count - 1 && count >= 3 ? 72 : 48, cooldownMs: 0, targetId: null })) };
  return next;
}
export function prepareEastRaid(s: DefenseState, player: Point) { return prepareRaid(s, player, "east-gate"); }
export class EastDefense {
  observerSpace="village";
  peaceOrders=new Map<string,Place>();
  lifeMove?: (guard:GuardState,target:Place,ms:number,budget:{queries:number})=>number;
  leaveGuard(id:GuardId){const g=this.state.guards.find(g=>g.id===id)!;if(g.dead||g.offDuty)return;g.offDuty=true;g.mode="life";g.towerTransitMs=GUARD_DEFS.find(d=>d.id===id)!.role==="archer"?1800:0;this.runtime.get(id)!.attack=null;}
  recallGuard(id:GuardId){const g=this.state.guards.find(g=>g.id===id)!;this.peaceOrders.delete(id);if(!g.dead&&g.offDuty)g.mode="return";}
  healGuard(id:string,amount:number){const g=this.state.guards.find(g=>g.id===id);if(g&&!g.dead&&amount>0)g.hp=Math.min(GUARD_DEFS.find(d=>d.id===id)!.maxHP,g.hp+Math.min(30,amount));}
  enemies: DefenseEnemy[] = [];
  external: DefenseHostile[] = [];
  manages(e: EnemyBody) { return e.hp > 0 && !e.disabled && this.state.guards.some(g => !g.dead && !g.offDuty && (g.space??"village")==="village" &&
    GUARD_DEFS.find(d => d.id === g.id)!.role === "melee" && dist(e,GUARD_DEFS.find(d => d.id === g.id)!.post) <= 300 &&
    dist({x:e.homeX,y:e.homeY},GUARD_DEFS.find(d => d.id === g.id)!.post) <= 600); }
  hostiles(): DefenseHostile[] { return [...this.enemies,...this.external.filter(e=>this.manages(e))]; }
  arrows: DefenseArrow[] = [];
  runtime = new Map<string, GuardRuntime>();
  history: DefenseNotice[] = [];
  notices: DefenseNotice[] = [];
  critical = false;
  now = 0;
  awaitingCheckpoint = false;
  timerCheckpoint = 0;
  portFor(guardId: string): FiringPort {
    const tower = TOWERS.find(t => t.occupantGuardId === guardId)!;
    return { origin: tower.muzzle, structureId: tower.id,
      lowCoverIds: props.filter(p => p.owner === "village" && p.cover === "low").map(p => p.id) };
  }
  gate() { return RAID_GATES.find(g => g.id === this.state.raid?.gateId) ?? RAID_GATES[0]; }
  acknowledged(sequence: number) { if (sequence === this.state.sequence) this.awaitingCheckpoint = false; }
  spawnEnemies(now: number) {
    this.enemies = (this.state.raid?.members ?? []).map((m, i) => {
      const home = this.state.raid!.spawns[i], gate = this.gate();
      const safe = m.hp > 0 && (motionBlocked(m.x, m.y) || dist(m,gate) >= 700)
        ? nearestStanding(m, [home, gate.entry], p => dist(p, gate) < 700) : m;
      return { ...m, ...(safe ?? home), kind: "defense-enemy", maxHP: m.type === "slime" ? 48 : 72,
        homeX: home.x, homeY: home.y, eventId: this.state.raid!.id,
        cool: now + m.cooldownMs, windup: 0, staggerUntil: 0, nav: enemyNavigation(),
        ai: m.hp > 0 ? `接近${gate.name}` : "死亡", disabled: false, recovered: false, flashUntil: 0, playerAggroUntil: 0 };
    });
  }
  schedule(dtMs: number, player: Point, view?: Rect, occupied: readonly Point[] = []) {
    if (this.state.raid) return;
    const protectedMs = Math.min(dtMs, this.state.protectionMs);
    this.state.protectionMs -= protectedMs;
    this.state.cooldownMs = Math.max(0, this.state.cooldownMs - (dtMs - protectedMs));
    this.state.retryMs = Math.max(0, this.state.retryMs - dtMs);
    if (this.state.protectionMs || this.state.cooldownMs || this.state.retryMs || this.awaitingCheckpoint || occupied.length + this.state.guards.length + DEFENSE.unitLimit > 24) return;
    // 夜间导演负责正式许可；这里仅推进有效游玩保护与冷却。
  }

  // 新预警与预警结束复用同一门级准入；已生成的战斗不受此门槛影响。
  canScheduleAtGate(gateId: GateId, player: Point, spawns: readonly Point[], view?: Rect, occupied: readonly Point[] = []) {
    const raid=this.state.raid;
    if (raid && (raid.phase !== "warning" || raid.gateId !== gateId) ||
      !raid && (this.state.protectionMs || this.state.cooldownMs || this.state.retryMs) ||
      occupied.length + this.state.guards.filter(g=>!g.dead).length + spawns.length > 24) return false;
    const defs=GUARD_DEFS.filter(d=>d.id.startsWith(gateId.split('-')[0]+'-'));
    if (defs.length !== 3 || !defs.every(d=>{
      const g=this.state.guards.find(g=>g.id===d.id),r=this.runtime.get(d.id);
      return g && !g.dead && !g.offDuty && (g.space??"village")==="village" && g.hp >= d.maxHP*.65 && g.postId===d.postId &&
        ["post","patrol"].includes(g.mode) && !r?.attack &&
        (d.role==='archer' ? dist(g,d.post)<=2 : dist(g,d.post)<=d.leash && !motionBlocked(g.x,g.y));
    })) return false;
    return spawnLegal(gateId,spawns,player,view,occupied);
  }
  finish(delayed = false) {
    const raid = this.state.raid; if (!raid) return;
    this.state.completedSequence = raid.sequence; this.state.raid = null; this.enemies = []; this.arrows = [];
    this.state.seed = nextRandom(this.state.seed);
    this.state.cooldownMs = delayed ? 0 : RAID_TIMING.minInterval + this.state.seed % (RAID_TIMING.maxInterval - RAID_TIMING.minInterval + 1);
    this.state.retryMs = delayed ? RAID_TIMING.retry : 0; this.awaitingCheckpoint = false;
    this.critical = true; this.note({kind:delayed ? "delayed" : "ended", id:raid.id, at:this.now});
  }
  constructor(public state: DefenseState, now: number) { this.restore(now); }
  // 交易只换状态副本；运行中的攻击与箭矢不重建、不补伤害。
  rebind(state: DefenseState) { this.state = state; }
  restore(now: number) {
    this.now = now; this.arrows = []; this.runtime.clear();
    for (const g of this.state.guards) {
      const d = GUARD_DEFS.find(d => d.id === g.id)!;
      if (d.role === "archer" && !g.offDuty) Object.assign(g, d.post);
      else if (!g.dead && !g.offDuty && (motionBlocked(g.x, g.y) || dist(g,d.post) > d.leash)) {
        const safe = nearestStanding(g, [d.post, d.cover], p => dist(p, d.post) < d.leash);
        Object.assign(g, safe ?? d.post);
      }
      this.runtime.set(g.id, { nav: enemyNavigation(), attack: null, serial: 0, patrol: 0,
        facing: 3, moved: 0, distance: 0, flashUntil: 0 });
    }
    if (this.state.raid?.phase !== "warning") this.spawnEnemies(now); else this.enemies = [];
    this.sync();
  }
  drainNotices(){const batch=this.notices;this.notices=[];return batch;}
  note(event: DefenseNotice) {
    this.notices.push(event); this.history.push(event);
    if (this.history.length > 80) this.history.shift();
  }
  damageGuard(event: DamageEvent, source: { id: string; hp: number }) {
    const g = this.state.guards.find(g => g.id === event.targetId);
    if (!g) return false;
    const hit = resolveDamage(event, { ...source, faction: "hostile", armor: 0 },
      { id: g.id, faction: "village", hp: g.hp, armor: GUARD_ARMOR[g.armorId] });
    if (!hit.applied) return false;
    g.hp = hit.hp; g.peaceMs = 0;
    this.runtime.get(g.id)!.flashUntil = this.now + 130;
    this.note({ kind: "hit", id: g.id, eventKey:`${event.attackId}:${g.id}:hit`, sourceId: source.id, at: this.now, damage: hit.damage, x: g.x, y: g.y });
    if (hit.killed) {
      g.dead = true; g.mode = "dead"; g.cooldownMs = 0;
      const r = this.runtime.get(g.id)!; r.attack = null; r.nav.path = [];
      this.arrows = this.arrows.filter(a => a.sourceId !== g.id);
      this.critical = true;
      this.note({ kind: "death", id: g.id, eventKey:`${event.attackId}:${g.id}:death`, sourceId: source.id, at: this.now, x: g.x, y: g.y });
    }
    return true;
  }
  damageEnemy(e: DefenseHostile, event: DamageEvent, sourceHP: number) {
    const hit = resolveDamage(event, { id: event.sourceId, hp: sourceHP, faction: "village", armor: 0 },
      { id: e.id, hp: e.hp, faction: "hostile", armor: 0 });
    if (!hit.applied) return false;
    e.hp = hit.hp; e.flashUntil = this.now + 130;
    if (event.sourceType === "player-melee" || event.sourceType === "player-wind") e.playerAggroUntil = this.now + 2500;
    this.note({ kind: "hit", id: e.id, sourceId: event.sourceId, at: this.now, damage: hit.damage, x: e.x, y: e.y });
    if (hit.killed) {
      if (e.attack) e.attack.cancelled = true;
      e.attack = null; e.nav.path = []; e.ai = "死亡";
      this.critical = true;
      this.note({ kind: "death", id: e.id, sourceId: event.sourceId, at: this.now, x: e.x, y: e.y });
    }
    this.sync();
    return true;
  }
  move(body: Point, nav: EnemyBody["nav"], target: Point, speed: number, dt: number,
    budget: { queries: number }, allowed: (p: Point) => boolean, peers: Point[] = []) {
    const old = {x:body.x,y:body.y}; let goal: Point = {x:target.x,y:target.y};
    const close = peers.filter(p => p !== body && dist(p, body) < 32);
    if (close.length) {
      let dx = 0, dy = 0;
      for (const p of close) { const n = Math.max(1, dist(body, p));
        dx += (body.x - p.x || (body.y >= p.y ? 1 : -1)) / n;
        dy += (body.y - p.y || (body.x >= p.x ? 1 : -1)) / n; }
      goal = { x: target.x + dx * 26, y: target.y + dy * 26 };
    }
    let waypoint: Point | undefined;
    if (allowed(goal) && clearMotionLine(body, goal)) { waypoint = goal; nav.path = []; }
    else {
      if (this.now >= nav.next && budget.queries > 0 && (!nav.target || dist(nav.target, goal) > 32 || !nav.path.length)) {
        budget.queries--; const found = localPath(body, p => dist(p, goal) < 26 && clearMotionLine(p, goal), goal, allowed);
        nav.path = found.path ?? []; nav.target = { ...goal }; nav.next = this.now + NAV.interval;
        nav.queries++; nav.visited = found.visited; nav.failed = !found.path;
        if (found.path) nav.path.push(goal);
      }
      while (nav.path.length && dist(body, nav.path[0]) < 1) nav.path.shift();
      waypoint = nav.path[0];
    }
    if (!waypoint) return 0;
    const d = dist(body, waypoint); if (d < 0.01) return 0;
    const step = Math.min(d, speed * dt), next = { x: body.x + (waypoint.x - body.x) / d * step,
      y: body.y + (waypoint.y - body.y) / d * step };
    if (allowed(next) && !motionBlocked(next.x, next.y) && clearMotionLine(body, next)) Object.assign(body, next);
    else nav.path = [];
    return dist(old, body);
  }
  target(e: DefenseHostile, player: Point & { hp: number }) {
    const guards = this.state.guards.filter(g => !g.dead && (g.space??"village")==="village" && GUARD_DEFS.find(d => d.id === g.id)!.role === "melee");
    const all = [...guards, ...(player.hp > 0 && dist(e, player) < 380 ? [{ ...player, id: "player" }] : [])]
      .filter(p => this.external.includes(e) ? dist(p,{x:e.homeX,y:e.homeY}) <= 420 : dist(p,this.gate()) < 600)
      .sort((a, b) => dist(e, a) - dist(e, b) || a.id.localeCompare(b.id));
    return ((e.playerAggroUntil ?? 0) > this.now && all.find(p => p.id === "player")) || all[0];
  }
  update(now: number, dtMs: number, player: Point & { hp: number }, budget: { queries: number }, view?: Rect, occupied: readonly Point[] = []) {
    this.now = now; const dt = dtMs / 1000, contacts: EnemyContact[] = [];
    this.schedule(dtMs, player, view, occupied);
    this.timerCheckpoint += dtMs;
    if (this.timerCheckpoint >= RAID_TIMING.checkpoint) { this.timerCheckpoint = 0; this.critical = true; }
    const raid = this.state.raid;
    if (raid?.phase === "warning") {
      if (!this.awaitingCheckpoint) raid.ageMs = Math.min(RAID_TIMING.warning, raid.ageMs + dtMs);
      if (raid.ageMs >= RAID_TIMING.warning) {
        if (!spawnLegal(raid.gateId, raid.spawns, player, view, occupied)) this.finish(true);
        else { raid.phase = "approach"; raid.ageMs = 0; this.spawnEnemies(now); this.critical = true;
          this.note({kind:"started", id:this.gate().name, at:now}); }
      }
    } else if (raid) { raid.ageMs = Math.min(DEFENSE.eventLimit, raid.ageMs + dtMs);
      if (raid.ageMs >= 90000) raid.phase = "retreat"; }
    for (const e of this.hostiles()) {
      const fixed = this.external.includes(e);
      if (e.hp <= 0 || e.disabled) continue;
      if(e.attack&&!e.attack.cancelled){
        const frozen=Math.max(0,Math.min(now,e.staggerUntil)-Math.max(now-dtMs,e.staggerSince??now-dtMs));
        delayEnemyAttack(e.attack,frozen);
      }
      const selected = this.target(e, player);
      const held = e.targetId === "player" ? (player.hp > 0 ? { ...player, id: "player" } : undefined)
        : this.state.guards.find(g => g.id === e.targetId && !g.dead && (g.space??"village")==="village");
      const target = e.attack ? held : selected;
      if (e.attack && (!target || dist(e, target) > 450 || !fixed && raid?.phase === "retreat")) {
        e.attack.cancelled = true; e.attack = null; e.cool = now + 250;
      }
      if (now < e.staggerUntil) { e.ai = "硬直"; continue; }
      if (e.attack && target) {
        const event = advanceEnemyAttack(e.attack,e,target,now,fixed ? enemyAttackSpace(e) : undefined);
        e.windup = Math.max(0, e.attack.contactAt - now); e.ai = "攻击";
        if (event && target.id === "player") contacts.push(event);
        else if (event) { event.attack.resolved = true;
          this.damageGuard({ sourceId: e.id, targetId: target!.id, attackId: event.attack.attackId,
            amount: event.attack.damage, sourceType: "enemy-melee", eventId: e.eventId ?? null }, e); }
        if (now >= e.attack.recoveryUntil || e.attack.cancelled) e.attack = null;
        continue;
      }
      e.targetId = target?.id ?? null;
      const destination = !fixed && raid?.phase === "retreat" ? { x: e.homeX, y: e.homeY } : target ?? (fixed ? {x:e.homeX,y:e.homeY} : this.gate().inside);
      if (target && (fixed || raid?.phase !== "retreat") && dist(e, target) < 73 && clearMeleeLine(e, target) && now >= e.cool) {
        e.attack = createEnemyAttack(e.id, e.attackSerial = (e.attackSerial ?? 0) + 1, e.type, now, e, target);
        e.cool = e.attack.recoveryUntil + 850; e.ai = "前摇";
        if (raid && !fixed) raid.phase = "fighting";
      } else if (dist(e, destination) > (target ? 43 : 8)) {
        this.move(e, e.nav, destination, DEFENSE.enemySpeed, dt, budget,
          p => fixed ? dist(p,{x:e.homeX,y:e.homeY}) <= 420 : dist(p,this.gate()) < 700, this.hostiles().filter(p => p.hp > 0 && p !== e));
        e.ai = raid?.phase === "retreat" ? "撤离" : "接近目标";
      } else e.ai = "等待冷却";
    }
    for (const g of this.state.guards) {
      if (g.dead) continue;
      const d = GUARD_DEFS.find(d => d.id === g.id)!, r = this.runtime.get(g.id)!, weapon = GUARD_WEAPONS[g.weaponId];
      const old={x:g.x,y:g.y};
      // 返回通道遭遇真实敌人时，近战守卫在岗位约束内立即交还战斗控制权。
      if(g.offDuty&&g.mode==='return'&&d.role==='melee'&&(g.space??'village')==='village'&&dist(g,d.post)<=d.leash&&this.hostiles().some(e=>e.hp>0&&!e.disabled&&dist(e,d.post)<=d.leash&&dist(e,g)<100&&clearMeleeLine(g,e))){g.offDuty=false;g.mode='post';this.peaceOrders.delete(g.id);}
      if(g.offDuty&&this.lifeMove){
        r.attack=null;r.moved=0;
        const apron=GUARD_LANDINGS[g.id]??{space:"village" as const,x:d.post.x,y:d.post.y+40};
        if((g.towerTransitMs??0)>0){g.towerTransitMs=Math.max(0,g.towerTransitMs!-dtMs);
          if(!g.towerTransitMs){if(g.mode==="return"){Object.assign(g,d.post);g.offDuty=false;g.mode="post";}else Object.assign(g,apron);}
          continue;}
        const order=this.peaceOrders.get(g.id),destination=order??(d.role==="archer"?apron:{space:"village" as const,...d.post});
        const close=(g.space??"village")===destination.space&&dist(g,destination)<6;
        if(!close)r.moved=this.lifeMove(g,destination,dtMs,budget);
        else if(!order){if(d.role==="archer"){g.mode="return";g.towerTransitMs=1800;}else{g.offDuty=false;g.mode="post";}}
        if(r.moved>.001){const dx=g.x-old.x,dy=g.y-old.y;r.distance+=r.moved;r.facing=Math.abs(dx)>Math.abs(dy)?dx<0?2:3:dy<0?1:0;}
        g.peaceMs=Math.min(8000,g.peaceMs+dtMs);if(g.peaceMs>=8000)g.hp=Math.min(d.maxHP,g.hp+d.maxHP*DEFENSE.regenPerSecond*dt);
        continue;
      }
      g.cooldownMs = Math.max(0, g.cooldownMs - dtMs); r.moved = 0;
      const targets = this.hostiles().filter(e => (!this.external.includes(e) || dist(e,d.post) <= 300) && e.hp > 0 && !e.disabled && dist(e, d.post) <= (d.role === "archer" ? TOWERS.find(t => t.occupantGuardId === g.id)!.range : d.leash));
      targets.sort((a, b) => dist(g, a) - dist(g, b) || a.id.localeCompare(b.id));
      let target = targets[0];
      if (d.role === "archer") {
        const tower = TOWERS.find(t => t.occupantGuardId === g.id)!, gate = RAID_GATES.find(p => p.id === tower.gateId)!;
        target = targets.filter(e => this.inFiringArc(g.id, e) &&
          !shotLineBlocker(tower.muzzle, { x:e.x, y:e.y-30 }, this.portFor(g.id)))
          .sort((a,b) => (a.targetId && a.targetId !== "player" ? -100 : 0) + dist(a,gate) -
            (b.targetId && b.targetId !== "player" ? -100 : 0) - dist(b,gate))[0];
      }
      g.peaceMs = target ? 0 : Math.min(DEFENSE.regenWait, g.peaceMs + dtMs);
      if (!target && g.peaceMs >= DEFENSE.regenWait) g.hp = Math.min(d.maxHP, g.hp + d.maxHP * DEFENSE.regenPerSecond * dt);
      const retreat = d.role === "melee" && (g.hp <= d.maxHP * DEFENSE.retreatHP ||
        ["retreat", "recover"].includes(g.mode) && g.hp < d.maxHP * DEFENSE.resumeHP);
      if (retreat) { r.attack = null; g.mode = dist(g, d.cover) < 5 ? "recover" : "retreat";
        r.moved = this.move(g, r.nav, d.cover, DEFENSE.speed, dt, budget, p => dist(p, d.post) <= d.leash,
          [...this.state.guards.filter(p => !p.dead && p !== g), player]);
      } else if (r.attack) {
        g.mode = "attack";
        const attack = r.attack, victim = this.hostiles().find(e => e.id === attack.targetId && e.hp > 0);
        if (!attack.hit && now >= attack.contact) {
          attack.hit = true;
          if (victim && d.role === "archer") this.fire(g, victim, attack.id);
          else if (victim && dist(g, victim) <= weapon.range + 8 && clearMeleeLine(g, victim))
            this.damageEnemy(victim, { sourceId: g.id, targetId: victim.id, attackId: attack.id,
              amount: weapon.damage, sourceType: "guard-melee", eventId: victim.eventId ?? null }, g.hp);
        }
        if (now >= attack.end) r.attack = null;
      } else if (target) {
        if (d.role === "archer" || dist(g, target) < weapon.range && clearMeleeLine(g, target)) {
          g.mode = "attack";
          if (g.cooldownMs === 0) {
            const n = Math.max(1, dist(g, target)), direction = { x: (target.x - g.x) / n, y: (target.y - g.y) / n };
            r.attack = { id: `${g.id}:${++r.serial}`, start: now, contact: now + weapon.windup,
              end: now + weapon.windup + 220, targetId: target.id, hit: false, direction };
            g.cooldownMs = weapon.cooldown;
            r.facing = Math.abs(direction.x) > Math.abs(direction.y) ? direction.x < 0 ? 2 : 3 : direction.y < 0 ? 1 : 0;
          }
        } else { g.mode = "intercept";
          r.moved = this.move(g, r.nav, target, DEFENSE.speed, dt, budget, p => dist(p, d.post) <= d.leash,
            [...this.state.guards.filter(p => !p.dead && p !== g), player]); }
      } else {
        const post = d.patrol[r.patrol % d.patrol.length];
        g.mode = d.role === "archer" || d.patrol.length === 1 ? "post" : "patrol";
        if (d.role !== "archer" && dist(g, post) > 3)
          r.moved = this.move(g, r.nav, post, DEFENSE.speed * 0.45, dt, budget, p => dist(p, d.post) <= d.leash,
            [...this.state.guards.filter(p => !p.dead && p !== g), player]);
        else r.patrol++;
      }
      if(r.moved>.001){const dx=g.x-old.x,dy=g.y-old.y;
        r.distance+=r.moved;
        r.facing=Math.abs(dx)>Math.abs(dy)?dx<0?2:3:dy<0?1:0;}
    }
    this.updateArrows(dtMs);
    if (this.state.raid && this.state.raid.phase !== "warning" && (this.enemies.every(e => e.hp <= 0) || raid?.phase === "retreat" &&
      (raid.ageMs >= DEFENSE.eventLimit || this.enemies.filter(e => e.hp > 0).every(e => dist(e, { x:e.homeX,y:e.homeY }) < 10)))) this.finish();
    this.sync(); return contacts;
  }
  inFiringArc(guardId: string, target: Point) {
    const tower = TOWERS.find(t => t.occupantGuardId === guardId); if (!tower) return false;
    const dx = target.x - tower.muzzle.x, dy = target.y - 30 - tower.muzzle.y;
    return (dx*tower.outward.x + dy*tower.outward.y) / Math.max(1,Math.hypot(dx,dy)) >= .35;
  }
  fire(g: GuardState, target: DefenseHostile, id: string) {
    const tower = TOWERS.find(t => t.occupantGuardId === g.id);
    if (!tower || g.dead || g.offDuty || (g.space??"village")!=="village" || dist(g, tower) > 2 || this.arrows.length >= DEFENSE.arrowLimit || !this.inFiringArc(g.id,target) ||
      shotLineBlocker(tower.muzzle,{x:target.x,y:target.y-30},this.portFor(g.id))) return;
    const end = { x:target.x,y:target.y-30 }, n = dist(tower.muzzle,end);
    this.arrows.push({ id,sourceId:g.id,eventId:target.eventId ?? "world",...tower.muzzle,origin:{...tower.muzzle},
      vx:(end.x-tower.muzzle.x)/n*DEFENSE.arrowSpeed,vy:(end.y-tower.muzzle.y)/n*DEFENSE.arrowSpeed,
      age:0,travelled:0,damage:GUARD_WEAPONS[g.weaponId].damage,hit:new Set() });
    this.note({kind:"shot",id,sourceId:g.id,at:this.now});
  }
  updateArrows(ms: number) {
    this.arrows = this.arrows.filter(a => {
      a.age += ms;
      const next = { x: a.x + a.vx * ms / 1000, y: a.y + a.vy * ms / 1000 };
      if (a.age > DEFENSE.arrowLife || shotLineBlocker(a.origin, next, this.portFor(a.sourceId))) return false;
      const dx = next.x - a.x, dy = next.y - a.y;
      const hits = this.hostiles().filter(e => e.hp > 0 && !a.hit.has(e.id)).map(e => {
        const u = Math.max(0, Math.min(1, ((e.x - a.x) * dx + (e.y - 30 - a.y) * dy) / (dx * dx + dy * dy || 1)));
        return { e, u, d: Math.hypot(a.x + dx * u - e.x, a.y + dy * u - e.y + 30) };
      }).filter(h => h.d <= 24).sort((a, b) => a.u - b.u || a.e.id.localeCompare(b.e.id));
      if (hits[0]) {
        const e = hits[0].e; a.hit.add(e.id);
        const g = this.state.guards.find(g => g.id === a.sourceId);
        if (g && !g.dead) this.damageEnemy(e, { sourceId: a.sourceId, targetId: e.id, attackId: a.id,
          amount: a.damage, sourceType: "tower-arrow", eventId: a.eventId }, g.hp);
        return false;
      }
      a.travelled += dist(a, next); Object.assign(a, next); return true;
    });
  }
  sync() {
    if (!this.state.raid) return;
    for (const m of this.state.raid.members) {
      const e = this.enemies.find(e => e.id === m.id); if (!e) continue;
      Object.assign(m, { x: e.x, y: e.y, hp: e.hp, cooldownMs: Math.min(5000, Math.max(0, e.cool - this.now)), targetId: e.targetId });
    }
  }
  snapshot() { return { ...structuredClone(this.state), arrows: this.arrows.map(a => ({ ...a, hit: [...a.hit] })),
    units: this.state.guards.map(g => ({ ...g, ...this.runtime.get(g.id), definition: GUARD_DEFS.find(d => d.id === g.id) })),
    enemies: this.enemies.map(e => ({ ...e })), history: [...this.history], critical: this.critical, awaitingCheckpoint: this.awaitingCheckpoint }; }
}
