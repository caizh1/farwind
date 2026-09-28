import { test, expect, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { LIFE } from "../src/data/npcLife";

const evidence =
  process.env.FARWIND_FACING_PRODUCTION === "1"
    ? "guard-facing-production"
    : "guard-facing";
test.use({
  headless: false,
  video: "on",
  viewport: { width: 1440, height: 900 },
});
const read = (page: Page) => page.evaluate(() => (window as any).__farwind());
async function observeUntil(page: Page, y: number) {
  return page.evaluate(async (endY) => {
    const rows: any[] = [],
      start = performance.now();
    while (performance.now() - start < 45000) {
      const s = (window as any).__farwind(),
        g = s.defense.units.find((g: any) => g.id === "north-watch");
      rows.push({
        时间: s.state.life.elapsed,
        横坐标: g.x,
        纵坐标: g.y,
        朝向: g.facing,
        移动: g.moved,
        空间: g.space ?? "village",
        状态: g.mode,
        行动: s.state.life.people.find((n: any) => n.id === g.id).action,
      });
      if (g.y >= endY) break;
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    return rows;
  }, y);
}

// 自然开局、暂停、中途存读档与真实拐弯；不改写运行状态。
test("GUARD-FACING-01", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  await page.bringToFront();
  const first = await observeUntil(page, 375);
  expect(first.at(-1).纵坐标).toBeGreaterThanOrEqual(375);
  const diagonal = first.filter((row: any, i: number) => {
    if (!i) return false;
    const previous = first[i - 1],
      dx = row.横坐标 - previous.横坐标,
      dy = row.纵坐标 - previous.纵坐标;
    return dx > 0.001 && dy > 0.001 && Math.abs(dx - dy) < 1e-7;
  });
  expect(diagonal.length).toBeGreaterThan(20);
  expect([...new Set(diagonal.map((row: any) => row.朝向))]).toEqual([3]);
  expect(first.every((row: any) => row.空间 === "village")).toBe(true);
  // 开局尚未到错峰决策时可以站岗等待；已经开始移动的样本必须在真实取物流程。
  expect(
    first
      .filter((row: any) => row.移动 > 0.001)
      .every((row: any) => row.行动?.phase === "collect"),
  ).toBe(true);
  await page.screenshot({
    path: `docs/npc-life/evidence/${evidence}-diagonal.png`,
  });

  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => (window as any).__farwind().mode === "pause",
  );
  const paused = (await read(page)).state;
  await page.waitForTimeout(600);
  expect((await read(page)).state).toEqual(paused);
  await page.getByRole("button", { name: "保存旅途", exact: true }).click();
  await expect(page.locator("#toast")).toContainText("已保存");
  await page.reload();
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  const restored = (await read(page)).state,
    savedGuard = paused.defense.guards.find((g: any) => g.id === "north-watch"),
    loadedGuard = restored.defense.guards.find(
      (g: any) => g.id === "north-watch",
    );
  // 首次读取允许真实主循环已推进的移动距离，禁止以任意放宽距离代替存档连续性。
  expect(
    Math.hypot(loadedGuard.x - savedGuard.x, loadedGuard.y - savedGuard.y),
  ).toBeLessThanOrEqual(
    ((restored.life.elapsed - paused.life.elapsed) * LIFE.speed) / 1000 + 1e-5,
  );
  expect([restored.bag, restored.coins, restored.quest]).toEqual([
    paused.bag,
    paused.coins,
    paused.quest,
  ]);
  const resumed = await observeUntil(page, 440);
  expect(resumed.at(-1).纵坐标).toBeGreaterThanOrEqual(440);
  let forwardSteps = 0;
  for (let i = 1; i < resumed.length; i++) {
    const a = resumed[i - 1],
      b = resumed[i],
      dx = b.横坐标 - a.横坐标,
      dy = b.纵坐标 - a.纵坐标;
    if (dx > 0.001 && dy > 0.001 && Math.abs(dx - dy) < 1e-7) {
      forwardSteps++;
      // 读档重建路径后允许实际反向：保持朝向轴，但正反方向跟随真实位移。
      expect(b.朝向).toBe(a.朝向 >= 2 ? 3 : 0);
    }
  }
  expect(forwardSteps).toBeGreaterThan(10);
  expect(resumed.at(-1).朝向).toBe(0);
  await page.screenshot({
    path: `docs/npc-life/evidence/${evidence}-turn.png`,
  });
  expect(errors).toEqual([]);
  writeFileSync(
    `docs/npc-life/evidence/${evidence}-browser.json`,
    JSON.stringify(
      {
        说明: "通过新游戏、暂停、保存和继续旅途按钮验证，只读取快照；没有调试快进、导入摆位或修改运行状态。",
        斜向有效样本: diagonal.length,
        斜向动画朝向: [...new Set(diagonal.map((row: any) => row.朝向))],
        暂停冻结: true,
        读档连续: true,
        恢复后有效斜向样本: forwardSteps,
        实际转弯后朝向: resumed.at(-1).朝向,
        页面错误: errors,
        开局: first,
        读档后: resumed,
      },
      null,
      2,
    ),
  );
  const video = page.video()!;
  await page.close();
  await video.saveAs(`docs/npc-life/evidence/${evidence}.webm`);
});
