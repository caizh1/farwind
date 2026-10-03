import { test, expect } from '@playwright/test';

test('世界地图开放门禁、区域导航与暂停返回', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: '启程 · 新游戏' }).click();
  await page.keyboard.press('m');
  await expect(page.getByRole('heading', { name: '世界地图', exact: true })).toBeVisible();
  await expect(page.locator('[data-atlas-region]')).toHaveCount(9);
  const before = await page.evaluate(() => (window as any).__farwind().state);
  for (const marker of await page.locator('[data-atlas-region]:not([data-atlas-region="forest"])').all()) {
    await marker.click();
    await expect(page.locator('#atlas-region-status')).toHaveText('暂未开放');
    await expect(page.locator('#atlas-enter')).toBeDisabled();
  }
  expect(await page.evaluate(() => (window as any).__farwind().state)).toEqual(before);
  await page.locator('[data-atlas-region="forest"]').click();
  await page.getByRole('button', { name: '查看区域地图' }).click();
  await expect(page.locator('#world-map')).toBeVisible();
  await expect(page.locator('[data-camp-status]')).toHaveCount(4);
  await page.getByRole('button', { name: '大陆全貌', exact: true }).click();
  for (const [width, height] of [[1280, 720], [1440, 900], [800, 600], [390, 844], [320, 640]]) {
    await page.setViewportSize({ width, height });
    await page.locator('#close').scrollIntoViewIfNeeded();
    expect(await page.locator('.atlas-panel').evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
    await expect(page.locator('#close')).toBeInViewport();
  }
  await page.keyboard.press('m');
  await expect(page.locator('#modal')).toBeHidden();
  await page.keyboard.press('Escape');
  await page.locator('#pause-map').click();
  await page.locator('#atlas-local').click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: '在风中歇一会儿' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#modal')).toBeHidden();
  expect(errors).toEqual([]);
});
