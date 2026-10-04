import {WORLD,WATERS,BRIDGES,roads,roadWidth,props,mapGeometryRevision} from '../../data/world';
import {MAP_REGIONS,VILLAGE_WALLS} from '../../data/village';
import {BUILDING_LOTS} from '../../data/maps/windbell/layout';
import {CITY_PROPS} from '../../data/maps/windwhisper';
import {CITY_BUILDINGS} from '../../data/cityLayout';
import type {CityMapArt} from './cityMapArt';
import {CONTINENT,type MapCamera,type MapSize} from './mapViewport';

// imagegen 材质按真实几何裁剪；概念图中的虚构道路、屋顶不会进入已开放区域。
export function createMapTerrain(materials:HTMLImageElement,artwork:HTMLImageElement|HTMLCanvasElement,cacheLimit=96,symbols?:HTMLImageElement,cityArt?:CityMapArt){
 const continental=!!symbols;
 const cells=Array.from({length:12},(_,i)=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  canvas.getContext('2d')!.drawImage(materials,i%4*materials.naturalWidth/4,Math.floor(i/4)*materials.naturalHeight/3,materials.naturalWidth/4,materials.naturalHeight/3,0,0,256,256);
  return canvas;
 });
 const stamps=symbols?Array.from({length:8},(_,i)=>{
  const cell=document.createElement('canvas');cell.width=cell.height=256;
  cell.getContext('2d')!.drawImage(symbols,i%4*symbols.naturalWidth/4,Math.floor(i/4)*symbols.naturalHeight/2,symbols.naturalWidth/4,symbols.naturalHeight/2,0,0,256,256);return cell;
 }):[];
 const cache=new Map<string,{features:HTMLCanvasElement;ground?:HTMLCanvasElement}>();
 // 高倍率的草地细节使用同一坐标下的柔和生态范围，不形成世界边界矩形。
 const field={x:WORLD.left+WORLD.width/2,y:WORLD.top+WORLD.height/2,rx:WORLD.width/2+1600,ry:WORLD.height/2+2200};
 const paintGround=(x:number,y:number,span:number,resolution:number)=>{
  const tile=document.createElement('canvas');tile.width=tile.height=Math.round(span*resolution);
  const c=tile.getContext('2d')!;c.setTransform(resolution,0,0,resolution,-x*resolution,-y*resolution);
  const pattern=c.createPattern(cells[0],'repeat')!;pattern.setTransform(new DOMMatrix().scale(560/256));
  c.fillStyle=pattern;c.fillRect(x,y,span,span);
  c.fillStyle='#c5d28c';c.globalAlpha=.38;c.fillRect(x,y,span,span);c.globalAlpha=1;
  c.globalCompositeOperation='destination-in';c.translate(field.x,field.y);c.scale(field.rx,field.ry);
  const mask=c.createRadialGradient(0,0,0,0,0,1);mask.addColorStop(0,'#000');mask.addColorStop(.5,'#000');mask.addColorStop(1,'#0000');
  c.fillStyle=mask;c.fillRect(-2,-2,4,4);return tile;
 };
 const cityDraws=new Map<string,unknown>();let generated=0,peak=0;
 const paint=(x:number,y:number,span:number,resolution:number)=>{
  const tile=document.createElement('canvas');tile.width=tile.height=Math.round(span*resolution);
  const c=tile.getContext('2d')!;c.setTransform(resolution,0,0,resolution,-x*resolution,-y*resolution);
  const texture=(index:number,units=420)=>{const p=c.createPattern(cells[index],'repeat')!;p.setTransform(new DOMMatrix().scale(units/256));return p;};
  const visible=(left:number,top:number,width:number,height:number)=>left<x+span+180&&left+width>x-180&&top<y+span+180&&top+height>y-180;
  const stamp=(index:number,left:number,top:number,width:number,height:number)=>c.drawImage(stamps[index],48,48,160,160,left,top,width,height);
  // 世界地图只叠加真实地物，透明空地直接透出同一张大陆基底。
  // HUD 的纯色底稿继续使用原有完整地表，不扩大此次修改范围。
  if(!continental){c.fillStyle=texture(0,620);c.fillRect(x,y,span,span);}
  // 轻柔融合区域地表，几何边界不变；保留原野的大片可步行草地。
  for(const r of continental?[]:MAP_REGIONS){
   const left=Math.min(...r.polygon.map(p=>p.x)),top=Math.min(...r.polygon.map(p=>p.y)),width=Math.max(...r.polygon.map(p=>p.x))-left,height=Math.max(...r.polygon.map(p=>p.y))-top;
   if(!visible(left,top,width,height)||r.id==='village')continue;
   c.save();c.beginPath();r.polygon.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.clip();
   c.globalAlpha=r.id==='wind-city'?.2:r.id==='west'||r.id==='south'?.28:.3;
   c.fillStyle=texture(r.id==='wind-city'?4:r.id==='west'?1:r.id==='south'?2:r.id==='ruins'?7:3,680);c.fillRect(x,y,span,span);c.restore();
  }
  // 林木与岩石沿用真实场景登记；道路随后覆盖，保持路线可辨。
  for(const p of props){
   if(!['tree','pink','rock','pine','tree-pine','tree-autumn'].includes(p.art))continue;
   const radius=p.art==='rock'?Math.min(110,p.w*.35):Math.min(95,p.w*.32);
   if(!visible(p.x-radius,p.y-radius,radius*2,radius*2))continue;
   if(continental){stamp(p.art==='rock'?2:p.art.includes('pine')?1:0,p.x-radius*1.5,p.y-radius*1.6,radius*3,radius*3);continue;}
   c.save();c.shadowColor='#172d3260';c.shadowBlur=12;c.shadowOffsetY=8;
   c.beginPath();c.ellipse(p.x,p.y-radius*.35,radius,radius*.82,0,0,Math.PI*2);c.fillStyle=texture(p.art==='rock'?7:11,180);c.fill();c.restore();
  }
  // 先绘制道路再盖真实水域，桥面最后覆盖；重叠水域不会产生反向孔洞。
  for(const [i,path]of roads.entries()){
   const xs=path.map(p=>p[0]),ys=path.map(p=>p[1]),pad=roadWidth(i)/2;
   if(!visible(Math.min(...xs)-pad,Math.min(...ys)-pad,Math.max(...xs)-Math.min(...xs)+pad*2,Math.max(...ys)-Math.min(...ys)+pad*2))continue;
   c.beginPath();path.forEach(([px,py],j)=>j?c.lineTo(px,py):c.moveTo(px,py));c.lineCap='round';c.lineJoin='round';
   c.lineWidth=roadWidth(i)+12;c.strokeStyle='#757b6060';c.stroke();
   c.lineWidth=roadWidth(i);c.strokeStyle=texture(path.some(([px])=>px>9690)?4:5,180);c.stroke();
  }
  for(const p of WATERS){
   if(!visible(p.x-p.rx,p.y-p.ry,p.rx*2,p.ry*2))continue;
   c.beginPath();c.ellipse(p.x,p.y,p.rx+12,p.ry+12,0,0,Math.PI*2);c.fillStyle='#c5c09a';c.fill();
   c.beginPath();c.ellipse(p.x,p.y,p.rx,p.ry,0,0,Math.PI*2);c.fillStyle=texture(6,500);c.fill();c.strokeStyle='#2f6579';c.lineWidth=7;c.stroke();
  }
  for(const p of BRIDGES){
   if(!visible(p.x,p.y,p.w,p.h))continue;
   const stone=p.x>4290;
   c.fillStyle=texture(stone?4:10,160);c.fillRect(p.x,p.y,p.w,p.h);
   c.strokeStyle=stone?'#525a50':'#655c4b';c.lineWidth=8;c.strokeRect(p.x,p.y,p.w,p.h);
   c.strokeStyle=stone?'#d4d0b4':'#b19a6b';c.lineWidth=14;
   for(const y of [p.y+10,p.y+p.h-10]){c.beginPath();c.moveTo(p.x,y);c.lineTo(p.x+p.w,y);c.stroke();}
   if(stone)for(const x of [p.x+10,p.x+p.w-10])for(const y of [p.y+10,p.y+p.h-10]){c.fillStyle='#e2dcc0';c.fillRect(x-14,y-14,28,28);c.strokeStyle='#525a50';c.lineWidth=5;c.strokeRect(x-14,y-14,28,28);}
  }
  c.strokeStyle=texture(9,100);c.lineWidth=28;c.lineCap='square';
  for(const wall of VILLAGE_WALLS){c.beginPath();c.moveTo(wall.a.x,wall.a.y);c.lineTo(wall.b.x,wall.b.y);c.stroke();}
  for(const p of CITY_PROPS.filter(p=>p.solid&&(p.id.includes('wall')||p.id.includes('edge')))){
   const w=p.solid![0],h=p.solid![1];if(!visible(p.x-w/2,p.y-h,w,h))continue;
   c.fillStyle=texture(9,110);c.fillRect(p.x-w/2,p.y-h,w,h);c.strokeStyle='#425658';c.lineWidth=5;c.strokeRect(p.x-w/2,p.y-h,w,h);
  }
  const buildings=[...BUILDING_LOTS,...(cityArt?[]:CITY_PROPS.filter(p=>p.solid&&p.id.startsWith('city-building-')))];
  for(const p of buildings){
   if(continental){
    // solid 是建筑底部碰撞盒，不是屋顶比例；地图符号以真实位置为锚点，保留素材比例。
    const size=p.w*.9,left=p.x-size/2,top=p.y-p.solid![1]/2-size/2;
    if(visible(left,top,size,size))stamp(p.id==='city-building-tower'?5:p.id==='city-building-underground'?2:p.id.includes('tower')?4:3,left,top,size,size);
    continue;
   }
   const w=p.solid![0],h=p.solid![1],left=p.x-w/2,top=p.y-h;if(!visible(left,top,w,h))continue;
   c.save();c.shadowColor='#26333188';c.shadowBlur=9;c.shadowOffsetY=7;
   c.fillStyle=texture(p.id==='city-underground'?7:8,90);c.fillRect(left,top,w,h);c.restore();
   c.strokeStyle='#513f35';c.lineWidth=5;c.strokeRect(left,top,w,h);
   c.beginPath();c.moveTo(left,top+h/2);c.lineTo(left+w,top+h/2);c.strokeStyle='#dbc499';c.lineWidth=3;c.stroke();
  }
  // 外沿柔和融入大陆底图；所有倍率使用相同的世界坐标羽化宽度。
  if(!continental){c.globalCompositeOperation='destination-in';
  const edges=[[WORLD.left,0,WORLD.left+160,0],[WORLD.right,0,WORLD.right-160,0],[0,WORLD.top,0,WORLD.top+160],[0,WORLD.bottom,0,WORLD.bottom-160]];
  for(const [x0,y0,x1,y1]of edges){const g=c.createLinearGradient(x0,y0,x1,y1);g.addColorStop(0,'#0000');g.addColorStop(1,'#000');c.fillStyle=g;c.fillRect(x,y,span,span);}
  c.globalCompositeOperation='source-over';}generated++;return tile;
 };
 return {
  draw(c:CanvasRenderingContext2D,camera:MapCamera,size:MapSize){
   c.save();c.translate(size.width/2,size.height/2);c.scale(camera.scale,camera.scale);c.translate(-camera.x,-camera.y);
   c.drawImage(artwork,CONTINENT.left,CONTINENT.top,CONTINENT.width,CONTINENT.height);
   const marginX=continental?1600:0,marginY=continental?2200:0;
   c.beginPath();c.rect(WORLD.left-marginX,WORLD.top-marginY,WORLD.width+marginX*2,WORLD.height+marginY*2);c.clip();
   const span=camera.scale>.2?512:2048,resolution=camera.scale>.6?1:camera.scale>.2?.5:.125;
   const left=Math.max(WORLD.left-marginX,camera.x-size.width/camera.scale/2),top=Math.max(WORLD.top-marginY,camera.y-size.height/camera.scale/2);
   const right=Math.min(WORLD.right+marginX,camera.x+size.width/camera.scale/2),bottom=Math.min(WORLD.bottom+marginY,camera.y+size.height/camera.scale/2);
   const groundAlpha=Math.max(0,Math.min(1,(camera.scale-.05)/.15));
   for(let y=Math.floor(top/span)*span;y<bottom;y+=span)for(let x=Math.floor(left/span)*span;x<right;x+=span){
    const key=`${mapGeometryRevision}:${span}:${resolution}:${x}:${y}`;
    let tile=cache.get(key);if(tile){cache.delete(key);cache.set(key,tile);}else{tile={features:paint(x,y,span,resolution)};cache.set(key,tile);}
    if(continental&&groundAlpha>0){
     tile.ground??=paintGround(x,y,span,resolution);c.save();c.globalAlpha=groundAlpha;c.drawImage(tile.ground,x,y,span,span);c.restore();
    }
    c.drawImage(tile.features,x,y,span,span);
    while(cache.size>cacheLimit){const old=cache.keys().next().value!;const released=cache.get(old)!;cache.delete(old);for(const c of [released.features,released.ground])if(c)c.width=c.height=0;}
   }
   // 独立绘制地标，避免低倍率瓦片反复缩放损失细节；入口文字放在门点下方。
   if(cityArt)for(const b of [...CITY_BUILDINGS].sort((a,b)=>a.y-b.y)){const asset=cityArt[b.art];if(!asset)continue;const width=b.w*.8,height=width*asset.height/asset.width;
    cityDraws.set(b.id,{地点:b.id,x:b.x,y:b.y,宽:width,高:height});c.drawImage(asset.image,b.x-width/2,b.y-height,width,height);
   }
   peak=Math.max(peak,cache.size);c.restore();
  },
  stats:()=>({生成块数:generated,缓存块数:cache.size,缓存峰值:peak,城市建筑:[...cityDraws.values()]}),
  dispose(){for(const tile of cache.values())for(const c of [tile.features,tile.ground])if(c)c.width=c.height=0;for(const c of [...cells,...stamps])c.width=c.height=0;cache.clear();},
 };
}
