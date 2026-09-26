import {test,expect,type Page} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
import {initialState} from '../src/game/systems/state';
import {captureGameAudio} from '../tools/capture-game-audio.mjs';
test.use({headless:false,video:{mode:'on',size:{width:1280,height:720}}});
const dir=process.env.FARWIND_PARRY_NATIVE?'docs/parry/evidence/native':'docs/parry/evidence',raw=process.env.FARWIND_PARRY_NATIVE?'.parry-local/native-recording':'.parry-local',read=(page:Page)=>page.evaluate(()=>(window as any).__farwind());
async function loadFixture(page:Page,x=850,y=720,stamina=100,hp=100,killed:string[]=[]) {
 await mkdir(dir,{recursive:true});const state=initialState();Object.assign(state.player,{x,y,stamina,hp});state.quest=3;state.killed=killed;
 await mkdir(`${dir}/fixtures`,{recursive:true});await writeFile(`${dir}/fixtures/${x===850?'training':x===1640?'field':x===2380?'adventure':'two-enemies'}.json`,JSON.stringify(state,null,2));
 page.on('dialog',d=>d.accept());await page.goto('/');await page.waitForFunction(()=>typeof (window as any).__farwind==='function');
 const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入存档',exact:true}).click();await(await chooser).setFiles({name:'parry-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(state))});
 await page.waitForFunction(()=>(window as any).__farwind().mode==='');
}
async function face(page:Page,key:string,d:number) {
 await page.keyboard.down(key);await page.waitForFunction(d=>(window as any).__farwind().animation.hero.direction===d,d);await page.keyboard.up(key);
}
async function mode(page:Page,name:string) {
 await page.getByRole('button',{name:'迎风架剑练习',exact:true}).click();await page.getByRole('button',{name,exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');
}
async function coming(page:Page,lead:number) {
 await page.waitForFunction(lead=>{const s=(window as any).__farwind(),a=s.parryTraining.attack;return a&&!a.emitted&&a.contactAt-s.session.sim<=lead&&a.contactAt-s.session.sim>0;},lead,{polling:5});
 return page.evaluate(()=>(window as any).__farwind().parryTraining.attack.attackId);
}
async function outcome(page:Page,id:string) {
 await page.waitForFunction(id=>(window as any).__farwind().contacts.some((e:any)=>e.id===id),id,{polling:5});return (await read(page)).contacts.find((e:any)=>e.id===id);
}
async function sample(page:Page) {
 await page.evaluate(()=>{(window as any).__parrySamples=[];const loop=()=>{const s=(window as any).__farwind?.();if(s)(window as any).__parrySamples.push({时间:s.session.sim,墙钟:performance.now(),生命:s.state.player.hp,体力:s.state.player.stamina,动作:s.animation.hero,战斗:s.session.combat,接触:s.contacts,练习:s.parryTraining});(window as any).__parrySampler=requestAnimationFrame(loop);};loop();});
}
async function saveEvidence(page:Page,name:string) {
 const samples=await page.evaluate(()=>{cancelAnimationFrame((window as any).__parrySampler);return (window as any).__parrySamples;});
 await writeFile(`${dir}/${name}-summary.json`,JSON.stringify({说明:'真实键鼠输入；仅导入合法起始存档，诊断只读；未改运行中生命、位置、计时器或判定',帧数:samples?.length??0,接触:(await read(page)).contacts,最终练习:(await read(page)).parryTraining},null,2));
 await mkdir(`${raw}/traces`,{recursive:true});await writeFile(`${raw}/traces/${name}.json`,JSON.stringify(samples));
 const audio=await page.evaluate(()=>(window as any).__finishAudio?.());if(audio){await writeFile(`${raw}/${name}-audio.webm`,Buffer.from(audio.base64,'base64'));await writeFile(`${dir}/${name}-media.json`,JSON.stringify({说明:'旁路录制真实游戏音轨，视频正常速度',音频偏移秒:audio.offset},null,2));}
 const video=page.video();await page.close();await video?.saveAs(`${raw}/${name}-video.webm`);
}
test.afterEach(async({page},info)=>{if(info.status!==info.expectedStatus&&!page.isClosed()){await mkdir('.parry-local/failures',{recursive:true});const snapshot=await page.evaluate(()=>(window as any).__farwind?.());const samples=await page.evaluate(()=>(window as any).__parrySamples);await writeFile(`.parry-local/failures/${info.title}-${Date.now()}.json`,JSON.stringify({说明:'失败时只读首因快照',snapshot,samples}));}});
// 四方向动作、普通攻击取消、长按、暂停／失焦和界面右键边界。
 test('PARRY-03',async({page})=>{
 await loadFixture(page,1640,620);await sample(page);
 for(const [key,d,label] of [['s',0,'down'],['w',1,'up'],['a',2,'left'],['d',3,'right']] as const){await face(page,key,d);await page.keyboard.press('k');await page.waitForFunction(d=>(window as any).__farwind().session.combat.parry?.facing===d,d);await page.screenshot({path:`${dir}/guard-${label}.png`});await page.waitForFunction(()=>(window as any).__farwind().session.combat.parryCooldownRemaining===0);}
 await page.keyboard.press('j');await page.waitForFunction(()=>(window as any).__farwind().session.combat.stage===1);await page.keyboard.press('k');await page.waitForFunction(()=>(window as any).__farwind().session.combat.parry!==null);expect((await read(page)).session.combat.stage).toBe(0);
 await page.waitForFunction(()=>(window as any).__farwind().session.combat.parryCooldownRemaining===0);const serial=(await read(page)).session.combat.parrySerial;await page.keyboard.down('k');await page.waitForTimeout(900);await page.keyboard.up('k');expect((await read(page)).session.combat.parrySerial).toBe(serial+1);
 await page.keyboard.press('Escape');const paused=await read(page);await page.keyboard.press('j');await page.keyboard.press('k');await page.keyboard.press('l');await page.waitForTimeout(180);expect((await read(page)).session.sim).toBe(paused.session.sim);await page.keyboard.press('Escape');await page.waitForTimeout(180);expect((await read(page)).session.combat.stage).toBe(0);expect((await read(page)).session.combat.parry).toBeNull();expect((await read(page)).session.combat.dashRemaining).toBe(0);
 // Playwright默认持续模拟焦点；恢复浏览器原生焦点行为，再实际切换标签。
 const nativeFocus=await page.context().newCDPSession(page);await nativeFocus.send('Emulation.setFocusEmulationEnabled',{enabled:false});
 const popup=await page.context().newPage();await popup.goto('about:blank');await popup.bringToFront();await page.waitForTimeout(100);await page.bringToFront();await expect(page.getByText('世界与时间已暂停。')).toBeVisible();await nativeFocus.send('Emulation.setFocusEmulationEnabled',{enabled:true});await page.keyboard.press('Escape');await popup.close();await page.keyboard.press('k');await page.waitForFunction(()=>(window as any).__farwind().session.combat.parry!==null);
 // 仅监听菜单是否被画布阻止，不阻止其他界面的菜单事件。
 await page.evaluate(()=>{(window as any).__menus=[];document.addEventListener('contextmenu',e=>(window as any).__menus.push({画布:e.target instanceof HTMLCanvasElement,已阻止:e.defaultPrevented}));});
 await page.mouse.click(650,400,{button:'right'});await page.keyboard.press('Escape');await page.getByText('世界与时间已暂停。').click({button:'right'});const menus=await page.evaluate(()=>(window as any).__menus);expect(menus).toContainEqual({画布:true,已阻止:true});expect(menus).toContainEqual({画布:false,已阻止:false});
 await page.getByRole('button',{name:'保存并返回标题'}).click();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');expect((await read(page)).session.combat.counter).toBeNull();expect((await read(page)).session.combat.parry).toBeNull();await saveEvidence(page,'input-directions');
});
