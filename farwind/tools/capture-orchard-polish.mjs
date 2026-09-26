import { chromium } from "@playwright/test";
import sharp from "sharp";
import { mkdir, writeFile, access } from "node:fs/promises";
const phase = process.argv[2];
if (!["before", "after"].includes(phase))
  throw Error("请指定修改前或修改后阶段：before / after");
const view = process.argv[3] ?? "orchard";
const locations = {
  orchard: {
    x: 660,
    y: 1510,
    left: 20,
    top: 960,
    crops: [
      ["flower-bed", 210, 1440, 255, 155],
      ["bench", 880, 1300, 145, 110],
    ],
  },
  "west-bench": {
    x: 940,
    y: 1400,
    left: 300,
    top: 850,
    crops: [["bench", 880, 1300, 145, 130]],
  },
  "east-bench": {
    x: 1570,
    y: 1400,
    left: 930,
    top: 850,
    crops: [["bench", 1475, 1275, 145, 135]],
  },
};
const location = locations[view];
if (!location) throw Error("未知截图机位");
const directory = `docs/visual-polish/orchard/${phase}${view === "orchard" ? "" : `/${view}`}`;
try {
  await access(`${directory}/capture-record.json`);
  throw Error("已有截图记录，禁止覆盖基线");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({
  args: [
    "--enable-webgl",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const records = [];
for (const viewport of [
  { width: 1280, height: 800 },
  { width: 1365, height: 853 },
]) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on("dialog", (d) => d.accept());
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" || /already exists/.test(m.text()))
      errors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  await page.goto(process.env.FARWIND_URL ?? "http://127.0.0.1:5182/");
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  const fixture = await page.evaluate(() => window.__farwind().state);
  fixture.player.x = location.x;
  fixture.player.y = location.y;
  fixture.time = 600;
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "保存并返回标题" }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入存档" }).click();
  await (
    await chooser
  ).setFiles({
    name: "visual-location-fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await page.waitForTimeout(800);
  const importedMode = await page.evaluate(() => window.__farwind().mode);
  console.log("导入后界面模式", importedMode);
  if (importedMode === "pause") await page.keyboard.press("Escape");
  await page.waitForFunction(() => window.__farwind().mode === "");
  await page.waitForTimeout(2500);
  const snapshot = await page.evaluate(() => window.__farwind());
  if (
    Math.abs(snapshot.state.player.x - location.x) > 1 ||
    Math.abs(snapshot.state.player.y - location.y) > 1
  )
    throw Error("固定站位不可用");
  await page.keyboard.press("Escape");
  // 暂停冻结相同机位；隐藏暂停对话框，正常 HUD 保留。截图不做绘图修饰。
  await page.addStyleTag({
    content: "#modal,#toast{visibility:hidden!important}",
  });
  const tag = `${viewport.width}x${viewport.height}`;
  await page.screenshot({ path: `${directory}/overview-${tag}.png` });
  await page.addStyleTag({ content: "#hud{visibility:hidden!important}" });
  const clean = await page.screenshot({
    path: `${directory}/overview-clean-${tag}.png`,
  });
  const zoom = viewport.width / 1280,
    left = location.left,
    top = location.top;
  for (const [name, x, y, w, h] of location.crops) {
    const crop = {
      left: Math.round((x - left) * zoom),
      top: Math.round((y - top) * zoom),
      width: Math.round(w * zoom),
      height: Math.round(h * zoom),
    };
    await sharp(clean)
      .extract(crop)
      .png()
      .toFile(`${directory}/${name}-${tag}.png`);
  }
  records.push({
    视口: viewport,
    缩放: zoom,
    站位: snapshot.state.player,
    时间: snapshot.state.time,
    页面错误: errors,
    帧率样本: snapshot.fps,
    说明: "合法存档导入建立同机位；正常 HUD 全景为真实浏览器截图，局部图仅裁切隐藏 HUD 的真实截图；行为验收另以键盘完成。",
  });
  await context.close();
}
await writeFile(
  `${directory}/capture-record.json`,
  JSON.stringify(records, null, 2),
);
await browser.close();
