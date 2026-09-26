import { test, expect, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { initialState, type State } from "../src/game/systems/state";
import { items, type ItemId } from "../src/data/content";
import { move } from "./map-navigation";
const read = (page: Page) => page.evaluate(() => (window as any).__farwind());
async function start(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  await expect(page.locator("#modal")).toBeHidden();
}
async function importFixture(page: Page, state: State) {
  // 通过现有存档导入入口建立代表性样本，不直接修改游戏对象。
  await page.keyboard.press("Escape");
  page.once("dialog", (dialog) => dialog.accept());
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入存档", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "hud-fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(state)),
  });
  await expect(page.locator("#modal")).toBeHidden();
}

test("hud-folds", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  await expect(page.locator("#menu-hint")).toBeVisible();
  await expect(page.locator("#hotbar button")).toHaveCount(8);
  await expect(page.locator(".toolbar,.help")).toHaveCount(0);
  await expect(page.locator("#minimap-details")).toBeHidden();
  await expect(page.locator("#quest-details")).toBeHidden();
  const before = await read(page);
  await page.locator("#minimap-toggle").click();
  await expect(page.locator("#minimap-details")).toBeVisible();
  await expect(page.locator("#quest-details")).toBeHidden();
  await page.locator("#quest-toggle").click();
  await expect(page.locator("#quest-details")).toBeVisible();
  await expect
    .poll(async () => (await read(page)).state.time)
    .toBeGreaterThan(before.state.time + 0.1);
  await page.keyboard.down("d");
  await expect
    .poll(async () => (await read(page)).state.player.x)
    .toBeGreaterThan(before.state.player.x + 10);
  await page.keyboard.up("d");
  expect((await read(page)).mode).toBe("");
  await page.locator("#minimap-toggle").click();
  await expect(page.locator("#quest-details")).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(page.locator("#minimap-toggle")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(page.locator("#menu-hint")).toBeHidden({ timeout: 6000 });
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "保存并返回标题", exact: true })
    .click();
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  await expect(page.locator("#quest-toggle")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await page.reload();
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  await expect(page.locator("#quest-toggle")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page.locator("#minimap-toggle")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(page.locator("#menu-hint")).toBeHidden();
  for (let i = 0; i < 12; i++) {
    await page.locator("#quest-toggle").click();
    await page.locator("#minimap-toggle").click();
  }
  expect(errors).toEqual([]);
});

test("hud-navigation", async ({ page }) => {
  await start(page);
  await page.keyboard.press("Escape");
  await expect(page.locator(".pause-panel")).toBeVisible();
  const paused = await read(page);
  await page.keyboard.press("Tab");
  await expect(page.locator("#pause-bag")).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { name: "旅人的行囊" })).toBeVisible();
  await page.keyboard.press("Tab");
  expect((await read(page)).mode).toBe("bag");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("j");
  await page.keyboard.press("1");
  expect((await read(page)).attackSerial).toBe(paused.attackSerial);
  expect((await read(page)).state).toEqual(paused.state);
  await page.keyboard.press("Escape");
  await expect(page.locator(".pause-panel")).toBeVisible();
  await expect(page.locator("#pause-bag")).toBeFocused();
  expect((await read(page)).mode).toBe("pause");
  for (const id of ["map", "quest", "help"]) {
    await page.locator(`#pause-${id}`).click();
    expect((await read(page)).mode).toBe(id);
    await page.keyboard.press("Escape");
    expect((await read(page)).mode).toBe("pause");
    await expect(page.locator(`#pause-${id}`)).toBeFocused();
  }
  await page.locator("#settings").click();
  const v = Number(await page.locator("#volume").inputValue());
  await page.locator("#volume").focus();
  await page.keyboard.press("ArrowLeft");
  expect(Number(await page.locator("#volume").inputValue())).toBe(v - 1);
  await page.keyboard.press("Escape");
  expect((await read(page)).mode).toBe("pause");
  await page.keyboard.press("Escape");
  await expect(page.locator("#modal")).toBeHidden();
  for (const [key, mode] of [
    ["Tab", "bag"],
    ["m", "map"],
    ["q", "quest"],
  ]) {
    await page.keyboard.press(key);
    await expect.poll(async () => (await read(page)).mode).toBe(mode);
    await page.keyboard.press("Escape");
    expect((await read(page)).mode).toBe("");
  }
  await page.keyboard.down("d");
  await page.waitForTimeout(160);
  await page.keyboard.press("Escape");
  await page.keyboard.up("d");
  const frozen = await read(page);
  await page.waitForTimeout(300);
  expect((await read(page)).state.player).toEqual(frozen.state.player);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  expect((await read(page)).state.player).toEqual(frozen.state.player);
  expect((await read(page)).attackSerial).toBe(frozen.attackSerial);
});

test("hud-hotbar", async ({ page }) => {
  await start(page);
  const fixture = initialState();
  const ids = Object.keys(items) as ItemId[];
  fixture.player.hp = 30;
  fixture.bag = [
    ...ids.map((id) => ({ id, count: 3 })),
    ...Array(17).fill(null),
  ];
  await importFixture(page, fixture);
  await page.keyboard.press("Tab");
  for (let i = 0; i < 8; i++) {
    const index = i < ids.length ? i : ids.indexOf("potion");
    await page.locator(`[data-slot="${index}"]`).click();
    await page.locator("#bind").selectOption(String(i));
    await page.locator("#bind-button").click();
  }
  await page.keyboard.press("Escape");
  const slots = [...ids, "potion"];
  expect((await read(page)).state.hotbar).toEqual(slots);
  for (let i = 0; i < 8; i++) {
    await expect(
      page.locator("#hotbar button").nth(i).locator("small"),
    ).toHaveText(String(i + 1));
    await expect(
      page.locator("#hotbar button").nth(i).locator("img"),
    ).toHaveAttribute("src", `/assets/icon-${slots[i]}.png`);
    await expect(
      page.locator("#hotbar button").nth(i).locator("strong"),
    ).toHaveText("3");
  }
  const berry = ids.indexOf("berry"),
    potion = ids.indexOf("potion");
  const attacks = (await read(page)).attackSerial;
  await page.keyboard.press(String(berry + 1));
  await expect.poll(async () => (await read(page)).state.player.hp).toBe(42);
  const button = page.locator("#hotbar button").nth(berry);
  await button.click();
  await expect.poll(async () => (await read(page)).state.player.hp).toBe(54);
  await expect(button).toBeFocused();
  await expect(button.locator("strong")).toHaveText("1");
  await page.keyboard.press(String(potion + 1));
  await expect.poll(async () => (await read(page)).state.player.hp).toBe(100);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press(String(i + 1));
    await expect(page.locator("#hotbar button").nth(i)).toHaveClass(
      /just-used/,
    );
  }
  expect((await read(page)).attackSerial).toBe(attacks);
  await expect(
    page.locator("#hotbar button").nth(7).locator("strong"),
  ).toHaveText("2");
});

test("hud-pointer", async ({ page }) => {
  await start(page);
  const attacks = (await read(page)).attackSerial;
  await page.locator("#minimap-toggle").click();
  await page.locator("#quest-toggle").click();
  await page.locator("#minimap").click();
  const r = await page.locator("#minimap").boundingBox();
  await page.mouse.move(r!.x + 20, r!.y + 20);
  await page.mouse.down();
  await page.mouse.move(700, 300);
  await page.mouse.up();
  await page.locator("#hotbar button").nth(0).click();
  expect((await read(page)).attackSerial).toBe(attacks);
  await page.locator("#minimap-toggle").click();
  await page.locator("#quest-toggle").click();
  const hits = await page.evaluate(() => ({
    正文外: document.elementFromPoint(innerWidth - 70, 170)?.tagName,
    底托间隙: document.elementFromPoint(innerWidth / 2, innerHeight - 39)
      ?.tagName,
    左上装饰: document.elementFromPoint(150, 70)?.tagName,
    空白: document.elementFromPoint(500, 25)?.tagName,
    隐藏正文:
      document.querySelector<HTMLElement>("#quest-details")!.offsetHeight,
  }));
  expect(hits).toEqual({
    正文外: "CANVAS",
    底托间隙: "CANVAS",
    左上装饰: "CANVAS",
    空白: "CANVAS",
    隐藏正文: 0,
  });
  await page.mouse.click(500, 300);
  await expect
    .poll(async () => (await read(page)).attackSerial)
    .toBe(attacks + 1);
});

test("hud-storage", async ({ browser }) => {
  for (const kind of ["损坏", "不可用"]) {
    const context = await browser.newContext();
    await context.addInitScript((kind) => {
      if (kind === "损坏") localStorage.setItem("farwind-hud-v1", "{broken");
      else {
        Storage.prototype.getItem = () => {
          throw Error("测试存储拒绝");
        };
        Storage.prototype.setItem = () => {
          throw Error("测试存储拒绝");
        };
      }
    }, kind);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await start(page);
    await page.locator("#minimap-toggle").click();
    await expect(page.locator("#minimap-details")).toBeVisible();
    expect((await read(page)).mode).toBe("");
    expect(errors).toEqual([]);
    await context.close();
  }
});

test("hud-dialog-training", async ({ page }) => {
  await start(page);
  await move(page, 670, 650);
  await expect.poll(async () => (await read(page)).target).toBe("elder");
  await page.keyboard.press("e");
  await expect(page.locator(".dialog-panel")).toBeVisible();
  expect((await read(page)).state.quest).toBe(1);
  await page.keyboard.press("e");
  await expect(page.locator("#quest-toggle")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(page.locator("#objective-summary")).toContainText("森林异响");
  await expect(page.locator("#toast")).toContainText("目标已更新");
  await move(page, 850, 720);
  await expect(page.locator("#training-panel")).toBeVisible();
  await expect(page.locator("[data-practice-menu]")).toBeVisible();
  await page.locator("[data-practice-menu]").click();
  await expect(
    page.getByRole("heading", { name: "迎风架剑练习" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  expect((await read(page)).mode).toBe("");
  await page.keyboard.press("l");
  await expect(page.locator("#combat-status")).not.toContainText("就绪");
});

test("hud-responsive", async ({ browser }) => {
  const records: any[] = [];
  for (const [width, height, dpr] of [
    [1280, 720, 1],
    [1440, 900, 1],
    [1920, 1080, 1],
    [1440, 900, 2],
  ]) {
    const c = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: dpr,
    });
    const p = await c.newPage();
    await start(p);
    const measured = await p.evaluate(() => ({
      视口: [innerWidth, innerHeight],
      倍率: devicePixelRatio,
      边界: Object.fromEntries(
        ["#hotbar", ".hud-info", ".location", ".quest-tracker"].map((sel) => {
          const r = document.querySelector(sel)!.getBoundingClientRect();
          return [sel, { x: r.x, y: r.y, width: r.width, height: r.height }];
        }),
      ),
    }));
    expect(measured.边界["#hotbar"].width).toBe(440);
    expect(measured.边界["#hotbar"].height).toBe(58);
    expect(measured.边界["#hotbar"].y).toBe(height - 68);
    expect(measured.边界[".hud-info"].height).toBe(72);
    await p.locator("#minimap-toggle").click();
    await p.locator("#quest-toggle").click();
    const canvas = await p.locator("#minimap").evaluate((c: any) => ({
      width: c.width,
      height: c.height,
      css: c.getBoundingClientRect().width,
      pixel: [...c.getContext("2d").getImageData(c.width - 2, 2, 1, 1).data],
    }));
    expect(canvas.width).toBe(192 * dpr);
    expect(canvas.css).toBe(192);
    expect(canvas.pixel[3]).toBeLessThan(200);
    await p.keyboard.press("m");
    const full = await p.locator("#world-map").evaluate((c: any) => ({
      width: c.width,
      pixel: [...c.getContext("2d").getImageData(c.width - 2, 2, 1, 1).data],
    }));
    expect(full.width).toBe(840 * dpr);
    expect(full.pixel[3]).toBe(255);
    await p.keyboard.press("Escape");
    await p.setViewportSize({ width: 480, height: 420 });
    await p.keyboard.press("Escape");
    const overflow = await p.locator(".pause-panel").evaluate((e) => ({
      高: e.getBoundingClientRect().height,
      宽: e.getBoundingClientRect().width,
      可滚动: e.scrollHeight > e.clientHeight,
    }));
    expect(overflow.高).toBeLessThanOrEqual(396);
    expect(overflow.宽).toBeLessThanOrEqual(456);
    expect(overflow.可滚动).toBe(true);
    records.push({
      ...measured,
      小地图: canvas,
      完整地图: full,
      短屏: overflow,
    });
    await c.close();
  }
  await writeFile(
    "docs/hud-redesign/after/layout-test.json",
    JSON.stringify({ 结果: "通过", 测量: records }, null, 2),
  );
});

test("hud-backup", async ({ page }) => {
  await start(page);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "保存旅途", exact: true }).click();
  await expect(page.locator("#toast")).toContainText("旅途已保存");
  const before = (await read(page)).state;
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出备份", exact: true }).click();
  const exported = await download;
  const { readFile } = await import("node:fs/promises");
  const saved = JSON.parse(await readFile((await exported.path())!, "utf8"));
  expect(saved).toEqual(before);
  expect(saved.schema_version).toBe(1);
  expect(saved).not.toHaveProperty("hudPreferences");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入存档", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "invalid-save.json",
    mimeType: "application/json",
    buffer: Buffer.from("{}"),
  });
  await expect(page.locator("#toast")).toContainText("存档损坏");
  expect((await read(page)).state).toEqual(before);
  expect((await read(page)).mode).toBe("pause");
  await page
    .getByRole("button", { name: "保存并返回标题", exact: true })
    .click();
  await page.locator("#settings").click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "远风之地", exact: true }),
  ).toBeVisible();
});
