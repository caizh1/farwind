import {test,expect,type Page} from "@playwright/test";
import {mkdir,writeFile} from "node:fs/promises";
import {initialState} from "../src/game/systems/state";
import {prepareEastRaid} from "../src/game/systems/defense";
import {regionAt} from "../src/data/village";
const root=process.env.FARWIND_EVIDENCE_ROOT ?? "docs/village-defense/m3/recovery";
const read=(p:Page)=>p.evaluate(()=>(window as any).__farwind());
async function fixture(page:Page,s:any){
 page.once("dialog",d=>d.accept());const chooser=page.waitForEvent("filechooser");
 await page.getByRole("button",{name:"导入存档",exact:true}).click();
 await(await chooser).setFiles({name:"defense-recovery.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(s))});
 await page.waitForFunction(()=>(window as any).__farwind().mode==="");
}
test("实际守卫死亡后IDB请求成功但事务中止，暂停反馈与手动重存可恢复",async({page})=>{
 await mkdir(root,{recursive:true});
 await page.addInitScript(()=>{
  const put=IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put=function(value,key){
   const r=put.call(this,value,key);
   if(value.defense?.guards?.some((g:any)=>g.id==='east-watch'&&g.dead))
    r.addEventListener('success',()=>{if((window as any).__abortDefenseSave)this.transaction.abort();},{once:true});
   return r;
  };
 });
 await page.goto('/');const s=initialState();s.player.x=930;s.player.y=1220;
 s.defense=prepareEastRaid(s.defense,s.player);s.defense.guards[0].hp=1;
 s.defense.raid!.members[0].x=2018;s.defense.raid!.members[0].y=977;
 await page.evaluate(()=>(window as any).__abortDefenseSave=true);
 await fixture(page,s);
 await expect(page.locator('#toast')).toContainText('驻防变化尚未保存',{timeout:20000});
 const failed=await read(page);expect(failed.mode).toBe('pause');expect(failed.state.defense.guards[0].dead).toBe(true);
 expect(failed.defense.critical).toBe(true);await page.waitForTimeout(400);
 expect((await read(page)).state.defense).toEqual(failed.state.defense);
 const stored=await page.evaluate(async()=>{
  const d=await new Promise<IDBDatabase>((ok,no)=>{const r=indexedDB.open('farwind-save',1);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});
  const v=await new Promise<any>((ok,no)=>{const r=d.transaction('states').objectStore('states').get('current');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});d.close();return v;
 });
 expect(stored.defense.guards[0]).toMatchObject({hp:1,dead:false});
 await page.screenshot({path:`${root}/death-save-aborted.png`});
 await page.evaluate(()=>(window as any).__abortDefenseSave=false);
 await page.getByRole('button',{name:'保存旅途',exact:true}).click();await expect(page.locator('#toast')).toContainText('已保存');
 await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();
 const restored=await read(page);expect(restored.state.defense.guards[0]).toMatchObject({hp:0,dead:true,mode:'dead'});
 await writeFile(`${root}/death-save-recovery.json`,JSON.stringify({说明:'仅故障注入IDB事务中止；死亡由正式怪物接触产生，未修改运行中的单位。',失败时:failed.state.defense,上一份有效档:stored.defense,恢复:restored.state.defense},null,2));
});
test("玩家真实攻击来袭怪并在村门内实际受击，不污染固定主线结算",async({page})=>{
 await mkdir(root,{recursive:true});await page.goto('/');const s=initialState();s.player.x=2050;s.player.y=1080;
 // 合法历史夹具仅建立驻防已阵亡与城门内来袭前提。
 s.defense=prepareEastRaid(s.defense,{x:930,y:1220});
 for(const g of s.defense.guards)Object.assign(g,{hp:0,dead:true,mode:'dead'});
 s.defense.raid!.members.forEach((m,i)=>Object.assign(m,i?{hp:0}:{x:2105,y:1080,cooldownMs:1800}));
 await fixture(page,s);await page.keyboard.down('d');await page.waitForTimeout(30);await page.keyboard.up('d');
 const before=(await read(page)).state;await page.keyboard.press('j');
 await expect.poll(async()=>(await read(page)).state.defense.raid.members[0].hp).toBe(30);
 await expect.poll(async()=>(await read(page)).state.player.hp,{timeout:15000}).toBe(90);
 const hurt=await read(page);expect(regionAt(hurt.state.player).id).toBe('village');
 if(!process.env.FARWIND_PRODUCTION)expect(hurt.contacts.some((c:any)=>c.id.startsWith('east-raid-1:1:')&&c.result==='hurt')).toBe(true);
 expect([hurt.state.quest,hurt.state.killed,hurt.state.bag,hurt.state.coins]).toEqual([before.quest,before.killed,before.bag,before.coins]);
 await page.screenshot({path:`${root}/player-raid-contact.png`});
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'保存旅途',exact:true}).click();
 await expect(page.locator('#toast')).toContainText('已保存');await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();
 const restored=await read(page);expect(restored.state.defense.guards.every((g:any)=>g.dead)).toBe(true);
 expect(restored.state.defense.raid.members[0].hp).toBe(30);
 await writeFile(`${root}/player-raid-contact.json`,JSON.stringify({说明:'正式J攻击与怪物接触造成伤害，门内没有按横坐标无敌；历史存档只建立前提。',受击:hurt.state,接触:hurt.contacts,重载:restored.state.defense},null,2));
});
test("保留新剑风与弹反入口，真实第四刀和K可命中动态来袭怪",async({page})=>{
 test.skip(!!process.env.FARWIND_PRODUCTION,"调试轨迹仅在冻结开发源码回归，生产版保持不暴露诊断。");
 await mkdir(root,{recursive:true});await page.goto('/');const s=initialState();s.player.x=2050;s.player.y=1080;
 s.skills.swordWindStage=1;s.skills.legacySwordWind=true;s.killed=['slime-1','slime-2','leaf-1','leaf-2'];
 s.defense=prepareEastRaid(s.defense,{x:930,y:1220});for(const g of s.defense.guards)Object.assign(g,{hp:0,dead:true,mode:'dead'});
 s.defense.raid!.members.forEach((m,i)=>Object.assign(m,i?{hp:0}:{x:2440,y:1080}));
 await fixture(page,s);await page.keyboard.down('d');
 await page.waitForFunction(()=>(window as any).__farwind().animation.hero.direction===3);await page.keyboard.up('d');
 await page.keyboard.press('j');await page.waitForFunction(()=>(window as any).__farwind().session.combat.stage===1);
 await page.keyboard.press('j');await page.waitForFunction(()=>(window as any).__farwind().session.combat.stage===2);
 await page.keyboard.press('j');await page.waitForFunction(()=>(window as any).__farwind().session.combat.stage===3);
 await page.waitForFunction(()=>{const s=(window as any).__farwind();return s.session.combat.stage===3&&s.session.attackUntil-s.session.sim<140;},{},{polling:5});await page.keyboard.press('j');
 await expect.poll(async()=>(await read(page)).state.defense.raid.members[0].hp).toBe(12);
 const wind=await read(page);expect(wind.swordWind.events.some((e:any)=>e.target==='east-raid-1:1'&&e.damage===36)).toBe(true);
 expect(wind.state.killed).toEqual(s.killed);expect(wind.state.quest).toBe(s.quest);await page.screenshot({path:`${root}/wind-raid-contact.png`});
 await page.keyboard.press('Escape');const parry=structuredClone(s);parry.defense.raid!.members[0].x=2105;parry.defense.raid!.members[0].cooldownMs=1000;
 await fixture(page,parry);await page.keyboard.down('d');
 await page.waitForFunction(()=>(window as any).__farwind().animation.hero.direction===3);await page.keyboard.up('d');
 // A类工程验证依据只读预期接触提交真实K；画面识别验收另行记录。
 await page.waitForFunction(()=>{const s=(window as any).__farwind();return s.warnings.some((w:any)=>w.id.startsWith('east-raid-1:1:')&&w.lead<180&&w.lead>110);},{},{polling:5});
 await page.keyboard.press('k');await expect.poll(async()=>(await read(page)).contacts.at(-1)?.result).toMatch(/normal|perfect/);
 const end=await read(page);expect(end.state.player.hp).toBe(100);expect(end.state.killed).toEqual(s.killed);
 await writeFile(`${root}/wind-parry-raid.json`,JSON.stringify({说明:'合法历史夹具建立站位和已学习技能，正式键盘四连与K由运行时命中；A类依据诊断输入，不作为画面易读性验收。',剑风:wind.swordWind,弹反:end.contacts},null,2));
});
test("生产构建恢复活跃演练并自主结算，查询开关不暴露开发按钮",async({page})=>{
 test.skip(!process.env.FARWIND_PRODUCTION,'单独在冻结生产预览运行');
 await mkdir(root,{recursive:true});await page.goto('/?defenseDebug=1');const s=initialState();s.player.x=1960;s.player.y=1230;
 s.defense=prepareEastRaid(s.defense,s.player);await fixture(page,s);
 await expect.poll(async()=>(await read(page)).target).toBe('east-gate-sign');await page.keyboard.press('e');
 await expect(page.getByRole('heading',{name:'东门驻防',exact:true})).toBeVisible();
 await expect(page.locator('#defense-drill')).toHaveCount(0);await page.getByRole('button',{name:'继续 · E',exact:true}).click();
 await expect.poll(async()=>(await read(page)).mode).toBe('');
 await expect.poll(async()=>(await read(page)).state.defense.raid,{timeout:45000}).toBeNull();
 await expect.poll(async()=>{const r=await read(page);return !r.defense.critical&&!r.defenseCheckpointPending;}).toBe(true);
 await page.screenshot({path:`${root}/production-autonomous.png`});await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();
 const r=await read(page);expect(r.state.defense.completedSequence).toBe(1);expect(r.state.defense.guards.every((g:any)=>!g.dead)).toBe(true);
 expect([r.state.schema_version,r.state.map_version]).toEqual([7,6]);
 await writeFile(`${root}/production.json`,JSON.stringify({说明:'冻结生产构建从正式导入恢复演练，正常版不提供开发启动入口。',驻防:r.state.defense},null,2));
});
