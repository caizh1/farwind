import { test, expect, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { move } from "./skill-navigation";
import {clearMotionLine} from '../src/game/systems/obstacles';
import {props} from '../src/data/world';
const read = (p: Page) => p.evaluate(() => (window as any).__farwind());
const root = "docs/traveler-skills/evidence/";
async function close(page: Page) {
  if ((await read(page)).mode === "dialog")
    await page.getByRole("button", { name: "继续 · E", exact: true }).click();
}
async function face(page: Page, key: string) {
  // 移动方向由帧采样，跨重载时不能用一帧内的 down/up 假设完成朝向更新。
  await page.keyboard.down(key);
  await page.waitForTimeout(65);
  await page.keyboard.up(key);
  await page.waitForTimeout(80);
}
// 新规则：教学及机关由独立剑风动作完成，不再以三刀作为前置。
async function chain(page: Page, shot = async () => {}) {
  await page.keyboard.press("i");
  await page.waitForFunction(() => (window as any).__farwind().skillGrowth.combatStage === 1);
  await page.waitForTimeout(250);
  await shot();
  await page.waitForTimeout(850);
}
async function healForTravel(page:Page){
 const s=(await read(page)).state;
 if(s.player.hp<=70&&s.bag.some((x:any)=>x?.id==='potion'&&x.count>0)){
  await page.keyboard.press('1');await expect.poll(async()=>(await read(page)).state.player.hp).toBeGreaterThan(s.player.hp);
 }
}
async function clearThreat(page: Page) {
  for (let n = 0; n < 28; n++) {
    await healForTravel(page);
    const state = await read(page),
      p = state.state.player;
    const enemy = state.skillGrowth.enemies
      .filter(
        (e: any) =>
          e.hp > 0 && !e.disabled && Math.hypot(e.x - p.x, e.y - p.y) < 270 && clearMotionLine(p,e),
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
    if(state.state.skills.swordWindStage){
      // 已学永久剑风后实际使用远程清路，避免自动脚本持续贴脸扛伤。
      await page.keyboard.down("i");await page.waitForTimeout(850);await page.keyboard.up("i");
      await page.waitForTimeout(150);continue;
    }
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
  await move(page, x, y, ()=>clearThreat(page));
  await healForTravel(page);await clearThreat(page);await move(page,x,y,()=>clearThreat(page));
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
  // 在游戏恢复后使用实际采集制作的药剂，不修改运行状态。
  const p=(await read(page)).state.player;
  if(p.hp<=60){await page.keyboard.press('1');await expect.poll(async()=>(await read(page)).state.player.hp).toBeGreaterThan(p.hp);}
}
// 正式新游戏自然探索五处传承、实际风铃命中与逐阶重开。
test("wind-natural-journey", async ({ page }) => {
  test.setTimeout(420000);
  const errors: string[] = [],
    records: any[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto("/");
    await page.getByRole("button", { name: "启程 · 新游戏" }).click();
    await page.waitForFunction(() => (window as any).__farwind().mode === "");
    expect((await read(page)).state.skills.swordWindStage).toBe(0);
    await expect(page.locator("#sword-wind-status")).toBeHidden();
    // 先在村庄采集补给并真实制作三瓶药剂，供跨区域探索使用。
    for(const id of ['herb-v1','herb-garden-1','herb-garden-2','berry-v1','orchard-berry-1']){
      const p=props.find(p=>p.id===id)!;await move(page,p.x,p.y+30);await page.keyboard.press('e');
      await expect.poll(async()=>(await read(page)).state.collected[id]).not.toBeUndefined();
      await page.waitForTimeout(300);
    }
    await page.keyboard.press('Tab');
    for(let i=1;i<=3;i++){
      await page.getByRole('button',{name:'制作恢复药剂',exact:true}).click();
      await expect.poll(async()=>(await read(page)).state.bag.filter((a:any)=>a?.id==='potion').reduce((n:number,a:any)=>n+a.count,0)).toBe(i);
    }
    await page.getByRole('button',{name:'收好行囊',exact:true}).click();
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
    await lesson(page, WIND_LESSONS[1].stand.x, WIND_LESSONS[1].stand.y);
    await page
      .getByRole("button", { name: "解开缠住铃绳的藤蔓", exact: true })
      .click();
    await expect
      .poll(async () => (await read(page)).state.skills.swordWindStage)
      .toBe(2);
    records.push({ 阶段: 2, 状态: await read(page) });
    await restored(page, 2);
    await clearThreat(page);
    await move(page, WIND_LESSONS[1].stand.x, WIND_LESSONS[1].stand.y);
    await face(page, "d");
    await chain(page);
    expect(
      (await read(page)).skillGrowth.targets
        .filter((t: any) => t.id.startsWith("lesson-serial-bell-"))
        .every((t: any) => t.hits === 1),
    ).toBe(true);
    await page.screenshot({ path: root + "natural-double.png" });
    await lesson(page, WIND_LESSONS[2].stand.x, WIND_LESSONS[2].stand.y);
    await page.getByRole("button", { name: "清走挡风的落枝" }).click();
    await expect
      .poll(async () => (await read(page)).state.skills.swordWindStage)
      .toBe(3);
    records.push({ 阶段: 3, 状态: await read(page) });
    await restored(page, 3);
    await clearThreat(page);
    await move(page, WIND_LESSONS[2].stand.x, WIND_LESSONS[2].stand.y);
    await clearThreat(page);
    await move(page, WIND_LESSONS[2].stand.x, WIND_LESSONS[2].stand.y);
    await face(page, "d");
    await chain(page);
    const through = (await read(page)).skillGrowth.targets.filter((t: any) =>
      t.id.startsWith("lesson-through-"),
    );
    expect(through.map((t: any) => t.hits)).toEqual([1, 1, 1, 0]);
    await page.screenshot({ path: root + "natural-through-wall.png" });
    // 沿村庄补给路线前往南部教本，避免把自动直线穿越多处遭遇当作正常探索。
    await move(page,670,720,()=>clearThreat(page));
    await move(page,1450,1520,()=>clearThreat(page));
    await lesson(page, WIND_LESSONS[3].x, WIND_LESSONS[3].y+25);
    await page
      .getByRole("button", { name: "开始限定试用", exact: true })
      .click();
    await move(page, WIND_LESSONS[3].stand.x, WIND_LESSONS[3].stand.y);
    await face(page, "w");
    await chain(page);
    await expect
      .poll(async () => (await read(page)).state.skills.swordWindStage)
      .toBe(4);
    records.push({ 阶段: 4, 状态: await read(page) });
    await restored(page, 4);
    await lesson(page, WIND_LESSONS[4].x, WIND_LESSONS[4].y+25);
    await page.getByRole("button", { name: "扶正左侧风帆" }).click();
    await page.waitForFunction(() => (window as any).__farwind().mode === "");
    await page.keyboard.press("e");
    await page.getByRole("button", { name: "扶正右侧风帆" }).click();
    await expect.poll(async () => (await read(page)).state.skills.swordWindStage).toBe(5);
    records.push({ 阶段: 5, 状态: await read(page) });
    await restored(page, 5);
    await move(page,WIND_LESSONS[4].stand.x,WIND_LESSONS[4].stand.y);
    await face(page, "w");
    await chain(page, async () =>
      page.screenshot({ path: root + "natural-three.png" }),
    );
    const targets = (await read(page)).skillGrowth.targets.filter((t: any) =>
      t.id.startsWith("lesson-three-"),
    );
    expect(targets.map((t: any) => t.hits)).toEqual([1, 1, 1]);
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
import { LESSON_IDS,WIND_LESSONS } from "../src/data/windLessons";
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
// 乱序一风三向：明确前置、重开保留，补齐后实际释放三道剑风。
test("wind-prerequisite-progression", async ({ page }) => {
  page.on("dialog", dialog => dialog.accept());
  await page.goto("/");
  await importFixture(page, fixture(1, WIND_LESSONS[4].stand));
  await page.keyboard.press("e");
  await page.getByRole("button", { name: "扶正左侧风帆", exact: true }).click();
  await page.waitForFunction(() => (window as any).__farwind().mode === "");
  await page.keyboard.press("e");
  await page.getByRole("button", { name: "扶正右侧风帆", exact: true }).click();
  await expect(page.locator(".dialog-copy")).toContainText("尚未掌握 三向疾风斩");
  await expect(page.locator(".dialog-copy")).toContainText("当前本领：一线斩（1/5）");
  await expect(page.locator(".dialog-copy")).toContainText("还需完成：两铃相继、长风不息、展风于野");
  await restored(page, 1);
  await page.keyboard.press("e");
  await expect(page.locator(".dialog-copy")).toContainText("下一步：西部旧农庄的串联风铃");
  await expect(page.locator(".dialog-copy")).toContainText("补齐后会自动结算，无需重做一风三向");
  await page.screenshot({ path: ".skill-growth-local/wind-prerequisite-dialog.png", animations: "disabled" });
  await close(page);
  await page.keyboard.press("q");
  await expect(page.locator(".skill-journal")).toContainText("当前本领：一线斩（1/5）");
  await expect(page.locator(".skill-journal")).toContainText("下一步：西部旧农庄的串联风铃");
  await expect(page.locator(".skill-journal")).not.toContainText("已发现的线索：一风三向");
  await page.locator(".skill-journal").scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".skill-growth-local/wind-prerequisite-journal.png" });
  await page.keyboard.press("Escape");

  // 固定边界样本模拟农庄与山口经历已补齐；最后一处教学仍由真实键鼠完成。
  let ahead = fixture(3, { x: WIND_LESSONS[3].x, y: WIND_LESSONS[3].y+25 });
  ahead.skills.devices.splitLeft = 1;
  ahead.skills.devices.splitRight = 2;
  ahead = completeWindLesson(ahead, LESSON_IDS[4]);
  await importFixture(page, ahead);
  await page.keyboard.press("e");
  await page.getByRole("button", { name: "开始限定试用", exact: true }).click();
  await move(page, WIND_LESSONS[3].stand.x, WIND_LESSONS[3].stand.y);
  await face(page, "w");
  await chain(page);
  await expect.poll(async () => (await read(page)).state.skills.swordWindStage).toBe(5);
  await expect(page.locator(".dialog-copy")).toContainText("学会 三向疾风斩");
  await restored(page, 5);
  expect((await read(page)).skillGrowth.trial).toBeNull();
  expect((await read(page)).skillGrowth.ability).toBe("三向疾风斩");
  await face(page, "w");
  await chain(page, async () => {
    const winds = (await read(page)).skillGrowth.winds;
    expect(winds).toHaveLength(3);
    expect(new Set(winds.map((w: any) => w.releaseId)).size).toBe(1);
    await page.screenshot({ path: ".skill-growth-local/wind-prerequisite-three.png" });
  });
  await page.keyboard.press("q");
  await expect(page.locator(".skill-journal")).toContainText("五段传承已掌握");
  await expect(page.locator(".skill-journal")).not.toContainText("尚未掌握");
});
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
    // 新预期：本轮版本化迁移后的真实导出为十五版。
    expect(exported.schema_version).toBe(16);
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

// 南部双铃教学迁移后，使用当地果园潜土兽验证真实死亡边界。
test("wind-death-clears-trial", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const l = WIND_LESSONS[3];
  const s = fixture(3, { x: l.x, y: l.y + 25 });
  // 合法已发现果园遭遇存档；未激活的敌人不会在玩家视野内突然出生。
  s.encounters.groups['south-orchard-burrows'].activated=true;
  s.player.hp = 1;
  await importFixture(page, s);
  await page.keyboard.press("e");
  await page.getByRole("button", { name: "开始限定试用", exact: true }).click();
  expect((await read(page)).skillGrowth.trial).toBe(LESSON_IDS[3]);
  // 朝北走入附近果园潜土兽的攻击范围；不改敌人或运行状态。
  // 教本脚底有实体碰撞，先从右侧绕开。
  await page.keyboard.down("d");await page.waitForTimeout(500);await page.keyboard.up("d");
  await page.keyboard.down("w");
  await page.waitForFunction(() => {
    const s = (window as any).__farwind();
    return s.state.player.y < 2380 || s.state.player.hp === 100;
  });
  await page.keyboard.up("w");
  // 潜地虫需要真实近战激怒才追击；单次命中避免击杀后失去死亡样本。
  await face(page,"a");await page.keyboard.press("j");
  await expect.poll(async()=>{
    const e=(await read(page)).skillGrowth.enemies.find((e:any)=>e.id==='wild-orchard-worm-a');return e?.hp;
  }).toBeLessThan(62);
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
        说明: "低生命固定夹具，由南部果园潜土兽实际攻击触发正式死亡／村庄恢复路径，不直接赋零血或调用死亡函数。",
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
  await page.route(/\/assets\/(?:index|game)-.*\.js$/, async (route) => {
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
  await page.route(/\/assets\/(?:index|game)-.*\.js$/, async (route) => {
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
