import { test, expect, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { initialState } from "../src/game/systems/state";
import {
  clearMotionLine,
  motionBlocked,
  clearMeleeLine,
} from "../src/game/systems/obstacles";
test.use({ video: { mode: "on", size: { width: 1280, height: 720 } } });
const read = (page: Page) => page.evaluate(() => (window as any).__farwind());
async function walk(page: Page, x: number, y: number) {
  for (const [axis, target] of [
    ["x", x],
    ["y", y],
  ] as const) {
    const p = (await read(page)).state.player;
    if (Math.abs(p[axis] - target) < 3) continue;
    const sign = Math.sign(target - p[axis]),
      key = axis === "x" ? (sign > 0 ? "d" : "a") : sign > 0 ? "s" : "w";
    await page.keyboard.down(key);
    try {
      await page.waitForFunction(
        ({ axis, target, sign }) =>
          sign * ((window as any).__farwind().state.player[axis] - target) > -2,
        { axis, target, sign },
        { timeout: 6000 },
      );
    } finally {
      await page.keyboard.up(key);
    }
  }
}
test("隔离实机树边反例：正常出生、换侧、绕障与真实命中，不修改敌人", async ({
  page,
}) => {
  const fixture = initialState();
  fixture.player.x = 3030;
  fixture.player.y = 1010;
  fixture.quest = 4;
  fixture.killed = ["slime-1", "slime-2", "leaf-1"];
  page.on("dialog", (d) => d.accept());
  await page.goto("/?obstacleDebug=1");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入存档" }).click();
  await (
    await chooser
  ).setFiles({
    name: "tree-edge-fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await page.waitForFunction(
    () =>
      (window as any).__farwind().mode === "" &&
      (window as any).__farwind().state.player.x > 3000,
  );
  await page.evaluate(() => {
    (window as any).__obstacleTrace = [];
    (window as any).__obstacleTimer = setInterval(() => {
      const s = (window as any).__farwind();
      (window as any).__obstacleTrace.push({
        时间: s.session.sim,
        玩家: s.state.player,
        敌人: s.enemies[0],
        战斗: s.session.combat,
      });
    }, 16);
  });
  await page.waitForTimeout(2000);
  await walk(page, 3210, 1010);
  await walk(page, 3210, 960);
  await page.keyboard.down("a");
  await page.waitForFunction(
    () => (window as any).__farwind().animation.hero.direction === 2,
  );
  await page.keyboard.up("a");
  await page.keyboard.press("j");
  await expect.poll(async () => (await read(page)).enemies[0].hp).toBe(54);
  await page.screenshot({ path: "docs/obstacle-fix/evidence/edge-hit.png" });
  await page.waitForTimeout(850);
  await walk(page, 3210, 1020);
  await walk(page, 3130, 1020);
  await walk(page, 3130, 993);
  await page.waitForTimeout(900);
  await walk(page, 3060, 993);
  await walk(page, 3060, 930);
  await walk(page, 3130, 930);
  await page.waitForTimeout(2400);
  const trace = await page.evaluate(() => {
    clearInterval((window as any).__obstacleTimer);
    return (window as any).__obstacleTrace;
  });
  const enemyTrace = trace.map((s: any) => s.敌人);
  expect(enemyTrace.some((e: any) => e.ai === "绕障")).toBe(true);
  expect(
    enemyTrace.some(
      (e: any) => e.meleeBlocker === "tree-20" && e.ai !== "前摇",
    ),
  ).toBe(true);
  for (let i = 0; i < trace.length; i++) {
    const e = trace[i].敌人;
    expect(e.recovered).toBe(false);
    expect(e.disabled).toBe(false);
    expect(motionBlocked(e.x, e.y)).toBe(false);
    if (i > 0) expect(clearMotionLine(enemyTrace[i - 1], e)).toBe(true);
    const prior = i ? trace[i - 1].敌人 : null;
    if (e.windup > 0 && (!prior || prior.windup === 0))
      expect(clearMeleeLine(e, trace[i].玩家)).toBe(true);
  }
  await writeFile(
    "docs/obstacle-fix/evidence/isolated-runtime.json",
    JSON.stringify(
      {
        说明: "隔离实机：仅导入玩家起点与其他敌人已死亡进度；叶灵使用正式出生点、AI、生命和碰撞，正常速度真实键盘。",
        轨迹: trace,
      },
      null,
      2,
    ),
  );
  await page.screenshot({
    path: "docs/obstacle-fix/evidence/detour-runtime.png",
  });
  await page.keyboard.press("Escape");
  const paused = await read(page);
  await page.waitForTimeout(350);
  expect((await read(page)).enemies).toEqual(paused.enemies);
  await page.getByRole("button", { name: "保存并返回标题" }).click();
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  expect((await read(page)).state.quest).toBe(fixture.quest);
  expect((await read(page)).state.killed).toEqual(fixture.killed);
  expect((await read(page)).enemies[0].recovered).toBe(false);
});

test("隔离异常掉落旧档：修复安全点、死亡ID不复活、正常领取关键材料与续玩", async ({
  page,
}) => {
  const fixture = initialState();
  fixture.quest = 4;
  fixture.player.x = 3210;
  fixture.player.y = 920;
  fixture.killed = ["slime-1", "slime-2", "leaf-1", "leaf-2"];
  fixture.pendingDrops = [
    { enemyId: "leaf-2", item: "crystal", x: 3130, y: 965 },
  ];
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入存档" }).click();
  await (
    await chooser
  ).setFiles({
    name: "invalid-drop-fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await page.waitForFunction(
    () =>
      (window as any).__farwind().mode === "" &&
      (window as any).__farwind().state.player.x > 3000,
  );
  const s = await read(page),
    drop = s.state.pendingDrops[0];
  expect(s.enemies).toEqual([]);
  expect(s.state.killed).toEqual(fixture.killed);
  expect(motionBlocked(drop.x, drop.y)).toBe(false);
  expect(Math.hypot(drop.x - 3130, drop.y - 965)).toBeLessThan(40);
  await walk(page, drop.x, 920);
  await page.keyboard.press("e");
  await expect
    .poll(async () => (await read(page)).state.pendingDrops.length)
    .toBe(0);
  const state = (await read(page)).state;
  expect(state.bag.some((s: any) => s?.id === "crystal" && s.count === 1)).toBe(
    true,
  );
  expect(state.quest).toBe(4);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "保存并返回标题" }).click();
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  expect((await read(page)).enemies).toEqual([]);
  expect((await read(page)).state.pendingDrops).toEqual([]);
  expect((await read(page)).state.bag).toEqual(state.bag);
});
