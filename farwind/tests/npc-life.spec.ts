import { prepareRaid } from "../src/game/systems/defense";
import { test, expect, type Page } from "@playwright/test";
import { initialState } from "../src/game/systems/state";
import { NpcLife } from "../src/game/systems/npcLife";
import { EastDefense } from "../src/game/systems/defense";
import { FACILITIES } from "../src/data/npcLife";
import { mkdirSync, writeFileSync } from "node:fs";
import { move } from "./map-navigation";
test.use({ headless: false });
const read = (page: Page) => page.evaluate(() => (window as any).__farwind());
async function start(page: Page) {
  await page.goto("/?npcDebug=1");
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  expect((await read(page)).state.schema_version).toBe(6);
  expect((await read(page)).state.life.people.length).toBe(12);
}
async function advance(page: Page) {
  await page.getByRole("button", { name: "推进1小时", exact: true }).click();
  await page.waitForFunction(
    () => (window as any).__farwind().state.life.elapsed > 39000,
  );
}
async function roomMove(page: Page, x: number, y: number) {
  for (const [axis, target] of [
    ["x", x],
    ["y", y],
  ] as const) {
    const current = (await read(page)).state.player[axis],
      sign = Math.sign(target - current);
    if (Math.abs(target - current) < 5) continue;
    const key = axis === "x" ? (sign > 0 ? "d" : "a") : sign > 0 ? "s" : "w";
    await page.keyboard.down(key);
    try {
      await page.waitForFunction(
        ({ axis, target, sign }) =>
          sign * ((window as any).__farwind().state.player[axis] - target) > -4,
        { axis, target, sign },
        { timeout: 8000 },
      );
    } finally {
      await page.keyboard.up(key);
    }
  }
}
test("补给演练：药房装药中保存、重载、真实领取和到场救护", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const state = initialState();
  state.time = 540;
  state.life.playerSpace = "healer-home";
  Object.assign(state.player, { x: 830, y: 845 });
  const life = new NpcLife(state, new EastDefense(state.defense, 0)),
    healer = state.life.people[1];
  healer.gear = "carried";
  Object.assign(
    healer.body!,
    FACILITIES.find((f) => f.id === "pharmacy")!.place,
  );
  life.begin(
    healer,
    life.candidates(healer).find((c) => c.facility === "pharmacy")!,
  );
  healer.action!.phase = "perform";
  await page.goto("/?npcDebug=1");
  page.once("dialog", (d) => d.accept());
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入存档" }).click();
  await (
    await chooser
  ).setFiles({
    name: "medicine-work-save.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(state)),
  });
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  await page.getByRole("button", { name: "NPC 调试", exact: true }).click();
  await page.getByLabel("观察居民").selectOption("elder");
  await page.getByRole("button", { name: "调试伤情", exact: true }).click();
  await page.getByRole("button", { name: "NPC 调试", exact: true }).click();
  await page.waitForFunction(
    () =>
      (window as any).__farwind().state.life.people[1].action?.phase ===
      "stock",
  );
  const mid = await read(page),
    n = mid.state.life.people[1];
  expect(n.body.space).toBe("healer-home");
  expect(Math.hypot(n.body.x - 830, n.body.y - 800)).toBeLessThan(6);
  expect(n.supplies.medicine).toBe(0);
  expect(mid.state.life.stores.medicine).toBe(state.life.stores.medicine);
  await page.screenshot({
    path: "docs/npc-life/evidence/medicine-collection.png",
  });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "保存旅途", exact: true }).click();
  await expect(page.locator("#toast")).toContainText("已保存");
  await page.reload();
  await page.getByRole("button", { name: "继续旅途" }).click();
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  await page.waitForFunction(
    () =>
      (window as any).__farwind().state.life.people[1].supplies.medicine === 2,
  );
  const stocked = await read(page);
  expect(stocked.state.life.stores.medicine).toBe(
    mid.state.life.stores.medicine - 2,
  );
  expect(stocked.state.bag).toEqual(mid.state.bag);
  await page.waitForFunction(
    () =>
      (window as any)
        .__farwind()
        .state.life.events.some((e: any) => e.kind === "care"),
    null,
    { timeout: 90000 },
  );
  const recovered = await read(page);
  expect(recovered.state.life.people[1].supplies.medicine).toBe(1);
  expect(
    recovered.state.life.events.filter((e: any) => e.kind === "care"),
  ).toHaveLength(1);
  expect(
    recovered.state.life.events.some(
      (e: any) => e.kind === "injury" && e.debug,
    ),
  ).toBe(true);
  const care = recovered.state.life.events.find((e: any) => e.kind === "care");
  // 伤者可以先回家休养；救护必须与实际双方处于同一空间，不能假定只能室外救治。
  expect(care.place.space).toBe(recovered.state.life.people[0].body.space);
  expect(care.place.space).toBe(recovered.state.life.people[1].body.space);
  expect(
    Math.hypot(
      recovered.state.life.people[1].body.x - care.place.x,
      recovered.state.life.people[1].body.y - care.place.y,
    ),
  ).toBeLessThan(45);
  expect(errors).toEqual([]);
});
test("居民真实日常、动态位置、药房室内与存档恢复", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  await page.getByRole("button", { name: "NPC 调试", exact: true }).click();
  await advance(page);
  await page.waitForFunction(() => {
    const n = (window as any).__farwind().state.life.people[1];
    return (
      n.body.space === "healer-home" &&
      n.action?.kind === "work" &&
      n.action.phase === "perform"
    );
  });
  let snap = await read(page);
  expect(snap.state.life.people[1].body.space).toBe("healer-home");
  expect(snap.state.life.people[1].action.kind).toBe("work");
  await page.getByRole("button", { name: "NPC 调试", exact: true }).click();
  await move(page, 1110, 570);
  snap = await read(page);
  expect(snap.target).not.toBe("healer");
  await move(page, 1110, 460);
  await page.keyboard.press("e");
  await page.waitForFunction(
    () => (window as any).__farwind().state.life.playerSpace === "healer-home",
  );
  await roomMove(page, 830, 835);
  await page.keyboard.press("e");
  await expect(page.locator("#dialog-title")).toContainText("小满");
  await expect(
    page.getByRole("button", { name: "查看药师服务" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "继续 · E" }).click();
  mkdirSync("docs/npc-life/evidence", { recursive: true });
  await page.screenshot({ path: "docs/npc-life/evidence/pharmacy.png" });
  const before = await read(page);
  await page.keyboard.press("j");
  expect((await read(page)).attackSerial).toBe(before.attackSerial);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "保存旅途", exact: true }).click();
  await expect(page.locator("#toast")).toContainText("已保存");
  await page.reload();
  await page.getByRole("button", { name: "继续旅途" }).click();
  await page.waitForFunction(
    () => (window as any).__farwind().state.life.playerSpace === "healer-home",
  );
  expect((await read(page)).state.defense.sequence).toBe(
    before.state.defense.sequence,
  );
  await roomMove(page, 700, 910);
  await page.keyboard.press("e");
  await page.waitForFunction(
    () => (window as any).__farwind().state.life.playerSpace === "village",
  );
  expect(errors).toEqual([]);
});
test("和平轮休真实进入营房，森林敌人不取消全村日常", async ({ page }) => {
  const old: any = initialState();
  old.schema_version = 5;
  delete old.life;
  old.time = 1140;
  await page.goto("/?npcDebug=1");
  page.once("dialog", (d) => d.accept());
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入存档" }).click();
  await (
    await chooser
  ).setFiles({
    name: "guard-evening-save.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(old)),
  });
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  await page.getByRole("button", { name: "NPC 调试", exact: true }).click();
  await advance(page);
  const snap = await read(page);
  expect(snap.state.life.alarm).toBeLessThan(2);
  const sleeping = snap.state.defense.guards.filter(
    (g: any) => g.space === "barracks" && g.offDuty,
  );
  expect(sleeping.length).toBeGreaterThan(0);
  for (const prefix of ["east", "north", "south"])
    expect(
      snap.state.defense.guards.filter(
        (g: any) => g.id.startsWith(prefix) && g.offDuty,
      ).length,
    ).toBeLessThanOrEqual(1);
  for (const g of sleeping) {
    const n = snap.state.life.people.find((n: any) => n.id === g.id);
    expect(n.body).toBeNull();
    expect(n.action.kind).toBe("sleep");
    expect(n.action.phase).toBe("perform");
  }
  await page.getByRole("button", { name: "NPC 调试", exact: true }).click();
  await move(page, 1980, 670);
  await page.keyboard.press("e");
  await page.waitForFunction(
    () => (window as any).__farwind().state.life.playerSpace === "barracks",
  );
  await page.screenshot({ path: "docs/npc-life/evidence/barracks.png" });
});
test("开发演练：配药中断、集结、到场救护、维修与恢复", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  await page.getByRole("button", { name: "NPC 调试", exact: true }).click();
  await advance(page);
  await page.waitForFunction(() => {
    const n = (window as any).__farwind().state.life.people[1];
    return (
      n.action?.kind === "work" &&
      n.action.phase === "perform" &&
      n.action.facility === "pharmacy"
    );
  });
  expect((await read(page)).state.life.people[1].action.kind).toBe("work");
  await page.getByRole("button", { name: "调试集结警报", exact: true }).click();
  await page.waitForFunction(
    () => (window as any).__farwind().state.life.alarm === 2,
  );
  await page.waitForFunction(
    () => (window as any).__farwind().state.life.people[1].gear === "carried",
  );
  await page.getByLabel("观察居民").selectOption("elder");
  await page.getByRole("button", { name: "调试伤情", exact: true }).click();
  await page
    .getByRole("button", { name: "调试木工台损坏", exact: true })
    .click();
  await page.getByLabel("观察居民").selectOption("carpenter");
  await page.getByRole("button", { name: "观察人物", exact: true }).click();
  await page.getByRole("button", { name: "NPC 调试", exact: true }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "docs/npc-life/evidence/facility-damage.png" });
  await page.getByRole("button", { name: "NPC 调试", exact: true }).click();
  await advance(page);
  await advance(page);
  let snap = await read(page);
  expect(snap.state.life.events.some((e: any) => e.kind === "care")).toBe(true);
  expect(snap.state.life.events.some((e: any) => e.kind === "repair")).toBe(
    true,
  );
  expect(snap.state.life.facilities.workbench).toBe(100);
  expect(snap.state.life.alarm).toBe(0);
  expect(snap.state.life.people[0].body.health).not.toBe("down");
  await page.getByRole("button", { name: "NPC 调试", exact: true }).click();
  mkdirSync("docs/npc-life/evidence", { recursive: true });
  await page.screenshot({ path: "docs/npc-life/evidence/recovery.png" });
  expect(errors).toEqual([]);
});

test("旧档真实导入、死亡保留、夜间床位、暂停与失焦冻结", async ({
  page,
  context,
}) => {
  const old: any = initialState();
  old.schema_version = 5;
  delete old.life;
  old.time = 1320;
  old.coins = 73;
  Object.assign(old.defense.guards[0], { hp: 0, dead: true, mode: "dead" });
  old.defense.guards[1].hp = 67;
  await page.goto("/?npcDebug=1");
  page.once("dialog", (d) => d.accept());
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入存档" }).click();
  await (
    await chooser
  ).setFiles({
    name: "npc-old-save.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(old)),
  });
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  let snap = await read(page);
  expect(snap.state.schema_version).toBe(6);
  expect(snap.state.coins).toBe(73);
  expect(snap.state.defense.guards[0].dead).toBe(true);
  expect(snap.state.defense.guards[1].hp).toBeLessThan(75);
  await page.getByRole("button", { name: "NPC 调试", exact: true }).click();
  await advance(page);
  await advance(page);
  snap = await read(page);
  expect(snap.state.life.people[0].body.space).toBe("elder-home");
  expect(snap.state.life.people[0].action.kind).toBe("sleep");
  expect(snap.state.life.people[0].action.phase).toBe("perform");
  await page.getByRole("button", { name: "NPC 调试", exact: true }).click();
  await move(page, 550, 650);
  await page.keyboard.press("e");
  await page.getByRole("button", { name: "继续 · E" }).click();
  await page.keyboard.press("e");
  await page.waitForFunction(
    () => (window as any).__farwind().state.life.playerSpace === "elder-home",
  );
  await page.screenshot({ path: "docs/npc-life/evidence/night-home.png" });
  await page.keyboard.press("Escape");
  const paused = (await read(page)).state;
  await page.waitForTimeout(800);
  expect((await read(page)).state).toEqual(paused);
  await page.keyboard.press("Escape");
  const focus = await context.newCDPSession(page);
  await focus.send("Emulation.setFocusEmulationEnabled", { enabled: false });
  const other = await context.newPage();
  await other.goto("about:blank");
  await other.bringToFront();
  await page.waitForFunction(
    () => (window as any).__farwind().mode === "pause",
    null,
    { polling: 100, timeout: 5000 },
  );
  const blurred = (await read(page)).state;
  await page.waitForTimeout(800);
  expect((await read(page)).state).toEqual(blurred);
  await focus.send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await focus.detach();
  await other.close();
  await page.bringToFront();
  expect((await read(page)).state.defense.guards[0].dead).toBe(true);
});
test("室内观察不会重置室外来袭，居民笔记与性能采样", async ({ page }) => {
  await start(page);
  await page.getByRole("button", { name: "NPC 调试", exact: true }).click();
  await page.getByRole("button", { name: "东门来袭演练", exact: true }).click();
  await page.waitForFunction(
    () => (window as any).__farwind().state.defense.raid !== null,
  );
  const sequence = (await read(page)).state.defense.sequence;
  await page.getByRole("button", { name: "NPC 调试", exact: true }).click();
  await move(page, 1110, 460);
  await page.keyboard.press("e");
  await page.waitForFunction(
    () => (window as any).__farwind().state.life.playerSpace === "healer-home",
  );
  const hp = (await read(page)).state.player.hp;
  await page.waitForTimeout(1200);
  expect((await read(page)).state.defense.sequence).toBe(sequence);
  expect((await read(page)).state.player.hp).toBe(hp);
  await page.getByRole("button", { name: "居民笔记 · N" }).click();
  await expect(page.locator("#dialog-title")).toHaveText("居民笔记");
  await expect(page.locator("#modal")).toContainText("小满");
  await expect(page.locator("#modal")).toContainText("配药与接待");
  await page.getByRole("button", { name: "继续 · E" }).click();
  await page.waitForTimeout(3000);
  const snap = await read(page),
    times = snap.fps
      .map((f: number) => 1000 / f)
      .sort((a: number, b: number) => a - b);
  writeFileSync(
    "docs/npc-life/evidence/browser-performance.json",
    JSON.stringify(
      {
        说明: "软件图形浏览器短样本，含室外来袭与室内观察，不能作为目标设备帧率承诺。",
        样本帧数: times.length,
        中位帧毫秒: times[Math.floor(times.length * 0.5)],
        九五分位毫秒: times[Math.floor(times.length * 0.95)],
        生活指标: snap.npcLife.metrics,
        预约: snap.state.life.reservations.length,
        事件队列: snap.state.life.events.length,
      },
      null,
      2,
    ),
  );
});

test("真实驻防命中形成伤情，小满携箱到场执行救治", async ({ page }) => {
  const state = initialState();
  state.time = 600;
  state.defense = prepareRaid(state.defense, state.player, "east-gate");
  // 与已验证的固定模拟一致：岑风保持正常健康，青禾保留旧伤，新的伤情仍由敌人命中。
  state.defense.guards[0].hp = 180;
  state.defense.guards[1].hp = 75;
  await page.goto("/?npcDebug=1");
  page.once("dialog", (d) => d.accept());
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入存档" }).click();
  await (
    await chooser
  ).setFiles({
    name: "npc-real-injury.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(state)),
  });
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  await page.waitForFunction(
    () => {
      const s = (window as any).__farwind();
      return s.state.life.events.some(
        (e: any) => e.kind === "injury" && !e.debug,
      );
    },
    null,
    { timeout: 60000 },
  );
  try {
    await page.waitForFunction(
      () => {
        const n = (window as any).__farwind().state.life.people[1];
        return (
          n.action?.kind === "treat" &&
          n.action.phase === "perform" &&
          n.body.space === "village"
        );
      },
      null,
      { timeout: 90000 },
    );
  } catch (error) {
    const snap = await read(page);
    writeFileSync(
      "docs/npc-life/evidence/natural-care-failure.json",
      JSON.stringify(
        {
          说明: "保留真实驻防救护等待失败的首因状态，没有改生命、冻结角色或跳过断言。",
          时间: snap.state.time,
          药师: snap.state.life.people[1],
          卫兵: snap.state.defense.guards,
          库存: snap.state.life.stores,
          任务: snap.state.life.tasks,
          事件: snap.state.life.events,
          诊断: snap.npcLife,
        },
        null,
        2,
      ),
    );
    throw error;
  }
  await page.getByRole("button", { name: "NPC 调试", exact: true }).click();
  await page.getByLabel("观察居民").selectOption("healer");
  await page.getByRole("button", { name: "观察人物", exact: true }).click();
  await page.getByRole("button", { name: "NPC 调试", exact: true }).click();
  await page.screenshot({ path: "docs/npc-life/evidence/natural-care.png" });
  await page.waitForFunction(
    () =>
      (window as any)
        .__farwind()
        .state.life.events.some((e: any) => e.kind === "care" && !e.debug),
    null,
    { timeout: 10000 },
  );
  const snap = await read(page);
  expect(snap.state.life.stores.medicine).toBeLessThan(12);
  expect(snap.state.defense.guards.every((g: any) => !g.dead)).toBe(true);
  writeFileSync(
    "docs/npc-life/evidence/natural-browser.json",
    JSON.stringify(
      {
        说明: "固定起始旧伤75生命和已有来袭，新的伤害由正式敌人命中产生；没有点击调试伤情、警报或快进。",
        事件: snap.state.life.events
          .filter((e: any) => ["injury", "care", "clear"].includes(e.kind))
          .map((e: any) => ({
            编号: e.id,
            类型: e.kind,
            时间: e.time,
            调试: e.debug,
            结果: e.result,
            参与者: e.subjects,
          })),
        药品: snap.state.life.stores.medicine,
      },
      null,
      2,
    ),
  );
});

test("私人储物真实查看、物品随身、午饭前归还与读档", async ({ page }) => {
  await start(page);
  await page.getByRole("button", { name: "NPC 调试", exact: true }).click();
  await advance(page);
  await advance(page);
  expect((await read(page)).state.life.people[1].gear).toBe("carried");
  await page.getByRole("button", { name: "NPC 调试", exact: true }).click();
  await move(page, 1110, 460);
  await page.keyboard.press("e");
  await page.waitForFunction(
    () => (window as any).__farwind().state.life.playerSpace === "healer-home",
  );
  await roomMove(page, 510, 535);
  await page.keyboard.press("e");
  await expect(page.locator("#dialog-title")).toContainText("小满的储物箱");
  await expect(page.locator("#dialog-text")).toContainText("主人已取出携带");
  const before = (await read(page)).state;
  await page.getByRole("button", { name: "继续 · E" }).click();
  await page.getByRole("button", { name: "NPC 调试", exact: true }).click();
  await advance(page);
  await advance(page);
  await page.waitForFunction(
    () => (window as any).__farwind().state.life.people[1].gear === "locker",
  );
  await page.getByRole("button", { name: "NPC 调试", exact: true }).click();
  await page.keyboard.press("e");
  await expect(page.locator("#dialog-text")).toContainText("存放在箱中");
  expect((await read(page)).state.bag).toEqual(before.bag);
  await page.getByRole("button", { name: "继续 · E" }).click();
  await page.screenshot({ path: "docs/npc-life/evidence/private-storage.png" });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "保存旅途", exact: true }).click();
  await expect(page.locator("#toast")).toContainText("已保存");
  await page.reload();
  await page.getByRole("button", { name: "继续旅途" }).click();
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  expect((await read(page)).state.life.version).toBe(3);
  expect((await read(page)).state.life.people[1].gear).toBe("locker");
});

test("床位演练：小满沿路入住旅馆备用床，室内存档保留而室外继续", async ({
  page,
}) => {
  const old: any = initialState();
  old.schema_version = 5;
  delete old.life;
  old.time = 1310;
  await page.goto("/?npcDebug=1");
  page.once("dialog", (d) => d.accept());
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入存档" }).click();
  await (
    await chooser
  ).setFiles({
    name: "lodging-evening-save.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(old)),
  });
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  await page.getByRole("button", { name: "NPC 调试", exact: true }).click();
  await page.getByLabel("观察居民").selectOption("healer");
  await page.getByRole("button", { name: "调试床位开关", exact: true }).click();
  expect((await read(page)).state.life.people[1].body.space).not.toBe("inn");
  await advance(page);
  let snap = await read(page);
  expect(snap.state.life.people[1].body.space).toBe("inn");
  expect(snap.state.life.people[1].action.phase).toBe("perform");
  expect(snap.state.life.people[1].action.facility).toContain("guest-bed:");
  await page.getByRole("button", { name: "NPC 调试", exact: true }).click();
  await move(page, 1550, 1640);
  await page.keyboard.press("e");
  await page.waitForFunction(
    () => (window as any).__farwind().state.life.playerSpace === "inn",
  );
  await page.screenshot({ path: "docs/npc-life/evidence/inn-fallback.png" });
  const elapsed = (await read(page)).state.life.elapsed;
  await page.waitForFunction(
    (t) => (window as any).__farwind().state.life.elapsed > t + 500,
    elapsed,
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "保存旅途", exact: true }).click();
  await expect(page.locator("#toast")).toContainText("已保存");
  await page.reload();
  await page.getByRole("button", { name: "继续旅途" }).click();
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  snap = await read(page);
  expect(snap.state.life.playerSpace).toBe("inn");
  expect(snap.state.life.unavailable.facilities).toContain("bed:healer");
  expect(snap.state.life.people[1].body.space).toBe("inn");
  await roomMove(page, 700, 910);
  await page.keyboard.press("e");
  await page.waitForFunction(
    () => (window as any).__farwind().state.life.playerSpace === "village",
  );
});
