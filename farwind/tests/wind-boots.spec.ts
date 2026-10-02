import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { move as navigate } from './skill-navigation';
// 共享机器负载会让按键释放晚于采样；偏离转折后由真实当前位置重新规划。
const move = (page: Page, x: number, y: number) => navigate(page, x, y, async () => {});
import { VILLAGE_ANCHORS } from '../src/data/maps/windbell/layout';
import { props } from '../src/data/world';
const root = 'docs/wind-boots/after';
test.beforeEach(({ page }) => { page.on('dialog', dialog => dialog.accept()); });
const read = (page: Page) => page.evaluate(() => (window as any).__farwind());
async function resume(page: Page) {
  await page.keyboard.press('Escape');
  if ((await read(page)).mode === 'pause') await page.locator('#close').click();
  await page.waitForFunction(() => (window as any).__farwind().mode === '');
}
async function shop(page: Page, id: 'smith' | 'general') {
  await move(page, VILLAGE_ANCHORS[id].x, VILLAGE_ANCHORS[id].y + 65);
  await page.keyboard.press('e'); await expect(page.locator('.shop-panel')).toBeVisible();
}
async function speed(page: Page, running = false) {
  await move(page, 670, 720);
  // 只读模拟时间与实际坐标，真实按键移动；没有注入速度或位置。
  if (running) await page.keyboard.down('Space');
  await page.keyboard.down('d'); await page.waitForTimeout(60);
  const before = await read(page); await page.waitForTimeout(350); const after = await read(page);
  await page.keyboard.up('d'); if (running) await page.keyboard.up('Space');
  return (after.state.player.x - before.state.player.x) / ((after.skillGrowth.sim - before.skillGrowth.sim) / 1000);
}
async function gather(page: Page, id: string) {
  const prop = props.find(p => p.id === id)!;
  await move(page, prop.x, prop.y + 40); await page.keyboard.press('e');
  await expect.poll(async () => (await read(page)).state.collected[id]).toBeDefined();
  await page.waitForTimeout(280);
}
test('wind-boots-normal-flow', async ({ page }) => {
  await mkdir(root, { recursive: true }); const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await page.getByRole('button', { name: '启程 · 新游戏', exact: true }).click();
  await page.waitForFunction(() => (window as any).__farwind().mode === '');
  const walk = await speed(page), run = await speed(page, true);
  expect(walk).toBeCloseTo(150, 0); expect(run).toBeCloseTo(235, 0);
  await shop(page, 'smith'); await page.locator('[data-item="windBoots"]').click();
  expect((await read(page)).state.coins).toBe(120);
  await expect(page.locator('#shop-feedback')).toContainText('金币不足');
  await expect(page.locator('#shop-review')).toBeDisabled();
  await page.screenshot({ path: root + '/cannot-afford.png' }); await resume(page);
  const herbs = ['herb-v1', 'herb-garden-1', 'herb-garden-2'];
  // 三轮正常再生采集与一轮木材采集，出售价值66金币；不改游戏时间和状态。
  for (let round = 0; round < 3; round++) {
    if (round) {
      const collected = (await read(page)).state.collected;
      const ready = Math.max(...herbs.map(id => collected[id])) + 180;
      await page.waitForFunction(time => (window as any).__farwind().state.time >= time, ready, { timeout: 150000 });
    }
    for (const id of herbs) await gather(page, id);
    if (!round) for (const id of ['wood-yard-1', 'wood-yard-2', 'wood-v1']) await gather(page, id);
  }
  await shop(page, 'general'); await page.locator('[data-flow="sell"]').click();
  for (const id of ['herb', 'wood']) {
    await page.locator(`[data-item="${id}"]`).click(); await page.locator('#shop-max').click();
    await page.locator('#shop-review').click(); await page.locator('#shop-confirm').click();
    await expect(page.locator('#shop-feedback')).toContainText('已完成并保存');
  }
  expect((await read(page)).state.coins).toBe(186); await resume(page);
  await shop(page, 'smith'); await page.locator('[data-item="windBoots"]').click();
  await page.locator('#shop-review').click(); await page.locator('#shop-confirm').click();
  await expect(page.locator('#shop-feedback')).toContainText('已完成并保存');
  expect((await read(page)).state.coins).toBe(6); await page.screenshot({ path: root + '/purchased.png' }); await resume(page);
  expect(await speed(page)).toBeCloseTo(walk, 0);
  await page.keyboard.press('Tab'); await page.locator('#bag-equipment').click();
  await page.locator('[data-equipment-slot="feet"]').click(); await page.locator('#equipment-equip').click();
  await expect.poll(async () => (await read(page)).state.equipment.feet).toBe('windBoots');
  await expect(page.locator('.equipment-effect')).toContainText('25%');
  await page.screenshot({ path: root + '/equipped.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  const bounds = await page.locator('.equipment-panel').evaluate(e => ({ 可视宽度: e.clientWidth, 内容宽度: e.scrollWidth }));
  expect(bounds.内容宽度).toBeLessThanOrEqual(bounds.可视宽度 + 2);
  await page.screenshot({ path: root + '/equipped-narrow.png' }); await page.setViewportSize({ width: 1280, height: 720 }); await resume(page);
  const fastWalk = await speed(page), fastRun = await speed(page, true);
  expect(fastWalk).toBeCloseTo(walk * 1.25, 0); expect(fastRun).toBeCloseTo(run * 1.25, 0);
  await page.keyboard.press('Escape'); await page.locator('#save').click();
  const exportEvent = page.waitForEvent('download'); await page.locator('#export').click();
  await (await exportEvent).saveAs(root + 'earned-save.json');
  await writeFile(root + 'movement.json', JSON.stringify({说明: '新档正常采集出售攒钱后购买穿戴，真实键盘位移与模拟时间实测。', 基础行走: walk, 基础奔跑: run, 穿鞋行走: fastWalk, 穿鞋奔跑: fastRun}, null, 2));
  await page.reload(); await page.getByRole('button', { name: '继续旅途', exact: true }).click();
  await page.waitForFunction(() => (window as any).__farwind().mode === '');
  expect((await read(page)).state.equipment.feet).toBe('windBoots'); expect((await read(page)).state.coins).toBe(6);
  expect(await speed(page)).toBeCloseTo(fastWalk, 0);
  await page.keyboard.press('Tab'); await page.locator('#unequip-feet').click();
  await expect.poll(async () => (await read(page)).state.equipment.feet).toBeNull(); await resume(page);
  expect(await speed(page)).toBeCloseTo(walk, 0);
  expect(errors).toEqual([]);
  await writeFile(root + '/acceptance.json', JSON.stringify({
    说明: '生产构建新档真实键盘采集三轮药草与一轮木材，等待正常再生并出售攒钱。真实购买、装备、奔跑、刷新、卸下；未导入或改写时间、金币、坐标与装备。',
    基础行走: walk, 基础奔跑: run, 穿鞋行走: fastWalk, 穿鞋奔跑: fastRun, 窄屏: bounds, 页面异常: errors,
  }, null, 2));
});
test('wind-boots-legacy-migration', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: '启程 · 新游戏', exact: true }).click();
  await page.waitForFunction(() => (window as any).__farwind().mode === '');
  // 从被测固定构建读取基础结构，避免并行开发使源码夹具与被测包错版。
  const old: any = (await read(page)).state; const version = old.schema_version; old.schema_version = 17;
  delete old.equipment.feet; delete old.shopStock['smith:windBoots']; old.coins = 47;
  await page.keyboard.press('Escape'); const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '导入存档', exact: true }).click();
  await (await chooser).setFiles({ name: 'legacy-boots-sample.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(old)) });
  await page.waitForFunction(() => (window as any).__farwind().mode === '');
  let state = (await read(page)).state;
  expect(state.equipment.feet).toBeNull(); expect(state.coins).toBe(47); expect(state.bag).toEqual(old.bag);
  expect(state.shopStock).toEqual({ ...old.shopStock, 'smith:windBoots': 4 });
  await page.keyboard.press('Escape'); await page.locator('#save').click(); await page.reload();
  await page.getByRole('button', { name: '继续旅途', exact: true }).click();
  await page.waitForFunction(() => (window as any).__farwind().mode === '');
  state = (await read(page)).state;
  expect(state.schema_version).toBe(version); expect(state.coins).toBe(47); expect(state.equipment.feet).toBeNull();
});

test('wind-boots-funded-lifecycle', async ({ page }) => {
  await mkdir(root, { recursive: true });
  await page.goto('/'); await page.getByRole('button', { name: '启程 · 新游戏', exact: true }).click();
  await page.waitForFunction(() => (window as any).__farwind().mode === '');
  const fixture = (await read(page)).state; fixture.coins = 180;
  // 显式合法余额夹具用于保存回归；正常攒钱另由完整新档路径验收，不将此夹具当作自然获取。
  await page.keyboard.press('Escape'); const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '导入存档', exact: true }).click();
  await (await chooser).setFiles({ name: 'funded-boots-sample.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) });
  await page.waitForFunction(() => (window as any).__farwind().mode === '');
  const walk = await speed(page), run = await speed(page, true);
  await shop(page, 'smith'); await page.locator('[data-item="windBoots"]').click();
  await page.locator('#shop-review').click(); await page.locator('#shop-confirm').click();
  await expect(page.locator('#shop-feedback')).toContainText('已完成并保存'); await resume(page);
  expect((await read(page)).state.coins).toBe(0); expect(await speed(page)).toBeCloseTo(walk, 0);
  await page.keyboard.press('Tab'); await page.locator('#bag-equipment').click();
  await page.locator('[data-equipment-slot="feet"]').click(); await page.locator('#equipment-equip').click();
  await expect.poll(async () => (await read(page)).state.equipment.feet).toBe('windBoots');
  await page.screenshot({ path: root + '/equipment-final.png' });
  const panel = await page.locator('.equipment-panel').boundingBox(), orb = await page.locator('[data-equipment-slot="orb"]').boundingBox();
  expect(orb!.y + orb!.height).toBeLessThanOrEqual(panel!.y + panel!.height);
  const back = await page.locator('.equipment-return').boundingBox();
  expect(back!.y + back!.height).toBeLessThanOrEqual(panel!.y + panel!.height - 20);
  await page.setViewportSize({ width: 390, height: 844 });
  const bounds = await page.locator('.equipment-panel').evaluate(e => ({ 可视宽度: e.clientWidth, 内容宽度: e.scrollWidth }));
  expect(bounds.内容宽度).toBeLessThanOrEqual(bounds.可视宽度 + 2);
  await page.screenshot({ path: root + '/equipment-final-narrow.png' }); await page.setViewportSize({ width: 1280, height: 720 }); await resume(page);
  const fastWalk = await speed(page), fastRun = await speed(page, true);
  expect(fastWalk).toBeCloseTo(walk * 1.25, 0); expect(fastRun).toBeCloseTo(run * 1.25, 0);
  await page.keyboard.press('Escape'); await page.locator('#save').click(); await page.reload();
  await page.getByRole('button', { name: '继续旅途', exact: true }).click(); await page.waitForFunction(() => (window as any).__farwind().mode === '');
  expect((await read(page)).state.equipment.feet).toBe('windBoots'); expect((await read(page)).state.coins).toBe(0);
  expect(await speed(page)).toBeCloseTo(fastWalk, 0);
  await page.keyboard.press('Tab'); await page.locator('#unequip-feet').click();
  await expect.poll(async () => (await read(page)).state.equipment.feet).toBeNull(); await resume(page);
  expect(await speed(page)).toBeCloseTo(walk, 0);
  await writeFile(root + '/lifecycle.json', JSON.stringify({ 说明: '固定生产包，显式导入180金币且不含鞋子的合法夹具；真实点击购买、穿戴、键盘行走奔跑、刷新读档及卸下。不能作为正常攒钱证据。', 基础行走: walk, 基础奔跑: run, 穿鞋行走: fastWalk, 穿鞋奔跑: fastRun, 窄屏: bounds }, null, 2));
});
