import {test,expect} from '@playwright/test';
import {mkdir,readFile} from 'node:fs/promises';

// 伙伴预设通过正式校验；真实I命中与伙伴接力可保存和读回。
test('COMPANION-01',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?windGiftArena=1');await page.getByRole('button',{name:'启程 · 新游戏',exact:true}).click();
 for(const profile of ['同心递锋与闪链','伙伴接力链']){
  await page.locator('#gift-profile').selectOption(profile);await page.locator('#gift-arena-reset').click();
  await expect(page.locator('#save-warning')).not.toBeVisible();
  await page.locator('#gift-arena-record').click();await page.keyboard.down('i');await page.waitForTimeout(1200);await page.keyboard.up('i');
  await expect(page.locator('#wind-gift-arena output')).toHaveText(/原生命中 [1-9]/);
  await page.waitForTimeout(1600);await expect(page.locator('#save-warning')).not.toBeVisible();
  const downloadPromise=page.waitForEvent('download');await page.locator('#gift-arena-evidence').click();const download=await downloadPromise;
  const path=await download.path();const evidence=JSON.parse(await readFile(path!,'utf8'));expect(evidence.战斗.metrics.native).toBeGreaterThan(0);expect(evidence.战斗.windGifts.metrics.companionHits).toBeGreaterThan(0);expect(evidence.战斗.bands).toEqual([]);
  await mkdir('docs/companion-gifts',{recursive:true});await download.saveAs(`docs/companion-gifts/${profile==='伙伴接力链'?'relay':'chain'}-browser-evidence.json`);
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'保存旅途',exact:true}).click();await expect(page.locator('#save-warning')).not.toBeVisible();
  await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await expect(page.getByRole('progressbar',{name:'生命',exact:true})).toBeVisible();await expect(page.locator('#save-warning')).not.toBeVisible();
 }
 expect(errors).toEqual([]);
});

// 教学预览显示刃结建立与消费，局部双色汇合使用正式绘制。
test('COMPANION-02',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/tools/wind-gift-demo.html');
 const choice=page.locator('#gift-visual-choice'),time=page.locator('#gift-demo-time');await mkdir('docs/companion-gifts',{recursive:true});
 for(const [id,age,file] of [['relayEdge',1300,'relay-mark-preview'],['relayEdge',2100,'relay-consume-preview'],['sharedHeart',1500,'shared-heart-preview'],['relayTogether',2850,'relay-together-preview'],['returningBreath',1500,'return-orb-preview']] as const){
  await choice.selectOption(id);await time.fill(String(age));await time.dispatchEvent('input');await page.screenshot({path:`docs/companion-gifts/${file}.png`});
  expect(await page.locator('#gift-visual-canvas').getAttribute('aria-label')).toContain('使用示例');
 }
});
