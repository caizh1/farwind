// 仅用于独立诊断端口；隔离开关在每轮结束后恢复，不写入正式代码或用户存档。
function installBottleneckProbe(scene) {
  const game = scene.game, gl = game.renderer.gl;
  const timer = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  let mode = 'baseline', sampling = false, current = null, rows = [], gpu = [], pending = [], query = null, report = [], busy = false;
  const names = {baseline:'完整游戏',no_sim:'停止世界逻辑',no_render:'停止世界和光照绘制',no_light:'停止光照绘制',no_hud:'冻结并隐藏界面',no_shadows:'关闭动态投影',gpu_wait:'等待GPU完成',no_graphics:'跳过矢量图形',no_images:'跳过贴图',no_text:'跳过文字',no_mesh:'跳过网格',no_shapes:'跳过形状',cull_images:'仅提交视野内贴图',empty_shapes:'跳过完全透明形状',shadow_fix:'禁用阴影占位填充'};
  const wrap = (obj, key, label, skip) => {
    const fn = obj[key]; if (typeof fn !== 'function') return;
    obj[key] = function(...args) { if (sampling && skip?.()) return; const begin = performance.now(); try { return fn.apply(this,args); } finally { if(current) current[label] = (current[label] || 0) + performance.now()-begin; } };
  };
  wrap(scene.sys,'sceneUpdate','世界逻辑毫秒',()=>mode==='no_sim');
  // 场景创建完成后Phaser可能重新缓存update，所以在开始按钮中再确认sceneUpdate计时。
  const originalSceneUpdate = scene.update;
  scene.update = function(...args) { if(sampling && mode==='no_sim')return; const begin=performance.now();try{return originalSceneUpdate.apply(this,args);}finally{if(current)current.世界逻辑毫秒=(current.世界逻辑毫秒||0)+performance.now()-begin;} };
  let renderedTypes={},imageTextures={};
  const originalRender=game.renderer.render;
  game.renderer.render=function(sc,children,camera){
    if(sampling && rows.length===0){renderedTypes={};imageTextures={};for(const c of children){renderedTypes[c.type]=(renderedTypes[c.type]||0)+1;if(c.texture)imageTextures[c.texture.key]=(imageTextures[c.texture.key]||0)+1;}}
    const excludes={no_graphics:['Graphics'],no_images:['Image','Sprite'],no_text:['Text','BitmapText'],no_mesh:['Mesh2D','Mesh'],no_shapes:['Ellipse','Rectangle','Polygon','Line','Triangle','Arc']};
    const skip=sampling?excludes[mode]:null;
    let draw=skip?children.filter(c=>!skip.includes(c.type)):children;
    if(sampling&&mode==='cull_images'){const view=camera.worldView;draw=draw.filter(c=>{if(!['Image','Sprite'].includes(c.type)||c.scrollFactorX!==1||c.scrollFactorY!==1||c.parentContainer||c.filters)return true;const b=c.getBounds();return b.right>=view.x-8&&b.x<=view.right+8&&b.bottom>=view.y-8&&b.y<=view.bottom+8;});}
    if(sampling&&mode==='empty_shapes')draw=draw.filter(c=>!(c.isFilled&&c.fillAlpha===0&&!c.isStroked));
    if(current)current.提交对象数=draw.length;
    return originalRender.call(this,sc,draw,camera);
  };
  wrap(game.scene,'render','渲染提交毫秒',()=>mode==='no_render');
  wrap(scene.dayNight,'render','光照毫秒',()=>mode==='no_light'||mode==='no_render');
  for(const k of ['update','xiaobaoStatus','windAimStatus','training','parryStatus','swordWind','practiceFeedback'])wrap(scene.ui,k,'界面毫秒',()=>mode==='no_hud');
  for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced','texImage2D','texSubImage2D']) {
    const fn = gl[name]; if(!fn)continue;
    gl[name]=function(...args){if(current)current[name]=(current[name]||0)+1;return fn.apply(this,args);};
  }
  const originalCallback = game.loop.callback;
  game.loop.callback = function(...args) {
    if(!sampling)return originalCallback.apply(this,args);
    current={玩家X:scene.state.player.x,玩家Y:scene.state.player.y,间隔:game.loop.rawDelta,回调开始延迟:performance.now()-args[0],可见:!document.hidden,焦点:document.hasFocus()};
    while(pending.length && gl.getQueryParameter(pending[0],gl.QUERY_RESULT_AVAILABLE)) {
      const q=pending.shift();if(!gl.getParameter(timer.GPU_DISJOINT_EXT))gpu.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q);
    }
    if(timer && pending.length<20){query=gl.createQuery();gl.beginQuery(timer.TIME_ELAPSED_EXT,query);}
    const begin=performance.now();
    try {return originalCallback.apply(this,args);} finally {
      current.整个引擎回调毫秒=performance.now()-begin;
      if(query){gl.endQuery(timer.TIME_ELAPSED_EXT);pending.push(query);query=null;}
      if(mode==='gpu_wait'){const t=performance.now();gl.finish();current.等待GPU毫秒=performance.now()-t;}
      rows.push(current);current=null;
    }
  };
  const longFrames=[];
  if(PerformanceObserver.supportedEntryTypes.includes('long-animation-frame'))new PerformanceObserver(list=>{if(sampling)for(const e of list.getEntries())longFrames.push({时长:e.duration,阻塞:e.blockingDuration,渲染开始:e.renderStart,布局开始:e.styleAndLayoutStart,脚本:e.scripts.map(s=>({函数:s.sourceFunctionName,来源:s.sourceURL,时长:s.duration,强制布局:s.forcedStyleAndLayoutDuration}))});}).observe({type:'long-animation-frame',buffered:false});
  const panel=document.createElement('section');panel.id='bottleneck-probe';panel.style.cssText='position:fixed;z-index:99999;right:8px;bottom:8px;max-width:560px;max-height:80vh;overflow:auto;background:#142c24ed;color:#fff;padding:12px;font:12px monospace';
  const controls=document.createElement('div');controls.style.cssText='display:flex;gap:8px;flex-wrap:wrap';
  const output=document.createElement('pre');output.id='bottleneck-result';output.textContent='等待诊断';
  const progress=document.createElement('p');progress.id='bottleneck-progress';
  const summary=values=>{const a=values.filter(Number.isFinite).sort((a,b)=>a-b);return{平均:a.reduce((s,x)=>s+x,0)/a.length,九五:a[Math.floor(a.length*.95)],九九:a[Math.floor(a.length*.99)],最长:a.at(-1)};};
  const delay=ms=>new Promise(r=>setTimeout(r,ms));
  const fillDefaults=new Map();
  function setAnchorFill(disabled){for(const {contact} of groundShadows(scene).entries.values()){if(!fillDefaults.has(contact))fillDefaults.set(contact,[contact.fillColor,contact.fillAlpha,contact.isFilled]);const [color,alpha,filled]=fillDefaults.get(contact);contact.setFillStyle(disabled||!filled?undefined:color,alpha);}}
  function restore(){setAnchorFill(false);mode='baseline';scene.dayNight.canvas.style.visibility='';scene.ui.root.style.visibility='';groundShadows(scene).enabled=true;}
  function snapshot(){return{模式:scene.ui.mode,生命:scene.state.player.hp,位置:{x:scene.state.player.x,y:scene.state.player.y},时间:scene.state.time,对象数:scene.children.length,阴影占位填充数:[...groundShadows(scene).entries.values()].filter(e=>e.contact.isFilled).length,可见柔影数:[...groundShadows(scene).entries.values()].filter(e=>e.soft.visible).length,活敌:[...scene.enemies,...scene.defense.enemies].filter(e=>e.hp>0&&!e.disabled).length};}
  async function phase(next,seconds=8){
    restore();mode=next;scene.ui.close(true);scene.ui.focusGame();
    if(mode==='no_light'||mode==='no_render')scene.dayNight.canvas.style.visibility='hidden';
    if(mode==='no_hud')scene.ui.root.style.visibility='hidden';
    if(mode==='shadow_fix')setAnchorFill(true);
    if(mode==='no_shadows')groundShadows(scene).enabled=false;
    progress.textContent='正在预热：'+names[next];await delay(1500);
    rows=[];gpu=[];longFrames.length=0;const start=snapshot(),begin=performance.now();sampling=true;progress.textContent='正在测量：'+names[next];
    await delay(seconds*1000);sampling=false;
    const interval=rows.map(r=>r.间隔),sum=interval.reduce((s,x)=>s+x,0),keys=['提交对象数','整个引擎回调毫秒','世界逻辑毫秒','渲染提交毫秒','光照毫秒','界面毫秒','等待GPU毫秒','回调开始延迟','drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced','texImage2D','texSubImage2D'];
    const value={名称:names[next],阶段:next,轨迹范围:{最小X:Math.min(...rows.map(r=>r.玩家X)),最大X:Math.max(...rows.map(r=>r.玩家X)),最小Y:Math.min(...rows.map(r=>r.玩家Y)),最大Y:Math.max(...rows.map(r=>r.玩家Y))},墙钟:performance.now()-begin,样本:rows.length,帧率:rows.length*1000/sum,帧间隔:summary(interval),分项:Object.fromEntries(keys.map(k=>[k,summary(rows.map(r=>r[k]||0))])),渲染对象类型:renderedTypes,贴图对象计数:imageTextures,GPU时间:summary(gpu),GPU计时支持:!!timer,无焦点帧:rows.filter(r=>!r.焦点).length,后台帧:rows.filter(r=>!r.可见).length,长帧:longFrames.slice(),开始:start,结束:snapshot()};
    report.push(value);restore();scene.ui.open('pause');output.textContent=JSON.stringify({环境:environment(),结果:report},null,2);
    await fetch('/bottleneck-result',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({环境:environment(),结果:report})});
    return value;
  }
  function environment(){const ext=gl.getExtension('WEBGL_debug_renderer_info');return{说明:'独立端口中的性能隔离实验，不是功能验收；分项有嵌套，GPU计时以查询结果为准。',日期:new Date().toISOString(),视口:[innerWidth,innerHeight,devicePixelRatio],画布:[game.canvas.width,game.canvas.height],显卡:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'',浏览器:navigator.userAgent,限制帧率:game.loop.fpsLimit,GPU计时支持:!!timer};}
  const button=(text,fn)=>{const b=document.createElement('button');b.textContent=text;b.onclick=async()=>{if(busy)return;busy=true;b.disabled=true;try{await fn();}catch(e){output.textContent='诊断失败：'+e.stack;restore();scene.ui.open('pause');}finally{busy=false;b.disabled=false;}};controls.append(b);};
  button('载入诊断存档副本',async()=>{const s=await(await fetch('/diagnostic-save')).json();await scene.ui.actions.import(s);scene.ui.open('pause');output.textContent='已通过正式导入流程载入副本；原5173存档不受影响。';});
  button('开始第一组隔离',async()=>{report=[];for(const m of ['baseline','no_sim','baseline','no_render','baseline'])await phase(m);progress.textContent='第一组完成';});
  button('开始第二组隔离',async()=>{report=[];for(const m of ['baseline','no_light','no_hud','no_shadows','gpu_wait','baseline'])await phase(m);progress.textContent='第二组完成';});
  button('开始画面类型隔离',async()=>{report=[];for(const m of ['baseline','no_graphics','no_images','no_text','no_mesh','no_shapes','baseline'])await phase(m);progress.textContent='画面类型隔离完成';});
  button('开始贴图裁剪对照',async()=>{report=[];for(const m of ['baseline','empty_shapes','baseline','cull_images','empty_shapes','baseline'])await phase(m,10);progress.textContent='贴图裁剪对照完成';});
  button('开始源头修复对照',async()=>{report=[];for(const m of ['baseline','shadow_fix','baseline','shadow_fix'])await phase(m,12);progress.textContent='源头修复对照完成';});
  button('核对修复前后像素',async()=>{
    restore();scene.ui.open('pause');
    const capture=()=>new Promise(resolve=>game.events.once('postrender',()=>resolve(game.canvas.toDataURL('image/png'))));
    const before=await capture();setAnchorFill(true);const after=await capture();
    const decode=async url=>{const im=new Image();im.src=url;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);return ctx.getImageData(0,0,c.width,c.height).data;};
    const a=await decode(before),b=await decode(after);let different=0,max=0;for(let i=0;i<a.length;i+=4){let changed=false;for(let j=0;j<4;j++){const d=Math.abs(a[i+j]-b[i+j]);max=Math.max(max,d);changed||=d!==0;}if(changed)different++;}
    const result={说明:'同一已暂停世界、同一相机，仅切换阴影占位填充；比较WebGL画布全部RGBA像素，光照和HUD不受此改动影响。',宽:game.canvas.width,高:game.canvas.height,差异像素:different,总像素:a.length/4,最大通道差:max,修复后:snapshot()};
    output.textContent=JSON.stringify(result,null,2);await fetch('/bottleneck-visual',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({结果:result,之前:before,之后:after})});restore();
  });
  button('真实行走采样',async()=>{report=[];const timer=setInterval(()=>{const key=Math.floor(performance.now()/1000)%2?'a':'d';for(const k of ['a','d'])window.dispatchEvent(new KeyboardEvent('keyup',{key:k}));window.dispatchEvent(new KeyboardEvent('keydown',{key}));},100);try{await phase('baseline',20);}finally{clearInterval(timer);for(const key of ['a','d'])window.dispatchEvent(new KeyboardEvent('keyup',{key}));}progress.textContent='真实行走采样完成';});
  button('单次完整采样',async()=>{report=[];await phase('baseline',15);progress.textContent='采样完成';});
  panel.append(controls,progress,output);document.body.append(panel);
}
const bottleneckCreate=World.prototype.create;
World.prototype.create=function(...args){const result=bottleneckCreate.apply(this,args);installBottleneckProbe(this);return result;};
