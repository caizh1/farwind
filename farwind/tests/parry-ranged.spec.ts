import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {initialState} from '../src/game/systems/state';
import {enemyDefs} from '../src/data/world';
import {captureGameAudio} from '../tools/capture-game-audio.mjs';
const dir='docs/parry-ranged',raw='.parry-local/ranged/recording';
const read=(page:Page)=>page.evaluate(()=>(window as any).__farwind());
async function start(page:Page,name:string,y=820,wild=false){
 await mkdir(`${dir}/fixtures`,{recursive:true});await mkdir(raw,{recursive:true});await page.addInitScript(captureGameAudio);page.on('dialog',d=>d.accept());
 await page.goto('/?feedback=D');const s=initialState();s.quest=3;s.killed=enemyDefs.filter(e=>!wild||e.id!=='spore-1').map(e=>e.id);s.player.x=wild?2650:850;s.player.y=wild?2020:y;
 await writeFile(`${dir}/fixtures/${name}.json`,JSON.stringify(s,null,2));
 const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入存档',exact:true}).click();await(await chooser).setFiles({name:`${name}.json`,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(s))});
 await page.waitForFunction(()=>(window as any).__farwind().mode==='');
 await page.evaluate(()=>{const w=window as any;w.__rangedFrames=[];const loop=()=>{const s=w.__farwind();w.__rangedFrames.push({时间:s.session.sim,墙钟:performance.now(),战斗:s.session.combat,动作:s.animation.hero,剑气:s.swordWind,反馈:s.feedback,接触:s.contacts,生命:s.state.player.hp,练习:s.parryTraining,敌人:s.enemies,输入:s.inputs});if(w.__rangedFrames.length>600)w.__rangedFrames.shift();w.__rangedSampler=requestAnimationFrame(loop)};loop()});
 const enemy=enemyDefs.find(e=>e.id==='spore-1')!,dx=enemy.x-s.player.x,dy=enemy.y-s.player.y;const key=wild?(Math.abs(dx)>Math.abs(dy)?dx<0?'a':'d':dy<0?'w':'s'):'w';
 await page.keyboard.down(key);await page.waitForTimeout(18);await page.keyboard.up(key);
 if(!wild){await page.getByRole('button',{name:'迎风架剑练习',exact:true}).click();await page.getByRole('button',{name:'灰冠孢卫 · 孢子喷射',exact:true}).click();}
}
async function parry(page:Page,quality:'normal'|'perfect',mouse=false){
 // A类集成检查：依据只读预测安排真实按键，不能作为玩家看懂提示器的证据。
 await page.waitForFunction(q=>{const s=(window as any).__farwind();return s.warnings.some((w:any)=>w.lead>(q==='normal'?110:15)&&w.lead<(q==='normal'?175:65));},quality,{polling:5});
 if(mouse)await page.mouse.click(620,450,{button:'right'});else await page.keyboard.press('k');
 await page.waitForFunction(q=>(window as any).__farwind().contacts.at(-1)?.result===q,quality,{polling:5});
}
async function finish(page:Page,name:string){
 const s=await read(page),frames=await page.evaluate(()=>{cancelAnimationFrame((window as any).__rangedSampler);return (window as any).__rangedFrames});
 await writeFile(`${raw}/${name}-frames.json`,JSON.stringify(frames));
 await writeFile(`${dir}/${name}.json`,JSON.stringify({说明:'A类自动化集成：合法起始夹具、真实键鼠、只读观察；未修改运行中生命、位置、计时器，未强制成功。',最终状态:s,接触结果:[...new Map(frames.flatMap((f:any)=>f.接触).map((c:any)=>[c.id,c])).values()],剑气事件:[...new Map(frames.flatMap((f:any)=>f.剑气.events).map((e:any)=>[`${e.id}:${e.at}`,e])).values()],反馈事件:[...new Map(frames.flatMap((f:any)=>f.反馈.events).map((e:any)=>[e.id,e])).values()],呈现帧数:frames.length,关键帧:frames.filter((f:any)=>f.战斗.hitStopRemaining>0||f.剑气.entities.length).map((f:any)=>({时间:f.时间,战斗:f.战斗,动作:f.动作,剑气:f.剑气,闪光:f.反馈.visual,生命:f.生命})).slice(0,40)},null,2));
 const audio=await page.evaluate(()=>(window as any).__finishAudio());await writeFile(`${raw}/${name}-audio.webm`,Buffer.from(audio.base64,'base64'));
 await writeFile(`${dir}/${name}-media.json`,JSON.stringify({说明:'正常比例、正常速度，旁路采集实际游戏AudioContext输出；未后期补音。',音频开始墙钟秒:audio.startedEpoch,页面相对偏移秒:audio.offset,采集启动音频时刻:audio.contextStart,启动回调延迟毫秒:audio.startNotificationDelay},null,2));
 const video=page.video()!;await page.close();await video.saveAs(`${raw}/${name}-video.webm`);
}
test.afterEach(async({page},info)=>{if(info.status!==info.expectedStatus&&!page.isClosed()){await mkdir(raw,{recursive:true});await writeFile(`${raw}/${info.title}-failure.json`,JSON.stringify({说明:'首次失败现场，不自动重试。',状态:await read(page),帧:await page.evaluate(()=>(window as any).__rangedFrames)},null,2));await page.screenshot({path:`${dir}/${info.title}-failure.png`});}});
test('RANGED-normal-training-auto-wave-without-J',async({page})=>{
 await start(page,'normal-training');await parry(page,'normal');await page.screenshot({path:`${dir}/normal-contact.png`});
 await page.waitForFunction(()=>(window as any).__farwind().session.combat.delivery==='wind'&&(window as any).__farwind().session.combat.phase==='active',undefined,{polling:5});await page.screenshot({path:`${dir}/normal-release.png`});
 await page.waitForFunction(()=>(window as any).__farwind().swordWind.events.some((e:any)=>e.target==='practice-training-dummy'),undefined,{polling:5});
 await page.waitForTimeout(420);const s=await read(page),frames=await page.evaluate(()=>(window as any).__rangedFrames);
 expect(s.state.player.hp).toBe(100);expect(s.state.skills.swordWindStage).toBe(0);expect(s.swordWind.effective).toBe(false);expect(s.training.damage).toBe(24);expect(s.training.stages).toEqual([1]);
 expect(s.feedback.events.filter((e:any)=>e.kind==='counter-start')).toHaveLength(1);expect(s.feedback.events.filter((e:any)=>e.kind==='counter-hit')).toHaveLength(1);
 const contact=s.contacts.find((e:any)=>e.result==='normal'),hit=s.swordWind.events.find((e:any)=>e.target==='practice-training-dummy'),launch=frames.flatMap((f:any)=>f.剑气.entities).find((w:any)=>w.attack.delivery==='wind');
 expect(launch.born-contact.at).toBeCloseTo(115,4);expect(hit.at).toBeGreaterThan(launch.born);
 expect(frames.some((f:any)=>f.反馈.visual.bladeGlow?.alpha>.5&&f.战斗.delivery==='wind')).toBe(true);
 const first=frames.find((f:any)=>f.接触.some((c:any)=>c.result==='normal'));expect(first.动作.phase).toBe('brace');expect(first.反馈.visual.flashes.length).toBeGreaterThan(0);
 const effect=s.feedback.events.find((e:any)=>e.kind==='counter-hit');expect(effect.point.y).toBeLessThan(720);await finish(page,'normal-training');
});
test('RANGED-perfect-mouse-buffer-second-third',async({page})=>{
 await start(page,'perfect-combo',720);await parry(page,'perfect',true);await page.keyboard.press('j');
 await page.waitForFunction(()=>(window as any).__farwind().session.combat.stage===2,undefined,{polling:5});await page.keyboard.press('j');
 await expect.poll(async()=>(await read(page)).training.damage).toBe(80);const s=await read(page),frames=await page.evaluate(()=>(window as any).__rangedFrames);
 expect(s.training.stages).toEqual([1,2,3]);expect(s.feedback.events.filter((e:any)=>e.kind==='counter-start')).toHaveLength(1);expect(s.feedback.events.filter((e:any)=>e.kind==='counter-hit')).toHaveLength(1);
 expect(s.swordWind.events.filter((e:any)=>e.target)).toHaveLength(1);expect(s.swordWind.events.find((e:any)=>e.target).damage).toBe(30);
 expect(frames.some((f:any)=>f.战斗.buffered&&f.战斗.hitStopRemaining>0)).toBe(true);await page.screenshot({path:`${dir}/perfect-combo.png`});await finish(page,'perfect-combo');
});
test('RANGED-before-release-dash-cancel',async({page})=>{
 await start(page,'dash-cancel');await parry(page,'normal');await page.keyboard.press('l');await page.waitForTimeout(600);const s=await read(page);
 expect(s.swordWind.events).toEqual([]);expect(s.feedback.events.filter((e:any)=>e.kind==='counter-hit')).toEqual([]);expect(s.training.damage).toBe(0);expect(s.session.combat.autoCounter).toBeNull();await finish(page,'dash-cancel');
});
test('RANGED-wild-spore-delayed-real-hit-and-session-clear',async({page})=>{
 await start(page,'wild-spore',0,true);await parry(page,'normal');
 const contact=await read(page);expect(contact.enemies.find((e:any)=>e.id==='spore-1').hp).toBe(60);expect(contact.enemies.find((e:any)=>e.id==='spore-1').staggerRemaining).toBe(0);
 await page.waitForFunction(()=>(window as any).__farwind().enemies.find((e:any)=>e.id==='spore-1').hp===36,undefined,{polling:5});await page.screenshot({path:`${dir}/wild-hit.png`});
 const s=await read(page);expect(s.swordWind.events.filter((e:any)=>e.target==='spore-1')).toHaveLength(1);expect(s.feedback.events.find((e:any)=>e.kind==='counter-hit').point.y).toBeLessThan(s.state.player.y-50);
 await page.keyboard.press('Escape');const sim=(await read(page)).session.sim;await page.waitForTimeout(140);expect((await read(page)).session.sim).toBe(sim);
 await page.getByRole('button',{name:'保存并返回标题',exact:true}).click();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');
 expect((await read(page)).swordWind.entities).toEqual([]);expect((await read(page)).session.combat.autoCounter).toBeNull();await finish(page,'wild-spore');
});
