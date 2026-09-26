import { test, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { move } from "./map-navigation";
import { props } from "../src/data/world";
import { clearMotionLine, motionBlocked } from "../src/game/systems/obstacles";

const directory = "docs/visual-polish/orchard/behavior";
const read = (page: Page) => page.evaluate(() => (window as any).__farwind());
async function start(page: Page) {
  await mkdir(directory, { recursive: true });
  // 测试浏览器只读取 Phaser 实例并执行正式场景重启，不向产品增加调试接口。
  await page.route(/\/src\/main\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    expect(body).toContain('window.addEventListener("resize"');
    await route.fulfill({
      response,
      body: body.replace(
        'window.addEventListener("resize"',
        'window.__orchardGame = game;\nwindow.addEventListener("resize"',
      ),
    });
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" || /already exists/.test(m.text()))
      errors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.waitForFunction(() => (window as any).__orchardGame);
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  return errors;
}

test("orchard-polish-movement", async ({ page }) => {
  const errors = await start(page);
  const benches = props.filter((p) => p.art === "village-bench");
  expect(benches).toHaveLength(2);
  expect(
    benches.every((p) => p.role === "decoration" && !p.kind && !p.solid),
  ).toBe(true);
  await page.evaluate(() => {
    (window as any).__orchardTrace = [];
    (window as any).__orchardTimer = setInterval(() => {
      const s = (window as any).__farwind();
      (window as any).__orchardTrace.push({
        玩家: s.state.player,
        黑猫: s.companion,
      });
    }, 50);
  });
  const checkpoints: any[] = [];
  async function checkpoint(
    name: string,
    x: number,
    y: number,
    depth?: number,
  ) {
    await move(page, x, y);
    await page.waitForTimeout(700);
    const snapshot = await read(page);
    expect(snapshot.companion.blocked).toBe(false);
    const order = await page.evaluate(() => {
      const scene = (window as any).__orchardGame.scene.getScene("World");
      return { 玩家: scene.hero.sprite.depth, 黑猫: scene.cat.sprite.depth };
    });
    expect(order.玩家).toBeCloseTo(snapshot.state.player.y, 4);
    expect(order.黑猫).toBeCloseTo(snapshot.companion.y, 4);
    if (depth !== undefined) {
      if (name.endsWith("behind")) expect(order.玩家).toBeLessThan(depth);
      else expect(order.玩家).toBeGreaterThan(depth);
    }
    checkpoints.push({
      地点: name,
      玩家: snapshot.state.player,
      黑猫: snapshot.companion,
      排序: order,
      视口: page.viewportSize(),
    });
    await page.screenshot({ path: `${directory}/${name}.png` });
  }
  await checkpoint("flower-bed-north", 330, 1460);
  await checkpoint("flower-bed-east", 455, 1510);
  await checkpoint("flower-bed-south", 330, 1580);
  await checkpoint("flower-bed-west", 245, 1510);
  // 花床仍为可通行地面装饰，不因图片外框新增阻挡。
  await checkpoint("flower-bed-crossing", 330, 1530);
  await move(page, 490, 1290);
  await expect
    .poll(async () => (await read(page)).target)
    .toBe("orchard-berry-1");
  await page.keyboard.press("e");
  await expect
    .poll(async () => (await read(page)).state.collected["orchard-berry-1"])
    .toBeDefined();
  await page.screenshot({ path: `${directory}/berry-interaction.png` });
  await move(page, 580, 1510);
  await expect
    .poll(async () => (await read(page)).target)
    .toBe("village-chest");
  await page.keyboard.press("e");
  await expect
    .poll(async () => (await read(page)).state.chests)
    .toContain("village-chest");
  await page.screenshot({ path: `${directory}/chest-interaction.png` });
  await checkpoint("west-bench-behind", 940, 1340, 1380);
  await checkpoint("west-bench-front", 940, 1480, 1380);
  await checkpoint("west-bridge-south", 1090, 1460);
  await checkpoint("west-bridge-north", 1090, 910);
  await page.setViewportSize({ width: 1365, height: 853 });
  await checkpoint("east-bench-behind", 1570, 1320, 1350);
  await checkpoint("east-bench-front", 1570, 1480, 1350);
  await checkpoint("south-bridge-south", 1310, 1490);
  await checkpoint("south-bridge-north", 1310, 1350);
  await checkpoint("flower-bed-fractional", 455, 1510);
  await page.keyboard.press("Escape");
  await expect.poll(async () => (await read(page)).mode).toBe("pause");
  const trace = await page.evaluate(() => {
    clearInterval((window as any).__orchardTimer);
    return (window as any).__orchardTrace;
  });
  expect(
    trace.every(
      (s: any) => !s.黑猫.blocked && !motionBlocked(s.玩家.x, s.玩家.y),
    ),
  ).toBe(true);
  for (let i = 1; i < trace.length; i++) {
    expect(clearMotionLine(trace[i - 1].玩家, trace[i].玩家)).toBe(true);
    expect(clearMotionLine(trace[i - 1].黑猫, trace[i].黑猫)).toBe(true);
  }
  for (const bench of benches) {
    const near = trace.filter((s: any) => Math.abs(s.黑猫.x - bench.x) < 80);
    expect(near.some((s: any) => s.黑猫.y < bench.y)).toBe(true);
    expect(near.some((s: any) => s.黑猫.y > bench.y)).toBe(true);
  }
  expect(errors).toEqual([]);
  await writeFile(
    `${directory}/movement-report.json`,
    JSON.stringify(
      {
        结果: "通过",
        说明: "从新游戏开始，所有路线及采集/宝箱交互通过真实键盘输入完成。",
        路径: checkpoints,
        页面错误: errors,
      },
      null,
      2,
    ),
  );
  await writeFile(
    `${directory}/movement-trace.json`,
    JSON.stringify(trace, null, 2),
  );
});

test("orchard-polish-assets-lifecycle", async ({ page }) => {
  const errors = await start(page);
  const render = await page.evaluate(async () => {
    const scene = (window as any).__orchardGame.scene.getScene("World");
    const assets = [];
    for (const key of ["orchard-flower-bed", "village-bench"]) {
      const image = scene.textures.get(key).getSourceImage();
      const reference = await createImageBitmap(
        await (await fetch(`/assets/village-polish/${key}.png`)).blob(),
      );
      const pixels = (im: any) => {
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(im, 0, 0);
        return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      };
      const actual = pixels(image),
        expected = pixels(reference);
      assets.push({
        ID: key,
        尺寸: [image.width, image.height],
        加载像素相同: actual.every((n: number, i: number) => n === expected[i]),
      });
      reference.close();
    }
    const canvas = document.createElement("canvas");
    canvas.width = 210;
    canvas.height = 80;
    const ground = scene.textures.get("ground-0-1100").context;
    // Phaser地表使用willReadFrequently；统一CPU/GPU画布路径，避免缩小滤波差异。
    const ctx = canvas.getContext("2d", ground.getContextAttributes())!;
    ctx.imageSmoothingEnabled = ground.imageSmoothingEnabled;
    ctx.imageSmoothingQuality = ground.imageSmoothingQuality;
    ctx.drawImage(
      scene.textures.get("orchard-flower-bed").getSourceImage(),
      0,
      0,
      210,
      80,
    );
    const expected = ctx.getImageData(0, 0, 210, 80).data;
    const actual = ground.getImageData(230, 380, 210, 80).data;
    let samples = 0,
      matches = 0;
    for (let i = 0; i < expected.length; i += 4) {
      // 原图主体alpha主要为252–253；允许由真实alpha合成产生的最大RGB偏差。
      if (expected[i + 3] < 250) continue;
      samples++;
      if (
        [0, 1, 2].every(
          (k) =>
            Math.abs(expected[i + k] - actual[i + k]) <=
            255 - expected[i + 3] + 2,
        )
      )
        matches++;
    }
    const benches = ["pond-bench-west", "pond-bench-east"].map((id) => {
      const im = scene.propImages.get(id);
      return {
        ID: id,
        纹理: im.texture.key,
        位置: [im.x, im.y],
        显示尺寸: [im.displayWidth, im.displayHeight],
        锚点: [im.originX, im.originY],
        深度: im.depth,
      };
    });
    return {
      资产: assets,
      花床地面核对: {
        样本: samples,
        相同: matches,
        采样平滑: ctx.imageSmoothingEnabled,
        采样质量: ctx.imageSmoothingQuality,
      },
      长椅: benches,
    };
  });
  await writeFile(
    `${directory}/pixel-diagnostic.json`,
    JSON.stringify(render, null, 2),
  );
  expect(render.资产.every((r) => r.加载像素相同)).toBe(true);
  expect(render.资产.map((r) => r.尺寸)).toEqual([
    [630, 240],
    [270, 150],
  ]);
  expect(render.花床地面核对.样本).toBeGreaterThan(1000);
  expect(render.花床地面核对.相同 / render.花床地面核对.样本).toBeGreaterThan(
    0.95,
  );
  expect(render.长椅).toEqual([
    {
      ID: "pond-bench-west",
      纹理: "village-bench",
      位置: [940, 1380],
      显示尺寸: [90, 50],
      锚点: [0.5, 1],
      深度: 1380,
    },
    {
      ID: "pond-bench-east",
      纹理: "village-bench",
      位置: [1540, 1350],
      显示尺寸: [90, 50],
      锚点: [0.5, 1],
      深度: 1350,
    },
  ]);
  const resources = () =>
    page.evaluate(() => {
      const scene = (window as any).__orchardGame.scene.getScene("World");
      return {
        地表: scene.textures
          .getTextureKeys()
          .filter((k: string) => k.startsWith("ground-")).length,
        纹理: scene.textures.getTextureKeys().length,
        长椅: [...scene.propImages.values()].filter(
          (im: any) => im.texture.key === "village-bench",
        ).length,
        缩放监听: scene.scale.listenerCount("resize"),
      };
    });
  const before = await resources();
  expect(before.地表).toBe(28);
  expect(before.长椅).toBe(2);
  await page.evaluate(() =>
    (window as any).__orchardGame.scene.getScene("World").scene.restart(),
  );
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  await page.waitForTimeout(500);
  const after = await resources();
  expect(after).toEqual(before);
  await page.screenshot({ path: `${directory}/scene-restarted.png` });
  expect(errors).toEqual([]);
  await writeFile(
    `${directory}/render-report.json`,
    JSON.stringify(
      {
        结果: "通过",
        正式渲染: render,
        重启前: before,
        重启后: after,
        页面错误: errors,
      },
      null,
      2,
    ),
  );
});
