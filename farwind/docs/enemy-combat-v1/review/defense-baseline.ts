import { GUARD_LANDINGS, type Place } from '../../data/npcLife';
import type {GuardId} from '../../data/defense';
import { DEFENSE, DEFENSE_RULES, raidInterval, TOWERS, RAID_GATES, RAID_TIMING, GUARD_DEFS, GUARD_WEAPONS, GUARD_ARMOR, type GateId } from "../../data/defense";
import { props } from "../../data/world";
import { regionAt, inPolygon } from "../../data/village";
import { localPath, nearestStanding, enemyNavigation, enemyAttackSpace, type EnemyBody, NAV } from "./enemy";
import { motionBlocked, clearMotionLine, clearMeleeLine, shotLineBlocker, shotLineImpact, type Point, type Rect, type FiringPort } from "./obstacles";
import { createEnemyAttack, advanceEnemyAttack, delayEnemyAttack, type EnemyContact } from "./enemyAttack";
import { resolveDamage, resolveReleasedDamage, type ReleasedAttack, type DamageEvent } from "./damage";
import type { DefenseState, GuardState } from "./defenseState";
import {DEFENSE_ZONES,zoneFor,inProtected,locallyProtected,inAlert,inActivity,routeRemaining} from '../../data/defenseZones';
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export type DefenseEnemy = EnemyBody & { kind: "defense-enemy"; eventId: string; flashUntil: number;
  targetId: string | null; playerAggroUntil: number; maxHP: number };
export type DefenseHostile = EnemyBody & {eventId?:string; flashUntil:number; maxHP?:number};
// 生活系统拥有平民生命与空间，驻防只读取合法室外目标并回传真实接触。
export type CivilianTarget = Point & { id: string; hp: number };
type GuardAttack = { id: string; start: number; contact: number; end: number; targetId: string; hit: boolean; direction: Point };
type GuardRuntime = { nav: EnemyBody["nav"]; attack: GuardAttack | null; serial: number; patrol: number;
  facing: 0 | 1 | 2 | 3; moved: number; distance: number; flashUntil: number; targetId:string|null; chaseMs:number; blockedTarget:string|null; blockedUntil:number; stuckMs:number };
export type Threat = {id:string;gateId:GateId;reason:"intrusion"|"attack"|"approach"|"observe";lastSeen:number;progress:number;approachMs:number;lastProgress:number;assigned:string[]};
export type DefenseArrow = { id: string; sourceId: string; eventId: string; x: number; y: number;
  origin: Point; vx: number; vy: number; age: number; damage: number; travelled: number; hit: Set<string>; released:ReleasedAttack;port:Readonly<FiringPort> };
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
      inProtected(p) || !inPolygon(p,zoneFor(gateId).spawn) || dist(p, player) < 220 || occupied.some(q => dist(p, q) < 60) || motionBlocked(p.x, p.y) ||
      view && p.x > view.left - 100 && p.x < view.right + 100 && p.y > view.top - 100 && p.y < view.bottom + 100) return false;
    return !!localPath(p, q => dist(q, gate.entry) < 25 && clearMotionLine(q, gate.entry), gate.entry, q => dist(q, gate) <= 480).path;
  }) && !!localPath(gate.entry, q => dist(q, gate.inside) < 25 && clearMotionLine(q, gate.inside),
    gate.inside, q => dist(q, gate) <= 480).path;
}
export function prepareRaid(s: DefenseState, player: Point, gateId: GateId, count = 3, warning = false, view?: Rect, occupied: readonly Point[] = []): DefenseState {
  if (s.raid) throw Error("已有演练或来袭正在进行，不能重复生成。");
  if (s.sequence >= 1e9) throw Error("来袭序号已到上限。");
  if (!Number.isInteger(count) || count < 1 || count > DEFENSE.unitLimit) throw Error("来袭人数无效。");
  const gate = RAID_GATES.find(g => g.id === gateId);
  if (!gate) throw Error("出口未开放。");
  const spawns = gate.spawns.slice(0, count).map(p => ({...p}));
  if (!spawnLegal(gateId, spawns, player, view, occupied)) throw Error("城外生成点近身、在视口内或不可达，请稍后再试。");
  const next = structuredClone(s), sequence = ++next.sequence, id = gateId === "east-gate" && !warning ? `east-raid-${sequence}` : `raid-${sequence}`;
  next.raid = { id, sequence, gateId, spawns, phase: warning ? "warning" : "approach", ageMs: 0,
    members: spawns.map((p, i) => ({ id: `${id}:${i + 1}`, type: "slime",
      ...p, hp: 48, cooldownMs: 0, targetId: null })) };
  return next;
}
export function prepareEastRaid(s: DefenseState, player: Point) { return prepareRaid(s, player, "east-gate"); }
export class EastDefense {
  observerSpace="village";
  peaceOrders=new Map<string,Place>();
  lifeMove?: (guard:GuardState,target:Place,ms:number,budget:{queries:number})=>number;
  civilianTargets?: () => CivilianTarget[];
  facilityTargets?: () => CivilianTarget[];
  civilianContact?: (id:string, source:DefenseHostile, contact:EnemyContact) => boolean;
  // 报告时钟沿存档推进，重建后的攻击序号复用不能吞掉新的伤情。
  eventTime?: () => number;
  victim(id:string|null|undefined,player=this.player):CivilianTarget|undefined {
    if(id==='player')return player.hp>0?{...player,id}:undefined;
    return this.state.guards.find(g=>g.id===id&&!g.dead&&(g.space??'village')==='village') ?? this.civilianTargets?.().find(n=>n.id===id) ?? this.facilityTargets?.().find(f=>f.id===id);
  }
  leaveGuard(id:GuardId){const g=this.state.guards.find(g=>g.id===id)!;if(g.dead||g.offDuty)return;g.offDuty=true;g.mode="life";g.towerTransitMs=GUARD_DEFS.find(d=>d.id===id)!.role==="archer"?1800:0;this.runtime.get(id)!.attack=null;}
  recallGuard(id:GuardId){const g=this.state.guards.find(g=>g.id===id)!;this.peaceOrders.delete(id);if(!g.dead&&g.offDuty)g.mode="return";}
  healGuard(id:string,amount:number){const g=this.state.guards.find(g=>g.id===id);if(g&&!g.dead&&amount>0)g.hp=Math.min(GUARD_DEFS.find(d=>d.id===id)!.maxHP,g.hp+Math.min(30,amount));}
  enemies: DefenseEnemy[] = [];
  external: DefenseHostile[] = [];
  threats=new Map<string,Threat>();
  managedIds=new Set<string>();
  ownershipReady=false;
  nextScan=0;
  player:Point & {hp:number}={x:670,y:720,hp:100};
  allHostiles():DefenseHostile[]{return [...this.enemies,...this.external];}
  ownsFixed(e:EnemyBody){return e.hp>0&&!e.disabled&&DEFENSE_ZONES.some(z=>
    (locallyProtected(z.gateId,e)||this.threatReason(z.gateId,e as DefenseHostile)!==null)&&
    (inActivity(z.gateId,e)||inAlert(z.gateId,e)));}
  // 更新所有权在时间片起点冻结，不能移动后重新归属再更新一次。
  manages(e:EnemyBody){return this.ownershipReady?this.managedIds.has(e.id):this.ownsFixed(e);}
  hostiles():DefenseHostile[]{return [...this.enemies,...this.external.filter(e=>this.manages(e))];}
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
  guardGate(id:string):GateId {return TOWERS.find(t=>id.startsWith(t.gateId.split('-')[0]+'-'))!.gateId;}
  guardAllowed(g:GuardState,p:Point){const d=GUARD_DEFS.find(d=>d.id===g.id)!;
    return dist(p,d.post)<=d.leash && (d.role==='archer'?dist(p,d.post)<=2:
      inPolygon(p,g.id.endsWith('-watch')?zoneFor(this.guardGate(g.id)).inside:zoneFor(this.guardGate(g.id)).activity));}
  observed(gateId:GateId,e:DefenseHostile){
    return this.state.guards.some(g=>!g.dead&&!g.offDuty&&(g.space??"village")==="village"&&this.guardGate(g.id)===gateId&&(
      g.id.endsWith('-archer')?dist(e,GUARD_DEFS.find(d=>d.id===g.id)!.post)<=TOWERS.find(t=>t.occupantGuardId===g.id)!.range&&
        !shotLineBlocker(this.portFor(g.id).origin,{x:e.x,y:e.y-30},this.portFor(g.id)):
      dist(g,e)<=DEFENSE_RULES.observationRange&&clearMeleeLine(g,e)));
  }
  attackingProtected(gateId:GateId,e:DefenseHostile){
    if(!e.attack||e.attack.cancelled||e.attack.resolved)return false;
    const victim=this.victim(e.targetId);
    return !!victim&&locallyProtected(gateId,victim);
  }
  threatReason(gateId:GateId,e:DefenseHostile):Exclude<Threat['reason'],'observe'>|null{
    if(e.hp<=0||e.disabled||!inActivity(gateId,e)&&!inAlert(gateId,e))return null;
    const record=this.threats.get(e.id),visible=this.observed(gateId,e);
    if(!visible&&(!record||record.gateId!==gateId||this.now-record.lastSeen>DEFENSE_RULES.lost))return null;
    if(locallyProtected(gateId,e))return 'intrusion';
    if(this.attackingProtected(gateId,e))return 'attack';
    if(this.enemies.includes(e as DefenseEnemy)&&this.state.raid?.phase==='retreat')return null;
    return record?.gateId===gateId&&inAlert(gateId,e)&&record.approachMs>=DEFENSE_RULES.approach&&
      this.now-record.lastProgress<=DEFENSE_RULES.lost&&routeRemaining(gateId,e)<=record.progress+12?'approach':null;
  }
  scanThreats(){
    if(this.now<this.nextScan)return;this.nextScan=this.now+DEFENSE_RULES.scan;
    const alive=this.allHostiles().filter(e=>e.hp>0&&!e.disabled);
    for(const e of alive){
      const zone=DEFENSE_ZONES.find(z=>(inActivity(z.gateId,e)||inAlert(z.gateId,e))&&this.observed(z.gateId,e));
      if(!zone)continue;
      const progress=routeRemaining(zone.gateId,e),old=this.threats.get(e.id),same=old?.gateId===zone.gateId;
      const record:Threat=same?old!:{id:e.id,gateId:zone.gateId,reason:'observe',lastSeen:this.now,progress,approachMs:0,lastProgress:this.now,assigned:[]};
      const elapsed=Math.min(DEFENSE_RULES.scan*2,this.now-record.lastSeen);
      if(same&&progress<record.progress-1){record.approachMs+=elapsed;record.lastProgress=this.now;}
      else if(progress>record.progress+12||this.now-record.lastProgress>DEFENSE_RULES.lost)record.approachMs=0;
      record.progress=progress;record.lastSeen=this.now;this.threats.set(e.id,record);
      record.reason=this.threatReason(zone.gateId,e)??'observe';
    }
    for(const [id,record]of this.threats)if(!alive.some(e=>e.id===id)||this.now-record.lastSeen>DEFENSE_RULES.lost)this.threats.delete(id);
  }
  eligible(g:GuardState,e:DefenseHostile){
    const d=GUARD_DEFS.find(d=>d.id===g.id)!,gate=this.guardGate(g.id);
    if(g.dead||g.offDuty||(g.space??"village")!=="village"||g.hp<=0||!this.threatReason(gate,e))return false;
    if(d.role==='archer'){const tower=TOWERS.find(t=>t.occupantGuardId===g.id)!;
      return dist(g,tower)<=2&&dist(e,tower)<=tower.range&&this.inFiringArc(g.id,e)&&
        !shotLineBlocker(tower.muzzle,{x:e.x,y:e.y-30},this.portFor(g.id));}
    // 允许识别警戒带逼近者并前往固定拦截点，移动硬边界仍只约束卫兵。
    return this.guardAllowed(g,g);
  }
  canScheduleAtGate(gateId:GateId,player:Point,spawns:readonly Point[],view?:Rect,occupied:readonly Point[]=[]){
    const raid=this.state.raid;
    if(raid&&(raid.phase!=='warning'||raid.gateId!==gateId)||!raid&&(this.state.protectionMs||this.state.cooldownMs||this.state.retryMs)||
      occupied.length+this.state.guards.filter(g=>!g.dead).length+spawns.length>24)return false;
    const defs=GUARD_DEFS.filter(d=>this.guardGate(d.id)===gateId);
    if(defs.length!==3||!defs.every(d=>{const g=this.state.guards.find(g=>g.id===d.id),r=this.runtime.get(d.id);
      return g&&!g.dead&&!g.offDuty&&(g.space??"village")==="village"&&g.hp>=d.maxHP*DEFENSE_RULES.health&&g.postId===d.postId&&
        ['post','patrol'].includes(g.mode)&&!r?.attack&&
        (d.role==='archer'?dist(g,d.post)<=2:this.guardAllowed(g,g)&&!motionBlocked(g.x,g.y));}))return false;
    return !this.allHostiles().some(e=>this.threatReason(gateId,e)!==null)&&spawnLegal(gateId,spawns,player,view,occupied);
  }
  returnGuard(g:GuardState){const r=this.runtime.get(g.id)!;
    if(r.targetId){r.blockedTarget=r.targetId;r.blockedUntil=this.now+DEFENSE_RULES.reacquire;}
    r.targetId=null;r.chaseMs=r.stuckMs=0;r.attack=null;r.nav.path=[];r.nav.target=undefined;g.mode='return';
  }

  finish(delayed = false) {
    const raid = this.state.raid; if (!raid) return;
    this.state.completedSequence = raid.sequence; this.state.raid = null; this.enemies = [];
    this.state.seed = nextRandom(this.state.seed);
    this.state.cooldownMs = delayed ? 0 : raidInterval(this.state.seed);
    this.state.retryMs = delayed ? RAID_TIMING.retry : 0; this.awaitingCheckpoint = false;
    this.critical = true; this.note({kind:delayed ? "delayed" : "ended", id:raid.id, at:this.now});
  }
  constructor(public state: DefenseState, now: number) { this.restore(now); }
  // 交易只换状态副本；运行中的攻击与箭矢不重建、不补伤害。
  rebind(state: DefenseState) { this.state = state; }
  restore(now: number) {
    this.now = now; this.arrows = []; this.runtime.clear();this.threats.clear();this.managedIds.clear();this.ownershipReady=false;this.nextScan=now;
    for (const g of this.state.guards) {
      const d = GUARD_DEFS.find(d => d.id === g.id)!;
      if (d.role === "archer" && !g.offDuty) Object.assign(g, d.post);
      else if (!g.dead && !g.offDuty && (motionBlocked(g.x, g.y) || !this.guardAllowed(g,g))) {
        const safe = nearestStanding(g, [d.post, d.cover], p => this.guardAllowed(g,p));
        Object.assign(g, safe ?? d.post);
      }
      this.runtime.set(g.id, { nav: enemyNavigation(), attack: null, serial: 0, patrol: 0,
        facing: 3, moved: 0, distance: 0, flashUntil: 0,targetId:null,chaseMs:0,blockedTarget:null,blockedUntil:0,stuckMs:0 });
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
    const receipt=`${event.attackId}:${g.id}:${this.eventTime?.()??this.now}`;
    this.note({ kind: "hit", id: g.id, eventKey:`${receipt}:hit`, sourceId: source.id, at: this.now, damage: hit.damage, x: g.x, y: g.y });
    if (hit.killed) {
      g.dead = true; g.mode = "dead"; g.cooldownMs = 0;
      const r = this.runtime.get(g.id)!; r.attack = null; r.nav.path = [];
      this.critical = true;
      this.note({ kind: "death", id: g.id, eventKey:`${receipt}:death`, sourceId: source.id, at: this.now, x: g.x, y: g.y });
    }
    return true;
  }
  damageEnemy(e: DefenseHostile, event: DamageEvent, source: number|ReleasedAttack) {
    const target={id:e.id,hp:e.hp,faction:'hostile' as const,armor:0};
    const hit=typeof source==='number'?resolveDamage(event,{id:event.sourceId,hp:source,faction:'village',armor:0},target):resolveReleasedDamage(event,source,target);
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
    const localGate=this.enemies.includes(e as DefenseEnemy)?this.gate().id:DEFENSE_ZONES.find(z=>inActivity(z.gateId,e)||inAlert(z.gateId,e))?.gateId;
    const guards = this.state.guards.filter(g => !g.dead && (g.space??"village")==="village" && this.guardGate(g.id)===localGate && GUARD_DEFS.find(d => d.id === g.id)!.role === "melee");
    const civilians=(this.civilianTargets?.()??[]).filter(n=>dist(e,n)<380&&clearMeleeLine(e,n));
    const all = [...guards, ...civilians, ...(player.hp > 0 && dist(e, player) < 380 ? [{ ...player, id: "player" }] : [])]
      .filter(p => this.external.includes(e) ? dist(p,{x:e.homeX,y:e.homeY}) <= 420 : dist(p,this.gate()) < 600)
      .filter(p=>this.external.includes(e)||locallyProtected(this.gate().id,e)||p.id==='player'||dist(e,p)<110)
      .sort((a, b) => dist(e, a) - dist(e, b) || a.id.localeCompare(b.id));
    // 只有已进入居民区且没有可追击人物时才破坏维护点；仍受原来袭纵深约束。
    const facilities=regionAt(e).id==='village' ? (this.facilityTargets?.()??[])
      .filter(f=>dist(e,f)<380&&clearMeleeLine(e,f)&&
        (this.external.includes(e)?dist(f,{x:e.homeX,y:e.homeY})<=420:dist(f,this.gate())<600))
      .sort((a,b)=>dist(e,a)-dist(e,b)||a.id.localeCompare(b.id)) : [];
    return ((e.playerAggroUntil ?? 0) > this.now && all.find(p => p.id === "player")) || all[0] || facilities[0];
  }
  update(now: number, dtMs: number, player: Point & { hp: number }, budget: { queries: number }, view?: Rect, occupied: readonly Point[] = []) {
    this.now = now; const dt = dtMs / 1000, contacts: EnemyContact[] = [];
    this.player=player;this.scanThreats();this.managedIds=new Set(this.external.filter(e=>this.ownsFixed(e)).map(e=>e.id));this.ownershipReady=true;
    this.schedule(dtMs, player, view, occupied);
    this.timerCheckpoint += dtMs;
    if (this.timerCheckpoint >= RAID_TIMING.checkpoint) { this.timerCheckpoint = 0; this.critical = true; }
    const raid = this.state.raid;
    if (raid?.phase === "warning") {
      if (!this.awaitingCheckpoint) raid.ageMs = Math.min(RAID_TIMING.warning, raid.ageMs + dtMs);
      if (raid.ageMs >= RAID_TIMING.warning) {
        if (!this.canScheduleAtGate(raid.gateId, player, raid.spawns, view, occupied)) this.finish(true);
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
      const held = this.victim(e.targetId,player);
      const target = e.attack ? held : selected;
      if (e.attack && (!target || dist(e, target) > 450 || !fixed && raid?.phase === "retreat")) {
        e.attack.cancelled = true; e.attack = null; e.cool = now + 250;
      }
      if (now < e.staggerUntil) { e.ai = "硬直"; continue; }
      if (e.attack && target) {
        const event = advanceEnemyAttack(e.attack,e,target,now,fixed ? enemyAttackSpace(e) : undefined);
        e.windup = Math.max(0, e.attack.contactAt - now); e.ai = "攻击";
        if (event && target.id === "player") contacts.push(event);
        else if (event) {
          if(this.state.guards.some(g=>g.id===target.id))
            this.damageGuard({ sourceId: e.id, targetId: target.id, attackId: event.attack.attackId,
              amount: event.attack.damage, sourceType: "enemy-melee", eventId: e.eventId ?? null }, e);
          else this.civilianContact?.(target.id,e,event);
          event.attack.resolved = true;
        }
        if (now >= e.attack.recoveryUntil || e.attack.cancelled) e.attack = null;
        continue;
      }
      e.targetId = target?.id ?? null;
      const destination = !fixed && raid?.phase === "retreat" ? { x: e.homeX, y: e.homeY } : target ??
        (fixed ? {x:e.homeX,y:e.homeY} : locallyProtected(this.gate().id,e)?this.gate().inside:this.gate().entry);
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
    for(const record of this.threats.values())record.assigned=[];
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
      const gate=this.guardGate(g.id),ranged=d.role==='archer';
      let targets=this.allHostiles().filter(e=>this.eligible(g,e));
      // 守门人只在内侧移动；单个门外目标交给拦截员，突破者或多目标才协防。
      if(g.id.endsWith('-watch'))targets=targets.filter(e=>inPolygon(e,zoneFor(gate).inside)||
        targets.length>1&&dist(g,e)<=weapon.range+8);
      targets.sort((a,b)=>Number(!locallyProtected(gate,a))-Number(!locallyProtected(gate,b))||dist(g,a)-dist(g,b)||a.id.localeCompare(b.id));
      const urgent=targets.find(e=>locallyProtected(gate,e)||this.attackingProtected(gate,e));
      let target=targets.find(e=>!(r.blockedTarget===e.id&&now<r.blockedUntil&&!locallyProtected(gate,e)&&!this.attackingProtected(gate,e)));
      if(g.mode==='return'&&dist(g,d.post)>5)target=urgent;
      const retreat=d.role==='melee'&&(g.hp<=d.maxHP*DEFENSE.retreatHP||
        ['retreat','recover'].includes(g.mode)&&g.hp<d.maxHP*DEFENSE.resumeHP);
      const fighting=!retreat&&(!!target||!!r.attack)||this.allHostiles().some(e=>e.hp>0&&e.attack&&!e.attack.cancelled&&e.targetId===g.id&&dist(e,g)<110);
      g.peaceMs=fighting?0:Math.min(DEFENSE.regenWait,g.peaceMs+dtMs);
      if(!fighting&&g.peaceMs>=DEFENSE.regenWait)g.hp=Math.min(d.maxHP,g.hp+d.maxHP*DEFENSE.regenPerSecond*dt);
      if(retreat){
        if(r.targetId||r.attack)this.returnGuard(g);
        g.mode=dist(g,d.cover)<5?'recover':'retreat';
        r.moved=this.move(g,r.nav,d.cover,DEFENSE.speed,dt,budget,p=>this.guardAllowed(g,p),[...this.state.guards.filter(p=>!p.dead&&p!==g),player]);
      }else{
        if(['retreat','recover'].includes(g.mode))this.returnGuard(g);
        if(target){
          if(r.targetId!==target.id){r.targetId=target.id;r.chaseMs=r.stuckMs=0;r.nav.path=[];r.nav.target=undefined;}
          if(!locallyProtected(gate,target)&&!this.attackingProtected(gate,target))r.chaseMs+=dtMs;else r.chaseMs=0;
          if(!ranged&&r.chaseMs>=DEFENSE_RULES.pursuit){this.returnGuard(g);target=undefined;}
        }else if(r.targetId||r.attack||g.mode==='intercept'||g.mode==='attack')this.returnGuard(g);
        if(target){const record=this.threats.get(target.id);if(record)record.assigned.push(g.id);}
        if(r.attack){
          const attack=r.attack,victim=this.allHostiles().find(e=>e.id===attack.targetId);
          if(!victim||!this.eligible(g,victim)){r.attack=null;this.returnGuard(g);}
          else{
            g.mode='attack';
            if(!attack.hit&&now>=attack.contact){attack.hit=true;
              if(ranged)this.fire(g,victim,attack.id);
              else if(inActivity(gate,victim)&&dist(g,victim)<=weapon.range+8&&clearMeleeLine(g,victim))
                this.damageEnemy(victim,{sourceId:g.id,targetId:victim.id,attackId:attack.id,amount:weapon.damage,sourceType:'guard-melee',eventId:victim.eventId??null},g.hp);
            }
            if(now>=attack.end)r.attack=null;
          }
        }else if(target){
          if(ranged||inActivity(gate,target)&&dist(g,target)<=weapon.range+8&&clearMeleeLine(g,target)){
            g.mode='attack';
            if(g.cooldownMs===0){const n=Math.max(1,dist(g,target)),direction={x:(target.x-g.x)/n,y:(target.y-g.y)/n};
              r.attack={id:`${g.id}:${++r.serial}`,start:now,contact:now+weapon.windup,end:now+weapon.windup+220,targetId:target.id,hit:false,direction};
              g.cooldownMs=weapon.cooldown;r.facing=Math.abs(direction.x)>Math.abs(direction.y)?direction.x<0?2:3:direction.y<0?1:0;
            }
          }else{
            g.mode='intercept';const intercept=zoneFor(gate).intercept;
            const goal=inPolygon(target,zoneFor(gate).inside)||locallyProtected(gate,target)&&dist(g,intercept)<30?target:intercept;
            r.moved=this.move(g,r.nav,goal,DEFENSE.speed,dt,budget,p=>this.guardAllowed(g,p),[...this.state.guards.filter(p=>!p.dead&&p!==g),player]);
            r.stuckMs=r.moved>.001||dist(g,goal)<10?0:r.stuckMs+dtMs;
            if(r.stuckMs>=DEFENSE_RULES.stuck)this.returnGuard(g);
          }
        }else{
          const returning=g.mode==='return',post=returning?d.post:d.patrol[r.patrol%d.patrol.length];
          g.mode=returning?'return':ranged||d.patrol.length===1?'post':'patrol';
          if(!ranged&&dist(g,post)>3)r.moved=this.move(g,r.nav,post,DEFENSE.speed*(returning?1:.45),dt,budget,p=>this.guardAllowed(g,p),[...this.state.guards.filter(p=>!p.dead&&p!==g),player]);
          else if(returning){g.mode=d.patrol.length===1?'post':'patrol';r.nav.path=[];}else r.patrol++;
        }
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
    if (!tower || !this.eligible(g,target) || this.arrows.length >= DEFENSE.arrowLimit) return;
    const end = { x:target.x,y:target.y-30 }, n = dist(tower.muzzle,end);
    this.arrows.push({ id,sourceId:g.id,eventId:target.eventId ?? "world",...tower.muzzle,origin:{...tower.muzzle},
      vx:(end.x-tower.muzzle.x)/n*DEFENSE.arrowSpeed,vy:(end.y-tower.muzzle.y)/n*DEFENSE.arrowSpeed,
      age:0,travelled:0,damage:GUARD_WEAPONS[g.weaponId].damage,hit:new Set(),
      released:Object.freeze({sourceId:g.id,faction:'village',attackId:id,amount:GUARD_WEAPONS[g.weaponId].damage,sourceType:'tower-arrow',eventId:target.eventId??'world'}),
      port:Object.freeze({...this.portFor(g.id),origin:Object.freeze({...tower.muzzle}),lowCoverIds:Object.freeze([...this.portFor(g.id).lowCoverIds])}) });
    this.note({kind:"shot",id,sourceId:g.id,at:this.now});
  }
  updateArrows(ms: number) {
    this.arrows = this.arrows.filter(a => {
      const elapsed=Math.max(0,Math.min(ms,DEFENSE.arrowLife-a.age,(DEFENSE.arrowRange-a.travelled)/DEFENSE.arrowSpeed*1000));
      const next={x:a.x+a.vx*elapsed/1000,y:a.y+a.vy*elapsed/1000},segment=dist(a,next);
      const impact=shotLineImpact(a.origin,next,a.port),wallDistance=impact?dist(a.origin,next)*impact.fraction:Infinity;
      const dx=next.x-a.x,dy=next.y-a.y;
      // 物理候选与威胁列表、AI所有权分开；先命中的墙／单位结算一次。
      const hits=this.allHostiles().filter(e=>e.hp>0&&!e.disabled&&!a.hit.has(e.id)).map(e=>{
        const fx=a.x-e.x,fy=a.y-e.y+30,length=dx*dx+dy*dy,b=2*(fx*dx+fy*dy),c=fx*fx+fy*fy-24*24,disc=b*b-4*length*c;
        const u=c<=0?0:length>0&&disc>=0?(-b-Math.sqrt(disc))/(2*length):Infinity;
        return {e,u};
      }).filter(h=>h.u>=0&&h.u<=1&&a.travelled+segment*h.u<wallDistance).sort((a,b)=>a.u-b.u||a.e.id.localeCompare(b.e.id));
      if(hits[0]){const e=hits[0].e;a.hit.add(e.id);
        this.damageEnemy(e,{sourceId:a.sourceId,targetId:e.id,attackId:a.id,amount:a.damage,sourceType:'tower-arrow',eventId:a.eventId},a.released);return false;
      }
      if(wallDistance<=a.travelled+segment)return false;
      a.age+=elapsed;a.travelled+=segment;Object.assign(a,next);
      return a.age<DEFENSE.arrowLife&&a.travelled<DEFENSE.arrowRange;

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
    threats:[...this.threats.values()].map(t=>({...t,assigned:[...t.assigned]})),managedIds:[...this.managedIds],
    units: this.state.guards.map(g => ({ ...g, ...this.runtime.get(g.id), definition: GUARD_DEFS.find(d => d.id === g.id) })),
    enemies: this.enemies.map(e => ({ ...e })), history: [...this.history], critical: this.critical, awaitingCheckpoint: this.awaitingCheckpoint }; }
}
