import { test, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { move } from "./map-navigation";
import { VILLAGE_PORTALS, portalAnchor } from "../src/data/village";
import { props } from "../src/data/world";
import { initialState } from "../src/game/systems/state";
const directory = process.env.FARWIND_EVIDENCE_ROOT
  ? `${process.env.FARWIND_EVIDENCE_ROOT}/passages`
  : "docs/village-defense/m1/evidence";
const read = (p: Page) => p.evaluate(() => (window as any).__farwind());
async function importFixture(
  page: Page,
  state: ReturnType<typeof initialState>,
) {
  page.once("dialog", (d) => d.accept());
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入存档" }).click();
  await (
    await chooser
  ).setFiles({
    name: "passage-fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(state)),
  });
  await page.waitForFunction(() => (window as any).__farwind().mode === "");
}
test("真实输入通过三门，北南不触发森林任务，主角和黑猫返回，西门与两柱实际阻挡", async ({
  page,
}) => {
  await mkdir(directory, { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  await move(page, 670, 680);
  await page.keyboard.press("e");
  await page.getByRole("button", { name: "继续 · E" }).click();
  const samples: any[] = [];
  for (const id of ["north-gate", "south-gate", "east-gate"]) {
    const gate = VILLAGE_PORTALS.find((p) => p.id === id)!;
    const inside = portalAnchor(gate, false),
      outside = portalAnchor(gate, true);
    await move(page, inside.x, inside.y);
    await move(page, outside.x, outside.y);
    await expect
      .poll(
        async () => {
          const s = await read(page);
          return gate.axis === "x"
            ? s.companion.x > gate.x + 15
            : gate.id === "north-gate"
              ? s.companion.y < gate.y - 15
              : s.companion.y > gate.y + 15;
        },
        { timeout: 8000 },
      )
      .toBe(true);
    const snapshot = await read(page);
    expect(snapshot.companion.blocked).toBe(false);
    expect(snapshot.region).toBe(
      gate.id === "north-gate"
        ? "北部山路"
        : gate.id === "south-gate"
          ? "南部荒野"
          : "翡翠森林",
    );
    expect(snapshot.state.quest).toBe(gate.id === "east-gate" ? 2 : 1);
    samples.push({
      门: id,
      主角: snapshot.state.player,
      黑猫: snapshot.companion,
      区域: snapshot.region,
      主线: snapshot.state.quest,
    });
    await page.screenshot({ path: `${directory}/${id}-passage.png` });
    await move(page, inside.x, inside.y);
  }
  await move(page, 170, 1430);
  await page.keyboard.down("a");
  try {
    await expect
      .poll(async () => (await read(page)).state.player.x, { timeout: 8000 })
      .toBeLessThan(110);
  } finally {
    await page.keyboard.up("a");
  }
  let snapshot = await read(page);
  expect(snapshot.state.player.x).toBeGreaterThanOrEqual(103 - 0.1);
  expect(snapshot.state.player.x).toBeLessThan(110);
  await page.screenshot({ path: `${directory}/west-gate-blocked.png` });
  expect(snapshot.state.map_version).toBe(3);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "保存旅途", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  snapshot = await read(page);
  expect(snapshot.state.quest).toBe(2);
  expect(snapshot.state.map_version).toBe(3);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "保存并返回标题" }).click();
  for (const gate of VILLAGE_PORTALS.filter((p) => p.open))
    for (const side of [0, 1]) {
      const post = props.find((p) => p.id === `${gate.id}-post-${side}`)!;
      const fixture = initialState();
      fixture.player.x = gate.axis === "x" ? post.x - 100 : post.x;
      fixture.player.y = gate.axis === "y" ? post.y - 100 : post.y - 13;
      await importFixture(page, fixture);
      await page.keyboard.down(gate.axis === "x" ? "d" : "s");
      const expected = gate.axis === "x" ? post.x - 31 : post.y - 36;
      try {
        await expect
          .poll(
            async () =>
              Math.abs((await read(page)).state.player[gate.axis] - expected),
            { timeout: 8000 },
          )
          .toBeLessThan(2);
        await page.waitForTimeout(200);
      } finally {
        await page.keyboard.up(gate.axis === "x" ? "d" : "s");
      }
      const s = await read(page);
      expect(Math.abs(s.state.player[gate.axis] - expected)).toBeLessThan(2);
      await page.screenshot({
        path: `${directory}/${gate.id}-post-${side}.png`,
      });
      samples.push({ 门柱: post.id, 停止位置: s.state.player });
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "保存并返回标题" }).click();
    }
  expect(errors).toEqual([]);
  await writeFile(
    `${directory}/passages.json`,
    JSON.stringify(
      {
        说明: "所有位移及碰撞由正式键盘输入产生；门柱夹具经正式存档导入。",
        样本: samples,
        页面错误: errors,
      },
      null,
      2,
    ),
  );
});
test("版本2被村墙占用的位置就近恢复，任务背包保持，正常模式无工程标签", async ({
  page,
}) => {
  await page.goto("/");
  const fixture = initialState();
  fixture.map_version = 2;
  fixture.player.x = 2100;
  fixture.player.y = 1400;
  fixture.quest = 2;
  fixture.side = 1;
  fixture.bag[0] = { id: "wood", count: 4 };
  fixture.collected = { "herb-v1": 479 };
  await importFixture(page, fixture);
  const s = await read(page);
  expect(
    Math.hypot(s.state.player.x - 2100, s.state.player.y - 1400),
  ).toBeLessThan(160);
  expect(s.state.player.x).toBeLessThan(2100);
  expect(s.state.map_version).toBe(3);
  expect(s.state.quest).toBe(2);
  expect(s.state.side).toBe(1);
  expect(s.state.bag).toEqual(fixture.bag);
  expect(s.state.collected).toEqual(fixture.collected);
  expect(s.layoutLabels).toBe(0);
});
