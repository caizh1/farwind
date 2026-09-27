import {chromium} from '@playwright/test';
import sharp from 'sharp';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {startWater,readWater} from '../tests/water-navigation.ts';

// 正常HUD、默认缩放、实际5173。只裁去初始化菜单，不修改游戏图像。
const directory='docs/water-effects/pond-redesign'; await mkdir(directory,{recursive:true});
const browser=await chromium.launch({headless:false,args:['--use-angle=metal','--ignore-gpu-blocklist']});
const rows=[];
try {for(const [width,height,dpr] of [[1280,800,1],[1365,853,1.5]]) {
 const context=await browser.newContext({baseURL:process.env.FARWIND_URL??'http://127.0.0.1:5173',viewport:{width,height},deviceScaleFactor:dpr,recordVideo:{dir:'.water-local/pond-redesign-video',size:{width,height}}});
 const videoStart=Date.now(),page=await context.newPage();
 try {
 const errors=await startWater(page);await page.bringToFront();
 await page.evaluate(()=>window.__waterGame.scene.getScene('World').cameras.main.stopFollow());
 const start=Date.now(),state=await readWater(page),frames=[];
 const performance=page.evaluate(()=>new Promise(resolve=>{
  const s=window.__waterGame.scene.getScene('World'),gl=s.game.renderer.gl,e=gl.getExtension('WEBGL_debug_renderer_info');
  let p=window.performance.now(),first=p,begin=0;const frames=[],updates=[];
  const pre=()=>begin=window.performance.now(),post=()=>updates.push(window.performance.now()-begin);s.events.on('preupdate',pre);s.events.on('postupdate',post);
  const step=t=>{frames.push(t-p);p=t;if(t-first<10000)requestAnimationFrame(step);else{s.events.off('preupdate',pre);s.events.off('postupdate',post);const calc=a=>{a=a.slice(3).sort((a,b)=>a-b);return {样本:a.length,中位:a[Math.floor(a.length*.5)],百分之95:a[Math.floor(a.length*.95)]};};resolve({帧间隔毫秒:calc(frames),更新毫秒:calc(updates),对象:s.children.length,纹理:s.textures.getTextureKeys().length,渲染器:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)});}};requestAnimationFrame(step);
 }));
 // 性能计时结束后才截图，避免截图读回GPU导致修改后测量多算开销。
 const stats=await performance;
 for(let i=0;i<4;i++) {if(i)await page.waitForTimeout(2300);frames.push(await page.screenshot({path:`${directory}/after-${width}-time-${i}.png`}));}
 const factor=width/1280*dpr;
 const rect=(x,y,w,h)=>({left:Math.round((x-state.camera.x)*factor),top:Math.round((y-state.camera.y)*factor),width:Math.round(w*factor),height:Math.round(h*factor)});
 const areas={池塘上部:rect(1190,1015,150,70),池塘中心:rect(1240,1090,110,42),池塘下部:rect(1200,1230,140,40),固定岸内水带:rect(1532,1110,4,20),不透明桥板:rect(1045,940,75,20)};
 const differences=[];
 for(let i=1;i<frames.length;i++) {const row={};for(const [name,area]of Object.entries(areas)){const a=await sharp(frames[i-1]).extract(area).removeAlpha().raw().toBuffer(),b=await sharp(frames[i]).extract(area).removeAlpha().raw().toBuffer();let changed=0,distinct=0,total=0;for(let j=0;j<a.length;j+=3){const n=Math.abs(a[j]-b[j])+Math.abs(a[j+1]-b[j+1])+Math.abs(a[j+2]-b[j+2]);if(n>6)changed++;if(n>18)distinct++;total+=n;}row[name]={变化比例:changed/(a.length/3),明显差异比例:distinct/(a.length/3),平均通道差:total/a.length};}differences.push(row);}
 const passed=differences.every(d=>[d.池塘上部,d.池塘中心,d.池塘下部].every(r=>r.平均通道差>2&&r.变化比例>0.25)&&d.固定岸内水带.变化比例===0&&d.不透明桥板.变化比例===0);
 // 使用真实按键过桥，镜头保持同机位；不是在运行状态里写玩家坐标。
 for(const y of [940,1380]) {
   const player=(await readWater(page)).state.player,sign=Math.sign(y-player.y),key=sign>0?'s':'w';
   if(Math.abs(player.x-1090)>4)throw Error('录屏站位不在西桥通道');
   await page.keyboard.down(key);
   try {await page.waitForFunction(({y,sign})=>sign*(window.__farwind().state.player.y-y)>-3,{y,sign},{timeout:10000});}
   finally {await page.keyboard.up(key);}
 }
 await page.waitForTimeout(600);
 const final=await readWater(page),duration=(Date.now()-start)/1000,video=page.video();await context.close();
 const encoding=spawnSync('/opt/homebrew/bin/ffmpeg',['-hide_banner','-loglevel','error','-y','-ss',String((start-videoStart)/1000),'-i',await video.path(),'-t',String(duration),'-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-movflags','+faststart',`${directory}/after-${width}.mp4`]);if(encoding.status!==0)throw Error(encoding.stderr.toString());
 rows.push({视口:[width,height],像素密度:dpr,相机:state.camera,性能:stats,水面差异:differences,水面状态:final.water,录像秒数:duration,错误:errors,结果:passed&&!errors.length?'通过':'失败'});
 if(!passed||errors.length)throw Error('默认视口的池水运动或遮挡检查失败');
 }finally{await context.close();}
 }}finally{await browser.close();await writeFile(`${directory}/after.json`,JSON.stringify({说明:'当前5173修改后真实运行，正常HUD、默认缩放、相同机位，前10秒原生Metal性能短测，后段真实键盘过桥。这里只比较水面和不透明木板，透明板缝正确透出水纹。数字用于验证运动范围，观感仍需查看录屏。',记录:rows},null,2));}
const baseline=JSON.parse(await readFile(`${directory}/baseline.json`));
await writeFile(`${directory}/performance.json`,JSON.stringify({说明:'同一M5 Pro原生Metal、两种相同视口各10秒短测；修改前在更改源码之前保存，修改后并未恢复旧实现。其他任务同时运行，不能据此保证所有设备长期性能。',修改前:baseline.记录,修改后:rows.map(r=>({视口:r.视口,像素密度:r.像素密度,性能:r.性能}))},null,2));
console.log('两种默认视口的真实水面录屏、过桥、静态边界和性能短测已完成');
