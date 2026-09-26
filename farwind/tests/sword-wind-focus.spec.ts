import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { setup, face, finish, read, raw, off } from "./sword-wind-fixtures";
test.use({
  headless: false,
  video: { mode: "on", size: { width: 1280, height: 720 } },
});
test("WIND-08", async ({ page }) => {
  await setup(page, 760, 740);
  await face(page, "d", 3);
  await page.keyboard.press("j");
  await page.waitForFunction(
    () => (window as any).__farwind().session.combat.stage === 1,
  );
  // Playwright默认强制页面获得焦点；仅关闭该浏览器仿真，再以原生标签切换产生真实失焦。
  const focus = await page.context().newCDPSession(page);
  await focus.send("Emulation.setFocusEmulationEnabled", { enabled: false });
  const other = await page.context().newPage();
  await other.goto("about:blank");
  await other.bringToFront();
  await expect(page.getByText("世界与时间已暂停。")).toBeVisible();
  const frozen = (await read(page)).session.sim;
  await page.waitForTimeout(150);
  expect((await read(page)).session.sim).toBe(frozen);
  await other.close();
  await page.bringToFront();
  await focus.send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await focus.detach();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  expect((await read(page)).swordWind.events).toEqual([]);
  await page.keyboard.press("Escape");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出备份", exact: true }).click();
  const file = await download;
  await file.saveAs(`${raw}/save-export.json`);
  const saved = JSON.parse(await readFile(`${raw}/save-export.json`, "utf8"));
  expect(saved.skills).toEqual({ swordWind: false });
  expect(saved).not.toHaveProperty("swordWind");
  expect(saved).not.toHaveProperty("attack");
  await page
    .getByRole("button", { name: "保存并返回标题", exact: true })
    .click();
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  await page.waitForFunction(() => (window as any).__farwind().mode === "");
  const s = await read(page);
  expect(s.state.skills.swordWind).toBe(false);
  expect(s.swordWind.effective).toBe(!off);
  expect(s.swordWind.entities).toEqual([]);
  expect(s.session.combat.buffered).toBe(false);
  await finish(page, off ? "grant-off-save-focus" : "save-focus");
});
