import { test, expect } from "@playwright/test";
import { initialState } from "../src/game/systems/state";
const read = (p: any) => p.evaluate(() => (window as any).__farwind());
test("隔离满包夹具：正常击杀、整理后领取、存档往返不重复", async ({ page }) => {
  const fixture = initialState();
  fixture.player.x = 2260;
  fixture.player.y = 1070;
  fixture.quest = 3;
  fixture.killed = ["slime-1", "slime-2"];
  fixture.bag = Array.from({ length: 24 }, (_, i) => ({
    id: "stone" as const,
    count: i ? 20 : 1,
  }));
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入存档" }).click();
  await (
    await chooser
  ).setFiles({
    name: "full-bag-fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await expect
    .poll(async () => (await read(page)).state.player.x)
    .toBeGreaterThan(2200);
  for (let i = 0; i < 16; i++) {
    const s = await read(page);
    if (s.state.killed.includes("leaf-1")) break;
    const leaf = s.enemies.find((e: any) => e.id === "leaf-1");
    const dx = leaf.x - s.state.player.x,
      dy = leaf.y - s.state.player.y;
    const key =
      Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "d" : "a") : dy > 0 ? "s" : "w";
    const facing = key === "d" ? 3 : key === "a" ? 2 : key === "w" ? 1 : 0;
    await page.keyboard.down(key);
    await expect
      .poll(async () => (await read(page)).animation.hero.direction)
      .toBe(facing);
    await page.keyboard.up(key);
    await page.keyboard.press("j");
    await page.waitForTimeout(410);
  }
  await expect
    .poll(async () => (await read(page)).state.killed)
    .toContain("leaf-1");
  const dead = await read(page);
  expect(dead.state.pendingDrops.map((d: any) => d.enemyId)).toContain(
    "leaf-1",
  );
  expect(dead.enemies.find((e: any) => e.id === "leaf-1").hp).toBe(0);
  await page.keyboard.press("Tab");
  await page.locator('[data-slot="0"]').click();
  await page.getByRole("button", { name: "丢弃一件" }).click();
  await page.getByRole("button", { name: "收好行囊" }).click();
  await page.keyboard.press("e");
  await expect
    .poll(async () => (await read(page)).state.pendingDrops.length)
    .toBe(0);
  await expect
    .poll(async () =>
      (await read(page)).state.bag.some((a: any) => a?.id === "crystal"),
    )
    .toBe(true);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "保存并返回标题" }).click();
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  const after = await read(page);
  expect(after.state.killed).toContain("leaf-1");
  expect(after.state.pendingDrops).toHaveLength(0);
  expect(
    after.state.bag
      .filter((a: any) => a?.id === "crystal")
      .reduce((n: number, a: any) => n + a.count, 0),
  ).toBe(1);
});
