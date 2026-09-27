// 隔离上下文、正式导入和真实键盘路线；正常速率测量，不能代替长期验收。
import {chromium} from '@playwright/test';
import {mkdir,writeFile,copyFile} from 'node:fs/promises';
import {cpus,platform,release} from 'node:os';
const out='docs/day-night/evidence';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:false,args:['--use-angle=metal','--ignore-gpu-blocklist']});
const rows=[];
for(const [name,url,time] of [['基线白天','http://127.0.0.1:5198',720],['当前白天',process.env.FARWIND_MEASURE_URL??'http://127.0.0.1:5207',720],['当前夜晚',process.env.FARWIND_MEASURE_URL??'http://127.0.0.1:5207',1260]]){
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1,recordVideo:{dir:'.parry-local/day-night/video',size:{width:1280,height:720}}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.getByRole('button',{name:'启程 · 新游戏'}).click();await page.waitForTimeout(500);
 const s=await page.evaluate(()=>window.__farwind().state);s.time=time;s.player.x=670;s.player.y=720;
 await page.keyboard.press('Escape');page.once('dialog',d=>d.accept());const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入存档',exact:true}).click();await(await chooser).setFiles({name:'performance-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(s))});
 await page.waitForFunction(()=>window.__farwind().mode==='');await page.waitForTimeout(1000);const before=await page.evaluate(()=>window.__farwind());
 const sample=page.evaluate(()=>new Promise(resolve=>{const deltas=[];let first=performance.now(),previous=first;const frame=at=>{deltas.push(at-previous);previous=at;if(at-first<30000)requestAnimationFrame(frame);else{deltas.sort((a,b)=>a-b);resolve({帧数:deltas.length,时长毫秒:at-first,中位帧间隔:deltas[Math.floor(deltas.length*.5)],百分之95帧间隔:deltas[Math.floor(deltas.length*.95)],最大帧间隔:deltas.at(-1)});}};requestAnimationFrame(frame);}));
 for(let i=0;i<15;i++)for(const key of ['d','a']){await page.keyboard.down(key);await page.waitForTimeout(1000);await page.keyboard.up(key);}
 const result=await sample,after=await page.evaluate(()=>window.__farwind());await page.screenshot({path:`${out}/${name==='当前夜晚'?'m5-performance-night':name==='当前白天'?'m5-performance-day':'m0-performance-day'}.png`});
 rows.push({场景:name,网址:url,钟点:time,分辨率:'1280×720',DPR:1,路线:'广场左右各1秒，重复15次，正常速率30秒',...result,有效分钟增量:after.state.time-before.state.time,开始资源:before.dayNight??null,结束资源:after.dayNight??null,错误:errors});
 const video=page.video();await context.close();if(video&&name==='当前夜晚')await copyFile(await video.path(),`${out}/m5-night-camera.webm`);
}
await browser.close();await writeFile(`${out}/performance.json`,JSON.stringify({说明:'三场均开启同尺寸录像的同机同路线短测；基线为HEAD副本，当前含其他并行任务改动，差异不能全部归因于昼夜。不宣称稳定60帧或长期性能。',时间:new Date().toISOString(),系统:`${platform()} ${release()}`,处理器:cpus()[0].model,浏览器:browser.version(),记录:rows},null,2));
