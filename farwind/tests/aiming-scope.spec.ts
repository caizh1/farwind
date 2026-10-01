import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {move} from './skill-navigation';
import {VILLAGE_ANCHORS} from '../src/data/maps/windbell/layout';
import {initialState} from '../src/game/systems/state';
const dir='docs/aiming-scope/evidence';
const read=(p:Page)=>p.evaluate(()=>(window as any).__farwind());
async function resume(p:Page){await p.keyboard.press('Escape');if((await read(p)).mode==='pause')await p.locator('#close').click();await p.waitForFunction(()=>(window as any).__farwind().mode==='');}
test('scope-normal-flow',async({page})=>{
 await mkdir(dir,{recursive:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'启程 · 新游戏',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');
 expect((await read(page)).state.coins).toBe(120);expect((await read(page)).state.skills.swordWindStage).toBe(0);
 await move(page,VILLAGE_ANCHORS.smith.x,VILLAGE_ANCHORS.smith.y+65);await page.keyboard.press('e');
 await page.locator('[data-item="windScope"]').click();await page.screenshot({path:dir+'/shop.png'});await page.locator('#shop-review').click();await page.locator('#shop-confirm').click();
 await expect.poll(async()=>(await read(page)).state.coins).toBe(40);await resume(page);
 await page.keyboard.press('Tab');await page.locator('#bag-equipment').click();await page.locator('[data-equipment-slot="head"]').click();await page.locator('#equipment-equip').click();
 await expect.poll(async()=>(await read(page)).state.equipment.head).toBe('windScope');await expect(page.locator('.equipment-rules')).toContainText('尚未学会剑风');await page.screenshot({path:dir+'/equipped-unlearned.png'});
 await resume(page);const serial=(await read(page)).attackSerial;await page.keyboard.press('i');await page.waitForTimeout(600);expect((await read(page)).attackSerial).toBe(serial);
 // 正式第一阶教本与机关：即使装备镜子也可用中键手动完成学习。
 await move(page,1380,1525);await page.keyboard.press('e');await page.getByRole('button',{name:'开始限定试用',exact:true}).click();await move(page,1310,1400);await page.keyboard.press('w');await page.mouse.down({button:'middle'});await page.waitForTimeout(300);await page.mouse.up({button:'middle'});
 await expect.poll(async()=>(await read(page)).state.skills.swordWindStage).toBe(1);
 if((await read(page)).mode==='dialog')await page.getByRole('button',{name:'继续 · E',exact:true}).click();
 await move(page,2200,1060);await page.keyboard.press('a');await page.keyboard.down('i');
 await page.waitForFunction(()=>(window as any).__farwind().windAim.target!==null);const aimStart=await read(page);await page.screenshot({path:dir+'/auto-aim.png'});
 await expect.poll(async()=>(await read(page)).state.coins,{timeout:15000}).toBeGreaterThan(40);await page.keyboard.up('i');await page.waitForTimeout(1200);
 const won=await read(page);expect(won.state.skills.swordWindStage).toBe(1);expect(won.state.runes.slots.filter(Boolean)).toHaveLength(0);expect(won.state.coins).toBeGreaterThan(40);
 // 松开、暂停、浏览器失焦及重开不积压攻击。
 const stopped=won.attackSerial;await page.waitForTimeout(700);expect((await read(page)).attackSerial).toBe(stopped);
 await page.keyboard.down('i');await page.keyboard.press('Escape');await page.keyboard.up('i');await page.locator('#close').click();await page.waitForTimeout(1000);const restoredSerial=(await read(page)).attackSerial;await page.waitForTimeout(600);expect((await read(page)).attackSerial).toBe(restoredSerial);
 await page.keyboard.down('i');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.keyboard.up('i');await expect(page.locator('.pause-panel')).toBeVisible();await page.locator('#close').click();await page.waitForTimeout(800);
 await move(page,670,720);await page.waitForTimeout(8500);await page.keyboard.press('Tab');await page.locator('#bag-equipment').click();await page.locator('[data-equipment-slot="head"]').click();await page.screenshot({path:dir+'/equipment.png'});
 await page.setViewportSize({width:390,height:844});const bounds=await page.locator('.equipment-panel').evaluate(e=>({可视:e.clientWidth,内容:e.scrollWidth}));expect(bounds.内容).toBeLessThanOrEqual(bounds.可视+2);await page.screenshot({path:dir+'/equipment-narrow.png'});await page.setViewportSize({width:1280,height:720});
 await resume(page);await page.keyboard.press('Escape');await page.locator('#save').click();const saved=(await read(page)).state;await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');const reloaded=await read(page);expect(reloaded.state.equipment.head).toBe('windScope');expect(reloaded.state.coins).toBe(saved.coins);expect(reloaded.state.skills.swordWindStage).toBe(1);expect(reloaded.windAim.target).toBeNull();
 await page.keyboard.press('Tab');await page.locator('#bag-equipment').click();await page.locator('[data-equipment-slot="head"]').click();await page.locator('#equipment-unequip').click();await expect.poll(async()=>(await read(page)).state.equipment.head).toBeNull();await resume(page);
 await page.keyboard.down('i');await page.waitForTimeout(450);await page.keyboard.up('i');expect((await read(page)).windAim.enabled).toBe(false);expect((await read(page)).windAim.target).toBeNull();await page.waitForTimeout(4500);
 await page.keyboard.press('Tab');await page.locator('#bag-equipment').click();await page.locator('[data-equipment-slot="head"]').click();await page.locator('#equipment-equip').click();await expect.poll(async()=>(await read(page)).state.equipment.head).toBe('windScope');await resume(page);
 // 已正式解锁的生产新档持续施放，观察真实对象回收；此段没有修改游戏状态。
 await page.waitForTimeout(800);const beforeSoak=await read(page);await page.keyboard.down('i');
 const timing=await page.evaluate(()=>new Promise<{中位帧毫秒:number;九五分位帧毫秒:number;最大帧毫秒:number;帧数:number}>(ok=>{const start=performance.now(),frames:number[]=[];let last=start;const frame=(now:number)=>{frames.push(now-last);last=now;if(now-start<20000)requestAnimationFrame(frame);else {const sorted=frames.slice(1).sort((a,b)=>a-b);ok({中位帧毫秒:sorted[Math.floor(sorted.length*.5)],九五分位帧毫秒:sorted[Math.floor(sorted.length*.95)],最大帧毫秒:sorted.at(-1)!,帧数:sorted.length});}};requestAnimationFrame(frame);}));
 const duringSoak=await read(page);expect(duringSoak.attackSerial-beforeSoak.attackSerial).toBeGreaterThan(25);expect(duringSoak.skillGrowth.winds.length).toBeLessThanOrEqual(8);expect(duringSoak.skillGrowth.objects).toBeLessThanOrEqual(beforeSoak.skillGrowth.objects+128);
 await page.keyboard.up('i');await page.waitForTimeout(2000);const afterSoak=await read(page);expect(afterSoak.skillGrowth.winds).toHaveLength(0);expect(afterSoak.runes.projectiles).toHaveLength(0);expect(afterSoak.runes.pending).toBe(0);
 await writeFile(dir+'/continuous-cast.json',JSON.stringify({说明:'本机生产新档已通过正常流程解锁并装备，村庄无目标按住I20秒；帧间隔为Playwright Chromium Metal现场样本，不代表全流程或跨设备帧率。仅读取诊断，不改游戏状态。',帧间隔:timing,施放前:{对象:beforeSoak.skillGrowth.objects,动作:beforeSoak.attackSerial},施放中:{对象:duringSoak.skillGrowth.objects,动作:duringSoak.attackSerial,剑风:duringSoak.skillGrowth.winds.length},松开两秒后:{对象:afterSoak.skillGrowth.objects,剑风:afterSoak.skillGrowth.winds.length,派生:afterSoak.runes.projectiles.length,预约:afterSoak.runes.pending}},null,2));
 expect((await read(page)).state.coins).toBe(saved.coins);expect(errors).toEqual([]);
 await writeFile(dir+'/normal-flow.json',JSON.stringify({说明:'正式生产构建新档，正常铁匠购买、真实装备、正式教本中键教学、I背向怪物自动瞄准并击杀发金币、真实行走、刷新保存。仅读取诊断；未导入或改血量、背包、技能和任务。',首次锁定:aimStart.windAim,击杀后:won.state,重载:reloaded.state,窄屏:bounds,页面异常:errors},null,2));
});
test('scope-legacy-migration',async({page})=>{
 await mkdir(dir,{recursive:true});const old:any=initialState();old.schema_version=15;delete old.equipment.head;delete old.shopStock['smith:windScope'];old.coins=57;
 await page.goto('/');await page.waitForFunction(()=>typeof (window as any).__farwind==='function');
 await page.evaluate(async old=>{await new Promise<void>((ok,no)=>{const r=indexedDB.open('farwind-first-map',1);r.onsuccess=()=>{const d=r.result,t=d.transaction('states','readwrite');t.objectStore('states').put(old,'current');t.oncomplete=()=>{d.close();ok();};t.onerror=()=>no(t.error);};r.onerror=()=>no(r.error);});},old);
 await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');let s=(await read(page)).state;expect(s.schema_version).toBe(16);expect(s.coins).toBe(57);expect(s.equipment.head).toBeNull();expect(s.bag.filter((v:any)=>v?.id==='windScope')).toHaveLength(0);
 await page.keyboard.press('Escape');await page.locator('#save').click();await page.waitForTimeout(300);const download=page.waitForEvent('download');await page.locator('#migration-backup').click();await (await download).saveAs(dir+'/legacy-original.json');expect(JSON.parse(await readFile(dir+'/legacy-original.json','utf8'))).toEqual(old);
 const exportEvent=page.waitForEvent('download');await page.locator('#export').click();await (await exportEvent).saveAs(dir+'/migrated-export.json');
 await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');s=(await read(page)).state;expect(s.coins).toBe(57);expect(s.shopStock['smith:windScope']).toBe(1);
 await writeFile(dir+'/migration.json',JSON.stringify({说明:'显式十五版隔离迁移夹具，不能作为正常获取证据；原始文件与新档导出均保留。',结果:s},null,2));
});
