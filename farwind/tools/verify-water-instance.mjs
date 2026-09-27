import { chromium } from "@playwright/test";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { startWater, readWater } from "../tests/water-navigation.ts";

// 默认缩放、正常HUD、实际5173服务；独立上下文不改用户浏览器存档。
const directory = "docs/water-effects/instance-5173";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ["--use-angle=metal", "--ignore-gpu-blocklist"] });
const records = [];
try {
  for (const [width, height, dpr] of [[1280, 800, 1], [1920, 1080, 1.5]]) {
    const tag = `${width}x${height}-dpr${dpr}`;
    const context = await browser.newContext({ baseURL: process.env.FARWIND_URL ?? "http://127.0.0.1:5173", viewport: { width, height }, deviceScaleFactor: dpr,
      recordVideo: { dir: ".water-local/instance-5173-video", size: { width, height } } });
    const videoStart = Date.now(), page = await context.newPage();
    try {
      const errors = await startWater(page);
      await page.bringToFront();
      await page.evaluate(() => window.__waterGame.scene.getScene("World").cameras.main.stopFollow());
      const state = await readWater(page), factor = width / 1280 * dpr;
      const rect = (x, y, w, h) => ({ left: Math.round((x - state.camera.x) * factor), top: Math.round((y - state.camera.y) * factor), width: Math.round(w * factor), height: Math.round(h * factor) });
      const regions = { 喷泉流水: rect(647, 789, 69, 63), 池塘中心: rect(1240, 1090, 110, 42), 石质前池沿: rect(638, 860, 85, 18), 桥面: rect(1045, 920, 75, 130) };
      const start = Date.now(), frames = [], times = [];
      for (let i = 0; i < 4; i++) {
        if (i) await page.waitForTimeout(2300);
        frames.push(await page.screenshot({ path: `${directory}/${tag}-time-${i}.png` }));
        times.push((await readWater(page)).water);
      }
      const differences = [];
      for (let i = 1; i < frames.length; i++) {
        const result = {};
        for (const [name, area] of Object.entries(regions)) {
          const a = await sharp(frames[i - 1]).extract(area).removeAlpha().raw().toBuffer();
          const b = await sharp(frames[i]).extract(area).removeAlpha().raw().toBuffer();
          let changed = 0, distinct = 0, total = 0;
          for (let j = 0; j < a.length; j += 3) {
            const difference = Math.abs(a[j] - b[j]) + Math.abs(a[j + 1] - b[j + 1]) + Math.abs(a[j + 2] - b[j + 2]);
            if (difference > 6) changed++;
            if (difference > 18) distinct++;
            total += difference;
          }
          result[name] = { 变化比例: changed / (a.length / 3), 明显差异比例: distinct / (a.length / 3), 平均通道差: total / a.length };
        }
        differences.push(result);
      }
      const duration = (Date.now() - start) / 1000, video = page.video();
      await context.close();
      const encoding = spawnSync("/opt/homebrew/bin/ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", String((start - videoStart) / 1000), "-i", await video.path(), "-t", String(duration), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-movflags", "+faststart", `${directory}/${tag}.mp4`]);
      if (encoding.status !== 0) throw new Error(encoding.stderr.toString());
      const passed = differences.every(d => d.喷泉流水.明显差异比例 > 0.03 && d.池塘中心.明显差异比例 > 0.015 && d.喷泉流水.平均通道差 > 0.75 && d.池塘中心.平均通道差 > 0.35 && d.石质前池沿.变化比例 === 0 && d.桥面.变化比例 === 0) && !errors.length && times.at(-1).time > times[0].time;
      records.push({ 服务: "5173当前工作区", 视口: [width, height], 像素密度: dpr, 相机: state.camera, 差异: differences, 水效相位: times.map(t => ({ 环境时间: t.time, 流水偏移: t.flowOffset, 是否推进: t.running })), 录屏秒数: duration, 错误: errors, 结果: passed ? "通过" : "失败" });
      if (!passed) throw new Error("实际5173水效或静态控制检查失败");
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  await writeFile(`${directory}/default-view-results.json`, JSON.stringify({ 说明: "实际5173，正常HUD与默认缩放，四时刻间隔2.3秒。只裁去录屏初始化菜单，没有补画或插帧。数字证明动画和遮挡，观感以实际录屏另行复核。", 记录: records }, null, 2));
}
console.log("实际5173默认视口截图、录屏与静态遮挡检查通过");
