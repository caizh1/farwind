import { describe, expect, it } from "vitest";
import {
  CombatController,
  COMBAT,
  STRIKES,
  enemyTint,
  sweepMove,
} from "../src/game/systems/combat";
import { add, count, initialState, parseSave } from "../src/game/systems/state";

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
