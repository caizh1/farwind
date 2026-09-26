import { test, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { move } from "./map-navigation";
import { clearMotionLine, motionBlocked } from "../src/game/systems/obstacles";
const directory = process.env.FARWIND_EVIDENCE_DIR ?? "docs/visual-polish/behavior";
const read = (page: Page) => page.evaluate(() => (window as any).__farwind());

async function inspectable(page: Page) {
  // 仅测试浏览器持有 Phaser 实例以读取纹理和执行正式 scene.restart；不增加产品调试入口。
  await page.route(/\/src\/main\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    expect(body).toContain('window.addEventListener("resize"');
    await route.fulfill({
      response,
      body: body.replace(
        'window.addEventListener("resize"',
        'window.__polishGame = game;\nwindow.addEventListener("resize"',
      ),
    });
  });
}

test("village-polish-movement", async ({ page }) => {
  await mkdir(directory, { recursive: true });
  await inspectable(page);
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
  await page.waitForFunction(() => (window as any).__polishGame);
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  const assets = await page.evaluate(() => {
    const scene = (window as any).__polishGame.scene.getScene("World");
    return ["carpenter-workbench", "plaza-fountain"].map((id) => {
      const im = scene.propImages.get(id);
      return {
        id,
        key: im.texture.key,
        src: im.texture.getSourceImage().src,
        position: [im.x, im.y],
        origin: [im.originX, im.originY],
        display: [im.displayWidth, im.displayHeight],
        depth: im.depth,
      };
    });
  });
  expect(assets[0]).toMatchObject({
    key: "carpenter-workbench",
    position: [412.5, 975],
    origin: [0.5, 1],
    display: [117, 66],
    depth: 975,
  });
  expect(assets[1]).toMatchObject({
    key: "fountain",
    position: [680, 890],
    origin: [0.5, 1],
    display: [130, 130],
    depth: 890,
  });
  // Phaser 通过XHR生成blob图片；对比实际加载像素，不能用blob URL推断资源路径。
  const matches = await page.evaluate(async () => {
    const scene = (window as any).__polishGame.scene.getScene("World");
    const results = [];
    for (const [key, file] of [
      ["carpenter-workbench", "carpenter-workbench"],
      ["fountain", "plaza-fountain"],
      ["pond-water", "pond-water"],
      ["water", null],
    ]) {
      const image = scene.textures.get(key).getSourceImage();
      const reference = await createImageBitmap(
        await (
          await fetch(
            file ? `/assets/village-polish/${file}.png` : "/assets/water.png",
          )
        ).blob(),
      );
      const pixels = (im: any) => {
        const c = document.createElement("canvas");
        c.width = image.width;
        c.height = image.height;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(im, 0, 0);
        return ctx.getImageData(0, 0, c.width, c.height).data;
      };
      const actual = pixels(image),
        expected = pixels(reference);
      results.push({
        key,
        相同: actual.every((n: number, i: number) => n === expected[i]),
        尺寸: [image.width, image.height],
      });
      reference.close();
    }
    return results;
  });
  expect(matches.every((r) => r.相同)).toBe(true);
  await page.evaluate(() => {
    (window as any).__polishTrace = [];
    (window as any).__polishTraceTimer = setInterval(() => {
      const s = (window as any).__farwind();
      (window as any).__polishTrace.push({
        时刻: s.session.sim,
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
    const snap = await read(page);
    expect(snap.companion.blocked).toBe(false);
    const order = await page.evaluate(() => {
      const scene = (window as any).__polishGame.scene.getScene("World");
      return { 玩家: scene.hero.sprite.depth, 黑猫: scene.cat.sprite.depth };
    });
    if (depth !== undefined) {
      if (name.endsWith("behind")) expect(order.玩家).toBeLessThan(depth);
      else expect(order.玩家).toBeGreaterThan(depth);
    }
    checkpoints.push({
      地点: name,
      玩家: snap.state.player,
      黑猫: snap.companion,
      排序: order,
      视口: page.viewportSize(),
    });
    await page.screenshot({ path: `${directory}/${name}.png` });
  }
  await checkpoint("fountain-behind", 680, 820, 890);
  await page.keyboard.down("s");
  await page.waitForTimeout(650);
  await page.keyboard.up("s");
  expect((await read(page)).state.player.y).toBeLessThanOrEqual(835.1);
  await checkpoint("fountain-front", 680, 920, 890);
  await checkpoint("workbench-behind", 420, 920, 975);
  await checkpoint("workbench-front", 420, 1010, 975);
  await move(page, 330, 1040);
  await expect.poll(async () => (await read(page)).target).toBe("carpenter");
  await page.keyboard.press("e");
  await expect(page.locator("#modal")).toContainText("阿禾");
  await page.screenshot({ path: `${directory}/carpenter-interaction.png` });
  await page.getByRole("button", { name: "继续 · E" }).click();
  await checkpoint("bridge-west-north", 1090, 910);
  await checkpoint("bridge-west-south", 1090, 1460);
  await checkpoint("bridge-south-bottom", 1310, 1490);
  await checkpoint("bridge-south-top", 1310, 1350);
  // 桥北端被池水封住，继续向北真实输入停在合法桥区。
  await page.keyboard.down("w");
  await page.waitForTimeout(800);
  await page.keyboard.up("w");
  expect((await read(page)).state.player.y).toBeGreaterThanOrEqual(1300);
  // 桥边界的保护测试结束后，真实退回桥面内再交给带6像素安全余量的导航。
  await page.keyboard.down("s");
  await page.waitForTimeout(300);
  await page.keyboard.up("s");
  await checkpoint("south-shore", 1460, 1490);
  await checkpoint("east-shore", 1600, 1120);
  await page.setViewportSize({ width: 1365, height: 853 });
  await checkpoint("north-shore-fractional", 1280, 830);
  await checkpoint("east-shore-fractional", 1600, 1120);
  await page.screenshot({ path: `${directory}/water-time-a.png` });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${directory}/water-time-b.png` });
  await page.keyboard.press("Escape");
  const trace = await page.evaluate(() => {
    clearInterval((window as any).__polishTraceTimer);
    return (window as any).__polishTrace;
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
  expect(errors).toEqual([]);
  await writeFile(
    `${directory}/movement-report.json`,
    JSON.stringify(
      {
        结果: "通过",
        正式资产: assets,
        加载像素核对: matches,
        路径: checkpoints,
        页面错误: errors,
        说明: "从新游戏开始，导航全部由真实键盘完成，无状态注入。",
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

test("village-polish-render-lifecycle", async ({ page }) => {
  await mkdir(directory, { recursive: true });
  await inspectable(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" || /already exists/.test(m.text()))
      errors.push(m.text());
  });
  await page.goto("/");
  await page.waitForFunction(() => (window as any).__polishGame);
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  const sampling = await page.evaluate(() => {
    const scene = (window as any).__polishGame.scene.getScene("World");
    const pixel = (x: number, y: number) => {
      const cx = Math.floor(x / 600) * 600,
        cy = Math.floor(y / 550) * 550;
      return [
        ...scene.textures
          .get(`ground-${cx}-${cy}`)
          .context.getImageData(x - cx, y - cy, 1, 1).data,
      ];
    };
    const edges = [];
    for (const [axis, edge] of [
      ["x", 1200],
      ["x", 1254],
      ["y", 1100],
      ["y", 1254],
    ] as const) {
      const jumps = [];
      for (let i = 0; i < 100; i++) {
        const x = axis === "x" ? edge : 1200 + i * 2,
          y = axis === "y" ? edge : 1000 + i * 2;
        const a = pixel(x - (axis === "x" ? 1 : 0), y - (axis === "y" ? 1 : 0)),
          b = pixel(x, y);
        jumps.push(
          a.slice(0, 3).reduce((n, v, k) => n + Math.abs(v - b[k]), 0) / 3,
        );
      }
      jumps.sort((a, b) => a - b);
      edges.push({
        轴: axis,
        位置: edge,
        相邻像素通道差中位数: jumps[50],
        百分位95: jumps[95],
      });
    }
    const stream = scene.textures.get("water").getSourceImage();
    return {
      边界: edges,
      河道纹理: { 尺寸: [stream.width, stream.height], 来源: stream.src },
      池塘纹理: scene.textures.get("pond-water").getSourceImage().src,
    };
  });
  expect(sampling.河道纹理.尺寸).toEqual([627, 627]);
  // 原水纹的逐像素加载核对在移动用例中执行。
  for (const edge of sampling.边界)
    expect(edge.相邻像素通道差中位数).toBeLessThan(4);
  const resources = () =>
    page.evaluate(() => {
      const scene = (window as any).__polishGame.scene.getScene("World");
      return {
        地表: scene.textures
          .getTextureKeys()
          .filter((k: string) => k.startsWith("ground-")).length,
        纹理: scene.textures.getTextureKeys().length,
        对象: scene.children.length,
        涟漪: scene.tweens.getTweens().length,
        缩放监听: scene.scale.listenerCount("resize"),
      };
    });
  await page.waitForFunction(
    () => (window as any).__farwind().session.sim > 300,
  );
  const before = await resources();
  expect(before.地表).toBe(28);
  expect(before.涟漪).toBe(2);
  await page.keyboard.press("Escape");
  await expect.poll(async () => (await read(page)).mode).toBe("pause");
  await page.waitForTimeout(100);
  const paused = await page.evaluate(() => {
    const s = (window as any).__polishGame.scene.getScene("World");
    return s.tweens.getTweens().map((t: any) => ({
      alpha: t.targets[0].alpha,
      scale: t.targets[0].scaleX,
    }));
  });
  await page.waitForTimeout(450);
  expect(
    await page.evaluate(() => {
      const s = (window as any).__polishGame.scene.getScene("World");
      return s.tweens.getTweens().map((t: any) => ({
        alpha: t.targets[0].alpha,
        scale: t.targets[0].scaleX,
      }));
    }),
  ).toEqual(paused);
  await page.evaluate(() => {
    (window as any).__polishGame.scene.getScene("World").scene.restart();
  });
  await expect(
    page.getByRole("button", { name: "继续旅途", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  await page.waitForTimeout(500);
  const after = await resources();
  expect(after.对象).toBeLessThanOrEqual(before.对象);
  expect({ ...after, 对象: 0 }).toEqual({ ...before, 对象: 0 });
  await page.screenshot({ path: `${directory}/scene-restarted.png` });
  expect(errors).toEqual([]);
  await writeFile(
    `${directory}/render-report.json`,
    JSON.stringify(
      {
        结果: "通过",
        采样: sampling,
        重启前: before,
        重启后: after,
        暂停: "水面涟漪alpha和尺寸冻结",
        页面错误: errors,
        说明: "连续性数字来自真实地表纹理；GPU非整数缩放仍以浏览器截图复核。",
      },
      null,
      2,
    ),
  );
});
