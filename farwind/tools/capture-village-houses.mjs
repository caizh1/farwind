import { chromium } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";

const url = process.env.FARWIND_URL ?? "http://127.0.0.1:4198/";
const root = "docs/village-houses/after";
const { 资源: houses } = JSON.parse(await readFile("public/assets/village-houses/manifest.json", "utf8"));
const baseline = JSON.parse(await readFile("docs/village-houses/before/record.json", "utf8")).状态.state;
const positions = [[330, 650], [550, 650], [310, 900], [330, 1190], [900, 1010], [530, 1410], [800, 1440], [1110, 460], [1995, 650], [1685, 1640]];
await mkdir(root, { recursive: true });
const browser = await chromium.launch({ args: ["--enable-webgl", "--use-angle=metal"] });
const records = [];
try {
  for (const [i, house] of houses.entries()) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const page = await context.newPage(), errors = [], resources = new Set();
    page.on("pageerror", e => errors.push(e.message));
    page.on("response", r => { if (r.url().includes("/assets/village-houses/") && r.status() === 200) resources.add(r.url().split("/").pop()); });
    page.on("dialog", d => d.accept());
    await page.goto(url);
    await page.getByRole("button", { name: "导入存档", exact: true }).waitFor();
    const state = structuredClone(baseline);
    const [x, y] = positions[i];
    // 保留基线时间，避免把居民刚记录的记忆回拨到未来而使存档无效。
    state.player.x = x; state.player.y = y + 45;
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "导入存档", exact: true }).click();
    await (await chooser).setFiles({ name: "visual-location.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(state)) });
    try {
      await page.waitForFunction(() => window.__farwind?.().mode === "", { }, { timeout: 5000 });
    } catch (error) {
      await page.screenshot({ path: `${root}/import-failure.png` });
      await writeFile(`${root}/import-failure.json`, JSON.stringify({ 首因: String(error), 页面文字: await page.locator("body").innerText(), 状态: await page.evaluate(() => window.__farwind?.()), 页面错误: errors }, null, 2));
      throw error;
    }
    await page.waitForTimeout(200);
    const before = await page.evaluate(() => window.__farwind());
    assert.ok(Math.abs(before.state.player.x - x) < 1 && Math.abs(before.state.player.y - y - 45) < 1, `${house.名称}存档站位未落地`);
    await page.keyboard.down("w");
    try {
      await page.waitForFunction(y => window.__farwind().state.player.y < y - 8, before.state.player.y, { timeout: 5000 });
    } catch (error) {
      await writeFile(`${root}/motion-failure.json`, JSON.stringify({ 首因: String(error), 房屋: house.名称, 移动前: before, 移动后: await page.evaluate(() => window.__farwind()), 页面文字: await page.locator("body").innerText() }, null, 2));
      throw error;
    } finally { await page.keyboard.up("w"); }
    const approach = await page.evaluate(() => window.__farwind());
    assert.ok(approach.state.player.y < before.state.player.y - 5, `${house.名称}门前未能正常移动`);
    await page.keyboard.press("Escape");
    await page.addStyleTag({ content: "#modal,#toast{visibility:hidden!important}" });
    await page.screenshot({ path: `${root}/${house.标识}.png` });
    assert.equal(resources.size, 10, "生产页面必须加载十栋新外观");
    assert.deepEqual(errors, [], "页面出现运行错误");
    records.push({ 房屋: house.名称, 标识: house.标识, 输入站位: [x, y + 45], 移动后站位: [approach.state.player.x, approach.state.player.y], 交互目标: approach.target, 资源成功加载数: resources.size, 页面错误: errors, 截图: `${house.标识}.png` });
    if (i === 0) {
      // 生产新游戏入口另留一张，不用固定站位冒充正式开场。
      const startContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      const start = await startContext.newPage(); await start.goto(url);
      await start.getByRole("button", { name: "启程 · 新游戏", exact: true }).click();
      await start.waitForFunction(() => window.__farwind?.().mode === "");
      await start.keyboard.press("Escape"); await start.addStyleTag({ content: "#modal,#toast{visibility:hidden!important}" });
      await start.screenshot({ path: `${root}/plaza.png` }); await startContext.close();
    }
    await context.close();
  }
  await writeFile(`${root}/record.json`, JSON.stringify({ 说明: "当前生产构建，正式存档导入仅建立视觉镜头；使用真实键盘向门口移动，不改写运行状态。暂停遮罩仅在截图时隐藏。", 运行地址: url, 房屋覆盖: records.length, 记录: records }, null, 2));
  console.log("十栋生产房屋截图、真实门前移动及资源加载检查通过。");
} finally { await browser.close(); }
