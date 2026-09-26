import { describe, it, expect } from "vitest";
import {
  CombatController,
  STRIKES,
  clearPath,
  sweepMove,
  inStrike,
  type Attack,
} from "../src/game/systems/combat";
import { TrainingDummy, TRAINING } from "../src/game/systems/training";
import { solidPropAt } from "../src/data/world";
import { initialState, parseSave } from "../src/game/systems/state";
const line = (x: number, y: number, tx: number, ty: number, id: string) =>
  clearPath(x, y, tx, ty, solidPropAt, id);
function arena() {
  const c = new CombatController(),
    t = new TrainingDummy(),
    p = { x: TRAINING.x, y: TRAINING.y + 70 },
    events: number[] = [];
  const tick = (prev: number, now: number) =>
    c.update(
      prev,
      now,
      1,
      p,
      [t],
      solidPropAt,
      line,
      (_, stage, a) => {
        t.sync(c.epoch);
        if (t.hit(a, now)) {
          events.push(stage);
          c.stopOnHit(stage);
        }
      },
      (_, a) => {
        t.sync(c.epoch);
        t.begin(a);
      },
    );
  return { c, t, p, events, tick };
}
describe("训练对象共享战斗链", () => {
  it("单击仅一次，60ms预约三连各命中一次，当前配置合计68", () => {
    const a = arena();
    a.c.requestAttack(0);
    a.tick(0, 0);
    a.tick(0, 74);
    expect(a.events).toEqual([]);
    a.tick(74, 190);
    a.tick(190, 800);
    expect(a.events).toEqual([1]);
    const b = arena();
    b.c.requestAttack(0);
    b.tick(0, 0);
    b.c.requestAttack(60);
    for (const t of [70, 80, 90]) b.c.requestAttack(t);
    b.tick(0, 260);
    expect(b.events).toEqual([1]);
    b.c.requestAttack(300);
    b.tick(260, 1200);
    expect(b.events).toEqual([1, 2, 3]);
    expect(b.t.damage).toBe(STRIKES.reduce((n, s) => n + s.damage, 0));
    expect(b.t.damage).toBe(68);
    expect(b.t.snapshot(1200).complete).toBe(true);
    expect(b.c.hitStopRemaining).toBe(58);
  });
  it("未命中段不凑成功；独立单击不能拼为三连；取消与新会话清统计", () => {
    const a = arena();
    a.c.requestAttack(0);
    a.tick(0, 0);
    a.p.x += 300;
    a.c.requestAttack(60);
    a.tick(0, 260);
    a.p.x = TRAINING.x;
    a.c.requestAttack(300);
    a.tick(260, 1200);
    expect(a.t.stages.has(1)).toBe(false);
    expect(a.t.snapshot(1200).complete).toBe(false);
    a.c.requestAttack(1500);
    a.tick(1200, 1900);
    expect(a.t.stages.size).toBe(1);
    expect(a.t.damage).toBe(18);
    a.c.requestDash(1900, 100, { x: 1, y: 0 }, 1);
    a.t.sync(a.c.epoch);
    expect(a.t.damage).toBe(0);
    a.c.reset();
    a.t.sync(a.c.epoch);
    expect(a.t.comboId).toBe(-1);
  });
  it("四方向均忽略自身底座而命中；超距、背对、真实房屋仍遮挡", () => {
    const dummy = new TrainingDummy();
    const dirs = [
      [0, 1],
      [0, -1],
      [-1, 0],
      [1, 0],
    ];
    dirs.forEach(([x, y], f) => {
      const p = { x: dummy.x - x * 65, y: dummy.y - y * 65 },
        a = {
          id: 1,
          stage: 1,
          facing: f as 0 | 1 | 2 | 3,
          start: 0,
          hit: new Set<string>(),
        };
      expect(clearPath(p.x, p.y, dummy.x, dummy.y, solidPropAt)).toBe(false);
      expect(inStrike(p, dummy, a, line)).toBe(true);
      expect(
        inStrike(
          { ...p, x: dummy.x - x * 150, y: dummy.y - y * 150 },
          dummy,
          a,
          line,
        ),
      ).toBe(false);
      expect(
        inStrike(p, dummy, { ...a, facing: ([1, 0, 3, 2] as const)[f] }, line),
      ).toBe(false);
    });
    // 隔离几何夹具：沿实际房屋占地射线，目标ID只豁免自身，不能豁免房屋。
    expect(
      inStrike(
        { x: 330, y: 625 },
        { ...dummy, x: 330, y: 550 },
        { id: 1, stage: 1, facing: 1, start: 0, hit: new Set() },
        line,
      ),
    ).toBe(false);
  });
  it("底座阻挡普攻踏步和风步扫掠；逻辑根不随表现或长期训练移动", () => {
    for (const distance of [51, 90, 300]) {
      const p = { x: TRAINING.x, y: TRAINING.y + 45 };
      sweepMove(p, 0, -distance, solidPropAt);
      expect(p.y).toBeGreaterThanOrEqual(TRAINING.y + 10);
    }
    const a = arena(),
      state = initialState();
    state.bag = state.bag.map(() => ({ id: "stone", count: 20 }));
    const before = JSON.stringify(state);
    for (let i = 0; i < 1000; i++) {
      const at = i * 1300;
      a.c.requestAttack(at);
      a.tick(at, at);
      a.c.requestAttack(at + 60);
      a.tick(at, at + 260);
      a.c.requestAttack(at + 300);
      a.tick(at + 260, at + 1200);
    }
    expect(a.events).toHaveLength(3000);
    expect(a.t.hp).toBe(1);
    expect([a.t.x, a.t.y]).toEqual([TRAINING.x, TRAINING.y]);
    expect(a.t.instances.size).toBe(3);
    expect(JSON.stringify(state)).toBe(before);
    expect(a.t.snapshot(1304000).visible).toBe(false);
  });
  it("暂停模拟时间不变时统计不消退；旧档无需迁移或训练持久化", () => {
    const a = arena();
    a.c.requestAttack(0);
    a.tick(0, 100);
    expect(a.t.snapshot(100)).toEqual(a.t.snapshot(100));
    const save = initialState();
    expect(parseSave(JSON.stringify(save))).toEqual(save);
    expect(JSON.stringify(save)).not.toContain("training");
  });
});
