import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {GIFT_DEMOS,demoTimeline} from '../src/game/ui/windGiftDemo';
import type {GiftVisualId} from '../src/game/entities/windGiftArt';

test('完整目录使用示例可播放、暂停、拖动，所有素材加载成功',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&r.url().includes('/assets/'))errors.push(`素材响应异常：${r.status()} ${r.url()}`);});
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/tools/wind-gift-demo.html');
 const choice=page.locator('#gift-visual-choice'),time=page.locator('#gift-demo-time');
 await expect(choice.locator('option')).toHaveCount(79);
 await expect(page.locator('#gift-visual-pause')).toHaveAttribute('aria-pressed','true');
 for(const id of Object.keys(GIFT_DEMOS) as GiftVisualId[]){
  await choice.selectOption(id);await expect(page.locator('#gift-demo-caption')).toHaveText(GIFT_DEMOS[id].result);await expect(page.locator('[data-demo-step="result"]')).toHaveAttribute('aria-current','step');
  expect(Number(await time.getAttribute('max'))).toBe(demoTimeline(id).total);
 }
 await choice.selectOption('riposte');await time.focus();await time.press('Home');await expect(page.locator('#gift-demo-caption')).toHaveText(GIFT_DEMOS.riposte.setup);
 await page.locator('#gift-visual-pause').click();await expect(page.locator('[data-demo-step="action"]')).toHaveAttribute('aria-current','step');
 await page.locator('#gift-visual-pause').click();const frozen=await time.inputValue();await page.waitForTimeout(160);expect(await time.inputValue()).toBe(frozen);
 await page.locator('#gift-visual-replay').click();await expect(page.locator('#gift-demo-caption')).toHaveText(GIFT_DEMOS.riposte.result);
 await page.setViewportSize({width:1100,height:980});await mkdir('docs/wind-gift-demo/evidence',{recursive:true});
 for(const id of ['blade','riposte','potion','relayTogether','blackHole','chain'] as const){await choice.selectOption(id);await page.screenshot({path:`docs/wind-gift-demo/evidence/${id}.png`});}
 expect(errors).toEqual([]);
});

test('小屏正常文档流无溢出，折叠和移除时停止绘制',async({page})=>{
 await page.goto('/tools/wind-gift-demo.html');
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await page.locator('.gift-preview-controls').evaluate(e=>[...e.querySelectorAll('button,select')].every(c=>getComputedStyle(c).position!=='absolute'&&c.getBoundingClientRect().right<=e.getBoundingClientRect().right))).toBe(true);
  if(width===320)await page.screenshot({path:'docs/wind-gift-demo/evidence/mobile.png'});
 }
 await page.getByText('主角使用示例 · 看懂这份风赐',{exact:true}).click();
 const time=page.locator('#gift-demo-time'),before=await time.inputValue();await page.waitForTimeout(180);expect(await time.inputValue()).toBe(before);
 await page.getByText('主角使用示例 · 看懂这份风赐',{exact:true}).click();await expect(page.locator('#gift-demo-caption')).toHaveText(GIFT_DEMOS.riposte.setup);
 // 以真实DOM移除模拟界面重绘；只用于检查预览资源释放，不接触游戏或存档。
 await page.locator('#demo').evaluate(e=>e.replaceChildren());await page.waitForTimeout(180);expect(await page.locator('#gift-visual-canvas').count()).toBe(0);
});
