import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { initialState } from "../src/game/systems/state";
import { VILLAGE_BOUNDS } from "../src/data/village";
const directory = `${process.env.FARWIND_EVIDENCE_ROOT ?? "docs/village-defense/m1/evidence"}/corners`;
test("四个村墙角真实斜走与风步仍由连续碰撞阻挡", async ({ page }) => {
  await mkdir(directory, { recursive: true });
  const { left, right, top, bottom } = VILLAGE_BOUNDS;
  const cases = [
    { id: "north-west", x: left + 80, y: top + 80, keys: ["a", "w"] },
    { id: "north-east", x: right - 80, y: top + 80, keys: ["d", "w"] },
    { id: "south-west", x: left + 80, y: bottom - 80, keys: ["a", "s"] },
    { id: "south-east", x: right - 80, y: bottom - 80, keys: ["d", "s"] },
  ];
  await page.goto("/");
  const records = [];
  for (const c of cases) {
    const state = initialState();
    state.player.x = c.x;
    state.player.y = c.y;
    page.once("dialog", (d) => d.accept());
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "导入存档" }).click();
    await (
      await chooser
    ).setFiles({
      name: "corner-fixture.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(state)),
    });
    await page.waitForFunction(() => (window as any).__farwind().mode === "");
    const before = await page.evaluate(() => (window as any).__farwind());
    expect(
      Math.hypot(before.state.player.x - c.x, before.state.player.y - c.y),
    ).toBeLessThan(1);
    for (const key of c.keys) await page.keyboard.down(key);
    await page.keyboard.press("l");
    await expect
      .poll(
        async () =>
          (await page.evaluate(() => (window as any).__farwind())).session
            .combat.dashCooldownRemaining,
      )
      .toBeGreaterThan(0);
    const dash = await page.evaluate(() => (window as any).__farwind());
    const expected = {
      x: c.x < (left + right) / 2 ? left + 23 : right - 23,
      y: c.y < (top + bottom) / 2 ? top + 21 : bottom - 21,
    };
    // 保持斜向输入直到实际触墙；低帧率不能让尚未抵达墙角的样本假通过。
    await expect.poll(async () => {
      const p = (await page.evaluate(() => (window as any).__farwind())).state.player;
      return Math.max(Math.abs(p.x - expected.x), Math.abs(p.y - expected.y));
    }, { timeout: 12000 }).toBeLessThan(2);
    await page.waitForTimeout(200);
    for (const key of c.keys) await page.keyboard.up(key);
    const after = await page.evaluate(() => (window as any).__farwind());
    expect(after.state.player.x).toBeGreaterThanOrEqual(left + 23 - 0.2);
    expect(after.state.player.x).toBeLessThanOrEqual(right - 23 + 0.2);
    expect(after.state.player.y).toBeGreaterThanOrEqual(top + 21 - 0.2);
    expect(after.state.player.y).toBeLessThanOrEqual(bottom - 21 + 0.2);
    expect(
      Math.hypot(after.state.player.x - c.x, after.state.player.y - c.y),
    ).toBeGreaterThan(30);
    records.push({
      墙角: c.id,
      开始: before.state.player,
      停止: after.state.player,
      风步已执行: dash.session.combat.dashCooldownRemaining > 0,
      风步开始冷却: dash.session.combat.dashCooldownRemaining,
      检查结束冷却: after.session.combat.dashCooldownRemaining,
    });
    await page.screenshot({ path: `${directory}/${c.id}.png` });
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "保存并返回标题" }).click();
  }
  await writeFile(
    `${directory}/corners.json`,
    JSON.stringify(
      {
        说明: "仅导入合法站位，四角斜向移动与风步由真实键盘输入产生。",
        样本: records,
      },
      null,
      2,
    ),
  );
});
