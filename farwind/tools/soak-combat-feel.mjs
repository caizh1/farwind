import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const version=process.env.COMBAT_FEEL_VERSION??'candidate',seconds=Number(process.env.COMBAT_SOAK_SECONDS??600),dir=`docs/combat-feel/demo/${version}`;
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],cycles=[],frames=[];
page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
try{
await page.goto(`http://127.0.0.1:${version==='baseline'?5213:5212}/?combatFeel=1&combatVersion=${version==='baseline'?'baseline':'candidate'}`);await page.waitForFunction(()=>window.__combatFeel,null,{timeout:60000});
const environment=await page.evaluate(()=>{const canvas=document.querySelector('canvas'),gl=canvas?.getContext('webgl2')??canvas?.getContext('webgl'),extension=gl?.getExtension('WEBGL_debug_renderer_info');return {浏览器:navigator.userAgent,分辨率:[innerWidth,innerHeight],渲染器:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):'不可读',核心数:navigator.hardwareConcurrency};});
const read=()=>page.evaluate(()=>window.__farwind());
const begun=Date.now();
 while(Date.now()-begun<seconds*1000){
  const index=cycles.length,preset=index%6===5?['slime','guardian','spore','boar'][Math.floor(index/6)%4]:'group';
  await page.evaluate(async({preset,wind})=>window.__combatFeel.reset(preset,wind),{preset,wind:index%2===0});
  await page.waitForFunction(()=>{const s=window.__combatFeel.status();return s.active&&!s.busy&&s.sim>120;});
  const begin=await page.evaluate(()=>{const d=window.__combatFeel.snapshot();return {对象:d.对象,保存:d.保存,反馈:d.反馈,音频:d.音频};}),end=Date.now()+10000;
  while(Date.now()<end&&Date.now()-begun<seconds*1000){
   let s=await read();if(s.mode||s.state.player.hp<=0)break;
   const warning=s.warnings?.find(w=>w.lead!==null&&w.lead>20&&w.lead<140),c=s.session.combat;
   if(warning&&c.parryCooldownRemaining<=0)await page.keyboard.press('k');
   else if(c.hurt?.active)await page.waitForTimeout(80);
   else{
    const target=s.enemies.filter(e=>e.hp>0).sort((a,b)=>Math.hypot(a.x-s.state.player.x,a.y-s.state.player.y)-Math.hypot(b.x-s.state.player.x,b.y-s.state.player.y))[0];
    if(target){const dx=target.x-s.state.player.x,dy=target.y-s.state.player.y,key=Math.abs(dx)>Math.abs(dy)?dx<0?'a':'d':dy<0?'w':'s';await page.keyboard.down(key);await page.waitForTimeout(Math.hypot(dx,dy)>85?70:10);await page.keyboard.up(key);}
    if((c.stage<3&&!c.buffered)||(c.stage>=3&&s.session.attackUntil-s.session.sim<140))await page.keyboard.press('j');
    if(warning&&c.dashLegalAt<=s.session.sim&&s.state.player.stamina>=20){await page.keyboard.down('s');await page.keyboard.press('l');await page.keyboard.up('s');}
   }
   await page.waitForTimeout(110);
  }
  const diagnostic=await page.evaluate(()=>window.__combatFeel.snapshot());
  frames.push(...diagnostic.帧.map(f=>({...f,轮次:index})));
  cycles.push({轮次:index,样板:preset,剑风:index%2===0,开始:begin,结束:{对象:diagnostic.对象,保存:diagnostic.保存,反馈队列:diagnostic.反馈.pending,反馈对象:diagnostic.反馈.effects.length,音频:diagnostic.音频.voices,血量:diagnostic.世界.state.player.hp,击杀:diagnostic.反馈.events.filter(e=>e.kind==='kill').length,剑风释放:diagnostic.世界.swordWind?.events.filter(e=>e.reason==='release').length??0,堆内存:await page.evaluate(()=>performance.memory?.usedJSHeapSize??null)}});
  console.log(JSON.stringify({说明:'本轮正式输入和重置检查完成',轮次:index,已运行秒:Math.round((Date.now()-begun)/1000)}));
 }
 const sorted=frames.map(f=>f.rawDelta).sort((a,b)=>a-b),percentile=p=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))];
 await writeFile(`${dir}/soak.json`,JSON.stringify({说明:'正常墙钟持续运行；每轮显式重置隔离初始状态，战斗只由键盘与正式AI结算。原始帧包含慢帧及停顿；软件渲染和同时运行回归的负载不能作为目标设备帧率验收。',版本:version,环境:environment,持续秒:(Date.now()-begun)/1000,统计:{帧数:frames.length,中位数:percentile(.5),P95:percentile(.95),P99:percentile(.99),大于50毫秒:sorted.filter(x=>x>50).length,大于100毫秒:sorted.filter(x=>x>100).length,最大帧:sorted.at(-1)},轮次:cycles,错误:errors},null,2));
 await writeFile(`${dir}/raw-frames.json`,JSON.stringify({说明:'原始引擎帧间隔；墙钟与模拟时钟仅作成对映射，不直接混减。',帧:frames}));
 if(errors.length||cycles.some(c=>c.结束.反馈队列>96||c.结束.反馈对象>32||c.结束.音频>16||c.结束.保存?.queued>8))throw Error('发现错误或有界资源上限异常，请检查诊断。');
}finally{await browser.close();}
