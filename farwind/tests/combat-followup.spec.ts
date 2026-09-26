import { test, expect } from "@playwright/test";
test.use({ video: "on" });

test("最终显示：宽限内持剑，接招不插空手；缓退松键按有效面向风步", async ({
  page,
}) => {
  await page.goto("/?animationDebug=1");
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  await page.keyboard.down("d");
  await page.waitForTimeout(100);
  await page.keyboard.up("d");
  await page.keyboard.press("j");
  await page.waitForFunction(
    () => (window as any).__farwind().animation.hero.phase === "ready",
    undefined,
    { polling: 8 },
  );
  const ready = await page.evaluate(() => (window as any).__farwind());
  expect(ready.session.combat.stage).toBe(0);
  expect(ready.animation.hero.texture).toBe("hero-combat-action");
  await page.keyboard.press("j");
  await page.waitForFunction(
    () => (window as any).__farwind().session.combat.stage === 2,
    undefined,
    { polling: 8 },
  );
  expect(
    (await page.evaluate(() => (window as any).__farwind())).animation.hero
      .texture,
  ).toBe("hero-combat-action");
  await page.waitForTimeout(800);
  for (const [key, opposite, direction] of [
    ["d", "a", 3],
    ["a", "d", 2],
    ["w", "s", 1],
    ["s", "w", 0],
  ] as const) {
    await page.keyboard.down(key);
    await page.waitForTimeout(100);
    await page.keyboard.up(key);
    await page.keyboard.press("j");
    await page.waitForFunction(
      () => {
        const s = (window as any).__farwind();
        return (
          s.session.combat.stage === 1 &&
          s.session.attackUntil - s.session.sim < 130
        );
      },
      undefined,
      { polling: 8 },
    );
    await page.keyboard.down(opposite);
    await page.waitForTimeout(30);
    await page.keyboard.up(opposite);
    await page.keyboard.press("Space");
    await page.waitForFunction(
      () => (window as any).__farwind().session.combat.dashRemaining > 0,
      undefined,
      { polling: 8 },
    );
    expect(
      (await page.evaluate(() => (window as any).__farwind())).animation.hero
        .direction,
    ).toBe(direction);
    await page.waitForTimeout(750);
  }
  await page.screenshot({
    path: "docs/combat-followup/evidence/ready-dash.png",
  });
});
