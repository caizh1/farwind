import { describe, it, expect } from "vitest";
import { initialState, validate } from "../src/game/systems/state";
import { EastDefense, prepareRaid } from "../src/game/systems/defense";
import { NpcLife } from "../src/game/systems/npcLife";
import { advanceTime } from "../src/game/systems/worldClock";
import { TIMELINE } from "../src/game/systems/timeline";

describe("卫兵移动朝向稳定与真实转向", () => {
  it.each([30, 60, 120])("新游戏 %i Hz：松岚斜向去取手册时不反复切换动画行", hz => {
    const s = initialState(), d = new EastDefense(s.defense, 0), l = new NpcLife(s, d);
    const g = s.defense.guards.find(g => g.id === "north-watch")!, r = d.runtime.get(g.id)!;
    let now = 0, diagonalSteps = 0;
    // 与世界主循环一致：每帧共享两份预算，先驻防、后生活，时间轴最多推进五毫秒。
    for (let frame = 1; frame <= hz * 7; frame++) {
      const end = frame * 1000 / hz, budget = { queries: 2 };
      while (now < end - 1e-7) {
        const to = Math.min(end, (Math.floor((now + 1e-7) / TIMELINE.quantum) + 1) * TIMELINE.quantum), ms = to - now;
        const old = { x: g.x, y: g.y };
        s.time = advanceTime(s.time, ms);
        d.update(to, ms, s.player, budget);
        l.step(ms, budget);
        l.consumeDefense(d.drainNotices());
        const dx = g.x - old.x, dy = g.y - old.y;
        if (g.y <= 420 && dx > .001 && dy > .001 && Math.abs(dx - dy) < 1e-9) {
          diagonalSteps++;
          expect(r.facing, `模拟 ${to} 毫秒，实际位移 ${dx}, ${dy}`).toBe(3);
        }
        now = to;
      }
    }
    expect(diagonalSteps).toBeGreaterThan(50);
    expect(g.y).toBeGreaterThan(420);
    expect(s.life.people.find(n => n.id === g.id)!.pathFailures).toBe(0);
  });

  it("普通值守返岗同样稳定，到岗后站稳，反向朝向仍正确", () => {
    const s = initialState(), g = s.defense.guards.find(g => g.id === "north-watch")!;
    Object.assign(g, { x: 800.1, y: 360.1, mode: "return" });
    const d = new EastDefense(s.defense, 0), r = d.runtime.get(g.id)!;
    r.facing = 2;
    let moved = 0;
    for (let now = 5; now <= 2000; now += 5) {
      d.update(now, 5, s.player, { queries: 2 });
      if (r.moved > .001) {
        moved++;
        expect(r.facing).toBe(2);
      }
    }
    expect(moved).toBeGreaterThan(100);
    expect(Math.hypot(g.x - 740, g.y - 300)).toBeLessThanOrEqual(3);
    expect(r.moved).toBe(0);
    expect(g.mode).toBe("post");
  });

  it("斜线途中读档保留位置并继续真实前进", () => {
    let s = initialState(), d = new EastDefense(s.defense, 0), l = new NpcLife(s, d);
    const tick = (ms: number) => {
      const now = s.life.elapsed + ms, b = { queries: 2 };
      s.time = advanceTime(s.time, ms);
      d.update(now, ms, s.player, b); l.step(ms, b); l.consumeDefense(d.drainNotices());
    };
    for (let i = 0; i < 220; i++) tick(5);
    const old = structuredClone(s.defense.guards.find(g => g.id === "north-watch")!);
    expect(old.y).toBeGreaterThan(300);
    s = validate(JSON.parse(JSON.stringify(s)));
    d = new EastDefense(s.defense, s.life.elapsed); l = new NpcLife(s, d);
    const g = s.defense.guards.find(g => g.id === old.id)!, r = d.runtime.get(g.id)!;
    expect(g).toEqual(old);
    for (let i = 0; i < 260; i++) {
      tick(5);
      if (g.y < 420 && r.moved > .001) expect(r.facing).toBe(3);
    }
    expect(g.y).toBeGreaterThan(old.y + 60);
  });

  it("敌人出现在身后时立即面向实际攻击方向并结算真实命中", () => {
    const s = initialState();
    s.defense = prepareRaid(s.defense, s.player, "north-gate", 1);
    const d = new EastDefense(s.defense, 0), g = s.defense.guards.find(g => g.id === "north-watch")!, r = d.runtime.get(g.id)!, enemy = d.enemies[0];
    Object.assign(enemy, { x: g.x, y: g.y - 50 });
    d.update(5, 5, s.player, { queries: 2 });
    expect(r.attack).not.toBeNull();
    expect(r.facing).toBe(1);
    expect(r.attack!.direction).toEqual({ x: 0, y: -1 });
    const hp = enemy.hp;
    for (let now = 10; now <= 290; now += 5) d.update(now, 5, s.player, { queries: 2 });
    expect(enemy.hp).toBe(hp - 18);
  });
});
