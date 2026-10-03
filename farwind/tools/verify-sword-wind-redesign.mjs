import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { captureGameAudio } from './capture-game-audio.mjs';
const dir = 'docs/sword-wind-audio-redesign';
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ args: ['--enable-gpu', '--enable-webgl', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.addInitScript(captureGameAudio);
await page.addInitScript(() => {
  window.__bladeStarts = [];
  const start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...args) {
    if (this.buffer?.numberOfChannels === 2) {
      const data = this.buffer.getChannelData(0);
      let signature = 0;
      for (let i = 0; i < data.length; i += 137) signature += data[i] * (i + 1);
      window.__bladeStarts.push({时间: this.context.currentTime,时长: this.buffer.duration,指纹: signature});
    }
    return start.apply(this, args);
  };
});
try {
  await page.goto('http://127.0.0.1:5173/');
  await page.waitForFunction(() => typeof window.__farwind === 'function');
  // 隔离浏览器使用显式已学习起始夹具，通过正式导入界面进入；不修改用户现有存档。
  const fixture = await page.evaluate(async () => {
    const {initialState} = await import('/src/game/systems/state.ts');
    const state = initialState(); state.quest = 3; state.player.x = 760; state.player.y = 650;
    state.skills.swordWindStage = 1; state.skills.legacySwordWind = true;
    return JSON.stringify(state);
  });
  page.on('dialog', d => d.accept());
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '导入存档', exact: true }).click();
  await (await chooser).setFiles({name: 'audio-fixture.json', mimeType: 'application/json', buffer: Buffer.from(fixture)});
  await page.waitForFunction(() => window.__farwind().mode === '');
  const read = () => page.evaluate(() => window.__farwind());
  assert.equal((await read()).feedback.audio.windCached, true);
  await page.keyboard.down('i');
  await page.waitForFunction(() => window.__bladeStarts.filter(s => Math.abs(s.时长 - .24) < .001).length >= 8);
  await page.keyboard.up('i');
  const during = await read();
  assert.ok(during.feedback.audio.windVoices <= 4);
  await page.waitForFunction(() => window.__farwind().feedback.audio.windVoices === 0);
  const starts = await page.evaluate(() => window.__bladeStarts);
  const release = starts.filter(s => Math.abs(s.时长 - .24) < .001);
  assert.equal(new Set(release.map(s => s.指纹)).size, 3);
  assert.ok(starts.some(s => Math.abs(s.时长 - .11) < .001));
  assert.ok(starts.some(s => Math.abs(s.时长 - .09) < .001));
  await page.keyboard.down('i');
  await page.waitForFunction(() => window.__farwind().feedback.audio.windVoices > 0);
  await page.keyboard.press('Escape'); await page.keyboard.up('i');
  await page.waitForFunction(() => window.__farwind().feedback.audio.windVoices === 0);
  const pausedCount = await page.evaluate(() => window.__bladeStarts.length);
  await page.waitForTimeout(650);
  assert.equal(await page.evaluate(() => window.__bladeStarts.length), pausedCount);
  await page.getByRole('button', {name: '设置', exact: true}).click();
  await page.locator('#volume').fill('0');
  await page.getByRole('button', {name: '返回', exact: true}).click();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__farwind().mode === '');
  const serial = (await read()).attackSerial;
  await page.keyboard.down('i'); await page.waitForTimeout(1200); await page.keyboard.up('i');
  assert.equal(await page.evaluate(() => window.__bladeStarts.length), pausedCount);
  assert.ok((await read()).attackSerial > serial);
  const final = await read();
  assert.equal(final.feedback.audio.windVoices, 0);
  assert.deepEqual(errors, []);
  const audio = await page.evaluate(() => window.__finishAudio());
  await writeFile(`${dir}/runtime.webm`, Buffer.from(audio.base64, 'base64'));
  await page.screenshot({path: `${dir}/runtime.png`});
  await writeFile(`${dir}/verification.json`, JSON.stringify({说明: '当前5173开发工作树，隔离的已学习起始存档经正式导入界面进入；真实I键持续施放、暂停、设置静音；不是正式学习流程验收。',结论: '通过',释放次数: release.length,释放音色变体: new Set(release.map(s => s.指纹)).size,起手与消散: '已观测',暂停静音: '全部剑风声部归零，暂停静音期间无新声源，静音后战斗仍执行',声部峰值样本: during.feedback.audio.windVoices,声部上限: 4,录音: 'runtime.webm',音频偏移秒: audio.offset,页面异常: errors,声音启动: starts,主观听感: '待用户试听'}, null, 2));
  await page.goto('http://127.0.0.1:5173/docs/sword-wind-audio-redesign/preview.html');
  assert.equal(await page.locator('audio').count(), 3);
  for (const player of await page.locator('audio').all()) {
    await player.evaluate(async e => { await e.play(); });
    await page.waitForTimeout(100);
    assert.equal(await player.evaluate(e => e.paused), false);
    await player.evaluate(e => e.pause());
  }
  await page.screenshot({path: `${dir}/preview.png`});
  console.log('真实I键、连续音色变体、暂停静音与试听页播放检查通过。');
} finally { await browser.close(); }
