import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { move } from "./map-navigation";

test("dialogue-production-residents", async ({ page }) => {
  const directory = "docs/dialogue-portraits/evidence/production";
  await mkdir(directory, { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  await expect(page.locator("#modal")).toBeHidden();
  expect(await page.evaluate(() => (window as any).__farwind().session)).toBeUndefined();
  const checkpoints = [];
  for (const [id, x, y, name] of [["elder", 670, 690, "守风人 · 岚爷爷"], ["healer", 1130, 610, "药师 · 小满"], ["carpenter", 330, 1040, "木匠 · 阿禾"]] as const) {
    await move(page, x, y);
    await expect.poll(() => page.evaluate(() => (window as any).__farwind().target)).toBe(id);
    await page.keyboard.press("e");
    await expect(page.locator("#dialog-title")).toHaveText(name);
    const image = page.locator(".dialogue-portrait img");
    await expect(image).toHaveAttribute("src", `/assets/portraits/${id}-neutral.webp`);
    await expect.poll(() => image.evaluate((im: HTMLImageElement) => im.naturalWidth)).toBe(768);
    await page.waitForFunction(() => document.querySelector(".dialog-panel")?.getAnimations().every(animation => animation.playState === "finished"));
    await page.screenshot({ path: `${directory}/${id}.png` });
    await page.setViewportSize({ width: 560, height: 720 });
    await page.screenshot({ path: `${directory}/${id}-narrow.png` });
    await page.setViewportSize({ width: 1280, height: 720 });
    checkpoints.push({ 角色: name, 资源: await image.getAttribute("src"), 视口: page.viewportSize(), 玩家: (await page.evaluate(() => (window as any).__farwind())).state.player });
    await page.getByRole("button", { name: "继续 · E" }).click();
    await expect(page.locator("#modal")).toBeHidden();
  }
  expect(errors).toEqual([]);
  await writeFile(`${directory}/report.json`, JSON.stringify({ 结果: "通过", 说明: "生产构建，本地新游戏真实移动与E交互，开发会话诊断未暴露", 截图: checkpoints, 页面错误: errors }, null, 2));
});
