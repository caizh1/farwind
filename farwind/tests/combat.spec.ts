import { test, expect, type Page } from "@playwright/test";
import { initialState } from "../src/game/systems/state";
test.use({ video: "on" });
const read = (p: Page) => p.evaluate(() => (window as any).__farwind());
async function finishWindow(page: Page) {
  await expect
    .poll(
      async () => {
        const s = await read(page);
        return s.session.attackUntil - s.session.sim;
      },
      { intervals: [16, 16, 16, 16, 16], timeout: 3000 },
    )
    .toBeLessThan(95);
}
test("真实键鼠：三连、断连、风步、暂停和续玩", async ({ page }) => {
  await page.goto("/?animationDebug=1");
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  await expect(page.locator("#combat-status")).toHaveText("L 风步 · 就绪");
  const beforeSpace = (await read(page)).state.player;
  await page.keyboard.press("Space");
  await page.waitForTimeout(180);
  const afterSpace = await read(page);
  expect(afterSpace.session.combat.dashCooldownRemaining).toBe(0);
  expect(afterSpace.state.player.x).toBe(beforeSpace.x);
  expect(afterSpace.state.player.y).toBe(beforeSpace.y);
  await page.keyboard.press("j");
  await expect
    .poll(async () => (await read(page)).session.combat.stage, {
      intervals: [16, 16, 16],
    })
    .toBe(1);
  await finishWindow(page);
  await page.keyboard.press("j");
  await expect
    .poll(async () => (await read(page)).session.combat.stage)
    .toBe(2);
  await expect
    .poll(async () => (await read(page)).session.combat.phase, {
      intervals: [16, 16, 16],
    })
    .toBe("active");
  await page.screenshot({ path: "docs/combat/regression/combo-stage-two.png" });
  await finishWindow(page);
  await page.keyboard.press("j");
  await expect
    .poll(async () => (await read(page)).session.combat.stage)
    .toBe(3);
  await expect
    .poll(async () => (await read(page)).session.combat.phase, {
      intervals: [16, 16, 16],
    })
    .toBe("active");
  await page.screenshot({
    path: "docs/combat/regression/combo-stage-three.png",
  });
  expect((await read(page)).attackSerial).toBe(3);
  await expect
    .poll(async () => (await read(page)).session.combat.stage)
    .toBe(0);
  await page.keyboard.press("j");
  await expect
    .poll(async () => (await read(page)).session.combat.stage)
    .toBe(1);
  await expect
    .poll(async () => (await read(page)).session.combat.stage)
    .toBe(0);
  const before = await read(page);
  await page.keyboard.down("d");
  await expect
    .poll(async () => (await read(page)).animation.hero.direction)
    .toBe(3);
  await page.keyboard.press("l");
  await expect
    .poll(async () => (await read(page)).session.combat.dashRemaining)
    .toBeGreaterThan(0);
  await page.keyboard.up("d");
  await expect
    .poll(async () => (await read(page)).session.combat.dashCooldownRemaining)
    .toBeGreaterThan(0);
  await expect
    .poll(async () => (await read(page)).state.player.x)
    .toBeGreaterThan(before.state.player.x);
  const dashed = await read(page);
  expect(dashed.state.player.stamina).toBeLessThan(
    before.state.player.stamina - 15,
  );
  expect(dashed.state.player.x).toBeGreaterThan(before.state.player.x);
  await page.keyboard.press("Escape");
  const paused = await read(page);
  await page.keyboard.press("j");
  await page.keyboard.press("l");
  await page.waitForTimeout(300);
  expect((await read(page)).session.sim).toBe(paused.session.sim);
  await page.keyboard.press("Escape");
  await expect
    .poll(async () => (await read(page)).session.combat.stage)
    .toBe(0);
  await expect
    .poll(async () => (await read(page)).session.combat.dashCooldownRemaining)
    .toBeLessThan(430);
  await page.mouse.click(650, 360);
  await expect.poll(async () => (await read(page)).attackSerial).toBe(5);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "保存并返回标题" }).click();
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  expect((await read(page)).session.combat.stage).toBe(0);
  expect((await read(page)).session.combat.buffered).toBe(false);
  const serial = (await read(page)).attackSerial;
  await page.keyboard.down("j");
  await page.waitForTimeout(1200);
  await page.keyboard.up("j");
  expect((await read(page)).attackSerial).toBe(serial + 1);
  const holdStart = (await read(page)).state.player;
  await page.keyboard.down("l");
  await page.waitForTimeout(1200);
  await page.keyboard.up("l");
  const holdEnd = (await read(page)).state.player;
  expect(
    Math.hypot(holdEnd.x - holdStart.x, holdEnd.y - holdStart.y),
  ).toBeGreaterThan(50);
  expect(
    Math.hypot(holdEnd.x - holdStart.x, holdEnd.y - holdStart.y),
  ).toBeLessThan(120);
});
test("隔离森林战斗夹具：三连命中、风步拉开、再进攻", async ({ page }) => {
  const fixture = initialState();
  delete fixture.map_version;
  fixture.player.x = 2230;
  fixture.player.y = 1070;
  fixture.quest = 3;
  fixture.killed = ["slime-1", "slime-2"];
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入存档" }).click();
  await (
    await chooser
  ).setFiles({
    name: "forest-combat-fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await expect
    .poll(async () => (await read(page)).state.player.x)
    .toBeGreaterThan(2200);
  await page.keyboard.down("d");
  // 逐呈现帧确认朝向，避免轮询延迟导致持续前进并提前触发敌人前摇。
  await page.waitForFunction(
    () => (window as any).__farwind().animation.hero.direction === 3,
  );
  await page.keyboard.up("d");
  await page.evaluate(() => {
    (window as any).__stops = [];
    // 按呈现帧采样：独立8ms定时器可能总落在停顿扣减后的相位，漏掉起始帧。
    const sample = () => {
      const s = (window as any).__farwind();
      (window as any).__stops.push({
        sim: s.session.sim,
        stop: s.session.combat.hitStopRemaining,
        player: [s.state.player.x, s.state.player.y],
        enemies: s.enemies.map((e: any) => [e.x, e.y, e.hp]),
      });
      (window as any).__stopTimer = requestAnimationFrame(sample);
    };
    (window as any).__stopTimer = requestAnimationFrame(sample);
  });
  for (let stage = 1; stage <= 3; stage++) {
    await page.keyboard.press("j");
    await page.waitForFunction(
      (stage) => (window as any).__farwind().session.combat.stage === stage,
      stage,
    );
    if (stage < 3) await page.waitForTimeout(60);
  }
  await expect
    .poll(
      async () =>
        (await read(page)).enemies.find((e: any) => e.id === "leaf-1").hp,
    )
    .toBeLessThanOrEqual(4);
  await expect
    .poll(async () => (await read(page)).session.combat.stage)
    .toBe(0);
  const stops = await page.evaluate(() => {
    cancelAnimationFrame((window as any).__stopTimer);
    return (window as any).__stops;
  });
  expect(stops.some((s: any) => s.stop >= 45)).toBe(true);
  expect(
    stops.some(
      (s: any, i: number) =>
        i > 0 &&
        s.stop > 0 &&
        stops[i - 1].stop > 0 &&
        s.sim === stops[i - 1].sim &&
        JSON.stringify([s.player, s.enemies]) ===
          JSON.stringify([stops[i - 1].player, stops[i - 1].enemies]),
    ),
  ).toBe(true);
  const beforeDash = (await read(page)).state.player.x;
  await page.keyboard.down("a");
  await page.keyboard.press("l");
  await expect
    .poll(async () => (await read(page)).session.combat.dashRemaining)
    .toBeGreaterThan(0);
  await page.keyboard.up("a");
  await expect
    .poll(async () => (await read(page)).state.player.x)
    .toBeLessThan(beforeDash - 15);
  for (let i = 0; i < 20; i++) {
    const s = await read(page),
      leaf = s.enemies.find((e: any) => e.id === "leaf-1");
    if (leaf.hp <= 0) break;
    const dx = leaf.x - s.state.player.x,
      dy = leaf.y - s.state.player.y;
    const distance = Math.hypot(dx, dy);
    const key =
      Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "d" : "a") : dy > 0 ? "s" : "w";
    if (distance < 25) {
      const away =
        key === "d" ? "a" : key === "a" ? "d" : key === "s" ? "w" : "s";
      await page.keyboard.down("Space");
      await page.keyboard.down(away);
      await page.waitForTimeout(250);
      await page.keyboard.up(away);
      await page.keyboard.up("Space");
    } else if (distance > 85) {
      await page.keyboard.down(key);
      await page.waitForTimeout(100);
      await page.keyboard.up(key);
    } else {
      await page.keyboard.down(key);
      await page.keyboard.press("j");
      await page.keyboard.up(key);
      await page.waitForTimeout(390);
    }
  }
  await expect
    .poll(async () => (await read(page)).state.killed)
    .toContain("leaf-1");
  expect((await read(page)).state.quest).toBe(4);
});
