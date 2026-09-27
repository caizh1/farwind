import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { pharmacyEncounterState } from "./npc-combat-fixtures";
import { move } from "./map-navigation";
test.use({ headless: false });
const read = (page: Page) => page.evaluate(() => (window as any).__farwind());
test("配药中遇真实警报：失能、暂停读档、玩家击退、药箱急救与恢复", async ({
  page,
}) => {
  test.setTimeout(150000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const state = pharmacyEncounterState(8);
  expect(state.life.people[1].action?.phase).toBe("perform");
  expect(state.life.people[1].action?.kind).toBe("work");
  await page.goto("/");
  page.once("dialog", (d) => d.accept());
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入存档", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "civilian-encounter.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(state)),
  });
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  await page.waitForFunction(
    () =>
      (window as any).__farwind().state.life.people[0].body.health === "down",
    null,
    { timeout: 5000 },
  );
  await page.screenshot({
    path: "docs/npc-life/evidence/civilian-real-injury.png",
  });
  await page.keyboard.press("Escape");
  const injured = await read(page),
    patient = injured.state.life.people[0];
  const hits = injured.state.life.events.filter(
    (e: any) =>
      e.kind === "down" && e.source === state.defense.raid!.members[0].id,
  );
  expect(hits).toHaveLength(1);
  expect(hits[0].debug).toBe(false);
  expect(patient.body.hp).toBe(0);
  expect(injured.state.life.people[1].action?.kind).not.toBe("work");
  expect(injured.state.life.stores.herbs).toBe(state.life.stores.herbs);
  await page.waitForTimeout(300);
  expect((await read(page)).state.life).toEqual(injured.state.life);
  mkdirSync("docs/npc-life/evidence", { recursive: true });
  await page.getByRole("button", { name: "保存旅途", exact: true }).click();
  await expect(page.locator("#toast")).toContainText("已保存");
  await page.reload();
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  expect((await read(page)).state.life.people[0].body.hp).toBe(0);
  expect(
    (await read(page)).state.defense.guards
      .filter((g: any) => g.id.startsWith("north-"))
      .every((g: any) => g.dead),
  ).toBe(true);
  await move(page, 850, 600);
  // 读取敌人的实际位置选择面向，按键只改变玩家行动。
  for (
    let i = 0;
    i < 10 && (await read(page)).defense.enemies.some((e: any) => e.hp > 0);
    i++
  ) {
    const snap = await read(page),
      enemy = snap.defense.enemies.find((e: any) => e.hp > 0),
      hero = snap.state.player;
    const dx = enemy.x - hero.x,
      dy = enemy.y - hero.y;
    const key =
      Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "d" : "a") : dy > 0 ? "s" : "w";
    await page.keyboard.down(key);
    await page.waitForTimeout(Math.hypot(dx, dy) > 65 ? 160 : 30);
    await page.keyboard.press("j");
    await page.keyboard.up(key);
    await page.waitForTimeout(650);
  }
  expect((await read(page)).defense.enemies.every((e: any) => e.hp === 0)).toBe(
    true,
  );
  await page.waitForFunction(
    () =>
      (window as any)
        .__farwind()
        .state.life.events.some(
          (e: any) => e.kind === "care" && e.subjects.includes("elder"),
        ),
    null,
    { timeout: 80000 },
  );
  const cared = await read(page),
    care = cared.state.life.events.find(
      (e: any) => e.kind === "care" && e.subjects.includes("elder"),
    );
  expect(care.source).toBe("healer");
  expect(care.debug).toBe(false);
  expect(cared.state.life.people[0].body.health).toBe("convalescent");
  expect(cared.state.life.people[1].supplies.medicine).toBe(1);
  expect(cared.state.bag).toEqual(state.bag);
  await page.screenshot({
    path: "docs/npc-life/evidence/civilian-real-care.png",
  });
  expect(
    cared.state.life.people[1].memories.some((m: any) => m.eventId === care.id),
  ).toBe(true);
  // 休养需要三小时游戏时间，不要求长时间实等：通过正式开发快进同时推进移动、战斗与生活。
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "保存旅途", exact: true }).click();
  await expect(page.locator("#toast")).toContainText("已保存");
  await page.goto("/?npcDebug=1");
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  // 验证刚刚通过正式暂停菜单保存的救护进度。
  await page.waitForFunction(
    () =>
      (window as any).__farwind().state.life.people[0].body.health ===
      "convalescent",
    null,
    { timeout: 80000 },
  );
  await page.getByRole("button", { name: "NPC 调试", exact: true }).click();
  for (let i = 0; i < 3; i++) {
    const before = (await read(page)).state.life.elapsed;
    await page.getByRole("button", { name: "推进1小时", exact: true }).click();
    await page.waitForFunction(
      (before) =>
        (window as any).__farwind().state.life.elapsed >= before + 40000,
      before,
    );
    await page.waitForFunction(
      () => !(window as any).__farwind().defenseSaving,
    );
  }
  await page.getByRole("button", { name: "NPC 调试", exact: true }).click();
  const recovered = await read(page);
  expect(recovered.state.life.people[0].body.health).toBe("healthy");
  expect(
    recovered.state.life.events.filter(
      (e: any) => e.kind === "care" && e.subjects.includes("elder"),
    ),
  ).toHaveLength(1);
  expect(
    recovered.state.defense.guards
      .filter((g: any) => g.id.startsWith("north-"))
      .every((g: any) => g.dead && g.hp === 0),
  ).toBe(true);
  await page.screenshot({
    path: "docs/npc-life/evidence/civilian-real-recovery.png",
  });
  writeFileSync(
    "docs/npc-life/evidence/civilian-combat-browser.json",
    JSON.stringify(
      {
        说明: "固定导入样本含既有北门伤亡与已突破敌人，不能称作随机自然开局；伤情来自未修改的运行攻击几何，玩家击退使用真实键盘；三小时恢复最后使用公开开发快进，并非实时等待。",
        样本: state,
        实际失能: injured,
        实际救治: cared,
        恢复: recovered,
        页面异常: errors,
      },
      null,
      2,
    ),
  );
  expect(errors).toEqual([]);
});
