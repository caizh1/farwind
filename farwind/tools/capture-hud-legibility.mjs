import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
const directory = "docs/hud-redesign/after";
const original = JSON.parse(
  await readFile("docs/hud-redesign/before/measurements.json", "utf8"),
)[0].状态.state;
const browser = await chromium.launch({
  args: [
    "--enable-webgl",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("dialog", (d) => d.accept());
await page.goto("http://127.0.0.1:4185/");
await page.getByRole("button", { name: "启程 · 新游戏" }).click();
const records = [];
for (const [name, x, y, time] of [
  ["stone", 670, 720, 600],
  ["grass", 940, 1120, 600],
  ["water", 1280, 830, 600],
  ["night", 670, 720, 1200],
]) {
  const fixture = structuredClone(original);
  fixture.player.x = x;
  fixture.player.y = y;
  fixture.time = time;
  fixture.hotbar = [
    "potion",
    "berry",
    "herb",
    "wood",
    "stone",
    "charm",
    "crystal",
    "potion",
  ];
  fixture.bag = [
    ...fixture.hotbar.slice(0, 7).map((id) => ({ id, count: 12 })),
    ...Array(17).fill(null),
  ];
  await page.keyboard.press("Escape");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入存档", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "hud-legibility-fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await page.locator("#modal").waitFor({ state: "hidden" });
  await page.waitForFunction(
    (min) => window.__farwind().state.time > min + 0.1,
    time,
  );
  await page.locator("#minimap-toggle").click();
  await page.keyboard.press("Escape");
  await page.locator(".pause-panel").waitFor();
  const mask = await page.addStyleTag({
    content: "#modal,#toast,#menu-hint{visibility:hidden!important}",
  });
  await page.mouse.move(720, 400);
  await page.screenshot({ path: `${directory}/legibility-${name}.png` });
  const snapshot = await page.evaluate(() => ({
    状态: window.__farwind(),
    槽位: [...document.querySelectorAll("#hotbar button")].map((b) => ({
      名称: b.getAttribute("aria-label"),
      数字颜色: getComputedStyle(b.querySelector("strong")).color,
      热键颜色: getComputedStyle(b.querySelector("small")).color,
      底色: getComputedStyle(b).backgroundColor,
    })),
    视口: [innerWidth, innerHeight],
    像素倍率: devicePixelRatio,
  }));
  if (
    Math.abs(snapshot.状态.state.player.x - x) > 1 ||
    Math.abs(snapshot.状态.state.player.y - y) > 1
  )
    throw Error("可读性样本站位被修正");
  records.push({
    背景: name,
    ...snapshot,
    说明: "通过正式存档导入建立代表性光照与数量样本，只用于可读性；不作为任务/物品获取流程证明。",
  });
  if (name === "night") {
    // 基线夜色fillAlpha为0；此图仅为暗背景可读性模拟，不能冒充夜间运行效果。
    const dark = await page.addStyleTag({
      content:
        "#game::after{content:'';position:fixed;inset:0;background:rgb(23 60 88 / .22);pointer-events:none;z-index:1}#ui{z-index:2}",
    });
    await page.screenshot({
      path: "docs/hud-redesign/design/hud-night-legibility-preview.png",
    });
    await dark.evaluate((e) => e.remove());
  }
  await mask.evaluate((e) => e.remove());
  await page.keyboard.press("Escape");
  await page.locator("#minimap-toggle").click();
}
await writeFile(
  `${directory}/legibility.json`,
  JSON.stringify(records, null, 2),
);
const tiles = [];
for (const name of ["stone", "grass", "water", "night"]) {
  const buffer = await sharp(`${directory}/legibility-${name}.png`)
    .extract({ left: 490, top: 820, width: 460, height: 80 })
    .resize(920, 160)
    .toBuffer();
  tiles.push(buffer);
}
await sharp({
  create: { width: 920, height: 640, channels: 4, background: "#142b24" },
})
  .composite(tiles.map((input, i) => ({ input, left: 0, top: i * 160 })))
  .png()
  .toFile("docs/hud-redesign/comparison/legibility-hotbar.png");
console.log(
  records.map((r) => ({ 背景: r.背景, 玩家: r.状态.state.player, 错误: "无" })),
);
await browser.close();
