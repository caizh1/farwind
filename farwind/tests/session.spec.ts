import { test, expect, type Page } from "@playwright/test";
const read = (p: Page) => p.evaluate(() => (window as any).__farwind());
async function hold(p: Page, key: string, ms: number) {
  await p.keyboard.down(key);
  await p.waitForTimeout(ms);
  const s = await read(p);
  await p.keyboard.up(key);
  return s;
}
async function title(p: Page) {
  await p.keyboard.press("Escape");
  await p.getByRole("button", { name: "保存并返回标题" }).click();
  await expect(p.getByRole("button", { name: "启程 · 新游戏" })).toBeVisible();
}
async function moving(p: Page) {
  await expect(p.locator("#modal")).toBeHidden();
  await p.keyboard.down("d");
  await expect
    .poll(async () => (await read(p)).animation.hero.action)
    .toBe("walk");
  await p.keyboard.up("d");
  await expect
    .poll(async () => (await read(p)).animation.hero.action)
    .toBe("idle");
}
test("session-sprint-recovery", async ({ page }) => {
  await page.goto("/?animationDebug=1");
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  await expect
    .poll(async () => (await read(page)).session.sim)
    .toBeGreaterThan(200);
  const transitions: any[] = [];
  let last = "run",
    lastChange = 0;
  await page.keyboard.down("Shift");
  for (let n = 0; n < 32; n++) {
    const key = n % 2 ? "d" : "a";
    await page.keyboard.down(key);
    await expect
      .poll(async () => (await read(page)).animation.hero.speed, {
        intervals: [16, 32, 50],
      })
      .toBeGreaterThan(100);
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(50);
      const s = await read(page),
        a = s.animation.hero.action;
      expect(["walk", "run"]).toContain(a);
      if (a !== last) {
        if (lastChange) expect(s.session.sim - lastChange).toBeGreaterThan(800);
        transitions.push({
          sim: s.session.sim,
          体力: s.state.player.stamina,
          动作: a,
        });
        lastChange = s.session.sim;
        last = a;
      }
      if (
        s.session.exhausted &&
        s.state.player.stamina > 3 &&
        s.state.player.stamina < 15
      ) {
        await page.keyboard.up("Shift");
        await page.keyboard.down("Shift");
        expect(s.animation.hero.action).toBe("walk");
      }
    }
    await page.keyboard.up(key);
  }
  await page.keyboard.up("Shift");
  expect(transitions.length).toBeGreaterThan(4);
  expect(transitions.length).toBeLessThan(18);
  await page.keyboard.press("Escape");
  await expect(page.getByText("世界与时间已暂停。")).toBeVisible();
  const paused = await read(page);
  await hold(page, "d", 400);
  expect((await read(page)).session).toEqual(paused.session);
  await page.keyboard.press("Escape");
  await moving(page);
});
test("session-title-continue-new-refresh", async ({ page }) => {
  await page.goto("/?animationDebug=1");
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  await page.waitForTimeout(3000);
  await page.keyboard.press("j");
  await expect
    .poll(async () => (await read(page)).animation.hero.action, {
      intervals: [16, 32, 50],
    })
    .toBe("attack");
  await page.waitForTimeout(350);
  expect((await read(page)).animation.hero.action).toBe("idle");
  const saved = (await read(page)).state;
  await title(page);
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  await page.waitForTimeout(100);
  expect((await read(page)).session.attackUntil).toBe(0);
  expect((await read(page)).state.bag).toEqual(saved.bag);
  await moving(page);
  // 真实移动到广场药草，不设置任何游戏状态。
  for (const [axis, target] of [
    ["x", 790],
    ["y", 790],
  ] as const) {
    for (let i = 0; i < 30; i++) {
      const p = (await read(page)).state.player,
        d = target - p[axis];
      if (Math.abs(d) < 5) break;
      await hold(
        page,
        axis === "x" ? (d > 0 ? "d" : "a") : d > 0 ? "s" : "w",
        Math.min(200, (Math.abs(d) / 150) * 1000),
      );
    }
  }
  await expect.poll(async () => (await read(page)).target).toBe("herb-v1");
  await page.keyboard.press("e");
  await expect
    .poll(async () => (await read(page)).state.collected["herb-v1"])
    .toBeDefined();
  await page.waitForTimeout(400);
  expect((await read(page)).animation.hero.action).toBe("idle");
  await title(page);
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  await page.getByRole("button", { name: "确认新游戏" }).click();
  await page.waitForTimeout(100);
  expect((await read(page)).session.attackUntil).toBe(0);
  await moving(page);
  await title(page);
  await page.reload();
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  await moving(page);
  await page.keyboard.press("j");
  await expect
    .poll(async () => (await read(page)).animation.hero.action, {
      intervals: [16, 32, 50],
    })
    .toBe("attack");
  await page.waitForTimeout(350);
  expect((await read(page)).animation.hero.action).toBe("idle");
  await page.keyboard.press("Tab");
  await expect(page.getByText("旅人的行囊", { exact: true })).toBeVisible();
  await page.keyboard.press("Tab");
});
