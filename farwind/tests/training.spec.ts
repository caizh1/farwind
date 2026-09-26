import { test, expect, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { captureGameAudio } from "../tools/capture-game-audio.mjs";
import { initialState } from "../src/game/systems/state";
test.use({ video: { mode: "on", size: { width: 1280, height: 720 } } });
const dir = "docs/training-dummy/evidence",
  read = (p: Page) => p.evaluate(() => (window as any).__farwind());
async function walk(p: Page, x: number, y: number) {
  for (const [axis, target] of [
    ["x", x],
    ["y", y],
  ] as const) {
    const before = (await read(p)).state.player[axis];
    if (Math.abs(before - target) < 3) continue;
    const sign = Math.sign(target - before),
      key = axis === "x" ? (sign > 0 ? "d" : "a") : sign > 0 ? "s" : "w";
    await p.keyboard.down(key);
    await p.waitForFunction(
      ({ axis, target, sign }) =>
        sign * ((window as any).__farwind().state.player[axis] - target) > -3,
      { axis, target, sign },
      { timeout: 6000 },
    );
    await p.keyboard.up(key);
  }
}
async function face(p: Page, key: string, d: number) {
  await p.keyboard.down(key);
  await p.waitForFunction(
    (d) => (window as any).__farwind().animation.hero.direction === d,
    d,
  );
  await p.keyboard.up(key);
}
async function combo(p: Page) {
  await p.keyboard.press("j");
  await p.waitForTimeout(60);
  await p.keyboard.press("j");
  await p.waitForTimeout(400);
  await p.keyboard.press("j");
  await expect.poll(async () => (await read(p)).training.complete).toBe(true);
  await expect(p.locator("#training-stats")).toContainText("累计68");
  await p.waitForTimeout(800);
}
test("新游戏四面训练、风步底座、暂停和同页继续：真实输入", async ({ page }) => {
  await page.addInitScript(captureGameAudio);
  await page.goto("/");
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  await page.waitForFunction(
    () => (window as any).__farwind?.().session.sim > 500,
  );
  const before = (await read(page)).state;
  await page.screenshot({ path: `${dir}/spawn.png` });
  await page.evaluate(() => {
    (window as any).__trainingTrace = [];
    (window as any).__trainingTimer = setInterval(() => {
      const s = (window as any).__farwind();
      (window as any).__trainingTrace.push({
        sim: s.session.sim,
        training: s.training,
        combat: s.session.combat,
        hero: s.animation.hero,
        cat: s.companion,
        wallTime: performance.now(),
        player: s.state.player,
      });
    }, 16);
  });
  await walk(page, 850, 720);
  await face(page, "w", 1);
  await page.mouse.click(640, 470);
  await expect.poll(async () => (await read(page)).training.damage).toBe(18);
  await page.waitForTimeout(850);
  expect((await read(page)).training.stages).toEqual([1]);
  await combo(page);
  await page.screenshot({ path: `${dir}/up-combo.png` });
  // 绕底座四面走近：先退开，路线不穿目标，接招使用固定节奏。
  await walk(page, 850, 740);
  await walk(page, 940, 650);
  await face(page, "a", 2);
  await combo(page);
  await page.screenshot({ path: `${dir}/left-combo.png` });
  await walk(page, 960, 650);
  await walk(page, 960, 610);
  await walk(page, 850, 610);
  await walk(page, 850, 570);
  await face(page, "s", 0);
  await combo(page);
  await page.screenshot({ path: `${dir}/down-combo.png` });
  await walk(page, 850, 555);
  await walk(page, 760, 650);
  await face(page, "d", 3);
  await combo(page);
  await page.screenshot({ path: `${dir}/right-combo.png` });
  await walk(page, 760, 740);
  await walk(page, 850, 730);
  await face(page, "w", 1);
  const stamina = (await read(page)).state.player.stamina;
  await page.keyboard.down("w");
  await page.keyboard.press("Space");
  await page.waitForTimeout(300);
  await page.keyboard.up("w");
  const dash = await read(page);
  expect(dash.state.player.y).toBeGreaterThanOrEqual(660);
  expect(dash.state.player.stamina).toBeLessThan(stamina - 10);
  expect(dash.training.damage).toBe(0);
  await page.keyboard.press("j");
  await expect.poll(async () => (await read(page)).training.damage).toBe(18);
  await page.keyboard.press("Escape");
  const paused = await read(page);
  await page.waitForTimeout(350);
  expect((await read(page)).session.sim).toBe(paused.session.sim);
  expect((await read(page)).training).toEqual(paused.training);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(900);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "保存并返回标题" }).click();
  await page.getByRole("button", { name: "继续旅途" }).click();
  await page.waitForFunction(() => (window as any).__farwind().mode === "");
  expect((await read(page)).training.damage).toBe(0);
  expect((await read(page)).trainingTargets).toBe(1);
  await face(page, "w", 1);
  await page.keyboard.press("j");
  await expect.poll(async () => (await read(page)).training.damage).toBe(18);
  const after = (await read(page)).state;
  for (const key of [
    "bag",
    "killed",
    "pendingDrops",
    "quest",
    "side",
    "stones",
    "reward",
    "crafted",
  ])
    expect(after[key]).toEqual(before[key]);
  expect(after.time).toBeGreaterThan(before.time);
  expect(after.player.hp).toBe(before.player.hp);
  const trace = await page.evaluate(() => {
    clearInterval((window as any).__trainingTimer);
    return (window as any).__trainingTrace;
  });
  expect(trace.every((s: any) => !s.cat.blocked)).toBe(true);
  const hits = trace.filter(
    (s: any, i: number) =>
      s.training.damage > 0 &&
      (i === 0 || s.training.lastHit !== trace[i - 1].training.lastHit),
  );
  expect(
    hits.every(
      (s: any) =>
        s.combat.phase === "active" &&
        s.combat.hitTargets.includes("training-dummy"),
    ),
  ).toBe(true);
  expect(new Set(hits.map((s: any) => s.combat.facing)).size).toBe(4);
  await writeFile(`${dir}/runtime-trace.json`, JSON.stringify(trace, null, 2));
  const audio = await page.evaluate(() => (window as any).__finishAudio());
  await writeFile(
    `${dir}/runtime-audio.webm`,
    Buffer.from(audio.base64, "base64"),
  );
  await writeFile(`${dir}/runtime-audio-offset.txt`, String(audio.offset));
  const v = page.video();
  await page.close();
  await v!.saveAs(`${dir}/runtime.webm`);
});
test("隔离旧档满包及死亡恢复夹具：默认单靶存在、再训练不污染进度", async ({
  page,
}) => {
  const fixture: any = initialState();
  fixture.player.hp = 1;
  fixture.player.x = 2260;
  fixture.player.y = 1070;
  fixture.bag = Array.from({ length: 24 }, () => ({ id: "stone", count: 20 }));
  fixture.killed = ["slime-1"];
  delete fixture.pendingDrops;
  delete fixture.dashCooldownRemaining;
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  const choose = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入存档" }).click();
  await (
    await choose
  ).setFiles({
    name: "legacy-full-bag-death.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await expect
    .poll(async () => (await read(page)).state.bag[0]?.count)
    .toBe(20);
  await expect.poll(async () => (await read(page)).state.player.hp).toBe(100);
  expect((await read(page)).state.player.x).toBe(670);
  await page.waitForFunction(
    () => (window as any).__farwind().session.sim > 500,
  );
  const before = (await read(page)).state;
  await walk(page, 850, 720);
  await face(page, "w", 1);
  await combo(page);
  const after = await read(page);
  expect(after.trainingTargets).toBe(1);
  expect(after.training.hp).toBe(1);
  expect(after.state.bag).toEqual(before.bag);
  expect(after.state.killed).toEqual(["slime-1"]);
  expect(after.state.pendingDrops).toEqual([]);
  expect(after.state.quest).toBe(before.quest);
  await page.reload();
  await page.getByRole("button", { name: "继续旅途" }).click();
  await page.waitForFunction(() => (window as any).__farwind().mode === "");
  expect((await read(page)).trainingTargets).toBe(1);
  expect((await read(page)).training.damage).toBe(0);
});
