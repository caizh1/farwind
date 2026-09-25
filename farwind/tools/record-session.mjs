import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import crypto from "node:crypto";
const stage = process.argv[2] ?? "after",
  dir = `docs/animation/round-three/${stage}`;
await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: `${dir}/raw`, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
const read = () => page.evaluate(() => window.__farwind());
const samples = [],
  events = [];
const hold = async (keys, ms) => {
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(ms);
  const state = await read();
  if (
    stage === "after" &&
    keys.includes("Shift") &&
    (keys.includes("s") || keys.includes("w"))
  )
    await page.screenshot({ path: `${dir}/moving-${keys.at(-1)}.png` });
  for (const k of [...keys].reverse()) await page.keyboard.up(k);
  events.push({ 按键: keys, 毫秒: ms, 状态: state });
  return state;
};
async function go(x, y) {
  for (const axis of ["x", "y"])
    for (let i = 0; i < 60; i++) {
      const p = (await read()).state.player,
        d = (axis === "x" ? x : y) - p[axis];
      if (Math.abs(d) < 4) break;
      await hold(
        [axis === "x" ? (d > 0 ? "d" : "a") : d > 0 ? "s" : "w"],
        Math.min(200, (Math.abs(d) / 150) * 1000),
      );
    }
}
await page.goto("http://127.0.0.1:5173/?animationDebug=1");
await page.getByRole("button", { name: "启程 · 新游戏" }).click();
await page.waitForTimeout(300);
await page.keyboard.down("Shift");
for (let n = 0; n < 30; n++) {
  const k = n % 2 ? "d" : "a";
  await page.keyboard.down(k);
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(50);
    const s = await read();
    samples.push({
      时间: Date.now(),
      体力: s.state.player.stamina,
      动画: s.animation,
      会话: s.session,
    });
  }
  await page.keyboard.up(k);
}
await page.keyboard.up("Shift");
await page.keyboard.press("j");
await page.waitForTimeout(400);
const before = await read();
await page.keyboard.press("Escape");
await page.getByRole("button", { name: "保存并返回标题" }).click();
await page.getByRole("button", { name: "继续旅途", exact: true }).click();
await page.keyboard.down("d");
await page.waitForTimeout(300);
const continued = await read();
await page.keyboard.up("d");
await page.waitForTimeout(500);
if (stage === "after") {
  await go(600, 620);
  await page.waitForTimeout(7200);
  for (const [keys, ms] of [
    [["Shift", "s"], 2000],
    [[], 2000],
    [["Shift", "w"], 2000],
    [[], 3500],
    [["d", "s"], 500],
    [["w", "a"], 500],
    [["d"], 700],
    [["a"], 700],
    [["Shift", "d"], 700],
    [["Shift", "a"], 700],
  ]) {
    await hold(keys, ms);
    if (keys.includes("Shift") && (keys.includes("s") || keys.includes("w")))
      await page.screenshot({ path: `${dir}/run-${keys.at(-1)}.png` });
  }
  await go(790, 790);
  await page.keyboard.press("e");
  await page.waitForTimeout(400);
  events.push({ 路径: "采集自然结束", 状态: await read() });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "保存并返回标题" }).click();
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  await page.getByRole("button", { name: "确认新游戏" }).click();
  await page.waitForTimeout(200);
  await hold(["d"], 300);
  events.push({ 路径: "同页确认新游戏后移动", 状态: await read() });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  await hold(["s"], 300);
  await page.keyboard.press("Tab");
  await page.waitForTimeout(400);
  await page.keyboard.press("Tab");
  await page.waitForTimeout(200);
  await page.keyboard.press("j");
  await page.waitForTimeout(80);
  await page.screenshot({ path: `${dir}/attack.png` });
  await page.waitForTimeout(400);
}
const video = page.video();
await ctx.close();
await video.saveAs(`${dir}/session-game.webm`);
await video.delete();
await browser.close();
const hashes = {};
for (const f of [
  "src/game/scenes/World.ts",
  "src/data/animation.ts",
  "src/game/systems/locomotion.ts",
  "src/game/systems/sprint.ts",
  "src/game/systems/session.ts",
  "src/game/systems/follower.ts",
  "src/game/entities/actor.ts",
  "public/assets/animation/round-three/hero-motion.png",
  "public/assets/animation/round-three/cat-motion.png",
])
  hashes[f] = crypto
    .createHash("sha256")
    .update(await fs.readFile(f))
    .digest("hex");
await fs.writeFile(
  `${dir}/session-record.json`,
  JSON.stringify(
    {
      说明: "有头Chrome，正常速度，真实按键持续Shift折返超过15秒；攻击自然结束后同页返回标题继续，未修改游戏状态",
      浏览器: browser.version(),
      阶段: stage,
      路径记录: events,
      摘要: hashes,
      采样: samples,
      返回前: before,
      同页继续: continued,
    },
    null,
    2,
  ),
);
console.log("记录完成", stage, continued.animation.hero.action);
