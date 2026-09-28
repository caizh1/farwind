import { chromium } from "@playwright/test";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const build = process.env.XIAOBAO_SOAK_BUILD ?? ".xiaobao-local/production",
  root = process.env.XIAOBAO_SOAK_ROOT ?? "docs/xiaobao/evidence/soak",
  duration = Number(process.env.XIAOBAO_SOAK_MS ?? 3600000),
  url = process.env.XIAOBAO_SOAK_URL ?? "http://127.0.0.1:5187/",
  followAfter = Number(process.env.XIAOBAO_SOAK_FOLLOW_AFTER_MS ?? Infinity);
await mkdir(root, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: [
    "--enable-gpu",
    "--use-gl=angle",
    "--use-angle=metal",
    "--ignore-gpu-blocklist",
    "--enable-precise-memory-info",
  ],
});
const info = await (
  await browser.newBrowserCDPSession()
).send("SystemInfo.getInfo");
const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  }),
  page = await context.newPage(),
  errors = [];
const index = await readFile(build + "/index.html", "utf8"),
  entry = index.match(/<script[^>]+src="([^"]+\.js)"/)?.[1];
const report = {
  说明: "真实生产浏览器、未加速模拟时间；通过新游戏和委托守村操作开始，中途真实切换随行并方向键散步，不注入战斗或杀敌状态。委托操作暂停时间单独扣除。呈现帧间隔与堆量不等同其他硬件。",
  要求时长毫秒: duration,
  GPU: info.gpu,
  浏览器: await browser.version(),
  入口SHA256: entry
    ? createHash("sha256")
        .update(await readFile(build + "/" + entry.slice(1)))
        .digest("hex")
    : null,
  操作: [],
  采样: [],
  错误: errors,
};
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(url);
  await page
    .getByRole("button", { name: "启程 · 新游戏", exact: true })
    .click();
  await page.waitForFunction(() => window.__farwind?.().mode === "");
  await page.locator("#xiaobao-summary").click();
  if (!(await page.getByRole("button", { name: "与我出征", exact: true }).isVisible()))
    throw Error("随行按钮预检失败，停止长测。");
  await page.getByRole("button", { name: "委托守村", exact: true }).click();
  await page.waitForFunction(
    () =>
      window.__farwind().state.xiaobao.task === "guard" &&
      window.__farwind().mode === "",
  );
  const meter = await context.newCDPSession(page);
  await meter.send("Performance.enable");
  await page.evaluate(() => {
    let last = performance.now();
    window.__xiaobaoFrameMeter = [];
    requestAnimationFrame(function tick(now) {
      window.__xiaobaoFrameMeter.push(now - last);
      last = now;
      requestAnimationFrame(tick);
    });
  });
  const started = Date.now();
  let next = 0,
    excluded = 0,
    following = false,
    nextWalk = followAfter + 300000;
  while (Date.now() - started - excluded < duration) {
    await page.waitForTimeout(1000);
    let active = Date.now() - started - excluded;
    if (!following && active >= followAfter) {
      const changeStart = Date.now();
      await page.locator("#xiaobao-summary").click();
      await page.getByRole("button", { name: "与我出征", exact: true }).click();
      await page.waitForFunction(
        () =>
          window.__farwind().state.xiaobao.task === "follow" &&
          window.__farwind().mode === "",
      );
      excluded += Date.now() - changeStart;
      following = true;
      report.操作.push({
        有效墙钟毫秒: active,
        操作: "真实界面从守村切换随行",
        扣除委托暂停毫秒: Date.now() - changeStart,
      });
    }
    if (following && active >= nextWalk) {
      nextWalk += 300000;
      for (const key of ["d", "s", "a", "w"]) {
        await page.keyboard.down(key);
        await page.waitForTimeout(1000);
        await page.keyboard.up(key);
      }
      report.操作.push({
        有效墙钟毫秒: active,
        操作: "真实方向键在村内方形散步，每边一秒",
      });
    }
    active = Date.now() - started - excluded;
    if (active < next) continue;
    next += 30000;
    const sample = await page.evaluate(() => {
      const d = window.__farwind(),
        f = window.__xiaobaoFrameMeter.splice(0).sort((a, b) => a - b),
        q = (p) => f[Math.min(f.length - 1, Math.floor(f.length * p))] ?? 0;
      return {
        模式: d.mode,
        隐藏: document.hidden,
        时间: d.state.time,
        小宝: d.xiaobao,
        事件序号: d.state.defense.sequence,
        结算序号: d.state.defense.completedSequence,
        守卫死亡: d.state.defense.guards.filter((g) => g.dead).length,
        帧数: f.length,
        帧间隔: {
          中位: q(0.5),
          九五: q(0.95),
          九九: q(0.99),
          最大: f.at(-1) ?? 0,
          超过33毫秒: f.filter((t) => t > 33.34).length,
        },
        对象: d.skillGrowth.objects,
        纹理: d.skillGrowth.textures,
        背包: d.state.bag,
        主线: d.state.quest,
      };
    });
    const metrics = (await meter.send("Performance.getMetrics")).metrics;
    sample.墙钟毫秒 = Date.now() - started;
    sample.有效墙钟毫秒 = active;
    sample.堆使用字节 =
      metrics.find((m) => m.name === "JSHeapUsedSize")?.value ?? null;
    sample.脚本累计CPU秒 =
      metrics.find((m) => m.name === "ScriptDuration")?.value ?? null;
    report.采样.push(sample);
    await writeFile(
      root + "/progress.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(
      "持续运行 " +
        Math.round(sample.墙钟毫秒 / 1000) +
        "秒，95分位 " +
        sample.帧间隔.九五.toFixed(1) +
        "毫秒，正式事件 " +
        sample.事件序号 +
        "/" +
        sample.结算序号,
    );
    if (sample.模式 !== "" || sample.隐藏) {
      report.暂停现场 = await page.evaluate(() => ({
        世界: window.__farwind(),
        吐司: document.querySelector("#toast")?.textContent,
      }));
      await page.screenshot({ path: root + "/failure.png" });
      throw Error(
        "页面暂停或隐藏，停止计为有效持续运行。首因世界快照和吐司已保留。",
      );
    }
    if (report.采样.length === 1)
      await page.screenshot({ path: root + "/start.png" });
  }
  report.实际墙钟毫秒 = Date.now() - started;
  report.扣除委托暂停毫秒 = excluded;
  report.实际有效时长毫秒 = report.实际墙钟毫秒 - excluded;
  await page.screenshot({ path: root + "/end.png" });
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "保存并返回标题", exact: true })
    .click();
  await page.waitForFunction(() => window.__farwind().mode === "title");
  await page.reload();
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  report.重载 = await page.evaluate(() => window.__farwind().state.xiaobao);
  report.结果 = errors.length ? "失败" : "通过";
} catch (error) {
  report.结果 = "失败";
  report.首因 = error.stack;
  process.exitCode = 1;
} finally {
  await writeFile(
    root + "/result.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  await browser.close();
}
