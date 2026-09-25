import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:4173/");
await page.getByRole("button", { name: "启程 · 新游戏" }).click();
await page.waitForTimeout(3700);
await page.screenshot({ path: "docs/screenshots/village.png" });
await page.keyboard.down("w");
await page.waitForTimeout(200);
await page.keyboard.up("w");
await page.keyboard.press("e");
await page.getByRole("button", { name: "继续 · E" }).click();
assert.equal((await page.evaluate(() => window.__farwind())).state.quest, 1);
await page.setViewportSize({ width: 800, height: 600 });
await page.waitForTimeout(400);
const bounds = await page.locator("#hotbar").boundingBox();
assert(bounds.x >= 0 && bounds.x + bounds.width <= 800);
const canvas = await page
  .locator("#game canvas")
  .evaluate((c) => [c.width, c.height]);
assert.deepEqual(canvas, [800, 600]);
await page.screenshot({ path: "docs/screenshots/window-800.png" });
await page.keyboard.press("Escape");
const choosing = page.waitForEvent("filechooser");
page.once("dialog", (dialog) => dialog.accept());
await page.getByRole("button", { name: "导入存档", exact: true }).click();
await (await choosing).setFiles("docs/test-evidence/exported-save.json");
await page.waitForTimeout(400);
assert.equal((await page.evaluate(() => window.__farwind())).state.quest, 0);
assert.deepEqual(errors, []);
await fs.writeFile(
  "docs/test-evidence/preview.json",
  JSON.stringify(
    {
      结果: "通过",
      检查: [
        "生产构建启动并实际接任务",
        "800×600 窗口调整后画布同步缩放",
        "快捷栏未越出视口",
        "真实文件选择器导入先前导出的有效存档并确认覆盖",
        "无页面运行错误",
      ],
      运行错误: errors,
    },
    null,
    2,
  ),
);
await browser.close();
console.log("生产预览、窗口缩放、有效存档导入：通过");
