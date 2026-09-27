import { test, expect, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { facilityEncounterState } from "./npc-combat-fixtures";
import { move } from "./map-navigation";
import { approachNpc } from "./npc-navigation";
test.use({ headless: false });
const read = (page: Page) => page.evaluate(() => (window as any).__farwind());
test("真实设施受击：玩家击退、阿禾巡视取料、维修中存取与事实对白", async ({
  page,
}) => {
  test.setTimeout(150000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const state = facilityEncounterState();
  await page.goto("/");
  page.once("dialog", (d) => d.accept());
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入存档", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "facility-encounter.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(state)),
  });
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  await page.waitForFunction(
    () => (window as any).__farwind().state.life.facilities["wind-bell"] < 100,
    null,
    { timeout: 5000 },
  );
  await page.keyboard.press("Escape");
  const damaged = await read(page),
    events = damaged.state.life.events.filter((e: any) => e.kind === "damage");
  expect(events.length).toBeGreaterThan(0);
  expect(
    events.every(
      (e: any) => !e.debug && e.source === state.defense.raid!.members[0].id,
    ),
  ).toBe(true);
  expect(
    damaged.state.life.people[2].memories.some((m: any) => m.kind === "damage"),
  ).toBe(false);
  await page.waitForTimeout(250);
  expect((await read(page)).state.life).toEqual(damaged.state.life);
  await page.getByRole("button", { name: "保存旅途", exact: true }).click();
  await expect(page.locator("#toast")).toContainText("已保存");
  await page.reload();
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  expect((await read(page)).state.life.facilities["wind-bell"]).toBe(
    damaged.state.life.facilities["wind-bell"],
  );
  await move(page, 720, 740);
  await page.screenshot({
    path: "docs/npc-life/evidence/facility-real-hit.png",
  });
  for (
    let i = 0;
    i < 10 && (await read(page)).defense.enemies.some((e: any) => e.hp > 0);
    i++
  ) {
    const s = await read(page),
      enemy = s.defense.enemies.find((e: any) => e.hp > 0),
      hero = s.state.player,
      dx = enemy.x - hero.x,
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
    () => {
      const a = (window as any).__farwind().state.life.people[2].action;
      return a?.kind === "repair" && a.phase === "perform" && a.progress > 1000;
    },
    null,
    { timeout: 90000 },
  );
  await page.screenshot({
    path: "docs/npc-life/evidence/facility-real-repair.png",
  });
  await page.keyboard.press("Escape");
  const working = await read(page),
    a = working.state.life.people[2].action;
  expect(a.kind).toBe("repair");
  expect(a.phase).toBe("perform");
  expect(working.state.life.people[2].gear).toBe("carried");
  expect(working.state.life.people[2].supplies.wood).toBeGreaterThanOrEqual(2);
  expect(working.state.life.people[2].body.space).toBe("village");
  expect(
    Math.hypot(
      working.state.life.people[2].body.x - 720,
      working.state.life.people[2].body.y - 650,
    ),
  ).toBeLessThan(35);
  await page.getByRole("button", { name: "保存旅途", exact: true }).click();
  await expect(page.locator("#toast")).toContainText("已保存");
  await page.reload();
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  const resumed = await read(page);
  expect(resumed.state.life.people[2].action.id).toBe(a.id);
  expect(resumed.state.life.people[2].action.progress).toBeGreaterThanOrEqual(
    a.progress,
  );
  await page.waitForFunction(
    () =>
      (window as any).__farwind().state.life.facilities["wind-bell"] === 100,
    null,
    { timeout: 30000 },
  );
  await page.screenshot({
    path: "docs/npc-life/evidence/facility-real-restored.png",
  });
  await page.keyboard.press("Escape");
  const repaired = await read(page),
    repairs = repaired.state.life.events.filter(
      (e: any) => e.kind === "repair" && e.subjects.includes("wind-bell"),
    );
  expect(repairs.length).toBeGreaterThan(0);
  expect(repairs.every((e: any) => e.source === "carpenter" && !e.debug)).toBe(
    true,
  );
  expect(
    repaired.state.life.stores.wood +
      repaired.state.life.people[2].supplies.wood,
  ).toBe(state.life.stores.wood - repairs.length * 2);
  expect(repaired.state.bag).toEqual(state.bag);
  expect(
    repaired.state.defense.guards
      .filter((g: any) => g.id.startsWith("north-"))
      .every((g: any) => g.dead && g.hp === 0),
  ).toBe(true);
  await page.getByRole("button", { name: "保存旅途", exact: true }).click();
  await expect(page.locator("#toast")).toContainText("已保存");
  await page.reload();
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  const loaded = await read(page);
  expect(
    loaded.state.life.events.filter(
      (e: any) => e.kind === "repair" && e.subjects.includes("wind-bell"),
    ),
  ).toHaveLength(repairs.length);
  expect(
    loaded.state.life.stores.wood + loaded.state.life.people[2].supplies.wood,
  ).toBe(state.life.stores.wood - repairs.length * 2);
  await approachNpc(page, "carpenter");
  await page.keyboard.press("e");
  await expect(page.locator("#dialog-title")).toContainText("阿禾");
  await expect(page.locator("#modal")).toContainText("恢复至100%");
  await page.screenshot({
    path: "docs/npc-life/evidence/facility-real-dialogue.png",
  });
  const url = page.url(),
    production = new URL(url).port === "4183";
  writeFileSync(
    `docs/npc-life/evidence/facility-combat-${production ? "production" : "browser"}.json`,
    JSON.stringify(
      {
        说明: "固定存档已有北门突破与伤亡；本次损坏由真实敌人命中，击退使用键盘，阿禾按日程巡视后真实取料到场。维修中通过暂停菜单保存重载，无调试按钮、无运行状态注入。",
        实际受损: damaged,
        维修中: working,
        继续维修: resumed,
        恢复: repaired,
        重新加载: loaded,
        页面异常: errors,
      },
      null,
      2,
    ),
  );
  expect(errors).toEqual([]);
});
