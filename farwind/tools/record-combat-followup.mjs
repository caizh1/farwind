import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
const directory = "docs/combat-followup/evidence";
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
await page.goto("http://127.0.0.1:5173/?animationDebug=1");
await page.getByRole("button", { name: "启程 · 新游戏" }).click();
await page.waitForFunction(
  () =>
    window.__farwind?.().mode === "" && window.__farwind().session.sim > 500,
);
await page.evaluate(() => {
  window.__followupFrames = [];
  window.__followupTimer = setInterval(() => {
    const s = window.__farwind();
    window.__followupFrames.push({
      时间: performance.now(),
      模拟时间: s.session.sim,
      逻辑: s.session.combat,
      表现: s.animation.hero,
    });
  }, 8);
});
for (const direction of ["d", "a", "w", "s"]) {
  await page.keyboard.down(direction);
  await page.waitForTimeout(100);
  await page.keyboard.up(direction);
  await page.waitForTimeout(250);
  // 固定节奏，不读取连段窗口来决定按键。
  for (const gap of [360, 380, 400, 800]) {
    await page.keyboard.press("j");
    await page.waitForTimeout(gap);
  }
}
await page.keyboard.down("d");
await page.waitForTimeout(100);
await page.keyboard.up("d");
for (const gap of [245, 270, 400, 750]) {
  await page.keyboard.press("j");
  await page.waitForTimeout(gap);
}
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
await writeFile(
  `${directory}/fixed-rhythm-trace.json`,
  JSON.stringify(await page.evaluate(() => window.__followupFrames), null, 2),
);
const video = page.video();
await page.close();
await video.saveAs(`${directory}/fixed-rhythm.webm`);
await browser.close();
