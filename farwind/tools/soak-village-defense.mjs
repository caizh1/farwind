import {chromium} from '@playwright/test';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=process.env.FARWIND_EVIDENCE_ROOT??'docs/village-defense/m5',url=process.env.FARWIND_URL??'http://127.0.0.1:5204/',duration=Number(process.env.FARWIND_SOAK_MS??1200000);
const fixtures=JSON.parse(await readFile('.parry-local/m5/fixtures.json','utf8'));
await mkdir(root,{recursive:true});
try{await access(`${root}/soak-results.json`);throw Error('已有性能验收结果，请用FARWIND_EVIDENCE_ROOT指定新的英文目录，禁止覆盖原记录');}catch(error){if(error.code!=='ENOENT')throw error;}
const browser=await chromium.launch({args:['--enable-gpu','--use-gl=angle','--use-angle=metal','--ignore-gpu-blocklist','--enable-precise-memory-info']});
const cdp=await browser.newBrowserCDPSession(),info=await cdp.send('SystemInfo.getInfo');
if(!info.gpu.auxAttributes?.glRenderer?.includes('Apple M5 Pro'))throw Error('未实际使用目标Metal GPU，不运行硬件性能验收');
const entry=(await readFile('dist/index.html','utf8')).match(/<script[^>]+src="([^"]+\.js)"/)?.[1];
if(!entry)throw Error('生产入口缺失，请先构建');
const report={说明:'本机生产构建，真实Apple M5 Pro Metal后端；浏览器无头，1280×720，时间未加速。历史档只通过正式导入建立初始条件。rAF为呈现间隔，CDP堆不包括完整GPU内存，不能等同其他设备。',浏览器:await browser.version(),GPU:info.gpu,要求时长毫秒:duration,资源SHA256:createHash('sha256').update(await readFile('dist/'+entry.replace(/^\//,''))).digest('hex'),活跃采样:[],自然持续运行:[],错误:[]};
const quantile=(a,p)=>a[Math.min(a.length-1,Math.floor(a.length*p))]??0;
async function importFixture(page,s){
 await page.goto(url);await page.waitForFunction(()=>typeof window.__farwind==='function');page.once('dialog',d=>d.accept());
 const choose=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入存档',exact:true}).click();
 await(await choose).setFiles({name:'integration-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(s))});
 await page.waitForFunction(()=>window.__farwind().mode==='');
}
async function meter(page){
 const session=await page.context().newCDPSession(page);await session.send('Performance.enable');
 await page.evaluate(()=>{let last=performance.now();const frames=[];window.__m5Frames=frames;const tick=now=>{frames.push(now-last);last=now;requestAnimationFrame(tick);};requestAnimationFrame(tick);});
 return async()=>{
  const sample=await page.evaluate(()=>{const d=window.__farwind();return{模式:d.mode,页面隐藏:document.hidden,时钟:d.state.time,铜币:d.state.coins,背包:d.state.bag,任务:d.state.quest,固定击杀:d.state.killed,序号:d.state.defense.sequence,结算号:d.state.defense.completedSequence,保护毫秒:d.state.defense.protectionMs,冷却毫秒:d.state.defense.cooldownMs,事件:d.state.defense.raid?{id:d.state.defense.raid.id,gate:d.state.defense.raid.gateId,phase:d.state.defense.raid.phase,members:d.state.defense.raid.members.map(m=>({id:m.id,hp:m.hp}))}:null,守卫:d.state.defense.guards.map(g=>({id:g.id,hp:g.hp,dead:g.dead})),箭:d.defense.arrows.length,来袭实体:d.defense.enemies.length,历史:d.defense.history,帧:window.__m5Frames.splice(0)}});
  sample.帧.sort((a,b)=>a-b);const f=sample.帧;sample.帧间隔={数量:f.length,均值:f.reduce((a,b)=>a+b,0)/Math.max(1,f.length),中位:quantile(f,.5),九五分位:quantile(f,.95),九九分位:quantile(f,.99),最大:f.at(-1)??0,超过33毫秒:f.filter(n=>n>33.34).length};delete sample.帧;
  const metrics=(await session.send('Performance.getMetrics')).metrics;sample.浏览器指标=Object.fromEntries(metrics.filter(m=>['JSHeapUsedSize','JSHeapTotalSize','Nodes','Documents','JSEventListeners','TaskDuration'].includes(m.name)).map(m=>[m.name,m.value]));
  return sample;
 };
}
try{
 for(const [i,fixture]of fixtures.probes.entries()){
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});const page=await context.newPage();page.on('pageerror',e=>report.错误.push(e.message));
  await importFixture(page,fixture);const sample=await meter(page),samples=[];const started=Date.now();
  while(Date.now()-started<15000){await page.waitForTimeout(500);samples.push(await sample());}
  await page.screenshot({path:`${root}/active-${i+1}.png`});
  report.活跃采样.push({出口:fixture.defense.raid.gateId,样本:samples});await context.close();
 }
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});const page=await context.newPage();page.on('pageerror',e=>report.错误.push(e.message));
 await importFixture(page,fixtures.base);const sample=await meter(page),start=Date.now();let next=0;
 report.自然初始=await sample();await page.screenshot({path:`${root}/soak-start.png`});
 while(Date.now()-start<duration){
  await page.waitForTimeout(1000);
  if(Date.now()-start>=next){const value=await sample();value.墙钟毫秒=Date.now()-start;report.自然持续运行.push(value);next+=30000;
   await writeFile(`${root}/soak-progress.json`,JSON.stringify(report,null,2));console.log(`持续运行 ${Math.round(value.墙钟毫秒/1000)}秒，模拟 ${Math.round((value.时钟-report.自然初始.时钟)/1.5)}秒，事件${value.序号}／结算${value.结算号}，守卫死亡${value.守卫.filter(g=>g.dead).length}，帧95分位${value.帧间隔.九五分位.toFixed(1)}毫秒`);
   if(value.模式!==''||value.页面隐藏)throw Error('实际运行被暂停或隐藏，停止计为有效持续运行');
  }
 }
 report.实际时长毫秒=Date.now()-start;report.自然结束=await sample();await page.screenshot({path:`${root}/soak-end.png`});
 // 正式保存并返回标题，随后重新打开，验证最后一场结算和冷却不补刷。
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'保存并返回标题',exact:true}).click();
 await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();report.重载=await page.evaluate(()=>window.__farwind().state);
 if(report.错误.length||report.自然结束.守卫.some(g=>g.dead)||report.自然结束.来袭实体>4||report.自然结束.箭>12||report.自然结束.结算号<1)throw Error('持续运行功能门槛不满足');
 if(report.重载.defense.completedSequence!==report.自然结束.结算号||report.重载.coins!==fixtures.base.coins||JSON.stringify(report.重载.bag)!==JSON.stringify(fixtures.base.bag)||report.重载.quest!==fixtures.base.quest)throw Error('结束保存／重载或任务隔离失败');
 report.功能结果='通过';await context.close();
}catch(error){report.功能结果='失败';report.首因=error.stack;process.exitCode=1;}
finally{await writeFile(`${root}/soak-results.json`,JSON.stringify(report,null,2));await browser.close();}
