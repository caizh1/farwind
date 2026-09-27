import {
  HOMES,
  PRIVATE_STORAGE,
  FACILITIES,
  ROOM,
  LIFE,
  type Place,
  type SpaceId,
} from "../../data/npcLife";
import { pathSearch, enemyNavigation, type EnemyBody } from "./enemy";
import {
  motionBlocked,
  clearMotionLine,
  rectInterval,
  type Point,
} from "./obstacles";
export const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const roomFurniture = (space: SpaceId) => [
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
const cachedBlocked = (space: SpaceId, x: number, y: number) => {
  const k = `${space}:${x}:${y}`;
  if (!blockedCache.has(k)) {
    if (blockedCache.size > 32000) blockedCache.clear();
    blockedCache.set(k, spaceBlocked(space, x, y));
  }
  return blockedCache.get(k)!;
};
const cachedLine = (space: SpaceId, a: Point, b: Point) => {
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
});
export function moveLife(
  body: Place,
  target: Place,
  ms: number,
  now: number,
  budget: { queries: number },
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
      return false;
    }
  } else goal = target;
  if (distance(body, goal) <= 5) return body.space === target.space;
  const key = `${goal.space}:${Math.round(goal.x / 8)}:${Math.round(goal.y / 8)}`;
  if (runtime.goal !== key) {
    runtime.nav = enemyNavigation();
    runtime.search = null;
    runtime.goal = key;
    runtime.stuck = 0;
  }
  const nav = runtime.nav,
    query = {
      blocked: (x: number, y: number) =>
        cachedBlocked(body.space, x, y) || !safe({ space: body.space, x, y }),
      clear: (a: Point, b: Point) => cachedLine(body.space, a, b),
    };
  // 共用房门的已有重叠先局部散开，不必等完整路线规划；每步仍遵守碰撞与安全。
  if (peers.some((p) => p.space === body.space && distance(p, body) < 18)) {
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
                distance(p, q) > Math.min(18, distance(p, body)) + 1e-7,
            ),
        );
    if (free) {
      Object.assign(body, free);
      runtime.nav = enemyNavigation();
      runtime.search = null;
      runtime.stuck = 0;
      runtime.failure = "入口侧让，先分离已有重叠";
      return false;
    }
  }
  let waypoint: Point | undefined;
  if (!query.blocked(goal.x, goal.y) && query.clear(body, goal) && safe(goal)) {
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
          !query.blocked(rounded.x, rounded.y) &&
          query.clear(body, rounded) &&
          !peers.some(
            (p) =>
              p.space === body.space &&
              distance(p, rounded) < 18 &&
              distance(p, rounded) <= distance(p, body),
          )
            ? rounded
            : body;
      if (!query.blocked(goal.x, goal.y))
        runtime.search = {
          origin,
          iterator: pathSearch(
            origin,
            (p) => distance(p, goal) < 18 && query.clear(p, goal),
            goal,
            () => true,
            query,
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
      budget.queries--;
      runtime.batches++;
      const { iterator, origin } = runtime.search;
      for (let i = 0; i < LIFE.pathNodesPerBatch; i++) {
        const result = iterator.next();
        runtime.maxExpanded = Math.max(runtime.maxExpanded, i + 1);
        if (!result.done) continue;
        nav.path = result.value.path ?? [];
        if (result.value.path) {
          nav.path.unshift(origin);
          nav.path.push(goal);
        }
        nav.failed = !result.value.path;
        nav.next = now + LIFE.pathRetryMs;
        runtime.search = null;
        break;
      }
    }
    while (nav.path.length && distance(body, nav.path[0]) < 0.001)
      nav.path.shift();
    waypoint = nav.path[0];
  }
  if (!waypoint) {
    // 正在逐步计算时不算撞墙；搜索总节点上限仍为8192，换目标或取消即释放。
    if (!runtime.search) runtime.stuck += ms;
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
  const occupied = peers.some(
    (p) =>
      p !== body &&
      p.space === body.space &&
      distance(p, next) < 18 &&
      // 共用房门可能已有重叠；允许逐步远离，仍禁止进入新的拥挤位置。
      distance(p, next) <= distance(p, body) + 1e-7 &&
      distance(p, goal) > 8,
  );
  // 同路排队时允许小步侧让，必须通过相同碰撞/视线/安全检查，且不靠近任何现有重叠者。
  const sidestep = occupied
    ? [1, -1]
        .map((sign) => ({
          space: body.space,
          x: body.x - ((sign * (waypoint.y - body.y)) / d) * step,
          y: body.y + ((sign * (waypoint.x - body.x)) / d) * step,
        }))
        .find(
          (q) =>
            !query.blocked(q.x, q.y) &&
            query.clear(body, q) &&
            peers.every(
              (p) =>
                p.space !== body.space ||
                distance(p, q) > Math.min(18, distance(p, body)) + 1e-7,
            ),
        )
    : undefined;
  const proposed = occupied ? sidestep : next;
  if (
    proposed &&
    !query.blocked(proposed.x, proposed.y) &&
    query.clear(body, proposed)
  ) {
    Object.assign(body, proposed);
    runtime.stuck = 0;
    runtime.failure = "";
  } else {
    runtime.stuck += ms;
    runtime.failure = occupied ? "入口排队" : "通路受阻";
    if (runtime.stuck > 1800) nav.path = [];
  }
  runtime.last = old;
  return false;
}
