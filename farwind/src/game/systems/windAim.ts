import {swordWindBirth} from './swordWind';
import {firstSwordWindBlocker} from './swordWindGeometry';
import type {Attack,Target} from './combat';
import type {Facing} from './locomotion';
import type {SwordWindConfig} from '../../data/swordWind';
import type {Point} from './obstacles';

// 只在原生动作开始时查询；不按渲染帧重选，也不修改已经飞出的剑风。
export class WindAim {
 target:string|null=null;manual=false;
 cycle(p:Point,config:SwordWindConfig,targets:readonly Target[],blocker=firstSwordWindBlocker){
  const options=this.options(p,config,targets,blocker).sort((a,b)=>a.target<b.target?-1:a.target>b.target?1:0);
  if(!options.length){this.target=null;return null;}
  const current=options.findIndex(o=>o.target===this.target);this.target=options[(current+1)%options.length].target;this.manual=true;return this.select(p,config,targets,blocker);
 }
 clear(){this.target=null;this.manual=false;}
 options(p:Point,config:SwordWindConfig,targets:readonly Target[],blocker=firstSwordWindBlocker){
  const options=targets.filter(t=>t.hp>0&&!t.disabled&&!t.id.startsWith('practice-')&&Math.hypot(t.x-p.x,t.y-p.y)>0).map(t=>{
   const dx=t.x-p.x,dy=t.y-p.y,d=Math.hypot(dx,dy),direction={x:dx/d,y:dy/d};
   const facing:Facing=Math.abs(dx)>Math.abs(dy)?dx<0?2:3:dy<0?1:0;
   const a:Attack={id:0,stage:1,kind:'swordWind',start:0,hit:new Set(),facing,aim:direction,windDirection:direction};
   const birth=swordWindBirth(a,p,config).position;
   const radius='radius' in t&&typeof t.radius==='number'?t.radius:14;
   const contactDistance=Math.max(0,d-radius),contact={x:p.x+direction.x*contactDistance,y:p.y+direction.y*contactDistance};
   const reachable=Math.max(0,contactDistance-Math.hypot(birth.x-p.x,birth.y-p.y))<=config.distance;
   return {target:t.id,direction,facing,d,legal:reachable&&!blocker(p,contact,config.width/2)};
  }).filter(o=>o.legal).sort((a,b)=>a.d-b.d||(a.target<b.target?-1:a.target>b.target?1:0));
  return options;
 }
 select(p:Point,config:SwordWindConfig,targets:readonly Target[],blocker=firstSwordWindBlocker){
  const options=this.options(p,config,targets,blocker);
  const selected=options.find(o=>o.target===this.target)??options[0];
  this.target=selected?.target??null;
  return selected?{direction:selected.direction,facing:selected.facing,target:selected.target}:null;
 }
}
