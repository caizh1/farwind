import { move } from "./map-navigation";
import { test, expect, type Page } from "@playwright/test";
import { props } from "../src/data/world";
const dir = "docs/map-expansion";
const read = (p: Page) => p.evaluate(() => (window as any).__farwind());
async function closeDialog(page: Page) {
  await page.getByRole("button", { name: "继续 · E" }).click();
}
async function interact(page: Page, id: string, x?: number, y?: number) {
  const p = props.find((p) => p.id === id)!;
  await move(page, x ?? p.x, y ?? p.y + 45);
  await expect.poll(async () => (await read(page)).target).toBe(id);
  const sim = (await read(page)).session.sim;
  await page.keyboard.press("e");
  await page.waitForFunction(
    (sim) =>
      (window as any).__farwind().mode === "dialog" ||
      (window as any).__farwind().session.sim > sim + 50,
    sim,
  );
}
test("map-expansion-player-journey", async ({ page }) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  await page.screenshot({ path: `${dir}/plaza.png` });
  await interact(page, "elder", 670, 680);
  await closeDialog(page);
  await interact(page, "carpenter", 330, 1060);
  await closeDialog(page);
  await page.screenshot({ path: `${dir}/living-lane.png` });
  await interact(page, "wood-v1");
  await interact(page, "wood-yard-1");
  await interact(page, "carpenter", 330, 1060);
  await closeDialog(page);
  expect((await read(page)).state.side).toBe(2);
  await interact(page, "berry-v1");
  await interact(page, "orchard-berry-1");
  await page.screenshot({ path: `${dir}/orchard.png` });
  await interact(page, "village-chest", 580, 1510);
  expect((await read(page)).state.chests).toContain("village-chest");
  await move(page, 1280, 1480);
  await page.screenshot({ path: `${dir}/lakeside.png` });
  await move(page, 1090, 1440);
  await move(page, 1090, 960);
  await page.screenshot({ path: `${dir}/bridge.png` });
  await interact(page, "herb-v1", 1180, 560);
  const before = (await read(page)).state.bag
    .filter((p: any) => p?.id === "potion")
    .reduce((n: number, p: any) => n + p.count, 0);
  await interact(page, "healer", 1080, 600);
  await expect(page.locator("#modal")).toContainText("替你调好了");
  await closeDialog(page);
  expect(
    (await read(page)).state.bag
      .filter((p: any) => p?.id === "potion")
      .reduce((n: number, p: any) => n + p.count, 0),
  ).toBe(before + 1);
  await page.screenshot({ path: `${dir}/healer-court.png` });
  await move(page, 1510, 540);
  await page.keyboard.press("w");
  await page.keyboard.press("j");
  await page.waitForTimeout(60);
  await page.keyboard.press("j");
  await page.waitForTimeout(400);
  await page.keyboard.press("j");
  await expect
    .poll(async () => (await read(page)).fieldTraining[0].complete)
    .toBe(true);
  expect((await read(page)).state.killed).toEqual([]);
  await page.screenshot({ path: `${dir}/training-field.png` });
  await move(page, 1880, 980);
  await page.screenshot({ path: `${dir}/village-gate.png` });
  expect((await read(page)).state.quest).toBe(1);
  await page.keyboard.press("m");
  await expect(page.locator("#modal")).toContainText("东北练习场");
  await page.screenshot({ path: `${dir}/world-map.png` });
  await page.getByRole("button", { name: "收起地图" }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "保存旅途", exact: true }).click();
  await expect(page.locator("#toast.show")).toContainText("旅途已保存");
  await page.reload();
  await page.getByRole("button", { name: "继续旅途" }).click();
  expect((await read(page)).state.chests).toContain("village-chest");
  expect((await read(page)).state.side).toBe(2);
  expect((await read(page)).state.collected["berry-v1"]).toBeDefined();
  expect((await read(page)).state.player.x).toBeGreaterThan(1850);
  await page.keyboard.down("d");
  try {
    await expect(page.locator("#modal")).toContainText("林间异响", {
      timeout: 5000,
    });
  } finally {
    await page.keyboard.up("d");
  }
  expect((await read(page)).state.quest).toBe(3);
  expect(errors).toEqual([]);
});
