import { test, expect } from "@playwright/test";
import {
  setup,
  face,
  third,
  fourth,
  read,
  finish,
  dir,
} from "./sword-wind-fixtures";
test("WIND-12 上撩、逐段地面切痕、首目标停止、暂停与消隐", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await setup(page, 0, 0, true);
  await face(page, "d", 3);
  await third(page);
  await fourth(page);
  await page.waitForFunction(() => {
    const s = (window as any).__farwind();
    return (
      s.animation.hero.key.includes("sword-wind") &&
      s.animation.hero.frameIndex === 4 &&
      s.animation.hero.provisional === false
    );
  });
  // 快速动作由原速录像留证，截图调用可能跨过短飞行窗口。
  await page.waitForFunction(() => {
    const s = (window as any).__farwind();
    return (
      s.swordWind.ground.length >= 4 &&
      s.swordWind.entities.some((w: any) => !w.terminated)
    );
  });
  const flying = await read(page);
  expect(flying.swordWind.ground.length).toBeGreaterThanOrEqual(4);
  await expect
    .poll(async () => (await read(page)).swordWind.events[0]?.reason)
    .toBe("target");
  const s = await read(page),
    event = s.swordWind.events[0];
  expect(event.target).toBe("wind-arena-A");
  expect(s.enemies.find((e: any) => e.id === "wind-arena-A").hp).toBe(12);
  expect(s.enemies.find((e: any) => e.id === "wind-arena-B").hp).toBe(48);
  const w = s.swordWind.entities[0];
  expect(w).toBeTruthy();
  expect(s.swordWind.ground.length).toBeGreaterThan(4);
  for (const g of s.swordWind.ground) {
    expect(g.x - 18 + (g.crop / 128) * 36).toBeLessThanOrEqual(
      w.position.x + 1e-7,
    );
    expect(g.depth).toBe(-1);
  }

  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "在风中歇一会儿" }),
  ).toBeVisible();
  const frozen = (await read(page)).swordWind.ground;
  await page.waitForTimeout(400);
  expect((await read(page)).swordWind.ground).toEqual(frozen);
  await page.keyboard.press("Escape");
  await expect
    .poll(async () => (await read(page)).swordWind.ground.length)
    .toBe(0);
  expect((await read(page)).swordWind.events).toHaveLength(1);
  await third(page);
  await fourth(page);
  await page.waitForFunction(
    () => (window as any).__farwind().swordWind.ground.length > 0,
  );
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "保存并返回标题", exact: true })
    .click();
  await expect
    .poll(async () => (await read(page)).swordWind.ground.length)
    .toBe(0);
  expect(errors).toEqual([]);
  await finish(page, process.env.FARWIND_WIND_RUN === "acceptance" ? "acceptance-rise-ground" : "rise-ground");
});
