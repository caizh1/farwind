import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  XIAOBAO_BATTLE_CLIPS as CLIPS,
  XIAOBAO_SKILLS as SKILLS,
} from "../src/data/xiaobaoCombat";
import { move } from "./map-navigation";
import { encounterState } from "./npc-combat-fixtures";
import { initialState, validate } from "../src/game/systems/state";
import { enemyDefs } from "../src/data/world";
import { motionBlocked, clearMeleeLine } from "../src/game/systems/obstacles";
const evidence = "docs/xiaobao/evidence/combat-browser";
test("委托设置真实保存失败：三项控件恢复正式旧值、对话内解释，解除故障后真实保存成功", async ({ page }) => {
  mkdirSync(evidence, { recursive: true });
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      const request = put.call(this, value, key);
      if ((window as any).__abortXiaobaoSetting)
        request.addEventListener("success", () => this.transaction.abort(), { once: true });
      return request;
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "启程 · 新游戏", exact: true }).click();
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  await page.locator("#xiaobao-summary").click();
  await page.evaluate(() => (window as any).__abortXiaobaoSetting = true);
  const gate = page.getByLabel("驻防范围"), tactic = page.getByLabel("小宝战术"), support = page.getByRole("checkbox", { name: "出征时村庄危急自动回援" }), feedback = page.locator(".xiaobao-feedback");
  await gate.selectOption("north-gate");
  await expect(gate).toBeEnabled(); await expect(gate).toHaveValue("all");
  await expect(feedback).toBeVisible();
  const reasons = [await feedback.textContent()];
  await tactic.selectOption("protect");
  await expect(tactic).toBeEnabled(); await expect(tactic).toHaveValue("steady");
  await expect(feedback).toBeVisible(); reasons.push(await feedback.textContent());
  await support.uncheck();
  await expect(support).toBeEnabled(); await expect(support).toBeChecked();
  await expect(feedback).toBeVisible(); reasons.push(await feedback.textContent());
  const failed = await page.evaluate(() => (window as any).__farwind());
  expect(failed.state.xiaobao).toMatchObject({ task: "free", gate: "all", tactic: "steady", autoSupport: true });
  expect(reasons.every(reason => Boolean(reason?.match(/保存|存档/)))).toBe(true);
  await page.screenshot({ path: `${evidence}/setting-save-failure.png` });
  await page.evaluate(() => (window as any).__abortXiaobaoSetting = false);
  await gate.selectOption("north-gate");
  await expect(gate).toBeEnabled(); await expect(gate).toHaveValue("north-gate");
  await page.waitForFunction(() => (window as any).__farwind().state.xiaobao.gate === "north-gate");
  await expect(feedback).toBeHidden();
  const recovered = await page.evaluate(() => (window as any).__farwind());
  writeFileSync(`${evidence}/setting-save-recovery.json`, JSON.stringify({ 结果: "通过", 说明: "仅对实际IndexedDB事务注入中止。真实选择驻防、战术与回援偏好后保留正式旧值，显示拒绝原因；恢复事务后真实保存成功。", 原因: reasons, 失败: failed.state.xiaobao, 恢复: recovered.state.xiaobao }, null, 2) + "\n");
});
test("真实委托错误反馈：无目标施法与委托中演武在宽屏、窄屏均可见且不消费状态", async ({ page }) => {
  mkdirSync(evidence, { recursive: true });
  const errors: string[] = [], records: any[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "启程 · 新游戏", exact: true }).click();
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  await page.locator("#xiaobao-summary").click();
  await page.getByRole("button", { name: "与我出征", exact: true }).click();
  await page.waitForFunction(() => {
    const d = (window as any).__farwind();
    return d.mode === "" && d.state.xiaobao.task === "follow";
  });
  await page.locator("#xiaobao-summary").click();
  for (const [width, height] of [[1280, 800], [600, 420], [320, 700]]) {
    await page.setViewportSize({ width, height });
    const before = await page.evaluate(() => (window as any).__farwind().state.xiaobao);
    await page.getByRole("button", { name: "落石压制", exact: true }).click();
    const feedback = page.locator(".xiaobao-feedback");
    await expect(feedback).toBeVisible();
    await expect(feedback).toHaveText("请先攻击一个仍存活的敌人，再下达指令。");
    const commandReason = await feedback.textContent();
    await page.getByRole("button", { name: "看一套小宗师演武", exact: true }).click();
    await expect(feedback).toBeVisible();
    await expect(feedback).toContainText("请在脱战后解除委托");
    const box = await feedback.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(height + 1);
    const after = await page.evaluate(() => (window as any).__farwind());
    expect(after.state.xiaobao.qi).toBe(before.qi);
    expect(after.state.xiaobao.cooldowns).toEqual(before.cooldowns);
    expect(after.state.xiaobao.command).toBeNull();
    expect(after.mode).toBe("dialog");
    const layout = await feedback.evaluate(e => {
      const p = e.closest(".dialog-copy")!;
      return { 定位: getComputedStyle(e).position, 内容宽: p.scrollWidth, 可见宽: p.clientWidth };
    });
    expect(layout.定位).toBe("static");
    expect(layout.内容宽).toBeLessThanOrEqual(layout.可见宽 + 1);
    await page.screenshot({ path: `${evidence}/command-feedback-${width}.png` });
    records.push({ 宽度: width, 高度: height, 施法原因: commandReason, 演武原因: await feedback.textContent(), 布局: layout, 真气未消费: after.state.xiaobao.qi, 指令: after.state.xiaobao.command });
  }
  expect(errors).toEqual([]);
  writeFileSync(`${evidence}/command-feedback.json`, JSON.stringify({ 结果: "通过", 说明: "真实新游戏、委托随行和点击。拒绝原因显示在对话正文中，窄屏保持正常文档流；未注入目标或角色状态。", 场景: records, 异常: errors }, null, 2) + "\n");
});
test("随行满行囊击退镰灵：唯一结晶落地，真实整理后领取，读档不重奖且主线可继续", async ({
  page,
}) => {
  mkdirSync(evidence, { recursive: true });
  const e = enemyDefs.find((e) => e.type === "leaf")!,
    s = initialState();
  const p = [-65, -55, -45]
    .flatMap((dy) => [0, -20, 20].map((dx) => ({ x: e.x + dx, y: e.y + dy })))
    .find((p) => !motionBlocked(p.x, p.y) && clearMeleeLine(p, e))!;
  Object.assign(s.player, p);
  s.quest = 3;
  s.killed = enemyDefs.filter((v) => v.id !== e.id).map((v) => v.id);
  s.bag = Array.from({ length: 24 }, (_, i) =>
    i === 0 ? { id: "wood", count: 1 } : { id: "stone", count: 20 },
  );
  const spot = [
    { x: p.x + 82, y: p.y + 24 },
    { x: p.x - 82, y: p.y + 24 },
    { x: p.x, y: p.y - 90 },
  ].find((p) => !motionBlocked(p.x, p.y) && clearMeleeLine(p, e))!;
  Object.assign(s.xiaobao, spot, { task: "follow", autoSupport: false });
  const valid = validate(s);
  writeFileSync(
    evidence + "/full-bag-save.json",
    JSON.stringify(valid, null, 2) + "\n",
  );
  await page.goto("/");
  page.once("dialog", (d) => d.accept());
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入存档", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "full-bag-save.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(valid)),
  });
  await page.waitForFunction(
    (id) => (window as any).__farwind().state.killed.includes(id),
    e.id,
    { timeout: 20000 },
  );
  await page.keyboard.press("Escape");
  const read = () => page.evaluate(() => (window as any).__farwind()),
    fallen = await read();
  expect(
    fallen.state.pendingDrops.filter((d: any) => d.enemyId === e.id),
  ).toHaveLength(1);
  expect(fallen.state.bag.filter((i: any) => i?.id === "crystal")).toHaveLength(
    0,
  );
  await page
    .getByRole("button", { name: "保存并返回标题", exact: true })
    .click();
  await page.waitForFunction(
    () => (window as any).__farwind().mode === "title",
  );
  await page.reload();
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  await page.waitForFunction(() => (window as any).__farwind().mode === "");
  const restored = await read();
  expect(
    restored.state.pendingDrops.filter((d: any) => d.enemyId === e.id),
  ).toHaveLength(1);
  // 森林读档后的首帧会保存地理区域转换；等有效时间继续并提交结束，
  // 避免Tab输入被正式保存门禁清空，再按真实快捷键打开行囊。
  await page.waitForFunction((time) => {
    const d = (window as any).__farwind();
    return d.mode === "" && !d.defenseSaving && d.state.time > time + 0.1;
  }, restored.state.time);
  await page.keyboard.press("Tab");
  await page.locator('.bag [data-slot="0"]').click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "丢弃一件", exact: true }).click();
  const cleared = await read();
  writeFileSync(
    evidence + "/full-bag-clear-diagnosis.json",
    JSON.stringify(
      {
        说明: "真实整理行囊后的首因现场",
        整理前: restored.state.bag,
        整理后: cleared.state.bag,
        模式: cleared.mode,
        掉落: cleared.state.pendingDrops,
      },
      null,
      2,
    ) + "\n",
  );
  expect(cleared.state.bag.filter((i: any) => !i)).toHaveLength(1);
  await page.getByRole("button", { name: "收好行囊", exact: true }).click();
  const drop = (await read()).state.pendingDrops.find(
    (d: any) => d.enemyId === e.id,
  );
  await move(page, drop.x, drop.y + 35);
  await page.keyboard.press("e");
  const claimed = await read();
  writeFileSync(
    evidence + "/full-bag-claim-diagnosis.json",
    JSON.stringify({ 说明: "真实E领取后的首因现场", 现场: claimed }, null, 2) +
      "\n",
  );
  await page.waitForFunction(
    () =>
      (window as any)
        .__farwind()
        .state.bag.some((i: any) => i?.id === "crystal"),
    null,
    { timeout: 10000 },
  );
  const collected = await read();
  expect(
    collected.state.pendingDrops.filter((d: any) => d.enemyId === e.id),
  ).toHaveLength(0);
  expect(
    collected.state.bag
      .filter((i: any) => i?.id === "crystal")
      .reduce((n: number, i: any) => n + i.count, 0),
  ).toBe(1);
  expect(collected.state.quest).toBe(4);
  await page.keyboard.press("e");
  expect(
    (await read()).state.bag
      .filter((i: any) => i?.id === "crystal")
      .reduce((n: number, i: any) => n + i.count, 0),
  ).toBe(1);
  await page.screenshot({ path: evidence + "/full-bag-crystal.png" });
  writeFileSync(
    evidence + "/full-bag-crystal.json",
    JSON.stringify(
      {
        结果: "通过",
        说明: "合法历史档只隔离普通镰灵与满行囊；击杀、掉落、暂停保存刷新、真实丢弃和E领取全部由正式游戏推进。",
        落地: fallen.state.pendingDrops,
        恢复: restored.state.pendingDrops,
        领取后: {
          行囊: collected.state.bag,
          主线: collected.state.quest,
          掉落: collected.state.pendingDrops,
        },
      },
      null,
      2,
    ) + "\n",
  );
});
test("飞援提交事务失败：不离地、不消费冷却，保留旧档并允许真实手动重存恢复", async ({
  page,
}) => {
  mkdirSync(evidence, { recursive: true });
  await page.addInitScript(() => {
    (window as any).__abortXiaobaoFlight = true;
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      const request = put.call(this, value, key);
      if (value.xiaobao?.flight?.stage === "takeoff")
        request.addEventListener(
          "success",
          () => {
            if ((window as any).__abortXiaobaoFlight) this.transaction.abort();
          },
          { once: true },
        );
      return request;
    };
  });
  await page.goto("/");
  const state = encounterState();
  Object.assign(state.xiaobao, { task: "guard", x: 1700, y: 1080 });
  state.player.x = 850;
  state.player.y = 610;
  state.defense.raid!.members[0].cooldownMs = 1800;
  page.once("dialog", (d) => d.accept());
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入存档", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "flight-save-failure.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(validate(state))),
  });
  await expect(page.locator("#toast")).toContainText("飞援尚未保存", {
    timeout: 10000,
  });
  const failed = await page.evaluate(() => (window as any).__farwind());
  expect(failed.mode).toBe("pause");
  expect(failed.xiaobao.airborne).toBe(false);
  expect(failed.state.xiaobao.cooldowns.flight).toBe(0);
  const stored = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((ok, no) => {
      const r = indexedDB.open("farwind-save", 1);
      r.onsuccess = () => ok(r.result);
      r.onerror = () => no(r.error);
    });
    const value = await new Promise<any>((ok, no) => {
      const r = db.transaction("states").objectStore("states").get("current");
      r.onsuccess = () => ok(r.result);
      r.onerror = () => no(r.error);
    });
    db.close();
    return value;
  });
  expect(stored.xiaobao.flight).toBeNull();
  await page.screenshot({ path: evidence + "/flight-save-aborted.png" });
  await page.evaluate(() => ((window as any).__abortXiaobaoFlight = false));
  await page.getByRole("button", { name: "保存旅途", exact: true }).click();
  await expect(page.locator("#toast")).toContainText("已保存");
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  await page.waitForFunction(
    () => (window as any).__farwind().xiaobao.airborne,
    null,
    { polling: 5, timeout: 10000 },
  );
  const recovered = await page.evaluate(() => (window as any).__farwind());
  expect(recovered.xiaobao.metrics.flights).toBe(1);
  expect(recovered.state.xiaobao.cooldowns.flight).toBeGreaterThan(29000);
  writeFileSync(
    evidence + "/flight-save-recovery.json",
    JSON.stringify(
      {
        结果: "通过",
        说明: "仅注入IndexedDB事务中止；警报、飞援及所有角色状态由真实游戏推进。失败时地面等待和暂停，上一份有效档保留，真实保存按钮提交成功后离地。",
        失败: failed.xiaobao,
        上一份有效档: stored.xiaobao,
        恢复: recovered.xiaobao,
      },
      null,
      2,
    ) + "\n",
  );
});
test("完整演武：十二技能正式结算、十八动作四朝向、暂停逐帧与有限对象", async ({
  page,
}) => {
  mkdirSync(evidence, { recursive: true });
  const errors: string[] = [],
    assets: string[] = [],
    records: any[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.url().includes("/assets/xiaobao/") && r.status() !== 200)
      assets.push(r.url());
  });
  await page.goto("/xiaobao-combat-preview.html");
  await page.waitForFunction(() =>
    Boolean((window as any).__xiaobaoCombatPreview),
  );
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  const read = () =>
    page.evaluate(() => (window as any).__xiaobaoCombatPreview());
  await page.getByLabel("演武方式").selectOption("clip");
  for (const direction of ["0", "1", "2", "3"]) {
    await page.locator("#facing").selectOption(direction);
    for (const [key, count] of CLIPS) {
      await page.getByLabel("选择动作").selectOption(key);
      const roots = (await read()).runtime;
      const duration = Number(
        await page.getByRole("slider").getAttribute("max"),
      );
      for (const progress of [0, 0.5, 1]) {
        await page.getByRole("slider").fill(String(progress * duration));
        const s = await read();
        expect(s.pose.texture).toBe(
          `xiaobao-battle-${direction === "0" ? "front" : direction === "1" ? "back" : "side"}`,
        );
        expect(s.runtime.x).toBe(roots.x);
        expect(s.runtime.y).toBe(roots.y);
        expect(s.pose.frameIndex).toBeLessThan(count);
        expect(s.pose.frameIndex).toBeGreaterThanOrEqual(0);
      }
    }
  }
  await page.screenshot({
    path: evidence + "/back-action.png",
    fullPage: true,
  });
  await page.getByLabel("演武方式").selectOption("skill");
  await page.locator("#facing").selectOption("3");
  for (const [key, s] of Object.entries(SKILLS)) {
    await page.getByLabel("选择本领").selectOption(key);
    const duration = Number(await page.getByRole("slider").getAttribute("max"));
    await page.getByRole("slider").fill(String(duration));
    const d = await read(),
      damage = d.hits.reduce((n: number, h: any) => n + h.damage, 0);
    if (["guard", "flight"].includes(key)) {
      expect(
        d.runtime.state.shields.some(
          (x: any) => x.id === "player" && x.amount === 120,
        ),
      ).toBe(true);
      if (key === "flight") expect(d.runtime.metrics.flights).toBe(1);
    } else
      expect(damage, s.name).toBeGreaterThanOrEqual(
        Math.min(
          s.damage.reduce((a, b) => a + b, 0),
          600,
        ),
      );
    const frozen = await read();
    await page.waitForTimeout(60);
    expect(await read()).toEqual(frozen);
    expect(d.objects).toBeLessThanOrEqual(14);
    records.push({
      本领: s.name,
      实际伤害: damage,
      命中: d.hits,
      护盾: d.runtime.state.shields,
      飞援次数: d.runtime.metrics.flights,
      对象数: d.objects,
    });
    if (["rock", "fire", "chain", "unity", "flight"].includes(key)) {
      await page
        .getByRole("slider")
        .fill(String(key === "flight" ? 450 : Math.max(0, s.times[0] - 10)));
      await page.screenshot({
        path: evidence + "/" + key + ".png",
        fullPage: true,
      });
    }
  }
  expect(errors).toEqual([]);
  expect(assets).toEqual([]);
  writeFileSync(
    evidence + "/preview.json",
    JSON.stringify(
      {
        结果: "通过",
        动作组数: CLIPS.length,
        方向数: 4,
        逐帧检查次数: CLIPS.length * 4 * 3,
        说明: "独立演武木桩通过正式技能控制器和伤害入口，未写入世界。每组动作检查首、中、末帧，非逐一审美验收504帧。",
        技能: records,
        异常: errors,
        资源错误: assets,
      },
      null,
      2,
    ) + "\n",
  );
});

test("正式危急历史档：真实前线触发飞援、连续巡航、暂停、空中读档与唯一护印", async ({
  page,
}) => {
  mkdirSync(evidence, { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const state = encounterState();
  state.xiaobao.task = "guard";
  state.xiaobao.x = 1700;
  state.xiaobao.y = 1080;
  state.player.x = 850;
  state.player.y = 610;
  state.defense.raid!.members[0].cooldownMs = 1800;
  const valid = validate(state);
  writeFileSync(
    evidence + "/major-encounter-save.json",
    JSON.stringify(valid, null, 2) + "\n",
  );
  page.once("dialog", (dialog) => dialog.accept());
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入存档", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "major-encounter-save.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(valid)),
  });
  const read = () => page.evaluate(() => (window as any).__farwind());
  await page.waitForFunction(
    () => (window as any).__farwind().xiaobao.airborne,
    null,
    { polling: 5, timeout: 10000 },
  );
  const airborne = await read();
  expect(airborne.xiaobao.metrics.flights).toBe(1);
  expect(airborne.state.xiaobao.task).toBe("guard");
  await page.screenshot({ path: evidence + "/world-flight.png" });
  await page.keyboard.press("Escape");
  const frozen = (await read()).xiaobao;
  await page.waitForTimeout(200);
  expect((await read()).xiaobao).toEqual(frozen);
  expect(frozen.state.flight).not.toBeNull();
  await page
    .getByRole("button", { name: "保存并返回标题", exact: true })
    .click();
  await page.waitForFunction(
    () => (window as any).__farwind().mode === "title",
  );
  await page.reload();
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  await page.waitForFunction(() => (window as any).__farwind().mode === "");
  await page.waitForFunction(
    () => (window as any).__farwind().state.xiaobao.flight === null,
    null,
    { timeout: 10000 },
  );
  const landed = await read();
  expect(
    landed.xiaobao.events.filter((e: any) => e.kind === "landing"),
  ).toHaveLength(1);
  expect(landed.state.xiaobao.cooldowns.flight).toBeGreaterThan(28000);
  expect(
    landed.xiaobao.events
      .filter((e: any) => e.kind === "shield")
      .map((e: any) => e.id)
      .every((id: string, i: number, a: string[]) => a.indexOf(id) === i),
  ).toBe(true);
  await page.waitForFunction(
    () => (window as any).__farwind().xiaobao.metrics.hits > 0,
    null,
    { timeout: 15000 },
  );
  await page.screenshot({ path: evidence + "/world-support.png" });
  expect(errors).toEqual([]);
  writeFileSync(
    evidence + "/flight.json",
    JSON.stringify(
      {
        结果: "通过",
        说明: "通过正式导入入口恢复已失守北门的合法历史样本。历史站位与伤亡是测试前提；警报、飞行、落地、伤害和读档均由正式运行产生。独立于正常导演30场，非自然新增重大波次。",
        起飞: airborne.xiaobao,
        保存时: frozen,
        落地: landed.xiaobao,
        最终: (await read()).xiaobao,
        异常: errors,
      },
      null,
      2,
    ) + "\n",
  );
});

test("正式新游戏：界面委托、真实随行、不自动拉怪、参战掉落、暂停与刷新恢复", async ({
  page,
}) => {
  mkdirSync(evidence, { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .getByRole("button", { name: "启程 · 新游戏", exact: true })
    .click();
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  const read = () => page.evaluate(() => (window as any).__farwind());
  await page.locator("#xiaobao-summary").click();
  await page.getByLabel("小宝战术").selectOption("protect");
  await page
    .getByRole("checkbox", { name: "出征时村庄危急自动回援" })
    .uncheck();
  await page.getByRole("button", { name: "与我出征", exact: true }).click();
  await page.waitForFunction(() => (window as any).__farwind().mode === "");
  expect((await read()).state.xiaobao).toMatchObject({
    task: "follow",
    tactic: "protect",
    autoSupport: false,
  });
  const initial = (await read()).xiaobao;
  await move(page, 1420, 850);
  await page.waitForFunction(() => {
    const d = (window as any).__farwind();
    return (
      Math.hypot(
        d.xiaobao.x - d.state.player.x,
        d.xiaobao.y - d.state.player.y,
      ) < 180
    );
  });
  expect(
    Math.hypot(
      (await read()).xiaobao.x - initial.x,
      (await read()).xiaobao.y - initial.y,
    ),
  ).toBeGreaterThan(300);
  await page.screenshot({ path: evidence + "/follow-village.png" });
  await page.waitForTimeout(1000);
  const before = await read();
  expect(before.state.killed).toEqual([]);
  // 正式键盘接近家园怪，由敌人真实锁定队伍；不注入生命、位置或命中。
  await move(page, 2550, 1100);
  await page.waitForFunction(
    () => (window as any).__farwind().xiaobao.metrics.hits > 0,
    null,
    { timeout: 20000 },
  );
  await page.waitForFunction(
    () => (window as any).__farwind().state.killed.length > 0,
    null,
    { timeout: 20000 },
  );
  const fought = await read();
  expect(fought.state.bag).not.toEqual(before.state.bag);
  await page.screenshot({ path: evidence + "/follow-combat.png" });
  await page.keyboard.press("Escape");
  const frozen = (await read()).xiaobao;
  await page.waitForTimeout(300);
  expect((await read()).xiaobao).toEqual(frozen);
  await page
    .getByRole("button", { name: "保存并返回标题", exact: true })
    .click();
  await page.waitForFunction(
    () => (window as any).__farwind().mode === "title",
  );
  await page.reload();
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  await page.waitForFunction(() => (window as any).__farwind().mode === "");
  const restored = await read();
  expect(restored.state.xiaobao).toMatchObject({
    task: "follow",
    tactic: "protect",
    autoSupport: false,
  });
  for (const id of fought.state.killed)
    expect(
      restored.state.killed.filter((saved: string) => saved === id),
    ).toHaveLength(1);
  expect(new Set(restored.state.killed).size).toBe(
    restored.state.killed.length,
  );
  expect(errors).toEqual([]);
  writeFileSync(
    evidence + "/world.json",
    JSON.stringify(
      {
        结果: "通过",
        说明: "真实新游戏、界面委托和键盘旅行参战；未导入战斗样本或注入运行状态。",
        初始: initial,
        参战: fought.xiaobao,
        击退记录: fought.state.killed,
        参战行囊: fought.state.bag,
        恢复: restored.state.xiaobao,
        异常: errors,
      },
      null,
      2,
    ) + "\n",
  );
});
