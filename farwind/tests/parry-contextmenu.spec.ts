import {test,expect} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
import {initialState} from '../src/game/systems/state';
// 原生菜单默认行为已由实际界面核查；事件边界独立测试，避免系统菜单持有窗口销毁。
test.use({headless:true,video:'off'});
test('PARRY-03-contextmenu',async({page})=>{
 const state=initialState();state.player.x=1640;state.player.y=620;state.quest=3;
 page.on('dialog',d=>d.accept());await page.goto('/');const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入存档',exact:true}).click();await(await chooser).setFiles({name:'contextmenu-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(state))});
 await page.evaluate(()=>{(window as any).__menus=[];document.addEventListener('contextmenu',e=>(window as any).__menus.push({画布:e.target instanceof HTMLCanvasElement,已阻止:e.defaultPrevented}));});
 await page.mouse.click(650,400,{button:'right'});await page.keyboard.press('Escape');await page.getByText('世界与时间已暂停。').click({button:'right'});
 const menus=await page.evaluate(()=>(window as any).__menus);expect(menus).toContainEqual({画布:true,已阻止:true});expect(menus).toContainEqual({画布:false,已阻止:false});
 await mkdir(process.env.FARWIND_PARRY_EVIDENCE_ROOT??'docs/parry-v2/evidence',{recursive:true});await writeFile(`${process.env.FARWIND_PARRY_EVIDENCE_ROOT??'docs/parry-v2/evidence'}/contextmenu-summary.json`,JSON.stringify({说明:'真实鼠标右键；画布阻止默认菜单，暂停界面保留默认行为；原生菜单取消及销毁阻塞另由原生界面核查',事件:menus},null,2));
});
