import { test, expect, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { move } from "./skill-navigation";
const read = (p: Page) => p.evaluate(() => (window as any).__farwind());
const root = "docs/traveler-skills/evidence/";
async function close(page: Page) {
  if ((await read(page)).mode === "dialog")
    await page.getByRole("button", { name: "继续 · E", exact: true }).click();
}
async function face(page: Page, key: string) {
  await page.keyboard.press(key);
  await page.waitForTimeout(80);
}
async function chain(page: Page, shot = async () => {}) {
  await page.keyboard.press("j");
  await page.waitForFunction(
    () => (window as any).__farwind().skillGrowth.combatStage === 1,
  );
  await page.keyboard.press("j");
  await page.waitForFunction(
    () => (window as any).__farwind().skillGrowth.combatStage === 2,
  );
  await page.keyboard.press("j");
  await page.waitForFunction(
    () => (window as any).__farwind().skillGrowth.combatStage === 3,
  );
  await page.waitForFunction(() =>
    document
      .querySelector("#parry-status")
      ?.textContent?.includes("J 接第四击"),
  );
  await page.keyboard.press("j");
  await page.waitForFunction(
    () => (window as any).__farwind().skillGrowth.combatStage === 4,
  );
  await page.waitForTimeout(250);
  await shot();
  await page.waitForTimeout(850);
}
async function clearThreat(page: Page) {
  for (let n = 0; n < 28; n++) {
    const state = await read(page),
      p = state.state.player;
    const enemy = state.skillGrowth.enemies
      .filter(
        (e: any) =>
          e.hp > 0 && !e.disabled && Math.hypot(e.x - p.x, e.y - p.y) < 270,
      )
      .sort(
        (a: any, b: any) =>
          Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y),
      )[0];
    if (!enemy) return;
    expect(p.hp, "真实战斗期间存活").toBeGreaterThan(0);
    const dx = enemy.x - p.x,
      dy = enemy.y - p.y,
      key =
        Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "d" : "a") : dy > 0 ? "s" : "w";
    await page.keyboard.down(key);
    await page.waitForTimeout(Math.hypot(dx, dy) > 80 ? 240 : 40);
    await page.keyboard.up(key);
    await page.keyboard.press("k");
    await page.waitForTimeout(160);
    await page.keyboard.press("j");
    await page.waitForTimeout(240);
    await page.keyboard.press("j");
    await page.waitForTimeout(290);
    await page.keyboard.press("j");
    await page.waitForTimeout(850);
  }
  throw Error("附近威胁未在限定键鼠战斗内解除");
}
async function lesson(page: Page, x: number, y: number) {
  await move(page, x, y);
  await page.keyboard.press("e");
  await expect(page.locator(".lesson-actions")).toBeVisible();
  await page.waitForTimeout(120);
}
async function restored(page: Page, stage: number) {
  expect((await read(page)).state.skills.swordWindStage).toBe(stage);
  await close(page);
  await page.reload();
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  await page.waitForFunction(() => (window as any).__farwind().mode === "");
  expect((await read(page)).state.skills.swordWindStage).toBe(stage);
}
test("真实新游戏：五次独特学习、投影应用、逐阶重开和手记", async ({ page }) => {
  const errors: string[] = [],
    records: any[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto("/");
    await page.getByRole("button", { name: "启程 · 新游戏" }).click();
    await page.waitForFunction(() => (window as any).__farwind().mode === "");
    expect((await read(page)).state.skills.swordWindStage).toBe(0);
    await expect(page.locator("#sword-wind-status")).toBeHidden();
    await lesson(page, 1380, 1525);
    await page
      .getByRole("button", { name: "开始限定试用", exact: true })
      .click();
    expect((await read(page)).skillGrowth.trial).toBe("windLessonResolved");
    await move(page, 1310, 1400);
    await face(page, "w");
    await chain(page, async () =>
      page.screenshot({ path: root + "natural-water-learning.png" }),
    );
    await expect
      .poll(async () => (await read(page)).state.skills.swordWindStage)
      .toBe(1);
    records.push({ 阶段: 1, 状态: await read(page) });
    await restored(page, 1);
    await move(page, 1430, 1450);
    await face(page, "w");
    await chain(page);
    expect(
      (await read(page)).skillGrowth.targets.find(
        (t: any) => t.id === "lesson-water-followup",
      ).hits,
    ).toBeGreaterThan(0);
    await lesson(page, 2460, 920);
    await page
      .getByRole("button", { name: "沿两铃之间导流", exact: true })
      .click();
    await expect
      .poll(async () => (await read(page)).state.skills.swordWindStage)
      .toBe(2);
    records.push({ 阶段: 2, 状态: await read(page) });
    await restored(page, 2);
    await clearThreat(page);
    await move(page, 2460, 980);
    await face(page, "d");
    await chain(page);
    expect(
      (await read(page)).skillGrowth.targets
        .filter((t: any) => t.id.startsWith("lesson-double-"))
        .every((t: any) => t.hits === 1),
    ).toBe(true);
    await page.screenshot({ path: root + "natural-double.png" });
    await lesson(page, 2890, 830);
    await page.getByRole("button", { name: "沿风痕封闭裂开的泄口" }).click();
    await expect
      .poll(async () => (await read(page)).state.skills.swordWindStage)
      .toBe(3);
    records.push({ 阶段: 3, 状态: await read(page) });
    await restored(page, 3);
    await clearThreat(page);
    await move(page, 2890, 1180);
    await clearThreat(page);
    await move(page, 2890, 1180);
    await face(page, "d");
    await chain(page);
    const through = (await read(page)).skillGrowth.targets.filter((t: any) =>
      t.id.startsWith("lesson-through-"),
    );
    expect(through.map((t: any) => t.hits)).toEqual([1, 1, 1, 0]);
    await page.screenshot({ path: root + "natural-through-wall.png" });
    await lesson(page, 3610, 1200);
    await page
      .getByRole("button", { name: "开始限定试用", exact: true })
      .click();
    await move(page, 3610, 1110);
    await face(page, "w");
    await chain(page);
    await expect
      .poll(async () => (await read(page)).state.skills.swordWindStage)
      .toBe(4);
    records.push({ 阶段: 4, 状态: await read(page) });
    await restored(page, 4);
    await move(page, 3700, 1150);
    await face(page, "w");
    await chain(page, async () =>
      page.screenshot({ path: root + "natural-wide-channel.png" }),
    );
    expect(
      (await read(page)).skillGrowth.targets.find(
        (t: any) => t.id === "lesson-wide-channel-bell",
      ).hits,
    ).toBe(0);
    await lesson(page, 3910, 1050);
    await page.getByRole("button", { name: "左闸 · 导向左前" }).click();
    await page.waitForFunction(() => (window as any).__farwind().mode === "");
    await page.keyboard.press("e");
    await page.getByRole("button", { name: "右闸 · 导向右前" }).click();
    await expect
      .poll(async () => (await read(page)).state.skills.swordWindStage)
      .toBe(5);
    records.push({ 阶段: 5, 状态: await read(page) });
    await restored(page, 5);
    await face(page, "w");
    await chain(page, async () =>
      page.screenshot({ path: root + "natural-three.png" }),
    );
    const targets = (await read(page)).skillGrowth.targets.filter((t: any) =>
      t.id.startsWith("lesson-three-"),
    );
    expect(targets.map((t: any) => t.hits)).toEqual([1, 1, 1, 0, 1]);
    await page.keyboard.press("q");
    await expect(page.locator(".skill-journal")).toContainText("三向疾风斩");
    await expect(page.locator(".skill-journal")).toContainText("临水送风");
    await page.locator(".skill-journal").scrollIntoViewIfNeeded();
    await page.screenshot({ path: root + "natural-journal.png" });
    expect(errors).toEqual([]);
    writeFileSync(
      root + "natural-journey.json",
      JSON.stringify(
        {
          说明: "正式生产构建，从新游戏开始；所有移动、机关选择和攻击由实际键鼠执行，无存档夹具、传送或开发授予。每阶提交后重载继续。",
          各阶: records,
          最终: await read(page),
          页面异常: errors,
        },
        null,
        2,
      ),
    );
  } catch (e) {
    await page.screenshot({ path: root + "natural-first-failure.png" });
    writeFileSync(
      root + "natural-first-failure.json",
      JSON.stringify(
        {
          说明: "保留失败首因，不将固定夹具作为自然通关。",
          错误: String(e),
          进度: records,
          现场: await read(page),
          页面异常: errors,
        },
        null,
        2,
      ),
    );
    throw e;
  }
});

import { initialState } from "../src/game/systems/state";
import { completeWindLesson } from "../src/game/systems/skills";
import { waterSurfaceAt } from "../src/game/systems/swordWindWater";
import { LESSON_IDS } from "../src/data/windLessons";
async function importFixture(page: Page, state: any) {
  await page.waitForFunction(
    () => typeof (window as any).__farwind === "function",
  );
  const mode = (await read(page)).mode;
  if (mode !== "title") {
    if (mode !== "pause") await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "保存并返回标题", exact: true })
      .click();
  }
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入存档", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "skill-boundary-fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(state)),
  });
  await page.waitForFunction(() => (window as any).__farwind().mode === "");
  await page.waitForTimeout(180);
}
function fixture(stage: number, point = { x: 1310, y: 1400 }) {
  let s = initialState();
  Object.assign(s.player, point);
  for (let i = 0; i < stage; i++) {
    if (i === 1) s.skills.devices.serialValve = 1;
    if (i === 2) s.skills.devices.leakClosed = true;
    if (i === 4) {
      s.skills.devices.splitLeft = 1;
      s.skills.devices.splitRight = 2;
    }
    s = completeWindLesson(s, LESSON_IDS[i]);
  }
  return s;
}
test("固定边界夹具：0—5导入导出，旧档继承与乱序事实", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  const records = [];
  for (let stage = 0; stage <= 5; stage++) {
    await importFixture(page, fixture(stage));
    expect((await read(page)).state.skills.swordWindStage).toBe(stage);
    await page.keyboard.press("Escape");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "导出备份", exact: true }).click();
    const path = await (await download).path();
    const fs = await import("node:fs/promises");
    const exported = JSON.parse(await fs.readFile(path!, "utf8"));
    expect(exported.skills.swordWindStage).toBe(stage);
    expect(exported.schema_version).toBe(8);
    await page.reload();
    await page.getByRole("button", { name: "继续旅途", exact: true }).click();
    await page.waitForFunction(() => (window as any).__farwind().mode === "");
    expect((await read(page)).state.skills.swordWindStage).toBe(stage);
    records.push({ 阶段: stage, 导出并重开: true });
  }
  const old: any = fixture(0);
  old.schema_version = 6;
  old.skills = { swordWind: true };
  old.bag[0] = { id: "wood", count: 3 };
  await importFixture(page, old);
  const inherited = (await read(page)).state;
  expect(inherited.skills.swordWindStage).toBe(1);
  expect(inherited.skills.legacySwordWind).toBe(true);
  expect(inherited.skills.completedLessons).toEqual([]);
  expect(inherited.bag).toEqual(old.bag);
  let ahead = fixture(0, { x: 1310, y: 1400 });
  ahead.skills.devices.splitLeft = 1;
  ahead.skills.devices.splitRight = 2;
  ahead = completeWindLesson(ahead, LESSON_IDS[4]);
  ahead = completeWindLesson(ahead, LESSON_IDS[3]);
  ahead.skills.devices.leakClosed = true;
  ahead = completeWindLesson(ahead, LESSON_IDS[2]);
  ahead.skills.devices.serialValve = 1;
  ahead = completeWindLesson(ahead, LESSON_IDS[1]);
  await importFixture(page, ahead);
  expect((await read(page)).state.skills.swordWindStage).toBe(0);
  await move(page, 1380, 1525);
  await page.keyboard.press("e");
  await page.getByRole("button", { name: "开始限定试用", exact: true }).click();
  await move(page, 1310, 1400);
  await face(page, "w");
  await chain(page);
  await expect
    .poll(async () => (await read(page)).state.skills.swordWindStage)
    .toBe(5);
  await expect(page.locator(".dialog-copy")).toContainText("学会 一线斩·双穿");
  await expect(page.locator(".dialog-copy")).toContainText("学会 三向疾风斩");
  await restored(page, 5);
  writeFileSync(
    root + "save-boundaries.json",
    JSON.stringify(
      {
        说明: "明确的导入导出和乱序边界夹具，不作为自然学习证据。只有补齐基础教学的一击在页面完成。",
        各阶段: records,
        旧档继承: inherited.skills,
        乱序复核: (await read(page)).state.skills,
      },
      null,
      2,
    ),
  );
});

test("固定边界夹具：教学退出、重开清除与保存事务中断安全重试", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  await importFixture(page, fixture(0));
  await move(page, 1380, 1525);
  await page.keyboard.press("e");
  await page.getByRole("button", { name: "开始限定试用", exact: true }).click();
  await move(page, 1100, 1550);
  expect((await read(page)).skillGrowth.trial).toBeNull();
  expect((await read(page)).state.skills.swordWindStage).toBe(0);
  await importFixture(page, fixture(0));
  await move(page, 1380, 1525);
  await page.keyboard.press("e");
  await page.getByRole("button", { name: "开始限定试用", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  await page.waitForFunction(() => (window as any).__farwind().mode === "");
  expect((await read(page)).skillGrowth.trial).toBeNull();
  expect((await read(page)).skillGrowth.ability).toBeNull();
  await move(page, 1380, 1525);
  await page.keyboard.press("e");
  await page.getByRole("button", { name: "开始限定试用", exact: true }).click();
  // 只中断真实保存事务一次；不改动正式状态、命中或任务事实。
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value: any, key?: IDBValidKey) {
      const result = original.call(this, value, key!);
      if (value?.skills?.swordWindStage === 1) {
        IDBObjectStore.prototype.put = original;
        this.transaction.abort();
      }
      return result;
    };
  });
  await move(page, 1310, 1400);
  await face(page, "w");
  await chain(page);
  await expect(
    page.getByRole("heading", { name: "经历尚未保存", exact: true }),
  ).toBeVisible();
  const failed = await read(page);
  expect(failed.state.skills.swordWindStage).toBe(0);
  expect(failed.skillGrowth.pending).toBe(LESSON_IDS[0]);
  await page.screenshot({ path: root + "save-failure-retry.png" });
  await page
    .getByRole("button", { name: "重试保存已完成的经历", exact: true })
    .click();
  await expect
    .poll(async () => (await read(page)).state.skills.swordWindStage)
    .toBe(1);
  await restored(page, 1);
  expect(errors).toEqual([]);
  writeFileSync(
    root + "save-failure.json",
    JSON.stringify(
      {
        说明: "通过一次真实IndexedDB事务中断测试。重试只重新提交刚才命中的证据，没有重复解谜或直接赋予技能。",
        失败: failed.state.skills,
        重试后: (await read(page)).state.skills,
        页面异常: errors,
      },
      null,
      2,
    ),
  );
});

test("固定划水夹具：三道轨迹、桥面裁切、暂停冻结与标题清理", async ({
  page,
}) => {
  page.on("dialog", (d) => d.accept());
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await importFixture(page, fixture(5));
  await face(page, "w");
  let active: any;
  await chain(page, async () => {
    active = await read(page);
    expect(active.skillGrowth.water.active).toBeGreaterThan(0);
    expect(active.skillGrowth.water.allocated).toBeLessThanOrEqual(256);
    expect(
      new Set(active.skillGrowth.water.samples.map((s: any) => s.wind)).size,
    ).toBe(3);
    expect(
      active.skillGrowth.water.samples.every((s: any) => {
        const w = active.skillGrowth.winds.find((w: any) => w.id === s.wind);
        if (!w) return true;
        return [-w.config.width / 2, 0, w.config.width / 2].some(
          (offset) =>
            waterSurfaceAt(
              s.x - w.direction.y * offset,
              s.y + w.direction.x * offset,
            ) === "pond",
        );
      }),
    ).toBe(true);
    await page.screenshot({ path: root + "water-three-runtime.png" });
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => (window as any).__farwind().mode === "pause",
    );
    const frozen = await read(page);
    await page.waitForTimeout(400);
    const paused = await read(page);
    expect(paused.skillGrowth.sim).toBe(frozen.skillGrowth.sim);
    expect(paused.skillGrowth.water).toEqual(frozen.skillGrowth.water);
    await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  });
  await page.waitForTimeout(1200);
  expect((await read(page)).skillGrowth.water.active).toBe(0);
  await chain(page, async () => {
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "保存并返回标题", exact: true })
      .click();
  });
  await page.waitForFunction(
    () => (window as any).__farwind().mode === "title",
  );
  const ended = await read(page);
  expect(ended.skillGrowth.water.active).toBe(0);
  expect(ended.skillGrowth.winds).toEqual([]);
  expect(ended.skillGrowth.trial).toBeNull();
  await page.reload();
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  await page.waitForFunction(() => (window as any).__farwind().mode === "");
  const reload = await read(page);
  expect(reload.skillGrowth.water.allocated).toBe(0);
  expect(errors).toEqual([]);
  writeFileSync(
    root + "water-runtime.json",
    JSON.stringify(
      {
        说明: "正式构建的固定高阶划水夹具，仅用实际攻击、暂停、返回标题和重载操作；不作为自然通关证据。",
        三道活跃时: active.skillGrowth,
        返回标题: ended.skillGrowth,
        重载后: reload.skillGrowth,
        页面异常: errors,
      },
      null,
      2,
    ),
  );
});

test("固定水域边界夹具：小溪、桥口与池岸三向扫过", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const records = [];
  for (const sample of [
    { id: "stream", point: { x: 2460, y: 980 }, key: "d", region: "stream" },
    {
      id: "stream-bridge",
      point: { x: 2600, y: 1100 },
      key: "w",
      region: "stream",
    },
    { id: "pond-shore", point: { x: 1510, y: 1300 }, key: "a", region: "pond" },
    {
      id: "pond-bridge",
      point: { x: 1090, y: 1120 },
      key: "d",
      region: "pond",
    },
  ]) {
    const s = fixture(5, sample.point);
    s.killed = [
      "slime-1",
      "slime-2",
      "leaf-1",
      "leaf-2",
      "spore-1",
      "boar-1",
      "raven-1",
    ];
    await importFixture(page, s);
    await face(page, sample.key);
    await chain(page, async () => {
      const active = await read(page);
      expect(
        active.skillGrowth.water.samples.some(
          (s: any) => s.region === sample.region,
        ),
      ).toBe(true);
      expect(active.skillGrowth.water.allocated).toBeLessThanOrEqual(256);
      records.push({
        场景: sample.id,
        活跃状态: active.skillGrowth,
        玩家: active.state.player,
      });
      await page.screenshot({ path: root + "water-" + sample.id + ".png" });
    });
    await expect
      .poll(async () => (await read(page)).skillGrowth.water.active, {
        timeout: 3000,
      })
      .toBe(0);
  }
  expect(errors).toEqual([]);
  writeFileSync(
    root + "water-scenarios.json",
    JSON.stringify(
      {
        说明: "四个固定水域位置，正常键盘三向释放。与自然学习记录分开；截图用于核对斜向、擦岸、桥口及真实水域裁切，数值时钟未快进。",
        场景: records,
        页面异常: errors,
      },
      null,
      2,
    ),
  );
});

test("固定边界夹具：真实敌伤死亡清除教学并保留正式贯通", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const s = fixture(3, { x: 3610, y: 1110 });
  s.player.hp = 1;
  await importFixture(page, s);
  await page.keyboard.press("e");
  await page.getByRole("button", { name: "开始限定试用", exact: true }).click();
  expect((await read(page)).skillGrowth.trial).toBe(LESSON_IDS[3]);
  // 初始教本站位在冲锋接触之外；走近到教学区内的真实敌方接触范围。
  await page.keyboard.down("a");
  await page.waitForFunction(() => {
    const s = (window as any).__farwind();
    return s.state.player.x < 3460 || s.state.player.hp === 100;
  });
  await page.keyboard.up("a");
  await page.waitForFunction(
    () => {
      const s = (window as any).__farwind();
      return (
        s.state.player.hp === 100 &&
        s.state.player.x === 670 &&
        s.skillGrowth.trial === null
      );
    },
    null,
    { timeout: 20000 },
  );
  const after = await read(page);
  expect(after.state.skills.swordWindStage).toBe(3);
  expect(after.skillGrowth.water.active).toBe(0);
  expect(after.skillGrowth.winds).toEqual([]);
  expect(errors).toEqual([]);
  writeFileSync(
    root + "death-boundary.json",
    JSON.stringify(
      {
        说明: "低生命固定夹具，由林豕实际攻击触发正式死亡／村庄恢复路径，不直接赋零血或调用死亡函数。",
        死亡后: after.state.player,
        正式本领: after.state.skills,
        教学与弹体: after.skillGrowth,
        页面异常: errors,
      },
      null,
      2,
    ),
  );
});

test("固定生命周期夹具：真实场景销毁回收水迹对象和遮罩", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/\/assets\/index-.*\.js$/, async (route) => {
    const response = await route.fetch(),
      body = await response.text();
    expect(body).toContain('Object.defineProperty(window,"__farwind",');
    await route.fulfill({
      response,
      body: body.replace(
        'Object.defineProperty(window,"__farwind",',
        'Object.defineProperty(window,"__skillStop",{value:()=>new Promise(resolve=>{this.events.once("shutdown",()=>resolve({water:this.swordWindView.water.snapshot(),masks:this.textures.getTextureKeys().filter(k=>k.startsWith("wind-water-mask"))}));this.scene.stop();})}),Object.defineProperty(window,"__farwind",',
      ),
    });
  });
  await page.goto("/");
  await importFixture(page, fixture(5));
  await face(page, "w");
  let result: any;
  await chain(page, async () => {
    expect((await read(page)).skillGrowth.water.active).toBeGreaterThan(0);
    result = await page.evaluate(() => (window as any).__skillStop());
  });
  expect(result.water.disposed).toBe(true);
  expect(result.water.allocated).toBe(0);
  expect(result.water.active).toBe(0);
  expect(result.masks).toEqual([]);
  expect(errors).toEqual([]);
  writeFileSync(
    root + "scene-disposal.json",
    JSON.stringify(
      {
        说明: "仅此生命周期测试通过响应插桩调用真实Phaser场景stop，观察shutdown后的释放；正式构建没有此控制入口，不作为自然通关证据。",
        销毁后: result,
        页面异常: errors,
      },
      null,
      2,
    ),
  );
});

// 只读插桩用于判断输入时机，不改变正式构建或战斗状态。
test("生产回归：未学三连、架剑自动反斩与风步仍可使用", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/\/assets\/index-.*\.js$/, async (route) => {
    const response = await route.fetch(),
      body = await response.text();
    expect(body).toContain('Object.defineProperty(window,"__farwind",');
    await route.fulfill({
      response,
      body: body.replace(
        'Object.defineProperty(window,"__farwind",',
        'Object.defineProperty(window,"__combatRegression",{value:()=>({practice:this.practice.snapshot(this.sim,this.state.player),training:this.training.snapshot(this.sim),contacts:this.contactHistory,sim:this.sim,dashRemaining:Math.max(0,this.combat.dashUntil-this.sim)})}),Object.defineProperty(window,"__farwind",',
      ),
    });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "启程 · 新游戏", exact: true })
    .click();
  await page.waitForFunction(() => (window as any).__farwind().mode === "");
  await move(page, 850, 720);
  await face(page, "w");
  const initial = await read(page);
  for (const stage of [1, 2, 3]) {
    await page.keyboard.press("j");
    await page.waitForFunction(
      (stage) => (window as any).__farwind().skillGrowth.combatStage === stage,
      stage,
    );
  }
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__combatRegression().training.damage),
    )
    .toBe(68);
  await expect(page.locator("#parry-status")).not.toContainText("第四");
  await page.waitForFunction(
    () => (window as any).__farwind().skillGrowth.combatStage === 0,
  );
  expect((await read(page)).state.skills.swordWindStage).toBe(0);
  expect((await read(page)).skillGrowth.winds).toEqual([]);
  await move(page, 850, 720);
  await face(page, "w");
  await page.getByRole("button", { name: "迎风架剑练习", exact: true }).click();
  await page
    .getByRole("button", { name: "慢速教学 · 900毫秒", exact: true })
    .click();
  await page.waitForFunction(
    () => {
      const m = (window as any).__combatRegression(),
        lead = (m.practice.predictedContact ?? Infinity) - m.sim;
      return lead <= 180 && lead > 130;
    },
    undefined,
    { polling: 5 },
  );
  await page.keyboard.press("k");
  await page.waitForFunction(() =>
    (window as any)
      .__combatRegression()
      .contacts.some((c: any) => c.result === "normal"),
  );
  await page.waitForFunction(
    () => (window as any).__farwind().skillGrowth.combatStage === 1,
  );
  await page.keyboard.press("j");
  await page.waitForFunction(
    () => (window as any).__farwind().skillGrowth.combatStage === 2,
  );
  await page.keyboard.press("j");
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__combatRegression().training.damage),
    )
    .toBe(74);
  const counter = await page.evaluate(() =>
    (window as any).__combatRegression(),
  );
  await page.waitForFunction(
    () => (window as any).__farwind().skillGrowth.combatStage === 0,
  );
  await page.getByRole("button", { name: "迎风架剑练习", exact: true }).click();
  await page.getByRole("button", { name: "结束弹反练习", exact: true }).click();
  await face(page, "s");
  const before = (await read(page)).state.player;
  await page.keyboard.press("l");
  await page.waitForFunction(
    () => (window as any).__combatRegression().dashRemaining > 0,
  );
  await page.waitForFunction(
    () => (window as any).__combatRegression().dashRemaining === 0,
  );
  const final = await read(page);
  expect(final.state.player.y - before.y).toBeGreaterThan(20);
  expect(final.state.player.stamina).toBeLessThan(before.stamina);
  expect(final.state.skills).toEqual(initial.state.skills);
  expect(final.state.quest).toBe(initial.state.quest);
  expect(errors).toEqual([]);
  await page.screenshot({ path: root + "combat-regression.png" });
  writeFileSync(
    root + "combat-regression.json",
    JSON.stringify(
      {
        说明: "生产新游戏，正常键盘移动与攻击；只读插桩提供架剑输入时机，不能作为画面提示可读性的验收。没有开发授予或运行状态修改。",
        开始: initial.state,
        反斩: counter,
        结束: final.state,
        页面异常: errors,
      },
      null,
      2,
    ),
  );
});
