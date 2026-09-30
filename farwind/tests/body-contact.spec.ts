import {test, expect, type Page} from '@playwright/test';
import {mkdir, writeFile} from 'node:fs/promises';

const dir = 'docs/body-contact/evidence';
const read = (page: Page) => page.evaluate(() => (window as any).__farwind());
test.use({video: 'on'});
test.setTimeout(45000);
test.beforeAll(async () => mkdir(dir, {recursive: true}));
test.afterEach(async ({page}, info) => {
  if (info.status !== info.expectedStatus) await writeFile(`${dir}/${info.title}-failure.json`, JSON.stringify({
    说明: '保留当次首因，诊断采样不会修改战斗状态。',
    世界: await read(page).catch(() => null),
    按键: await page.evaluate(() => (window as any).__bodyKeys).catch(() => null),
    采样: await page.evaluate(() => (window as any).__bodySamples).catch(() => null),
  }, null, 2));
});

async function preset(page: Page, name: string) {
  await page.goto('/?combatFeel=1');
  await page.waitForFunction(() => (window as any).__combatFeel);
  await page.locator('#combat-preset').selectOption(name);
  await page.locator('#combat-wind').uncheck();
  await page.getByRole('button', {name: '重置隔离预设', exact: true}).click();
  await page.waitForFunction(() => {
    const s = (window as any).__combatFeel.status();
    return s.active && !s.busy && !s.paused && s.sim > 120;
  });
  // 观察器只读世界状态，预设只建立初始条件；不写入生命、位置或命中结果。
  await page.evaluate(() => {
    const w = window as any;
    w.__bodySamples = []; w.__bodyObserving = true; w.__bodyKeys = [];
    window.addEventListener('keydown', e => w.__bodyKeys.push({按键: e.key,重复: e.repeat,目标: (e.target as HTMLElement)?.tagName,时刻: performance.now()}));
    const sample = () => {
      if (!w.__bodyObserving) return;
      const s = w.__farwind(), p = s.state.player, e = s.enemies[0];
      if (e) w.__bodySamples.push({模拟时刻: s.session.sim,主角横坐标: p.x,主角纵坐标: p.y,
        敌人横坐标: e.x,敌人纵坐标: e.y,敌人生命: e.hp,
        距离: Math.hypot(p.x - e.x, p.y - e.y),阶段: s.session.combat.stage,动作: s.session.combat.phase});
      if (w.__bodySamples.length < 600) requestAnimationFrame(sample);
    };
    sample();
  });
}

async function attackChain(page: Page) {
  // 到达贴身站位时可能刚被孢弹命中，正式受击锁结束后才开始验收连击。
  await page.waitForFunction(() => (window as any).__farwind().session.combat.phase !== 'hurt', null, {polling: 5, timeout: 4000});
  for (const stage of [1, 2, 3]) {
    await page.keyboard.press('j');
    await page.waitForFunction(stage => (window as any).__farwind().session.combat.stage === stage, stage, {polling: 5, timeout: 4000});
  }
}

test('body-contact-spore', async ({page}) => {
  await preset(page, 'spore');
  const before = await read(page);
  await page.keyboard.down('d');
  // 保留敌人的正式首发孢弹；等首次受击恢复并重新贴身，避免把合法硬直拒绝当成碰撞失败。
  await page.waitForFunction(hp => {
    const s = (window as any).__farwind(), p = s.state.player, e = s.enemies[0];
    return p.hp < hp && s.session.combat.phase !== 'hurt' && Math.hypot(p.x - e.x, p.y - e.y) <= 40.01;
  }, before.state.player.hp, {polling: 5, timeout: 8000});
  await attackChain(page);
  await page.waitForFunction(() => (window as any).__farwind().enemies[0].hp === 0);
  const killed = await read(page);
  await page.waitForFunction(x => (window as any).__farwind().state.player.x > x + 35, killed.enemies[0].x);
  await page.keyboard.up('d');
  await page.screenshot({path: `${dir}/spore-after.png`});
  await page.keyboard.press('Escape');
  const samples = await page.evaluate(() => {const w = window as any; w.__bodyObserving = false; return w.__bodySamples;});
  const living = samples.filter((s: any) => s.敌人生命 > 0);
  expect(living.length).toBeGreaterThan(5);
  expect(Math.min(...living.map((s: any) => s.距离))).toBeGreaterThanOrEqual(40 - 1e-6);
  expect(living.every((s: any) => s.主角横坐标 < s.敌人横坐标)).toBe(true);
  expect(killed.feedback.events.filter((e: any) => e.sourceId === 'player' && e.targetId === killed.enemies[0].id && ['hit', 'kill'].includes(e.kind)).map((e: any) => e.stage)).toEqual([1, 2, 3]);
  const after = await read(page);
  expect(after.state.player.x).toBeGreaterThan(killed.enemies[0].x + 35);
  await writeFile(`${dir}/spore.json`, JSON.stringify({说明: '持续按住方向键并用真实三段普攻击杀；活敌最小间距40像素，三刀均由正式命中结算，死亡后可走过原站位。',之前: before,击杀: killed,之后: after,采样: samples}, null, 2));
});

test('body-contact-guardian', async ({page}) => {
  await preset(page, 'guardian');
  await page.keyboard.down('d');
  await page.waitForFunction(() => {
    const s = (window as any).__farwind(); return s.enemies[0].x - s.state.player.x <= 40.01;
  }, null, {polling: 5});
  await attackChain(page);
  await page.waitForFunction(() => (window as any).__farwind().session.combat.stage === 0);
  await page.keyboard.up('d');
  await page.screenshot({path: `${dir}/guardian-after.png`});
  await page.keyboard.press('Escape');
  const after = await read(page);
  const samples = await page.evaluate(() => {const w = window as any; w.__bodyObserving = false; return w.__bodySamples;});
  expect(samples.filter((s: any) => s.敌人生命 > 0).every((s: any) => s.主角横坐标 < s.敌人横坐标)).toBe(true);
  expect(after.feedback.events.filter((e: any) => e.sourceId === 'player' && e.targetId === after.enemies[0].id && ['hit', 'protected-hit', 'guard-break', 'interrupt'].includes(e.kind)).map((e: any) => e.stage)).toEqual([1, 2, 3]);
  await writeFile(`${dir}/guardian.json`, JSON.stringify({说明: '持续向守卫移动并真实三连；保留正式敌人AI和受击规则，主角没有越到敌人身后，三刀均正式结算。',之后: after,采样: samples}, null, 2));
});
