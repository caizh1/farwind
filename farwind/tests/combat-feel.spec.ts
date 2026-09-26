import { test, expect } from "@playwright/test";
test.use({ video: "on" });
test("固定早按与乱按：单击不自动续刀，最多预约一刀，停手收剑，移动立即退出", async ({
  page,
}) => {
  await page.goto("/?animationDebug=1");
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  await page.waitForFunction(
    () =>
      (window as any).__farwind?.().mode === "" &&
      (window as any).__farwind().session.sim > 500,
  );
  await page.keyboard.down("d");
  await page.waitForTimeout(100);
  await page.keyboard.up("d");
  await page.evaluate(() => {
    (window as any).__feel = [];
    setInterval(() => {
      const s = (window as any).__farwind();
      (window as any).__feel.push({
        id: s.session.combat.attackInstanceId,
        stage: s.session.combat.stage,
        phase: s.animation.hero.phase,
        texture: s.animation.hero.texture,
        trail: s.session.combat.trailSamples,
      });
    }, 8);
  });
  await page.keyboard.press("j");
  await page.waitForTimeout(780);
  expect(
    (await page.evaluate(() => (window as any).__farwind())).attackSerial,
  ).toBe(1);
  // 两个独立用例之间等待真实收剑结束；接招序列内部仍保持固定墙钟输入。
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).__feel.some(
          (s: any) => s.phase === "settle" && s.texture === "hero-combat-side",
        ),
      ),
    )
    .toBe(true);
  await page.waitForFunction(
    () => (window as any).__farwind().animation.hero.phase === "idle",
  );
  await page.keyboard.press("j");
  await page.waitForTimeout(60);
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("j");
    await page.waitForTimeout(15);
  }
  await page.waitForTimeout(850);
  await page.waitForFunction(
    () => (window as any).__farwind().animation.hero.phase === "idle",
  );
  const s = await page.evaluate(() => (window as any).__farwind());
  expect(s.attackSerial).toBe(3);
  const trace = await page.evaluate(() => (window as any).__feel);
  expect(trace.some((s: any) => s.stage === 2)).toBe(true);
  expect(
    trace.some(
      (s: any) => s.phase === "settle" && s.texture === "hero-combat-side",
    ),
  ).toBe(true);
  expect(trace.some((s: any) => s.trail > 5)).toBe(true);
  await page.keyboard.press("j");
  await page.waitForTimeout(350);
  await page.waitForFunction(
    () => (window as any).__farwind().animation.hero.phase === "ready",
  );
  // 方向和普通移动前置条件独立验证；固定60ms接招仍不读取合法窗口。
  await page.keyboard.down("d");
  const before = await page.evaluate(() => (window as any).__farwind());
  await page.waitForTimeout(120);
  const after = await page.evaluate(() => (window as any).__farwind());
  await page.keyboard.up("d");
  const simulated = (after.session.sim - before.session.sim) / 1000;
  expect(simulated).toBeGreaterThan(0);
  expect(after.state.player.x - before.state.player.x).toBeCloseTo(
    150 * simulated,
    1,
  );
  await page.screenshot({ path: "docs/combat-feel/evidence/input-move.png" });
});

// 两个明确标识的导入夹具，只设置起点；敌人、碰撞、伤害仍走真实游戏链路。
import { initialState } from "../src/game/systems/state";
async function importArena(
  page: any,
  x: number,
  y: number,
  killed: string[] = [],
) {
  const fixture = initialState();
  fixture.player.x = x;
  fixture.player.y = y;
  fixture.quest = 3;
  fixture.killed = killed;
  page.on("dialog", (d: any) => d.accept());
  await page.goto("/");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入存档" }).click();
  await (
    await chooser
  ).setFiles({
    name: "combat-feel-fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await page.waitForFunction(
    () =>
      (window as any).__farwind?.().mode === "" &&
      (window as any).__farwind().session.sim > 200,
  );
}
const sample = (page: any) => page.evaluate(() => (window as any).__farwind());
function westBank(y: number) {
  const t = (y - 650) / 930;
  return (
    (1 - t) ** 3 * 2020 +
    3 * (1 - t) ** 2 * t * 1940 +
    3 * (1 - t) * t * t * 2100 +
    t ** 3 * 1970 -
    40
  );
}
test("隔离河岸夹具：风步与普攻踏步不穿障碍，范围内隔岸敌人不受伤", async ({
  page,
}) => {
  await importArena(page, 1950, 1240);
  await page.keyboard.down("d");
  await page.keyboard.press("Space");
  await page.waitForTimeout(300);
  await page.keyboard.up("d");
  await expect
    .poll(async () => {
      const s = await sample(page),
        e = s.enemies.find((e: any) => e.id === "slime-2");
      return Math.hypot(e.x - s.state.player.x, e.y - s.state.player.y);
    })
    .toBeLessThan(92);
  const before = await sample(page),
    hp = before.enemies.find((e: any) => e.id === "slime-2").hp;
  expect(before.state.player.x).toBeLessThanOrEqual(
    westBank(before.state.player.y),
  );
  await page.keyboard.press("j");
  await page.waitForTimeout(60);
  await page.keyboard.press("j");
  await page.waitForTimeout(250);
  await page.keyboard.press("j");
  await page.waitForTimeout(1300);
  const after = await sample(page);
  expect(after.state.player.x).toBeLessThanOrEqual(
    westBank(after.state.player.y),
  );
  expect(after.enemies.find((e: any) => e.id === "slime-2").hp).toBe(hp);
  await page.screenshot({ path: "docs/combat-feel/evidence/river-wall.png" });
});
test("隔离多目标夹具：引近现有两只史莱姆，同一刀分别命中一次", async ({
  page,
}) => {
  await importArena(page, 2080, 1100, ["leaf-1", "leaf-2"]);
  await page.waitForTimeout(2800);
  await page.keyboard.down("s");
  await page.waitForTimeout(700);
  await page.keyboard.up("s");
  await page.keyboard.down("w");
  await page.waitForTimeout(25);
  await page.keyboard.up("w");
  await expect
    .poll(
      async () => {
        const s = await sample(page),
          p = s.state.player;
        return s.enemies
          .filter((e: any) => e.id.startsWith("slime"))
          .every((e: any) => {
            const d = Math.hypot(e.x - p.x, e.y - p.y);
            return e.hp > 0 && d < 85 && (p.y - e.y) / d > Math.cos(1.12);
          });
      },
      { timeout: 7000, intervals: [50] },
    )
    .toBe(true);
  const before = await sample(page);
  await page.keyboard.press("j");
  await expect
    .poll(async () => {
      const s = await sample(page);
      return s.enemies
        .filter((e: any) => e.id.startsWith("slime"))
        .every((e: any) => e.hp < 48);
    })
    .toBe(true);
  const hit = await sample(page);
  for (const id of ["slime-1", "slime-2"])
    expect(
      before.enemies.find((e: any) => e.id === id).hp -
        hit.enemies.find((e: any) => e.id === id).hp,
    ).toBe(18);
  await page.waitForTimeout(400);
  for (const e of (await sample(page)).enemies.filter((e: any) =>
    e.id.startsWith("slime"),
  ))
    expect(e.hp).toBe(30);
  await page.screenshot({ path: "docs/combat-feel/evidence/multi-target.png" });
});
