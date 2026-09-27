import { POND, BRIDGES, roads, roadWidth } from "../../data/world";
import type { SwordWind } from "./swordWind";
export const WIND_WATER = {
  step: 24,
  wake: 600,
  splash: 240,
  ripple: 800,
  capacity: 256,
} as const;
export const streamCenter = (y: number) => {
  const u = (y - 650) / 930;
  return 2620 - 240 * u + 720 * u * u - 530 * u * u * u;
};
// 水迹跟随可见的溪面，而不扩改原有移动碰撞；溪面的纵坐标并非线性参数。
const streamRows = Array.from({ length: 931 }, (_, row) => {
  let lo = 0,
    hi = 1;
  for (let i = 0; i < 18; i++) {
    const t = (lo + hi) / 2;
    if (650 + 600 * t + 600 * t * t - 270 * t * t * t < 650 + row) lo = t;
    else hi = t;
  }
  const t = (lo + hi) / 2,
    slope = (-240 + 1440 * t - 1590 * t * t) / (600 + 1200 * t - 810 * t * t);
  return {
    x: 2620 - 240 * t + 720 * t * t - 530 * t * t * t,
    half: 34 * Math.sqrt(1 + slope * slope),
  };
});
const streamRoads = roads
  .flatMap((path, index) =>
    path
      .slice(1)
      .map((b, j) => ({ a: path[j], b, radius: (roadWidth(index) + 15) / 2 })),
  )
  .filter(
    ({ a, b, radius }) =>
      Math.max(a[0], b[0]) + radius >= 2480 &&
      Math.min(a[0], b[0]) - radius <= 2740 &&
      Math.max(a[1], b[1]) + radius >= 650 &&
      Math.min(a[1], b[1]) - radius <= 1580,
  );
export function streamRoadAt(x: number, y: number) {
  return streamRoads.some(({ a, b, radius }) => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      t = Math.max(
        0,
        Math.min(
          1,
          ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1),
        ),
      );
    return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t) <= radius;
  });
}
export function waterSurfaceAt(x: number, y: number): "pond" | "stream" | null {
  if (
    BRIDGES.some(
      (b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h,
    )
  )
    return null;
  if (((x - POND.x) / POND.rx) ** 2 + ((y - POND.y) / POND.ry) ** 2 < 1)
    return "pond";
  if (y >= 650 && y <= 1580) {
    const r = streamRows[Math.round(y - 650)];
    if (Math.abs(x - r.x) < r.half && !streamRoadAt(x, y)) return "stream";
  }
  return null;
}
export function waterTrailSamples(w: SwordWind, now: number) {
  if (!w.initialChecked) return [];
  const d = w.direction,
    extent = Math.max(
      0,
      (w.position.x - w.origin.x) * d.x + (w.position.y - w.origin.y) * d.y,
    );
  const birth = Math.hypot(
      w.birthPosition.x - w.origin.x,
      w.birthPosition.y - w.origin.y,
    ),
    samples = [];
  for (
    let start = 8, index = 0;
    start < extent;
    start += WIND_WATER.step, index++
  ) {
    const age =
      now - w.born - (Math.max(0, start - birth) / w.config.speed) * 1000;
    if (age < 0 || age >= WIND_WATER.ripple) continue;
    const length = Math.min(WIND_WATER.step, extent - start),
      x = w.origin.x + d.x * (start + length / 2),
      y = w.origin.y + d.y * (start + length / 2);
    // 中心线贴岸时也保留实际宽度与水面的相交部分，最终由静态水域遮罩裁切。
    const regions = new Set([
      waterSurfaceAt(x, y),
      waterSurfaceAt(
        x - (d.y * w.config.width) / 2,
        y + (d.x * w.config.width) / 2,
      ),
      waterSurfaceAt(
        x + (d.y * w.config.width) / 2,
        y - (d.x * w.config.width) / 2,
      ),
    ]);
    for (const region of regions)
      if (region)
        samples.push({
          index,
          region,
          x,
          y,
          length,
          age,
          width: w.config.width,
        });
  }
  return samples;
}
