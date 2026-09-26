import { test, expect } from "@playwright/test";

test.use({ video: "on" });

test("四方向实机动作逐帧推进，三段收招与再次进攻", async ({ page }) => {
  await page.goto("/?animationDebug=1");
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  await page.evaluate(() => {
    (window as any).__actionFrames = [];
    (window as any).__actionTimer = setInterval(() => {
      const state = (window as any).__farwind?.();
      if (state?.session?.combat?.stage)
        (window as any).__actionFrames.push({
          facing: state.session.combat.facing,
          stage: state.session.combat.stage,
          frame: state.animation.hero.frameIndex,
          phase: state.animation.hero.phase,
          texture: state.animation.hero.texture,
          anchor: state.animation.hero.anchor,
        });
    }, 8);
  });
  for (const [key, facing] of [
    ["s", 0],
    ["w", 1],
    ["a", 2],
    ["d", 3],
  ] as const) {
    await page.keyboard.down(key);
    await page.waitForTimeout(90);
    await page.keyboard.up(key);
    await page.waitForTimeout(230);
    await page.keyboard.press("j");
    await expect
      .poll(async () =>
        page.evaluate(() => (window as any).__farwind().session.combat.stage),
      )
      .toBe(1);
    await page.waitForFunction(
      () => (window as any).__farwind().animation.hero.phase === "active",
      undefined,
      { polling: 16 },
    );
    await page.screenshot({
      path: `docs/combat-action/evidence/single-${key}.png`,
    });
    await expect
      .poll(async () =>
        page.evaluate(() => (window as any).__farwind().session.combat.stage),
      )
      .toBe(0);
    const frames = await page.evaluate(() => (window as any).__actionFrames);
    const selected = frames.filter(
      (f: any) => f.facing === facing && f.stage === 1,
    );
    expect(new Set(selected.map((f: any) => f.frame))).toEqual(
      new Set([0, 1, 2, 3, 4, 5]),
    );
    expect(
      selected.every(
        (f: any) =>
          f.texture ===
            (facing >= 2
              ? "hero-combat-side"
              : facing === 1
                ? "hero-combat-back"
                : "hero-combat-action") &&
          f.anchor[0] === 80 &&
          f.anchor[1] === 154,
      ),
    ).toBe(true);
  }
  await page.waitForTimeout(230);
  await page.keyboard.press("j");
  await expect
    .poll(async () =>
      page.evaluate(() => (window as any).__farwind().session.combat.stage),
    )
    .toBe(1);
  for (const stage of [2, 3]) {
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const s = (window as any).__farwind();
          return s.session.attackUntil - s.session.sim;
        }),
      )
      .toBeLessThan(90);
    await page.keyboard.press("j");
    await expect
      .poll(async () =>
        page.evaluate(() => (window as any).__farwind().session.combat.stage),
      )
      .toBe(stage);
  }
  await expect
    .poll(async () =>
      page.evaluate(() => (window as any).__farwind().session.combat.stage),
    )
    .toBe(0);
  await page.keyboard.press("j");
  await expect
    .poll(async () =>
      page.evaluate(() => (window as any).__farwind().session.combat.stage),
    )
    .toBe(1);
  const beforeStep = await page.evaluate(
    () => (window as any).__farwind().state.player.x,
  );
  await page.keyboard.down("d");
  await page.waitForTimeout(90);
  await page.keyboard.up("d");
  const afterStep = await page.evaluate(
    () => (window as any).__farwind().state.player.x,
  );
  expect(afterStep).toBeGreaterThan(beforeStep);
  expect(afterStep - beforeStep).toBeLessThan(25);
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const s = (window as any).__farwind();
          return s.session.combat.stage === 1
            ? s.session.attackUntil - s.session.sim
            : 999;
        }),
      { intervals: [16, 16, 16, 16, 16] },
    )
    .toBeLessThan(80);
  await page.keyboard.press("Space");
  await expect
    .poll(async () =>
      page.evaluate(
        () => (window as any).__farwind().session.combat.dashRemaining,
      ),
    )
    .toBeGreaterThan(0);
  expect(
    await page.evaluate(() => (window as any).__farwind().session.combat.stage),
  ).toBe(0);
  await page.evaluate(() => clearInterval((window as any).__actionTimer));
});
