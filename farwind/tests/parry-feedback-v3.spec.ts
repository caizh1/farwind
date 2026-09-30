import {test,expect,type Page} from '@playwright/test';
import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
import {initialState} from '../src/game/systems/state';
import {prepareEastRaid} from '../src/game/systems/defense';
import {captureGameAudio} from '../tools/capture-game-audio.mjs';
const dir=process.env.FARWIND_V3_EVIDENCE_ROOT??'docs/parry-feedback-v3/evidence',raw=process.env.FARWIND_V3_RAW_ROOT??'.parry-local/v3/recording';
const read=(page:Page)=>page.evaluate(()=>(window as any).__farwind());
const installed=new WeakSet<Page>();
// 原33个弹反声音保留；新增护甲反斩3个、五类命中各四种材质三变体60个，固定总数96。
const expectedFeedbackBuffers=96;
test.use({video:{mode:'on',size:{width:1280,height:720}}});
async function fixture(page:Page,s=initialState(),mode='D') {
 await mkdir(`${dir}/fixtures`,{recursive:true});await mkdir(raw,{recursive:true});
 if(!installed.has(page)){await page.addInitScript(captureGameAudio);page.on('dialog',d=>d.accept());installed.add(page);}await page.goto(`/?feedback=${mode}`);
 const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入存档',exact:true}).click();await(await chooser).setFiles({name:'feedback-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(s))});
 await page.waitForFunction(()=>(window as any).__farwind().mode==='');
 await page.evaluate(()=>{(window as any).__v3Frames=[];const loop=()=>{const s=(window as any).__farwind();const frames=(window as any).__v3Frames;frames.push({时间:s.session.sim,墙钟:performance.now(),动作:s.animation.hero,战斗:s.session.combat,接触:s.contacts,反馈:s.feedback,生命:s.state.player.hp,练习:s.parryTraining});if(frames.length>1800)frames.shift();(window as any).__v3Sampler=requestAnimationFrame(loop)};loop()});
}
async function face(page:Page,key:string,d:number){await page.keyboard.down(key);await page.waitForFunction(d=>(window as any).__farwind().animation.hero.direction===d,d);await page.keyboard.up(key);}
async function practice(page:Page,name='慢速教学 · 900毫秒',indicators=true){await page.getByRole('button',{name:'迎风架剑练习',exact:true}).click();await page.locator('#parry-indicators').setChecked(indicators);await page.getByRole('button',{name,exact:true}).click();}
async function setup(page:Page,mode='D',name='慢速教学 · 900毫秒'){const s=initialState();s.quest=3;s.player.x=850;s.player.y=720;await fixture(page,s,mode);await face(page,'w',1);await practice(page,name);}
async function visualCue(page:Page,quality:'normal'|'perfect',name:string) {
 const observations:any[]=[];let chosen:Buffer|null=null;
 // B类：按键仅依据正常比例截图，不用内部预测或接触时间决定起按。
 for(let i=0;i<180;i++){
  const png=await page.screenshot({clip:{x:580,y:330,width:130,height:160}}),{data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});let normal=0,perfect=0;
  for(let y=0;y<100;y++)for(let x=0;x<info.width;x++){const k=(y*info.width+x)*4,r=data[k],g=data[k+1],b=data[k+2];if(r>155&&r<225&&g>225&&b>200&&g-r>20)normal++;if(r>245&&g>232&&b>184&&r-b>20)perfect++;}
  observations.push({截图序号:i,普通提示像素:normal,精准菱形像素:perfect});
  if(quality==='normal'?normal>12:perfect>12){chosen=png;await page.keyboard.press('k');break;}
 }
 await writeFile(`${dir}/${name}-cue.json`,JSON.stringify({说明:'B类画面触发，诊断仅用于事后记录，不重试失败',观察:observations},null,2));expect(chosen,'正常比例画面应提供起按线索').not.toBeNull();await writeFile(`${dir}/${name}-cue.png`,chosen!);
}
async function predicted(page:Page,predicate:string,lead=145,width=50){
 // A类：只读时间用于精确集成断言，不作为动作可读性证明。
 await page.waitForFunction(({id,lead,width})=>{const s=(window as any).__farwind();return s.warnings.some((w:any)=>w.id.startsWith(id)&&w.predicted!==null&&w.lead<=lead&&w.lead>lead-width);},{id:predicate,lead,width},{polling:5,timeout:20000});await page.keyboard.press('k');
}
async function finish(page:Page,name:string){
 const s=await read(page),frames=await page.evaluate(()=>{cancelAnimationFrame((window as any).__v3Sampler);return (window as any).__v3Frames});
 await mkdir(`${raw}/traces`,{recursive:true});await mkdir(`${raw}/screens`,{recursive:true});await writeFile(`${raw}/traces/${name}.json`,JSON.stringify(frames));
 await writeFile(`${dir}/${name}.json`,JSON.stringify({说明:'真实键鼠，仅合法起始存档；没有修改运行中生命、位置、计时器。A类时间驱动与B类画面驱动按各测试说明区分。',输入:s.inputs,接触:s.contacts,反馈:s.feedback,木桩:s.training,战斗:s.session.combat,生命:s.state.player.hp,敌人:s.enemies,驻防:s.defense},null,2));
 await page.screenshot({path:`${raw}/screens/${name}.png`});const audio=await page.evaluate(()=>(window as any).__finishAudio());await writeFile(`${raw}/${name}-audio.webm`,Buffer.from(audio.base64,'base64'));await writeFile(`${dir}/${name}-media.json`,JSON.stringify({说明:'旁路采集实际AudioContext输出，未后期补音，正常速度',页面相对偏移秒:audio.offset,音频开始墙钟秒:audio.startedEpoch,采集启动音频时刻:audio.contextStart,启动回调延迟毫秒:audio.startNotificationDelay},null,2));const video=page.video();await page.close();await video!.saveAs(`${raw}/${name}-video.webm`);
}
test.afterEach(async({page},info)=>{if(info.status!==info.expectedStatus&&!page.isClosed()){await mkdir('.parry-local/v3/failures',{recursive:true});await writeFile(`.parry-local/v3/failures/${info.title}-${Date.now()}.json`,JSON.stringify({说明:'失败首因快照，失败不重试；独立音频接口没有游戏世界，接口观察另存audio-context.json',状态:await page.evaluate(()=>typeof (window as any).__farwind==='function'?(window as any).__farwind():null),帧:await page.evaluate(()=>(window as any).__v3Frames)},null,2));}});
for(const mode of ['A','B','C','D'])test(`V3-AB-${mode}-normal`,async({page})=>{
 await setup(page,mode);await visualCue(page,'normal',`ab-${mode}`);await page.waitForFunction(()=>(window as any).__farwind().contacts.at(-1)?.result==='normal',undefined,{polling:5});await page.keyboard.press('j');
 await page.waitForFunction(()=>(window as any).__farwind().session.combat.stage===2,undefined,{polling:5});await page.keyboard.press('j');await expect.poll(async()=>(await read(page)).training.damage).toBe(74);
 const s=await read(page);expect(s.training.stages).toEqual([1,2,3]);const events=s.feedback.events;
 expect(events.filter((e:any)=>e.kind==='parry-contact')).toHaveLength(1);expect(events.filter((e:any)=>e.kind==='counter-start')).toHaveLength(1);expect(events.filter((e:any)=>e.kind==='counter-swing')).toHaveLength(1);expect(events.filter((e:any)=>e.kind==='counter-hit')).toHaveLength(1);
 const frames=await page.evaluate(()=>(window as any).__v3Frames),first=frames.find((f:any)=>f.反馈.events.some((e:any)=>e.kind==='parry-contact'));
 expect(first.动作.phase).toBe('brace');expect(first.战斗.hitStopRemaining).toBeGreaterThan(0);expect(first.反馈.effects.some((e:any)=>e.kind==='parry-contact')).toBe(true);expect(first.反馈.effects.find((e:any)=>e.kind==='parry-contact').depth).toBeGreaterThan(first.动作.root[1]);
 if(mode==='C'||mode==='D'){const flash=first.反馈.visual.flashes.find((e:any)=>e.id===events.find((e:any)=>e.kind==='parry-contact').id);expect(flash.core).toBeGreaterThanOrEqual(5);expect(flash.edge).toBe(14);expect(frames.some((f:any)=>f.反馈.visual.bladeGlow?.alpha>.5)).toBe(true);}
 if(mode==='B'||mode==='D'){const audio=s.feedback.audio.events;for(const kind of ['parry-contact','deflect-release','counter-swing','counter-hit'])expect(audio.filter((e:any)=>e.kind===kind)).toHaveLength(1);expect(new Set(audio.map((e:any)=>e.id)).size).toBe(audio.length);expect(s.feedback.audio.cached).toBe(expectedFeedbackBuffers);expect(audio.filter((e:any)=>e.kind==='enemy-strike')).toHaveLength(0);}
 expect(s.state.player.hp).toBe(100);await finish(page,`ab-${mode}`);
});
test('V3-VISUAL-perfect-hit-combo',async({page})=>{
 await setup(page);await visualCue(page,'perfect','perfect');await page.waitForFunction(()=>(window as any).__farwind().contacts.at(-1)?.result==='perfect',undefined,{polling:5});await page.keyboard.press('j');await page.waitForFunction(()=>(window as any).__farwind().session.combat.stage===2,undefined,{polling:5});await page.keyboard.press('j');await expect.poll(async()=>(await read(page)).training.damage).toBe(80);
 const frames=await page.evaluate(()=>(window as any).__v3Frames);expect(frames.some((f:any)=>f.战斗.buffered&&f.战斗.hitStopRemaining>0)).toBe(true);expect(frames.filter((f:any)=>f.动作.key.startsWith('hero/counter')&&f.动作.phase==='active').map((f:any)=>f.动作.frame).filter((v:any,i:number,a:any[])=>a.indexOf(v)===i).length).toBeGreaterThanOrEqual(3);
 expect((await read(page)).feedback.events.filter((e:any)=>e.kind==='parry-perfect-contact')).toHaveLength(1);await finish(page,'perfect-combo');
});
test('V3-VISUAL-cancel-no-false-hit',async({page})=>{
 await setup(page);await visualCue(page,'normal','cancel');await page.waitForFunction(()=>(window as any).__farwind().contacts.at(-1)?.result==='normal',undefined,{polling:5});await page.keyboard.press('l');await page.waitForFunction(()=>(window as any).__farwind().session.combat.dashRemaining>0,undefined,{polling:5});await page.waitForTimeout(350);
 const s=await read(page);expect(s.training.damage).toBe(0);expect(s.feedback.events.filter((e:any)=>e.kind.startsWith('counter'))).toHaveLength(0);expect(s.feedback.audio.events.filter((e:any)=>e.kind==='counter-hit')).toHaveLength(0);await finish(page,'cancel');
});
test('V3-RED-four-directions-live-blade',async({page})=>{
 const rows:any[]=[];
 for(const [x,y,key,d,label] of [[850,720,'w',1,'up'],[850,580,'s',0,'down'],[920,650,'a',2,'left'],[780,650,'d',3,'right']] as const){
  const s=initialState();s.quest=3;Object.assign(s.player,{x,y});await fixture(page,s);await face(page,key,d);await practice(page);await predicted(page,'practice-',145);
  await page.waitForFunction(()=>{const s=(window as any).__farwind();return s.feedback.visual.bladeGlow?.alpha>.7&&s.animation.hero.key.startsWith('hero/counter');},undefined,{polling:5});
  const png=await page.screenshot(),{data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});await writeFile(`${dir}/red-blade-${label}.png`,png);
  let red=0;for(let y=400;y<580;y++)for(let x=565;x<730;x++){const k=(y*info.width+x)*4,r=data[k],g=data[k+1],b=data[k+2];if(r>180&&g<130&&b<130&&r-g>70)red++;}expect(red,`${label}正常比例画面有剑刃红光`).toBeGreaterThan(4);
  await expect.poll(async()=>(await read(page)).training.damage).toBe(24);await page.waitForTimeout(220);
  const frames=await page.evaluate(()=>(window as any).__v3Frames),glows=frames.filter((f:any)=>f.反馈.visual.bladeGlow);
  expect(glows.length).toBeGreaterThan(2);for(const f of glows){const w=f.动作.weapon,g=f.反馈.visual.bladeGlow;expect(g.tip.x).toBeCloseTo(f.动作.root[0]+w.tip.x,6);expect(g.tip.y).toBeCloseTo(f.动作.root[1]+w.tip.y,6);expect(g.depth).toBe(f.动作.root[1]+(f.动作.direction===1?-.05:.08));}
  expect((await read(page)).feedback.visual.bladeGlow).toBeNull();rows.push({方向:label,红色像素:red,呈现帧:glows,接触:(await read(page)).contacts});
 }
 await writeFile(`${dir}/red-blade-four-directions.json`,JSON.stringify({说明:'真实键盘与合法起始存档，A类只读预测决定起按，不作为动作可读性验收；每帧核对实际武器端点、前后层、正常比例红色像素及自然消退。',结果:rows},null,2));await finish(page,'red-blade-four-directions');
});
test('V3-INTEGRATION-wild-slime',async({page})=>{
 const s=initialState();s.quest=3;Object.assign(s.player,{x:2380,y:1060});s.killed=['slime-2','leaf-1','leaf-2'];await fixture(page,s);await face(page,'d',3);await predicted(page,'slime-1:');await expect.poll(async()=>(await read(page)).contacts.at(-1)?.result).toBe('normal');
 await expect.poll(async()=>(await read(page)).enemies.find((e:any)=>e.id==='slime-1').hp).toBe(24);const r=await read(page),event=r.feedback.events.find((e:any)=>e.kind==='parry-contact'),enemy=r.enemies.find((e:any)=>e.id==='slime-1');expect(enemy.staggerUntil).toBe(event.at+600);expect(r.feedback.events.filter((e:any)=>e.kind==='counter-hit')).toHaveLength(1);expect(r.state.player.hp).toBe(100);await finish(page,'wild-slime');
});
test('V3-AUDIO-unparried-strike-still-audible',async({page})=>{
 const s=initialState();s.quest=3;Object.assign(s.player,{x:2380,y:1060});s.killed=['slime-2','leaf-1','leaf-2'];await fixture(page,s);
 await page.waitForFunction(()=>(window as any).__farwind().state.player.hp===90,undefined,{polling:5,timeout:15000});const r=await read(page);
 expect(r.feedback.audio.events.some((e:any)=>e.kind==='enemy-strike')).toBe(true);expect(r.feedback.events.some((e:any)=>e.kind==='parry-contact'||e.kind==='parry-perfect-contact')).toBe(false);await finish(page,'unparried-strike');
});
test('V3-INTEGRATION-two-enemies',async({page})=>{
 const s=initialState();s.quest=3;Object.assign(s.player,{x:2672,y:1000});s.killed=['leaf-1','leaf-2'];await fixture(page,s);expect((await read(page)).animation.hero.direction).toBe(0);
 await page.waitForFunction(()=>{const s=(window as any).__farwind();return s.warnings.length===2&&s.warnings.every((w:any)=>w.predicted!==null)&&Math.max(...s.warnings.map((w:any)=>w.predicted))-Math.min(...s.warnings.map((w:any)=>w.predicted))<60&&Math.min(...s.warnings.map((w:any)=>w.lead))<=150;},null,{polling:5,timeout:15000});await page.keyboard.press('k');
 await page.waitForFunction(()=>(window as any).__farwind().contacts.some((e:any)=>e.result==='afterguard'),undefined,{polling:5,timeout:5000});await page.waitForTimeout(360);const r=await read(page);expect(r.feedback.events.filter((e:any)=>e.kind==='parry-contact'||e.kind==='parry-perfect-contact')).toHaveLength(1);expect(r.feedback.events.filter((e:any)=>e.kind==='afterguard')).toHaveLength(1);expect(r.feedback.events.filter((e:any)=>e.kind==='counter-start')).toHaveLength(1);expect(r.feedback.audio.events.filter((e:any)=>e.kind==='afterguard')).toHaveLength(1);expect(r.state.player.hp).toBe(100);await finish(page,'two-enemies');
});
test('V3-INTEGRATION-leaf-projection',async({page})=>{
 await setup(page,'D','叶灵节奏 · 650毫秒');await predicted(page,'practice-',130);await expect.poll(async()=>(await read(page)).training.damage).toBe(24);const r=await read(page);expect(r.feedback.events.find((e:any)=>e.kind==='counter-hit').material).toBe('leaf');expect(r.state.player.hp).toBe(100);await finish(page,'leaf-projection');
});
test('V3-INTEGRATION-wild-leaf',async({page})=>{
 // 原15–65ms起按区跨进程调度后可能落到接触之后；50–85ms覆盖正常呈现步长，仍在既定精准区内，保留真实键盘与精准断言。
 const s=initialState();s.quest=3;Object.assign(s.player,{x:2855,y:1070});s.killed=['slime-1','slime-2','leaf-2'];await fixture(page,s);await face(page,'d',3);await predicted(page,'leaf-1:',85,35);await expect.poll(async()=>(await read(page)).contacts.at(-1)?.result).toBe('perfect');await expect.poll(async()=>(await read(page)).enemies.find((e:any)=>e.id==='leaf-1').hp).toBe(42);
 const r=await read(page),event=r.feedback.events.find((e:any)=>e.kind==='parry-perfect-contact');expect(r.enemies.find((e:any)=>e.id==='leaf-1').staggerUntil).toBe(event.at+800);expect(r.feedback.events.find((e:any)=>e.kind==='counter-hit').material).toBe('leaf');expect(r.state.player.hp).toBe(100);await finish(page,'wild-leaf');
});
test('V3-INTEGRATION-four-directions-muted',async({page})=>{
 const rows:any[]=[];
 for(const [x,y,key,d,label] of [[850,720,'w',1,'up'],[850,580,'s',0,'down'],[920,650,'a',2,'left'],[780,650,'d',3,'right']] as const){
  const s=initialState();s.quest=3;Object.assign(s.player,{x,y});if(!page.isClosed()&&await page.locator('canvas').count())await page.reload();await fixture(page,s);await face(page,key,d);await practice(page);await page.keyboard.press('Escape');await page.getByRole('button',{name:'设置',exact:true}).click();await page.locator('#volume').press('Home');await page.getByRole('button',{name:'返回',exact:true}).click();await page.keyboard.press('Escape');await predicted(page,'practice-',145);await expect.poll(async()=>(await read(page)).training.damage).toBe(24);
  const r=await read(page);expect(r.feedback.audio.events).toHaveLength(0);expect(r.feedback.events.filter((e:any)=>e.kind==='counter-hit')).toHaveLength(1);rows.push({方向:label,接触:r.contacts,反馈:r.feedback});await page.screenshot({path:`${dir}/counter-${label}.png`});await page.keyboard.press('Escape');
 }
 await writeFile(`${dir}/four-directions-muted.json`,JSON.stringify({说明:'A类正式键盘四方向，菜单静音，未改运行中状态；静音不改变伤害',结果:rows},null,2));
});
test('V3-INTEGRATION-death-newgame',async({page})=>{
 const s=initialState();s.quest=3;Object.assign(s.player,{x:2380,y:1060,hp:1});s.killed=['slime-2','leaf-1','leaf-2'];await fixture(page,s);await face(page,'d',3);await page.keyboard.press('k');await page.waitForFunction(()=>{const r=(window as any).__farwind();return r.state.player.hp===100&&r.state.player.x===670;},undefined,{polling:5,timeout:15000});
 let r=await read(page);expect(r.feedback.events).toHaveLength(0);expect(r.feedback.effects).toHaveLength(0);expect(r.feedback.delayed).toBe(0);expect(r.feedback.audio.voices).toBe(0);expect(r.session.combat.autoCounter).toBeNull();await page.keyboard.press('Escape');await page.getByRole('button',{name:'保存并返回标题',exact:true}).click();await page.getByRole('button',{name:'启程 · 新游戏',exact:true}).click();await page.getByRole('button',{name:'确认新游戏',exact:true}).click();r=await read(page);expect(r.feedback.events).toHaveLength(0);expect(r.feedback.audio.events).toHaveLength(0);expect(r.session.combat.autoCounter).toBeNull();await finish(page,'death-newgame');
});
test('V3-INTEGRATION-defense',async({page})=>{
 const s=initialState();Object.assign(s.player,{x:2050,y:1080});s.defense=prepareEastRaid(s.defense,{x:930,y:1220});for(const g of s.defense.guards)Object.assign(g,{hp:0,dead:true,mode:'dead'});s.defense.raid!.members.forEach((m,i)=>Object.assign(m,i?{hp:0}:{x:2105,y:1080,cooldownMs:1000}));await fixture(page,s);await face(page,'d',3);await predicted(page,'east-raid-1:1:');await expect.poll(async()=>(await read(page)).contacts.at(-1)?.result).toBe('normal');await expect.poll(async()=>(await read(page)).state.defense.raid.members[0].hp).toBe(24);
 const r=await read(page);expect(r.feedback.events.filter((e:any)=>e.kind==='counter-hit')).toHaveLength(1);expect(r.feedback.events.some((e:any)=>e.kind==='enemy-strike')).toBe(true);expect(r.state.player.hp).toBe(100);await finish(page,'defense');
});
test('V3-INTEGRATION-pause-reset',async({page,context})=>{
 await setup(page);await visualCue(page,'normal','pause');await page.waitForFunction(()=>(window as any).__farwind().contacts.at(-1)?.result==='normal',undefined,{polling:5});await page.keyboard.press('Escape');const paused=await read(page);await page.keyboard.press('j');await page.keyboard.press('k');await page.waitForTimeout(250);expect((await read(page)).session.sim).toBe(paused.session.sim);expect((await read(page)).feedback.audio.voices).toBe(0);
 const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:false});const other=await context.newPage();await other.goto('about:blank');await other.bringToFront();await page.waitForTimeout(150);await page.bringToFront();await other.close();await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:true});expect((await read(page)).mode).toBe('pause');await page.getByRole('button',{name:'保存并返回标题',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='title');let r=await read(page);expect(r.feedback.events).toHaveLength(0);expect(r.feedback.effects).toHaveLength(0);expect(r.feedback.audio.voices).toBe(0);await page.getByRole('button',{name:'继续旅途',exact:true}).click();r=await read(page);expect(r.feedback.events).toHaveLength(0);expect(r.session.combat.autoCounter).toBeNull();await finish(page,'pause-reset');
});
test('V3-AUDIO-real-context-cache-release-mute',async({page})=>{
 // 仅隔离音频接口：暂停世界仍会渲染，实测15ms回调延到304.5ms；不加载世界以观察原音频窗口。
 await page.route('**/audio-api-test.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>独立音频接口检查</title><button>开始音频接口检查</button></html>'}));
 await page.goto('/audio-api-test.html');await page.getByRole('button',{name:'开始音频接口检查',exact:true}).click();
 const result=await page.evaluate(async()=>{
  const {Sound}=await import('/src/game/systems/audio.ts' as string);const sound=new Sound();sound.start();await sound.context.resume();const base={at:1,targetId:'音频夹具',attackId:'音频攻击',point:{x:0,y:0},incoming:{x:1,y:0},blade:{x:0,y:1},deflect:{x:0,y:1},quality:'normal',material:'slime'};
  const bank=(sound as any).feedbackBuffers as Map<string,AudioBuffer>,entries=[...bank.entries()];
  const legacyKeys=['guard-start','enemy-charge','enemy-strike','parry-contact','parry-perfect-contact','deflect-release','counter-swing','counter-hit','afterguard'].flatMap(kind=>(kind==='counter-hit'?['slime','leaf','straw']:['slime']).flatMap(material=>[0,1,2].map(variant=>`${kind}:${material}:${variant}`)));
  sound.prepareFeedback();const cache={旧声键:legacyKeys,实际键:[...bank.keys()],重复预热保持引用:entries.every(([key,buffer])=>bank.get(key)===buffer)};
  // 声音诊断含事件数组引用；扩展声库发声前保存当时副本，避免改写前一阶段观察。
  const snapshot=()=>structuredClone(sound.diagnostic());
  const submittedWall=performance.now(),submittedAudio=sound.context.currentTime;
  for(const [i,kind] of ['parry-contact','enemy-strike','counter-swing','counter-hit','parry-perfect-contact'].entries())sound.feedback({...base,id:`测试${i}`,kind},'D');
  await new Promise(r=>setTimeout(r,15));const initialOverlap=snapshot(),timing={开始墙钟:submittedWall,开始音频时钟:submittedAudio,首次墙钟:performance.now(),首次音频时钟:sound.context.currentTime},duckSamples:any[]=[];let overlap=initialOverlap;
  // 墙钟15ms不保证音频线程已经处理到该点；只在原150ms音频窗口内采样，不延长压低时长。
  const duckDeadline=overlap.events.at(-1)!.scheduled+.15,wallDeadline=performance.now()+1000;
  while(sound.context.currentTime<duckDeadline&&performance.now()<wallDeadline){duckSamples.push({音频时钟:sound.context.currentTime,墙钟:performance.now(),增益:overlap.buses!.noncritical});if(overlap.buses!.noncritical<1)break;await new Promise(r=>setTimeout(r,2));overlap=snapshot();}
  await new Promise(r=>setTimeout(r,280));const released=snapshot();sound.volume=0;sound.feedback({...base,id:'静音',kind:'parry-contact'},'D');const muted=snapshot();sound.clearFeedback();const reset=snapshot();
  sound.volume=.25;let maximumVoices=0;
  for(const [i,key] of cache.实际键.entries()){const [kind,material]=key.split(':');sound.feedback({...base,id:`声库并发${i}`,attackId:`独立声库攻击${i}`,kind,material},'D');maximumVoices=Math.max(maximumVoices,sound.diagnostic().voices);}
  const bounded=snapshot();await new Promise(r=>setTimeout(r,280));const bankReleased=snapshot();sound.destroy();const destroyed=snapshot();return {timing,initialOverlap,duckSamples,overlap,released,muted,reset,cache,maximumVoices,bounded,bankReleased,destroyed};
 });
 await mkdir(dir,{recursive:true});await writeFile(`${dir}/audio-context.json`,JSON.stringify({说明:'独立真实AudioContext接口测试，不强制游戏成功；保留原33声和原发声静音检查，固定96缓存、重复预热不增长、16并发上限及销毁清理；保存原墙钟15ms采样和原150ms音频窗口内观察',结果:result},null,2));
 expect(result.overlap.cached).toBe(expectedFeedbackBuffers);expect(result.overlap.events).toHaveLength(5);expect(result.overlap.buses.threat).toBe(1);expect(result.overlap.buses.noncritical).toBeLessThan(1);expect(result.released.voices).toBe(0);expect(result.released.buses.noncritical).toBeCloseTo(1);expect(result.muted.events).toHaveLength(5);expect(result.reset.events).toHaveLength(0);
 expect(result.cache.旧声键).toHaveLength(33);expect(result.cache.实际键).toHaveLength(expectedFeedbackBuffers);for(const key of result.cache.旧声键)expect(result.cache.实际键).toContain(key);expect(result.cache.重复预热保持引用).toBe(true);
 expect(result.maximumVoices).toBeLessThanOrEqual(16);expect(result.bounded.cached).toBe(expectedFeedbackBuffers);expect(result.bankReleased.voices).toBe(0);expect(result.destroyed.voices).toBe(0);expect(result.destroyed.cached).toBe(0);
});
test('V3-AUDIO-intercepted-strike-keeps-other-threats',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'启程 · 新游戏',exact:true}).click();
 const result=await page.evaluate(async()=>{
  const {Sound}=await import('/src/game/systems/audio.ts' as string);const sound=new Sound();sound.start();await sound.context.resume();const base={at:1,targetId:'独立音频夹具',point:{x:0,y:0},incoming:{x:1,y:0},blade:{x:0,y:1},deflect:{x:0,y:1},quality:'normal',material:'slime'};
  sound.feedbackBatch([{...base,id:'同帧冲撞',attackId:'同帧来招',kind:'enemy-strike'},{...base,id:'同帧成功',attackId:'同帧来招',kind:'parry-contact'},{...base,id:'其他威胁',attackId:'其他来招',kind:'enemy-strike'}],'D');const batch=sound.diagnostic();sound.clearFeedback();
  sound.feedback({...base,id:'提前出手',attackId:'提前来招',kind:'enemy-strike'},'D');sound.feedback({...base,id:'背后威胁',attackId:'背后来招',kind:'enemy-strike'},'D');const before=sound.diagnostic();
  sound.feedback({...base,id:'截停',attackId:'提前来招',kind:'parry-perfect-contact'},'D');const stopped=sound.diagnostic();await new Promise(r=>setTimeout(r,280));const released=sound.diagnostic();sound.destroy();return {batch,before,stopped,released};
 });
 expect(result.batch.events.map((e:any)=>e.kind)).toEqual(['parry-contact','enemy-strike']);expect(result.batch.strikeVoices).toBe(1);expect(result.before.strikeVoices).toBe(2);expect(result.stopped.strikeVoices).toBe(1);expect(result.stopped.buses.threat).toBe(1);expect(result.released.voices).toBe(0);expect(result.released.strikeVoices).toBe(0);
 await mkdir(dir,{recursive:true});await writeFile(`${dir}/intercepted-strike.json`,JSON.stringify({说明:'真实AudioContext独立接口检查，不作为强制游戏成功；同帧过滤、此前子步声音截停及其他来招保留',结果:result},null,2));
});
test('V3-REGRESSION-unlocked-fourth',async({page})=>{
 const s=initialState();s.quest=3;s.skills.swordWindStage=1;s.skills.legacySwordWind=true;Object.assign(s.player,{x:850,y:720});await fixture(page,s);await face(page,'w',1);await page.keyboard.press('j');await page.waitForFunction(()=>(window as any).__farwind().session.combat.stage===1);await page.keyboard.press('j');await page.waitForFunction(()=>(window as any).__farwind().session.combat.stage===2);await page.keyboard.press('j');await page.waitForFunction(()=>{const r=(window as any).__farwind();return r.session.combat.stage===3&&r.session.attackUntil-r.session.sim<140;},undefined,{polling:5});await page.keyboard.press('j');await expect.poll(async()=>(await read(page)).training.windDamage).toBe(36);const r=await read(page);expect(r.training.stages).toEqual([1,2,3]);expect(r.swordWind.events).toContainEqual(expect.objectContaining({attackId:4,target:'training-dummy',damage:36,reason:'target'}));expect(r.state.skills.swordWindStage).toBe(1);expect(r.feedback.events.filter((e:any)=>e.kind.startsWith('counter'))).toHaveLength(0);await finish(page,'unlocked-fourth');
});
