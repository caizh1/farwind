import { test, expect } from "@playwright/test";
test("village-visual", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  await expect(page.locator("#hud")).toBeVisible();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "docs/screenshots/village-first.png" });
  expect(errors).toEqual([]);
});
