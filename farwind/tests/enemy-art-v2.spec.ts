import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {move} from './skill-navigation';
const dir='docs/enemy-art-v2/evidence',read=(page:Page)=>page.evaluate(()=>(window as any).__farwind());
async function start(page:Page){
 await page.goto('/');await page.getByRole('button',{name:'启程 · 新游戏',exact:true}).click({timeout:15000});
 const confirm=page.getByRole('button',{name:'确认新游戏',exact:true});if(await confirm.isVisible())await confirm.click();
 await page.waitForFunction(()=>(window as any).__farwind?.().mode==='');
}
async function observe(page:Page){
 await page.evaluate(()=>{const w=window as any;w.__artV2Frames=[];let last='';
  const frame=()=>{const s=w.__farwind(),enemies=s.animation.enemies.filter((e:any)=>['leaf','spore'].includes(e.type)),key=JSON.stringify(enemies.map((e:any)=>[e.id,e.hp,e.art?.pose?.frame,e.art?.pose?.action]));
   if(key!==last){last=key;w.__artV2Frames.push({时间:s.session.sim,玩家生命:s.state.player.hp,怪物:enemies});if(w.__artV2Frames.length>3000)w.__artV2Frames.shift();}w.__artV2Observer=requestAnimationFrame(frame);};frame();
 });
}
test.beforeAll(async()=>mkdir(dir,{recursive:true}));
test.afterEach(async({page},info)=>{
 if(info.status!==info.expectedStatus){await writeFile(`${dir}/${info.title}-first-cause-${Date.now()}.json`,JSON.stringify({说明:'保留首次失败现场，不修改游戏状态',世界:await read(page).catch(()=>null),预览:await page.evaluate(()=>(window as any).__enemyPreview?.()).catch(()=>null)},null,2));await page.screenshot({path:`${dir}/${info.title}-failure-${Date.now()}.png`});}
});
test('fixed-directions-actions',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/enemy-preview.html');await page.waitForFunction(()=>(window as any).__enemyPreview);
 await page.getByRole('button',{name:'暂停',exact:true}).click();const observations=[];
 for(const kind of ['leaf','spore'])for(const direction of ['0','1','2','3'])for(const action of ['idle','walk','attack','hurt','parry','perfect','death']){
  await page.locator('#enemy').selectOption(kind);await page.locator('#direction').selectOption(direction);await page.locator('#action').selectOption(action);
  for(const key of ['Home','End']){await page.locator('#scrub').press(key);const s=await page.evaluate(()=>(window as any).__enemyPreview());observations.push(s);expect(s.pose.action).toBe(action);expect(s.pose.facing).toBe(Number(direction));expect(s.pose.frame).toBeLessThan(144);}
 }
 for(const kind of ['leaf','spore']){await page.locator('#enemy').selectOption(kind);await page.locator('#direction').selectOption('0');await page.locator('#action').selectOption('idle');await page.locator('#scrub').press('Home');await page.screenshot({path:`${dir}/fixed-${kind}-actual-size.png`,fullPage:true});}
 expect(errors).toEqual([]);await writeFile(`${dir}/fixed-validation.json`,JSON.stringify({说明:'通过可见控件检查两种怪物、四方向、七动作的首尾姿态；这不是森林实战验收',观察:observations,错误:errors},null,2));
});
for(const kind of ['leaf','spore'] as const)test(`forest-${kind}`,async({page})=>{
 const id=kind+'-1',errors:string[]=[],responses:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/enemies-v2/'))responses.push(`${r.status()} ${r.url()}`);});
 await start(page);await observe(page);
 if(kind==='leaf'){await move(page,2550,1000);await move(page,2840,1070);}else{await move(page,2550,1640);await move(page,2650,2020);}
 await page.waitForFunction(id=>(window as any).__farwind().animation.enemies.some((e:any)=>e.id===id&&e.art?.pose?.action==='attack'),id,{timeout:15000});
 await page.screenshot({path:`${dir}/forest-${kind}-attack.png`});
 for(let i=0;i<65;i++){
  const s=await read(page),enemy=s.enemies.find((e:any)=>e.id===id);if(!enemy||enemy.hp<=0)break;
  expect(s.state.player.hp,'正常行走与战斗过程中主角仍存活').toBeGreaterThan(0);
  const dx=enemy.x-s.state.player.x,dy=enemy.y-s.state.player.y,distance=Math.hypot(dx,dy),key=Math.abs(dx)>Math.abs(dy)?dx<0?'a':'d':dy<0?'w':'s';
  await page.keyboard.down(key);await page.waitForTimeout(distance>75?Math.min(180,Math.max(25,(distance-70)/150*1000)):12);await page.keyboard.up(key);await page.keyboard.press('j');await page.waitForTimeout(155);
 }
 await page.waitForFunction(id=>(window as any).__farwind().state.killed.includes(id),id,{timeout:8000});await page.screenshot({path:`${dir}/forest-${kind}-death.png`});
 const frames=await page.evaluate(()=>{const w=window as any;cancelAnimationFrame(w.__artV2Observer);return w.__artV2Frames;}),actions=new Set(frames.flatMap((f:any)=>f.怪物.filter((e:any)=>e.id===id).map((e:any)=>e.art?.pose?.action)));
 for(const action of ['walk','attack','hurt','death'])expect(actions.has(action),`森林实际动作 ${action}`).toBe(true);
 const before=await read(page);expect(before.state.killed.filter((v:string)=>v===id)).toHaveLength(1);expect(errors).toEqual([]);expect(responses.filter(v=>v.startsWith('200 '))).toHaveLength(2);
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'保存并返回标题',exact:true}).click();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');
 expect((await read(page)).enemies.some((e:any)=>e.id===id)).toBe(false);
 const databases=await page.evaluate(async()=>(await indexedDB.databases()).map(d=>d.name));expect(databases).toContain('farwind-enemy-art-v2-review');expect(databases).not.toContain('farwind-save');expect(databases).not.toContain('farwind-first-map');
 await writeFile(`${dir}/forest-${kind}-validation.json`,JSON.stringify({说明:'当前工作树，正式新游戏入口，真实键盘行走和战斗；诊断只读。验收数据库独立，不注入坐标、生命、进度或计时器。',动作:[...actions],素材响应:responses,错误:errors,帧:frames,死亡后世界:before,读档后世界:await read(page)},null,2));
});
