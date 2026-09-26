import { test, expect } from "@playwright/test";
import { initialState } from "../src/game/systems/state";
import {
  setup,
  face,
  third,
  fourth,
  finish,
  read,
  dir,
  off,
} from "./sword-wind-fixtures";
test("WIND-01", async ({ page }) => {
  test.skip(off, "本例验开发授予；关闭授予有单独用例");
  await setup(page, 0, 0, true);
  await face(page, "d", 3);
  await expect(page.locator("#sword-wind-status")).toHaveText("剑风：测试授予");
  // 正常节奏按键，不依赖内部释放时间驱动；诊断只作事后断言。
  await page.keyboard.press("j");
  await page.waitForTimeout(240);
  await page.keyboard.press("j");
  await page.waitForTimeout(290);
  await page.keyboard.press("j");
  await page.waitForTimeout(370);
  await page.keyboard.press("j");
  await expect
    .poll(
      async () =>
        (await read(page)).swordWind.events.filter(
          (e: any) => e.reason === "target",
        ).length,
    )
    .toBe(1);
  const s = await read(page);
  expect(s.swordWind.events[0].target).toBe("wind-arena-A");
  expect(s.enemies.find((e: any) => e.id === "wind-arena-A").hp).toBe(12);
  expect(s.enemies.find((e: any) => e.id === "wind-arena-B").hp).toBe(48);
  expect(s.state.skills.swordWind).toBe(false);
  await page.screenshot({ path: `${dir}/two-targets-game.png` });
  await page.waitForTimeout(350);
  expect((await read(page)).swordWind.events).toHaveLength(1);
  await finish(
    page,
    "two-targets",
    "独立固定共线敌人夹具；未运行敌人AI；真实键盘、正常节奏、事后只读",
  );
});
test("WIND-02", async ({ page }) => {
  await setup(page, 0, 0, true);
  await face(page, "d", 3);
  await third(page);
  await page.waitForFunction(
    () => (window as any).__farwind().session.combat.stage === 0,
  );
  expect((await read(page)).swordWind.events).toEqual([]);
  await page.waitForTimeout(250);
  await page.keyboard.down("j");
  for (let i = 0; i < 8; i++) await page.keyboard.down("j");
  await page.waitForTimeout(600);
  await page.keyboard.up("j");
  expect((await read(page)).attackSerial).toBe(4);
  expect((await read(page)).swordWind.events).toEqual([]);
  await finish(page, off ? "grant-off-three" : "three-only");
});
test("WIND-03", async ({ page }) => {
  test.skip(off, "关闭授予不接第四击");
  await setup(page);
  for (const [x, y, key, d] of [
    [760, 650, "d", 3],
    [940, 650, "a", 2],
    [850, 570, "s", 0],
    [850, 720, "w", 1],
  ] as const) {
    if (d !== 3) {
      const s = initialState();
      s.quest = 3;
      s.player.x = x;
      s.player.y = y;
      await page.keyboard.press("Escape");
      await page
        .getByRole("button", { name: "保存并返回标题", exact: true })
        .click();
      const chooser = page.waitForEvent("filechooser");
      await page.getByRole("button", { name: "导入存档", exact: true }).click();
      await (
        await chooser
      ).setFiles({
        name: "wind-direction-fixture.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(s)),
      });
      await page.waitForFunction(() => (window as any).__farwind().mode === "");
    }
    await face(page, key, d);
    await third(page);
    await expect
      .poll(async () => (await read(page)).training.complete)
      .toBe(true);
    await fourth(page, d === 3);
    await expect
      .poll(async () => (await read(page)).training.windDamage)
      .toBe(36);
    const s = await read(page);
    expect(s.training.damage).toBe(68);
    expect(s.training.stages).toEqual([1, 2, 3]);
    expect(s.swordWind.events).toHaveLength(1);
    await page.screenshot({ path: `${dir}/direction-${d}.png` });
    await page.waitForFunction(
      () => (window as any).__farwind().session.combat.stage === 0,
    );
  }
  await finish(page, "four-directions");
});
test("WIND-04", async ({ page }) => {
  test.skip(off, "关闭授予不接第四击");
  await setup(page, 670, 720);
  await face(page, "d", 3);
  await third(page);
  await fourth(page);
  await expect
    .poll(async () => (await read(page)).swordWind.events[0]?.reason)
    .toBe("range");
  await page.waitForTimeout(500);
  await face(page, "w", 1);
  await third(page);
  await fourth(page);
  await expect
    .poll(async () => (await read(page)).swordWind.events.at(-1)?.reason)
    .toBe("obstacle");
  expect(
    (await read(page)).swordWind.events.filter(
      (e: any) => e.reason === "target",
    ),
  ).toEqual([]);
  await finish(page, "range-wall");
});
test("WIND-05", async ({ page }) => {
  test.skip(off, "关闭授予不接第四击");
  await setup(page, 0, 0, true);
  await face(page, "d", 3);
  await third(page);
  await fourth(page);
  await page.keyboard.press("k");
  await page.waitForTimeout(500);
  expect((await read(page)).swordWind.events).toEqual([]);
  await page.waitForFunction(
    () => (window as any).__farwind().session.combat.parry === null,
  );
  await third(page);
  await fourth(page);
  await page.keyboard.press("Escape");
  const paused = await read(page);
  await page.waitForTimeout(250);
  expect((await read(page)).session.sim).toBe(paused.session.sim);
  await page.keyboard.press("j");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  expect((await read(page)).swordWind.events).toHaveLength(1);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "保存并返回标题", exact: true })
    .click();
  expect((await read(page)).swordWind.entities).toEqual([]);
  expect((await read(page)).session.combat.buffered).toBe(false);
  await finish(page, "cancel-pause-title");
});
test("WIND-06", async ({ page }) => {
  test.skip(off, "关闭授予不接第四击");
  await setup(page, 850, 720);
  await face(page, "w", 1);
  await page.getByRole("button", { name: "迎风架剑练习", exact: true }).click();
  await page
    .getByRole("button", { name: "慢速教学 · 900毫秒", exact: true })
    .click();
  // 本例为只读诊断辅助输入，另有正常节奏与原生键鼠例，不伪装纯画面判断。
  await page.waitForFunction(
    () => {
      const s = (window as any).__farwind(),
        t = s.parryTraining.predictedContact;
      return t !== null && t - s.session.sim < 145 && t - s.session.sim > 120;
    },
    null,
    { polling: 5 },
  );
  await page.keyboard.press("k");
  await page.waitForFunction(
    () => {
      const s = (window as any).__farwind();
      return (
        s.contacts.some(
          (e: any) => e.result === "normal" || e.result === "perfect",
        ) && s.session.combat.hitStopRemaining > 0
      );
    },
    null,
    { polling: 5 },
  );
  await page.keyboard.press("j");
  await page.waitForFunction(
    () => (window as any).__farwind().session.combat.stage === 2,
  );
  await page.keyboard.press("j");
  await page.waitForFunction(
    () => (window as any).__farwind().session.combat.stage === 3,
  );
  await fourth(page);
  await expect
    .poll(async () => (await read(page)).training.windDamage)
    .toBe(36);
  const frames = await page.evaluate(() => (window as any).__windFrames);
  expect(
    frames.some((f: any) => f.战斗.buffered && f.战斗.hitStopRemaining > 0),
  ).toBe(true);
  expect(frames.some((f: any) => f.战斗.automatic && f.战斗.stage === 1)).toBe(
    true,
  );
  await finish(page, "parry-fourth");
});
test("WIND-07", async ({ page }) => {
  test.skip(!off, "本例只在VITE_DEV_GRANT_SWORD_WIND=0运行");
  await setup(page, 0, 0, true);
  await face(page, "d", 3);
  await expect(page.locator("#sword-wind-status")).toBeHidden();
  expect((await read(page)).swordWind.effective).toBe(false);
  await third(page);
  await page.waitForFunction(() => {
    const s = (window as any).__farwind();
    return (
      s.session.combat.phase === "recovery" &&
      s.animation.hero.phaseProgress > 0.5
    );
  });
  await expect(page.locator("#parry-status")).not.toContainText("第四");
  await page.keyboard.press("j");
  await page.waitForFunction(
    () => (window as any).__farwind().session.combat.stage === 1,
  );
  expect((await read(page)).swordWind.events).toEqual([]);
  await finish(page, "grant-off-restart");
});
test("WIND-09", async ({ page }) => {
  test.skip(off, "关闭授予不接第四击");
  await setup(page, 0, 0, true);
  await face(page, "d", 3);
  for (let n = 0; n < 2; n++) {
    await third(page);
    await fourth(page);
    await page.waitForFunction(
      () => (window as any).__farwind().session.combat.stage === 0,
    );
    await page.waitForTimeout(210);
  }
  const s = await read(page);
  expect(s.enemies.find((e: any) => e.id === "wind-arena-A").hp).toBe(0);
  expect(s.enemies.find((e: any) => e.id === "wind-arena-B").hp).toBe(48);
  expect(
    s.state.killed.filter((id: string) => id === "wind-arena-A"),
  ).toHaveLength(1);
  expect(s.state.bag.find((b: any) => b?.id === "berry")?.count).toBe(1);
  await page.waitForTimeout(300);
  expect(
    (await read(page)).state.killed.filter(
      (id: string) => id === "wind-arena-A",
    ),
  ).toHaveLength(1);
  await finish(page, "death-drop");
});
test("WIND-10", async ({ page }) => {
  test.skip(off, "关闭授予不接第四击");
  await setup(page, 1540, 350);
  await face(page, "s", 0);
  await third(page);
  await fourth(page);
  const id = (await read(page)).session.combat.attackInstanceId;
  await page.waitForFunction(() => {
    const s = (window as any).__farwind();
    return (
      s.session.combat.stage === 4 &&
      s.session.combat.phase === "recovery" &&
      s.animation.hero.phaseProgress > 0.35
    );
  });
  await page.keyboard.press("l");
  await page.waitForFunction(
    () => (window as any).__farwind().session.combat.dashRemaining > 0,
  );
  await expect
    .poll(
      async () =>
        (await read(page)).fieldTraining.find(
          (t: any) => t.id === "field-dummy-south",
        ).windDamage,
    )
    .toBe(36);
  const s = await read(page),
    t = s.fieldTraining.find((t: any) => t.id === "field-dummy-south");
  expect(t.swordWind.attackId).toBe(id);
  expect(s.swordWind.events[0].attackId).toBe(id);
  expect(s.session.combat.stage).toBe(0);
  expect(t.damage).toBe(0);
  await finish(page, "remote-dash-training");
});
test("WIND-11", async ({ page }) => {
  test.skip(off, "关闭授予不接第四击");
  await setup(page, 2220, 1060, false, ["slime-2"]);
  await face(page, "d", 3);
  await third(page);
  await fourth(page);
  await expect
    .poll(async () =>
      (await read(page)).swordWind.events.some(
        (e: any) => e.target === "slime-1",
      ),
    )
    .toBe(true);
  // 此站位前三刀均挥空；原48生命史莱姆承受一次36伤害后应剩12，不制造死亡或掉落。
  const s = await read(page);
  expect(
    s.swordWind.events.find((e: any) => e.target === "slime-1").damage,
  ).toBe(36);
  expect(s.enemies.find((e: any) => e.id === "slime-1").hp).toBe(12);
  expect(s.state.killed.filter((id: string) => id === "slime-1")).toHaveLength(
    0,
  );
  expect(s.state.bag.filter((b: any) => b?.id === "berry")).toEqual([]);
  expect(s.state.player.hp).toBe(100);
  await page.screenshot({ path: `${dir}/adventure-game.png` });
  await finish(
    page,
    "adventure",
    "正式冒险场景＋合法起始存档＋真实键鼠；敌人AI、生命、强度和地图规则未改",
  );
});
