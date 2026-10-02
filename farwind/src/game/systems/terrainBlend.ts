export type TerrainBounds = {left:number;right:number;top:number;bottom:number};
export type TerrainPoint = readonly [number,number];
export type TerrainSegment = TerrainBounds & {x:number;y:number;dx:number;dy:number;lengthSquared:number;radius:number};

// 边缘起伏固定在世界坐标上，生成和淘汰地面块都不会使纹理跳动。
export function terrainJitter(x:number,y:number){
  return Math.sin(x/31+y/43)*3+Math.sin(x/13-y/19)*1.5;
}
export function featherCoverage(distance:number,width:number){
  const t=Math.max(0,Math.min(1,(distance+width)/(width*2)));
  return t*t*(3-2*t);
}
export function terrainBounds(points:readonly TerrainPoint[],pad=0):TerrainBounds{
  return {left:Math.min(...points.map(p=>p[0]))-pad,right:Math.max(...points.map(p=>p[0]))+pad,top:Math.min(...points.map(p=>p[1]))-pad,bottom:Math.max(...points.map(p=>p[1]))+pad};
}
export function terrainSegments(points:readonly TerrainPoint[],width:number):TerrainSegment[]{
  return points.slice(1).map((b,i)=>{
    const a=points[i],dx=b[0]-a[0],dy=b[1]-a[1],radius=width/2;
    return {...terrainBounds([a,b],radius),x:a[0],y:a[1],dx,dy,lengthSquared:dx*dx+dy*dy,radius};
  });
}
function segmentDistanceSquared(x:number,y:number,s:TerrainSegment){
  const t=Math.max(0,Math.min(1,((x-s.x)*s.dx+(y-s.y)*s.dy)/(s.lengthSquared||1)));
  const dx=x-s.x-t*s.dx,dy=y-s.y-t*s.dy;
  return dx*dx+dy*dy;
}
// 所有路段先取并集，再羽化一次；路口不会出现内部描边或重复半透明叠加。
export function strokeCoverage(x:number,y:number,segments:readonly TerrainSegment[],feather:number){
  let distance=-Infinity;
  for(const s of segments){
    const margin=feather+4.5;
    if(x<s.left-margin||x>s.right+margin||y<s.top-margin||y>s.bottom+margin)continue;
    const squared=segmentDistanceSquared(x,y,s),core=Math.max(0,s.radius-margin);
    if(core>0&&squared<=core*core)return 1;
    if(squared<(s.radius+margin)**2)distance=Math.max(distance,s.radius-Math.sqrt(squared));
  }
  return distance===-Infinity?0:featherCoverage(distance+terrainJitter(x,y),feather);
}
export function ellipseDistance(x:number,y:number,p:{x:number;y:number;rx:number;ry:number}){
  const nx=(x-p.x)/p.rx,ny=(y-p.y)/p.ry,r=Math.sqrt(nx*nx+ny*ny),gx=nx/p.rx,gy=ny/p.ry;
  return r<1e-8?Math.min(p.rx,p.ry):(1-r)*r/Math.sqrt(gx*gx+gy*gy);
}
export function polygonDistance(x:number,y:number,edges:readonly TerrainSegment[]){
  let inside=false,squared=Infinity;
  for(const s of edges){
    const by=s.y+s.dy;
    if((s.y>y)!==(by>y)&&x<s.x+(y-s.y)*s.dx/s.dy)inside=!inside;
    squared=Math.min(squared,segmentDistanceSquared(x,y,s));
  }
  return (inside?1:-1)*Math.sqrt(squared);
}
