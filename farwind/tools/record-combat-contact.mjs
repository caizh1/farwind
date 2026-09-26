import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { captureGameAudio } from "./capture-game-audio.mjs";
const dir = "docs/combat-contact/evidence";
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
await context.addInitScript(captureGameAudio);
const page = await context.newPage();
await page.goto("http://127.0.0.1:5173/");
await page.getByRole("button", { name: "启程 · 新游戏" }).click();
await page.waitForFunction(
  () =>
    window.__farwind?.().mode === "" && window.__farwind().session.sim > 500,
);
await page.evaluate(() => {
  window.__feel = [];
  setInterval(() => {
    const s = window.__farwind();
    window.__feel.push({
      时间: performance.now(),
      逻辑: s.session.combat,
      模拟时间: s.session.sim,
      表现: s.animation.hero,
    });
  }, 8);
});
for (const key of ["d", "w"]) {
  await page.keyboard.down(key);
  await page.waitForTimeout(100);
  await page.keyboard.up(key);
  await page.waitForTimeout(100);
  // 单击，等待收势完成。
  await page.keyboard.press("j");
  await page.waitForTimeout(800);
  // 60ms早按第二刀；第二刀开始后再次预约第三刀；随后停手。
  await page.keyboard.press("j");
  await page.waitForTimeout(60);
  await page.keyboard.press("j");
  await page.waitForTimeout(250);
  await page.keyboard.press("j");
  await page.waitForTimeout(1100);
  // 从战斗等待即时移动，正常移速退出。
  await page.keyboard.press("j");
  await page.waitForTimeout(355);
  await page.keyboard.down(key);
  await page.waitForTimeout(200);
  await page.keyboard.up(key);
  await page.waitForTimeout(300);
}
await page.screenshot({ path: `${dir}/normal-scale.png` });
await writeFile(
  `${dir}/${process.env.BASELINE ? "baseline" : "current"}-trace.json`,
  JSON.stringify(await page.evaluate(() => window.__feel), null, 2),
);
const audio = await page.evaluate(() => window.__finishAudio());
await writeFile(
  `${dir}/${process.env.BASELINE ? "baseline" : "current"}-audio.webm`,
  Buffer.from(audio.base64, "base64"),
);
await writeFile(
  `${dir}/${process.env.BASELINE ? "baseline" : "current"}-audio-offset.txt`,
  String(audio.offset),
);
const video = page.video();
await page.close();
await video.saveAs(
  `${dir}/${process.env.BASELINE ? "baseline" : "current"}-sample.webm`,
);
await browser.close();
