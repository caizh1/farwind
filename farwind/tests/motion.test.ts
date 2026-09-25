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
it("实际图集与方向帧映射契约：35个有效非空帧，走跑资源分离", async () => {
  for (const id of ["hero", "cat"]) {
    const { data, info } = await sharp(
      `public/assets/animation/round-two/${id}-motion.png`,
    )
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([1024, 640]);
    for (let frame = 0; frame < 35; frame++) {
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
        expect(f).toBeLessThan(35);
      if (direction >= 2) expect(run.frames).not.toEqual(walk.frames);
      else expect(run.provisional).toBe(true);
    }
  }
});
