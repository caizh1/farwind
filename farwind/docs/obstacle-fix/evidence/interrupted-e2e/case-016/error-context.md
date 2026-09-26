# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stability.spec.ts >> pause-input-and-save-file-validation
- Location: tests/stability.spec.ts:3:1

# Error details

```
Error: expect(locator).toBeDisabled() failed

Locator: getByRole('button', { name: '继续旅途', exact: true })
Expected: disabled
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeDisabled" getByRole('button', { name: '继续旅途', exact: true }) with timeout 5000ms
  - waiting for getByRole('button', { name: '继续旅途', exact: true })

```

```yaml
- status
- text: 远 风 之 地
- heading "风正在捎来故事" [level=1]
- paragraph: 正在装载风铃村素材……
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | const state = (page: any) => page.evaluate(() => (window as any).__farwind());
  3  | test("pause-input-and-save-file-validation", async ({ page }) => {
  4  |   await page.goto("/");
  5  |   await expect(
  6  |     page.getByRole("button", { name: "继续旅途", exact: true }),
> 7  |   ).toBeDisabled();
     |     ^ Error: expect(locator).toBeDisabled() failed
  8  |   await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  9  |   await page.getByRole("button", { name: /^1 恢复药剂/ }).click({ delay: 250 });
  10 |   await expect(page.locator("#toast")).toContainText("生命充足");
  11 |   const attacks = (await state(page)).attackSerial;
  12 |   await page.locator(".vitals").click();
  13 |   expect((await state(page)).attackSerial).toBe(attacks);
  14 |   await page.locator("#game canvas").click({ position: { x: 640, y: 370 } });
  15 |   await expect
  16 |     .poll(async () => (await state(page)).attackSerial)
  17 |     .toBe(attacks + 1);
  18 |   await page.keyboard.press("Escape");
  19 |   await expect(page.getByText("世界与时间已暂停。")).toBeVisible();
  20 |   await page.getByRole("button", { name: "设置", exact: true }).click();
  21 |   await page.getByRole("slider").press("End");
  22 |   await page.getByRole("button", { name: "返回", exact: true }).click();
  23 |   await page.getByRole("button", { name: "设置", exact: true }).click();
  24 |   await expect(page.getByRole("slider")).toHaveValue("100");
  25 |   await page.getByRole("button", { name: "返回", exact: true }).click();
  26 |   const before = (await state(page)).state;
  27 |   await page.keyboard.down("d");
  28 |   await page.waitForTimeout(350);
  29 |   await page.keyboard.up("d");
  30 |   expect((await state(page)).state).toEqual(before);
  31 |   const chooser = page.waitForEvent("filechooser");
  32 |   await page.getByRole("button", { name: "导入存档", exact: true }).click();
  33 |   await (
  34 |     await chooser
  35 |   ).setFiles({
  36 |     name: "broken-save.json",
  37 |     mimeType: "application/json",
  38 |     buffer: Buffer.from('{"schema_version":999}'),
  39 |   });
  40 |   await expect(page.locator("#toast")).toContainText("损坏或版本不兼容");
  41 |   expect((await state(page)).state).toEqual(before);
  42 |   await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  43 |   await page.keyboard.press("Tab");
  44 |   await expect(page.getByRole("heading", { name: "旅人的行囊" })).toBeVisible();
  45 |   await page.keyboard.press("Tab");
  46 |   await expect(page.locator("#modal")).toBeHidden();
  47 |   await page.keyboard.press("Escape");
  48 |   const downloading = page.waitForEvent("download");
  49 |   await page.getByRole("button", { name: "导出备份" }).click();
  50 |   const download = await downloading;
  51 |   expect(download.suggestedFilename()).toBe("farwind-save.json");
  52 |   await download.saveAs("docs/combat/regression/exported-save.json");
  53 | });
  54 | 
```