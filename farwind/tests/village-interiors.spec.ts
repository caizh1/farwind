import { test, expect, type Page } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { initialStock } from "../src/data/economy";
const root = "docs/village-interiors/after";
const records: unknown[] = [];
async function read(p: Page) {
  return p.evaluate(() => (window as any).__farwind());
}
const amount = (s: any, id: string) =>
  s.bag
    .filter(Boolean)
    .filter((a: any) => a.id === id)
    .reduce((n: number, a: any) => n + a.count, 0);
async function setup(
  page: Page,
  space: string,
  options: { night?: boolean; stockDay?: number; emptySoup?: boolean } = {},
) {
  const s = JSON.parse(
    await readFile("docs/village-houses/before/record.json", "utf8"),
  ).状态.state;
  s.life.playerSpace = space;
  s.life.outside = { x: 1550, y: 1675 };
  Object.assign(s.player, { x: 830, y: 835, hp: 40, stamina: 20 });
  if (space === "village") {
    s.player.x = 900;
    s.player.y = 1045;
  }
  if (options.night) s.time = 1200;
  if (options.stockDay !== undefined) {
    s.shopStockDay = options.stockDay;
    s.time = 1500;
    s.shopStock = { ...initialStock(), ...s.shopStock };
    if (options.emptySoup) s.shopStock["inn:soup"] = 0;
  }
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入存档", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "shop-sample.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(s)),
  });
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  await page.keyboard.press("e");
  await page.locator(".shop-panel").waitFor();
  if (space === "inn") await page.locator('[data-flow="buy"]').click();
}
async function buy(page: Page, item: string, quantity = "1") {
  await page.locator(`[data-item="${item}"]`).click();
  await page.getByLabel("数量", { exact: true }).fill(quantity);
  await page.locator("#shop-review").click();
  await page.locator("#shop-confirm").click();
  await expect(page.locator("#shop-feedback")).toContainText("已完成并保存");
}
async function reload(page: Page) {
  await page.reload();
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
}
test.afterAll(async () => {
  await mkdir(root, { recursive: true });
  await writeFile(
    `${root}/lifecycle-record.json`,
    JSON.stringify(
      {
        说明: "当前生产构建的正式导入、真实点击购买及使用、保存重载验收；导入仅建立合法初始条件，不改写运行状态。",
        样本: records,
      },
      null,
      2,
    ),
  );
});
for (const [space, item, hp, stamina] of [
  ["healer-home", "tea", 0, 35],
  ["inn", "soup", 20, 50],
] as const)
  test(`${item}购买、行囊使用和重载`, async ({ page }) => {
    await setup(page, space);
    await buy(page, item);
    const bought = (await read(page)).state;
    expect(amount(bought, item)).toBe(1);
    await page.locator("#close").click();
    await page.keyboard.press("Tab");
    await page
      .locator(`[data-slot]`)
      .filter({ hasText: item === "tea" ? "清叶茶" : "热蔬汤" })
      .click();
    const before = (await read(page)).state;
    await page.locator("#consume").click();
    await expect(page.locator(".bag")).not.toContainText(
      item === "tea" ? "清叶茶" : "热蔬汤",
    );
    const used = (await read(page)).state;
    expect(amount(used, item)).toBe(0);
    expect(used.player.hp).toBe(Math.min(100, before.player.hp + hp));
    expect(used.player.stamina).toBe(
      Math.min(100, before.player.stamina + stamina),
    );
    await page.screenshot({ path: `${root}/${item}-used.png` });
    await reload(page);
    const restored = (await read(page)).state;
    expect(restored.coins).toBe(bought.coins);
    expect(amount(restored, item)).toBe(0);
    expect(restored.player.hp).toBe(used.player.hp);
    records.push({
      场景: `${item}购买使用重载`,
      购买后金币: bought.coins,
      使用前: { 生命: before.player.hp, 体力: before.player.stamina },
      使用后: { 生命: used.player.hp, 体力: used.player.stamina },
      重载数量: amount(restored, item),
    });
  });
test("铁剑和皮甲购买后实际穿戴并保存", async ({ page }) => {
  await setup(page, "smith-shop");
  await buy(page, "ironSword");
  await buy(page, "leatherCoat");
  expect((await read(page)).state.coins).toBe(15);
  await page.locator("#close").click();
  await page.keyboard.press("Tab");
  for (const [item, name] of [
    ["ironSword", "风杉铁剑"],
    ["leatherCoat", "旅人皮甲"],
  ]) {
    await page.locator("[data-slot]").filter({ hasText: name }).click();
    await page.locator("#equip").click();
    await page.waitForFunction((item) => {
      const s = (window as any).__farwind().state;
      return Object.values(s.equipment).includes(item);
    }, item);
  }
  const s = (await read(page)).state;
  expect(s.equipment).toEqual({ weapon: "ironSword", armor: "leatherCoat" });
  await page.screenshot({ path: `${root}/equipment-purchased.png` });
  await reload(page);
  expect((await read(page)).state.equipment).toEqual(s.equipment);
  records.push({ 场景: "装备购买穿戴重载", 金币: s.coins, 装备: s.equipment });
});
test("数量报价、买卖材料与无效数量门禁", async ({ page }) => {
  await setup(page, "general-shop");
  await page.getByLabel("数量", { exact: true }).fill("3");
  await expect(page.locator("#shop-total")).toContainText("111 金币");
  await page.locator("#shop-review").click();
  await page.locator("#shop-confirm").click();
  await expect(page.locator("#shop-feedback")).toContainText("已完成");
  await page.locator('[data-flow="sell"]').click();
  await page.getByLabel("数量", { exact: true }).fill("2");
  await expect(page.locator("#shop-total")).toContainText("115 金币");
  await page.locator("#shop-review").click();
  await page.locator("#shop-confirm").click();
  await expect(page.locator("#shop-feedback")).toContainText("已完成");
  const s = (await read(page)).state;
  expect(s.coins).toBe(115);
  expect(amount(s, "wood")).toBe(1);
  expect(s.shopStock["general:wood"]).toBe(19);
  await page.getByLabel("数量", { exact: true }).fill("0");
  await expect(page.locator("#shop-review")).toBeDisabled();
  expect((await read(page)).state.coins).toBe(115);
  await page.screenshot({ path: `${root}/invalid-quantity.png` });
  records.push({
    场景: "材料买卖和无效数量",
    金币: s.coins,
    木材: amount(s, "wood"),
    库存: s.shopStock["general:wood"],
  });
});
test("木工坊材料购买和最大可买数量", async ({ page }) => {
  await setup(page, "wood-workshop");
  await page.locator("#shop-max").click();
  await expect(page.getByLabel("数量", { exact: true })).toHaveValue("24");
  await page.locator("#shop-review").click();
  await page.locator("#shop-confirm").click();
  await expect(page.locator("#shop-feedback")).toContainText("已完成");
  const s = (await read(page)).state;
  expect(s.coins).toBe(48);
  expect(amount(s, "wood")).toBe(24);
  expect(s.shopStock["carpenter:wood"]).toBe(0);
  await expect(page.locator("#shop-review")).toBeDisabled();
  records.push({
    场景: "木工坊最大购买",
    金币: s.coins,
    木材: amount(s, "wood"),
    库存: s.shopStock["carpenter:wood"],
  });
});
test("跨日补货只保存一次，同日重载不返还售出商品", async ({ page }) => {
  await setup(page, "inn", { stockDay: 0, emptySoup: true });
  await expect(page.locator('[data-item="soup"]')).toContainText("库存 8");
  await buy(page, "soup");
  const s = (await read(page)).state;
  expect(s.shopStockDay).toBe(1);
  expect(s.shopStock["inn:soup"]).toBe(7);
  await reload(page);
  await page.keyboard.press("e");
  await page.locator('[data-flow="buy"]').click();
  await expect(page.locator('[data-item="soup"]')).toContainText("库存 7");
  expect((await read(page)).state.economyRevision).toBe(s.economyRevision);
  records.push({
    场景: "隔日补货与同日重载",
    库存日期: s.shopStockDay,
    售出后库存: s.shopStock["inn:soup"],
    序号: s.economyRevision,
  });
});
test("旅馆室内柜台的真实住宿交易", async ({ page }) => {
  await setup(page, "inn", { night: true });
  await page.locator('[data-flow="sleep"]').click();
  await page.locator("#shop-review").click();
  await page.locator("#shop-confirm").click();
  await expect(page.locator("#shop-feedback")).toContainText("已完成");
  const s = (await read(page)).state;
  expect(s.coins).toBe(108);
  expect(s.time).toBe(1800);
  expect(s.player.hp).toBe(100);
  expect(s.player.stamina).toBe(100);
  expect(s.life.playerSpace).toBe("inn");
  await page.screenshot({ path: `${root}/inn-sleep.png` });
  await reload(page);
  const restored = (await read(page)).state;
  expect(restored.coins).toBe(108);
  expect(restored.time).toBeGreaterThanOrEqual(1800);
  records.push({
    场景: "室内住宿",
    金币: s.coins,
    时间: s.time,
    生命: s.player.hp,
    体力: s.player.stamina,
  });
});
test("杂货铺室内符文购买沿用原收藏与保存机制", async ({ page }) => {
  await setup(page, "general-shop");
  await page.locator('[data-flow="runes"]').click();
  await page.locator('[data-rune-buy="r08"]').click();
  await expect(page.locator("#shop-feedback")).toContainText(
    "符文已购入收藏并保存",
  );
  const s = (await read(page)).state;
  expect(s.coins).toBe(100);
  expect(s.runes.owned).toContain("r08");
  expect(s.bag.filter(Boolean)).toHaveLength(0);
  await expect(page.locator('[data-rune-buy="r08"]')).toBeDisabled();
  await page.screenshot({ path: `${root}/rune-purchased.png` });
  await reload(page);
  expect((await read(page)).state.runes.owned).toContain("r08");
  expect((await read(page)).state.coins).toBe(100);
  records.push({
    场景: "室内符文购买重载",
    金币: s.coins,
    收藏: s.runes.owned,
    行囊占用: s.bag.filter(Boolean).length,
  });
});

test("外部门牌保留购物快捷入口，并可从商店走入室内", async ({ page }) => {
  await setup(page, "village");
  expect((await read(page)).target).toBe("service-general");
  await page.locator('[data-flow="runes"]').click();
  await page.locator('[data-rune-buy="r08"]').click();
  await expect(page.locator("#shop-feedback")).toContainText(
    "符文已购入收藏并保存",
  );
  expect((await read(page)).state.coins).toBe(100);
  await page.locator("#shop-enter").click();
  await page.waitForFunction(
    () => (window as any).__farwind().state.life.playerSpace === "general-shop",
  );
  expect((await read(page)).mode).toBe("");
  records.push({
    场景: "外部符文购买与店内入口",
    金币: 100,
    实际进入: "general-shop",
  });
});
