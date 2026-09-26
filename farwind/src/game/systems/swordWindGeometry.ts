import {
  props,
  propBounds,
  WORLD,
  POND,
  BRIDGES,
  type Prop,
} from "../../data/world";
import { TRAINING, FIELD_TARGETS } from "./training";
import type { Point, Rect } from "./obstacles";
const EPS = 1e-8;
// 包含起始重叠及擦边，返回可与敌人接触比较的路径参数。
export function firstRectContact(a: Point, b: Point, r: Rect): number | null {
  let lo = 0,
    hi = 1;
  for (const [start, delta, min, max] of [
    [a.x, b.x - a.x, r.left, r.right],
    [a.y, b.y - a.y, r.top, r.bottom],
  ]) {
    if (Math.abs(delta) < EPS) {
      if (start < min - EPS || start > max + EPS) return null;
    } else {
      const p = (min - start) / delta,
        q = (max - start) / delta;
      lo = Math.max(lo, Math.min(p, q));
      hi = Math.min(hi, Math.max(p, q));
      if (lo > hi + EPS) return null;
    }
  }
  return lo <= 1 + EPS && hi >= -EPS ? Math.max(0, lo) : null;
}
export function sweptTargetContact(
  a: Point,
  b: Point,
  old: Point,
  current: Point,
  radius: number,
): number | null {
  const x = a.x - old.x,
    y = a.y - old.y,
    dx = b.x - a.x - current.x + old.x,
    dy = b.y - a.y - current.y + old.y;
  const c = x * x + y * y - radius * radius;
  if (c <= EPS) return 0;
  const q = dx * dx + dy * dy;
  if (q < EPS) return null;
  // 以垂距求交，避免高速轨迹恰好擦边时两个大数相减丢失精度。
  const cross = x * dy - y * dx,
    perpendicular = (cross * cross) / q;
  if (perpendicular > radius * radius + EPS) return null;
  const t =
    -(x * dx + y * dy) / q -
    Math.sqrt(Math.max(0, (radius * radius - perpendicular) / q));
  return t >= -EPS && t <= 1 + EPS ? Math.max(0, Math.min(1, t)) : null;
}
const streamX = (y: number) => {
  const u = (y - 650) / 930;
  return 2620 - 240 * u + 720 * u * u - 530 * u * u * u;
};
const turns = [
  650 + (930 * (1440 - Math.sqrt(1440 ** 2 - 4 * 1590 * 240))) / (2 * 1590),
  650 + (930 * (1440 + Math.sqrt(1440 ** 2 - 4 * 1590 * 240))) / (2 * 1590),
];
function streamSpans(x: number, r: number, top: number, bottom: number) {
  const points = [top, bottom, ...turns.filter((y) => y > top && y < bottom)];
  for (const boundary of [x - 40 - r, x + 40 + r]) {
    const monotone = [
      top,
      ...turns.filter((y) => y > top && y < bottom),
      bottom,
    ];
    for (let i = 1; i < monotone.length; i++) {
      let lo = monotone[i - 1],
        hi = monotone[i];
      if ((streamX(lo) - boundary) * (streamX(hi) - boundary) > 0) continue;
      const sign = streamX(lo) <= boundary;
      for (let n = 0; n < 48; n++) {
        const mid = (lo + hi) / 2;
        if (streamX(mid) <= boundary === sign) lo = mid;
        else hi = mid;
      }
      points.push((lo + hi) / 2);
    }
  }
  points.sort((a, b) => a - b);
  const spans: [number, number][] = [];
  for (let i = 1; i < points.length; i++)
    if (Math.abs(streamX((points[i - 1] + points[i]) / 2) - x) <= 40 + r + EPS)
      spans.push([points[i - 1] - r, points[i] + r]);
  return spans;
}
// 剑风使用宽度28的地面足迹；墙体矩形膨胀，水域按足迹与既有水／桥域相交。
// 发射及锁向为四向，因此水域查询可以解析为一维区间，不改移动／近战／高台射击规则。
export function firstSwordWindBlocker(
  a: Point,
  b: Point,
  radius: number,
  objects: readonly Prop[] = props,
) {
  const candidates: { id: string; t: number }[] = [];
  for (const p of objects) {
    if (
      !p.solid ||
      p.id === TRAINING.id ||
      FIELD_TARGETS.some((t) => t.id === p.id)
    )
      continue;
    const r = propBounds(p),
      t = firstRectContact(a, b, {
        left: r.left - radius,
        right: r.right + radius,
        top: r.top - radius,
        bottom: r.bottom + radius,
      });
    if (t !== null) candidates.push({ id: p.id, t });
  }
  const bounds = {
    left: 30 + radius,
    right: WORLD.width - 30 - radius,
    top: 80 + radius,
    bottom: WORLD.height - 30 - radius,
  };
  if (
    a.x < bounds.left ||
    a.x > bounds.right ||
    a.y < bounds.top ||
    a.y > bounds.bottom
  )
    candidates.push({ id: "world-edge", t: 0 });
  else
    for (const [s, d, min, max] of [
      [a.x, b.x - a.x, bounds.left, bounds.right],
      [a.y, b.y - a.y, bounds.top, bounds.bottom],
    ])
      if (Math.abs(d) > EPS) {
        const t = d > 0 ? (max - s) / d : (min - s) / d;
        if (t >= 0 && t <= 1) candidates.push({ id: "world-edge", t });
      }
  const horizontal = Math.abs(b.y - a.y) < EPS,
    coordinate = (p: Point) => (horizontal ? p.x : p.y);
  const interval = (min: number, max: number): [number, number] | null => {
    const s = coordinate(a),
      d = coordinate(b) - s;
    if (Math.abs(d) < EPS)
      return s >= min - EPS && s <= max + EPS ? [0, 1] : null;
    const l = (min - s) / d,
      h = (max - s) / d,
      lo = Math.max(0, Math.min(l, h)),
      hi = Math.min(1, Math.max(l, h));
    return lo <= hi + EPS ? [lo, hi] : null;
  };
  const cross = Math.max(
      0,
      Math.abs((horizontal ? a.y : a.x) - (horizontal ? POND.y : POND.x)) -
        radius,
    ),
    crossRadius = horizontal ? POND.ry : POND.rx;
  if (cross <= crossRadius) {
    const along =
        (horizontal ? POND.rx : POND.ry) *
          Math.sqrt(Math.max(0, 1 - (cross / crossRadius) ** 2)) +
        radius,
      center = horizontal ? POND.x : POND.y,
      span = interval(center - along, center + along);
    if (span) {
      let water: [number, number][] = [span];
      for (const bridge of BRIDGES) {
        const safe = {
            left: bridge.x + radius,
            right: bridge.x + bridge.w - radius,
            top: bridge.y + radius,
            bottom: bridge.y + bridge.h - radius,
          },
          lo = firstRectContact(a, b, safe),
          reverse = firstRectContact(b, a, safe);
        if (lo === null || reverse === null) continue;
        const hi = 1 - reverse;
        water = water.flatMap(([l, h]) =>
          hi < l || lo > h
            ? [[l, h]]
            : [
                ...(l < lo - EPS ? [[l, lo - EPS] as [number, number]] : []),
                ...(h > hi + EPS ? [[hi + EPS, h] as [number, number]] : []),
              ],
        );
      }
      if (water.length) candidates.push({ id: "pond", t: water[0][0] });
    }
  }
  for (const [top, bottom] of [
    [650, 1010],
    [1180, 1580],
  ]) {
    if (horizontal) {
      const lo = Math.max(top, a.y - radius),
        hi = Math.min(bottom, a.y + radius);
      if (lo > hi) continue;
      const values = [lo, hi, ...turns.filter((y) => y > lo && y < hi)].map(
          streamX,
        ),
        span = interval(
          Math.min(...values) - 40 - radius,
          Math.max(...values) + 40 + radius,
        );
      if (span) candidates.push({ id: "stream", t: span[0] });
    } else
      for (const [lo, hi] of streamSpans(a.x, radius, top, bottom)) {
        const span = interval(lo, hi);
        if (span) candidates.push({ id: "stream", t: span[0] });
      }
  }
  return (
    candidates.sort((x, y) => x.t - y.t || x.id.localeCompare(y.id))[0] ?? null
  );
}
