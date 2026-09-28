import { chromium } from "@playwright/test";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";

const root = "docs/xiaobao/evidence/animation-demo";
await mkdir(root, { recursive: true });
const build = JSON.parse(await readFile("docs/xiaobao/evidence/delivery-build.json", "utf8"));
const browser = await chromium.launch({ headless: true, args: ["--enable-gpu", "--use-gl=angle", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const context = await browser.newContext({ viewport: { width: 1280, height: 960 }, recordVideo: { dir: root, size: { width: 1280, height: 960 } } });
const page = await context.newPage(), errors = [], records = [], started = Date.now();
page.on("pageerror", e => errors.push(e.message));
try {
  await page.goto("http://127.0.0.1:5193/xiaobao-combat-preview.html");
  await page.waitForFunction(() => Boolean(window.__xiaobaoCombatPreview));
  const skills = await page.locator("#skill option").evaluateAll(options => options.map(o => ({ value: o.value, text: o.textContent })));
  if (skills.length !== 12) throw Error("正式演武项数不符，停止记录。");
  for (const skill of skills) {
    await page.getByLabel("选择本领").selectOption(skill.value);
    const duration = Number(await page.getByRole("slider").getAttribute("max"));
    await page.waitForTimeout(duration + 300);
    records.push({ 模式: "正式控制器演武", 本领: skill.text, 视频起点毫秒: Date.now() - started - duration - 300, 播放毫秒: duration + 300 });
  }
  await page.getByLabel("演武方式").selectOption("clip");
  const clips = await page.locator("#clip option").evaluateAll(options => options.map(o => ({ value: o.value, text: o.textContent })));
  for (const facing of [{ value: "0", text: "正面" }, { value: "3", text: "侧面" }, { value: "1", text: "背面" }]) {
    await page.locator("#facing").selectOption(facing.value);
    for (const clip of clips) {
      await page.getByLabel("选择动作").selectOption(clip.value);
      const duration = Number(await page.getByRole("slider").getAttribute("max"));
      await page.waitForTimeout(duration + 100);
      records.push({ 模式: "主体动作", 方向: facing.text, 动作: clip.text, 视频起点毫秒: Date.now() - started - duration - 100, 播放毫秒: duration + 100 });
    }
  }
  if (errors.length) throw Error("录制页出现运行异常。");
  await page.screenshot({ path: root + "/last-frame.png" });
} catch (error) {
  errors.push(error.message);
  process.exitCode = 1;
} finally {
  const video = page.video();
  await context.close();
  if (video) await rename(await video.path(), root + "/skills-demo.webm");
  await browser.close();
  await writeFile(root + "/skills-demo.json", JSON.stringify({ 结果: errors.length ? "失败" : "已记录", 说明: "最终生产构建的独立演武页无声录像。真实界面依次播放十二技能和十八动作的三种方向，未改变游戏世界或用户存档；动作审美和设备声音仍需独立接受。", 入口SHA256: build.入口SHA256, 实际墙钟毫秒: Date.now() - started, 片段: records, 异常: errors }, null, 2) + "\n");
}
