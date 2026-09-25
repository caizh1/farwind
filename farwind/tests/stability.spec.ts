import { test, expect } from "@playwright/test";
const state = (page: any) => page.evaluate(() => (window as any).__farwind());
test("pause-input-and-save-file-validation", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "继续旅途", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  await page.getByRole("button", { name: /^1 恢复药剂/ }).click({ delay: 250 });
  await expect(page.locator("#toast")).toContainText("生命充足");
  const attacks = (await state(page)).attackSerial;
  await page.locator(".vitals").click();
  expect((await state(page)).attackSerial).toBe(attacks);
  await page.locator("#game canvas").click({ position: { x: 640, y: 370 } });
  await expect
    .poll(async () => (await state(page)).attackSerial)
    .toBe(attacks + 1);
  await page.keyboard.press("Escape");
  await expect(page.getByText("世界与时间已暂停。")).toBeVisible();
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByRole("slider").press("End");
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await expect(page.getByRole("slider")).toHaveValue("100");
  await page.getByRole("button", { name: "返回", exact: true }).click();
  const before = (await state(page)).state;
  await page.keyboard.down("d");
  await page.waitForTimeout(350);
  await page.keyboard.up("d");
  expect((await state(page)).state).toEqual(before);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入存档", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "broken-save.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"schema_version":999}'),
  });
  await expect(page.locator("#toast")).toContainText("损坏或版本不兼容");
  expect((await state(page)).state).toEqual(before);
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("heading", { name: "旅人的行囊" })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.locator("#modal")).toBeHidden();
  await page.keyboard.press("Escape");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出备份" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("farwind-save.json");
  await download.saveAs("docs/test-evidence/exported-save.json");
});
