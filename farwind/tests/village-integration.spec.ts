import {test,expect,chromium,type Page} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {initialState,validate} from '../src/game/systems/state';
const root=process.env.FARWIND_EVIDENCE_ROOT??'docs/village-defense/m5/browser';
const read=(p:Page)=>p.evaluate(()=>(window as any).__farwind());
async function pause(p:Page){await p.keyboard.press('Escape');await p.waitForFunction(()=>(window as any).__farwind().mode==='pause');}
async function resume(p:Page){await p.keyboard.press('Escape');await p.waitForFunction(()=>(window as any).__farwind().mode==='');}
async function fixture(page:Page,s:unknown){validate(s);page.once('dialog',d=>d.accept());await page.waitForFunction(()=>typeof (window as any).__farwind==='function');const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入存档',exact:true}).click();await(await chooser).setFiles({name:'integration-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(s))});await page.waitForFunction(()=>(window as any).__farwind().mode==='');}
for(const [i,id]of ['east-watch','north-watch','south-watch'].entries())test(`${id}真实致死后关闭浏览器，活跃事件恢复与多次结算幂等`,async()=>{
 const cases=JSON.parse(await readFile('.parry-local/m5/fixtures.json','utf8'));const profile=resolve(`.parry-local/m5/profiles/${id}-${Date.now()}`),errors:string[]=[];
 const open=async()=>{const c=await chromium.launchPersistentContext(profile,{viewport:{width:1280,height:720},args:['--enable-gpu','--use-gl=angle','--use-angle=metal','--ignore-gpu-blocklist']});const p=c.pages()[0];p.on('pageerror',e=>errors.push(e.message));await p.goto(process.env.FARWIND_URL??'http://127.0.0.1:5204/');return{c,p};};
 await mkdir(root,{recursive:true});let {c,p}=await open();
 try{
  await fixture(p,cases.deaths[i]);await expect.poll(async()=>(await read(p)).state.defense.guards.find((g:any)=>g.id===id).dead,{timeout:25000}).toBe(true);
  await pause(p);await p.getByRole('button',{name:'保存旅途',exact:true}).click();await expect(p.locator('#toast')).toContainText('已保存');const committed=await read(p);
  expect(committed.defense.history.filter((h:any)=>h.kind==='death'&&h.id===id)).toHaveLength(1);await p.screenshot({path:`${root}/${id}-committed.png`});await c.close();
  await new Promise(r=>setTimeout(r,1200));({c,p}=await open());await p.getByRole('button',{name:'继续旅途',exact:true}).click();await pause(p);const restored=await read(p);
  expect(restored.state.defense.guards.find((g:any)=>g.id===id)).toMatchObject({hp:0,dead:true,mode:'dead'});expect(restored.defense.arrows).toEqual([]);expect(restored.state.defense.sequence).toBe(1);
  if(committed.state.defense.raid)expect(restored.state.defense.raid.ageMs-committed.state.defense.raid.ageMs).toBeLessThan(120);else expect(restored.state.defense.raid).toBeNull();
  await resume(p);await expect.poll(async()=>(await read(p)).state.defense.raid,{timeout:130000}).toBeNull();
  await pause(p);await p.getByRole('button',{name:'保存旅途',exact:true}).click();await expect(p.locator('#toast')).toContainText('已保存');const end=await read(p);
  expect(end.state.defense.completedSequence).toBe(1);expect(end.state.defense.guards.find((g:any)=>g.id===id).dead).toBe(true);
  for(let n=0;n<3;n++){await p.reload();await p.getByRole('button',{name:'继续旅途',exact:true}).click();await pause(p);const d=await read(p);expect(d.state.defense.completedSequence).toBe(1);expect(d.state.defense.raid).toBeNull();expect(d.state.defense.guards.find((g:any)=>g.id===id).hp).toBe(0);expect([d.state.quest,d.state.killed,d.state.coins,d.state.bag]).toEqual([cases.deaths[i].quest,cases.deaths[i].killed,cases.deaths[i].coins,cases.deaths[i].bag]);}
  await writeFile(`${root}/${id}-reopen.json`,JSON.stringify({说明:'正式怪物AI致死，明确保存完成后关闭持久浏览器，再重新打开同一测试profile；未写运行战斗状态。',已提交:committed.state.defense,重开:restored.state.defense,结算:end.state.defense,页面错误:errors},null,2));expect(errors).toEqual([]);
 }catch(error){await writeFile(`${root}/${id}-failure.json`,JSON.stringify({说明:'首因与只读现场保留，不修改运行状态。',首因:String(error),状态:await read(p)},null,2));throw error;}finally{await c.close();}
});
test('结构1旧地图从正式导入迁移，保存及重开不重复坐标迁移',async({page})=>{
 await mkdir(root,{recursive:true});await page.goto('/');const old:any=initialState();old.schema_version=1;old.skills={swordWind:false};delete old.map_version;for(const k of ['coins','equipment','shopStock','economyRevision','defense','skills'])delete old[k];old.player.x=1700;old.player.y=1180;old.killed=['slime-1','slime-2','leaf-1','leaf-2'];old.bag[0]={id:'herb',count:7};await fixture(page,old);
 await pause(page);const first=await read(page);expect([first.state.schema_version,first.state.map_version]).toEqual([7,6]);expect(first.state.player.x).toBe(2300);expect(first.state.bag[0]).toEqual({id:'herb',count:7});
 await page.getByRole('button',{name:'保存旅途',exact:true}).click();await expect(page.locator('#toast')).toContainText('已保存');
 for(let n=0;n<3;n++){await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await pause(page);const d=await read(page);expect(d.state.player).toEqual(first.state.player);expect(d.state.bag).toEqual(first.state.bag);expect(d.state.coins).toBe(120);expect(d.state.defense.guards).toHaveLength(9);}
 await page.screenshot({path:`${root}/legacy-repeated.png`});await writeFile(`${root}/legacy-repeated.json`,JSON.stringify({说明:'真实旧结构字段与旧地图坐标，正式导入／保存／页面重开验证仅迁移一次；服务成交另有生产用例。',首次迁移:first.state,重复重开:(await read(page)).state},null,2));
});
