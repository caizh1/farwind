import {WORLD_PLAYABLE as B} from "../../data/maps/windbell/bounds";
import {
  props,
  terrainBlocked,
  solidPropAt,
  WATERS,
  BRIDGES,
  propBounds,
  type Prop,
} from "../../data/world";
import { FIELD_TARGETS, TRAINING } from "./training";
export type Point = { x: number; y: number };
export type Rect = { left: number; right: number; top: number; bottom: number };
export type Query = "motion" | "melee";
const EPS = 1e-8;

// 连续线段裁剪；只擦过边界、不进入矩形内部时允许通过。
export function rectInterval(
  a: Point,
  b: Point,
  r: Rect,
): [number, number] | null {
  let lo = 0,
    hi = 1;
  for (const [start, delta, min, max] of [
    [a.x, b.x - a.x, r.left, r.right],
    [a.y, b.y - a.y, r.top, r.bottom],
  ]) {
    if (Math.abs(delta) < EPS) {
      if (start <= min || start >= max) return null;
    } else {
      const t1 = (min - start) / delta,
        t2 = (max - start) / delta;
      lo = Math.max(lo, Math.min(t1, t2));
      hi = Math.min(hi, Math.max(t1, t2));
      if (hi - lo <= EPS) return null;
    }
  }
  return [lo, hi];
}
export function propLineBlocker(
  a: Point,
  b: Point,
  query: Query,
  ignore?: string,
  objects: readonly Prop[] = props,
) {
  return objects.find(
    (p) =>
      p.solid &&
      p.id !== ignore &&
      rectInterval(a, b, propBounds(p, query === "motion")),
  )?.id;
}
function terrainLineBlocker(
  a: Point,
  b: Point,
  query: Query,
): string | undefined {
  if (
    [a, b].some(
      (p) =>
        p.x < B.left ||
        p.x > B.right ||
        p.y < B.top ||
        p.y > B.bottom,
    )
  )
    return "world-edge";
  const margin = query === "motion" ? 10 : 0;
  // 从线段剔除合法桥面区间，再解析计算椭圆内是否还有水域。
  let intervals: [number, number][] = [[0, 1]];
  for (const bridge of BRIDGES) {
    const inset = query === "motion" ? 12 : 0;
    const span = rectInterval(a, b, {
      left: bridge.x + inset - EPS,
      right: bridge.x + bridge.w - inset + EPS,
      top: bridge.y - EPS,
      bottom: bridge.y + bridge.h + EPS,
    });
    if (span)
      intervals = intervals.flatMap(([lo, hi]) => {
        if (span[1] <= lo || span[0] >= hi) return [[lo, hi]];
        const parts: [number, number][] = [];
        if (span[0] > lo) parts.push([lo, span[0]]);
        if (span[1] < hi) parts.push([span[1], hi]);
        return parts;
      });
  }
  for(const POND of WATERS){
  const x = (a.x - POND.x) / (POND.rx + margin),
    y = (a.y - POND.y) / (POND.ry + margin);
  const dx = (b.x - a.x) / (POND.rx + margin),
    dy = (b.y - a.y) / (POND.ry + margin);
  for (const [lo, hi] of intervals) {
    const t = Math.max(
      lo,
      Math.min(hi, -(x * dx + y * dy) / (dx * dx + dy * dy || 1)),
    );
    if ((x + dx * t) ** 2 + (y + dy * t) ** 2 < 1 - EPS) return POND.id;
  }
  }
  // 河道的既有规则：上下两段40像素半宽，1010～1180为通行桥。
  // x(t)-河心(y(t))是三次多项式；端点和导数根给出精确范围，无步进漏检。
  const u = (a.y - 650) / 930,
    du = (b.y - a.y) / 930;
  const c0 = a.x - (2620 - 240 * u + 720 * u * u - 530 * u ** 3);
  const c1 = b.x - a.x - du * (-240 + 1440 * u - 1590 * u * u);
  const c2 = -(720 - 1590 * u) * du * du,
    c3 = 530 * du ** 3;
  const value = (t: number) => c0 + c1 * t + c2 * t * t + c3 * t ** 3;
  const roots: number[] = [];
  if (Math.abs(c3) < EPS) {
    if (Math.abs(c2) > EPS) roots.push(-c1 / (2 * c2));
  } else {
    const disc = 4 * c2 * c2 - 12 * c3 * c1;
    if (disc >= 0)
      roots.push(
        (-2 * c2 + Math.sqrt(disc)) / (6 * c3),
        (-2 * c2 - Math.sqrt(disc)) / (6 * c3),
      );
  }
  for (const [top, bottom] of [
    [650 - EPS, 1010],
    [1180, 1580 + EPS],
  ]) {
    const span = rectInterval(a, b, {
      left: -Infinity,
      right: Infinity,
      top,
      bottom,
    });
    if (!span) continue;
    const samples = [
      span[0],
      span[1],
      ...roots.filter((t) => t > span[0] && t < span[1]),
    ].map(value);
    if (Math.min(...samples) < 40 - EPS && Math.max(...samples) > -40 + EPS)
      return "stream";
  }
}
export function motionBlocked(x: number, y: number, ignore?: string) {
  return terrainBlocked(x, y) || solidPropAt(x, y, ignore);
}
export function motionLineBlocker(a: Point, b: Point, ignore?: string) {
  return (
    propLineBlocker(a, b, "motion", ignore) ??
    terrainLineBlocker(a, b, "motion")
  );
}
export const clearMotionLine = (a: Point, b: Point, ignore?: string) =>
  !motionLineBlocker(a, b, ignore);
// 实体树石可穿；剧情门、未修捷径、建筑空间边界和水域仍逐段阻挡。
export function clearPhaseLine(a: Point,b: Point) {
  const hard=props.filter(p=>p.id.startsWith('barrier-')||p.id.endsWith('-seal')||p.id==='west-gate-barrier'||['house','shop','smith-building','inn-building','tower'].includes(p.art));
  return !terrainLineBlocker(a,b,'motion')&&!propLineBlocker(a,b,'motion',undefined,hard);
}
export function meleeBlocker(a: Point, b: Point, targetId?: string) {
  // 仅训练靶攻击可豁免自身底座。敌人ID、普通物体ID不获得任意豁免。
  const ignore =
    targetId === TRAINING.id || FIELD_TARGETS.some((t) => t.id === targetId)
      ? targetId
      : undefined;
  return (
    propLineBlocker(a, b, "melee", ignore) ?? terrainLineBlocker(a, b, "melee")
  );
}
export const clearMeleeLine = (a: Point, b: Point, targetId?: string) =>
  !meleeBlocker(a, b, targetId);

export type FiringPort = {origin: Point; lowCoverIds: readonly string[]; structureId?: string};
// 高处射击独立于脚底／水域。仅登记的射击口可越过己方低墙，高墙不能豁免。
export function shotLineBlocker(a:Point,b:Point,port?:FiringPort,objects:readonly Prop[]=props) {
  return shotLineImpact(a,b,port,objects)?.id;
}
export function shotLineImpact(a:Point,b:Point,port?:FiringPort,objects:readonly Prop[]=props){
  const inside=(p:Point)=>p.x>=B.left&&p.x<=B.right&&p.y>=B.top&&p.y<=B.bottom;
  let first: {id:string;fraction:number}|undefined;
  if(!inside(a))return {id:'world-edge',fraction:0};
  if(!inside(b))first={id:'world-edge',fraction:rectInterval(a,b,{...B})?.[1]??0};
  for(const p of objects){
    if(!p.solid)continue;
    const fromPort=port && Math.hypot(a.x-port.origin.x,a.y-port.origin.y)<=2;
    const permitted=fromPort && p.owner==="village" &&
      (p.cover==="low" && port.lowCoverIds.includes(p.id) || p.id===port.structureId);
    const high=p.cover==="high" || ["house","shop","tower","smith-building","inn-building"].includes(p.art);
    const bounds=high ? {left:p.x-p.w/2,right:p.x+p.w/2,top:p.y-p.h,bottom:p.y} : propBounds(p);
    const interval=!permitted&&rectInterval(a,b,bounds);
    if(interval&&(!first||interval[0]<first.fraction))first={id:p.id,fraction:interval[0]};
  }return first;
}
