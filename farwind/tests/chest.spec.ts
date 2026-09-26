import { test, expect, type Page } from "@playwright/test";
import { move } from "./map-navigation";

const read = (page: Page) => page.evaluate(() => (window as any).__farwind());
const cases = [
  { id: "village-chest", item: "potion", name: "恢复药剂", x: 580, y: 1510 },
  { id: "hidden-chest", item: "charm", name: "旅风护符", x: 2600, y: 1600 },
];

for (const chest of cases) {
  test(chest.id, async ({ page }, testInfo) => {
    await page.goto("/");
    await page.getByRole("button", { name: "启程 · 新游戏" }).click();
    await move(page, chest.x, chest.y);
    await expect.poll(async () => (await read(page)).target).toBe(chest.id);
    await page.keyboard.press("e");
    await expect
      .poll(async () => (await read(page)).state.chests)
      .toContain(chest.id);
    // 暂停后等待自动保存完成，捕获保存提示覆盖奖励的回归。
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    await expect(page.locator("#toast.show")).toContainText(`${chest.name} ×1`);
    await page.getByRole("button", { name: "继续旅途", exact: true }).click();
    await page.screenshot({
      path: testInfo.outputPath(`${chest.id}-reward.png`),
    });
    await page.keyboard.press("Tab");
    await expect(page.locator(".slot")).toContainText([`${chest.name}×1`]);
    await page.reload();
    await page.getByRole("button", { name: "继续旅途", exact: true }).click();
    const before = (await read(page)).state;
    expect(before.chests).toContain(chest.id);
    expect(before.bag.filter((slot: any) => slot?.id === chest.item)).toEqual([
      { id: chest.item, count: 1 },
    ]);
    await page.keyboard.press("e");
    expect((await read(page)).state.bag).toEqual(before.bag);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "保存旅途", exact: true }).click();
    await expect(page.locator("#toast.show")).toHaveText("旅途已保存");
    await page
      .getByRole("button", { name: "保存并返回标题", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "远风之地", exact: true }),
    ).toBeVisible();
    await expect(page.locator("#toast.show")).toHaveText("旅途已保存");
  });
}
