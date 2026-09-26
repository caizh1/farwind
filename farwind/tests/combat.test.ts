import { describe, expect, it } from "vitest";
import {
  CombatController,
  COMBAT,
  STRIKES,
  enemyTint,
  sweepMove,
} from "../src/game/systems/combat";
import { add, count, initialState, parseSave } from "../src/game/systems/state";
import {
  combatVisual,
  COMBAT_ACTION_ART,
  weaponSample,
} from "../src/data/animation";
import sharp from "sharp";
import { createHash } from "node:crypto";

function arena() {
  const c = new CombatController();
  const p = { x: 0, y: 0 };
  const enemies = [
    { id: "a", x: 0, y: 50, hp: 100 },
    { id: "b", x: 10, y: 55, hp: 100 },
  ];
  const hits: string[] = [];
  const starts: number[] = [];
  const tick = (prev: number, now: number, facing: 0 | 1 | 2 | 3 = 0) =>
    c.update(
      prev,
      now,
      facing,
      p,
      enemies,
      () => false,
      () => true,
      (e, stage) => {
        e.hp -= STRIKES[stage - 1].damage;
        hits.push(`${stage}:${e.id}`);
      },
      (stage) => starts.push(stage),
    );
  return { c, p, enemies, hits, starts, tick };
}
describe("普攻时间轴和连段", () => {
  it("过期缓冲先释放本步新输入，并与无旧缓冲的对照一致", () => {
    for (const stale of [false, true]) {
      const a = arena();
      a.c.requestAttack(0);
      a.tick(0, 0);
      if (stale) a.c.requestAttack(90);
      a.tick(0, 230);
      a.c.requestAttack(250);
      a.tick(230, 250);
      expect(a.starts).toEqual([1, 2]);
      expect(a.c.pending).toBe(false);
    }
  });
  it("第三段末尾一次缓存仅在完整收招后重启第一段", () => {
    const a = arena();
    a.c.requestAttack(0);
    a.tick(0, 0);
    a.c.requestAttack(240);
    a.tick(0, 240);
    a.c.requestAttack(530);
    a.tick(240, 530);
    expect(a.starts).toEqual([1, 2, 3]);
    a.c.requestAttack(600);
    expect(a.c.pending).toBe(false);
    a.c.requestAttack(900);
    a.c.requestAttack(900);
    a.tick(530, 1039);
    expect(a.starts).toEqual([1, 2, 3]);
    a.tick(1039, 1040);
    expect(a.starts).toEqual([1, 2, 3, 1]);
    a.tick(1040, 1200);
    expect(a.starts).toEqual([1, 2, 3, 1]);
  });
  it("前摇不伤害，有效期多目标各命中一次；跨整段有效期仍结算一次", () => {
    const a = arena();
    a.c.requestAttack(0);
    a.tick(0, 0);
    a.tick(0, 70);
    expect(a.hits).toEqual([]);
    a.tick(70, 190);
    expect(a.hits).toEqual(["1:a", "1:b"]);
    a.tick(190, 300);
    expect(a.hits).toHaveLength(2);
    const b = arena();
    b.c.requestAttack(0);
    b.tick(0, 0);
    b.tick(0, 400);
    expect(b.hits).toEqual(["1:a", "1:b"]);
  });
  it("一个缓冲只衔接一段，提前过久过期，同帧请求合并，宽限过后回第一段", () => {
    const a = arena();
    a.c.requestAttack(0);
    a.c.requestAttack(0);
    a.tick(0, 0);
    expect(a.starts).toEqual([1]);
    a.c.requestAttack(50);
    a.tick(0, 220);
    expect(a.c.pending).toBe(false);
    a.c.requestAttack(230);
    a.tick(220, 240);
    expect(a.starts).toEqual([1, 2]);
    a.tick(240, 500);
    expect(a.starts).toEqual([1, 2]);
    a.c.requestAttack(520);
    a.tick(500, 530);
    expect(a.starts).toEqual([1, 2, 3]);
    a.tick(530, 650);
    expect(a.starts).toEqual([1, 2, 3]);
    a.tick(650, 1200);
    a.c.requestAttack(1200);
    a.tick(1200, 1200);
    expect(a.starts).toEqual([1, 2, 3, 1]);
  });
  it("方向按段锁定，风步仅在允许收招时取消，受击和会话清理旧命中", () => {
    const a = arena();
    a.c.requestAttack(0);
    a.tick(0, 0, 0);
    a.tick(0, 100, 1);
    expect(a.c.attack?.facing).toBe(0);
    expect(a.c.requestDash(100, 100, { x: 1, y: 0 }, 1)).toBe(false);
    expect(a.c.requestDash(250, 100, { x: 1, y: 0 }, 1)).toBe(true);
    expect(a.c.attack).toBeNull();
    a.c.reset();
    a.c.requestAttack(500);
    a.tick(500, 500, 1);
    expect(a.c.attack?.stage).toBe(1);
    expect(a.c.attack?.facing).toBe(1);
    a.c.reset();
    a.tick(500, 1000);
    expect(a.hits).toEqual(["1:a", "1:b"]);
  });
});
it("动作样本用攻击时间选出有效帧、方向与阶段，并匹配真实图集", async () => {
  const atlas = sharp("public/assets/animation/hero-combat-action.png");
  expect(await atlas.metadata()).toMatchObject({ width: 960, height: 1440 });
  for (let view = 0; view < 3; view++) {
    let previousEnd = "";
    for (let stage = 0; stage < 3; stage++) {
      const hashes: string[] = [];
      for (let pose = 0; pose < 6; pose++) {
        const pixels = await sharp(
          "public/assets/animation/hero-combat-action.png",
        )
          .extract({
            left: pose * 160,
            top: (view * 3 + stage) * 160,
            width: 160,
            height: 160,
          })
          .raw()
          .toBuffer();
        hashes.push(createHash("sha256").update(pixels).digest("hex"));
      }
      expect(new Set(hashes).size).toBe(6);
      if (previousEnd) expect(hashes[0]).toBe(previousEnd);
      previousEnd = hashes[5];
    }
  }
  for (const facing of [0, 1, 2, 3] as const) {
    for (let stage = 1; stage <= 3; stage++) {
      const move = STRIKES[stage - 1];
      const times = [
        0,
        move.windup * 0.6,
        move.windup,
        move.windup + move.active * 0.6,
        move.windup + move.active,
        move.windup + move.active + move.recovery * 0.6,
      ];
      const samples = times.map((time) => combatVisual(stage, facing, time));
      expect(samples.map((s) => s.frameIndex)).toEqual([0, 1, 2, 3, 4, 5]);
      expect(samples.map((s) => s.phase)).toEqual([
        "windup",
        "windup",
        "active",
        "active",
        "recovery",
        "recovery",
      ]);
      expect(new Set(samples.map((s) => s.frame)).size).toBe(6);
      expect(
        samples.every(
          (s) =>
            s.texture === "hero-combat-action" &&
            s.facing === facing &&
            s.frame >= 0 &&
            s.frame < 54,
        ),
      ).toBe(true);
    }
  }
  expect(COMBAT_ACTION_ART.footY).toBeLessThan(COMBAT_ACTION_ART.frameSize);
  expect(combatVisual(1, 2, 90).frame).toBe(combatVisual(1, 3, 90).frame);
  expect(combatVisual(1, 0, 90).frame).not.toBe(combatVisual(1, 1, 90).frame);
});
describe("风步、碰撞和保护", () => {
  it("成本由成功启动决定，冷却、无敌边界与独立保护不混淆", () => {
    const c = new CombatController();
    expect(c.requestDash(0, 19, { x: 0, y: 0 }, 0)).toBe(false);
    expect(c.dashCooldown).toBe(0);
    expect(c.requestDash(0, 20, { x: 0, y: 0 }, 0)).toBe(true);
    expect(c.requestDash(1, 100, { x: 0, y: 0 }, 0)).toBe(false);
    expect(c.invulnerable(39)).toBe(false);
    expect(c.invulnerable(40)).toBe(true);
    expect(c.invulnerable(140)).toBe(false);
    expect(c.dashCooldown).toBe(COMBAT.dash.cooldown);
    const p = { x: 0, y: 0 };
    c.update(
      0,
      50,
      0,
      p,
      [],
      () => false,
      () => true,
      () => {},
      () => {},
    );
    expect(p.y).toBeCloseTo(22.5);
  });
  it("位移子步不能跨越窄墙；命中不隔墙且不打背后", () => {
    const p = { x: 0, y: 0 };
    sweepMove(p, 90, 0, (x) => x >= 30);
    expect(p.x).toBeLessThan(30);
    const a = arena();
    a.c.requestAttack(0);
    a.c.update(
      0,
      0,
      0,
      a.p,
      a.enemies,
      () => false,
      () => false,
      () => {
        throw Error("隔墙命中");
      },
      () => {},
    );
    a.c.update(
      0,
      100,
      0,
      a.p,
      a.enemies,
      () => false,
      () => false,
      () => {
        throw Error("隔墙命中");
      },
      () => {},
    );
    expect(a.enemies[0].hp).toBe(100);
    a.enemies[0].y = -50;
    a.tick(100, 150);
    expect(a.hits).toEqual(["1:b"]);
  });
});
it("旧档迁移、满包待领取掉落往返和一次性领取", () => {
  const old = initialState();
  delete (old as Partial<typeof old>).pendingDrops;
  delete (old as Partial<typeof old>).dashCooldownRemaining;
  expect(parseSave(JSON.stringify(old)).pendingDrops).toEqual([]);
  const withCooldown = initialState();
  withCooldown.dashCooldownRemaining = 380;
  const loaded = parseSave(JSON.stringify(withCooldown));
  const resumed = new CombatController();
  resumed.reset(loaded.dashCooldownRemaining);
  expect(resumed.dashCooldown).toBe(380);
  expect(resumed.dashUntil).toBe(0);
  expect(resumed.invulnerable(50)).toBe(false);
  const s = initialState();
  s.bag = Array.from({ length: 24 }, () => ({
    id: "stone" as const,
    count: 20,
  }));
  s.killed.push("leaf-1");
  s.pendingDrops.push({ enemyId: "leaf-1", item: "crystal", x: 2320, y: 1070 });
  const restored = parseSave(JSON.stringify(s));
  expect(count(restored, "crystal")).toBe(0);
  expect(restored.pendingDrops).toHaveLength(1);
  expect(add(restored, "crystal", 1)).toBe(false);
  restored.bag[0] = null;
  expect(add(restored, "crystal", 1)).toBe(true);
  restored.pendingDrops = [];
  const again = parseSave(JSON.stringify(restored));
  expect(count(again, "crystal")).toBe(1);
  expect(again.pendingDrops).toHaveLength(0);
});
it("受击闪色覆盖前摇预警直到期限，30/60/120 Hz 命中与阶段一致", () => {
  expect(enemyTint(100, 210, 0.4)).toBe(0xff8585);
  expect(enemyTint(210, 210, 0.4)).toBe(0xffce84);
  expect(enemyTint(300, 210, 0)).toBeNull();
  for (const hz of [30, 60, 120]) {
    const a = arena();
    a.c.requestAttack(0);
    for (let frame = 0; frame <= hz; frame++)
      a.tick((frame * 1000) / hz, ((frame + 1) * 1000) / hz);
    expect(a.hits).toEqual(["1:a", "1:b"]);
    expect(a.c.attack).toBeNull();
  }
});

describe("本轮连段事件边界", () => {
  function third() {
    const a = arena();
    a.c.requestAttack(0);
    a.tick(0, 0, 3);
    a.c.requestAttack(235);
    a.tick(0, 235, 3);
    a.c.requestAttack(520);
    a.tick(235, 520, 3);
    expect(a.c.attack?.stage).toBe(3);
    return a;
  }
  it("1030 完成，1031 到期，1040 更新：合法旧请求按1030启动一次", () => {
    const a = third();
    a.c.requestAttack(881);
    a.tick(520, 1000, 3);
    a.tick(1000, 1040, 3);
    expect(a.starts).toEqual([1, 2, 3, 1]);
    expect(a.c.attack?.start).toBe(1030);
    a.tick(1040, 1100, 3);
    expect(a.starts).toHaveLength(4);
  });
  it("本步新输入不能倒用到上段完成时刻", () => {
    const a = third();
    a.tick(520, 1040, 3);
    a.c.requestAttack(1040);
    a.tick(1040, 1040, 3);
    expect(a.c.attack?.start).toBe(1040);
  });
  it("等于到期合法，超过到期不能续招", () => {
    for (const request of [879, 880]) {
      const a = third();
      a.c.requestAttack(request);
      a.tick(520, 1040, 3);
      expect(a.starts).toHaveLength(request === 880 ? 4 : 3);
    }
  });
  it("持剑等待独立于攻击实例，松键风步沿锁定面向，有输入优先", () => {
    for (const axis of [
      { x: 0, y: 0 },
      { x: -1, y: 0 },
    ]) {
      const a = arena();
      a.c.requestAttack(0);
      a.tick(0, 0, 3);
      a.tick(0, 250, 2);
      expect(a.c.requestDash(250, 100, axis, 2)).toBe(true);
      expect(a.c.dashX).toBe(axis.x || 1);
    }
    const a = arena();
    a.c.requestAttack(0);
    a.tick(0, 335, 3);
    expect(a.c.attack).toBeNull();
    expect(a.c.readyUntil).toBe(535);
    expect(a.c.effectiveFacing(351, 2)).toBe(3);
    a.c.requestAttack(351);
    a.tick(335, 351, 3);
    expect(a.c.attack?.stage).toBe(2);
    a.c.reset();
    expect(a.c.readyUntil).toBe(0);
  });
  it("30/60/120Hz及抖动步长推进同一输入事件，命中与位移一致", () => {
    const results = [];
    for (const steps of [
      [1000 / 30],
      [1000 / 60],
      [1000 / 120],
      [7, 41, 13, 29],
    ]) {
      const a = arena();
      let prev = 0,
        i = 0;
      const inputs = [0, 235, 520, 881];
      a.c.requestAttack(inputs.shift()!);
      a.tick(0, 0);
      while (prev < 1500) {
        const now = Math.min(
          1500,
          prev + steps[i++ % steps.length],
          inputs[0] ?? Infinity,
        );
        a.tick(prev, now);
        if (now === inputs[0]) {
          a.c.requestAttack(inputs.shift()!);
          a.tick(now, now);
        }
        prev = now;
      }
      results.push({ starts: a.starts, hits: a.hits, y: a.p.y });
    }
    for (const r of results) {
      expect(r.starts).toEqual(results[0].starts);
      expect(r.hits).toEqual(results[0].hits);
      expect(r.y).toBeCloseTo(results[0].y, 7);
    }
  });
});

it("左右武器局部坐标严格水平镜像，正背视图独立，非有效期无刀光", () => {
  for (let stage = 1; stage <= 3; stage++) {
    for (const t of [
      0,
      STRIKES[stage - 1].windup,
      STRIKES[stage - 1].windup + 80,
      600,
    ]) {
      const left = weaponSample(stage, 2, t),
        right = weaponSample(stage, 3, t);
      expect(left.tip.x).toBe(-right.tip.x);
      expect(left.tip.y).toBe(right.tip.y);
      expect(left.grip.x).toBe(-right.grip.x);
      expect(left.grip.y).toBe(right.grip.y);
      expect(left.visible).toBe(right.visible);
      if (t === 0 || t === 600) expect(left.visible).toBe(false);
    }
  }
});
