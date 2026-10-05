import {GUARD_MEMORIAL} from '../src/game/systems/guardAftermath';
import {test,expect,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {initialState,validate} from '../src/game/systems/state';
const root='docs/guard-aftermath/evidence';
const read=(p:Page)=>p.evaluate(()=>(window as any).__farwind());
async function advance(p:Page,hours:number){for(let i=0;i<hours;i++){await p.getByRole('button',{name:'推进1小时',exact:true}).click();await p.waitForTimeout(100);}}
// 隔离浏览器验证旧档完整善后和补岗。
test('GUARD-AFTERMATH-01',async({page})=>{
 test.setTimeout(240000);mkdirSync(root,{recursive:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const s=initialState();s.time=5*1440+23*60+38;s.coins=200;delete s.defense.memorials;
 // 明确的旧档起始条件；后续仅通过键鼠和既有开发快进按钮操作正式模拟。
 for(const index of [3,5])Object.assign(s.defense.guards[index],{hp:0,dead:true,mode:'dead'});
 Object.assign(s.player,{x:2065,y:738});
 await page.goto('/?npcDebug=1');await page.waitForFunction(()=>typeof(window as any).__farwind==='function');
 page.once('dialog',d=>d.accept());const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入存档',exact:true}).click();await(await chooser).setFiles({name:'guard-aftermath-old-save.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(validate(s)))});
 await page.waitForFunction(()=>(window as any).__farwind().mode==='');
 await expect(page.getByText('正在装载风铃村素材……')).toHaveCount(0);
 await page.waitForFunction(()=>(window as any).__farwind().state.defense.memorials?.length===2);
 await page.waitForFunction(()=>(window as any).__farwind().target==='barracks-sign');
 await page.keyboard.press('e');await expect(page.getByRole('heading',{name:'风铃营房 · 卫队事务',exact:true})).toBeVisible();
 await page.screenshot({path:`${root}/barracks-before.png`});await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'NPC 调试',exact:true}).click();
 await page.waitForFunction(()=>(window as any).__farwind().state.defense.memorials.every((r:any)=>r.collectedAt!==null),undefined,{timeout:30000});
 let current=await read(page);expect(current.defendersView.filter((v:any)=>['north-watch','north-archer'].includes(v.id)).every((v:any)=>!v.visible)).toBe(true);
 await advance(page,7);
 await page.waitForFunction(()=>(window as any).__farwind().state.defense.memorials.every((r:any)=>r.buriedAt!==null));
 await page.keyboard.press('e');await expect(page.getByRole('button',{name:'招募补充松岚的岗位（80金币）',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'招募补充松岚的岗位（80金币）',exact:true}).click();
 await page.waitForFunction(()=>(window as any).__farwind().state.coins===120);
 await page.getByRole('button',{name:'为松岚献一束庭院风铃花',exact:true}).click();
 await expect(page.getByRole('button',{name:'为松岚献一束庭院风铃花',exact:true})).toHaveCount(0);
 await page.screenshot({path:`${root}/barracks-recruitment.png`});
 // 窄屏入口、滚动和操作按钮使用正常流，记录最小视口。
 await page.setViewportSize({width:720,height:540});await page.screenshot({path:`${root}/barracks-narrow.png`});
 expect(await page.locator('.dialog-copy').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
 await page.setViewportSize({width:1280,height:720});await page.keyboard.press('Escape');await advance(page,3);
 await page.waitForFunction(()=>(window as any).__farwind().state.defense.guards.find((g:any)=>g.id==='north-watch').generation===1);
 await advance(page,1);current=await read(page);const replacement=current.state.defense.guards.find((g:any)=>g.id==='north-watch');expect(replacement.dead).toBe(false);expect(replacement.offDuty).toBe(false);expect(current.state.coins).toBe(120);
 await page.keyboard.press('e');await expect(page.locator('.guard-care')).toContainText('山青');await expect(page.locator('.guard-care')).toContainText('松岚');await expect(page.locator('.guard-care')).toContainText('已献花');
 await page.screenshot({path:`${root}/barracks-after.png`});await page.keyboard.press('Escape');
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'保存旅途',exact:true}).click();await page.waitForTimeout(1000);
 await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');current=await read(page);
 expect(current.state.coins).toBe(120);expect(current.state.defense.memorials).toHaveLength(2);expect(current.state.defense.memorials.find((r:any)=>r.guardId==='north-watch').flowers).toBe(true);expect(current.state.defense.guards.find((g:any)=>g.id==='north-watch').generation).toBe(1);
 expect(current.defendersView.find((v:any)=>v.id==='north-archer').visible).toBe(false);
 expect(errors).toEqual([]);
 writeFileSync(`${root}/browser-validation.json`,JSON.stringify({说明:'隔离浏览器通过旧档导入、真实键鼠及明确标记的开发快进验证；未改写运行状态，未覆盖用户浏览器存档。',结果:'通过',金币:current.state.coins,纪念记录:current.state.defense.memorials,补岗卫兵:replacement,浏览器错误:errors},null,2));
});

// 村门画面与纪念碑操作独立验证，不改写运行中的状态。
test('GUARD-AFTERMATH-02',async({page})=>{
 test.setTimeout(90000);
 mkdirSync(root,{recursive:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const s=initialState();s.time=5*1440+600;Object.assign(s.defense.guards[3],{hp:0,dead:true,mode:'dead'});delete s.defense.memorials;Object.assign(s.player,{x:820,y:435});
 await page.goto('/?npcDebug=1');await page.waitForFunction(()=>typeof(window as any).__farwind==='function');page.once('dialog',d=>d.accept());const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入存档',exact:true}).click();await(await chooser).setFiles({name:'guard-aftermath-gate.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(validate(s)))});
 await expect(page.getByText('正在装载风铃村素材……')).toHaveCount(0);await page.waitForFunction(()=>(window as any).__farwind().state.defense.memorials?.length===1&&(window as any).__farwind().mode==='');
 expect((await read(page)).defendersView.find((v:any)=>v.id==='north-watch').visible).toBe(true);await page.screenshot({path:`${root}/gate-before.png`});
 await page.waitForFunction(()=>(window as any).__farwind().state.defense.memorials[0].collectedAt!==null);
 expect((await read(page)).defendersView.find((v:any)=>v.id==='north-watch').visible).toBe(false);await page.screenshot({path:`${root}/gate-after.png`});await page.keyboard.press('Escape');
 // 纪念碑起始档沿用已完成正式事务的证据，不把预设安葬冒充自然模拟。
 const evidence=JSON.parse(await import('node:fs').then(fs=>fs.readFileSync(`${root}/browser-validation.json`,'utf8')));
 const monument=initialState();monument.time=10000;monument.coins=120;Object.assign(monument.player,{x:GUARD_MEMORIAL.x,y:GUARD_MEMORIAL.y+47});
 Object.assign(monument.defense.guards[3],evidence.补岗卫兵);Object.assign(monument.defense.guards[5],{hp:0,dead:true,mode:'dead'});monument.defense.memorials=evidence.纪念记录;
 const fc=page.waitForEvent('filechooser');page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'导入存档',exact:true}).click();await(await fc).setFiles({name:'guard-aftermath-memorial.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(validate(monument)))});
 await expect(page.getByText('正在装载风铃村素材……')).toHaveCount(0);await page.waitForFunction(()=>(window as any).__farwind().target==='guard-memorial',undefined,{timeout:15000});await page.screenshot({path:`${root}/memorial-world.png`});
 await page.keyboard.press('e');await expect(page.getByRole('heading',{name:'卫队纪念碑',exact:true})).toBeVisible();await expect(page.locator('.guard-care')).toContainText('松岚');await page.getByRole('button',{name:'为林弦献一束庭院风铃花',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().state.defense.memorials.find((r:any)=>r.guardId==='north-archer').flowers===true);await expect(page.getByRole('heading',{name:'卫队纪念碑',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'为林弦献一束庭院风铃花',exact:true})).toHaveCount(0);await page.screenshot({path:`${root}/memorial-flowers.png`});expect(errors).toEqual([]);
});
