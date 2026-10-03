import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {initialState,count,type State} from '../src/game/systems/state';
import {props,propBounds} from '../src/data/world';
import {motionBlocked} from '../src/game/systems/obstacles';

const evidence='docs/footwear-concepts/verification';
const read=(page:Page)=>page.evaluate(()=>(window as any).__farwind());
async function importSample(page:Page,state:State){
 await page.goto('/');page.once('dialog',d=>d.accept());
 const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入存档',exact:true}).click();
 await (await chooser).setFiles({name:'footwear-phase-sample.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(state))});
 await page.waitForFunction(()=>(window as any).__farwind?.().mode==='');
 await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
}
async function equipment(page:Page){await page.keyboard.press('Tab');await page.locator('#bag-equipment').click();await page.locator('[data-equipment-slot="feet"]').click();}
async function close(page:Page){await page.keyboard.press('Escape');if((await read(page)).mode==='pause')await page.locator('#close').click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');}

test('正式商店购买五款鞋、逐款穿戴、刷新读档和符文购买',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await mkdir(evidence,{recursive:true});
 const s=initialState();s.coins=3000;s.life.playerSpace='smith-shop';s.life.outside={x:1550,y:1675};s.player.x=830;s.player.y=835;
 await importSample(page,s);await page.waitForFunction(()=>(window as any).__farwind().target==='interior:smith-shop:counter');await page.keyboard.press('e',{delay:80});
 await expect(page.locator('.shop-card')).toHaveCount(8);
 const shoes=['brookShoes','deerBoots','windBoots','mistBoots','starShoes'] as const;
 for(const id of shoes){await page.locator(`[data-item="${id}"]`).click();await page.locator('#shop-review').click();await page.locator('#shop-confirm').click();await expect(page.locator('#shop-feedback')).toContainText('已完成并保存');expect(count((await read(page)).state,id)).toBe(1);}
 await page.screenshot({path:`${evidence}/smith-wide.png`});await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${evidence}/smith-narrow.png`});
 expect(await page.locator('.shop-panel').evaluate(e=>e.scrollWidth<=e.clientWidth+2)).toBe(true);
 await page.setViewportSize({width:1440,height:900});await close(page);await equipment(page);
 for(const [i,id] of shoes.entries()){await page.locator('#equipment-replacement').selectOption(id);await page.locator('#equipment-equip').click();await expect.poll(async()=>(await read(page)).state.equipment.feet).toBe(id);await expect(page.locator('.equipment-effect')).toContainText(['8%','15%','25%','35%','45%'][i]);}
 await page.screenshot({path:`${evidence}/equipment-wide.png`});await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${evidence}/equipment-narrow.png`});expect(await page.locator('.equipment-panel').evaluate(e=>e.scrollWidth<=e.clientWidth+2)).toBe(true);
 await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');
 const loaded=(await read(page)).state as State;expect(loaded.equipment.feet).toBe('starShoes');expect(loaded.coins).toBe(1390);
 for(const id of shoes.slice(0,4))expect(count(loaded,id)).toBe(1);
 // 使用正式导入切换隔离验收样本场所，不修改运行中的世界状态。
 loaded.life.playerSpace='general-shop';loaded.player.x=830;loaded.player.y=835;
 await importSample(page,loaded);await page.waitForFunction(()=>(window as any).__farwind().target==='interior:general-shop:counter');await page.keyboard.press('e',{delay:80});
 await page.locator('[data-flow="runes"]').click();await page.locator('[data-rune-buy="r34"]').click();await expect(page.locator('#shop-feedback')).toContainText('符文已购入');
 const bought=(await read(page)).state;expect(bought.coins).toBe(1030);expect(bought.runes.owned).toContain('r34');expect(bought.runes.slots).not.toContain('r34');await expect(page.locator('[data-rune-buy="r34"]')).toBeDisabled();
 await page.screenshot({path:`${evidence}/rune-shop.png`});await close(page);await page.keyboard.press('r');await page.locator('[data-rune-id="r34"]').click();await page.locator('#rune-equip').click();await expect.poll(async()=>(await read(page)).state.runes.slots[0]).toBe('r34');
 await expect(page.locator('#rune-preview')).toHaveAttribute('aria-label',/穿隙单枚预览/);await page.screenshot({path:`${evidence}/phase-rune-equipped.png`});
 await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await expect.poll(async()=>(await read(page)).state.runes.slots[0]).toBe('r34');
 expect(errors).toEqual([]);await writeFile(`${evidence}/transactions.json`,JSON.stringify({说明:'独立浏览器与独立端口；使用正式存档导入、商店按钮、穿戴和刷新流程。样本初始金币3000用于覆盖全部价格，不代表自然积累路线已验收。',最终状态:(await read(page)).state,浏览器异常:errors},null,2));
});

for(const equipped of [false,true])test(`真实键盘瞬步${equipped?'穿过木桩':'受到木桩阻挡'}且保存落点安全`,async({page})=>{
 const s=initialState(),p=props.find(p=>p.id==='training-dummy')!,r=propBounds(p,true);
 s.player.x=p.x;s.player.y=r.bottom+6;
 if(equipped){s.runes.owned=['r34'];s.runes.slots[0]='r34';}
 await importSample(page,s);const origin=(await read(page)).state.player;await page.keyboard.down('w');await page.keyboard.press('l',{delay:80});await page.keyboard.up('w');await page.waitForTimeout(250);
 const after=(await read(page)).state.player;if(equipped)expect(after.y).toBeLessThan(r.top);else expect(after.y).toBeGreaterThanOrEqual(r.bottom-1);
 expect(Math.hypot(after.x-origin.x,after.y-origin.y)).toBeLessThanOrEqual(100);expect(motionBlocked(after.x,after.y)).toBe(false);
 await page.screenshot({path:`${evidence}/phase-${equipped?'through':'blocked'}.png`});
 await page.keyboard.press('Escape');await page.locator('#save').click();await expect(page.locator('#toast')).toContainText('旅途已保存');await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');
 const restored=(await read(page)).state.player;expect(restored.x).toBeCloseTo(after.x);expect(restored.y).toBeCloseTo(after.y);expect(motionBlocked(restored.x,restored.y)).toBe(false);
});
