import { chromium } from "@playwright/test";

const [url, output] = process.argv.slice(2);
if (!url || !output) throw Error("需要网址和输出路径");
const browser = await chromium.launch({
  args: [
    "--enable-webgl",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: "test-results", size: { width: 1280, height: 720 } },
});
const page = await context.newPage();
await page.goto(url);
await page.getByRole("button", { name: "启程 · 新游戏" }).click();
await page.waitForFunction(() => window.__farwind?.().mode === "", undefined, {
  timeout: 20000,
});
await page.waitForTimeout(250);
await page.keyboard.down("d");
await page.waitForTimeout(120);
await page.keyboard.up("d");
await page.waitForTimeout(250);
await page.keyboard.press("j");
await page.waitForTimeout(255);
await page.keyboard.press("j");
await page.waitForTimeout(285);
await page.keyboard.press("j");
await page.waitForTimeout(740);
await page.keyboard.press("j");
await page.waitForTimeout(480);
await page.keyboard.down("w");
await page.waitForTimeout(110);
await page.keyboard.up("w");
await page.keyboard.press("j");
await page.waitForTimeout(500);
await page.keyboard.press("Escape");
await page.waitForTimeout(260);
await page.keyboard.press("Escape");
await page.waitForTimeout(260);
const video = page.video();
await page.close();
await video?.saveAs(output);
await browser.close();
