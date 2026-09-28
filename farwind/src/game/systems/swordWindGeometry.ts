import {WORLD_PLAYABLE as B} from "../../data/maps/windbell/bounds";
import {
  props,
  propBounds,
  type Prop,
} from "../../data/world";
import { TRAINING, FIELD_TARGETS } from "./training";
import type { Point, Rect } from "./obstacles";
const EPS = 1e-8;
// 包含起始重叠及擦边，返回可与敌人接触比较的路径参数。
export function firstRectContact(a: Point, b: Point, r: Rect): number | null {
  let lo = 0,
    hi = 1;
  for (const [start, delta, min, max] of [
    [a.x, b.x - a.x, r.left, r.right],
    [a.y, b.y - a.y, r.top, r.bottom],
  ]) {
    if (Math.abs(delta) < EPS) {
      if (start < min - EPS || start > max + EPS) return null;
    } else {
      const p = (min - start) / delta,
        q = (max - start) / delta;
      lo = Math.max(lo, Math.min(p, q));
      hi = Math.min(hi, Math.max(p, q));
      if (lo > hi + EPS) return null;
    }
  }
  return lo <= 1 + EPS && hi >= -EPS ? Math.max(0, lo) : null;
}
export function sweptTargetContact(
  a: Point,
  b: Point,
  old: Point,
  current: Point,
  radius: number,
): number | null {
  const x = a.x - old.x,
    y = a.y - old.y,
    dx = b.x - a.x - current.x + old.x,
    dy = b.y - a.y - current.y + old.y;
  const c = x * x + y * y - radius * radius;
  if (c <= EPS) return 0;
  const q = dx * dx + dy * dy;
  if (q < EPS) return null;
  // 以垂距求交，避免高速轨迹恰好擦边时两个大数相减丢失精度。
  const cross = x * dy - y * dx,
    perpendicular = (cross * cross) / q;
  if (perpendicular > radius * radius + EPS) return null;
  const t =
    -(x * dx + y * dy) / q -
    Math.sqrt(Math.max(0, (radius * radius - perpendicular) / q));
  return t >= -EPS && t <= 1 + EPS ? Math.max(0, Math.min(1, t)) : null;
}
// 剑风在空气中越水，只检查实体障碍与世界边界；移动和近战仍使用原地形规则。
export function firstSwordWindBlocker(a:Point,b:Point,radius:number,objects:readonly Prop[]=props) {
  const candidates:{id:string;t:number}[]=[];
  for(const p of objects){
    if(!p.solid||p.id===TRAINING.id||FIELD_TARGETS.some(t=>t.id===p.id))continue;
    const r=propBounds(p),t=firstRectContact(a,b,{left:r.left-radius,right:r.right+radius,top:r.top-radius,bottom:r.bottom+radius});
    if(t!==null)candidates.push({id:p.id,t});
  }
  const bounds={left:B.left+radius,right:B.right-radius,top:B.top+radius,bottom:B.bottom-radius};
  if(a.x<bounds.left||a.x>bounds.right||a.y<bounds.top||a.y>bounds.bottom)candidates.push({id:'world-edge',t:0});
  else for(const [s,d,min,max] of [[a.x,b.x-a.x,bounds.left,bounds.right],[a.y,b.y-a.y,bounds.top,bounds.bottom]])if(Math.abs(d)>EPS){
    const t=d>0?(max-s)/d:(min-s)/d;if(t>=0&&t<=1)candidates.push({id:'world-edge',t});
  }
  return candidates.sort((x,y)=>x.t-y.t||x.id.localeCompare(y.id))[0]??null;
}
