import { chromium } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const url = process.env.FARWIND_URL ?? "http://127.0.0.1:4199/",
  root = "docs/village-interiors/after";
await mkdir(root, { recursive: true });
const baseline = JSON.parse(
  await readFile("docs/village-houses/before/record.json", "utf8"),
).状态.state;
const rooms = [
  ["old-home", 330, 650],
  ["elder-home", 550, 650],
  ["carpenter-home", 310, 900],
  ["south-home", 330, 1190],
  ["general-shop", 900, 1010],
  ["wood-workshop", 530, 1410],
  ["smith-shop", 800, 1440],
  ["healer-home", 1110, 460],
  ["barracks", 1995, 650],
  ["inn", 1550, 1640],
];
const browser = await chromium.launch({
  args: ["--enable-webgl", "--use-angle=metal"],
});
const records = [];
let activePage, activeSpace;
const requested = process.env.FARWIND_ROOM;
const read = (page) => page.evaluate(() => window.__farwind());
async function importState(page, state) {
  await page.goto(url);
  await page.getByRole("button", { name: "导入存档", exact: true }).waitFor();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入存档", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "room-location.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(state)),
  });
  await page.waitForFunction(() => window.__farwind?.().mode === "");
}
async function walk(page, key, predicate) {
  await page.keyboard.down(key);
  try {
    await page.waitForFunction(predicate, {}, { timeout: 7000 });
  } finally {
    await page.keyboard.up(key);
  }
}
try {
  for (const [space, x, y] of rooms.filter(
    (r) => !requested || r[0] === requested,
  )) {
    activeSpace = space;
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
      }),
      page = await context.newPage(),
      errors = [];
    activePage = page;
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    const s = structuredClone(baseline);
    s.life.playerSpace = "village";
    s.player.x = x;
    s.player.y = y + 35;
    await importState(page, s);
    await page.keyboard.press("e");
    await page.waitForTimeout(250);
    if((await read(page)).mode === "shop") await page.locator("#shop-enter").click();
    if ((await read(page)).mode === "dialog") {
      await page.keyboard.press("Escape");
      await page.keyboard.press("e");
    }
    await page.waitForFunction(
      (space) => window.__farwind().state.life.playerSpace === space,
      space,
    );
    await walk(page, "d", () => window.__farwind().state.player.x >= 820);
    await walk(page, "w", () => window.__farwind().state.player.y <= 835);
    const indoor = await read(page);
    assert.equal(indoor.state.life.playerSpace, space);
    assert.ok(indoor.npcLifeView.furniture.length >= 3);
    assert.deepEqual(errors, []);
    await page.keyboard.press("Escape");
    await page.addStyleTag({
      content: "#modal,#toast{visibility:hidden!important}",
    });
    await page.screenshot({ path: `${root}/${space}.png` });
    await page
      .locator("style")
      .last()
      .evaluate((e) => e.remove());
    await page.keyboard.press("Escape");
    if (space === "general-shop") {
      assert.equal((await read(page)).target, "interior:general-shop:counter");
      await page.keyboard.press("e");
      await page.locator(".shop-panel").waitFor();
      await page.locator('[data-item="bread"]').click();
      await page.screenshot({ path: `${root}/shop-desktop.png` });
      const before = (await read(page)).state;
      await page.locator("#shop-review").click();
      await page.locator("#shop-confirm").click();
      await page.getByText("交易已完成并保存。", { exact: true }).waitFor();
      const after = (await read(page)).state;
      assert.equal(after.coins, before.coins - 7);
      assert.equal(
        after.shopStock["general:bread"],
        before.shopStock["general:bread"] - 1,
      );
      assert.equal(
        after.bag
          .filter(Boolean)
          .filter((a) => a.id === "bread")
          .reduce((n, a) => n + a.count, 0),
        1,
      );
      await page.screenshot({ path: `${root}/shop-purchase.png` });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({
        path: `${root}/shop-mobile.png`,
        fullPage: true,
      });
      const overflow = await page
        .locator(".shop-panel")
        .evaluate((e) => ({
          宽度: e.scrollWidth,
          显示: e.clientWidth,
          页面: document.documentElement.scrollWidth,
          视口: innerWidth,
        }));
      assert.ok(
        overflow.宽度 <= overflow.显示 + 2 && overflow.页面 <= overflow.视口,
        JSON.stringify(overflow),
      );
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.locator("#close").click();
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "保存旅途", exact: true }).click();
      await page.waitForTimeout(250);
    if((await read(page)).mode === "shop") await page.locator("#shop-enter").click();
      await page.reload();
      await page.getByRole("button", { name: "继续旅途", exact: true }).click();
      await page.waitForFunction(() => window.__farwind?.().mode === "");
      const reloaded = (await read(page)).state;
      assert.equal(reloaded.coins, after.coins);
      assert.equal(
        reloaded.shopStock["general:bread"],
        after.shopStock["general:bread"],
      );
      records.push({
        房间: space,
        实际进屋: true,
        家具: indoor.npcLifeView.furniture,
        交易: {
          之前: before.coins,
          之后: after.coins,
          重载: reloaded.coins,
          库存: reloaded.shopStock["general:bread"],
          窄屏: overflow,
        },
        页面错误: errors,
      });
    } else
      records.push({
        房间: space,
        实际进屋: true,
        家具: indoor.npcLifeView.furniture,
        页面错误: errors,
      });
    // 从柜台走回南门，再按E退出，验证进入不损坏离开路径。
    await walk(page, "s", () => window.__farwind().state.player.y >= 909);
    await walk(page, "a", () => window.__farwind().state.player.x <= 705);
    await page.keyboard.press("e");
    await page.waitForFunction(
      () => window.__farwind().state.life.playerSpace === "village",
    );
    await context.close();
  }
  await writeFile(
    `${root}/record.json`,
    JSON.stringify(
      {
        说明: "隔离端口的当前生产构建；正式导入仅建立合法站位，随后使用真实键盘进出与鼠标购买，不改写运行状态。",
        地址: url,
        房间数: records.length,
        记录: records,
      },
      null,
      2,
    ),
  );
  console.log("十个室内进出、柜台购买、刷新重载与窄屏检查通过。");
} catch (e) {
  await activePage?.screenshot({ path: `${root}/failure.png` });
  await writeFile(
    `${root}/failure.json`,
    JSON.stringify(
      {
        说明: "首次失败的现场证据；保留实际状态和页面文字用于根因定位。",
        房间: activeSpace,
        错误: String(e),
        状态: activePage ? await read(activePage) : null,
        页面: activePage ? await activePage.locator("body").innerText() : null,
        已完成: records,
      },
      null,
      2,
    ),
  );
  throw e;
} finally {
  await browser.close();
}
