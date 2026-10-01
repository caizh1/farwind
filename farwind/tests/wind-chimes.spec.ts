import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {WIND_LESSONS,LESSON_IDS} from '../src/data/windLessons';
import {initialState,type State} from '../src/game/systems/state';
import {completeWindLesson} from '../src/game/systems/skills';
import {move} from './skill-navigation';
const dir='docs/wind-chimes/evidence', read=(page:Page)=>page.evaluate(()=>(window as any).__farwind());
function fixture(stage:number,point:{x:number;y:number}){
 let s=initialState();Object.assign(s.player,point);
 for(let i=0;i<stage;i++){
  if(i===1)s.skills.devices.serialValve=1;if(i===2)s.skills.devices.leakClosed=true;
  if(i===4){s.skills.devices.splitLeft=1;s.skills.devices.splitRight=2;}
  s=completeWindLesson(s,LESSON_IDS[i]);
 }
 return s;
}
async function start(page:Page,s:State){
 page.on('dialog',d=>d.accept());await page.goto('/');
 await page.waitForFunction(()=>typeof (window as any).__farwind==='function');
 const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入存档',exact:true}).click();
 await (await chooser).setFiles({name:'wind-chime-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(s))});
 await page.waitForFunction(()=>(window as any).__farwind().mode==='');
 await mkdir(dir,{recursive:true});
}
async function close(page:Page){if((await read(page)).mode==='dialog')await page.getByRole('button',{name:'继续 · E',exact:true}).click();}
// 农庄实际操作：新素材、摆动、前后响应、暂停以及重开恢复。
test('CHIME-01-farm-animation-save',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const l=WIND_LESSONS[1];await start(page,fixture(1,l.stand));
 const bells=() => read(page).then(s=>s.skillGrowth.targets.filter((t:any)=>t.id.startsWith('lesson-serial-bell-')));
 const before=await bells();expect(before.map((t:any)=>t.powered)).toEqual([false,false]);
 expect(before.every((t:any)=>t.animation.材质==='wind-chime-bell')).toBe(true);
 await page.waitForTimeout(550);const idle=await bells();
 expect(idle[0].animation.铃体角度).not.toBe(before[0].animation.铃体角度);
 expect(idle[0].animation.木架).toEqual(before[0].animation.木架);
 await page.screenshot({path:dir+'/farm-before.png'});
 await page.keyboard.press('e');await expect(page.locator('.dialog-copy')).toContainText('藤蔓缠住了第一枚铃');
 await page.getByRole('button',{name:'解开缠住铃绳的藤蔓',exact:true}).click();
 await expect.poll(async()=>(await read(page)).state.skills.swordWindStage).toBe(2);await close(page);
 await expect.poll(async()=>(await bells()).every((t:any)=>t.powered&&t.animation.鸣响时间>=0)).toBe(true);
 const after=await bells();expect(after[1].animation.鸣响时间).toBeGreaterThan(after[0].animation.鸣响时间);
 await page.screenshot({path:dir+'/farm-after.png'});
 await page.keyboard.press('Escape');const paused=await bells();await page.waitForTimeout(400);expect(await bells()).toEqual(paused);
 await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();
 await page.waitForFunction(()=>(window as any).__farwind().mode==='');
 expect((await read(page)).state.skills.swordWindStage).toBe(2);expect((await bells()).every((t:any)=>t.powered)).toBe(true);
 expect(errors).toEqual([]);await writeFile(dir+'/farm.json',JSON.stringify({说明:'合法阶段一固定存档，经真实键鼠解除藤蔓。检查悬挂层摆动、固定木架、两铃依次鸣响、暂停与重开；不冒充新游戏自然探索。',操作前:before,操作后:after,页面异常:errors},null,2));
});
// 北部真实清障，以及遗迹风帆直接靠近按 E，均从固定样本进入正式游戏。
test('CHIME-02-north-ruins-interactions',async({page})=>{
 const north=WIND_LESSONS[2];await start(page,fixture(2,north.stand));
 await page.keyboard.press('e');await page.getByRole('button',{name:'清走挡风的落枝',exact:true}).click();
 await expect.poll(async()=>(await read(page)).state.skills.swordWindStage).toBe(3);await close(page);
 const northState=await read(page);expect(northState.skillGrowth.targets.filter((t:any)=>t.id.startsWith('lesson-through-')).map((t:any)=>t.powered)).toEqual([true,true,true,false]);
 await page.screenshot({path:dir+'/north-path.png'});
 // 通过标题的正常导入入口切换另一个合法边界样本。
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'保存并返回标题',exact:true}).click();
 const split=WIND_LESSONS[4],chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入存档',exact:true}).click();
 await (await chooser).setFiles({name:'wind-sail-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture(4,split.stand)))});
 await page.waitForFunction(()=>(window as any).__farwind().mode==='');
 await page.screenshot({path:dir+'/ruins-before.png'});
 await move(page,split.stand.x-70,split.stand.y);await page.keyboard.press('e');
 await expect.poll(async()=>(await read(page)).state.skills.devices.splitLeft).toBe(1);
 expect((await read(page)).state.skills.swordWindStage).toBe(4);await close(page);
 await move(page,split.stand.x+70,split.stand.y);await page.keyboard.press('e');
 await expect.poll(async()=>(await read(page)).state.skills.swordWindStage).toBe(5);await close(page);
 await page.screenshot({path:dir+'/ruins-after.png'});
 const final=await read(page);expect(final.skillGrowth.targets.filter((t:any)=>t.id.startsWith('lesson-three-')).every((t:any)=>t.powered)).toBe(true);
 await writeFile(dir+'/world-interactions.json',JSON.stringify({说明:'北部清障与遗迹两侧风帆通过真实 E 键完成；固定起始存档不代表自然新游戏。',北部:northState.skillGrowth,最终:final.state.skills},null,2));
});
