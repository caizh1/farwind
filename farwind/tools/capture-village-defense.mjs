import { chromium } from "@playwright/test";
import { mkdir, writeFile, access } from "node:fs/promises";
const phase = process.argv[2];
if (phase !== "before" && !/^after(?:-v\d+)?$/.test(phase ?? ""))
  throw Error("请指定 before、after 或 after-v2 等候选版本");
const directory = `docs/village-defense/m1/${phase}`;
try {
  await access(`${directory}/capture-record.json`);
  throw Error("已有基线，禁止重录");
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
const views = [
  ["north-gate", 820, 420],
  ["east-gate", 2050, 1080],
  ["south-gate", 900, 1710],
  ["west-boundary", 180, 1380],
  ["plaza", 670, 780],
];
const records = [];
for (const [name, x, y] of views) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  page.on("dialog", (d) => d.accept());
  await page.goto(process.env.FARWIND_URL ?? "http://127.0.0.1:4175/");
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  const fixture = await page.evaluate(() => window.__farwind().state);
  fixture.player.x = x;
  fixture.player.y = y;
  fixture.time = 480;
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
  await page.waitForFunction(() => window.__farwind().mode === "");
  await page.keyboard.press("Escape");
  await page.addStyleTag({
    content: "#modal,#toast{visibility:hidden!important}",
  });
  await page.waitForTimeout(1000);
  const snapshot = await page.evaluate(() => window.__farwind());
  if (
    Math.abs(snapshot.state.player.x - x) > 1 ||
    Math.abs(snapshot.state.player.y - y) > 1
  )
    throw Error(`${name} 固定站位不可用`);
  await page.screenshot({ path: `${directory}/${name}.png` });
  await page.addStyleTag({ content: "#hud{visibility:hidden!important}" });
  await page.screenshot({ path: `${directory}/${name}-clean.png` });
  records.push({
    场景: name,
    视口: [1280, 720],
    位置: snapshot.state.player,
    时间: snapshot.state.time,
    说明: "合法存档建立固定镜头；仅用于视觉对照，功能另以真实输入验证。",
  });
  await context.close();
}
await writeFile(
  `${directory}/capture-record.json`,
  JSON.stringify(records, null, 2),
);
await browser.close();
