import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
test("WIND-PRODUCTION-01", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .getByRole("button", { name: "启程 · 新游戏", exact: true })
    .click();
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  await expect(page.locator("#sword-wind-status")).toBeHidden();
  await page.keyboard.press("d");
  await page.waitForTimeout(60);
  const before = await page.evaluate(() => (window as any).__farwind());
  expect(before.state.skills.swordWindStage).toBe(0);
  expect(before).not.toHaveProperty("swordWind");
  await page.keyboard.press("j");
  await page.waitForTimeout(240);
  await page.keyboard.press("j");
  await page.waitForTimeout(290);
  await page.keyboard.press("j");
  await page.waitForTimeout(370);
  await expect(page.locator("#parry-status")).not.toContainText("第四");
  await page.keyboard.press("j");
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => (window as any).__farwind());
  expect(after.attackSerial - before.attackSerial).toBe(4);
  expect(after.state.player.x - before.state.player.x).toBeCloseTo(63, 0);
  expect(after.state.skills.swordWindStage).toBe(0);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: "docs/sword-wind/evidence/production-three-chain.png",
  });
  await writeFile(
    "docs/sword-wind/evidence/production.json",
    JSON.stringify(
      {
        说明: "普通生产构建，无开发授予；正常键盘四次请求回到首刀。三刀加首刀踏步合计六十三像素",
        起始: before,
        结束: after,
        页面错误: errors,
      },
      null,
      2,
    ),
  );
});
