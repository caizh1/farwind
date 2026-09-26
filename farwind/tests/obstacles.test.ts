import { describe, it, expect } from "vitest";
import {
  props,
  solidPropAt,
  terrainBlocked,
  enemyDefs,
  propBounds,
} from "../src/data/world";
import { inStrike, STRIKES } from "../src/game/systems/combat";

import {
  clearMeleeLine,
  clearMotionLine,
  meleeBlocker,
  motionBlocked,
  propLineBlocker,
  rectInterval,
} from "../src/game/systems/obstacles";
import {
  updateEnemy,
  validateEnemyPosition,
  enemyNavigation,
  nearestStanding,
  localPath,
  NAV,
  type EnemyBody,
} from "../src/game/systems/enemy";
function legacyLine(
  x: number,
  y: number,
  tx: number,
  ty: number,
  blocked: (x: number, y: number) => boolean,
) {
  const n = Math.ceil(Math.hypot(tx - x, ty - y) / 12);
  for (let i = 1; i <= n; i++)
    if (blocked(x + ((tx - x) * i) / n, y + ((ty - y) * i) / n)) return false;
  return true;
}
// 审查提交的隔离夹具，旧地图坐标；不修改游戏地图或敌人。
const tree = { id: "tree-14", x: 2530, y: 980, solid: [38, 27] };
const oldBlocked = (x: number, y: number) =>
  Math.abs(x - tree.x) < 31 && y > 943 && y < 990;
function legacyJourney() {
  const e = { id: "leaf-2", x: 2570, y: 930, hp: 72, windup: 0, cool: 0 };
  const p = { x: 2430, y: 1010 };
  let t = 0;
  let starts = 0;
  function tick() {
    t += 1000 / 60;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (e.windup > 0) {
      e.windup -= 1 / 60;
      if (e.windup <= 0) e.cool = t + 1400;
    } else if (d < 80 && t > e.cool) {
      e.windup = 0.65;
      starts++;
    } else if (d > 8 && d < 380) {
      const nx = e.x + (((p.x - e.x) / d) * 95) / 60;
      const ny = e.y + (((p.y - e.y) / d) * 95) / 60;
      if (!oldBlocked(nx, ny)) Object.assign(e, { x: nx, y: ny });
    }
  }
  for (let i = 0; i < 120; i++) tick();
  for (let i = 0; i < 72; i++) {
    p.x += 150 / 60;
    tick();
  }
  for (let i = 0; i < 20; i++) {
    p.y -= 150 / 60;
    tick();
  }
  const stuck = { ...e };
  for (let i = 0; i < 600; i++) tick();
  return { p, e, stuck, starts };
}
describe("树边误挡回归", () => {
  it("保留修复前因果证据：合法位置被扩张范围拒绝，十秒空挥且不移动", () => {
    const { p, e, stuck, starts } = legacyJourney();
    expect(e.x).toBeCloseTo(2549.529, 2);
    expect(e.y).toBeCloseTo(942.997, 2);
    expect(oldBlocked(e.x, e.y)).toBe(false);
    expect(oldBlocked(p.x, p.y)).toBe(false);
    expect(Math.hypot(p.x - e.x, p.y - e.y)).toBeCloseTo(62.815, 2);
    expect(legacyLine(p.x, p.y, e.x, e.y, oldBlocked)).toBe(false);
    expect([e.x, e.y]).toEqual([stuck.x, stuck.y]);
    expect(starts).toBeGreaterThanOrEqual(4);
    for (let stage = 1; stage <= STRIKES.length; stage++)
      expect(
        inStrike(
          p,
          e,
          { id: 1, stage, facing: 2, start: 0, hit: new Set() },
          () => true,
        ),
      ).toBe(true);
  });
  it("当前地图对应夹具：边缘攻击不穿实体树干，应当命中", () => {
    const p = { x: 3210, y: 960 };
    const e = { id: "leaf-2", x: 3149.529, y: 942.997, hp: 72 };
    const blocked = (x: number, y: number) =>
      terrainBlocked(x, y) || solidPropAt(x, y);
    expect(props.find((p) => p.id === "tree-20")?.x).toBe(3130);
    expect(blocked(p.x, p.y)).toBe(false);
    expect(blocked(e.x, e.y)).toBe(false);
    expect(
      inStrike(
        p,
        e,
        { id: 1, stage: 1, facing: 2, start: 0, hit: new Set() },
        (x, y, tx, ty) => clearMeleeLine({ x, y }, { x: tx, y: ty }),
      ),
    ).toBe(true);
  });
});

function enemy(x = 3170, y = 930): EnemyBody {
  return {
    id: "leaf-2",
    x,
    y,
    homeX: x,
    homeY: y,
    hp: 72,
    type: "leaf",
    cool: 0,
    windup: 0,
    staggerUntil: 0,
    nav: enemyNavigation(),
    ai: "家园",
    disabled: false,
    recovered: false,
  };
}
function tickFor(
  e: EnemyBody,
  p: { x: number; y: number },
  frames: number,
  from = 0,
) {
  const positions = [];
  for (let i = 1; i <= frames; i++) {
    const before = { x: e.x, y: e.y };
    updateEnemy(e, p, from + (i * 1000) / 60, 1 / 60);
    expect(motionBlocked(e.x, e.y)).toBe(false);
    expect(clearMotionLine(before, e)).toBe(true);
    positions.push({ x: e.x, y: e.y, ai: e.ai, windup: e.windup });
  }
  return positions;
}
describe("实体遮挡和身体占地的职责", () => {
  it("原坐标边缘线通过；矩形相交不因12像素采样或方向而漏检", () => {
    const p = { x: 2610, y: 960 },
      e = { x: 2549.529, y: 942.997 };
    const fixture = [
      {
        ...tree,
        art: "tree",
        w: 245,
        h: 280,
        solid: [38, 27] as [number, number],
      },
    ];
    expect(propLineBlocker(p, e, "motion", undefined, fixture)).toBe("tree-14");
    expect(propLineBlocker(p, e, "melee", undefined, fixture)).toBeUndefined();
    const narrow = { left: 5, right: 5.1, top: 0, bottom: 1 };
    expect(
      rectInterval({ x: 0, y: 0.5 }, { x: 12, y: 0.5 }, narrow),
    ).not.toBeNull();
    expect(
      rectInterval({ x: 12, y: 0.5 }, { x: 0, y: 0.5 }, narrow),
    ).not.toBeNull();
    expect(rectInterval({ x: 0, y: 0 }, { x: 12, y: 0 }, narrow)).toBeNull();
  });
  it("真正穿树干、房屋和栅栏仍失败，四侧边缘和换边不依赖树冠", () => {
    for (const id of ["tree-20", "home", "fence-0"]) {
      const obj = props.find((p) => p.id === id)!,
        r = propBounds(obj),
        cx = (r.left + r.right) / 2,
        cy = (r.top + r.bottom) / 2;
      for (const [a, b] of [
        [
          { x: r.left - 13, y: cy },
          { x: r.right + 13, y: cy },
        ],
        [
          { x: cx, y: r.top - 11 },
          { x: cx, y: r.bottom + 11 },
        ],
      ]) {
        expect(meleeBlocker(a, b, id)).toBe(id);
        expect(meleeBlocker(b, a, id)).toBe(id);
      }
      for (const [a, b] of [
        [
          { x: r.left - 13, y: r.top - 11 },
          { x: r.right + 13, y: r.top - 11 },
        ],
        [
          { x: r.left - 13, y: r.bottom + 11 },
          { x: r.right + 13, y: r.bottom + 11 },
        ],
        [
          { x: r.left - 13, y: r.top - 11 },
          { x: r.left - 13, y: r.bottom + 11 },
        ],
        [
          { x: r.right + 13, y: r.top - 11 },
          { x: r.right + 13, y: r.bottom + 11 },
        ],
      ])
        expect(
          propLineBlocker(a, b, "melee", undefined, [obj]),
        ).toBeUndefined();
      expect(
        propLineBlocker(
          { x: cx - 70, y: r.top - 1 },
          { x: cx + 70, y: r.top - 1 },
          "melee",
          undefined,
          [{ ...obj, w: 900, h: 900 }],
        ),
      ).toBeUndefined();
    }
  });
  it("跨水线段失败，桥梁可通；长线和薄角均连续检测", () => {
    expect(clearMeleeLine({ x: 2500, y: 950 }, { x: 2720, y: 950 })).toBe(
      false,
    );
    expect(clearMotionLine({ x: 2500, y: 1100 }, { x: 2720, y: 1100 })).toBe(
      true,
    );
    expect(clearMeleeLine({ x: 1000, y: 1120 }, { x: 1560, y: 1120 })).toBe(
      false,
    );
    expect(clearMotionLine({ x: 1090, y: 910 }, { x: 1090, y: 1440 })).toBe(
      true,
    );
  });
});
describe("敌人追击、前摇和出生校验", () => {
  it("正常出生走旧反例路径，保持脚底合法且不会十秒卡住", () => {
    const e = enemy(),
      p = { x: 3030, y: 1010 };
    tickFor(e, p, 120);
    for (let i = 0; i < 72; i++) {
      p.x += 150 / 60;
      tickFor(e, p, 1, 2000 + (i * 1000) / 60);
    }
    for (let i = 0; i < 20; i++) {
      p.y -= 150 / 60;
      tickFor(e, p, 1, 3200 + (i * 1000) / 60);
    }
    const initial = { x: e.x, y: e.y };
    tickFor(e, p, 600, 3600);
    expect(clearMeleeLine(e, p)).toBe(true);
    expect(Math.hypot(e.x - p.x, e.y - p.y)).toBeLessThan(80);
    expect(e.recovered).toBe(false);
    expect(e.nav.queries).toBeLessThan(25);
    expect(e.ai).not.toBe("无路径等待");
    // 可以已经到达合法站位；不能仍在旧受阻点无效空挥。
    expect(
      clearMeleeLine(initial, p) ||
        Math.hypot(initial.x - e.x, initial.y - e.y) > 5,
    ).toBe(true);
  });
  it("隔树不启动攻击，沿合法身体路径绕到站位；换侧会重新规划", () => {
    const e = enemy(3130, 941),
      p = { x: 3130, y: 991 };
    e.homeX = 3170;
    e.homeY = 930;
    expect(clearMeleeLine(e, p)).toBe(false);
    updateEnemy(e, p, 1, 1 / 60);
    expect(e.windup).toBe(0);
    expect(e.nav.queries).toBe(1);
    const positions = tickFor(e, p, 240, 1);
    expect(positions.some((s) => s.ai === "绕障")).toBe(true);
    expect(clearMeleeLine(e, p)).toBe(true);
    expect(positions.some((s) => s.windup > 0)).toBe(true);
    p.x = 3130;
    p.y = 941;
    tickFor(e, p, 300, 4001);
    expect(clearMeleeLine(e, p)).toBe(true);
    expect(e.recovered).toBe(false);
    expect(e.nav.queries).toBeLessThan(10);
  });
  it("前摇结束重新核对通路、距离、安全区；普通硬直不重置前摇", () => {
    const e = enemy(3130, 941),
      p = { x: 3170, y: 941 };
    updateEnemy(e, p, 1, 1 / 60);
    expect(e.windup).toBe(0.65);
    e.staggerUntil = 101;
    updateEnemy(e, p, 50, 1 / 60);
    expect(e.windup).toBe(0.65);
    p.x = 3130;
    p.y = 991;
    expect(updateEnemy(e, p, 1000, 1)).toBe(false);
    expect(e.rejection).toBe("tree-20");
    e.windup = 0.1;
    p.x = 3400;
    expect(updateEnemy(e, p, 2000, 0.2)).toBe(false);
    expect(e.rejection).toBe("结算距离");
    e.windup = 0.1;
    p.x = 2090;
    expect(updateEnemy(e, p, 3000, 0.2)).toBe(false);
    expect(e.rejection).toBe("村庄安全区");
  });
  it("四个正常出生点不变；非法夹具恢复最近连通点和home且保留ID、生命", () => {
    for (const d of enemyDefs) {
      const e = enemy(d.x, d.y);
      e.id = d.id;
      validateEnemyPosition(e);
      expect([e.x, e.y, e.homeX, e.homeY]).toEqual([d.x, d.y, d.x, d.y]);
      expect(e.recovered).toBe(false);
    }
    const e = enemy(3130, 965);
    e.hp = 19;
    validateEnemyPosition(e);
    expect(e.recovered).toBe(true);
    expect(e.disabled).toBe(false);
    expect(e.hp).toBe(19);
    expect(e.id).toBe("leaf-2");
    expect([e.homeX, e.homeY]).toEqual([e.x, e.y]);
    expect(motionBlocked(e.x, e.y)).toBe(false);
    expect(Math.hypot(e.x - 3130, e.y - 965)).toBeLessThan(40);
    const dead = enemy(3130, 965);
    dead.hp = 0;
    validateEnemyPosition(dead);
    expect(dead.hp).toBe(0);
    expect(dead.recovered).toBe(false);
  });
  it("无候选有硬预算；被封闭目标无路径，不能穿角或跨水", () => {
    let checks = 0;
    const noSpace = {
      blocked: () => {
        checks++;
        return true;
      },
      clear: () => false,
    };
    expect(
      nearestStanding({ x: 0, y: 0 }, [{ x: 50, y: 50 }], () => true, noSpace),
    ).toBeNull();
    expect(checks).toBeLessThanOrEqual(NAV.repairCandidates + 2);
    const path = localPath(
      { x: 0, y: 0 },
      () => false,
      { x: 100, y: 100 },
      () => true,
      { blocked: () => false, clear: () => true },
    );
    expect(path.path).toBeNull();
    expect(path.visited).toBeLessThanOrEqual(NAV.nodes);
    // 隔离静态墙夹具：墙越过整个局部搜索范围，保持角色位置合法。
    props.push({
      id: "test-sealed-wall",
      art: "fence",
      x: 3050,
      y: 2100,
      w: 15,
      h: 2000,
      solid: [15, 2000],
    });
    try {
      const e = enemy(3000, 1100),
        p = { x: 3100, y: 1100 };
      const trace = tickFor(e, p, 1200);
      expect(trace.every((q) => q.x < 3030)).toBe(true);
      expect(e.nav.queries).toBe(1);
      expect(e.ai).toBe("无路径等待");
    } finally {
      props.pop();
    }
  });
  it("玩家远离或回村后沿碰撞路径回家；合法击退越界也可返回", () => {
    const e = enemy();
    e.x = 3080;
    e.y = 1000;
    tickFor(e, { x: 670, y: 720 }, 600);
    expect(Math.hypot(e.x - e.homeX, e.y - e.homeY)).toBeLessThanOrEqual(8);
    expect(e.ai).toBe("家园");
    e.x = e.homeX + 440;
    e.y = e.homeY;
    tickFor(e, { x: 670, y: 720 }, 600, 10000);
    expect(Math.hypot(e.x - e.homeX, e.y - e.homeY)).toBeLessThanOrEqual(8);
  });
});

it("三连每段只命中一次，踏步、风步和击退保留完整脚底", async () => {
  const { CombatController, sweepMove } =
    await import("../src/game/systems/combat");
  const c = new CombatController(),
    p = { x: 3215, y: 965 },
    e = { id: "leaf-2", x: 3167, y: 965, hp: 100 };
  const events: number[] = [];
  const tick = (prev: number, now: number) =>
    c.update(
      prev,
      now,
      2,
      p,
      [e],
      motionBlocked,
      (x, y, tx, ty, id) => clearMeleeLine({ x, y }, { x: tx, y: ty }, id),
      (target, stage) => {
        events.push(stage);
        target.hp -= STRIKES[stage - 1].damage;
        sweepMove(
          target,
          -STRIKES[stage - 1].knock,
          0,
          motionBlocked,
          clearMotionLine,
        );
      },
      () => {},
      () => {},
      clearMotionLine,
    );
  c.requestAttack(0);
  tick(0, 0);
  c.requestAttack(60);
  tick(0, 260);
  c.requestAttack(300);
  tick(260, 1200);
  expect(events).toEqual([1, 2, 3]);
  expect(e.hp).toBe(32);
  expect(p.x).toBeGreaterThanOrEqual(3161);
  expect(e.x).toBeGreaterThanOrEqual(3161);
  expect(motionBlocked(p.x, p.y)).toBe(false);
  expect(motionBlocked(e.x, e.y)).toBe(false);
  const dash = { x: 3180, y: 965 };
  sweepMove(dash, -90, 0, motionBlocked, clearMotionLine);
  expect(dash.x).toBeGreaterThanOrEqual(3161);
  const corner = { x: 3162, y: 944 };
  sweepMove(corner, -100, 100, motionBlocked, clearMotionLine);
  expect(motionBlocked(corner.x, corner.y)).toBe(false);
});

it("桥面边界与站立口径一致；训练只忽略自身底座，邻物仍挡攻击", () => {
  const edge = { x: 1042, y: 1120 };
  expect(motionBlocked(edge.x, edge.y)).toBe(false);
  expect(clearMotionLine(edge, { x: 1042, y: 1150 })).toBe(true);
  props.push({
    id: "fixture-adjacent-tree",
    art: "tree",
    x: 850,
    y: 625,
    w: 190,
    h: 230,
    solid: [10, 15],
  });
  try {
    expect(
      meleeBlocker({ x: 850, y: 580 }, { x: 850, y: 650 }, "training-dummy"),
    ).toBe("fixture-adjacent-tree");
  } finally {
    props.pop();
  }
});
it("回家半径边界不在追击与返回间抖动", () => {
  const e = enemy(3000, 1100);
  e.x = 3421;
  const p = { x: 3560, y: 1100 };
  const trace = tickFor(e, p, 600);
  expect(trace.every((q) => q.ai !== "追击" && q.ai !== "绕障")).toBe(true);
  expect(Math.hypot(e.x - e.homeX, e.y - e.homeY)).toBeLessThanOrEqual(8);
});
