import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {initialState} from '../src/game/systems/state';
const root='docs/shadows/evidence';
test('正式构建村庄与野外阴影、保存刷新',async({page})=>{
  await mkdir(root,{recursive:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.getByRole('button',{name:'启程 · 新游戏',exact:true}).click();
  await page.waitForFunction(()=>{const s=(window as any).__farwind?.();return s&&s.mode===''&&!s.sessionStarting&&s.defendersView.length===12;});
  await page.screenshot({path:root+'/production-village.png'});
  expect((await page.evaluate(()=>(window as any).__farwind())).shadows).toBeUndefined();
  await page.keyboard.press('Escape');await page.locator('#save').click();await expect(page.getByText('旅途已保存',{exact:true})).toBeVisible();
  await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');
  await page.keyboard.press('Escape');const state=initialState();state.player.x=330;state.player.y=-50;
  page.once('dialog',d=>d.accept());const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.locator('#import').click()]);
  await chooser.setFiles({name:'shadow-production-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({说明:'正式构建的独立山口起点，怪物由正式遭遇生成，不直接写运行时状态。',...state}))});
  await page.waitForFunction(()=>{const s=(window as any).__farwind();return s.mode===''&&s.enemies.some((e:any)=>e.hp>0&&e.y<0);});
  await page.keyboard.down('w');await page.waitForTimeout(400);await page.keyboard.up('w');await page.screenshot({path:root+'/production-monsters.png'});
  expect(errors).toEqual([]);await writeFile(root+'/production-validation.json',JSON.stringify({说明:'当前源码生产构建启动正式新档，核对村庄画面、手动保存与刷新读档；正式界面导入野外起点并以W行走触发遭遇。截图另外人工检查，不依赖开发阴影快照。',结果:'通过',错误:errors},null,2));
});
