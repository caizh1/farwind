import {test,expect,type Page} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
import {initialState} from '../src/game/systems/state';
import {captureGameAudio} from '../tools/capture-game-audio.mjs';
test.use({video:{mode:'on',size:{width:1280,height:720}}});
const dir=process.env.FARWIND_PARRY_NATIVE?'docs/parry/evidence/native':'docs/parry/evidence',raw=process.env.FARWIND_PARRY_NATIVE?'.parry-local/native-recording':'.parry-local',read=(page:Page)=>page.evaluate(()=>(window as any).__farwind());
async function loadFixture(page:Page,x=850,y=720,stamina=100,hp=100,killed:string[]=[]) {
 await mkdir(dir,{recursive:true});const state=initialState();Object.assign(state.player,{x,y,stamina,hp});state.quest=3;state.killed=killed;
 await mkdir(`${dir}/fixtures`,{recursive:true});await writeFile(`${dir}/fixtures/${x===850?'training':x===1640?'field':x===2380?'adventure':'two-enemies'}.json`,JSON.stringify(state,null,2));
 page.on('dialog',d=>d.accept());await page.goto('/?animationDebug=1');await page.waitForFunction(()=>typeof (window as any).__farwind==='function');
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
async function outcome(page:Page,id:string,attack=false) {
 await page.waitForFunction(id=>(window as any).__farwind().contacts.some((e:any)=>e.id===id),id,{polling:5});if(attack)await page.keyboard.press('j');return (await read(page)).contacts.find((e:any)=>e.id===id);
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
test.afterEach(async({page},info)=>{if(info.status!==info.expectedStatus&&!page.isClosed()){await mkdir('.parry-local/failures',{recursive:true});const snapshot=await page.evaluate(()=>(window as any).__farwind?.());const samples=await page.evaluate(()=>(window as any).__parrySamples);await writeFile(`.parry-local/failures/${info.title}.json`,JSON.stringify({说明:'失败时只读首因快照',snapshot,samples}));}});
// 普通／精准由正式接触结果断言，不强制成功；停顿中只按真实J。
test('PARRY-01',async({page})=>{
 await page.addInitScript(captureGameAudio);await loadFixture(page);await face(page,'w',1);await mode(page,'慢速教学 · 900毫秒');await sample(page);
 const before=(await read(page)).state;
 let id=await coming(page,145);await page.keyboard.press('k');let result=await outcome(page,id,true);expect(result.result).toBe('normal');expect(result.parryAge).toBeGreaterThanOrEqual(70);expect(result.parryAge).toBeLessThan(180);
 await page.screenshot({path:`${dir}/normal.png`});
 // 观察成功停顿内提交下一刀，后续操作仍由键盘驱动。
 await page.waitForFunction(()=>(window as any).__farwind().session.combat.counterAttack==='normal');await page.keyboard.press('j');await page.waitForFunction(()=>(window as any).__farwind().session.combat.stage===2);await page.keyboard.press('j');
 await expect.poll(async()=>(await read(page)).training.damage).toBe(74);await expect(page.locator('#training-stats')).toContainText('累计74');await page.waitForFunction(()=>(window as any).__farwind().session.combat.stage===0);
 await page.keyboard.down('s');await page.waitForFunction(()=>(window as any).__farwind().state.player.y>=720);await page.keyboard.up('s');await face(page,'w',1);
 id=await coming(page,65);await page.mouse.click(650,390,{button:'right'});result=await outcome(page,id,true);expect(result.result).toBe('perfect');expect(result.parryAge).toBeLessThan(70);await page.screenshot({path:`${dir}/perfect.png`});
 await page.waitForFunction(()=>(window as any).__farwind().session.combat.counterAttack==='perfect');await page.keyboard.press('j');await page.waitForFunction(()=>(window as any).__farwind().session.combat.stage===2);await page.keyboard.press('j');
 await expect.poll(async()=>(await read(page)).training.damage).toBe(80);await page.waitForFunction(()=>(window as any).__farwind().session.combat.stage===0);
 const after=(await read(page)).state;for(const key of ['bag','killed','pendingDrops','quest','side','stones'])expect(after[key]).toEqual(before[key]);expect(after.player.hp).toBe(before.player.hp);
 const samples=await page.evaluate(()=>(window as any).__parrySamples);
 expect(samples.some((s:any)=>s.动作.phase==='brace'&&s.战斗.hitStopRemaining>0)).toBe(true);
 expect(samples.some((s:any)=>s.战斗.parry?.successAt!==undefined&&s.战斗.buffered&&s.战斗.hitStopRemaining>0)).toBe(true);
 await saveEvidence(page,'success-combo');
});
// 早、晚和背向失败均有真实接触；空弹只写空弹，不追认成按晚。
test('PARRY-02',async({page})=>{
 await page.addInitScript(captureGameAudio);await loadFixture(page);await face(page,'w',1);await mode(page,'史莱姆节奏 · 450毫秒');await sample(page);
 let id=await coming(page,330);await page.keyboard.press('k');expect((await outcome(page,id)).result).toBe('hurt');await expect(page.locator('#parry-feedback')).toContainText('按早');await page.screenshot({path:`${dir}/early.png`});
 id=await coming(page,200);await outcome(page,id);await page.keyboard.press('k');await expect(page.locator('#parry-feedback')).toContainText('按晚');await page.screenshot({path:`${dir}/late.png`});
 await face(page,'s',0);id=await coming(page,45);await page.keyboard.press('k');expect((await outcome(page,id)).result).toBe('hurt');await expect(page.locator('#parry-feedback')).toContainText('朝向错误');await page.screenshot({path:`${dir}/back-failure.png`});
 await mode(page,'结束弹反练习');const start=(await read(page)).state.player;await page.keyboard.press('k');await page.waitForFunction(()=>(window as any).__farwind().session.combat.parry!==null);await page.waitForFunction(()=>(window as any).__farwind().session.combat.parry===null);await page.keyboard.down('d');await page.keyboard.press('l');await page.waitForFunction(()=>(window as any).__farwind().session.combat.dashRemaining>0);await page.keyboard.up('d');await page.waitForFunction(()=>(window as any).__farwind().session.combat.dashRemaining===0);expect((await read(page)).state.player.x).toBeGreaterThan(start.x+60);
 expect((await read(page)).state.player.hp).toBe(100);await saveEvidence(page,'failure-rescue');
});
// 正式森林敌人生命、攻击伤害与追击强度均不改，只导入合法起始站位。
test('PARRY-04',async({page})=>{
 await page.addInitScript(captureGameAudio);await loadFixture(page,2380,1060,100,100,['slime-2','leaf-1','leaf-2']);await face(page,'d',3);await sample(page);
 await page.waitForFunction(()=>{const s=(window as any).__farwind(),e=s.enemies.find((e:any)=>e.id==='slime-1');return e.attack&&!e.attack.emitted&&e.attack.contactAt-s.session.sim<125&&e.attack.contactAt-s.session.sim>60;},{},{polling:5});
 const id=(await read(page)).enemies.find((e:any)=>e.id==='slime-1').attack.attackId;await page.keyboard.press('k');const hit=await outcome(page,id);expect(hit.result).toBe('normal');expect((await read(page)).state.player.hp).toBe(100);const stagger=(await read(page)).enemies.find((e:any)=>e.id==='slime-1').staggerRemaining;expect(stagger).toBeGreaterThan(350);
 await page.screenshot({path:`${dir}/adventure-normal.png`});await page.keyboard.press('j');await expect.poll(async()=>(await read(page)).enemies.find((e:any)=>e.id==='slime-1').hp).toBe(24);const after=await read(page),enemy=after.enemies.find((e:any)=>e.id==='slime-1');expect(enemy.staggerUntil).toBe(hit.at+420);expect(enemy.staggerUntil-after.session.sim).toBeGreaterThan(0);await saveEvidence(page,'adventure');
});
// 两个正式史莱姆从原出生点靠近，夹具只给合法站位；不移动或削弱敌人。
test('PARRY-05',async({page})=>{
 await page.addInitScript(captureGameAudio);await loadFixture(page,2672,1000,100,100,['leaf-1','leaf-2']);await face(page,'s',0);await sample(page);
 await page.waitForFunction(()=>{const s=(window as any).__farwind(),es=s.enemies.filter((e:any)=>e.id.startsWith('slime'));return es.every((e:any)=>e.attack&&!e.attack.emitted)&&Math.max(...es.map((e:any)=>e.attack.contactAt))-Math.min(...es.map((e:any)=>e.attack.contactAt))<80&&Math.min(...es.map((e:any)=>e.attack.contactAt))-s.session.sim<=130;},null,{polling:5,timeout:12000});
 await page.keyboard.press('k');await page.waitForFunction(()=>(window as any).__farwind().contacts.filter((e:any)=>e.result==='normal'||e.result==='perfect'||e.result==='afterguard').length===2);
 const s=await read(page),contacts=s.contacts.filter((e:any)=>e.result==='normal'||e.result==='perfect'||e.result==='afterguard');expect(contacts.filter((e:any)=>e.result==='afterguard')).toHaveLength(1);expect(contacts[1].at-contacts[0].at).toBeLessThan(80);expect(s.state.player.hp).toBe(100);expect(s.state.player.stamina).toBe(100);expect(s.session.combat.counter.until).toBe(contacts[0].at+600);await page.screenshot({path:`${dir}/two-enemies.png`});await saveEvidence(page,'two-enemies');
});
// 叶灵节奏与轻击收手链，由练习菜单主动选入。
test('PARRY-06',async({page})=>{
 await loadFixture(page);await face(page,'w',1);await mode(page,'叶灵节奏 · 650毫秒');await sample(page);let id=await coming(page,130);await page.keyboard.press('k');expect((await outcome(page,id)).result).toBe('normal');
 await mode(page,'轻击收手 → 弹反 → 三连');await page.waitForFunction(()=>{const s=(window as any).__farwind();return s.session.sim>=s.parryTraining.next;});await page.keyboard.press('j');id=await coming(page,130);await page.keyboard.press('k');expect((await outcome(page,id)).result).toBe('normal');await page.keyboard.press('j');await page.waitForFunction(()=>(window as any).__farwind().session.combat.counterAttack==='normal');await page.keyboard.press('j');await page.waitForFunction(()=>(window as any).__farwind().session.combat.stage===2);await page.keyboard.press('j');await expect.poll(async()=>(await read(page)).training.damage).toBe(74);expect((await read(page)).state.player.hp).toBe(100);await saveEvidence(page,'training-modes');
});
