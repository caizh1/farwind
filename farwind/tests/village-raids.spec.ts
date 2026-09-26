import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {initialState,validate} from '../src/game/systems/state';
import {nextRandom} from '../src/game/systems/defense';
import {RAID_GATES} from '../src/data/defense';
import {move} from './map-navigation';
const root=process.env.FARWIND_EVIDENCE_ROOT??'docs/village-defense/m4/browser';
const read=(p:Page)=>p.evaluate(()=>(window as any).__farwind());
async function fixture(page:Page,s:any){validate(s);await page.waitForFunction(()=>typeof (window as any).__farwind==='function');page.once('dialog',d=>d.accept());const choose=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入存档',exact:true}).click();await(await choose).setFiles({name:'village-raid-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(s))});await page.waitForFunction(()=>(window as any).__farwind().mode==='',undefined,{timeout:8000});}
const seedFor=(gate:number)=>{for(let seed=1;seed<1000;seed++)if(nextRandom(nextRandom(seed))%3===gate)return seed;throw Error('种子不存在');};
test.afterEach(async({page},info)=>{if(info.status!==info.expectedStatus&&!page.isClosed()){await mkdir(root,{recursive:true});await writeFile(`${root}/failure-${info.title.includes('北门')?'north':info.title.includes('南门')?'south':'east'}.json`,JSON.stringify({说明:'失败时只读现场，首因保留。',状态:await page.evaluate(()=>(window as any).__farwind?.())},null,2));}});
for(const [i,gate]of RAID_GATES.entries())test(`${gate.name}按有效时间自动预警、离屏自主击退和保存恢复`,async({page})=>{
 await mkdir(root,{recursive:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 const s=initialState();s.killed=['slime-1','slime-2','leaf-1','leaf-2'];s.quest=0;s.player.x=930;s.player.y=1220;
 s.defense.protectionMs=0;s.defense.cooldownMs=800;s.defense.seed=seedFor(i);await fixture(page,s);
 await expect.poll(async()=>(await read(page)).state.defense.raid?.phase).toBe('warning');
 await expect.poll(async()=>(await read(page)).defense.awaitingCheckpoint).toBe(false);
 await page.keyboard.press('Escape');const paused=await read(page);expect(paused.state.defense.raid.gateId).toBe(gate.id);expect(paused.defense.enemies).toEqual([]);
 await page.waitForTimeout(700);expect((await read(page)).state.defense).toEqual(paused.state.defense);
 await page.getByRole('button',{name:'保存旅途',exact:true}).click();await expect(page.locator('#toast')).toContainText('已保存');
 const stored=(await read(page)).state.defense;await page.reload();await page.waitForTimeout(700);await page.getByRole('button',{name:'继续旅途',exact:true}).click();
 expect((await read(page)).state.defense.sequence).toBe(1);expect((await read(page)).defense.arrows).toEqual([]);
 await page.waitForFunction(()=>(window as any).__farwind().defense.enemies.length>=2);
 await expect.poll(async()=>(await read(page)).defense.history.some((h:any)=>h.kind==='shot')).toBe(true);
 const active=await read(page);if(active.session)expect(active.session.combat.hitStopRemaining).toBe(0);
 await page.screenshot({path:`${root}/${gate.id}-offscreen.png`});
 await expect.poll(async()=>(await read(page)).state.defense.raid,{timeout:60000}).toBeNull();
 await expect.poll(async()=>{const d=await read(page);return !d.defense.critical&&!d.defenseCheckpointPending;}).toBe(true);
 const end=await read(page);expect(end.state.defense.guards.every((g:any)=>!g.dead)).toBe(true);expect(end.state.defense.cooldownMs).toBeGreaterThanOrEqual(239000);
 expect([end.state.quest,end.state.killed,end.state.bag,end.state.coins]).toEqual([s.quest,s.killed,s.bag,s.coins]);
 await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();const restored=await read(page);
 expect(restored.state.defense.completedSequence).toBe(1);expect(restored.state.defense.raid).toBeNull();expect(restored.state.defense.guards.map((g:any)=>g.hp)).toEqual(end.state.defense.guards.map((g:any)=>g.hp));
 await writeFile(`${root}/${gate.id}-runtime.json`,JSON.stringify({说明:'正式导入只建立时间边界和有效历史；未修改运行状态，自动调度、正式AI与箭矢完成防御。玩家离屏，无离线推进。',预警:stored,运行:active.defense,结束:end.state.defense,重载:restored.state.defense,页面错误:errors},null,2));expect(errors).toEqual([]);
});
test('自动预警保存事务中止时不生成小怪，手动重存可继续',async({page})=>{
 await mkdir(root,{recursive:true});await page.addInitScript(()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(v,k){const r=put.call(this,v,k);if(v.defense?.raid?.phase==='warning')r.addEventListener('success',()=>{if((window as any).__abortRaid)this.transaction.abort();},{once:true});return r;};});
 await page.goto('/');const s=initialState();s.defense.protectionMs=0;s.defense.cooldownMs=800;await page.evaluate(()=>(window as any).__abortRaid=true);await fixture(page,s);
 await expect(page.locator('#toast')).toContainText('驻防变化尚未保存');const fail=await read(page);expect(fail.mode).toBe('pause');expect(fail.defense.enemies).toEqual([]);expect(fail.defense.awaitingCheckpoint).toBe(true);
 await page.waitForTimeout(3500);expect((await read(page)).defense.enemies).toEqual([]);expect((await read(page)).state.defense).toEqual(fail.state.defense);
 await page.evaluate(()=>(window as any).__abortRaid=false);await page.getByRole('button',{name:'保存旅途',exact:true}).click();await expect(page.locator('#toast')).toContainText('已保存');
 await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().defense.enemies.length>=2);
 const recovery=await read(page);expect(recovery.state.defense.sequence).toBe(1);await writeFile(`${root}/warning-save-abort.json`,JSON.stringify({说明:'故障只注入IDB事务；预警保存未提交时正式运行不会出生小怪。',失败:fail.defense,恢复:recovery.defense},null,2));
});
test('主角与黑猫实际往返三门，正常模式无开发分区和按钮',async({page})=>{
 await mkdir(root,{recursive:true});await page.goto('/');const s=initialState();s.player.x=820;s.player.y=450;await fixture(page,s);
 const records:any[]=[];
 for(const [name,x,y,ix,iy]of [['north',820,130,820,380],['south',900,1990,900,1720],['east',2260,1080,1990,1080]]as const){
  await move(page,x,y);await page.waitForFunction(()=>{const d=(window as any).__farwind();const c=d.animation.cat.root;return Math.hypot(c[0]-d.state.player.x,c[1]-d.state.player.y)<120;});
  const a=await read(page);expect(Math.hypot(a.animation.cat.root[0]-x,a.animation.cat.root[1]-y)).toBeLessThan(125);records.push({出口:name,主角:a.state.player,黑猫:a.animation.cat.root});await page.screenshot({path:`${root}/${name}-passage.png`});await move(page,ix,iy);
 }
 expect((await read(page)).state.player.hp).toBe(100);await writeFile(`${root}/three-gate-passage.json`,JSON.stringify({说明:'全部位置推进来自真实键盘，诊断只读。',记录:records},null,2));
 await move(page,1960,1230);await page.keyboard.press('e');await expect(page.getByRole('heading',{name:'东门驻防',exact:true})).toBeVisible();await expect(page.locator('#defense-drill')).toHaveCount(0);
});
