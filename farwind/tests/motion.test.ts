import { describe, it, expect } from "vitest";
import { Locomotion } from "../src/game/systems/locomotion";
import { Follower } from "../src/game/systems/follower";
describe("实际位移驱动的动作", () => {
  it("连续移动保留相位，不重复切换动作；帧序号不改变方向", () => {
    const m = new Locomotion();
    for (let i = 0; i < 120; i++) {
      m.update({ dx: 2.5, dy: 0, dt: 1 / 60 });
      expect(m.direction).toBe(3);
    }
    expect(m.changes).toBe(1);
    expect(m.distance).toBe(300);
    expect(m.phase).toBeCloseTo(0.125);
  });
  it("30/60/120 Hz 同距离与相位", () => {
    const values = [30, 60, 120].map((hz) => {
      const m = new Locomotion();
      for (let i = 0; i < hz * 2; i++)
        m.update({ dx: 150 / hz, dy: 0, dt: 1 / hz });
      return m;
    });
    for (const m of values) {
      expect(m.distance).toBeCloseTo(300);
      expect(m.phase).toBeCloseTo(0.125);
    }
  });
  it("撞墙零速允许转向，但站稳且没有步态", () => {
    const m = new Locomotion();
    m.update({ dx: 3, dy: 0, dt: 0.02 });
    for (let i = 0; i < 100; i++)
      m.update({ dx: 0, dy: 0, dt: 0.02, intentX: -1 });
    expect(m.action).toBe("idle");
    expect(m.direction).toBe(2);
    expect(m.phase).toBe(0);
    expect(m.changes).toBe(2);
  });
  it("猫依据自己位移；待机不清除向左朝向", () => {
    const m = new Locomotion(true);
    m.update({ dx: -4, dy: 0, dt: 0.02 });
    expect(m.action).toBe("run");
    m.update({ dx: 0, dy: 0, dt: 0.02 });
    expect(m.action).toBe("idle");
    expect(m.flipX).toBe(true);
  });
  it("攻击优先，暂停不累计，传送重置步态", () => {
    const m = new Locomotion();
    m.update({ dx: 4, dy: 0, dt: 0.02, attack: true });
    expect(m.action).toBe("attack");
    const before = { ...m };
    m.update({ dx: 100, dy: 0, dt: 0 });
    expect({ ...m }).toEqual(before);
    m.reset();
    expect(m.action).toBe("idle");
    expect(m.phase).toBe(0);
  });
});
describe("尾随停靠", () => {
  it("启动阈值高于停止阈值；停靠后稳定", () => {
    const f = new Follower();
    f.reset({ x: 0, y: 0 });
    let cat = { x: -78, y: 0 };
    cat = f.update(
      { x: 0, y: 0 },
      cat,
      1 / 60,
      () => true,
      () => false,
    );
    expect(f.following).toBe(false);
    for (let i = 0; i < 300; i++)
      cat = f.update(
        { x: 200, y: 0 },
        cat,
        1 / 60,
        () => true,
        () => false,
      );
    expect(f.following).toBe(false);
    expect(cat.x).toBeCloseTo(122, 0);
    const end = { ...cat };
    for (let i = 0; i < 100; i++)
      cat = f.update(
        { x: 200, y: 0 },
        cat,
        1 / 60,
        () => true,
        () => false,
      );
    expect(cat).toEqual(end);
  });
  it("碰撞阻止位移，无瞬移补偿", () => {
    const f = new Follower();
    f.reset({ x: 0, y: 0 });
    const cat = { x: -78, y: 0 };
    expect(
      f.update(
        { x: 200, y: 0 },
        cat,
        0.1,
        () => false,
        () => true,
      ),
    ).toEqual(cat);
    expect(f.speed).toBe(0);
  });
});

it("玩家在猫身边站定后选择稳定可通行停靠点", () => {
  const f = new Follower();
  f.reset({ x: 0, y: 0 });
  let cat = { x: 10, y: 0 };
  for (let i = 0; i < 240; i++)
    cat = f.update(
      { x: 0, y: 0 },
      cat,
      1 / 60,
      () => true,
      () => false,
    );
  expect(Math.hypot(cat.x, cat.y)).toBeGreaterThan(65);
  expect(f.following).toBe(false);
  const end = { ...cat };
  for (let i = 0; i < 120; i++)
    cat = f.update(
      { x: 0, y: 0 },
      cat,
      1 / 60,
      () => true,
      () => false,
    );
  expect(cat).toEqual(end);
});

it("视线漏过薄转角时按轴滑动而非永久卡住", () => {
  const f = new Follower();
  f.reset({ x: 0, y: 0 });
  const cat = { x: 0, y: 0 };
  const next = f.update(
    { x: 200, y: 200 },
    cat,
    0.02,
    () => true,
    (x, y) => x > 1 && y > 1,
  );
  expect(Math.hypot(next.x, next.y)).toBeGreaterThan(0);
  expect(next.x > 1 && next.y > 1).toBe(false);
});

import sharp from "sharp";
import { clipFor } from "../src/data/animation";
it("实际图集与方向帧映射契约：主角51／黑猫49个有效非空帧，走跑资源分离", async () => {
  for (const id of ["hero", "cat"]) {
    const { data, info } = await sharp(
      `public/assets/animation/round-three/${id}-motion.png`,
    )
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([1024, 896]);
    for (let frame = 0; frame < (id === "hero" ? 51 : 49); frame++) {
      let visible = 0;
      for (let y = 0; y < 128; y++)
        for (let x = 0; x < 128; x++)
          if (
            data[
              ((Math.floor(frame / 8) * 128 + y) * info.width +
                (frame % 8) * 128 +
                x) *
                4 +
                3
            ] > 40
          )
            visible++;
      expect(visible, `${id} 帧${frame}不能为空白`).toBeGreaterThan(200);
    }
    for (const direction of [0, 1, 2, 3] as const) {
      const idle = clipFor(id === "cat", direction, "idle"),
        walk = clipFor(id === "cat", direction, "walk"),
        run = clipFor(id === "cat", direction, "run");
      expect(walk.frames).toHaveLength(8);
      expect(walk.frames).not.toContain(idle.frames[0]);
      for (const f of [...idle.frames, ...walk.frames, ...run.frames])
        expect(f).toBeLessThan(id === "hero" ? 51 : 49);
      expect(run.frames).not.toEqual(walk.frames);
      expect(run.frames.length).toBeGreaterThanOrEqual(6);
      expect(new Set(run.frames).size).toBe(run.frames.length);
      expect(run.frames.some((f) => walk.frames.includes(f))).toBe(false);
    }
  }
});

import { Sprint, SPRINT } from "../src/game/systems/sprint";
import { resetSessionTimers } from "../src/game/systems/session";
describe("体力耗尽恢复与会话计时", () => {
  it("临界点、恢复期、重新允许奔跑和反复按放空格键", () => {
    const s = new Sprint();
    expect(s.update(100, true, 1 / 60).speed).toBe(235);
    expect(s.update(1, true, 1 / 60).running).toBe(false);
    for (const stamina of [1.1, 5, 19.99]) {
      s.update(stamina, false, 1 / 60);
      expect(s.update(stamina, true, 1 / 60).running).toBe(false);
    }
    expect(s.update(20, true, 1 / 60).running).toBe(true);
    expect(s.update(30, false, 1 / 60).running).toBe(false);
    s.reset(10);
    expect(s.exhausted).toBe(true);
    s.reset(100);
    expect(s.exhausted).toBe(false);
  });
  it("持续18秒跨越耗尽与完整恢复，不出现逐帧走跑振荡", () => {
    for (const hz of [30, 60, 120]) {
      const s = new Sprint();
      let stamina = 100,
        previous = true,
        sinceChange = 0,
        transitions = 0;
      for (let frame = 0; frame < hz * 18; frame++) {
        const before = stamina,
          r = s.update(stamina, true, 1 / hz);
        stamina = r.stamina;
        sinceChange++;
        if (r.running !== previous) {
          expect(sinceChange / hz).toBeGreaterThan(0.85);
          if (r.running) expect(before).toBeGreaterThanOrEqual(SPRINT.resumeAt);
          sinceChange = 0;
          transitions++;
          previous = r.running;
        }
      }
      expect(transitions).toBeGreaterThan(4);
      expect(transitions).toBeLessThan(15);
    }
  });
  it("重置旧攻击时间，不改变背包、世界时间及设置", () => {
    const t = {
      sim: 50000,
      attackUntil: 48000,
      cooldown: 49000,
      invulnerable: 49500,
      time: 800,
      volume: 0.4,
      bag: ["herb"],
    };
    resetSessionTimers(t);
    expect(t).toEqual({
      sim: 0,
      attackUntil: 0,
      cooldown: 0,
      invulnerable: 0,
      time: 800,
      volume: 0.4,
      bag: ["herb"],
    });
    const m = new Locomotion();
    m.update({ dx: 2.5, dy: 0, dt: 1 / 60, attack: t.sim < t.attackUntil });
    expect(m.action).toBe("walk");
  });
});

it("追加图集保留原35帧；方向与镜像不受帧序号影响", async () => {
  for (const id of ["hero", "cat"]) {
    const old = await sharp(
      `public/assets/animation/round-two/${id}-motion.png`,
    )
      .raw()
      .toBuffer();
    const now = await sharp(
      `public/assets/animation/round-three/${id}-motion.png`,
    )
      .extract({ left: 0, top: 0, width: 1024, height: 640 })
      .raw()
      .toBuffer();
    // 末行原先留白的五格现已用于追加帧，只比较原来的35格。
    for (let f = 0; f < 35; f++)
      for (let y = 0; y < 128; y++) {
        const offset =
          ((Math.floor(f / 8) * 128 + y) * 1024 + (f % 8) * 128) * 4;
        expect(
          now
            .subarray(offset, offset + 512)
            .equals(old.subarray(offset, offset + 512)),
        ).toBe(true);
      }
    for (const d of [0, 1, 2, 3] as const) {
      for (const a of ["idle", "walk", "run"] as const) {
        const c = clipFor(id === "cat", d, a);
        expect(c.flip).toBe(d === 2);
        expect(c.frames.every((f) => Number.isInteger(f) && f >= 0)).toBe(true);
      }
    }
    expect(
      clipFor(id === "cat", 0, "run").frames.some((f) =>
        clipFor(id === "cat", 1, "run").frames.includes(f),
      ),
    ).toBe(false);
  }
});
it("竖向跑步30/60/120Hz同总距离与相位；停步仍回待机", () => {
  for (const cat of [false, true])
    for (const direction of [-1, 1]) {
      const results = [30, 60, 120].map((hz) => {
        const m = new Locomotion(cat);
        for (let i = 0; i < hz * 3; i++)
          m.update({ dx: 0, dy: (direction * 235) / hz, dt: 1 / hz });
        return m;
      });
      const phase = results[0].phase;
      for (const m of results) {
        expect(m.distance).toBeCloseTo(705);
        expect(m.phase).toBeCloseTo(phase);
        expect(m.direction).toBe(direction < 0 ? 1 : 0);
        m.update({ dx: 0, dy: 0, dt: 1 / 60 });
        expect(m.action).toBe("idle");
      }
    }
});
