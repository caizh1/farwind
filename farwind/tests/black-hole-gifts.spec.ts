import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {GIFT_DEMOS,demoTimeline} from '../src/game/ui/windGiftDemo';
import {WIND_GIFTS,type WindGiftState} from '../src/game/systems/windGifts';
import type {GiftVisualId} from '../src/game/entities/windGiftArt';

const evidence='docs/black-hole-gifts/evidence-upgrade';
type Snapshot={state:{windGifts:WindGiftState};session:{sim:number};runes:{events:{eventId:string;tags:string[];amount:number}[];blackHole:{metrics:{rolls:number;procs:number;dotDamage:number;pulled:number};rifts:{born:number;radius:number;pullRadius:number;hold:number;dps:number}[]}}};
const read=(page:Page):Promise<Snapshot>=>page.evaluate(()=>(window as any).__farwind());

test('黑洞逐级真实跳伤与封顶，扩界领取后延时保存刷新',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await mkdir(evidence,{recursive:true});
 await page.goto('/?blackHoleArena=1');await page.getByRole('button',{name:'启程 · 新游戏',exact:true}).click();const records=[];
 for(const [level,tickDamage] of [[1,1.8],[2,4.8],[3,7.8],[4,10],[6,10]]){
  await page.locator('#black-hole-level').selectOption(String(level));await page.locator('#black-hole-reset').click();
  await expect(page.locator('#black-hole-status')).toContainText(`每跳 ${tickDamage}点`);
  // 正式事件日志跨重置保留，只验收这次I新产生的事件。
  const beforeIds=new Set((await read(page)).runes.events.map(e=>e.eventId));
  const currentHits=async()=>(await read(page)).runes.events.filter(e=>!beforeIds.has(e.eventId)&&e.tags.includes('black_hole_dot'));
  await page.keyboard.down('i');await page.waitForTimeout(120);await page.keyboard.up('i');
  await expect.poll(async()=>(await read(page)).runes.blackHole.rifts.length).toBe(1);
  expect((await read(page)).runes.blackHole.rifts[0].dps).toBeCloseTo(tickDamage*4);
  await expect.poll(async()=>(await currentHits()).some(e=>Math.abs(e.amount-tickDamage)<1e-8)).toBe(true);
  const hits=await currentHits();expect(hits.every(e=>e.amount<=10+1e-8)).toBe(true);
  records.push({等级:level,单跳伤害:tickDamage,显示伤害:Math.round(tickDamage),实战跳伤:hits.map(h=>h.amount)});
  if(level===4)await page.screenshot({path:`${evidence}/capped-ticks.png`});
 }
 await page.locator('#black-hole-profile').selectOption('扩界三级');await page.locator('#black-hole-reset').click();await expect(page.locator('#black-hole-status')).toContainText('持续 3.24秒');
 await page.locator('#black-hole-upgrade').click();await page.locator('button[data-gift="riftRadius"]').click();await expect(page.locator('#gift-feedback')).toContainText('保存');
 await expect(page.locator('#gift-demo-title')).toContainText('扩界 · 4级效果');await expect(page.locator('#gift-demo-time')).toHaveAttribute('max',String(demoTimeline('riftRadius',4).total));
 const before=(await read(page)).state.windGifts;await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();expect((await read(page)).state.windGifts).toEqual(before);await expect(page.locator('#black-hole-status')).toContainText('持续 3.84秒');expect(errors).toEqual([]);
 await writeFile(`${evidence}/tick-validation.json`,JSON.stringify({说明:'通过真实I输入及正式伤害事件核验，单跳上限10点，扩界升级后保存刷新。',跳伤样本:records,刷新后扩界等级:before.held.find(g=>g.id==='riftRadius')?.level,浏览器错误:errors},null,2));
});

test('真实I对比基础与三项强化，持续时间更长，领取升级后保存刷新回读',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await mkdir(evidence,{recursive:true});
 await page.goto('/?blackHoleArena=1');await page.getByRole('button',{name:'启程 · 新游戏',exact:true}).click();
 const records=[];
 for(const [profile,radius,pullRadius,hold,file] of [['基础黑洞',180,180,1440,'baseline'],['三项三级',288,450,5040,'enhanced']] as const){
  await page.locator('#black-hole-profile').selectOption(profile);await page.locator('#black-hole-reset').click();
  await expect(page.locator('#black-hole-status')).toContainText(`持续 ${(hold/1000).toFixed(2)}秒`);
  await page.keyboard.down('i');await page.waitForTimeout(160);await page.keyboard.up('i');
  await expect.poll(async()=>(await read(page)).runes.blackHole.rifts.length).toBe(1);
  const born=(await read(page)).runes.blackHole.rifts[0].born;
  await expect.poll(async()=>(await read(page)).session.sim-born).toBeGreaterThan(650);
  const sample=await read(page),rift=sample.runes.blackHole.rifts[0];expect(rift).toMatchObject({radius,pullRadius,hold});
  expect(sample.runes.blackHole.metrics.procs).toBe(1);expect(sample.runes.blackHole.metrics.pulled).toBeGreaterThan(0);expect(sample.runes.blackHole.metrics.dotDamage).toBeGreaterThan(0);
  await page.screenshot({path:`${evidence}/${file}.png`});
  if(profile==='三项三级'){
   await expect.poll(async()=>(await read(page)).session.sim-born).toBeGreaterThan(3700);
   expect((await read(page)).runes.blackHole.rifts).toHaveLength(1);
   await page.screenshot({path:`${evidence}/extended-hold.png`});
  }
  await expect.poll(async()=>(await read(page)).runes.blackHole.rifts.length,{timeout:15000}).toBe(0);
  const final=await read(page);records.push({预设:profile,伤害半径:radius,吸收半径:pullRadius,持续毫秒:hold,触发次数:final.runes.blackHole.metrics.procs,持续实伤:final.runes.blackHole.metrics.dotDamage,牵引距离:final.runes.blackHole.metrics.pulled});
 }
 await page.locator('#black-hole-upgrade').click();await page.locator('button[data-gift="riftDuration"]').click();
 await expect(page.locator('#gift-feedback')).toContainText('保存');await expect.poll(async()=>(await read(page)).state.windGifts.held.find(g=>g.id==='riftDuration')?.level).toBe(4);
 await expect(page.locator('#gift-demo-title')).toContainText('长夜 · 4级效果');await expect(page.locator('#gift-demo-time')).toHaveAttribute('max',String(demoTimeline('riftDuration',4,{riftRadius:3,riftSuction:3}).total));
 await expect(page.locator('#black-hole-arena')).not.toBeVisible();await page.locator('#gift-visual-pause').click();await expect(page.locator('#gift-visual-pause')).toHaveAttribute('aria-pressed','true');
 await page.locator('#gift-demo-time').fill(String(demoTimeline('riftDuration',4).effectAt+650));await page.locator('#gift-demo-time').dispatchEvent('input');await page.screenshot({path:`${evidence}/upgrade-preview.png`});
 const before=(await read(page)).state.windGifts;await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();
 expect((await read(page)).state.windGifts).toEqual(before);await expect(page.locator('#save-warning')).not.toBeVisible();expect(errors).toEqual([]);
 await writeFile(`${evidence}/browser-validation.json`,JSON.stringify({说明:'独立开发端口与隔离存档，真实按键触发正式黑洞链路；确定触发仅用于预览，不改变正式概率。',样本:records,刷新后风赐:before.held.map(g=>({名称:WIND_GIFTS[g.id].name,等级:g.level})),浏览器错误:errors},null,2));
});

test('完整教学目录与三项预览可播放拖动，窄屏图标和控件留在正常文档流',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await mkdir(evidence,{recursive:true});
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/tools/wind-gift-demo.html');
 const choice=page.locator('#gift-visual-choice'),time=page.locator('#gift-demo-time');await expect(choice.locator('option')).toHaveCount(Object.keys(GIFT_DEMOS).length);
 for(const id of Object.keys(GIFT_DEMOS) as GiftVisualId[]){await choice.selectOption(id);await expect(page.locator('#gift-demo-caption')).toHaveText(GIFT_DEMOS[id].result);await expect(time).toHaveAttribute('max',String(demoTimeline(id).total));}
 for(const id of ['riftRadius','riftSuction','riftDuration'] as const){
  await choice.selectOption(id);await time.fill(String(demoTimeline(id).effectAt+650));await time.dispatchEvent('input');await page.screenshot({path:`${evidence}/${id}-preview.png`});
  await page.locator('#gift-visual-pause').click();await expect(page.locator('#gift-visual-pause')).toHaveAttribute('aria-pressed','false');await page.waitForTimeout(100);await page.locator('#gift-visual-pause').click();
 }
 for(const width of [768,390,320]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(await page.locator('.gift-preview-controls').evaluate(e=>[...e.querySelectorAll('button,select')].every(c=>getComputedStyle(c).position!=='absolute'&&c.getBoundingClientRect().right<=e.getBoundingClientRect().right))).toBe(true);}
 await page.screenshot({path:`${evidence}/mobile-preview.png`});expect(errors).toEqual([]);
});
