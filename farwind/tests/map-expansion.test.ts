import { describe, it, expect } from "vitest";
import {
  props,
  terrainBlocked,
  solidPropAt,
  villageAreas,
  villageRoutes,
  WORLD,
  POND,
} from "../src/data/world";
import { initialState, validate } from "../src/game/systems/state";
import { FIELD_TARGETS } from "../src/game/systems/training";
const blocked = (x: number, y: number) =>
  terrainBlocked(x, y) || solidPropAt(x, y);
describe("地图扩展的通行与兼容性", () => {
  it("七区、全部交互物和训练靶四面都能从广场到达", () => {
    const step = 10,
      cols = WORLD.width / step,
      rows = WORLD.height / step;
    const seen = new Set<number>(),
      queue = [72 * cols + 67];
    seen.add(queue[0]);
    for (let i = 0; i < queue.length; i++) {
      const n = queue[i],
        x = n % cols,
        y = Math.floor(n / cols);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx,
          ny = y + dy,
          k = ny * cols + nx;
        if (
          nx < 0 ||
          nx >= cols ||
          ny < 0 ||
          ny >= rows ||
          seen.has(k) ||
          blocked(nx * step, ny * step)
        )
          continue;
        seen.add(k);
        queue.push(k);
      }
    }
    for (const p of [...villageAreas, ...props.filter((p) => p.kind)]) {
      const reachable = Array.from(seen).some(
        (k) =>
          Math.hypot(
            (k % cols) * step - p.x,
            Math.floor(k / cols) * step - p.y,
          ) < 65,
      );
      expect(reachable, `${p.id} 必须可接近`).toBe(true);
    }
    for (const t of FIELD_TARGETS)
      for (const [dx, dy] of [
        [70, 0],
        [-70, 0],
        [0, 70],
        [0, -80],
      ])
        expect(
          seen.has(
            Math.round((t.y + dy) / step) * cols +
              Math.round((t.x + dx) / step),
          ),
          `${t.id} 四面通行`,
        ).toBe(true);
  });
  it("推荐路线中心线可步行，水域不能直穿，桥面可穿水", () => {
    for (const route of villageRoutes)
      for (let i = 1; i < route.points.length; i++) {
        const a = route.points[i - 1],
          b = route.points[i],
          n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 5);
        for (let j = 0; j <= n; j++) {
          const x = a[0] + ((b[0] - a[0]) * j) / n,
            y = a[1] + ((b[1] - a[1]) * j) / n;
          expect(
            blocked(x, y),
            `${route.name} 的 ${Math.round(x)},${Math.round(y)} 被挡`,
          ).toBe(false);
        }
      }
    expect(terrainBlocked(POND.x, POND.y)).toBe(true);
    for (let y = 900; y <= 1450; y += 5) expect(blocked(1090, y)).toBe(false);
    expect(terrainBlocked(4190, 700)).toBe(true);
  });
  it("旧档森林坐标和待领取掉落只迁移一次，物品进度不变", () => {
    const old = initialState();
    delete old.map_version;
    old.player.x = 2300;
    old.killed = ["leaf-1"];
    old.pendingDrops = [
      { enemyId: "leaf-1", item: "crystal", x: 2320, y: 1070 },
    ];
    const moved = validate(old);
    expect(moved.player.x).toBe(2900);
    expect(moved.pendingDrops[0].x).toBe(2920);
    expect(moved.bag).toEqual(old.bag);
    expect(moved.quest).toBe(old.quest);
    expect(validate(moved)).toEqual(moved);
    expect(old.player.x).toBe(2300);
    const village = initialState();
    delete village.map_version;
    expect(validate(village).player).toEqual(village.player);
    expect(() => validate({ ...old, map_version: 4 })).toThrow();
  });
});
