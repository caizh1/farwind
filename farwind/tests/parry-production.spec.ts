import {test,expect} from '@playwright/test';
import {initialState} from '../src/game/systems/state';
test('生产包：真实K、右键与练习入口',async({page})=>{
 const fixture=initialState();fixture.player.x=850;fixture.player.y=720;fixture.quest=3;
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto('http://127.0.0.1:4188/');const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入存档',exact:true}).click();await(await chooser).setFiles({name:'production-parry-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
 await expect(page.getByRole('button',{name:'迎风架剑练习',exact:true})).toBeVisible();
 await page.keyboard.press('k');await expect(page.locator('.meter.stamina')).toContainText('88 / 100');
 await page.waitForTimeout(450);await page.mouse.click(650,390,{button:'right'});await expect.poll(async()=>page.evaluate(()=>(window as any).__farwind().state.player.stamina)).toBeLessThan(85);
 const exposed=await page.evaluate(()=>(window as any).__farwind());expect(exposed.session).toBeUndefined();expect(exposed.parryTraining).toBeUndefined();
 await page.getByRole('button',{name:'迎风架剑练习',exact:true}).click();await page.getByRole('button',{name:'慢速教学 · 900毫秒',exact:true}).click();await expect(page.locator('#parry-feedback')).toContainText('风纹');await page.screenshot({path:'docs/parry/evidence/production.png'});expect(errors).toEqual([]);
});
