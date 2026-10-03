import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {move} from './map-navigation';
import {syncMapGeometry} from '../src/data/world';
const read=(p:Page)=>p.evaluate(()=>(window as any).__farwind());
const root='docs/spawn-cue/evidence';

test('first-exit-spawn-cue',async({page})=>{
 await mkdir(root,{recursive:true});syncMapGeometry(false);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'启程 · 新游戏',exact:true}).click();
 await page.waitForFunction(()=>(window as any).__farwind?.().mode==='');
 await move(page,900,1000);await move(page,900,1350);
 await page.keyboard.down('s');
 try{
  await page.waitForFunction(()=>{const s=(window as any).__farwind();return s.state.encounters.groups['south-reed-patrol'].wave===0&&s.wilderness.arrivals.some((c:any)=>!c.spawned&&c.readyAt-s.skillGrowth.sim>700);});
  // 连续出村时截取首波预告，避免等到寻路终点后误采到第二波。
  await page.waitForTimeout(180);
 }finally{await page.keyboard.up('s');}
 const cue=await read(page),pending=cue.wilderness.arrivals.filter((c:any)=>!c.spawned);
 expect(cue.state.encounters.groups['south-reed-patrol'].wave).toBe(0);expect(cue.state.player.hp).toBe(100);
 expect(pending).toHaveLength(6);for(const c of pending)expect(cue.enemies.some((e:any)=>e.id===c.id)).toBe(false);
 expect(cue.wilderness.spawnDepth).toBeLessThan(cue.warningLayers.heroShadow);
 await page.screenshot({path:root+'/first-exit-circles.png'});
 await page.keyboard.press('Escape');const paused=await read(page);await page.waitForTimeout(350);const still=await read(page);
 expect(still.skillGrowth.sim).toBe(paused.skillGrowth.sim);expect(still.wilderness.arrivals).toEqual(paused.wilderness.arrivals);
 await page.locator('#save').click();await expect(page.getByText('旅途已保存',{exact:true})).toBeVisible();
 await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();
 await page.waitForFunction(()=>(window as any).__farwind().wilderness.arrivals.some((c:any)=>!c.spawned));
 const restored=await read(page);expect(restored.wilderness.arrivals.filter((c:any)=>!c.spawned).map((c:any)=>c.id).sort()).toEqual(pending.map((c:any)=>c.id).sort());
 await page.waitForFunction(()=>{const s=(window as any).__farwind();return s.wilderness.arrivals.some((c:any)=>c.spawned);});
 const landed=await read(page);for(const c of landed.wilderness.arrivals.filter((c:any)=>c.spawned)){
  const e=landed.enemies.find((e:any)=>e.id===c.id);expect(e).toBeDefined();expect(Math.hypot(e.x-c.x,e.y-c.y)).toBeLessThan(10);
 }
 await page.screenshot({path:root+'/first-exit-arrival.png'});await page.waitForTimeout(400);const done=await read(page);
 expect(done.wilderness.arrivals).toHaveLength(0);expect(new Set(done.enemies.map((e:any)=>e.id)).size).toBe(done.enemies.length);expect(done.state.player.hp).toBe(cue.state.player.hp);expect(errors).toEqual([]);
 await writeFile(root+'/validation.json',JSON.stringify({说明:'隔离浏览器运行正式构建，从新游戏出发，经真实键盘从村庄走到南门；未导入或修改进度。检查预告无敌人身体、暂停同步、预告期间保存并刷新读档、同一位置生成、光圈消退、身份唯一和无报错。',预告数量:pending.length,预告毫秒:pending[0].readyAt-pending[0].startedAt,角色下层:true,暂停:'通过',保存与刷新:'通过',无重复生成:true,玩家生命:done.state.player.hp,错误:errors},null,2));
});
