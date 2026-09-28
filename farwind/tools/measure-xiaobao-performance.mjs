import { chromium } from "@playwright/test";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

// 单独的丢弃式浏览器测量，不修改用户存档或生产构建。
const build = process.env.XIAOBAO_PERFORMANCE_BUILD ?? ".xiaobao-local/delivery-ready";
const root = process.env.XIAOBAO_PERFORMANCE_ROOT ?? "docs/xiaobao/evidence/performance-ready";
const url = process.env.XIAOBAO_PERFORMANCE_URL ?? "http://127.0.0.1:5193/";
const assets = await readdir(build + "/assets");
const shared = assets.find((name) => /^xiaobaoView-.*\.js$/.test(name));
const index = await readFile(build + "/index.html", "utf8");
const entry = index.match(/<script[^>]+src="([^"]+\.js)"/)?.[1];
await mkdir(root, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: [
    "--enable-gpu",
    "--use-gl=angle",
    "--use-angle=metal",
    "--ignore-gpu-blocklist",
  ],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
});
const page = await context.newPage();
const report = {
  说明: "相同最终构建、设备、页面尺寸；真实新游戏委托后计量。无同伴基线仅在本测量页暂时断开World的小宝引用，排除其推进与显示，但不卸载图集。隔离操作只服务性能对照，不计作功能或战斗验收。",
  方法边界:
    "CDP脚本CPU增量除以呈现帧数估计平均总开销。逐帧累积正式核心tick，以及整个World.update同步CPU时间；后者包含所有角色和世界推进、环境投影、显示绘制调用及声音，作为同步新增逻辑的保守上界。异步存档回调、Phaser后续渲染与GPU不在此上界内。不同阶段场景演进会引入误差，负差值不解释为提升。",
  入口SHA256: createHash("sha256")
    .update(await readFile(build + "/" + entry.slice(1)))
    .digest("hex"),
  浏览器: await browser.version(),
  GPU: (await (await browser.newBrowserCDPSession()).send("SystemInfo.getInfo"))
    .gpu.devices,
  阶段: [],
  错误: [],
};
page.on("pageerror", (error) => report.错误.push(error.message));
try {
  await page.goto(url);
  await page
    .getByRole("button", { name: "启程 · 新游戏", exact: true })
    .click();
  await page.waitForFunction(() => window.__farwind?.().mode === "");
  await page.locator("#xiaobao-summary").click();
  await page.getByRole("button", { name: "委托守村", exact: true }).click();
  await page.waitForFunction(
    () =>
      window.__farwind().state.xiaobao.task === "guard" &&
      window.__farwind().mode === "",
  );
  report.仪器 = await page.evaluate(async (shared) => {
    const exports = await import("/assets/" + shared);
    const view = Object.values(exports).find(
      (value) =>
        typeof value === "function" &&
        value.prototype?.render &&
        value.prototype?.drawSkills &&
        value.prototype?.open,
    );
    if (!view) throw Error("正式显示模块缺失，拒绝伪造测量。");
    const originalRender = view.prototype.render;
    await new Promise((resolve) => {
      view.prototype.render = function (...args) {
        window.__xiaobaoMeterWorld = this.sprite.scene;
        view.prototype.render = originalRender;
        resolve();
        return originalRender.apply(this, args);
      };
    });
    window.__xiaobaoMeterView = window.__xiaobaoMeterWorld.xiaobao;
    // 构建只导出共用显示类；控制器由实际显示实例取得，避免假定内部类有命名导出。
    const controller = Object.getPrototypeOf(
      window.__xiaobaoMeterView.controller,
    );
    if (!controller.tick || !controller.confirmFlight)
      throw Error("正式控制器实例缺失，拒绝伪造测量。");
    window.__xiaobaoMeter = [];
    let cost = 0,
      worldCost = 0,
      calls = 0,
      worldCalls = 0,
      last = performance.now();
    // Phaser创建场景时缓存update，实际Systems.step调用sys.sceneUpdate。
    const world = window.__xiaobaoMeterWorld, originalUpdate = world.sys.sceneUpdate;
    world.sys.sceneUpdate = function (...args) {
      const before = performance.now();
      try { return originalUpdate.apply(this, args); }
      finally { worldCost += performance.now() - before; worldCalls++; }
    };
    const originalTick = controller.tick;
    controller.tick = function (...args) {
      const before = performance.now();
      try {
        return originalTick.apply(this, args);
      } finally {
        cost += performance.now() - before;
        calls++;
      }
    };
    requestAnimationFrame(function collect(now) {
      window.__xiaobaoMeter.push({ frame: now - last, core: cost, calls, world: worldCost, worldCalls });
      cost = 0;
      worldCost = 0;
      calls = 0;
      worldCalls = 0;
      last = now;
      requestAnimationFrame(collect);
    });
    let overhead = 0;
    for (let i = 0; i < 10000; i++) {
      const before = performance.now();
      overhead += performance.now() - before;
    }
    return {
      包装方法: "正式tick及整个World.update同步推进，原方法、返回值与状态保持",
      空计时平均毫秒: overhead / 10000,
    };
  }, shared);
  const meter = await context.newCDPSession(page);
  await meter.send("Performance.enable");
  const cpu = async () =>
    (await meter.send("Performance.getMetrics")).metrics.find(
      (value) => value.name === "ScriptDuration",
    ).value;
  const measure = async (name) => {
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.__xiaobaoMeter.splice(0));
    const startCPU = await cpu(),
      started = Date.now();
    await page.waitForTimeout(30000);
    const endCPU = await cpu();
    const result = await page.evaluate(() => {
      const data = window.__xiaobaoMeter.splice(0);
      const core = data.map((value) => value.core).sort((a, b) => a - b);
      const world = data.map((value) => value.world).sort((a, b) => a - b);
      const frames = data.map((value) => value.frame).sort((a, b) => a - b);
      const q = (values, p) =>
        values[Math.min(values.length - 1, Math.floor(values.length * p))] ?? 0;
      const state = window.__farwind();
      return {
        帧数: data.length,
        核心时间片: data.reduce((sum, value) => sum + value.calls, 0),
        核心平均毫秒: core.reduce((sum, value) => sum + value, 0) / data.length,
        核心九九毫秒: q(core, 0.99),
        核心最大毫秒: core.at(-1),
        世界调用次数: data.reduce((sum, value) => sum + value.worldCalls, 0),
        整个世界同步平均毫秒: world.reduce((sum, value) => sum + value, 0) / data.length,
        整个世界同步九九毫秒: q(world, 0.99),
        整个世界同步最大毫秒: world.at(-1),
        帧九五毫秒: q(frames, 0.95),
        帧九九毫秒: q(frames, 0.99),
        模式: state.mode,
        事件: state.state.defense.sequence,
        对象: state.skillGrowth.objects,
        纹理: state.skillGrowth.textures,
        任务: state.state.xiaobao.task,
      };
    });
    Object.assign(result, {
      名称: name,
      墙钟毫秒: Date.now() - started,
      脚本CPU毫秒: (endCPU - startCPU) * 1000,
      脚本CPU平均每帧毫秒: ((endCPU - startCPU) * 1000) / result.帧数,
    });
    if (result.模式 !== "" || result.事件 !== 0)
      throw Error("性能对照受到暂停或正式战斗影响，不能比较。");
    if (result.世界调用次数 < result.帧数 * .8)
      throw Error("世界推进计量未进入正式调用链，拒绝将零值作为性能通过。");
    report.阶段.push(result);
    console.log(
      name +
        "：脚本CPU平均 " +
        result.脚本CPU平均每帧毫秒.toFixed(3) +
        "毫秒，核心99分位 " +
        result.核心九九毫秒.toFixed(3) +
        "毫秒。",
    );
  };
  await page.evaluate(() => {
    const view = window.__xiaobaoMeterView;
    for (const key of ["sprite", "shadow", "label", "wind", "floor", "effects"])
      view[key].setVisible(false);
    window.__xiaobaoMeterWorld.xiaobao = undefined;
  });
  await measure("无同伴推进基线");
  await page.evaluate(() => {
    window.__xiaobaoMeterWorld.xiaobao = window.__xiaobaoMeterView;
  });
  await measure("正式守村");
  await page.locator("#xiaobao-summary").click();
  await page.getByRole("button", { name: "与我出征", exact: true }).click();
  await page.waitForFunction(
    () =>
      window.__farwind().state.xiaobao.task === "follow" &&
      window.__farwind().mode === "",
  );
  await measure("正式随行");
  const baseline = report.阶段[0].脚本CPU平均每帧毫秒;
  report.平均脚本CPU差 = report.阶段.slice(1).map((value) => ({
    名称: value.名称,
    毫秒: value.脚本CPU平均每帧毫秒 - baseline,
  }));
  report.结果 = report.错误.length ? "失败" : "计量完成";
  report.完整新增逻辑指标 = "未最终验收；核心tick时间和整个世界的同步上界不能代替完整新增逻辑的独立计量。";
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
