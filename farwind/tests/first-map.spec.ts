import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { move } from "./map-navigation";
import { initialState } from "../src/game/systems/state";
import { WORLD } from "../src/data/world";
import { GROUND_CHUNK } from "../src/game/systems/terrainChunks";
import { VILLAGE_ANCHORS } from "../src/data/maps/windbell/layout";

const root = process.env.FARWIND_MAP_EVIDENCE_ROOT ?? "docs/first-map/evidence-m2";
const read = (page: any) => page.evaluate(() => (window as any).__farwind());
// 自然新游戏与真实键盘推进；只读诊断，不导入摆位档、不改写运行状态。
test("FIRST-MAP-01", async ({ page, browser }) => {
  test.setTimeout(300000);
  mkdirSync(root, { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .getByRole("button", { name: "启程 · 新游戏", exact: true })
    .click();
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  await page.bringToFront();
  const report: any = {
    说明: "固定正式构建；所有进度来自新游戏按钮、真实键鼠、交易和保存。没有调试授予、坐标写入或快进。",
    浏览器: browser.version(),
    视窗: "1920×1080，设备缩放1",
    路线: [],
    错误: errors,
  };
  const gpu = await browser.newBrowserCDPSession();
  report.GPU = (await gpu.send("SystemInfo.getInfo")).gpu;
  await gpu.detach();
  const index = readFileSync(".first-map-local/production/index.html", "utf8"),
    entry = index.match(/src="([^"]+\.js)"/)![1];
  report.构建入口 = entry;
  report.入口摘要 = createHash("sha256")
    .update(readFileSync(".first-map-local/production" + entry))
    .digest("hex");
  const checkpoint = async (name: string, file: string) => {
    const s = await read(page);
    report.路线.push({
      名称: name,
      位置: s.state.player,
      空间: s.state.life.playerSpace,
      地面: s.ground,
      黑猫: s.companion,
      居民: s.npcLife,
    });
    expect(s.ground.resident).toBeGreaterThan(0);
    expect(s.companion.blocked).toBe(false);
    await page.screenshot({ path: `${root}/${file}.png` });
  };
  await checkpoint("开局广场", "plaza");
  await move(page, VILLAGE_ANCHORS.ledgerApproach.x, VILLAGE_ANCHORS.ledgerApproach.y);
  await page.waitForFunction(
    () => (window as any).__farwind().target === "community-ledger",
  );
  await page.keyboard.press("e");
  await page.waitForFunction(
    () => (window as any).__farwind().mode === "commission",
  );
  await page.keyboard.press("Escape");
  await move(page, VILLAGE_ANCHORS.general.x, VILLAGE_ANCHORS.general.y);
  await page.waitForFunction(
    () => (window as any).__farwind().target === "service-general",
  );
  await checkpoint("杂货铺门口", "general");
  await page.keyboard.press("e");
  await page.getByLabel("物品", { exact: true }).selectOption("potion");
  await page.getByRole("button", { name: "核对交易", exact: true }).click();
  await page.getByRole("button", { name: "确认购买", exact: true }).click();
  await expect(page.locator("#shop-feedback")).toContainText(
    "交易已完成并保存",
  );
  const bought = (await read(page)).state;
  expect(bought.coins).toBe(102);
  expect(bought.economyRevision).toBe(1);
  await page.screenshot({ path: `${root}/purchase.png` });
  await page.getByRole("button", { name: "离开商店", exact: true }).click();
  await move(page, 480, 1435);
  await checkpoint("木工与铁匠生产院", "workshops");
  await move(page, 220, 1190);
  await move(page, 220, 1030);
  await move(page, 330, 900);
  await checkpoint("西巷连续通行与住宅入口", "west-lane");
  await move(page, 900, 1835);
  await checkpoint("南门来回通行", "south-gate");
  await move(page, 1685, 1640);
  await checkpoint("旅馆与果园", "orchard");
  await page.waitForFunction(
    () => (window as any).__farwind().target === "service-inn",
  );
  await page.keyboard.press("e");
  await expect(
    page.getByRole("button", { name: "核对交易", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "离开商店", exact: true }).click();
  await move(page, 1550, 1640);
  await page.waitForFunction(
    () => (window as any).__farwind().target === "life-door:inn",
  );
  await page.keyboard.press("e");
  await page.waitForFunction(
    () => (window as any).__farwind().state.life.playerSpace === "inn",
  );
  const entered = (await read(page)).state;
  await page.screenshot({ path: `${root}/inn-room.png` });
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => (window as any).__farwind().mode === "pause",
  );
  await page.getByRole("button", { name: "保存旅途", exact: true }).click();
  await expect(page.locator("#toast")).toContainText("已保存");
  await page.reload();
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  await page.waitForFunction(() => (window as any).__farwind().mode === "");
  const indoor = (await read(page)).state;
  expect(indoor.life.playerSpace).toBe("inn");
  expect(indoor.life.outside).toEqual(entered.life.outside);
  expect([indoor.player.x, indoor.player.y]).toEqual([
    entered.player.x,
    entered.player.y,
  ]);
  report.室内重开 = "室内坐标与室外返回点保持，伙伴随空间隔离";
  await move(page, 2100, 1080);
  await checkpoint("东门与驻防", "east-gate");
  await move(page, 1695, 710);
  await checkpoint("训练场教本架", "training");
  await move(page, 820, 190);
  await checkpoint("北门与驻防", "north-gate");
  await move(page, 670, 760);
  await checkpoint("返回公共广场", "return-plaza");
  const returned = await read(page);
  expect(returned.ground.released).toBeGreaterThan(0);
  const limit =
    Math.min(
      Math.ceil(WORLD.width / GROUND_CHUNK.width),
      Math.ceil(1280 / GROUND_CHUNK.width) + 1 + 2 * GROUND_CHUNK.padding,
    ) *
    Math.min(
      Math.ceil(WORLD.height / GROUND_CHUNK.height),
      Math.ceil(720 / GROUND_CHUNK.height) + 1 + 2 * GROUND_CHUNK.padding,
    );
  expect(returned.ground.peak).toBeLessThanOrEqual(limit);
  report.地面理论上限 = limit;
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => (window as any).__farwind().mode === "pause",
  );
  const paused = (await read(page)).state;
  await page.waitForTimeout(500);
  expect((await read(page)).state).toEqual(paused);
  await page.getByRole("button", { name: "保存旅途", exact: true }).click();
  await expect(page.locator("#toast")).toContainText("已保存");
  await page.reload();
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  await page.waitForFunction(() => (window as any).__farwind().mode === "");
  const loaded = (await read(page)).state;
  expect([
    loaded.bag,
    loaded.coins,
    loaded.economyRevision,
    loaded.map_version,
  ]).toEqual([paused.bag, paused.coins, paused.economyRevision, paused.map_version]);
  expect(
    Math.hypot(
      loaded.player.x - paused.player.x,
      loaded.player.y - paused.player.y,
    ),
  ).toBeLessThan(1);
  expect(loaded.defense.guards.map((g: any) => [g.id, g.hp, g.dead])).toEqual(
    paused.defense.guards.map((g: any) => [g.id, g.hp, g.dead]),
  );
  report.交易与暂停保存重开 = "通过";
  report.区块回收 = returned.ground;
  // 只采集正式场景更新帧的原始间隔；不采用经过平滑且过滤长帧的旧诊断值。
  // 自然开局阿禾先回家取工具，再走到新工作位；不写入行动或位置。
  await page.waitForFunction(()=>{const n=(window as any).__farwind().state.life.people.find((n:any)=>n.id==="carpenter");return n.action?.kind==="work"&&n.action?.phase==="perform";},undefined,{timeout:30000});
  const carpenter = (await read(page)).state.life.people.find(
    (n: any) => n.id === "carpenter",
  );
  expect(carpenter.gear).toBe("carried");
  expect(carpenter.action.target).toMatchObject({
    space: "village",
    ...VILLAGE_ANCHORS.carpenter,
  });
  report.木匠工作位 = { 状态: carpenter.action, 身体: carpenter.body };
  await page.waitForTimeout(20000);
  const end = await read(page),
    frames = end.fps
      .map((fps: number) => 1000 / fps)
      .sort((a: number, b: number) => a - b);
  report.常规场景基线 = {
    边界: "当前设备与本构建的短时广场样本，不是压力战斗或60分钟验收。",
    样本数: frames.length,
    平均帧时间:
      frames.reduce((a: number, b: number) => a + b, 0) / frames.length,
    中位: frames[Math.floor(frames.length * 0.5)],
    P95: frames[Math.floor(frames.length * 0.95)],
    P99: frames[Math.floor(frames.length * 0.99)],
    最长: frames.at(-1),
  };
  report.最终状态 = {
    地图版本: end.state.map_version,
    主角: end.state.player,
    卫兵: end.state.defense.guards.map((g: any) => ({
      身份: g.id,
      生命: g.hp,
    })),
    地面: end.ground,
  };
  expect(errors).toEqual([]);
  writeFileSync(`${root}/browser.json`, JSON.stringify(report, null, 2));
  await page.screenshot({ path: `${root}/saved-return.png` });
});

// 该案例只验夜间视觉。使用明确标注的初始夜景样本，不计作自然昼夜或章节通关证据。
test("FIRST-MAP-02", async ({ page }) => {
  const state = initialState();
  state.time = 1260;
  state.player.x = 480;
  state.player.y = 1435;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  page.once("dialog", (d) => d.accept());
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入存档", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "night-visual-fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(state)),
  });
  await page.waitForFunction(() => (window as any).__farwind().mode === "");
  await expect(page.locator("#clock")).toContainText("夜晚");
  await page.screenshot({ path: `${root}/workshops-night.png` });
  await move(page, 1685, 1640);
  await page.screenshot({ path: `${root}/orchard-night.png` });
  expect(errors).toEqual([]);
  writeFileSync(
    `${root}/night-visual.json`,
    JSON.stringify(
      {
        说明: "正式构建，夜景初始样本通过导入界面进入；只读诊断与真实键盘步行。该样本只证明灯光、标识与入口运行显示，不代表自然跨日通关。",
        错误: errors,
        快照: await read(page),
      },
      null,
      2,
    ),
  );
});
