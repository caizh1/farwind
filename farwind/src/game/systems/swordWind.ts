import { attackConfig, facingVector, type Attack, type Target } from "./combat";
import {
  resolveSwordWindConfig,
  type SwordWindConfig,
} from "../../data/swordWind";
import { SWORD_WIND_RELEASES } from "../../data/swordWindArt";
import { firstSwordWindBlocker, sweptTargetContact } from "./swordWindGeometry";
import type { Point } from "./obstacles";
export type WindTarget = Target & { disabled?: boolean; radius?: number; windSensitive?:boolean; lessonId?:string };
export type WindMotion = {
  target: WindTarget;
  previous: Point;
  current: Point;
};
export type WindEnd = "target" | "obstacle" | "range" | "lifetime";
export type SwordWind = {
  id: number;
  releaseId:number;
  direction:Point;
  targetCount:number;
  birthPosition:Point;
  attackId: number;
  comboId: number;
  source: string;
  config: SwordWindConfig;
  attack: Attack;
  born: number;
  previous: Point;
  position: Point;
  origin: Point;
  facing: Attack["facing"];
  distance: number;
  maxTargets: number | "all";
  hit: Set<string>;
  terminated: boolean;
  reason?: WindEnd;
  ended?: number;
  contact?: Point;
  visualOffset: Point;
  initialChecked: boolean;
};
export type WindEvent = {
  kind:"hit"|"end";
  terminal?:boolean;
  pathOrder?:number;
  wind: SwordWind;
  at: number;
  point: Point;
  target?: WindTarget;
  reason: WindEnd;
};
// 纯呈现数据：只铺裁决完成的地面路径，不参与碰撞、伤害或存档。
export function swordWindGroundSegments(w: SwordWind, now: number) {
  if (!w.initialChecked) return [];
  const {x:dx,y:dy} = w.direction,
    m = w.config.art;
  const extent = Math.max(
    0,
    (w.position.x - w.origin.x) * dx + (w.position.y - w.origin.y) * dy,
  );
  const birth = w.birthPosition;
  const birthDistance =
    (birth.x - w.origin.x) * dx + (birth.y - w.origin.y) * dy;
  const segments = [];
  for (
    let start = 8, index = 0;
    start < extent;
    start += m.groundStep, index++
  ) {
    const age =
      now -
      w.born -
      (Math.max(0, start - birthDistance) / w.config.speed) * 1000;
    if (age < 0 || age >= m.groundLifetime) continue;
    segments.push({
      index,
      x: w.origin.x + dx * (start + m.groundStep / 2),
      y: w.origin.y + dy * (start + m.groundStep / 2),
      frame: Math.min(5, Math.floor(age / m.groundFrame)),
      crop: (128 * Math.min(m.groundStep, extent - start)) / m.groundStep,
      alpha: Math.min(1, (m.groundLifetime - age) / m.groundFade) * 0.88,
    });
  }
  return segments;
}
const mix = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
export function swordWindBirth(
  attack: Attack,
  root: Point,
  config: SwordWindConfig,
) {
  const [x, y] = facingVector(attack.facing),
    angle = Math.atan2(y, x),
    tip =
      SWORD_WIND_RELEASES[
        attack.facing === 0 ? 0 : attack.facing === 1 ? 1 : 2
      ];
  const anchor =
      config.art.attachments[
        attack.facing === 0 ? 0 : attack.facing === 1 ? 1 : 2
      ],
    attachment = {
      x: anchor[0],
      y: anchor[1] * (attack.facing === 2 ? -1 : 1),
    };
  const ax = attachment.x * Math.cos(angle) - attachment.y * Math.sin(angle),
    ay = attachment.x * Math.sin(angle) + attachment.y * Math.cos(angle);
  const visual = {
    x: tip.x * (attack.facing === 2 ? -1 : 1) - ax,
    y: tip.y - ay,
  };
  // 可见前缘与碰撞前缘共用接触平面。上身投影只转回地面高度，不把剑尖屏幕高度当地图坐标。
  const forward = Math.max(
      config.spawnForward,
      visual.x * x +
        (visual.y + config.art.bodyHeight) * y +
        config.art.frontEdge -
        config.width / 2,
    ),
    ground = { x: x * forward, y: y * forward };
  // root→出生点的完整起始路径仍参与扫掠，因此此锚点不会跳过贴身目标或薄墙。
  return {
    position: { x: root.x + ground.x, y: root.y + ground.y },
    visualOffset: { x: visual.x - ground.x, y: visual.y - ground.y },
  };
}
export class SwordWindSystem {
  serial=0;
  winds:SwordWind[]=[];
  lastAttackId=0;
  events:WindEvent[]=[];
  clear(){this.winds=[];this.lastAttackId=0;this.events=[];}
  launch(attack:Attack,root:Point,at:number,damage:number) {
    if(attack.stage!==4||attack.id<=this.lastAttackId)return null;
    this.lastAttackId=attack.id;
    const config={...structuredClone(attack.swordWind??resolveSwordWindConfig()),damage},birth=swordWindBirth(attack,root,config);
    const hit=new Set<string>(),snapshot:Attack={...attack,hit:new Set(),config:{...attackConfig(attack)},swordWind:config};
    const [dx,dy]=facingVector(attack.facing),baseForward=Math.hypot(birth.position.x-root.x,birth.position.y-root.y);
    const created=config.angles.map(offset=>{
      const direction={x:dx*Math.cos(offset)-dy*Math.sin(offset),y:dx*Math.sin(offset)+dy*Math.cos(offset)},position={x:root.x+direction.x*baseForward,y:root.y+direction.y*baseForward};
      // 上身投影不旋转到地面；侧刃只旋转平面偏移，中央刃严格保留原锚点。
      const plane={x:birth.visualOffset.x,y:birth.visualOffset.y+config.art.bodyHeight};
      const w:SwordWind={id:++this.serial,releaseId:attack.id,attackId:attack.id,comboId:attack.comboId??attack.id,source:'hero',config,attack:{...snapshot,windDirection:direction},born:at,
        previous:{...position},position,origin:{...root},birthPosition:{...position},direction,facing:attack.facing,distance:0,maxTargets:config.maxTargets,targetCount:0,hit,terminated:false,
        visualOffset:{x:plane.x*Math.cos(offset)-plane.y*Math.sin(offset),y:plane.x*Math.sin(offset)+plane.y*Math.cos(offset)-config.art.bodyHeight},initialChecked:false};
      this.winds.push(w);return w;
    });
    return created.find(w=>Math.abs(w.direction.x-dx)<1e-8&&Math.abs(w.direction.y-dy)<1e-8)!;
  }
  advance(prev:number,now:number,targets:WindMotion[],blocker=firstSwordWindBlocker) {
    const pending:WindEvent[]=[],result:WindEvent[]=[];
    const plans=new Map<SwordWind,{end:Point;travel:number}>();
    for(const w of this.winds){
      if(w.terminated||now<w.born)continue;
      const from=Math.max(prev,w.born),until=Math.min(now,w.born+w.config.lifetime),vx=w.direction.x,vy=w.direction.y;
      const scan=(a:Point,b:Point,start:number,end:number)=>{
        const wall=blocker(a,b,w.config.width/2);
        if(wall)pending.push({wind:w,kind:'end',pathOrder:Math.hypot(a.x-w.origin.x,a.y-w.origin.y)+Math.hypot(b.x-a.x,b.y-a.y)*wall.t,at:start+(end-start)*wall.t,point:mix(a,b,wall.t),reason:'obstacle'});
        for(const motion of targets){
          const target=motion.target;
          if(target.hp<=0||target.disabled||w.hit.has(target.id)||w.config.trialLesson&&target.lessonId!==w.config.trialLesson)continue;
          const u=(at:number)=>now>prev?Math.max(0,Math.min(1,(at-prev)/(now-prev))):1;
          const old=mix(motion.previous,motion.current,u(start)),current=mix(motion.previous,motion.current,u(end)),radius=w.config.width/2+(target.radius??14);
          // 先筛选有限路径的包围区域，再做连续接触裁决。
          if(Math.max(old.x,current.x)+radius<Math.min(a.x,b.x)||Math.min(old.x,current.x)-radius>Math.max(a.x,b.x)||
            Math.max(old.y,current.y)+radius<Math.min(a.y,b.y)||Math.min(old.y,current.y)-radius>Math.max(a.y,b.y))continue;
          const t=sweptTargetContact(a,b,old,current,radius);
          if(t===null||wall&&t>=wall.t-1e-8)continue;
          pending.push({wind:w,kind:'hit',pathOrder:Math.hypot(a.x-w.origin.x,a.y-w.origin.y)+Math.hypot(b.x-a.x,b.y-a.y)*t,at:start+(end-start)*t,point:mix(a,b,t),target,reason:'target'});
        }
      };
      if(!w.initialChecked){w.initialChecked=true;scan(w.origin,w.position,w.born,w.born);}
      if(until<from)continue;
      const travel=Math.max(0,Math.min(w.config.distance-w.distance,w.config.speed*(until-from)/1000));
      const endAt=from+travel/w.config.speed*1000,a={...w.position},b={x:a.x+vx*travel,y:a.y+vy*travel};
      w.previous=a;plans.set(w,{end:b,travel});scan(a,b,from,endAt);
      if(w.distance+travel>=w.config.distance-1e-7||until>=w.born+w.config.lifetime)
        pending.push({wind:w,kind:'end',at:endAt,point:b,reason:w.distance+travel>=w.config.distance-1e-7?'range':'lifetime'});
    }
    // 三道侧刃共同按真实接触时刻结算，避免弹体数组顺序决定重复目标的击退方向。
    pending.sort((a,b)=>a.at-b.at||(a.pathOrder??Infinity)-(b.pathOrder??Infinity)||(a.reason==='obstacle'?-1:b.reason==='obstacle'?1:0)||a.wind.id-b.wind.id||(a.target?.id??'').localeCompare(b.target?.id??''));
    for(const event of pending){
      const w=event.wind;
      if(w.terminated)continue;
      if(event.kind==='hit'){
        if(w.hit.has(event.target!.id))continue;
        w.hit.add(event.target!.id);
        if(!event.target!.windSensitive)w.targetCount++;
        if(w.maxTargets==='all'||w.targetCount<w.maxTargets||event.target!.windSensitive){event.terminal=false;result.push(event);continue;}
      }
      event.terminal=true;w.position={...event.point};w.terminated=true;w.reason=event.reason;w.ended=event.at;
      w.contact={x:event.point.x+w.direction.x*w.config.width/2,y:event.point.y+w.direction.y*w.config.width/2};
      result.push(event);
    }
    for(const [w,plan] of plans){
      if(!w.terminated){w.position=plan.end;w.distance+=plan.travel;}
      else w.distance+=Math.max(0,(w.position.x-w.previous.x)*w.direction.x+(w.position.y-w.previous.y)*w.direction.y);
    }
    this.events.push(...result);
    if(this.events.length>80)this.events.splice(0,this.events.length-80);
    this.winds=this.winds.filter(w=>!w.terminated||now-w.ended!<(w.reason==='target'?w.config.art.hit:w.config.art.dissolve));
    return result;
  }
  snapshot(){return this.winds.map(w=>({...w,hit:[...w.hit],attack:{...w.attack,hit:[...w.attack.hit]}}));}
}
