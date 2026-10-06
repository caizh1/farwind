import {windMemoryTracked} from '../systems/windMemory';
import {ROAD_NEST,ROAD_POSTS} from '../../data/merchantRoad';
import {roadTracked,roadRouteStatus} from '../systems/merchantRoadState';
import {loadCityMapArt} from './cityMapArt';
import {CITY_BUILDINGS} from '../../data/cityLayout';
import type {Interface} from './interface';
import {cityBuilding} from '../../data/cityLayout';
import {region} from '../../data/world';
import {WORLD_PLAN_REGIONS,type WorldPlanRegion} from '../../data/worldPlan';
import {CITY_SERVICES,CITY_PROPS,TRADE_ROAD_NODES,tradeRoadAnchor} from '../../data/maps/windwhisper';
import {BUILDING_LOTS,SERVICE_SIGNS} from '../../data/maps/windbell/layout';
import {MAP_REGIONS} from '../../data/village';
import {ENCOUNTERS} from '../../data/maps/windbell/encounters';
import {SHORTCUTS} from '../../data/maps/windbell/shortcuts';
import {HOMES} from '../../data/npcLife';
import {legacyTracked} from '../systems/windLegacy';
import {createMapTerrain} from './mapTerrain';
import {CONTINENT,MAP_AREAS,currentMapArea,currentMapBounds,minimumScale,maximumScale,clampCamera,fitMap,fitCurrentArea,mapToScreen,screenToMap,zoomMap,panMap,type MapCamera,type MapPoint,type MapRect,type MapSize} from './mapViewport';

type AtlasRegion=WorldPlanRegion;
export const ATLAS_REGIONS=WORLD_PLAN_REGIONS;
const available=(r:AtlasRegion)=>r.status==='已开放'||r.status==='部分开放';
const loadImage=(src:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('地图素材加载失败'));img.src=src;});
const mapIcon=(name:string)=>`<img class="map-icon" src="/assets/map-ui/icons/${name}.svg" alt="" width="20" height="20">`;

export function showWorldAtlas(ui:Interface){
 if(!ui.state)return;const s=ui.state;
 const player=s.life.playerSpace==='village'?{x:s.player.x,y:s.player.y}:{...s.life.outside};
 const area=currentMapArea(player),initial=ATLAS_REGIONS.find(r=>r.id===({plains:'forest',road:'road',city:'city'}[area]))!;
 ui.shell('远风舆图',`<div class="zoom-map-layout"><div class="map-stage"><div class="map-surface"><canvas id="world-map" tabindex="0" aria-label="可缩放地图，拖动平移、滚轮缩放；方向键平移，加减键缩放，Home返回当前区域" aria-describedby="map-instructions"></canvas><p id="map-loading" role="status">正在展开地图……</p></div>
 <section class="map-selection" aria-label="当前地点"><img id="map-vignette" src="/assets/world-map/aligned/plains-vignette.webp" alt="" width="136" height="76"><div class="map-selection-copy"><small>当前位置 · ${region(player.x,player.y)}${s.life.playerSpace!=='village'?' · 室外入口':''}</small><div class="map-selection-title"><h2 id="atlas-region-name"></h2><span id="atlas-region-status" role="status"></span></div><p id="atlas-region-detail"></p></div><button id="atlas-enter">查看区域 ${mapIcon('chevron-right')}</button></section></div>
 <aside id="map-directory-panel" class="map-sidebar" aria-label="地区目录与旅途进度" hidden><div class="map-directory-header"><h2>九境行记</h2><button id="map-directory-close" aria-label="收起地区目录">${mapIcon('x')}</button></div>
 <details id="atlas-directory"><summary>大陆地区目录</summary><div class="map-region-list">${ATLAS_REGIONS.map(r=>`<button data-atlas-region="${r.id}" aria-pressed="false"><b>${r.name}</b><span>${r.status==='未知'?'暂未开放':r.status}</span></button>`).join('')}</div></details>
 <details class="map-landmarks" open><summary>旅途地点与进度</summary><div id="map-landmark-list"></div></details></aside></div>
 <footer class="map-footer"><nav class="map-toolbar" aria-label="地图操作"><div class="map-toolbar-group"><button id="map-zoom-out" aria-label="缩小地图">${mapIcon('minus')}<span>缩小</span></button><button id="map-zoom-in" aria-label="放大地图">${mapIcon('plus')}<span>放大</span></button><button id="map-world">${mapIcon('globe')}<span>世界全貌</span></button></div><div class="map-toolbar-group"><button id="map-current">${mapIcon('map-pin')}<span>当前区域</span></button><button id="map-locate">${mapIcon('navigation')}<span>定位主角</span></button><button id="close">${mapIcon('map')}<span>收起</span><kbd>M / Esc</kbd></button></div></nav><div class="map-reading-guide"><span id="map-distance"></span><span class="map-legend">金色 · 主角　青色 · 服务　红色 · 挑战</span><small id="map-instructions">拖动平移 · 滚轮／双指缩放</small></div></footer>`);
 const panel=ui.modal.querySelector<HTMLElement>('.panel')!;panel.classList.add('zoom-map-panel');
 panel.querySelector('header')!.innerHTML=`<div class="map-title"><img src="/assets/map-ui/wind-emblem.webp" alt="" width="30" height="30"><h1 id="panel-title">远风舆图</h1><span id="map-level" role="status"></span></div><button id="map-directory-toggle" aria-expanded="false" aria-controls="map-directory-panel">${mapIcon('list')}<span>地区目录</span></button>`;
 const canvas=ui.modal.querySelector<HTMLCanvasElement>('#world-map')!,ctx=canvas.getContext('2d')!;
 const abort=new AbortController(),signal=abort.signal;
 const element=<T extends HTMLElement=HTMLElement>(id:string)=>ui.modal.querySelector<T>(`#${id}`)!;
 let closed=false,size:MapSize={width:1,height:1},camera:MapCamera={x:player.x,y:player.y,scale:1};
 let selected=initial,focusBounds:MapRect|null=currentMapBounds(player);
 let renderFrame=0,motionFrame=0,terrain:ReturnType<typeof createMapTerrain>|undefined,playerMarker:HTMLImageElement|undefined,edgeMist:HTMLImageElement|undefined,ocean:HTMLImageElement|undefined,worldBackdrop:HTMLCanvasElement|undefined;
 let hits:{left:number;top:number;width:number;height:number;region?:AtlasRegion;name?:string;detail?:string}[]=[];
 const samples:number[]=[];
 const pointers=new Map<number,MapPoint>();let gestureMoved=false,pressPoint:MapPoint|null=null;
 const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const cancelMotion=()=>{cancelAnimationFrame(motionFrame);motionFrame=0;};
 const redraw=()=>{if(!closed&&!renderFrame)renderFrame=requestAnimationFrame(()=>{renderFrame=0;draw();});};
 const showInfo=(name:string,status:string,detail:string)=>{element('atlas-region-name').textContent=name;element('atlas-region-status').textContent=status;element('atlas-region-detail').textContent=detail;element('map-vignette').hidden=name!=='风铃原野';ui.modal.querySelector<HTMLElement>('.map-sidebar')!.scrollTop=0;};
 const updateSelection=()=>{
  showInfo(selected.name,selected.status==='未知'?'暂未开放 · 未知位置':selected.status,selected.detail);
  const enter=element<HTMLButtonElement>('atlas-enter');enter.disabled=!available(selected);enter.innerHTML=available(selected)?`查看区域 ${mapIcon('chevron-right')}`:'暂未开放';
  ui.modal.querySelectorAll<HTMLButtonElement>('[data-atlas-region]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.atlasRegion===selected.id)));
  updateLandmarks();
 };
 const animateTo=(next:MapCamera,bounds:MapRect|null=null)=>{
  cancelMotion();focusBounds=bounds;next=clampCamera(next,size);
  if(reducedMotion){camera=next;redraw();return;}
  const start={...camera},began=performance.now();
  const step=(now:number)=>{if(closed)return;const t=Math.min(1,(now-began)/240),ease=1-(1-t)**3;
   camera=clampCamera({x:start.x+(next.x-start.x)*ease,y:start.y+(next.y-start.y)*ease,scale:Math.exp(Math.log(start.scale)+(Math.log(next.scale)-Math.log(start.scale))*ease)},size);redraw();
   if(t<1)motionFrame=requestAnimationFrame(step);else motionFrame=0;
  };motionFrame=requestAnimationFrame(step);
 };
 const select=(r:AtlasRegion,zoom=true)=>{selected=r;updateSelection();if(zoom&&available(r))animateTo(fitMap(r.bounds,size),r.bounds);redraw();};
 const zoom=(factor:number,anchor:MapPoint={x:size.width/2,y:size.height/2})=>{cancelMotion();focusBounds=null;camera=zoomMap(camera,factor,anchor,size);redraw();};
 const landmarks:{name:string;detail:string;point:MapPoint;color:string;campId?:string;below?:boolean}[]=[];
 landmarks.push({name:'裂牙巢穴',detail:s.merchantRoad.nest.wave===3?'已永久清剿':`守巢战斗 ${s.merchantRoad.nest.wave}/3 阶段`,point:ROAD_NEST,color:s.merchantRoad.nest.wave===3?'#87caae':'#df826e'});
 landmarks.push({name:'林间商路通商',detail:roadRouteStatus(s),point:{x:9560,y:1750},color:'#8de2df'});
 if(s.merchantRoad.opened)for(const [i,p]of ROAD_POSTS.entries())landmarks.push({name:p.name,detail:s.merchantRoad.guards.filter(g=>g.post===i&&g.arrived).length===2?'已驻守':'守备接岗途中',point:p,color:'#8de2df'});
 for(const d of ENCOUNTERS.filter(d=>d.kind==='camp')){
  const g=s.encounters.groups[d.id],status=g.cleared?'已清除':g.boss?.stage==='battle'?'首领交战':g.boss?.stage==='warning'?'首领待挑战':'驻守未清';
  landmarks.push({name:d.name,detail:status,point:{x:d.x,y:d.y},color:g.cleared?'#87caae':'#df826e',campId:d.id});
 }
 for(const sign of SERVICE_SIGNS)landmarks.push({name:sign.name,detail:'风铃村服务点',point:sign.point,color:'#8de2df'});
 for(const p of CITY_PROPS.filter(p=>p.id.startsWith('road-rest-')))landmarks.push({name:p.label!.split(' · ')[0],detail:'休整商路 · 保留已获及待领风赐',point:p,color:'#8de2df'});
 for(const b of CITY_BUILDINGS)landmarks.push({name:b.name,detail:b.private?'具名住宅 · 门口敲门拜访':'城市场所 · 门口进入',point:b.door,color:'#8de2df',below:true});
 for(const [i,n]of TRADE_ROAD_NODES.entries()){const progress=s.tradeRoad.nodes[i];landmarks.push({name:`${i+1} · ${n.name}`,detail:s.merchantRoad.opened?(progress?.cleared?'支路已清剿':'怪物退居支路 · 主路恢复通行'):progress?.cleared?'三波已清除':progress?.active?`第 ${progress.wave+1} / 3 波 · 已击退 ${progress.units.filter(u=>u.defeated).length} / 18`:'尚未触发 · 三波遭遇',point:tradeRoadAnchor(i,s.merchantRoad.opened),color:progress?.cleared?'#87caae':'#df826e'});}
 for(const [name,x,y]of [['西门驿站与集市',10500,2260],['风塔与中央广场',11790,1690],['东南住宅区',12820,2380],['议事与档案区',12900,660]] as const)landmarks.push({name,detail:'风语城街区',point:{x,y},color:'#c8c0a3'});
  for(const n of SHORTCUTS)landmarks.push({name:n.name,detail:s.mapProgress.shortcuts.includes(n.id)?'已修复':'待修复',point:n.barrier,color:'#e6c29b'});
 function updateLandmarks(){
  const local=landmarks.filter(l=>selected.id==='city'?l.point.x>=9490:selected.id==='road'?l.point.x>=4290&&l.point.x<9690:selected.id==='forest'?l.point.x<4290:false);
  element('map-landmark-list').innerHTML=local.map((l,i)=>`<button data-map-landmark="${i}"${l.campId?` data-camp-status="${l.campId}" data-cleared="${s.encounters.groups[l.campId].cleared}"`:''}><b>${l.name}</b><span>${l.detail}</span></button>`).join('')||'<p>此区域暂未开放。</p>';
  ui.modal.querySelectorAll<HTMLButtonElement>('[data-map-landmark]').forEach(b=>b.addEventListener('click',()=>{const l=local[Number(b.dataset.mapLandmark)];showInfo(l.name,l.detail,'地点已在地图中定位。');element<HTMLButtonElement>('atlas-enter').disabled=true;animateTo({...camera,...l.point,scale:Math.max(camera.scale,size.width/3000)});},{signal}));
 }
 const tracked=windMemoryTracked(s)??roadTracked(s)??legacyTracked(s);
 function draw(){
  if(closed||size.width<2||size.height<2)return;
  const begin=performance.now(),dpr=Math.min(window.devicePixelRatio||1,2);
  const w=Math.round(size.width*dpr),h=Math.round(size.height*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,size.width,size.height);ctx.fillStyle='#163746';ctx.fillRect(0,0,size.width,size.height);
  if(ocean){ctx.fillStyle=ctx.createPattern(ocean,'repeat')!;ctx.fillRect(0,0,size.width,size.height);}
  terrain?.draw(ctx,camera,size);
  if(edgeMist){ctx.save();ctx.globalAlpha=.22;ctx.drawImage(edgeMist,0,0,size.width,size.height);ctx.restore();}
  hits=[];const occupied:{left:number;top:number;width:number;height:number}[]=[];
  const label=(name:string,point:MapPoint,color:string,subtitle='',r?:AtlasRegion,detail?:string,priority=false,below=false)=>{
   const p=mapToScreen(point,camera,size);if(p.x<0||p.y<0||p.x>size.width||p.y>size.height)return;
   const fontSize=r?size.width<600?14:17:13;
   ctx.font=`600 ${fontSize}px "Songti SC", "Noto Serif SC", serif`;
   const width=Math.min(size.width-16,Math.max(ctx.measureText(name).width+24,subtitle?ctx.measureText(subtitle).width+18:0)),height=subtitle?44:27;
   const left=Math.max(8,Math.min(size.width-width-8,p.x-width/2));
   const candidates=(below?[p.y+12,p.y+46,p.y-height-47,p.y-height-13]:[p.y-height-13,p.y+12,p.y-height-47,p.y+46]).map(y=>Math.max(8,Math.min(size.height-height-8,y)));
   const free=(top:number)=>!occupied.some(b=>left<b.left+b.width+5&&left+width+5>b.left&&top<b.top+b.height+5&&top+height+5>b.top);
   const top=priority?candidates[0]:(candidates.find(free)??candidates[0]);
   ctx.save();
   if(priority&&playerMarker){ctx.shadowColor='#efd484';ctx.shadowBlur=10;ctx.drawImage(playerMarker,p.x-11,p.y-11,22,22);ctx.shadowBlur=0;ctx.beginPath();ctx.arc(p.x,p.y,18,0,Math.PI*2);ctx.strokeStyle='#f1d68a99';ctx.lineWidth=1;ctx.stroke();}
   else{ctx.fillStyle=color;ctx.beginPath();ctx.arc(p.x,p.y,r?5:4,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#142d36';ctx.lineWidth=2;ctx.stroke();}
   if(r===selected){ctx.beginPath();ctx.arc(p.x,p.y,25,0,Math.PI*2);ctx.strokeStyle=color+'88';ctx.lineWidth=1;ctx.stroke();}
   ctx.restore();
   if(!priority&&!free(top))return;
   occupied.push({left,top,width,height});ctx.save();ctx.textAlign='center';ctx.lineJoin='round';ctx.strokeStyle=r?.status==='未知'?'#241630cc':'#102c36bb';ctx.lineWidth=4;ctx.shadowColor='#10232d';ctx.shadowBlur=6;
   ctx.strokeText(name,left+width/2,top+18,width-14);ctx.fillStyle=r&&available(r)?'#f1dfae':'#f4eedb';ctx.fillText(name,left+width/2,top+18,width-14);
   if(subtitle){ctx.font='12px sans-serif';ctx.strokeText(subtitle,left+width/2,top+35,width-12);ctx.fillStyle=color;ctx.fillText(subtitle,left+width/2,top+35,width-12);}ctx.restore();
   hits.push({left,top,width,height,region:r,name,detail});
  };
  label(s.life.playerSpace==='village'?'主角':'主角 · 室外入口',player,'#f1d68a','',undefined,'当前位置',true);
  if(tracked)label(tracked.name,tracked.point,'#f1d68a','追踪目标');
  const worldLevel=camera.scale<=minimumScale(size)*1.025;
  panel.classList.toggle('world-level',worldLevel);
  const viewWidth=size.width/camera.scale;
  if(viewWidth>18000){
   for(const r of ATLAS_REGIONS)label(r.name,r.point,r.status==='未知'?'#af8cc8':available(r)?'#f1d68a':'#aabec8',r.status==='未知'?'':r.status,r);
  }else{
   for(const l of landmarks)label(l.name,l.point,l.color,viewWidth<4800?l.detail:'',undefined,l.detail,false,l.below);
   if(viewWidth<3000){
    for(const b of BUILDING_LOTS.filter(b=>!SERVICE_SIGNS.some(n=>n.building===b.id)))label(b.name,{x:b.x,y:b.y},'#c8c0a3');
   }
   if(camera.scale<.3)for(const r of MAP_REGIONS.filter(r=>r.id!=='trade-road'&&r.id!=='wind-city')){
    const x=r.polygon.reduce((v,p)=>v+p.x,0)/r.polygon.length,y=r.polygon.reduce((v,p)=>v+p.y,0)/r.polygon.length;
    label(r.name,{x,y},'#cad3b6');
   }
   const xb=s.xiaobao,point=xb.space==='village'?xb:((cityBuilding(xb.space)??HOMES.find(h=>h.id===xb.space))?.door??xb);label('小宝',point,'#b3e5c8');
   for(const r of ATLAS_REGIONS)if(!available(r))label(r.name,r.point,r.status==='未知'?'#af8cc8':'#aabec8',r.status==='未知'?'':'暂未开放',r);
  }
  ctx.textAlign='start';
  element('map-level').textContent=worldLevel?'世界全貌':viewWidth<2400?'局部细节':'区域地图';
  element('map-distance').textContent=`视野宽度 · 约 ${Math.round(size.width/camera.scale).toLocaleString('zh-CN')} 单位`;
  element<HTMLButtonElement>('map-zoom-out').disabled=camera.scale<=minimumScale(size)*1.001;
  element<HTMLButtonElement>('map-zoom-in').disabled=camera.scale>=maximumScale(size)*.999;
  canvas.dataset.area=area;canvas.dataset.centerX=String(camera.x);canvas.dataset.centerY=String(camera.y);canvas.dataset.scale=String(camera.scale);canvas.dataset.minScale=String(minimumScale(size));canvas.dataset.maxScale=String(maximumScale(size));canvas.dataset.playerX=String(player.x);canvas.dataset.playerY=String(player.y);
  canvas.dataset.viewportWidth=String(size.width);canvas.dataset.viewportHeight=String(size.height);
  samples.push(performance.now()-begin);if(samples.length>240)samples.shift();
  const sorted=[...samples].sort((a,b)=>a-b);canvas.dataset.performance=JSON.stringify({绘制次数:samples.length,平均绘制毫秒:samples.reduce((a,b)=>a+b,0)/samples.length,P95绘制毫秒:sorted[Math.floor((sorted.length-1)*.95)],...terrain?.stats()});
 }
 const resetPointers=()=>{for(const id of pointers.keys())if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);pointers.clear();pressPoint=null;canvas.classList.remove('is-dragging');};
 const point=(e:{clientX:number;clientY:number})=>{const b=canvas.getBoundingClientRect();return {x:(e.clientX-b.left)*size.width/b.width,y:(e.clientY-b.top)*size.height/b.height};};
 canvas.addEventListener('wheel',e=>{e.preventDefault();const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?size.height:1);zoom(Math.exp(-Math.max(-200,Math.min(200,delta))*.003),point(e));},{passive:false,signal});
 canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();cancelMotion();focusBounds=null;canvas.focus({preventScroll:true});const p=point(e);pointers.set(e.pointerId,p);canvas.setPointerCapture(e.pointerId);if(pointers.size===1){gestureMoved=false;pressPoint=p;}else gestureMoved=true;canvas.classList.add('is-dragging');},{signal});
 canvas.addEventListener('pointermove',e=>{
  const old=pointers.get(e.pointerId);if(!old)return;const next=point(e);
  if(pointers.size>=2){
   const other=[...pointers.entries()].find(([id])=>id!==e.pointerId)![1],oldCenter={x:(old.x+other.x)/2,y:(old.y+other.y)/2},newCenter={x:(next.x+other.x)/2,y:(next.y+other.y)/2};
   const distance=Math.hypot(old.x-other.x,old.y-other.y),newDistance=Math.hypot(next.x-other.x,next.y-other.y);
   if(distance>5)camera=zoomMap(camera,newDistance/distance,oldCenter,size);
   camera=panMap(camera,newCenter.x-oldCenter.x,newCenter.y-oldCenter.y,size);gestureMoved=true;
  }else{camera=panMap(camera,next.x-old.x,next.y-old.y,size);if(pressPoint&&Math.hypot(next.x-pressPoint.x,next.y-pressPoint.y)>6)gestureMoved=true;}
  pointers.set(e.pointerId,next);redraw();
 },{signal});
 canvas.addEventListener('pointerup',e=>{
  const p=point(e),tap=!gestureMoved&&pointers.size===1&&pointers.has(e.pointerId);pointers.delete(e.pointerId);if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
  if(!pointers.size){pressPoint=null;canvas.classList.remove('is-dragging');}
  if(tap){const h=[...hits].reverse().find(h=>p.x>=h.left&&p.x<=h.left+h.width&&p.y>=h.top&&p.y<=h.top+h.height);if(h?.region)select(h.region);else if(h?.name){showInfo(h.name,h.detail??'地图地点','地图标记对应真实旅途位置。');element<HTMLButtonElement>('atlas-enter').disabled=true;}}
 },{signal});
 canvas.addEventListener('pointercancel',resetPointers,{signal});canvas.addEventListener('lostpointercapture',e=>{pointers.delete(e.pointerId);if(!pointers.size)canvas.classList.remove('is-dragging');},{signal});
 window.addEventListener('blur',resetPointers,{signal});document.addEventListener('visibilitychange',()=>{if(document.hidden)resetPointers();},{signal});
 canvas.addEventListener('keydown',e=>{
  if(['+','=','-','_','Home','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();e.stopPropagation();cancelMotion();focusBounds=null;
   if(e.key==='Home')animateTo(fitCurrentArea(player,size),currentMapBounds(player));
   else if(e.key==='+'||e.key==='=')zoom(1.35);else if(e.key==='-'||e.key==='_')zoom(1/1.35);
   else{camera=panMap(camera,e.key==='ArrowLeft'?80:e.key==='ArrowRight'?-80:0,e.key==='ArrowUp'?80:e.key==='ArrowDown'?-80:0,size);redraw();}
  }
 },{signal});
 ui.button('map-zoom-in',()=>zoom(1.35));ui.button('map-zoom-out',()=>zoom(1/1.35));
 ui.button('map-world',()=>animateTo(fitMap(CONTINENT,size,1),CONTINENT));
 ui.button('map-current',()=>{select(initial,false);animateTo(fitCurrentArea(player,size),currentMapBounds(player));});
 ui.button('map-locate',()=>animateTo({...camera,...player,scale:Math.max(camera.scale,fitCurrentArea(player,size).scale)}));
 ui.button('atlas-enter',()=>{if(available(selected))animateTo(fitMap(selected.bounds,size),selected.bounds);});
 const directory=(open:boolean)=>{element('map-directory-panel').hidden=!open;panel.classList.toggle('directory-open',open);element('map-directory-toggle').setAttribute('aria-expanded',String(open));if(open){element<HTMLDetailsElement>('atlas-directory').open=true;element('map-directory-close').focus();}else element('map-directory-toggle').focus();};
 ui.button('map-directory-toggle',()=>directory(element('map-directory-panel').hidden!==false));ui.button('map-directory-close',()=>directory(false));
 ui.modal.querySelectorAll<HTMLButtonElement>('[data-atlas-region]').forEach(b=>b.addEventListener('click',()=>select(ATLAS_REGIONS.find(r=>r.id===b.dataset.atlasRegion)! ),{signal}));
 element('close').addEventListener('click',e=>{if(e.detail>0)ui.returnFocus=null;ui.close();},{signal});updateSelection();
 const resize=new ResizeObserver(()=>{
  const box=canvas.getBoundingClientRect(),next={width:Math.max(1,Math.round(box.width)),height:Math.max(1,Math.round(box.height))};
  if(next.width===size.width&&next.height===size.height)return;
  cancelMotion();resetPointers();const previous=size;size=next;
  camera=previous.width===1?fitCurrentArea(player,size):focusBounds?fitMap(focusBounds,size,focusBounds===CONTINENT?1:.9):clampCamera({...camera,scale:camera.scale*minimumScale(size)/minimumScale(previous)},size);redraw();
 });resize.observe(canvas);
 ui.previewCleanup=()=>{closed=true;abort.abort();resize.disconnect();cancelAnimationFrame(renderFrame);cancelMotion();resetPointers();terrain?.dispose();if(worldBackdrop)worldBackdrop.width=worldBackdrop.height=0;canvas.width=canvas.height=0;};
 void Promise.all([loadImage('/assets/world-map/aligned/materials.webp'),loadImage('/assets/world-map/aligned/continent.webp'),loadImage('/assets/world-map/aligned/symbols.webp'),loadCityMapArt()]).then(([materials,world,symbols,cityArt])=>{
  if(closed)return;
  // 仅柔化原图最外侧海域的显示接缝，导航几何和原图资源不变。
  worldBackdrop=document.createElement('canvas');worldBackdrop.width=world.naturalWidth;worldBackdrop.height=world.naturalHeight;
  const backdrop=worldBackdrop.getContext('2d')!;backdrop.drawImage(world,0,0);backdrop.globalCompositeOperation='destination-in';
  const w=worldBackdrop.width,h=worldBackdrop.height,edge=24;
  for(const [x0,y0,x1,y1]of [[0,0,edge,0],[w,0,w-edge,0],[0,0,0,edge],[0,h,0,h-edge]]){const mask=backdrop.createLinearGradient(x0,y0,x1,y1);mask.addColorStop(0,'#0000');mask.addColorStop(1,'#000');backdrop.fillStyle=mask;backdrop.fillRect(0,0,w,h);}
  if(new URLSearchParams(location.search).has('combatObservation'))element('world-map').setAttribute('data-city-art',JSON.stringify(Object.entries(cityArt).map(([id,image])=>({素材:id,宽:image.width,高:image.height}))));terrain=createMapTerrain(materials,worldBackdrop,96,symbols,cityArt);element('map-loading').hidden=true;redraw();
 }).catch(()=>{if(!closed)element('map-loading').textContent='地图素材加载失败，请关闭后重新打开。';});
 void Promise.all([loadImage('/assets/map-ui/icons/player-navigation.svg'),loadImage('/assets/map-ui/edge-mist.webp')]).then(([marker,mist])=>{if(!closed){playerMarker=marker;edgeMist=mist;redraw();}}).catch(()=>{/* 装饰不可用时仍保持地图可操作。 */});
 void loadImage('/assets/world-map/aligned/ocean.webp').then(image=>{if(!closed){ocean=image;redraw();}}).catch(()=>{/* 海域留白仍有纯色背景。 */});
 ui.focusPanel('map-current');
}
