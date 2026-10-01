import {test,expect,type Page} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {move} from './skill-navigation';
const root='docs/combat-build/evidence/';
const read=(p:Page)=>p.evaluate(()=>(window as any).__farwind());
async function idle(p:Page){await p.waitForFunction(()=>{const c=(window as any).__farwind().session.combat;return !c.stage&&!c.ready;},null,{timeout:15000});}
async function chain(p:Page,four=false){
 await idle(p);await p.keyboard.press('j');
 await p.waitForFunction(()=>(window as any).__farwind().session.combat.stage===1);await p.keyboard.press('j');
 await p.waitForFunction(()=>(window as any).__farwind().session.combat.stage===2);await p.keyboard.press('j');
 await p.waitForFunction(()=>(window as any).__farwind().session.combat.stage===3);
 if(four){await p.waitForFunction(()=>{const s=(window as any).__farwind();return s.session.combat.stage===3&&s.skillGrowth.sim-s.session.combat.actions.filter((x:any)=>x.executed!==undefined).at(-1).executed>=370;});await p.keyboard.press('j');await p.waitForFunction(()=>(window as any).__farwind().session.combat.stage===4);}
 await idle(p);
}
async function close(p:Page){if((await read(p)).mode==='dialog')await p.getByRole('button',{name:'继续 · E',exact:true}).click();}
async function train(p:Page,name:string){await p.getByRole('button',{name:'本领与构筑训练',exact:true}).click();await p.getByRole('button',{name:'开始'+name,exact:true}).click();}
async function dismiss(p:Page){
 await p.locator('#close').click();
 if((await read(p)).mode==='pause')await p.locator('#close').click();
 await p.waitForFunction(()=>(window as any).__farwind().mode==='');
}
async function equip(p:Page,id:string,slot:number){
 await p.locator(`[data-rune-slot="${slot}"]`).click();await p.locator(`[data-rune-id="${id}"]`).click();
 const claim=p.locator('#rune-claim');if(await claim.count())await claim.click();await p.locator('#rune-equip').click();
 await expect.poll(async()=>(await read(p)).state.runes.slots[slot]).toBe(id);
}
async function resume(p:Page){
 await move(p,850,715);await p.keyboard.press('w');await idle(p);
 await p.keyboard.press('j');await p.waitForFunction(()=>(window as any).__farwind().session.combat.stage===1);await p.keyboard.press('j');await p.waitForFunction(()=>(window as any).__farwind().session.combat.stage===2);
 await p.waitForFunction(()=>{const s=(window as any).__farwind();return s.session.combat.stage===2&&s.session.combat.dashLegalAt<=s.skillGrowth.sim;});
 await p.keyboard.down('d');await p.keyboard.press('l');await p.keyboard.up('d');
 await p.waitForFunction(()=>(window as any).__farwind().session.combat.momentum?.stage===3);
 await p.waitForFunction(()=>(window as any).__farwind().session.combat.dashRemaining===0);
 await p.keyboard.down('a');await p.keyboard.down('w');await p.keyboard.press('j');await p.keyboard.up('a');await p.keyboard.up('w');
 await p.waitForFunction(()=>(window as any).__farwind().session.combat.stage===3);await idle(p);
}
test('normal-unlock-flow',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'启程 · 新游戏'}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');
 expect((await read(page)).state.skills.swordWindStage).toBe(0);expect((await read(page)).state.runes.owned).toEqual([]);
 await move(page,850,715);await page.keyboard.press('w');await train(page,'四连入门');await chain(page);
 await expect.poll(async()=>(await read(page)).state.skills.meleeFinisher).toBe(true);expect((await read(page)).state.runes.owned).toContain('r33');
 await train(page,'破岸终结');await chain(page,true);await expect.poll(async()=>(await read(page)).state.runes.owned).toContain('r12');
 await page.screenshot({path:root+'normal-melee-learning.png'});
 await page.waitForTimeout(8500);await page.keyboard.press('r');await equip(page,'r33',0);await equip(page,'r12',1);await page.locator('[data-preset-save="1"]').click();await dismiss(page);
 await train(page,'借势训练');await resume(page);await resume(page);await expect.poll(async()=>(await read(page)).state.runes.growth.r33.advanced).toBe(true);
 await page.waitForTimeout(8500);await page.keyboard.press('r');await page.locator('[data-rune-id="r33"]').click();await page.locator('[data-growth-branch="calm"]').click();await expect.poll(async()=>(await read(page)).state.runes.growth.r33.branch).toBe('calm');await dismiss(page);
 await move(page,1380,1525);await page.keyboard.press('e');await page.getByRole('button',{name:'开始限定试用',exact:true}).click();await move(page,1310,1400);await page.keyboard.press('w');await page.keyboard.press('i');
 await expect.poll(async()=>(await read(page)).state.skills.swordWindStage).toBe(1);await close(page);await idle(page);
 await page.screenshot({path:root+'normal-wind-learning.png'});
 await page.waitForTimeout(8500);await page.keyboard.press('r');await equip(page,'r31',0);await equip(page,'r32',1);await page.locator('[data-preset-save="0"]').click();await dismiss(page);
 await move(page,850,715);await page.keyboard.press('w');await train(page,'回流训练');await page.keyboard.down('i');await expect.poll(async()=>(await read(page)).state.runes.growth.r31.advanced).toBe(true);await page.keyboard.up('i');await idle(page);
 await page.waitForTimeout(8500);await page.keyboard.press('r');await page.locator('[data-rune-id="r31"]').click();await page.locator('[data-growth-branch="anchor"]').click();await expect.poll(async()=>(await read(page)).state.runes.growth.r31.branch).toBe('anchor');await page.screenshot({path:root+'normal-branches.png'});await dismiss(page);
 const before=(await read(page)).state;await page.keyboard.press('Escape');await page.locator('#save').click();await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();
 await page.waitForFunction(()=>(window as any).__farwind().mode==='');const after=(await read(page)).state;
 expect(after.skills).toEqual(before.skills);expect(after.runes.growth).toEqual(before.runes.growth);expect(after.runes.presets.map((x:any)=>x.slots)).toEqual(before.runes.presets.map((x:any)=>x.slots));expect(after.runes.slots).toHaveLength(5);expect(errors).toEqual([]);
 writeFileSync(root+'normal-flow.json',JSON.stringify({说明:'正式新档入口，仅键盘移动、实际木桩训练、教本与风铃命中、领取和装备。未修改血量、背包、任务或进度。',学习:after.skills,符文:after.runes,错误:errors},null,2));
});
test('representative-build-combat',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/?combatSlice=1');await page.waitForFunction(()=>(window as any).__combatFeel);
 await page.locator('#combat-wind').check();await page.locator('#combat-four').check();await page.locator('#combat-preset').selectOption('highLife');await page.locator('#combat-build').selectOption('none');await page.locator('#combat-reset').click();
 await page.waitForFunction(()=>(window as any).__farwind().mode==='');await page.locator('#combat-feel-debug summary').click();
 await page.keyboard.press('d');const start=(await read(page)).skillGrowth.enemies.find((x:any)=>x.hp===20000);expect(start).toBeTruthy();
 await page.keyboard.down('i');await page.waitForTimeout(3000);await page.keyboard.up('i');const basic=await read(page);writeFileSync(root+'basic-combat.json',JSON.stringify({说明:'真实高生命样板首因与计数。',状态:basic},null,2));expect(basic.runes.metrics.native).toBeGreaterThan(1);expect(basic.state.runes.slots.filter(Boolean)).toHaveLength(0);
 await page.keyboard.down('i');await page.keyboard.press('Escape');await page.keyboard.up('i');await page.getByRole('button',{name:'继续旅途',exact:true}).click();await idle(page);const serial=(await read(page)).attackSerial;await page.waitForTimeout(700);expect((await read(page)).attackSerial).toBe(serial);
 await page.locator('#combat-feel-debug summary').click();await page.locator('#combat-preset').selectOption('slice');await page.locator('#combat-build').selectOption('wind');await page.locator('#combat-reset').click();await page.waitForFunction(()=>(window as any).__farwind().state.runes.slots[0]==='r31');await page.locator('#combat-feel-debug summary').click();
 await page.keyboard.press('d');for(let i=0;i<5;i++){await page.keyboard.down('i');await page.waitForTimeout(650);await page.keyboard.up('i');await page.keyboard.press('k');await page.waitForTimeout(300);await page.keyboard.down('w');await page.keyboard.press('l');await page.waitForTimeout(200);await page.keyboard.up('w');await page.keyboard.press('d');}
 const wind=await read(page);await page.screenshot({path:root+'wind-build-combat.png'});
 await page.locator('#combat-feel-debug summary').click();await page.locator('#combat-build').selectOption('melee');await page.locator('#combat-reset').click();await page.waitForFunction(()=>(window as any).__farwind().state.runes.slots[0]==='r33');await page.locator('#combat-feel-debug summary').click();
 await page.keyboard.press('d');for(let i=0;i<3;i++){await page.keyboard.press('j');await page.waitForTimeout(160);await page.keyboard.press('j');await page.waitForTimeout(470);await page.keyboard.down('s');await page.keyboard.press('l');await page.waitForTimeout(220);await page.keyboard.up('s');await page.keyboard.press('w');await page.keyboard.press('j');await page.waitForTimeout(400);await page.keyboard.press('j');await page.waitForTimeout(750);await page.keyboard.press('k');await page.waitForTimeout(650);}
 const melee=await read(page);await page.screenshot({path:root+'melee-build-combat.png'});expect(melee.state.player.hp).toBeGreaterThan(0);
 const diagnostic=await page.evaluate(()=>(window as any).__combatFeel.snapshot());expect(errors).toEqual([]);
 writeFileSync(root+'representative-combat.json',JSON.stringify({说明:'显式隔离样板初始条件，包含近战、冲撞、远程敌人与20000生命单体；后续走正式输入与AI。不能替代正常解锁流程或全主线平衡验收。',基础:basic,剑风:wind,近战:melee,诊断:diagnostic,错误:errors},null,2));
});

test('input-lifecycle-and-soak',async({page,context})=>{
 await page.goto('/?combatSlice=1');await page.waitForFunction(()=>(window as any).__combatFeel);
 await page.locator('#combat-wind').check();await page.locator('#combat-four').check();await page.locator('#combat-preset').selectOption('dummy');await page.locator('#combat-build').selectOption('wind');await page.locator('#combat-reset').click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');await page.locator('#combat-feel-debug summary').click();await page.keyboard.press('w');
 await page.mouse.move(650,300);await page.mouse.down({button:'middle'});await page.waitForTimeout(1300);await page.mouse.up({button:'middle'});await idle(page);
 const mouse=(await read(page)).attackSerial;expect(mouse).toBeGreaterThan(2);await page.waitForTimeout(600);expect((await read(page)).attackSerial).toBe(mouse);
 // 自动化浏览器保持各页面焦点，切页不派发失焦；这里用浏览器事件触发正式监听器，不改战斗状态。
 await page.keyboard.down('i');await page.waitForTimeout(500);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await expect.poll(async()=>(await read(page)).mode).toBe('pause');await page.keyboard.up('i');await page.getByRole('button',{name:'继续旅途',exact:true}).click();await idle(page);const blurred=(await read(page)).attackSerial;await page.waitForTimeout(800);expect((await read(page)).attackSerial).toBe(blurred);
 // 固定预览：同一正式四连的起势、有效挥击和收势，镜像与脚底锚点来自角色模块。
 await idle(page);await page.keyboard.press('j');await page.waitForFunction(()=>(window as any).__farwind().session.combat.stage===1);await page.keyboard.press('j');await page.waitForFunction(()=>(window as any).__farwind().session.combat.stage===2);await page.keyboard.press('j');await page.waitForFunction(()=>(window as any).__farwind().session.combat.stage===3);await page.waitForFunction(()=>{const s=(window as any).__farwind();return s.session.combat.stage===3&&s.skillGrowth.sim-s.session.combat.actions.filter((x:any)=>x.executed!==undefined).at(-1).executed>=370;});await page.keyboard.press('j');await page.waitForFunction(()=>(window as any).__farwind().session.combat.stage===4);await page.screenshot({path:root+'finisher-windup.png'});await page.waitForFunction(()=>(window as any).__farwind().session.combat.phase==='active');await page.screenshot({path:root+'finisher-active.png'});await page.waitForFunction(()=>(window as any).__farwind().session.combat.phase==='recovery');await page.screenshot({path:root+'finisher-recovery.png'});await idle(page);
 const samples:any[]=[];await page.keyboard.down('i');for(let n=0;n<6;n++){await page.waitForTimeout(10000);samples.push(await read(page));}await page.keyboard.up('i');await idle(page);await page.waitForTimeout(4500);const end=await read(page);
 for(const s of samples){expect(s.skillGrowth.winds.length).toBeLessThanOrEqual(4);expect(s.runes.traces.length).toBeLessThanOrEqual(8);expect(s.feedback.effects.length).toBeLessThanOrEqual(32);expect(s.runes.pending).toBeLessThanOrEqual(64);}
 expect(end.skillGrowth.winds).toHaveLength(0);expect(end.runes.traces).toHaveLength(0);expect(end.runes.pending).toBe(0);expect(samples.at(-1).skillGrowth.objects).toBeLessThan(samples[0].skillGrowth.objects+40);
 const diagnostic=await page.evaluate(()=>(window as any).__combatFeel.snapshot());
 writeFileSync(root+'input-soak.json',JSON.stringify({说明:'中键真实按住/松开、浏览器失焦事件进入正式监听器（自动化切页不派发失焦）、四连三阶段截图、六十秒实际按住剑风；隔离木桩初始条件，非正常解锁证据。',中键结束序号:mouse,失焦结束序号:blurred,采样:samples.map(s=>({模拟时刻:s.skillGrowth.sim,投射物:s.skillGrowth.winds.length,风痕:s.runes.traces.length,对象:s.skillGrowth.objects,队列:s.runes.pending,原生命中:s.runes.metrics.native})),结束:{投射物:end.skillGrowth.winds.length,风痕:end.runes.traces.length,队列:end.runes.pending},诊断:diagnostic},null,2));
});

import {initialState} from '../src/game/systems/state';
import {completeWindLesson} from '../src/game/systems/skills';
test('legacy-save-backup-and-import',async({page})=>{
 let old:any=initialState();for(const id of ['windLessonResolved','serialWindCircuitRestored','longWindRouteRestored'] as const)old=completeWindLesson(old,id);old.skills.devices.serialValve=1;old.skills.devices.leakClosed=true;old.schema_version=14;delete old.skills.meleeFinisher;delete old.skills.buildLessons;old.runes.version=1;delete old.runes.growth;old.runes.owned=['r01'];old.runes.slots[0]='r01';
 await page.goto('/');await page.waitForFunction(()=>typeof (window as any).__farwind==='function');
 await page.evaluate(async old=>{await new Promise<void>((ok,no)=>{const r=indexedDB.open('farwind-first-map',1);r.onsuccess=()=>{const d=r.result,t=d.transaction('states','readwrite');t.objectStore('states').put(old,'current');t.oncomplete=()=>{d.close();ok();};t.onerror=()=>no(t.error);};r.onerror=()=>no(r.error);});},old);
 await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');let s=(await read(page)).state;expect(s.schema_version).toBe(15);expect(s.skills.swordWindStage).toBe(3);expect(s.skills.meleeFinisher).toBe(false);expect(s.runes.owned).toEqual(['r01']);expect(s.runes.slots).toEqual(old.runes.slots);
 await page.keyboard.press('Escape');await page.locator('#save').click();await expect.poll(async()=>{return page.evaluate(async()=>new Promise<any>(ok=>{const r=indexedDB.open('farwind-first-map',1);r.onsuccess=()=>{const d=r.result,t=d.transaction('states','readonly'),q=t.objectStore('states').get('before-combat-build');q.onsuccess=()=>ok(q.result);t.oncomplete=()=>d.close();};}));}).toEqual(old);
 const backupPromise=page.waitForEvent('download');await page.locator('#migration-backup').click();const backup=await backupPromise;await backup.saveAs(root+'legacy-original.json');
 await page.locator('#close').click();await page.keyboard.press('r');await page.locator('[data-rune-id="r31"]').click();await page.locator('#rune-claim').click();await expect.poll(async()=>(await read(page)).state.runes.owned.filter((id:string)=>id==='r31').length).toBe(1);await dismiss(page);
 await page.keyboard.press('Escape');const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();await (await downloadPromise).saveAs(root+'migrated-export.json');
 await page.locator('#close').click();await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');await page.keyboard.press('Escape');page.once('dialog',d=>d.accept());const chooser=page.waitForEvent('filechooser');await page.locator('#import').click();await (await chooser).setFiles(root+'migrated-export.json');await page.waitForFunction(()=>(window as any).__farwind().state.runes.owned.includes('r31'));s=(await read(page)).state;expect(s.runes.owned.filter((id:string)=>id==='r31')).toHaveLength(1);expect(s.skills.swordWindStage).toBe(3);expect(s.runes.growth.r31).toEqual({advanced:false,branch:null});
 writeFileSync(root+'migration-result.json',JSON.stringify({说明:'显式十四版边界夹具。保留原技能/装备/进度、十五版重复迁移不发奖、旧奖励一次补领、真实导出/导入与原档恢复文件。不能作为正常解锁证据。',技能:s.skills,符文:s.runes},null,2));
});
