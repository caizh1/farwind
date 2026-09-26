import { chromium } from "@playwright/test";
import { writeFile, mkdtemp } from "node:fs/promises";
const captureDirectory = await mkdtemp("/tmp/farwind-obstacle-baseline-");
const browser = await chromium.launch({ args: ["--enable-webgl", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: captureDirectory, size: { width: 1280, height: 720 } } });
const page = await context.newPage();
page.on("dialog", dialog => dialog.accept());
await page.goto(`${process.env.FARWIND_URL ?? "http://127.0.0.1:5173"}/`);
await page.getByRole("button", { name: "启程 · 新游戏" }).click();
await page.waitForFunction(() => window.__farwind?.().mode === "");
if (await page.evaluate(() => "obstacles" in window.__farwind())) {
  await browser.close();
  throw Error("修复前录制必须连接原基线开发服务，不能覆盖为修复后证据。");
}
await page.keyboard.press("Escape");
const s = await page.evaluate(() => window.__farwind().state);
s.player.x = 3030; s.player.y = 1010; s.quest = 3; s.killed = ["slime-1", "slime-2", "leaf-1"];
await page.getByRole("button", { name: "保存并返回标题" }).click();
const chooser = page.waitForEvent("filechooser");
await page.getByRole("button", { name: "导入存档" }).click();
await (await chooser).setFiles({ name: "baseline-fixture.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(s)) });
await page.waitForFunction(() => window.__farwind().state.player.x > 3000 && window.__farwind().mode === "");
await page.waitForTimeout(2000);
await page.keyboard.down("d"); await page.waitForTimeout(1200); await page.keyboard.up("d");
await page.keyboard.down("w"); await page.waitForTimeout(333); await page.keyboard.up("w");
await page.keyboard.down("a"); await page.waitForTimeout(20); await page.keyboard.up("a");
await page.waitForTimeout(1500);
const before = await page.evaluate(() => window.__farwind());
for (let i=0; i<8; i++) { await page.keyboard.press("j"); await page.waitForTimeout(550); }
await page.screenshot({path: "docs/obstacle-fix/evidence/before-runtime.png"});
const after = await page.evaluate(() => window.__farwind());
await writeFile("docs/obstacle-fix/evidence/before-runtime.json", JSON.stringify({说明:"修复前隔离实机夹具：导入合法玩家位置、移除其他敌人干扰；叶灵从正常出生点追击，未改变叶灵坐标和生命；正常时间和按键。", 攻击前: {玩家:before.state.player,敌人:before.enemies}, 攻击后:{玩家:after.state.player,敌人:after.enemies}},null,2));
const video=page.video(); await page.close(); await video.saveAs("docs/obstacle-fix/evidence/before-runtime.webm"); await browser.close();
