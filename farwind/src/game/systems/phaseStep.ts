import type { Point } from './obstacles';

// 一次性落在最远安全点；物理坐标从不进入障碍，受击和保存无需清理穿墙状态。
// 最多检查现有瞬步的90个像素，不延长距离，不绕路，不跨越硬边界。
export function phaseStepDestination(origin: Point, end: Point,
  blocked: (x:number,y:number)=>boolean,
  hardClear: (a:Point,b:Point)=>boolean,
  normalClear: (a:Point,b:Point)=>boolean): Point | null {
  if(normalClear(origin,end)&&!blocked(end.x,end.y))return null;
  const distance=Math.hypot(end.x-origin.x,end.y-origin.y),steps=Math.ceil(distance);
  for(let i=steps;i>0;i--){
    const t=i/steps,p={x:origin.x+(end.x-origin.x)*t,y:origin.y+(end.y-origin.y)*t};
    if(!blocked(p.x,p.y)&&hardClear(origin,p))return p;
  }
  return {...origin};
}
