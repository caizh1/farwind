import { test, expect } from "@playwright/test";
import { move } from "./map-navigation";
const read = (page: any) => page.evaluate(() => (window as any).__farwind());
async function hold(page: any, keys: string[], ms: number) {
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(ms);
  const during = await read(page);
  for (const k of keys.reverse()) await page.keyboard.up(k);
  await page.waitForTimeout(100);
  return during;
}
test("motion-directions-wall-stop-pause", async ({ page }) => {
  await page.goto("/?animationDebug=1");
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  await page.waitForFunction(
    () => (window as any).__farwind?.().session.sim > 500,
  );
  await page.waitForTimeout(300);
  for (const [key, direction] of [
    ["d", 3],
    ["a", 2],
    ["s", 0],
    ["w", 1],
  ] as const) {
    const s = await hold(page, [key], 400);
    expect(s.animation.hero.direction).toBe(direction);
    expect(s.animation.hero.action).toBe("walk");
    await expect
      .poll(async () => (await read(page)).animation.hero.action)
      .toBe("idle");
  }
  for (const [key, direction] of [
    ["s", 0],
    ["w", 1],
    ["d", 3],
    ["a", 2],
  ] as const) {
    const run = await hold(page, ["Space", key], 400);
    expect(run.animation.hero.direction).toBe(direction);
    expect(run.animation.hero.action).toBe("run");
    expect(run.animation.hero.provisional).toBe(false);
    expect(run.animation.hero.speed).toBeCloseTo(235, 0);
  }
  const diagonal = await hold(page, ["d", "s"], 400);
  expect(diagonal.animation.hero.speed).toBeCloseTo(150, 0);
  const run = await hold(page, ["Space", "a"], 400);
  expect(run.animation.hero.action).toBe("run");
  expect(run.animation.hero.speed).toBeCloseTo(235, 0);
  const x = (await read(page)).state.player.x;
  await hold(page, [x < 670 ? "d" : "a"], (Math.abs(670 - x) / 150) * 1000);
  await hold(page, ["w"], 2600);
  await page.keyboard.down("w");
  await page.waitForTimeout(200);
  const wall = await read(page);
  expect(wall.animation.hero.action).toBe("idle");
  expect(wall.animation.hero.speed).toBe(0);
  await page.keyboard.up("w");
  await hold(page, ["s"], 1600);
  for (const key of ["d", "a", "d", "a"]) await hold(page, [key], 600);
  await page.waitForTimeout(2200);
  const settled = await read(page);
  expect(settled.animation.cat.action).toBe("idle");
  expect(settled.companion.blocked).toBe(false);
  expect(
    Math.hypot(
      settled.animation.cat.root[0] - settled.state.player.x,
      settled.animation.cat.root[1] - settled.state.player.y,
    ),
  ).toBeGreaterThan(50);
  await page.keyboard.press("Escape");
  await expect(page.getByText("世界与时间已暂停。")).toBeVisible();
  const paused = await read(page);
  await hold(page, ["d"], 400);
  expect((await read(page)).state.player).toEqual(paused.state.player);
  await page.keyboard.press("Escape");
  await expect(page.locator("#modal")).toBeHidden();
  expect((await hold(page, ["d"], 300)).animation.hero.action).toBe("walk");
  await page.screenshot({
    path: process.env.FARWIND_EVIDENCE_ROOT
      ? `${process.env.FARWIND_EVIDENCE_ROOT}/debug-runtime.png`
      : "docs/combat/regression/debug-runtime.png",
  });
});
test("companion-well-house-corners", async ({ page }) => {
  await page.goto("/?animationDebug=1");
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  await page.waitForFunction(
    () => (window as any).__farwind?.().session.sim > 500,
  );
  await page.waitForTimeout(300);
  async function go(x: number, y: number) {
    for (const axis of ["x", "y"] as const) {
      const target = axis === "x" ? x : y;
      for (let attempt = 0; attempt < 80; attempt++) {
        const p = (await read(page)).state.player,
          delta = target - p[axis];
        if (Math.abs(delta) < 4) break;
        await hold(
          page,
          [axis === "x" ? (delta > 0 ? "d" : "a") : delta > 0 ? "s" : "w"],
          Math.min(200, (Math.abs(delta) / 150) * 1000),
        );
      }
      expect(
        Math.abs((await read(page)).state.player[axis] - target),
      ).toBeLessThan(5);
    }
    expect((await read(page)).companion.blocked).toBe(false);
  }
  await go(850, 860);
  await go(1040, 860);
  await go(1040, 700);
  await page.waitForTimeout(2500);
  expect((await read(page)).animation.cat.action).toBe("idle");
  await go(1180, 700);
  // 当前房屋(1120,400)占地覆盖(1180,390)，经栅栏和树干外侧绕到屋后。
  await go(1360, 700);
  // 小院现已连续围合，从院外绕到屋后，保留原房屋转角与黑猫跟随检查。
  await move(page, 1360, 270);
  // 西侧树干与院篱之间较窄，从树干外侧绕行，保留稳定的脚底余量。
  await go(790, 270);
  await go(790, 390);
  await go(830, 390);
  // 新训练木桩占据(850,650)：沿西侧绕行，保留原房屋转角与跟随断言。
  await go(810, 390);
  await go(810, 700);
  await go(830, 700);
  await page.waitForTimeout(3000);
  const s = await read(page);
  expect(s.companion.blocked).toBe(false);
  expect(s.animation.cat.action).toBe("idle");
  expect(
    Math.hypot(
      s.companion.x - s.state.player.x,
      s.companion.y - s.state.player.y,
    ),
  ).toBeLessThan(130);
  await page.screenshot({
    path: process.env.FARWIND_EVIDENCE_ROOT
      ? `${process.env.FARWIND_EVIDENCE_ROOT}/corner-runtime.png`
      : "docs/combat/regression/corner-runtime.png",
  });
});
