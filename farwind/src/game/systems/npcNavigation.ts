import {INTERIOR_FURNITURE,INTERIOR_BEDS,interiorBounds} from '../../data/villageInteriors';
import {mapGeometryRevision} from "../../data/world";
import {
  HOMES,
  PRIVATE_STORAGE,
  FACILITIES,
  ROOM,
  LIFE,
  type Place,
  type SpaceId,
} from "../../data/npcLife";
import { pathSearch, advancePathSearch, enemyNavigation, type EnemyBody, type NavigationBudget } from "./enemy";
import {
  motionBlocked,
  clearMotionLine,
  rectInterval,
  type Point,
} from "./obstacles";
export const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const roomFurniture = (space: SpaceId) => [
  ...INTERIOR_BEDS.filter(b=>b.space===space).map(b=>({left:b.x-40,right:b.x+40,top:b.y-70,bottom:b.y-15})),
  ...INTERIOR_FURNITURE.filter(f=>f.space===space&&f.solid).map(interiorBounds),
  ...PRIVATE_STORAGE.filter((s) => s.space === space).map((s) => ({
    left: s.x - 10,
    right: s.x + 10,
    top: s.y - 12,
    bottom: s.y + 10,
  })),
  { left: 778, right: 882, top: 720, bottom: 778 },
  ...FACILITIES.filter((f) => f.place.space === space).map((f) => ({
    left: f.place.x - 40,
    right: f.place.x + 40,
    top: f.place.y - (f.kind === "bed" ? 70 : 57),
    bottom: f.place.y - (f.kind === "bed" ? 15 : 17),
  })),
];
export function roomBlocked(space: SpaceId, x: number, y: number) {
  return (
    x < ROOM.left + 18 ||
    x > ROOM.right - 18 ||
    y < ROOM.top + 24 ||
    y > ROOM.bottom - 18 ||
    roomFurniture(space).some(
      (r) => x > r.left && x < r.right && y > r.top && y < r.bottom,
    )
  );
}
export function spaceClear(space: SpaceId, a: Point, b: Point) {
  if (space === "village") return clearMotionLine(a, b);
  if (roomBlocked(space, a.x, a.y) || roomBlocked(space, b.x, b.y))
    return false;
  return !roomFurniture(space).some(
    (rect) => rectInterval(a, b, rect) !== null,
  );
}
export const spaceBlocked = (space: SpaceId, x: number, y: number) =>
  space === "village" ? motionBlocked(x, y) : roomBlocked(space, x, y);
// ponytail: 静态家具与地图的有界缓存；改变碰撞布局时需统一失效。
const blockedCache = new Map<string, boolean>(),
  lineCache = new Map<string, boolean>();
let geometryRevision=-1;
function checkGeometry(){if(geometryRevision!==mapGeometryRevision){blockedCache.clear();lineCache.clear();geometryRevision=mapGeometryRevision;}}
const cachedBlocked = (space: SpaceId, x: number, y: number) => {
  checkGeometry();
  const k = `${space}:${x}:${y}`;
  if (!blockedCache.has(k)) {
    if (blockedCache.size > 32000) blockedCache.clear();
    blockedCache.set(k, spaceBlocked(space, x, y));
  }
  return blockedCache.get(k)!;
};
const cachedLine = (space: SpaceId, a: Point, b: Point) => {
  checkGeometry();
  const k = `${space}:${a.x}:${a.y}:${b.x}:${b.y}`;
  if (!lineCache.has(k)) {
    if (lineCache.size > 64000) lineCache.clear();
    lineCache.set(k, spaceClear(space, a, b));
  }
  return lineCache.get(k)!;
};
export type LifeNav = {
  nav: EnemyBody["nav"];
  stuck: number;
  last: Point;
  queries: number;
  batches: number;
  maxExpanded: number;
  search: { iterator: ReturnType<typeof pathSearch>; origin: Point } | null;
  failure: string;
  goal: string;
  progress: Point | null;
};
export const lifeNavigation = (): LifeNav => ({
  nav: enemyNavigation(),
  stuck: 0,
  last: { x: 0, y: 0 },
  queries: 0,
  batches: 0,
  maxExpanded: 0,
  search: null,
  failure: "",
  goal: "",
  progress: null,
});
function recordProgress(body: Point, runtime: LifeNav, ms: number) {
  if (
    runtime.progress &&
    distance(body, runtime.progress) >= LIFE.progressDistance
  ) {
    runtime.progress = { x: body.x, y: body.y };
    runtime.stuck = 0;
  } else runtime.stuck += ms;
}
export function moveLife(
  body: Place,
  target: Place,
  ms: number,
  now: number,
  budget: NavigationBudget,
  runtime: LifeNav,
  safe: (p: Place) => boolean = () => true,
  peers: Place[] = [],
  canEnter: (space: SpaceId) => boolean = () => true,
) {
  let goal: Place;
  if (body.space !== target.space) {
    const h = HOMES.find(
      (h) => h.id === (body.space === "village" ? target.space : body.space),
    );
    if (!h) {
      runtime.failure = "没有有效入口";
      return false;
    }
    goal =
      body.space === "village"
        ? { space: "village", ...h.door }
        : { space: body.space, ...ROOM.entry };
    if (distance(body, goal) <= 6) {
      const next: Place =
        body.space === "village"
          ? { space: target.space, ...ROOM.entry }
          : { space: "village", ...h.door };
      if (
        spaceBlocked(next.space, next.x, next.y) ||
        !safe(next) ||
        (body.space === "village" && !canEnter(next.space))
      ) {
        runtime.stuck += ms;
        runtime.failure = "入口受阻，等待或改道";
        return false;
      }
      Object.assign(body, next);
      runtime.nav = enemyNavigation();
      runtime.search = null;
      runtime.stuck = 0;
      runtime.progress = null;
      return false;
    }
  } else goal = target;
  if (distance(body, goal) <= 5) {
    runtime.stuck = 0;
    return body.space === target.space;
  }
  const key = `${mapGeometryRevision}:${goal.space}:${Math.round(goal.x / 8)}:${Math.round(goal.y / 8)}`;
  if (runtime.goal !== key) {
    runtime.nav = enemyNavigation();
    runtime.search = null;
    runtime.goal = key;
    runtime.stuck = 0;
    runtime.progress = { x: body.x, y: body.y };
  }
  runtime.progress ??= { x: body.x, y: body.y };
  const nav = runtime.nav,
    query = {
      blocked: (x: number, y: number) =>
        cachedBlocked(body.space, x, y) || !safe({ space: body.space, x, y }),
      clear: (a: Point, b: Point) => cachedLine(body.space, a, b),
    };
  // 同伴只作为当前空间的临时障碍，不写入静态缓存；搜索使用本次占位快照。
  // 门口与交谈目标附近保留原有会合规则，进入后仍按实际空间分离重叠。
  const occupants = peers
      .filter(
        (p) => p !== body && p.space === body.space && distance(p, goal) > 8,
      )
      .map((p) => ({ x: p.x, y: p.y })),
    occupiedPoint = (x: number, y: number) =>
      occupants.some((p) => distance(p, { x, y }) < LIFE.personalSpace),
    peerClear = (a: Point, b: Point) =>
      occupants.every((p) => {
        const dx = b.x - a.x,
          dy = b.y - a.y,
          u = Math.max(
            0,
            Math.min(
              1,
              ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
            ),
          ),
          before = distance(p, a),
          after = distance(p, b),
          nearest = distance(p, { x: a.x + u * dx, y: a.y + u * dy });
        return (
          nearest >= Math.min(LIFE.personalSpace, before) - 1e-7 &&
          (before >= LIFE.personalSpace || after > before + 1e-7)
        );
      }),
    planningQuery = {
      blocked: (x: number, y: number) =>
        query.blocked(x, y) || occupiedPoint(x, y),
      clear: (a: Point, b: Point) => query.clear(a, b) && peerClear(a, b),
    };
  // 共用房门的已有重叠先局部散开，不必等完整路线规划；每步仍遵守碰撞与安全。
  if (
    peers.some(
      (p) => p.space === body.space && distance(p, body) < LIFE.personalSpace,
    )
  ) {
    const dx = goal.x - body.x,
      dy = goal.y - body.y,
      len = Math.hypot(dx, dy),
      step = Math.min(len, (LIFE.speed * ms) / 1000),
      free = [
        [dx, dy],
        [-dy, dx],
        [dy, -dx],
        [-dx, -dy],
      ]
        .map(([x, y]) => ({
          space: body.space,
          x: body.x + (x / len) * step,
          y: body.y + (y / len) * step,
        }))
        .find(
          (q) =>
            !query.blocked(q.x, q.y) &&
            query.clear(body, q) &&
            peers.every(
              (p) =>
                p.space !== body.space ||
                distance(p, q) >
                  Math.min(LIFE.personalSpace, distance(p, body)) + 1e-7,
            ),
        );
    if (free) {
      Object.assign(body, free);
      runtime.nav = enemyNavigation();
      runtime.search = null;
      recordProgress(body, runtime, ms);
      runtime.failure = "入口侧让，先分离已有重叠";
      return false;
    }
  }
  // 已有路线也会被后来进入的同伴挡住；丢弃失效路段后按共享预算绕行。
  if (nav.path.length && !planningQuery.clear(body, nav.path[0])) {
    nav.path = [];
    runtime.search = null;
    nav.next = Math.min(nav.next, now);
  }
  let waypoint: Point | undefined;
  if (
    !planningQuery.blocked(goal.x, goal.y) &&
    planningQuery.clear(body, goal)
  ) {
    waypoint = goal;
    nav.failed = false;
    nav.path = [];
    runtime.search = null;
  } else {
    if (
      !runtime.search &&
      now >= nav.next &&
      budget.queries > 0 &&
      (!nav.path.length || !nav.target || distance(goal, nav.target) > 24)
    ) {
      runtime.queries++;
      const rounded = {
          x: Math.round(body.x / 20) * 20,
          y: Math.round(body.y / 20) * 20,
        },
        origin =
          !planningQuery.blocked(rounded.x, rounded.y) &&
          planningQuery.clear(body, rounded) &&
          !peers.some(
            (p) =>
              p.space === body.space &&
              distance(p, rounded) < LIFE.personalSpace &&
              distance(p, rounded) <= distance(p, body),
          )
            ? rounded
            : body;
      if (!planningQuery.blocked(goal.x, goal.y))
        runtime.search = {
          origin,
          iterator: pathSearch(
            origin,
            (p) => distance(p, goal) < 18 && planningQuery.clear(p, goal),
            goal,
            () => true,
            planningQuery,
            { radius: 2400, nodes: 8192 },
          ),
        };
      else {
        nav.failed = true;
        nav.next = now + LIFE.pathRetryMs;
      }
      nav.target = { ...goal };
    }
    if (runtime.search && budget.queries > 0) {
      const { iterator, origin } = runtime.search;
      const batch=advancePathSearch(iterator,budget,LIFE.pathNodesPerBatch);
      if(batch.expanded)runtime.batches++;
      runtime.maxExpanded=Math.max(runtime.maxExpanded,batch.expanded);
      if(batch.result){
        nav.path = batch.result.path ?? [];
        if (batch.result.path) {
          nav.path.unshift(origin);
          nav.path.push(goal);
        }
        nav.failed = !batch.result.path;
        nav.next = now + LIFE.pathRetryMs;
        runtime.search = null;
      }
    }
    while (nav.path.length && distance(body, nav.path[0]) < 0.001)
      nav.path.shift();
    waypoint = nav.path[0];
  }
  if (!waypoint) {
    // 正在逐步计算时不算撞墙；搜索总节点上限仍为8192，换目标或取消即释放。
    if (!runtime.search) recordProgress(body, runtime, ms);
    runtime.failure = runtime.search
      ? "分步规划安全路线"
      : nav.failed
        ? "路径不可达"
        : "等待寻路预算";
    return false;
  }
  const old = { x: body.x, y: body.y },
    d = distance(body, waypoint),
    step = Math.min(d, (LIFE.speed * ms) / 1000),
    next = {
      space: body.space,
      x: body.x + ((waypoint.x - body.x) / d) * step,
      y: body.y + ((waypoint.y - body.y) / d) * step,
    };
  const occupied = !peerClear(body, next);
  if (!occupied && !query.blocked(next.x, next.y) && query.clear(body, next)) {
    Object.assign(body, next);
    runtime.failure = "";
  } else {
    runtime.failure = occupied ? "同伴占路，等待绕行" : "通路受阻";
    nav.path = [];
    runtime.search = null;
    nav.next = Math.max(nav.next, now + LIFE.pathRetryMs);
  }
  recordProgress(body, runtime, ms);
  // 小幅摆动不算行程进展；返岗即使没有生活行动，也会通过此入口有限重规划。
  if (runtime.stuck > LIFE.pathRetryMs && now >= nav.next) {
    nav.path = [];
    runtime.search = null;
    nav.next = now + LIFE.pathRetryMs;
    runtime.failure = "持续没有行程进展，重新规划";
  }
  runtime.last = old;
  return false;
}
