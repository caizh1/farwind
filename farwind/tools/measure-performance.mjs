import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:5173/");
await page.getByRole("button", { name: "启程 · 新游戏" }).click();
await page.waitForTimeout(3000);
await page.keyboard.down("d");
await page.waitForTimeout(1500);
await page.keyboard.up("d");
await page.keyboard.down("a");
await page.waitForTimeout(1500);
await page.keyboard.up("a");
await page.waitForTimeout(7000);
const measurement = await page.evaluate(() => {
  const s = window.__farwind();
  const a = s.fps
    .slice(-600)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const canvas = document.querySelector("#game canvas");
  return {
    模式: s.mode,
    样本数: a.length,
    平均帧率: a.reduce((n, x) => n + x, 0) / a.length,
    低百分位帧率: a[Math.floor(a.length * 0.05)],
    中位帧率: a[Math.floor(a.length * 0.5)],
    画布: [canvas.width, canvas.height],
    浏览器: navigator.userAgent,
    渲染类型: s.renderer,
  };
});
await page.screenshot({ path: "docs/screenshots/village-1920-headed.png" });
const report = {
  日期: new Date().toISOString(),
  机器: {
    架构: os.arch(),
    系统: os.platform(),
    系统版本: os.release(),
    内存GB: Math.round(os.totalmem() / 1024 ** 3),
  },
  场景: "村庄，短距离往返行走后静止，总计约 13 秒，有头 Chrome 独立测试配置",
  测量方法:
    "Phaser 每帧 delta 的倒数，取最后 600 个有效样本；短测，不代表所有场景或长时间稳定性",
  浏览器版本: browser.version(),
  测量: measurement,
  运行错误: errors,
};
await fs.writeFile(
  "docs/test-evidence/performance.json",
  JSON.stringify(report, null, 2),
);
await context.close();
await browser.close();
console.log(JSON.stringify(report, null, 2));
