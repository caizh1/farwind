import { test, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { move } from "./map-navigation";

const directory = "docs/dialogue-portraits/evidence";
const read = (page: Page) => page.evaluate(() => (window as any).__farwind());

async function layout(page: Page) {
  await page.waitForFunction(() => document.querySelector(".dialog-panel")?.getAnimations().every(animation => animation.playState === "finished"));
  const bounds = await page.locator(".dialog-panel").evaluate(panel => {
    const rect = (element: Element | null) => {
      if (!element) return null;
      const r = element.getBoundingClientRect();
      return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
    };
    return {
      人物: rect(panel.querySelector(".dialogue-portrait")),
      正文: rect(panel.querySelector(".dialog-copy")),
      按钮: rect(panel.querySelector("#close"))!,
      面板: rect(panel)!,
      视口: { 宽: innerWidth, 高: innerHeight },
    };
  });
  expect(bounds.按钮.x).toBeGreaterThanOrEqual(0);
  expect(bounds.按钮.right).toBeLessThanOrEqual(bounds.视口.宽);
  expect(bounds.按钮.bottom).toBeLessThanOrEqual(bounds.视口.高);
  expect(bounds.面板.y).toBeGreaterThanOrEqual(0);
  if (bounds.人物) {
    expect(bounds.人物.right).toBeLessThanOrEqual(bounds.正文!.x);
    expect(bounds.人物.right).toBeLessThanOrEqual(bounds.按钮.x);
  }
  return bounds;
}

async function portrait(page: Page, id: string) {
  const image = page.locator(".dialogue-portrait img");
  await expect(image).toHaveAttribute("src", `/assets/portraits/${id}-neutral.webp`);
  await expect.poll(() => image.evaluate((im: HTMLImageElement) => im.naturalWidth)).toBe(768);
  return layout(page);
}

test("dialogue-residents", async ({ page }) => {
  await mkdir(directory, { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const evidence: any[] = [];
  await page.setViewportSize({ width: 1368, height: 720 });
  await page.goto("/");
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  await expect(page.locator("#modal")).toBeHidden();
  await move(page, 670, 690);
  await expect.poll(async () => (await read(page)).target).toBe("elder");
  await page.keyboard.press("e");
  await expect(page.locator("#dialog-title")).toHaveText("守风人 · 岚爷爷");
  evidence.push({ 角色: "岚爷爷", ...await portrait(page, "elder") });
  await page.screenshot({ path: `${directory}/elder-desktop.png` });
  const paused = await read(page);
  await page.keyboard.press("j"); await page.keyboard.press("k"); await page.keyboard.press("l");
  const portraitBox = await page.locator(".dialogue-portrait").boundingBox();
  await page.mouse.click(portraitBox!.x + portraitBox!.width / 2, portraitBox!.y + portraitBox!.height / 2);
  await page.waitForTimeout(200);
  expect((await read(page)).session.sim).toBe(paused.session.sim);
  await page.keyboard.press("e");
  await page.waitForTimeout(200);
  expect((await read(page)).attackSerial).toBe(paused.attackSerial);
  expect((await read(page)).state.player).toEqual(paused.state.player);
  expect((await read(page)).animation.hero.action).toBe("idle");
  await move(page, 1130, 610);
  await expect.poll(async () => (await read(page)).target).toBe("healer");
  await page.keyboard.press("e");
  await expect(page.locator("#dialog-title")).toHaveText("药师 · 小满");
  evidence.push({ 角色: "小满", ...await portrait(page, "healer") });
  await page.screenshot({ path: `${directory}/healer-desktop.png` });
  const healerState = (await read(page)).state;
  await page.keyboard.press("e");
  await expect(page.locator("#modal")).toBeHidden();
  await page.keyboard.press("e");
  await expect(page.locator("#dialog-title")).toHaveText("药师 · 小满");
  expect((await read(page)).state.bag).toEqual(healerState.bag);
  for (const [name, width, height] of [["720", 1280, 720], ["short", 844, 390], ["narrow", 560, 720]] as const) {
    await page.setViewportSize({ width, height });
    evidence.push({ 角色: "小满", ...await portrait(page, "healer") });
    await page.screenshot({ path: `${directory}/healer-${name}.png` });
  }
  const beforeClick = (await read(page)).attackSerial;
  await page.getByRole("button", { name: "继续 · E" }).click();
  await page.waitForTimeout(200);
  expect((await read(page)).attackSerial).toBe(beforeClick);
  await page.setViewportSize({ width: 1368, height: 720 });
  await move(page, 330, 1040);
  await expect.poll(async () => (await read(page)).target).toBe("carpenter");
  await page.keyboard.press("e");
  await expect(page.locator("#dialog-title")).toHaveText("木匠 · 阿禾");
  evidence.push({ 角色: "阿禾", ...await portrait(page, "carpenter") });
  await page.screenshot({ path: `${directory}/carpenter-desktop.png` });
  expect((await read(page)).state.side).toBe(1);
  await page.keyboard.press("Escape");
  await expect(page.locator("#modal")).toBeHidden();
  await page.keyboard.press("e");
  await expect(page.locator("#dialog-title")).toHaveText("木匠 · 阿禾");
  await expect(page.locator("#modal")).toBeVisible();
  await portrait(page, "carpenter");
  expect((await read(page)).state.side).toBe(1);
  await page.keyboard.press("e");
  await expect(page.locator("#modal")).toBeHidden();
  expect(errors).toEqual([]);
  await writeFile(`${directory}/runtime-report.json`, JSON.stringify({ 结果: "通过", 说明: "由新游戏实际键盘移动与交互完成，无任务状态注入", 截图布局: evidence, 页面错误: errors }, null, 2));
});

test("dialogue-sign-and-inscription", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  await expect(page.locator("#modal")).toBeHidden();
  for (const [id, x, y, name] of [["training-guide", 1700, 700, "练习场须知"], ["village-guide", 1960, 1210, "东村口路牌"], ["clue", 3370, 870, "被风磨亮的碑文"]] as const) {
    await move(page, x, y);
    await expect.poll(async () => (await read(page)).target).toBe(id);
    await page.keyboard.press("e");
    await expect(page.locator("#dialog-title")).toHaveText(name);
    await expect(page.locator(".dialogue-portrait")).toHaveCount(0);
    await layout(page);
    await page.screenshot({ path: `${directory}/${id}-text.png` });
    await page.keyboard.press("e");
    await expect(page.locator("#modal")).toBeHidden();
  }
});

test("dialogue-fallback-and-long-text", async ({ page }) => {
  await page.goto("/docs/dialogue-portraits/preview.html");
  for (const id of ["healer", "elder", "carpenter"]) {
    await page.getByLabel("预览对象").selectOption(id);
    await page.setViewportSize({ width: 1368, height: 720 });
    await portrait(page, id);
    await page.screenshot({ path: `${directory}/${id}-fixed-preview.png` });
    await page.setViewportSize({ width: 560, height: 720 });
    await portrait(page, id);
    await page.screenshot({ path: `${directory}/${id}-fixed-narrow.png` });
  }
  for (const id of ["sign", "rune", "unknown", "__proto__"]) {
    await page.getByLabel("预览对象").selectOption(id);
    await expect(page.locator(".dialogue-portrait")).toHaveCount(0);
    await expect(page.locator("#dialog-text")).not.toBeEmpty();
    await layout(page);
  }
  await page.getByLabel("预览对象").selectOption("healer");
  await page.getByLabel("长台词").check();
  for (const [name, width, height] of [["narrow", 560, 720], ["short", 844, 390], ["tiny", 375, 280]] as const) {
    await page.setViewportSize({ width, height });
    await portrait(page, "healer");
    const text = page.locator("#dialog-text");
    const overflow = await text.evaluate(p => ({ 内容高: p.scrollHeight, 显示高: p.clientHeight, 字号: parseFloat(getComputedStyle(p).fontSize) }));
    expect(overflow.内容高).toBeGreaterThan(overflow.显示高);
    expect(overflow.显示高).toBeGreaterThan(25);
    expect(overflow.字号).toBeGreaterThanOrEqual(16);
    await text.hover(); await page.mouse.wheel(0, 10000);
    await expect.poll(() => text.evaluate(p => p.scrollTop + p.clientHeight >= p.scrollHeight - 2)).toBe(true);
    await page.screenshot({ path: `${directory}/long-${name}.png` });
  }
  await page.route("**/assets/portraits/healer-neutral.webp", route => route.fulfill({ status: 404, body: "测试：素材缺失" }));
  await page.reload();
  await expect(page.locator(".dialogue-portrait")).toHaveCount(0);
  await expect(page.locator(".dialog-panel")).not.toHaveClass(/dialog-panel--portrait/);
  await expect(page.locator("#dialog-title")).toHaveText("药师 · 小满");
  await layout(page);
  await page.screenshot({ path: `${directory}/missing-portrait.png` });
  await page.getByRole("button", { name: "继续 · E" }).click();
  await expect(page.locator("#modal")).toBeHidden();
});

test("dialogue-late-image-failure", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/assets/portraits/healer-neutral.webp", async route => {
    await pending;
    await route.fulfill({ status: 404, body: "测试：旧立绘请求延迟失败" });
  });
  await page.goto("/docs/dialogue-portraits/preview.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#dialog-title")).toHaveText("药师 · 小满");
  await page.getByLabel("预览对象").selectOption("elder");
  await portrait(page, "elder");
  release();
  await page.waitForTimeout(200);
  await portrait(page, "elder");
  await expect(page.locator("#dialog-title")).toHaveText("守风人 · 岚爷爷");
});

test("dialogue-missing-runtime", async ({ page }) => {
  await page.route("**/assets/portraits/healer-neutral.webp", route => route.fulfill({ status: 404, body: "测试：药师立绘缺失" }));
  await page.goto("/");
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  await expect(page.locator("#modal")).toBeHidden();
  await move(page, 1130, 610);
  const before = await read(page);
  await page.keyboard.press("e");
  await expect(page.locator("#dialog-title")).toHaveText("药师 · 小满");
  await expect(page.locator(".dialogue-portrait")).toHaveCount(0);
  await expect(page.locator("#dialog-text")).toContainText("带来药草");
  await layout(page);
  await page.screenshot({ path: `${directory}/missing-runtime.png` });
  await page.keyboard.press("j"); await page.keyboard.press("k"); await page.keyboard.press("l");
  await page.keyboard.press("e");
  await expect(page.locator("#modal")).toBeHidden();
  await page.waitForTimeout(200);
  const after = await read(page);
  expect(after.attackSerial).toBe(before.attackSerial);
  expect(after.state.bag).toEqual(before.state.bag);
  expect(after.animation.hero.action).toBe("idle");
});
