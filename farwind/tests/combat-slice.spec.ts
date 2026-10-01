import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile,copyFile} from 'node:fs/promises';
const dir='docs/combat-slice/evidence';
const read=(page:Page)=>page.evaluate(()=>(window as any).__farwind());
async function reset(page:Page,preset:string){
 await page.locator('#combat-preset').selectOption(preset);
 await page.getByRole('button',{name:'重置隔离预设'}).click();
 await expect.poll(async()=>(await read(page))?.mode).toBe('');
 await expect.poll(()=>page.evaluate(()=>(window as any).__combatFeel.status().active)).toBe(true);
}
test.beforeAll(async()=>mkdir(dir,{recursive:true}));
test.beforeEach(async({page})=>{
 await page.goto('/?combatSlice=1');await page.getByRole('button',{name:'启程 · 新游戏',exact:true}).waitFor();
 await page.locator('#combat-preset').waitFor();
});
test.afterEach(async({page},info)=>{
 const snapshot=await read(page).catch(()=>null);
 await writeFile(`${dir}/${info.title}-result.json`,JSON.stringify({说明:'当前工作树的真实键鼠输入；预设仅建立初始条件，不写入结算结果。',结果:info.status==='passed'?'通过':'失败',运行快照:snapshot},null,2));
 await page.screenshot({path:`${dir}/${info.title}.png`});
 const video=page.video();await page.close();if(video)await copyFile(await video.path(),`${dir}/${info.title}.webm`);
});
test('diagonal-buffer-cancel',async({page})=>{
 await reset(page,'dummy');
 expect(await page.evaluate(()=>(window as any).__combatFeel.snapshot().场景)).toBe('CombatSlice');
 expect(await page.evaluate(async()=> (await import('/src/game/systems/save.ts')).SAVE_DATABASE)).toBe('farwind-combat-slice-isolated');
 await page.keyboard.down('d');await page.keyboard.down('s');await page.keyboard.press('j');
 await page.waitForFunction(()=>(window as any).__farwind().session.combat.stage===1);
 const first=(await read(page)).session.combat;expect(first.attackAim.x).toBeCloseTo(Math.SQRT1_2);expect(first.attackAim.y).toBeCloseTo(Math.SQRT1_2);
 await page.keyboard.up('d');await page.keyboard.up('s');await page.keyboard.press('j');await page.keyboard.press('j');
 await expect.poll(async()=>(await read(page)).session.combat.stage).toBe(2);
 await page.keyboard.down('a');await page.keyboard.press('l');await page.keyboard.up('a');
 await expect.poll(async()=>(await read(page)).session.combat.actions.filter((a:any)=>a.kind==='dash'&&a.executed!==undefined).length).toBe(1);
 const ended=await read(page);expect(ended.attackSerial).toBe(2);expect(ended.session.combat.buffered).toBe(false);
 expect(ended.session.combat.actions.filter((a:any)=>a.kind==='attack'&&a.executed!==undefined)).toHaveLength(2);
});
test('melee-parry',async({page})=>{
 await reset(page,'slime');
 await page.waitForFunction(()=>(window as any).__farwind().warnings.some((w:any)=>w.lead!==null&&w.lead>150&&w.lead<220),null,{polling:5});
 await page.keyboard.press('k');
 await page.waitForFunction(()=>(window as any).__farwind().feedback.events.some((e:any)=>e.kind==='counter-hit'));
 const s=await read(page);expect(s.state.player.hp).toBe(100);
 expect(s.contacts.filter((c:any)=>c.result==='normal'||c.result==='perfect')).toHaveLength(1);
 const hits=s.feedback.events.filter((e:any)=>e.kind==='counter-hit');expect(hits).toHaveLength(1);expect(hits[0].damage).toBeGreaterThan(0);
});
for(const preset of ['boar','spore'])test(`${preset}-locked-dodge`,async({page})=>{
 await reset(page,preset);
 await page.waitForFunction(()=>(window as any).__farwind().enemies.some((e:any)=>e.attack?.locked&&!e.attack.cancelled),null,{polling:5});
 const before=await page.evaluate(()=>{const s=(window as any).__farwind();return {hp:s.state.player.hp,attack:s.enemies.find((e:any)=>e.attack?.locked).attack};}),a=before.attack;
 const dodge=Math.abs(a.direction.x)>Math.abs(a.direction.y)?'s':'d';
 await page.keyboard.down(dodge);await page.keyboard.press('l');await page.waitForTimeout(250);await page.keyboard.up(dodge);
 await page.waitForFunction(at=>(window as any).__farwind().session.sim>=at,a.activeUntil+500);
 const after=await read(page);expect(after.state.player.hp).toBe(before.hp);
 expect(after.contacts.filter((e:any)=>e.id===a.attackId&&e.result==='hurt')).toHaveLength(0);
});
test('mixed-runtime',async({page})=>{
 await reset(page,'slice');expect((await read(page)).enemies.map((e:any)=>e.type).sort()).toEqual(['boar','leaf','spore']);
 await page.keyboard.press('j');await page.keyboard.press('j');
 await page.waitForFunction(()=>{const c=(window as any).__farwind().session.combat;return c.stage===2&&c.phase==='recovery';});
 await page.keyboard.down('a');await page.keyboard.press('l');await page.waitForTimeout(250);await page.keyboard.up('a');
 await page.keyboard.down('s');await page.waitForTimeout(250);await page.keyboard.up('s');
 await page.keyboard.press('k');await page.waitForTimeout(900);
 const s=await read(page);expect(s.attackSerial).toBeGreaterThan(0);expect(s.session.combat.actions.some((a:any)=>a.executed!==undefined)).toBe(true);
 const events=s.feedback.events.filter((e:any)=>['hit','protected-hit','interrupt','guard-break','counter-hit','kill'].includes(e.kind));expect(events.length).toBeGreaterThan(0);expect(new Set(events.map((e:any)=>e.id)).size).toBe(events.length);
});
test('effects-disabled-runtime',async({page})=>{
 await reset(page,'slime');await page.locator('#combat-effects').uncheck();
 await page.keyboard.press('j');await page.keyboard.press('j');
 await page.waitForFunction(()=>(window as any).__farwind().feedback.events.some((e:any)=>['hit','interrupt','kill'].includes(e.kind)));
 const s=await read(page);expect(s.feedback.mode).toBe('A');expect(s.enemies[0].hp).toBeLessThan(60);
 expect(new Set(s.feedback.events.map((e:any)=>e.id)).size).toBe(s.feedback.events.length);
});
test('runtime-recording',async({page})=>{
 await reset(page,'slice');await page.locator('#combat-feel-debug summary').click();
 await page.keyboard.press('j');await page.keyboard.press('j');
 await page.waitForFunction(()=>{const c=(window as any).__farwind().session.combat;return c.stage===2&&c.phase==='recovery';});
 await page.keyboard.down('a');await page.keyboard.press('l');await page.waitForTimeout(260);await page.keyboard.up('a');
 await page.keyboard.press('k');await page.waitForTimeout(1000);
 await page.locator('#combat-feel-debug summary').click();await reset(page,'slime');await page.locator('#combat-feel-debug summary').click();
 await page.waitForFunction(()=>(window as any).__farwind().warnings.some((w:any)=>w.lead!==null&&w.lead>150&&w.lead<220),null,{polling:5});await page.keyboard.press('k');
 await page.waitForFunction(()=>(window as any).__farwind().feedback.events.some((e:any)=>e.kind==='counter-hit'));await page.waitForTimeout(500);
 for(const preset of ['boar','spore']){
  await page.locator('#combat-feel-debug summary').click();await reset(page,preset);await page.locator('#combat-feel-debug summary').click();
  await page.waitForFunction(()=>(window as any).__farwind().enemies.some((e:any)=>e.attack?.locked&&!e.attack.cancelled),null,{polling:5});
  const direction=await page.evaluate(()=>(window as any).__farwind().enemies.find((e:any)=>e.attack?.locked).attack.direction),dodge=Math.abs(direction.x)>Math.abs(direction.y)?'s':'d';
  await page.keyboard.down(dodge);await page.keyboard.press('l');await page.waitForTimeout(260);await page.keyboard.up(dodge);await page.waitForTimeout(700);
 }
 expect((await read(page)).state.player.hp).toBe(100);
});
