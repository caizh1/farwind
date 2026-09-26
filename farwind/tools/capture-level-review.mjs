import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const phase = process.argv[2] ?? "before";
const directory = `docs/level-rework/${phase}`;
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ args: ["--enable-webgl", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const views = [
  ["healer-court", 1200, 740],
  ["training-field", 1640, 800],
  ["north-shore", 1450, 850],
  ["village-gate", 1880, 1080],
];
const records = [];
for (const [name, x, y] of views) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on("dialog", d => d.accept());
  await page.goto("http://127.0.0.1:5176/");
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  const fixture = await page.evaluate(() => window.__farwind().state);
  fixture.player.x = x; fixture.player.y = y; fixture.time = 480;
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "保存并返回标题" }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入存档" }).click();
  await (await chooser).setFiles({ name: "visual-location-fixture.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture)) });
  await page.waitForFunction(() => window.__farwind().mode === "");
  await page.keyboard.press("Escape");
  await page.addStyleTag({ content: "#modal,#toast{visibility:hidden!important}" });
  await page.waitForTimeout(1200);
  const snap = await page.evaluate(() => window.__farwind());
  if (Math.abs(snap.state.player.x-x)>1 || Math.abs(snap.state.player.y-y)>1) throw Error(`${name} 指定站位不可站立，禁止用错位截图冒充相同镜头`);
  await page.screenshot({ path: `${directory}/${name}.png` });
  await page.addStyleTag({ content: "#hud{visibility:hidden!important}" });
  await page.screenshot({ path: `${directory}/${name}-clean.png` });
  records.push({ 场景: name, 视口: [1280,720], 角色位置: snap.state.player, 游戏时刻: snap.state.time, 说明: "通过合法存档导入固定站位；暂停后只隐藏菜单或HUD，不改写运行状态，不用于功能通关证明。镜头和角色尺寸沿用正式游戏。" });
  await context.close();
}
await writeFile(`${directory}/capture-record.json`,JSON.stringify(records,null,2));
await browser.close();
