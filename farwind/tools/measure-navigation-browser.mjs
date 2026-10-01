import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs/promises';
const root=fileURLToPath(new URL('..',import.meta.url));
const probe=`<!doctype html><html lang="zh"><meta charset="utf-8"><title>真实浏览器寻路对照</title><style>body{font:17px system-ui;background:#132820;color:#edf4df;margin:40px}button{font:inherit;padding:12px 18px;margin:8px}pre{white-space:pre-wrap;line-height:1.5}</style><h1>真实浏览器寻路对照</h1><p>使用当前正式地图的水井绕行路线。旧同步搜索与新分帧搜索各跑五次，保留同一碰撞与路径规则。</p><button id="sync">测量原同步寻路</button><button id="batch">测量分帧寻路</button><pre id="result">等待测量</pre><script type="module" src="/navigation-probe.ts"></script></html>`;
const probeModule=`
import {localPath,pathSearch,advancePathSearch,navigationBudget,NAV} from '/src/game/systems/enemy.ts';
import {clearMotionLine,motionBlocked} from '/src/game/systems/obstacles.ts';
const start={x:863,y:415},target={x:1017,y:415};
const goal=p=>Math.hypot(p.x-target.x,p.y-target.y)<26&&clearMotionLine(p,target);
const frames=()=>new Promise(resolve=>requestAnimationFrame(resolve));
const reports={};
const gl=document.createElement('canvas').getContext('webgl2'),ext=gl?.getExtension('WEBGL_debug_renderer_info');
const environment={浏览器:navigator.userAgent,显卡:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'未取得',起终点可站:!motionBlocked(start.x,start.y)&&!motionBlocked(target.x,target.y),直线可走:clearMotionLine(start,target),路线:{起点:start,终点:target}};
async function measure(batched){
 document.querySelectorAll('button').forEach(b=>b.disabled=true);
 const samples=[];
 for(let run=0;run<5;run++){
   document.querySelector('#result').textContent='正在测量第 '+(run+1)+' 次';await frames();
   const durations=[],begin=performance.now();let result;
   if(!batched){const at=performance.now();result=localPath(start,goal,target,()=>true);durations.push(performance.now()-at);}
   else{const search=pathSearch(start,goal,target,()=>true);for(let frame=0;frame<2000&&!result;frame++){const at=performance.now();result=advancePathSearch(search,navigationBudget()).result;durations.push(performance.now()-at);if(!result)await frames();}}
   samples.push({次数:run+1,搜索完成:!!result,路线:result?.path,展开节点:result?.visited,批次数:durations.length,最长单帧规划毫秒:Math.max(...durations),总计算毫秒:durations.reduce((a,b)=>a+b,0),完成等待毫秒:performance.now()-begin});
 }
 reports[batched?'分帧':'同步']=samples;
 document.querySelector('#result').textContent=JSON.stringify({环境:environment,预算:{每帧毫秒:NAV.frameMs,节点硬上限:NAV.nodesPerBatch},结果:reports},null,2);
 document.querySelectorAll('button').forEach(b=>b.disabled=false);
}
document.querySelector('#sync').onclick=()=>measure(false);document.querySelector('#batch').onclick=()=>measure(true);
`;
const instrumentation=`
function installNavigationMeasurement(scene){
 const raw=[],updates=[],batches=[],trace=[];
 let sampling=false;
 const original=scene.update;
 scene.update=function(...args){
   const enabled=sampling&&scene.active&&!scene.ui.paused&&!scene.defenseSaving&&!scene.sessionStarting;
   const begin=performance.now();try{return original.apply(this,args);}finally{if(enabled){raw.push(scene.game.loop.rawDelta);updates.push(performance.now()-begin);}}
 };
 const panel=document.createElement('section');panel.id='navigation-measurement';panel.style.cssText='position:fixed;right:8px;top:8px;z-index:100000;background:#142c24e8;color:#fff;padding:12px;max-width:430px;max-height:480px;overflow:auto;font:13px monospace';
 const button=document.createElement('button');button.textContent='开始十秒帧采样';let duration=10000;
 const pause=()=>{if(scene.defenseSaving||scene.economy.busy||scene.sessionStarting){setTimeout(pause,20);return;}scene.ui.open('pause');};
 const output=document.createElement('pre');output.id='navigation-measurement-output';output.textContent='等待开始采样';
 const percentile=(values,p)=>{const sorted=values.slice().sort((a,b)=>a-b);return sorted[Math.floor((sorted.length-1)*p)]??null;};
 button.onclick=()=>{
   raw.length=0;updates.length=0;trace.length=0;sampling=true;button.disabled=true;
   const begin=performance.now();
   setTimeout(()=>{
     sampling=false;button.disabled=false;
     for(const key of ['a','d','w','s'])window.dispatchEvent(new KeyboardEvent('keyup',{key}));
     pause();
     const gl=scene.game.renderer.gl,ext=gl?.getExtension('WEBGL_debug_renderer_info');
     output.textContent=JSON.stringify({说明:'当前工作树、独立测试存档、真实浏览器。按原始帧间隔计数，包含全部长帧；短时采样。',样本帧:raw.length,实际毫秒:performance.now()-begin,平均帧率:1000/(raw.reduce((a,b)=>a+b,0)/raw.length),帧间隔中位毫秒:percentile(raw,.5),帧间隔百分之九十五毫秒:percentile(raw,.95),帧间隔百分之九十九毫秒:percentile(raw,.99),最长帧间隔毫秒:Math.max(...raw),超过三十三毫秒帧:raw.filter(x=>x>33.3).length,超过五十毫秒帧:raw.filter(x=>x>50).length,世界更新平均毫秒:updates.reduce((a,b)=>a+b,0)/updates.length,世界更新百分之九十五毫秒:percentile(updates,.95),世界更新最长毫秒:Math.max(...updates),画布:[scene.game.canvas.width,scene.game.canvas.height],浏览器:navigator.userAgent,显卡:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'未取得',玩家:{x:scene.state.player.x,y:scene.state.player.y,hp:scene.state.player.hp},敌人:scene.enemies.length,界面:scene.ui.mode,轨迹:trace},null,2);
   },duration);
 };
 const controls=document.createElement('div');controls.style.cssText='display:flex;gap:6px;flex-wrap:wrap';
 const pauseButton=document.createElement('button');pauseButton.textContent='暂停测试';pauseButton.onclick=pause;controls.append(pauseButton);
 const longSample=document.createElement('button');longSample.textContent='开始四十五秒帧采样';longSample.onclick=()=>{duration=45000;button.click();duration=10000;};controls.append(longSample);
 // 临时测试控件只发送正式键盘输入事件，不改玩家、敌人、时间或进度。
 for(const [label,key] of [['向左走三秒','a'],['向右走三秒','d'],['向上走三秒','w'],['向下走三秒','s']]){
   const control=document.createElement('button');control.textContent=label;control.onclick=()=>{window.dispatchEvent(new KeyboardEvent('keydown',{key}));control.disabled=true;setTimeout(()=>{window.dispatchEvent(new KeyboardEvent('keyup',{key}));control.disabled=false;},3000);};controls.append(control);
 }
 const roundTrip=document.createElement('button');roundTrip.textContent='左右往返十秒';roundTrip.onclick=()=>{roundTrip.disabled=true;for(let step=0;step<10;step++)setTimeout(()=>{for(const key of ['a','d'])window.dispatchEvent(new KeyboardEvent('keyup',{key}));window.dispatchEvent(new KeyboardEvent('keydown',{key:step%2?'d':'a'}));},step*1000);setTimeout(()=>{for(const key of ['a','d'])window.dispatchEvent(new KeyboardEvent('keyup',{key}));roundTrip.disabled=false;},10000);};controls.append(roundTrip);
 const withdrawal=document.createElement('button');withdrawal.textContent='向左撤离十秒';withdrawal.onclick=()=>{const send=()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'a'}));send();const held=setInterval(send,100);withdrawal.disabled=true;setTimeout(()=>{clearInterval(held);window.dispatchEvent(new KeyboardEvent('keyup',{key:'a'}));withdrawal.disabled=false;},10000);};controls.append(withdrawal);
 const live=document.createElement('pre');live.id='navigation-live-output';
 panel.append(button,controls,output,live);document.body.append(panel);
 const tracker=setInterval(()=>{const point={时间:scene.sim,玩家:{x:scene.state.player.x,y:scene.state.player.y,hp:scene.state.player.hp},界面:scene.ui.mode,事务:{保存:scene.defenseSaving,忙碌:!!scene.economy.busy,会话重建:scene.sessionStarting},敌人:scene.enemies.map(e=>({id:e.id,x:e.x,y:e.y,hp:e.hp,动作:e.ai,路径:e.nav.path,查询:e.nav.queries,节点:e.nav.visited})),芦边遭遇:scene.state.encounters.groups['south-reed-margin'],守卫:scene.defense.snapshot().guards};live.textContent=JSON.stringify(point,null,2);if(sampling)trace.push(point);},500);
 scene.events.once('shutdown',()=>{clearInterval(tracker);panel.remove();});
}
const originalMeasurementCreate=World.prototype.create;
World.prototype.create=function(...args){const result=originalMeasurementCreate.apply(this,args);installNavigationMeasurement(this);return result;};
`;
const server=await createServer({root,configFile:false,server:{host:'127.0.0.1',port:5260,strictPort:true},plugins:[{name:'临时寻路测量',enforce:'pre',configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url==='/navigation-probe'){res.setHeader('Content-Type','text/html;charset=utf-8');res.end(probe);}else if(req.url==='/navigation-probe.ts'){res.setHeader('Content-Type','text/javascript;charset=utf-8');res.end(probeModule);}else next();});},transform(code,id){
 if(id.endsWith('/src/game/scenes/World.ts'))return code+instrumentation;
 // 自动化文件选择器需要持续存在的节点；仅临时测试端口挂载原输入控件，仍走正式解析、确认与保存入口。
 if(id.endsWith('/src/game/ui/interface.ts'))return code.replace('    input.click();','    input.style.display="none";document.body.append(input);input.click();');
}}]});
await server.listen();
const {initialState,validate}=await server.ssrLoadModule('/src/game/systems/state.ts');
for(const [name,position,time] of [['ruins-fixture',{x:3670,y:-500},1227],['village-fixture',{x:863,y:415},720],['pursuit-fixture',{x:270,y:2150},720]]){
 const state=initialState();Object.assign(state.player,position);state.time=time;if(name==='pursuit-fixture')state.encounters.groups['south-reed-margin'].activated=true;validate(state);
 await fs.writeFile('/tmp/'+name+'.json',JSON.stringify({说明:'隔离测试合法起点，保留正式怪物、居民、碰撞与存档规则；之后通过界面操作。',...state},null,2));
}
console.log('独立浏览器测试已启动：http://127.0.0.1:5260/；寻路对照页面：/navigation-probe');
