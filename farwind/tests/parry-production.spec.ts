import {test,expect} from '@playwright/test';
import {initialState} from '../src/game/systems/state';
import sharp from 'sharp';
import {writeFile,mkdir} from 'node:fs/promises';
test('V2-PRODUCTION-real-input-auto-counter',async({page})=>{
 const fixture=initialState();fixture.player.x=850;fixture.player.y=720;fixture.quest=3;
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto(process.env.FARWIND_PARRY_PRODUCTION_URL??'http://127.0.0.1:4188/');const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入存档',exact:true}).click();await(await chooser).setFiles({name:'production-parry-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
 await expect(page.getByRole('button',{name:'迎风架剑练习',exact:true})).toBeVisible();
 await page.keyboard.press('k');await expect(page.locator('.meter.stamina')).toContainText('88 / 100');
 await page.waitForTimeout(450);await page.mouse.click(650,390,{button:'right'});await expect.poll(async()=>page.evaluate(()=>(window as any).__farwind().state.player.stamina)).toBeLessThan(85);
 const exposed=await page.evaluate(()=>(window as any).__farwind());expect(exposed.session).toBeUndefined();expect(exposed.parryTraining).toBeUndefined();
 await page.waitForTimeout(450);await page.keyboard.press('w');await page.waitForTimeout(40);
 await page.getByRole('button',{name:'迎风架剑练习',exact:true}).click();await page.getByRole('button',{name:'慢速教学 · 900毫秒',exact:true}).click();await expect(page.locator('#parry-feedback')).toContainText('共用出手动作');
 let received=false;const observations:any[]=[];
 for(let i=0;i<200;i++){
  const png=await page.screenshot({clip:{x:580,y:330,width:130,height:160}}),{data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});let green=0;
  for(let y=0;y<100;y++)for(let x=0;x<130;x++){const k=(y*info.width+x)*4,r=data[k],g=data[k+1],b=data[k+2];if(r>155&&r<225&&g>225&&b>200&&g-r>20)green++;}
  observations.push({截图:i,普通提示像素:green});if(green>12){await page.keyboard.press('k');received=true;break;}
 }
 expect(received).toBe(true);await expect(page.locator('#training-stats')).toContainText('24伤害');await expect(page.locator('#training-stats')).toContainText('命中1/3');
 await mkdir('docs/parry-v2/evidence',{recursive:true});await writeFile('docs/parry-v2/evidence/production-summary.json',JSON.stringify({说明:'实际生产构建；正式导入夹具，真实K／右键，按截图提示架剑；未按J也有24伤害首刀，调试战斗状态未暴露',观察:observations,训练:await page.locator('#training-stats').textContent(),页面错误:errors},null,2));await page.screenshot({path:'docs/parry-v2/evidence/production.png'});expect(errors).toEqual([]);
});
