import {test,expect,type Page} from '@playwright/test';
import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
import {initialState} from '../src/game/systems/state';
import {captureGameAudio} from '../tools/capture-game-audio.mjs';
const dir=process.env.FARWIND_PARRY_EVIDENCE_ROOT??'docs/parry-v2/evidence',raw=process.env.FARWIND_PARRY_RAW_ROOT??'.parry-local/v2/recording';
test.use({video:{mode:'on',size:{width:1280,height:720}}});
const read=(p:Page)=>p.evaluate(()=>(window as any).__farwind());
async function setup(page:Page,indicators=true,mode='慢速教学 · 900毫秒'){
 await page.addInitScript(captureGameAudio);page.on('dialog',d=>d.accept());await page.goto('/');const s=initialState();s.quest=3;s.player.x=850;s.player.y=720;
 const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入存档',exact:true}).click();await(await chooser).setFiles({name:'visual-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(s))});
 await page.waitForFunction(()=>(window as any).__farwind?.().mode==='');await page.keyboard.press('w');await page.waitForTimeout(40);
 await page.getByRole('button',{name:'迎风架剑练习',exact:true}).click();await page.locator('#parry-indicators').setChecked(indicators);await page.getByRole('button',{name:mode,exact:true}).click();
 await page.evaluate(()=>{(window as any).__v2VisualFrames=[];const loop=()=>{const s=(window as any).__farwind();(window as any).__v2VisualFrames.push({时间:s.session.sim,墙钟:performance.now(),动作:s.animation.hero,战斗:s.session.combat,来招:s.parryTraining.pose,接触:s.contacts});(window as any).__v2Sampler=requestAnimationFrame(loop)};loop()});
}
async function visualCue(page:Page,kind:'normal'|'perfect'|'motion',name:string){
 const observations:any[]=[];let compressed=false,chosen:Buffer|null=null;
 // 按键只由截图像素触发，不读取contactAt、预测时间或内部攻击阶段。
 for(let i=0;i<200;i++){
  const png=await page.screenshot({clip:{x:580,y:330,width:130,height:160}}),{data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});let normal=0,perfect=0,top=720,bottom=0;
  for(let y=0;y<160;y++)for(let x=0;x<130;x++){
   const k=(y*info.width+x)*4,r=data[k],g=data[k+1],b=data[k+2];if(y<100&&r>155&&r<225&&g>225&&b>200&&g-r>20)normal++;if(y<100&&r>245&&g>232&&b>184&&r-b>20)perfect++;
   if(y>60&&r<160&&g>130&&b>130&&b>r*1.3){top=Math.min(top,y);bottom=Math.max(bottom,y);}
  }
  const height=Math.max(0,bottom-top);observations.push({截图序号:i,墙钟:performance.now(),普通提示像素:normal,精准菱形像素:perfect,怪物轮廓高度:height});
  if(kind==='motion'&&height>0&&height<30)compressed=true;
  if(kind==='normal'&&normal>12||kind==='perfect'&&perfect>12||kind==='motion'&&compressed&&height>40){chosen=png;await page.keyboard.press('k');break;}
 }
 await writeFile(`${dir}/${name}-cue.json`,JSON.stringify({说明:'按键只依据截图颜色、形状或怪物从压低到蹬起的轮廓变化；诊断仅事后记录',观察:observations},null,2));expect(chosen,'画面应提供可识别的起按线索').not.toBeNull();await writeFile(`${dir}/${name}-cue.png`,chosen!);
}
async function finish(page:Page,name:string){
 const snapshot=await read(page),frames=await page.evaluate(()=>{cancelAnimationFrame((window as any).__v2Sampler);return (window as any).__v2VisualFrames});
 await writeFile(`${dir}/${name}-summary.json`,JSON.stringify({说明:'正常速度、真实键鼠；只导入合法起始夹具。按键依据画面，内部信息仅事后取证；失败保留，不自动重试',接触:snapshot.contacts,木桩:snapshot.training,当前战斗:snapshot.session.combat},null,2));await mkdir(`${raw}/traces`,{recursive:true});await writeFile(`${raw}/traces/${name}.json`,JSON.stringify(frames));
 const audio=await page.evaluate(()=>(window as any).__finishAudio());await writeFile(`${raw}/${name}-audio.webm`,Buffer.from(audio.base64,'base64'));await writeFile(`${dir}/${name}-media.json`,JSON.stringify({说明:'旁路录制实际游戏音轨，正常速度',音频偏移秒:audio.offset},null,2));const video=page.video();await page.close();await video!.saveAs(`${raw}/${name}-video.webm`);
}
test.afterEach(async({page},info)=>{if(info.status!==info.expectedStatus&&!page.isClosed()){await mkdir('.parry-local/v2/visual-failures',{recursive:true});await writeFile(`.parry-local/v2/visual-failures/${info.title}-${Date.now()}.json`,JSON.stringify({说明:'失败首因只读快照',状态:await read(page)},null,2));}});
test('V2-VISUAL-01-auto-only',async({page})=>{
 await setup(page);await visualCue(page,'normal','visual-normal');await expect.poll(async()=>(await read(page)).contacts.at(-1)?.result).toBe('normal');
 await expect.poll(async()=>(await read(page)).training.damage).toBe(24);await page.waitForFunction(()=>{const s=(window as any).__farwind();return s.session.combat.stage===0&&!s.session.combat.autoCounter});expect((await read(page)).training.stages).toEqual([1]);
 await page.waitForTimeout(260);await expect(page.locator('#parry-status')).not.toContainText('J 接');await expect(page.locator('#parry-feedback')).not.toContainText('J');
 await page.screenshot({path:`${dir}/visual-auto-only.png`});await finish(page,'visual-auto-only');
});
test('V2-VISUAL-02-perfect-combo',async({page})=>{
 await setup(page);await visualCue(page,'perfect','visual-perfect');await expect(page.locator('#parry-status')).toContainText('成功');await page.keyboard.press('j');
 await expect.poll(async()=>(await read(page)).contacts.at(-1)?.result).toBe('perfect');await expect(page.locator('#parry-status')).toContainText('第3刀');await page.keyboard.press('j');await expect.poll(async()=>(await read(page)).training.damage).toBe(80);
 const frames=await page.evaluate(()=>(window as any).__v2VisualFrames);expect(frames.some((f:any)=>f.战斗.buffered&&f.战斗.hitStopRemaining>0)).toBe(true);expect(frames.some((f:any)=>f.动作.phase==='active'&&f.动作.key.startsWith('hero/counter'))).toBe(true);await finish(page,'visual-perfect-combo');
});
test('V2-VISUAL-03-motion-muted',async({page})=>{
 await setup(page,false,'史莱姆节奏 · 450毫秒');await page.keyboard.press('Escape');await page.getByRole('button',{name:'设置',exact:true}).click();await page.locator('#volume').press('Home');await page.getByRole('button',{name:'返回',exact:true}).click();await page.keyboard.press('Escape');
 await visualCue(page,'motion','visual-motion');await expect.poll(async()=>(await read(page)).contacts.at(-1)?.result).toMatch(/normal|perfect/);await expect.poll(async()=>(await read(page)).training.lastStage).toBe(1);await finish(page,'visual-motion-muted');
});
test('V2-VISUAL-04-dash-cancel',async({page})=>{
 await setup(page);await visualCue(page,'normal','visual-cancel');await expect(page.locator('#parry-status')).toContainText('成功');await page.keyboard.press('l');await page.waitForFunction(()=>(window as any).__farwind().session.combat.dashRemaining>0);
 const s=await read(page);expect(s.session.combat.autoCounter).toBeNull();expect(s.training.damage).toBe(0);await page.waitForFunction(()=>(window as any).__farwind().session.combat.dashRemaining===0);expect((await read(page)).session.combat.attackInstanceId).toBeNull();await finish(page,'visual-dash-cancel');
});
