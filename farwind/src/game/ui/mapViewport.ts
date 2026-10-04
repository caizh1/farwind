import {WIND_BELL_BOUNDS} from '../../data/maps/windbell/bounds';
import {WORLD_MAP_EXTENT} from '../../data/worldPlan';
export type MapPoint={x:number;y:number};
export type MapRect={left:number;top:number;width:number;height:number};
export type MapSize={width:number;height:number};
export type MapCamera=MapPoint&{scale:number};
// 仅供大陆展示，不能参与玩家、掉落、导航或存档坐标校验。
export const CONTINENT:MapRect=WORLD_MAP_EXTENT;
export const MAP_AREAS={
 plains:{name:'风铃原野',bounds:WIND_BELL_BOUNDS},
 road:{name:'林间商路',bounds:{left:4290,top:600,width:5400,height:1900}},
 city:{name:'风语城',bounds:{left:9490,top:-400,width:4400,height:3200}},
} as const;
export function currentMapArea(p:MapPoint){return p.x>=9690?'city':p.x>=4290?'road':'plains';}
export function minimumScale(size:MapSize){return Math.min(size.width/CONTINENT.width,size.height/CONTINENT.height);}
export function maximumScale(size:MapSize){return Math.max(minimumScale(size),size.width/1000);}
export function clampCamera(camera:MapCamera,size:MapSize):MapCamera{
 const scale=Math.min(maximumScale(size),Math.max(minimumScale(size),camera.scale));
 const axis=(center:number,start:number,length:number,pixels:number)=>{
  const half=pixels/scale/2;
  return half*2>=length?start+length/2:Math.max(start+half,Math.min(start+length-half,center));
 };
 return {x:axis(camera.x,CONTINENT.left,CONTINENT.width,size.width),y:axis(camera.y,CONTINENT.top,CONTINENT.height,size.height),scale};
}
export function fitMap(bounds:MapRect,size:MapSize,padding=.9):MapCamera{
 return clampCamera({x:bounds.left+bounds.width/2,y:bounds.top+bounds.height/2,scale:Math.min(size.width/bounds.width,size.height/bounds.height)*padding},size);
}
export function currentMapBounds(point:MapPoint):MapRect{
 const b=MAP_AREAS[currentMapArea(point)].bounds;
 const left=Math.min(b.left,point.x-120),top=Math.min(b.top,point.y-120);
 return {left,top,width:Math.max(b.left+b.width,point.x+120)-left,height:Math.max(b.top+b.height,point.y+120)-top};
}
export function fitCurrentArea(point:MapPoint,size:MapSize):MapCamera{
 return fitMap(currentMapBounds(point),size);
}
export function mapToScreen(point:MapPoint,camera:MapCamera,size:MapSize):MapPoint{
 return {x:(point.x-camera.x)*camera.scale+size.width/2,y:(point.y-camera.y)*camera.scale+size.height/2};
}
export function screenToMap(point:MapPoint,camera:MapCamera,size:MapSize):MapPoint{
 return {x:camera.x+(point.x-size.width/2)/camera.scale,y:camera.y+(point.y-size.height/2)/camera.scale};
}
export function zoomMap(camera:MapCamera,factor:number,anchor:MapPoint,size:MapSize):MapCamera{
 const world=screenToMap(anchor,camera,size),scale=Math.max(minimumScale(size),Math.min(maximumScale(size),camera.scale*factor));
 return clampCamera({x:world.x-(anchor.x-size.width/2)/scale,y:world.y-(anchor.y-size.height/2)/scale,scale},size);
}
export function panMap(camera:MapCamera,dx:number,dy:number,size:MapSize):MapCamera{
 return clampCamera({...camera,x:camera.x-dx/camera.scale,y:camera.y-dy/camera.scale},size);
}
