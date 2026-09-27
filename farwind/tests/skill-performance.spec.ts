import { test, expect, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { initialState } from "../src/game/systems/state";
import { completeWindLesson } from "../src/game/systems/skills";
import { LESSON_IDS } from "../src/data/windLessons";
const pond = process.env.FARWIND_SKILL_PERFORMANCE_SCENE === "pond";
const label = pond ? "池塘桥面" : "森林溪边";
const prefix = pond ? "performance" : "performance-stream";
const location = pond ? { x: 1090, y: 1120 } : { x: 2460, y: 980 };
const read = (p: Page) => p.evaluate(() => (window as any).__farwind());
async function load(page: Page, port: number, stage: number) {
  // 只增加读取渲染数量的观察入口；不改变游戏模拟、状态或表现。
  await page.route(/\/assets\/index-.*\.js$/, async (route) => {
    const response = await route.fetch(),
      body = await response.text();
    expect(body).toContain('Object.defineProperty(window,"__farwind",');
    await route.fulfill({
      response,
      body: body.replace(
        'Object.defineProperty(window,"__farwind",',
        'Object.defineProperty(window,"__windMetrics",{configurable:true,value:()=>({stage:this.combat.attack?.stage??0,objects:this.children.length,textures:this.textures.getTextureKeys().length,gpu:{buffers:this.game.renderer.glBufferWrappers.length,vaos:this.game.renderer.glVAOWrappers.length,programs:this.game.renderer.glProgramWrappers.length},water:this.swordWindView.water?.snapshot()})}),Object.defineProperty(window,"__farwind",',
      ),
    });
  });
  page.on("dialog", (d) => d.accept());
  await page.goto(`http://127.0.0.1:${port}/`);
  let s: any = initialState();
  Object.assign(s.player, location);
  s.time = 600;
  s.killed = [
    "slime-1",
    "slime-2",
    "leaf-1",
    "leaf-2",
    "spore-1",
    "boar-1",
    "raven-1",
  ];
  if (stage === 1) {
    s.schema_version = 6;
    s.skills = { swordWind: true };
  } else
    for (let i = 0; i < 5; i++) {
      if (i === 1) s.skills.devices.serialValve = 1;
      if (i === 2) s.skills.devices.leakClosed = true;
      if (i === 4) {
        s.skills.devices.splitLeft = 1;
        s.skills.devices.splitRight = 2;
      }
      s = completeWindLesson(s, LESSON_IDS[i]);
    }
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入存档" }).click();
  await (
    await chooser
  ).setFiles({
    name: "water-stress-fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(s)),
  });
  await page.waitForFunction(() => (window as any).__farwind().mode === "");
  await page.keyboard.press("d");
  await page.waitForTimeout(2000);
}
async function measure(page: Page) {
  const gpu = await page.evaluate(() => {
    const canvas = document.querySelector("canvas")!,
      gl = (canvas.getContext("webgl2") ||
        canvas.getContext("webgl")) as WebGLRenderingContext,
      ext = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      渲染器: ext
        ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER),
      供应商: ext
        ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)
        : gl.getParameter(gl.VENDOR),
    };
  });
  expect(gpu.渲染器).not.toMatch(/SwiftShader|llvmpipe/i);
  const sampling = page.evaluate(
    () =>
      new Promise<any>((resolve) => {
        const intervals: number[] = [],
          counts: any[] = [];
        let last = performance.now(),
          start = last;
        function frame(now: number) {
          intervals.push(now - last);
          last = now;
          counts.push((window as any).__windMetrics());
          if (now - start >= 22000) resolve({ intervals, counts });
          else requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      }),
  );
  for (let i = 0; i < 13; i++) {
    await page.keyboard.press("j");
    await page.waitForFunction(
      () => (window as any).__windMetrics().stage === 1,
    );
    await page.keyboard.press("j");
    await page.waitForFunction(
      () => (window as any).__windMetrics().stage === 2,
    );
    await page.keyboard.press("j");
    await page.waitForFunction(
      () => (window as any).__windMetrics().stage === 3,
    );
    await page.waitForFunction(() =>
      document
        .querySelector("#parry-status")
        ?.textContent?.includes("J 接第四击"),
    );
    await page.keyboard.press("j");
    await page.waitForTimeout(780);
  }
  const raw = await sampling;
  await page.waitForTimeout(1500);
  const idle = await page.evaluate(() => (window as any).__windMetrics());
  const sorted = [...raw.intervals].sort((a, b) => a - b);
  return {
    GPU: gpu,
    样本数: sorted.length,
    P50: sorted[Math.floor(sorted.length * 0.5)],
    P95: sorted[Math.floor(sorted.length * 0.95)],
    最大间隔: sorted.at(-1),
    对象峰值: Math.max(...raw.counts.map((s: any) => s.objects)),
    水迹峰值: Math.max(...raw.counts.map((s: any) => s.water?.active ?? 0)),
    水迹池峰值: Math.max(
      ...raw.counts.map((s: any) => s.water?.allocated ?? 0),
    ),
    空闲数量: idle,
    投影命中: (await read(page)).skillGrowth?.targets
      ?.filter((t: any) => t.id.startsWith("lesson-double-"))
      .map((t: any) => ({ 目标: t.id, 命中: t.hits })),
    原始间隔: raw.intervals,
    逐帧数量: raw.counts.map((s: any) => ({
      对象: s.objects,
      水迹: s.water?.active ?? 0,
      池: s.water?.allocated ?? 0,
      纹理: s.textures,
    })),
  };
}
test("原生GPU：冻结基线单剑风与三向划水压力场景", async ({ browser }) => {
  test.setTimeout(160000);
  const results: any = {},
    errors: string[] = [];
  for (const [name, port, stage] of [
    ["改动前", 4195, 1],
    ["改动后", 4196, 5],
  ] as const) {
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
      }),
      page = await context.newPage();
    page.on("pageerror", (e) => errors.push(name + ":" + e.message));
    await load(page, port, stage);
    results[name] = await measure(page);
    await page.screenshot({
      path: `docs/traveler-skills/evidence/${prefix}-${stage === 1 ? "before" : "after"}.png`,
    });
    await context.close();
  }
  const degradation = (results.改动后.P95 / results.改动前.P95 - 1) * 100;
  writeFileSync(
    `docs/traveler-skills/evidence/${prefix}.json`,
    JSON.stringify(
      {
        说明: `原生GPU、1280×720、同一${label}位置、同一输入节奏。固定导入状态屏蔽野怪干扰，不作为自然学习证据。冻结改动前生产构建与当前生产构建对比；保留全部帧间隔，不删除长帧。`,
        采样位置: location,
        结果: results,
        P95退化百分比: degradation,
        页面异常: errors,
      },
      null,
      2,
    ),
  );
  expect(errors).toEqual([]);
  if (!pond)
    expect(results.改动后.投影命中.every((t: any) => t.命中 > 1)).toBe(true);
  expect(results.改动后.水迹峰值).toBeGreaterThan(0);
  expect(results.改动后.水迹池峰值).toBeLessThanOrEqual(256);
  expect(results.改动后.空闲数量.water.active).toBe(0);
  expect(degradation).toBeLessThanOrEqual(10);
});
