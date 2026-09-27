import {inProtected} from "../../data/defenseZones";
import { enemyDefs } from "../../data/world";
import { createEnemyAttack, advanceEnemyAttack, ENEMY_ATTACK, delayEnemyAttack, sampleEnemyAttack, type EnemyAttack, type EnemyContact } from "./enemyAttack";
import { enemyKind, enemyProfile } from '../../data/enemies';
import {
  clearMotionLine,
  clearMeleeLine,
  motionBlocked,
  meleeBlocker,
  type Point,
} from "./obstacles";
export const NAV = {
  cell: 20,
  radius: 480,
  nodes: 1536,
  interval: 600,
  repairRadius: 160,
  repairCandidates: 512,
  repairPaths: 8,
  queriesPerFrame: 2,
} as const;
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
type Space = {
  blocked: (x: number, y: number) => boolean;
  clear: (a: Point, b: Point) => boolean;
};
const space: Space = { blocked: motionBlocked, clear: clearMotionLine };

// 小地图的有界局部A*；每条边连续检查脚底扫掠，不穿角、不跨水。
export function* pathSearch(
  start: Point,
  goal: (p: Point) => boolean,
  target: Point,
  allowed: (p: Point) => boolean,
  query: Space = space,
  limits: {radius:number;nodes:number} = NAV,
): Generator<void, { path: Point[] | null; visited: number }> {
  const nodes = [
    { p: { ...start }, g: 0, f: distance(start, target), parent: -1 },
  ];
  const open = [0],
    seen = new Map<string, number>([["0,0", 0]]),
    closed = new Set<number>();
  let visited = 0;
  while (open.length && visited < limits.nodes) {
    let best = 0;
    for (let i = 1; i < open.length; i++)
      if (nodes[open[i]].f < nodes[open[best]].f) best = i;
    const index = open.splice(best, 1)[0],
      node = nodes[index];
    if (closed.has(index)) continue;
    closed.add(index);
    visited++;
    if (goal(node.p)) {
      const path: Point[] = [];
      for (let i = index; nodes[i].parent >= 0; i = nodes[i].parent)
        path.unshift(nodes[i].p);
      return { path, visited };
    }
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
      [1, 1],
      [-1, 1],
      [-1, -1],
      [1, -1],
    ]) {
      const p = { x: node.p.x + dx * NAV.cell, y: node.p.y + dy * NAV.cell };
      const key = `${Math.round((p.x - start.x) / NAV.cell)},${Math.round((p.y - start.y) / NAV.cell)}`;
      if (
        distance(p, start) > limits.radius ||
        !allowed(p) ||
        query.blocked(p.x, p.y) ||
        !query.clear(node.p, p)
      )
        continue;
      const g = node.g + Math.hypot(dx, dy) * NAV.cell,
        existing = seen.get(key);
      if (existing !== undefined) {
        if (closed.has(existing) || nodes[existing].g <= g) continue;
        Object.assign(nodes[existing], {
          g,
          f: g + Math.max(0, distance(p, target) - 70),
          parent: index,
        });
      } else {
        // 生成数与展开数都有硬上限，避免不可达目标耗尽全图。
        if (nodes.length >= limits.nodes) continue;
        seen.set(key, nodes.length);
        nodes.push({
          p,
          g,
          f: g + Math.max(0, distance(p, target) - 70),
          parent: index,
        });
        open.push(nodes.length - 1);
      }
    }
    // 每次暂停已完成一个节点的所有边检查；恢复时保留原有优先级与父节点。
    yield;
  }
  return { path: null, visited };
}
export function localPath(...args: Parameters<typeof pathSearch>) {
  const search = pathSearch(...args);
  let result = search.next();
  while (!result.done) result = search.next();
  return result.value;
}
export function nearestStanding(
  origin: Point,
  anchors: Point[],
  allowed: (p: Point) => boolean,
  query: Space = space,
) {
  if (allowed(origin) && !query.blocked(origin.x, origin.y))
    return { ...origin };
  const candidates: Point[] = [];
  for (let x = -NAV.repairRadius; x <= NAV.repairRadius; x += 8)
    for (let y = -NAV.repairRadius; y <= NAV.repairRadius; y += 8)
      if (Math.hypot(x, y) <= NAV.repairRadius)
        candidates.push({ x: origin.x + x, y: origin.y + y });
  candidates.sort((a, b) => distance(a, origin) - distance(b, origin));
  let paths = 0;
  const safeAnchors = anchors.filter(
    (p) => allowed(p) && !query.blocked(p.x, p.y),
  );
  for (const p of candidates.slice(0, NAV.repairCandidates)) {
    if (!allowed(p) || query.blocked(p.x, p.y)) continue;
    if (safeAnchors.some((a) => query.clear(p, a))) return p;
    if (paths >= NAV.repairPaths) break;
    for (const anchor of safeAnchors) {
      if (++paths > NAV.repairPaths) break;
      if (
        localPath(
          p,
          (q) => distance(q, anchor) < 30 && query.clear(q, anchor),
          anchor,
          allowed,
          query,
        ).path
      )
        return p;
    }
  }
  return null;
}
export function repairEnemyPoint(origin: Point, home: Point) {
  // 固定野怪仍受原420回家半径约束；安全来自实体，不再依赖玩家横坐标。
  const allowed = (p: Point) =>
    distance(p, home) <= 420;
  const anchors = [
    home,
    ...enemyDefs.map((d) => ({ x: d.x, y: d.y })),
    { x: home.x, y: 1100 },
  ];
  return nearestStanding(origin, anchors, allowed);
}
export type EnemyBody = Point & {
  id: string;
  type: string;
  hp: number;
  homeX: number;
  homeY: number;
  cool: number;
  windup: number;
  staggerUntil: number;
  staggerSince?: number;
  attack?: EnemyAttack | null;
  attackSerial?: number;
  targetId?: string | null;
  playerAggroUntil?: number;
  parried?: {at:number;until:number;direction:Point;perfect:boolean};
  wallHit?: {at:number;until:number};
  nav: {
    path: Point[];
    target?: Point;
    mode?: "chase" | "return";
    next: number;
    failed: boolean;
    returning: boolean;
    queries: number;
    visited: number;
  };
  ai: string;
  rejection?: string;
  disabled: boolean;
  recovered: boolean;
};
export const enemyNavigation = (): EnemyBody["nav"] => ({
  path: [],
  next: 0,
  failed: false,
  returning: false,
  queries: 0,
  visited: 0,
});
export function enemyAttackSpace(e:Pick<EnemyBody,"homeX"|"homeY">) {
  return {blocked:(x:number,y:number)=>motionBlocked(x,y)||distance({x,y},{x:e.homeX,y:e.homeY})>420,clear:clearMotionLine,melee:clearMeleeLine,
    // 家园边界只停止追击；只有真正的地形或障碍接触才播放撞墙失衡。
    wall:(a:Point,b:Point)=>motionBlocked(b.x,b.y)||!clearMotionLine(a,b)};
}
export const enemyAttackPermitted=(e:Pick<EnemyBody,"homeX"|"homeY">,player:Point)=>distance(player,{x:e.homeX,y:e.homeY})<=520;
export function staggerEnemy(e:Pick<EnemyBody,"staggerUntil"|"staggerSince">,now:number,duration:number) {
  e.staggerUntil=Math.max(e.staggerUntil,now+duration);
  e.staggerSince=now;
}
export function validateEnemyPosition(e: EnemyBody) {
  if (e.hp <= 0 || e.disabled) return;
  if (!motionBlocked(e.x, e.y) && !motionBlocked(e.homeX, e.homeY)) return;
  const point = repairEnemyPoint(e, { x: e.homeX, y: e.homeY });
  e.recovered = true;
  e.windup = 0;
  if(e.attack)e.attack.cancelled=true;
  e.attack=null;
  e.nav = enemyNavigation();
  if (!point) {
    e.disabled = true;
    e.ai = "无合法位置";
    return;
  }
  Object.assign(e, point, { homeX: point.x, homeY: point.y });
}
export function updateEnemy(
  e: EnemyBody,
  player: Point,
  now: number,
  dtMs: number,
  budget?: {queries:number},
): EnemyContact | null {
  const dt = dtMs/1000, prev=now-dtMs;
  if (e.hp <= 0 || e.disabled) {
    e.ai = e.hp <= 0 ? "死亡" : "无合法位置";
    return null;
  }
  validateEnemyPosition(e);
  if (e.disabled) return null;
  const d = distance(e, player),
    home = { x: e.homeX, y: e.homeY };
  const safe = enemyAttackPermitted(e,player);
  e.rejection = !safe
    ? "家园追击边界"
    : d >= enemyProfile(e.type).reach
      ? "距离"
      : meleeBlocker(e, player);
  if(e.attack&&!e.attack.cancelled) {
    const frozen=Math.max(0,Math.min(now,e.staggerUntil)-Math.max(prev,e.staggerSince??prev));
    delayEnemyAttack(e.attack,frozen);
    e.windup=Math.max(0,e.attack.contactAt-now);
  }
  if (now < e.staggerUntil) {
    e.ai = "硬直";
    return null;
  }
  // 从局部驻防交还给野怪AI时，不把未释放的守卫攻击转嫁给玩家。
  if(e.attack&&e.targetId&&e.targetId!=="player"){e.attack.cancelled=true;e.attack=null;e.cool=now+250;}
  if (e.attack) {
    const attack=e.attack;
    const contact=advanceEnemyAttack(attack,e,player,now,enemyAttackSpace(e));
    e.windup=attack.cancelled?0:Math.max(0,attack.contactAt-now);
    e.ai=attack.cancelled?"攻击取消":({charge:"蓄力",commit:"锁向承诺",active:"真正出手",recovery:"收招"}[sampleEnemyAttack(attack,now,e).phase]);
    if(contact)e.cool=contact.at+ENEMY_ATTACK[enemyKind(e.type)].cooldown;
    if(attack.wallAt!==undefined){e.wallHit={at:attack.wallAt,until:attack.wallAt+850};staggerEnemy(e,attack.wallAt,850);e.cool=attack.wallAt+1400;e.ai='撞墙失衡';}
    if(now>=attack.recoveryUntil||attack.cancelled)e.attack=null;
    return contact;
  }
  const profile=enemyProfile(e.type);
  if (d < profile.reach && now > e.cool && safe && clearMeleeLine(e, player)) {
    e.targetId="player";
    e.attack=createEnemyAttack(e.id,e.attackSerial=(e.attackSerial??0)+1,e.type,now,e,player);
    e.cool=e.attack.contactAt+ENEMY_ATTACK[enemyKind(e.type)].cooldown;
    e.windup = e.attack.contactAt-now;
    e.ai = "前摇";
    e.nav.path = [];
    return null;
  }
  // 近郊不主动吸引远处野怪；已在追击或被玩家挑衅的敌人继续受原家园边界约束。
  const engaged=e.nav.mode==="chase"&&!e.nav.returning||(e.playerAggroUntil??0)>now;
  const canChase = d < 380 && safe && distance(e, home) < 420 && (!inProtected(player)||engaged);
  if (!canChase && distance(e, home) > 8) e.nav.returning = true;
  if (e.nav.returning && distance(e, home) <= 8) e.nav.returning = false;
  const chase = canChase && !e.nav.returning;
  let target = chase ? player : home;
  // 镰灵远处侧向接近；近身仍走向真实目标，不改攻击方向与碰撞。
  if(chase&&e.type==='leaf'&&d>145){const sign=e.id.endsWith('2')?-1:1,dx=(e.x-player.x)/d,dy=(e.y-player.y)/d;
    const flank={x:player.x-dy*75*sign,y:player.y+dx*75*sign};if(!motionBlocked(flank.x,flank.y)&&distance(flank,home)<420)target=flank;}
  // 孢卫进入中距离后等待喷射冷却，玩家过近时只在合法空间后撤。
  if(chase&&e.type==='spore'&&d<155){const retreat={x:e.x+(e.x-player.x)/(d||1)*65,y:e.y+(e.y-player.y)/(d||1)*65};
    if(distance(retreat,home)<420&&!motionBlocked(retreat.x,retreat.y)&&clearMotionLine(e,retreat))target=retreat;}
  const
    mode = chase ? "chase" : "return";
  const reached = (p: Point) =>
    chase
      ? (e.type==='spore'?distance(p,player)>=155&&distance(p,player)<270:distance(p, player) < Math.max(70,profile.reach-10)) && clearMeleeLine(p, player)
      : distance(p, home) <= 8;
  if (reached(e)) {
    e.ai = chase ? "等待冷却" : "家园";
    e.nav.path = [];
    return null;
  }
  const allowed = (p: Point) =>
    distance(p, home) <= (chase ? 420 : Math.max(420, distance(e, home) + 1));
  const changed =
    e.nav.mode !== mode ||
    !e.nav.target ||
    distance(e.nav.target, target) >= 32;
  let waypoint: Point | undefined;
  if (allowed(target) && clearMotionLine(e, target)) {
    waypoint = target;
    e.nav.path = [];
    e.nav.failed = false;
  } else {
    if (
      now >= e.nav.next &&
      (changed || (!e.nav.failed && !e.nav.path.length)) &&
      (!budget||budget.queries>0)
    ) {
      if(budget)budget.queries--;
      const result = localPath(
        e,
        chase
          ? reached
          : (q) => distance(q, home) < 30 && clearMotionLine(q, home),
        target,
        allowed,
      );
      if (!chase && result.path) result.path.push(home);
      e.nav.path = result.path ?? [];
      e.nav.target = { ...target };
      e.nav.mode = mode;
      e.nav.next = now + NAV.interval;
      e.nav.failed = result.path === null;
      e.nav.queries++;
      e.nav.visited = result.visited;
    }
    while (e.nav.path.length && distance(e, e.nav.path[0]) < 0.01)
      e.nav.path.shift();
    waypoint = e.nav.path[0];
  }
  if (!waypoint) {
    e.ai = e.nav.failed ? "无路径等待" : "等待查询";
    return null;
  }
  const length = distance(e, waypoint),
    step = Math.min(length, profile.speed * dt);
  const next = {
    x: e.x + ((waypoint.x - e.x) / length) * step,
    y: e.y + ((waypoint.y - e.y) / length) * step,
  };
  if (
    length > 0 &&
    allowed(next) &&
    !motionBlocked(next.x, next.y) &&
    clearMotionLine(e, next)
  ) {
    Object.assign(e, next);
    e.ai = chase ? (e.nav.path.length ? "绕障" : "追击") : "回家";
  } else {
    e.nav.path = [];
    e.ai = "受阻等待";
  }
  return null;
}
