import { test, expect } from "vitest";
import { WIND_LESSONS } from "../src/data/windLessons";
import {
  props,
  propBounds,
  terrainBlocked,
  solidPropAt,
} from "../src/data/world";
import { motionBlocked, clearMotionLine } from "../src/game/systems/obstacles";
import { localPath } from "../src/game/systems/enemy";
test("五个传承站位与固定教本有完整通路", () => {
  let previous = { x: 670, y: 720 };
  for (const l of WIND_LESSONS) {
    const p = l.stand;
    const obstacles = props
      .filter((o) => o.solid)
      .filter((o) => {
        const r = propBounds(o, true);
        return p.x > r.left && p.x < r.right && p.y > r.top && p.y < r.bottom;
      })
      .map((o) => o.id);
    expect(
      {
        地形: terrainBlocked(p.x, p.y),
        道具: solidPropAt(p.x, p.y),
        脚底: motionBlocked(p.x, p.y),
        阻挡: obstacles,
      },
      l.name,
    ).toEqual({ 地形: false, 道具: false, 脚底: false, 阻挡: [] });
    const route = localPath(
      previous,
      (q) => Math.hypot(q.x - p.x, q.y - p.y) < 15 && clearMotionLine(q, p),
      p,
      (q) => q.x >= 30 && q.x <= 4170 && q.y >= 80 && q.y <= 2170,
      undefined,
      { radius: 5000, nodes: 30000 },
    );
    expect(route.path, l.name + "自然可达").not.toBeNull();
    previous = p;
  }
});
import { SwordWindSystem } from "../src/game/systems/swordWind";
import { resolveSwordWindConfig } from "../src/data/swordWind";
import { lessonTargets } from "../src/game/systems/windLessons";
test.each([
  {
    stage: 2,
    root: { x: 2500.5, y: 978.8 },
    facing: 3,
    ids: ["lesson-double-0", "lesson-double-1"],
  },
  {
    stage: 3,
    root: { x: 2940, y: 1180 },
    facing: 3,
    ids: ["lesson-through-0", "lesson-through-1", "lesson-through-2"],
  },
  {
    stage: 4,
    root: { x: 3610, y: 1060 },
    facing: 1,
    ids: ["lesson-wide-0", "lesson-wide-1"],
  },
  {
    stage: 5,
    root: { x: 3910, y: 1000 },
    facing: 1,
    ids: [
      "lesson-three-left",
      "lesson-three-center",
      "lesson-three-right",
      "lesson-three-overlap",
    ],
  },
] as const)(
  "阶段$stage场景实际弹道无遮挡且命中演示对象",
  ({ stage, root, facing, ids }) => {
    const system = new SwordWindSystem(),
      config = resolveSwordWindConfig(stage);
    system.launch(
      { id: 1, stage: 4, facing, start: 0, hit: new Set(), swordWind: config },
      root,
      110,
      36,
    );
    const events = system.advance(
      110,
      800,
      lessonTargets.map((target) => ({
        target,
        previous: target,
        current: target,
      })),
    );
    expect(
      events
        .filter((e) => e.target)
        .map((e) => e.target!.id)
        .sort(),
      JSON.stringify(
        events.map((e) => ({
          对象: e.target?.id,
          终止: e.reason,
          位置: e.point,
        })),
      ),
    ).toEqual([...ids].sort());
  },
);

// 死亡边界样本不能依赖不存在的隔墙命中。
test("教学区内的真实敌伤站位无遮挡", () => {
  const p = { x: 3410, y: 1150 };
  expect(motionBlocked(p.x, p.y)).toBe(false);
  expect(clearMotionLine({ x: 3330, y: 1120 }, p)).toBe(true);
});

test("远铃同时体现距离和宽度，窄道允许旧剑风而截断疾风", () => {
  const release = (stage: 3 | 4, root: { x: number; y: number }) => {
    const system = new SwordWindSystem(),
      config = resolveSwordWindConfig(stage);
    system.launch(
      {
        id: 1,
        stage: 4,
        facing: 1,
        start: 0,
        hit: new Set(),
        swordWind: config,
      },
      root,
      110,
      36,
    );
    return system.advance(
      110,
      800,
      lessonTargets.map((target) => ({
        target,
        previous: target,
        current: target,
      })),
    );
  };
  const thin = release(3, { x: 3610, y: 1060 }),
    wide = release(4, { x: 3610, y: 1060 });
  expect(thin.filter((e) => e.target)).toEqual([]);
  expect(
    wide
      .filter((e) => e.target)
      .map((e) => e.target!.id)
      .sort(),
  ).toEqual(["lesson-wide-0", "lesson-wide-1"]);
  expect(
    release(3, { x: 3700, y: 1100 }).some(
      (e) => e.target?.id === "lesson-wide-channel-bell",
    ),
  ).toBe(true);
  expect(
    release(4, { x: 3700, y: 1100 }).some((e) => e.reason === "obstacle"),
  ).toBe(true);
  expect(
    release(4, { x: 3700, y: 1100 }).some(
      (e) => e.target?.id === "lesson-wide-channel-bell",
    ),
  ).toBe(false);
});
