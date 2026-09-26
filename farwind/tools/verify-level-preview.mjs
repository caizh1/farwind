import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({ args: ["--enable-webgl", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const results = [];
for (const search of ["", "?layoutDebug=1"]) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:4176/${search}`);
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  const state = await page.evaluate(() => window.__farwind());
  if (state.region !== "风铃村" || state.companion.blocked || errors.length) throw Error("生产预览未正常启动");
  await page.keyboard.press("m");
  const legend = await page.locator(".map-guide").innerText();
  if (!legend.includes("药师小院") || !legend.includes("东北练习场") || /(?:^|\n)[A-G]\s/.test(legend)) throw Error("生产地图标号或区域名不符合要求");
  results.push({ 地址: search ? "带开发参数的生产预览" : "正常生产预览", 状态: "通过", 区域名: "保留", 工程标号: "不显示", 页面错误: errors });
  await page.screenshot({ path: `docs/level-rework/evidence/production${search ? "-flag" : ""}.png` });
  await context.close();
}
await writeFile("docs/level-rework/evidence/production-check.json", JSON.stringify(results, null, 2));
await browser.close();
