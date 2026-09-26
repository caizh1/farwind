import { chromium } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import sharp from "sharp";
const directory = "docs/hud-redesign";
const baseline = JSON.parse(
  await readFile(`${directory}/before/measurements.json`, "utf8"),
);
const browser = await chromium.launch({
  args: [
    "--enable-webgl",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const records = [];
// 计算可见面板矩形并集；不计透明满宽父容器，不重复计子元素。
function union(rects) {
  const xs = [...new Set(rects.flatMap((r) => [r.x, r.x + r.width]))].sort(
    (a, b) => a - b,
  );
  let area = 0;
  for (let i = 1; i < xs.length; i++) {
    const rows = rects
      .filter((r) => r.x < xs[i] && r.x + r.width > xs[i - 1])
      .map((r) => [r.y, r.y + r.height])
      .sort((a, b) => a[0] - b[0]);
    let height = 0,
      end = -Infinity;
    for (const [a, b] of rows) {
      height += Math.max(0, b - Math.max(a, end));
      end = Math.max(end, b);
    }
    area += (xs[i] - xs[i - 1]) * height;
  }
  return area;
}
for (const before of process.argv.includes("--compare-only") ? [] : baseline) {
  const [width, height] = before.视口,
    dpr = before.像素倍率;
  const tag = `${width}x${height}-dpr${dpr}`;
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dpr,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  await page.goto(process.env.FARWIND_URL ?? "http://127.0.0.1:4185/");
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  await page.waitForFunction(
    (minute) => window.__farwind().state.time >= minute,
    Math.floor(before.状态.state.time),
  );
  await page.keyboard.press("Escape");
  await page.locator(".pause-panel").waitFor();
  const mask = await page.addStyleTag({
    content: "#modal,#toast,#menu-hint{visibility:hidden!important}",
  });
  const measured = await page.evaluate(() => ({
    视口: [innerWidth, innerHeight],
    像素倍率: devicePixelRatio,
    浏览器缩放: visualViewport.scale,
    状态: window.__farwind(),
    边界: Object.fromEntries(
      [
        ".bottom",
        "#hotbar",
        ".hud-info",
        ".location",
        ".quest-tracker",
        "#combat-status",
        ".vitals",
      ].map((sel) => {
        const r = document.querySelector(sel).getBoundingClientRect();
        return [sel, { x: r.x, y: r.y, width: r.width, height: r.height }];
      }),
    ),
  }));
  await page.screenshot({ path: `${directory}/after/default-${tag}.png` });
  const hideHud = await page.addStyleTag({
    content: "#hud{visibility:hidden!important}",
  });
  await page.screenshot({ path: `${directory}/after/background-${tag}.png` });
  await hideHud.evaluate((e) => e.remove());
  await mask.evaluate((e) => e.remove());
  await page.keyboard.press("Escape");
  await page.locator("#minimap-toggle").click();
  await page.locator("#quest-toggle").click();
  await page.locator("#hotbar button").nth(1).hover();
  const expandedMask = await page.addStyleTag({
    content: "#toast,#menu-hint{visibility:hidden!important}",
  });
  await page.screenshot({ path: `${directory}/after/expanded-${tag}.png` });
  const expanded = await page.evaluate(() =>
    Object.fromEntries(
      [".hud-info", ".location", ".quest-tracker", "#minimap"].map((sel) => {
        const r = document.querySelector(sel).getBoundingClientRect();
        return [sel, { x: r.x, y: r.y, width: r.width, height: r.height }];
      }),
    ),
  );
  if (width === 1440 && dpr === 1) {
    const data = await page.locator("#minimap").evaluate((c) => c.toDataURL());
    await writeFile(
      `${directory}/design/map.png`,
      Buffer.from(data.split(",")[1], "base64"),
    );
  }
  await expandedMask.evaluate((e) => e.remove());
  await page.locator("#minimap-toggle").click();
  await page.locator("#quest-toggle").click();
  await page.mouse.move(width / 2, 200);
  await page.keyboard.press("Escape");
  await page.locator(".pause-panel").waitFor();
  await page.screenshot({ path: `${directory}/after/pause-${tag}.png` });
  const pause = await page.locator(".pause-panel").evaluate((e) => {
    const r = e.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  const oldVisible = [
    "#hotbar",
    ".help",
    ".toolbar",
    ".location",
    ".quest-tracker",
  ].map((s) => before.边界[s]);
  const newVisible = [
    "#hotbar",
    ".location",
    ".quest-tracker",
    "#combat-status",
  ].map((s) => measured.边界[s]);
  records.push({
    ...measured,
    展开边界: expanded,
    暂停边界: pause,
    页面错误: errors,
    原底部高度: before.边界[".bottom"].height,
    新底部高度: measured.边界[".bottom"].height,
    高度减少百分比:
      100 *
      (1 - measured.边界[".bottom"].height / before.边界[".bottom"].height),
    原本轮范围覆盖并集: union(oldVisible),
    新本轮范围覆盖并集: union(newVisible),
    原右上面积: union([
      before.边界[".location"],
      before.边界[".quest-tracker"],
    ]),
    新右上面积: union([
      measured.边界[".location"],
      measured.边界[".quest-tracker"],
    ]),
    说明: "默认新游戏同站位；Esc冻结模拟，仅临时隐藏暂停层/提示。截图未修改世界、镜头、角色和游戏状态。折叠展开通过实际按钮。",
  });
  await context.close();
}
if (records.length)
  await writeFile(
    `${directory}/after/measurements.json`,
    JSON.stringify(records, null, 2),
  );
for (const [width, height] of process.argv.includes("--compare-only")
  ? []
  : [
      [1440, 900],
      [1280, 720],
    ]) {
  const p = await browser.newPage({ viewport: { width, height } });
  for (const mode of ["default", "expanded", "pause"]) {
    await p.goto(
      `http://127.0.0.1:5174/docs/hud-redesign/design/preview.html?mode=${mode}`,
    );
    await p.screenshot({
      path: `${directory}/design/hud-design-${mode}${width === 1280 ? "-1280x720" : ""}.png`,
    });
  }
  await p.close();
}
await mkdir(`${directory}/comparison`, { recursive: true });
for (const mode of ["default", "expanded", "pause"]) {
  const design = await sharp(
    `${directory}/design/hud-design-${mode}.png`,
  ).toBuffer();
  const actual = await sharp(
    `${directory}/after/${mode}-1440x900-dpr1.png`,
  ).toBuffer();
  await sharp({
    create: { width: 2880, height: 900, channels: 4, background: "#142b24" },
  })
    .composite([
      { input: design, left: 0, top: 0 },
      { input: actual, left: 1440, top: 0 },
    ])
    .png()
    .toFile(`${directory}/comparison/design-vs-runtime-${mode}.png`);
  const translucent = await sharp(actual)
    .removeAlpha()
    .ensureAlpha(0.5)
    .png()
    .toBuffer();
  await sharp(design)
    .composite([{ input: translucent, left: 0, top: 0 }])
    .png()
    .toFile(`${directory}/comparison/overlay-${mode}.png`);
}
await sharp({
  create: { width: 2880, height: 900, channels: 4, background: "#142b24" },
})
  .composite([
    {
      input: `${directory}/before/overview-1440x900-dpr1.png`,
      left: 0,
      top: 0,
    },
    {
      input: `${directory}/after/default-1440x900-dpr1.png`,
      left: 1440,
      top: 0,
    },
  ])
  .png()
  .toFile(`${directory}/comparison/before-vs-after.png`);
console.log(
  records.map((r) => ({
    视口: r.视口,
    倍率: r.像素倍率,
    道具: r.边界["#hotbar"],
    底部减少: r.高度减少百分比,
    原面积: r.原本轮范围覆盖并集,
    新面积: r.新本轮范围覆盖并集,
    错误: r.页面错误,
  })),
);
await browser.close();
