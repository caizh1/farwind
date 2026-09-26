import { move } from "./map-navigation";
import { writeFile } from "node:fs/promises";
import { captureGameAudio } from "../tools/capture-game-audio.mjs";
import { test, expect, type Page } from "@playwright/test";
test.use({ video: "on" });
const snapshot = (p: Page) => p.evaluate(() => (window as any).__farwind());
async function dismiss(p: Page) {
  const s = await snapshot(p);
  if (s.mode === "dialog")
    await p.getByRole("button", { name: "继续 · E" }).click();
  else if (s.mode === "pause")
    await p.getByRole("button", { name: "继续旅途", exact: true }).click();
}
async function interact(p: Page, id: string) {
  await expect.poll(async () => (await snapshot(p)).target).toBe(id);
  await p.keyboard.press("e");
  await p.waitForTimeout(100);
}
test("adventure-loop", async ({ page, context }) => {
  test.setTimeout(300000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(captureGameAudio);
  await page.goto("/");
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  await move(page, 670, 690);
  await interact(page, "elder");
  await dismiss(page);
  await expect.poll(async () => (await snapshot(page)).state.quest).toBe(1);
  await move(page, 1180, 560);
  await interact(page, "herb-v1");
  await move(page, 350, 1410);
  await interact(page, "berry-v1");
  await move(page, 270, 1150);
  await interact(page, "wood-v1");
  await move(page, 1730, 1210);
  await interact(page, "stone-v1");
  await move(page, 2170, 1080);
  await dismiss(page);
  await page.keyboard.press("Tab");
  await page.getByRole("button", { name: "制作恢复药剂", exact: true }).click();
  await page.screenshot({ path: "docs/map-expansion/adventure/inventory.png" });
  await page.getByRole("button", { name: "收好行囊" }).click();
  await expect.poll(async () => (await snapshot(page)).state.quest).toBe(3);
  await page.screenshot({ path: "docs/map-expansion/adventure/forest.png" });
  await move(page, 2500, 1080);
  for (let round = 0; round < 70; round++) {
    await dismiss(page);
    const s = await snapshot(page);
    if (s.state.quest >= 4) break;
    const enemies = s.enemies.filter((e: any) => e.hp > 0),
      target = enemies.find((e: any) => e.id === "leaf-1") ?? enemies[0];
    if (!target) break;
    const dx = target.x - s.state.player.x,
      dy = target.y - s.state.player.y;
    const key =
      Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "d" : "a") : dy > 0 ? "s" : "w";
    await page.keyboard.down(key);
    await page.waitForTimeout(Math.hypot(dx, dy) > 70 ? 180 : 25);
    await page.keyboard.up(key);
    await page.keyboard.press("j");
    await page.waitForTimeout(440);
    if (s.state.player.hp < 60) await page.keyboard.press("1");
  }
  await expect.poll(async () => (await snapshot(page)).state.quest).toBe(4);
  await move(page, 3200, 1100);
  await move(page, 3370, 920);
  await move(page, 3450, 920);
  await move(page, 3450, 680);
  await move(page, 3510, 590);
  await interact(page, "wind-0");
  await move(page, 3730, 500);
  await move(page, 3760, 450);
  await interact(page, "wind-1");
  await move(page, 3950, 510);
  await interact(page, "wind-2");
  await page.screenshot({ path: "docs/map-expansion/adventure/ruins.png" });
  await move(page, 3740, 730);
  await interact(page, "waymark");
  await dismiss(page);
  await expect
    .poll(async () => (await snapshot(page)).state.shortcut)
    .toBe(true);
  await move(page, 3550, 890);
  await interact(page, "shortcut");
  await move(page, 670, 690);
  await interact(page, "elder");
  await dismiss(page);
  await expect.poll(async () => (await snapshot(page)).state.quest).toBe(7);
  await page.keyboard.press("q");
  await page.screenshot({ path: "docs/map-expansion/adventure/quest.png" });
  await page.getByRole("button", { name: "合上手记" }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "保存旅途", exact: true }).click();
  await expect(page.locator("#toast")).toContainText("已保存");
  const before = (await snapshot(page)).state;
  const audio = await page.evaluate(() => (window as any).__finishAudio());
  await writeFile(
    "docs/map-expansion/adventure/forest-audio.webm",
    Buffer.from(audio.base64, "base64"),
  );
  await writeFile(
    "docs/map-expansion/adventure/forest-audio-offset.txt",
    String(audio.offset),
  );
  const video = page.video();
  await page.close();
  await video?.saveAs("docs/map-expansion/adventure/forest-journey.webm");
  const reopened = await context.newPage();
  await reopened.goto("/");
  await reopened.getByRole("button", { name: "继续旅途", exact: true }).click();
  const after = (await snapshot(reopened)).state;
  expect(after.quest).toBe(7);
  expect(after.shortcut).toBe(true);
  expect(after.bag).toEqual(before.bag);
  expect(after.stones).toEqual([0, 1, 2]);
  expect(after.reward).toBe(true);
  expect(errors).toEqual([]);
  await reopened.screenshot({
    path: "docs/map-expansion/adventure/continued.png",
  });
});
