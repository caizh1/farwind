import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { initialState, count, type State } from "../src/game/systems/state";

const evidence = "docs/shop-redesign";
const read = (page: Page): Promise<{ state: State }> =>
  page.evaluate(() => (window as any).__farwind());

async function open(page: Page, space: State["life"]["playerSpace"]) {
  const state = initialState();
  state.life.playerSpace = space;
  state.life.outside = { x: 1550, y: 1675 };
  Object.assign(state.player, { x: 830, y: 835 });
  if (space === "inn") Object.assign(state.player, { hp: 40, stamina: 20 });
  page.once("dialog", (dialog) => dialog.accept());
  await page.goto("/");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入存档", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "shop-layout-sample.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(state)),
  });
  // 柜台目标由世界更新生成；仅关闭标题页时，导入事务仍可能尚未释放输入。
  await page.waitForFunction((space) => {
    const game = (window as any).__farwind?.();
    return game?.mode === "" && game.target === `interior:${space}:counter`;
  }, space);
  // 等导入后的界面完成绘制，按实际短按输入，避免与关闭文件选择器同帧。
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await page.keyboard.press("e", { delay: 80 });
  await page.locator(".shop-panel").waitFor({ timeout: 10000 });
  await mkdir(evidence, { recursive: true });
}

async function confirm(page: Page, label = "购买") {
  await page.locator("#shop-review").click();
  await page.getByRole("button", { name: `确认${label}`, exact: true }).click();
  await expect(page.locator("#shop-feedback")).toContainText("已完成并保存");
}

test("书册中的装备购买、唯一持有门禁及刷新重载", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await open(page, "smith-shop");
  await page.locator('[data-item="windScope"]').click();
  await expect(page.locator(".shop-card")).toHaveCount(8);
  await expect(page.locator(".shop-wallet")).toContainText("120");
  await expect(page.locator("#shop-total")).toContainText("40 金币");
  await page.screenshot({ path: `${evidence}/shop-desktop.png` });
  await page.getByLabel("数量", { exact: true }).fill("2");
  await expect(page.locator("#shop-review")).toBeDisabled();
  await expect(page.locator("#shop-total p b").last()).toHaveText("— 金币");
  await page.getByLabel("数量", { exact: true }).fill("1");
  await confirm(page);
  const bought = (await read(page)).state;
  expect([
    bought.coins,
    count(bought, "windScope"),
    bought.shopStock["smith:windScope"],
  ]).toEqual([40, 1, 0]);
  await expect(page.locator("#shop-total p b").last()).toHaveText("— 金币");
  await page.screenshot({ path: `${evidence}/purchase-saved.png` });
  await page.reload();
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  await page.waitForFunction(() => {
    const game = (window as any).__farwind?.();
    return game?.mode === "" && game.target === "interior:smith-shop:counter";
  });
  await page.keyboard.press("e");
  await page.locator('[data-item="windScope"]').click();
  await expect(page.locator("#shop-review")).toBeDisabled();
  const restored = (await read(page)).state;
  expect([
    restored.coins,
    count(restored, "windScope"),
    restored.shopStock["smith:windScope"],
  ]).toEqual([40, 1, 0]);
  expect(errors).toEqual([]);
});

for (const [width, height] of [
  [1440, 900],
  [1075, 600],
  [560, 720],
  [390, 844],
  [320, 640],
]) {
  test(`六件商品滚动选品与数量操作不跳页：${width}×${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await open(page, "general-shop");
    await expect(page.locator(".shop-card")).toHaveCount(6);
    await page.locator('[data-item="bread"]').click();
    const before = await page
      .locator(".shop-goods")
      .evaluate((element) => element.scrollTop);
    expect(before).toBeGreaterThan(0);
    await page.getByRole("button", { name: "增加数量", exact: true }).click();
    const after = await page
      .locator(".shop-goods")
      .evaluate((element) => element.scrollTop);
    expect(Math.abs(after - before)).toBeLessThan(1);
    await expect(page.locator("#shop-total")).toContainText("106 金币");
    const panelScroll = await page
      .locator(".shop-panel")
      .evaluate((element) => element.scrollTop);
    await page.getByRole("button", { name: "增加数量", exact: true }).click();
    expect(
      await page
        .locator(".shop-panel")
        .evaluate((element) => element.scrollTop),
    ).toBe(panelScroll);
    await expect(page.locator("#shop-total")).toContainText("99 金币");
    expect(
      await page
        .locator(".shop-panel")
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width > 760) {
      const fits = await page
        .locator("#shop-review")
        .evaluate(
          (element) =>
            element.getBoundingClientRect().bottom <=
            element.closest(".shop-detail")!.getBoundingClientRect().bottom + 1,
        );
      expect(fits).toBe(true);
    }
    await page.screenshot({ path: `${evidence}/shop-catalogue-${width}.png` });
    await confirm(page);
    const bought = (await read(page)).state;
    expect([
      bought.coins,
      count(bought, "bread"),
      bought.shopStock["general:bread"],
    ]).toEqual([99, 3, 9]);
  });
}

test("购买材料后出售、分类切换与符文购买保留交易流程", async ({ page }) => {
  await open(page, "general-shop");
  await page.getByLabel("数量", { exact: true }).fill("3");
  await confirm(page);
  await page.locator('[data-flow="sell"]').click();
  await page.getByLabel("数量", { exact: true }).fill("2");
  await confirm(page, "出售");
  const sold = (await read(page)).state;
  expect([sold.coins, count(sold, "wood")]).toEqual([115, 1]);
  await page.locator('[data-flow="buy"]').click();
  await page.locator('[data-filter="补给"]').click();
  await expect(page.locator(".shop-card")).toHaveCount(3);
  await page.locator('[data-flow="runes"]').click();
  const claim = page.locator("[data-rune-buy]").first();
  const rune = await claim.getAttribute("data-rune-buy");
  await claim.click();
  await expect(page.locator("#shop-feedback")).toContainText(
    "符文已购入收藏并保存",
  );
  const claimed = (await read(page)).state;
  expect(claimed.runes.owned).toContain(rune);
  expect(claimed.bag).toEqual(sold.bag);
});

test("药剂兑换的材料门禁与旅馆休息服务仍可核对并提交", async ({ page }) => {
  await open(page, "healer-home");
  await page.locator('[data-flow="exchange"]').click();
  await page.locator("#shop-review").click();
  await page.locator("#shop-confirm").click();
  await expect(page.locator("#shop-feedback")).toContainText("需要药草");
  expect((await read(page)).state.coins).toBe(120);
  await page.reload();
  await open(page, "inn");
  await confirm(page, "休息");
  expect((await read(page)).state.coins).toBe(108);
});
