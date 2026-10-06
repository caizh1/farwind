import type {EnemyBody} from './enemy';
import type {EnemyAttack,AttackGeometry,EnemyContact} from './enemyAttack';
import {aim,geometryTouches} from './enemyAttack';
import type {Point} from './obstacles';
import {clearMeleeLine} from './obstacles';
import {memoryStrength} from '../../data/windMemoryDifficulty';
import {enemyLeashRadius} from '../../data/enemyPursuit';
import {mapGeometryRevision} from '../../data/world';

export const EAST_TIER_FIVE={level:5,cloneThreshold:.75,summon:2400,retry:5000,windup:1200,interval:1000,lock:350,active:120,recovery:900,vineCooldown:18000,gap:350,majorGap:600,width:64,minReach:900} as const;
export const eastTierFive=(e:Pick<EnemyBody,'boss'|'memoryDifficulty'>)=>e.boss==='bound-branch'&&(e.memoryDifficulty?.level??0)>=5;
export const eastCloneId=(id:string,attempt:number)=>`${id}:clone:${attempt}:0`;
export const eastMajor=(move:number)=>[2,5,6,7,8].includes(move);
export const isVine=(a:EnemyAttack|null|undefined)=>a?.boss==='bound-branch'&&a.bossSkill===8&&!!a.bossVine;
export const summonProtected=(e:Pick<EnemyBody,'boss'|'attack'>,now:number)=>e.boss==='bound-branch'&&e.attack?.bossSkill===7&&!e.attack.cancelled&&now>=e.attack.startedAt&&now<e.attack.recoveryUntil;
export function clipVine(origin:Point,direction:Point,length:number,clear:(a:Point,b:Point)=>boolean=clearMeleeLine){
 let reach=0;
 for(let n=16;n<length+16;n+=16){const next=Math.min(n,length),p={x:origin.x+direction.x*next,y:origin.y+direction.y*next};if(!clear(origin,p)){let lo=reach,hi=next;for(let i=0;i<6;i++){const mid=(lo+hi)/2;if(clear(origin,{x:origin.x+direction.x*mid,y:origin.y+direction.y*mid}))lo=mid;else hi=mid;}return lo;}reach=next;if(reach===length)break;}
 return reach;
}
// 同一攻击的静止根点复用截断；地形、牵引、转向和长度变化会立即失效。
const clipped=new WeakMap<EnemyAttack,{revision:number;x:number;y:number;dx:number;dy:number;length:number;clear:(a:Point,b:Point)=>boolean;reach:number}>();
export function vineGeometry(a:EnemyAttack,root:Point,now:number,preview=false,clear:(a:Point,b:Point)=>boolean=clearMeleeLine):AttackGeometry{
 const d=a.direction,origin={x:root.x+d.x*24,y:root.y+d.y*24},length=a.bossVine!.length,last=clipped.get(a);const same=last&&last.revision===mapGeometryRevision&&last.x===origin.x&&last.y===origin.y&&last.dx===d.x&&last.dy===d.y&&last.length===length&&last.clear===clear;const reach=same?last.reach:clipVine(origin,d,length,clear);if(!same)clipped.set(a,{revision:mapGeometryRevision,x:origin.x,y:origin.y,dx:d.x,dy:d.y,length,clear,reach});const u=preview?1:Math.max(0,Math.min(1,(now-a.contactAt)/EAST_TIER_FIVE.active));
 return {a:origin,b:{x:origin.x+d.x*reach*u,y:origin.y+d.y*reach*u},radius:reach>0?EAST_TIER_FIVE.width/2:0};
}
export function advanceVineAim(e:EnemyBody,target:Point,now:number){
 const a=e.attack!,v=a.bossVine!;
 if(!a.locked){
  const last=e.eastAim,dt=last?now-last.at:0,scale=dt>0?Math.min(350/dt,80/Math.max(.001,Math.hypot(target.x-last!.x,target.y-last!.y))):0;
  const predicted={x:target.x+(target.x-(last?.x??target.x))*scale,y:target.y+(target.y-(last?.y??target.y))*scale};
  a.direction=aim(e,predicted);v.length=Math.min(2*(enemyLeashRadius(e)+100)+400,Math.max(EAST_TIER_FIVE.minReach,Math.hypot(target.x-e.x,target.y-e.y)+360));
  if(now>=a.lockAt)a.locked=true;
 }
 e.eastAim={...target,at:now};a.scanAt=now;
}
export function vineContacts(a:EnemyAttack,e:EnemyBody,prev:number,now:number,targets:readonly (Point&{id:string;previous:Point;ordinaryOnly?:boolean})[]):EnemyContact[]{
 if(a.cancelled)return [];const out:EnemyContact[]=[],end=Math.min(now,a.activeUntil-.001),start=Math.max(prev,a.contactAt),old=e.combatPrevious??e;
 for(const target of targets){if(target.ordinaryOnly||a.bossVine!.used.includes(target.id))continue;
  for(let t=start;t<=end;t=Math.min(end,t+5)){
   const u=now>prev?Math.max(0,Math.min(1,(t-prev)/(now-prev))):1,root={x:old.x+(e.x-old.x)*u,y:old.y+(e.y-old.y)*u},point={x:target.previous.x+(target.x-target.previous.x)*u,y:target.previous.y+(target.y-target.previous.y)*u},g=vineGeometry(a,root,t);
   if(geometryTouches(g,point)&&clearMeleeLine(g.a,point)){a.bossVine!.used.push(target.id);const attack={...a,attackId:a.attackId,geometry:g,emitted:true};out.push({at:t,attack,origin:g.a,geometry:g,targetId:target.id,sampledPoint:point});break;}if(t>=end)break;
  }
 }
 return out;
}
// 同伴的大招在收势前保持独占；普通连招提前保留两次出手时刻。
export function eastDuoCanStart(e:EnemyBody,move:number,now:number,contactAt:number,recoveryUntil:number){
 const peers=(e.eastPeers??[]).filter(p=>p!==e&&p.hp>0&&p.boss==='bound-branch'&&(p.id===e.bossClone?.owner||p.bossClone?.owner===e.id));
 for(const p of peers){const a=p.attack;
  if((p.bossBattle?.eastMajorUntil??0)>now)return false;
  if(a&&!a.cancelled&&now<a.recoveryUntil){if(eastMajor(move)||eastMajor(a.bossSkill??-1))return false;
   const secondWindup=(boss:EnemyBody)=>Math.max(350,(boss.bossBattle?.phase===2?350:400)/memoryStrength(boss.memoryDifficulty,true).attack);
   const contacts=[a.contactAt,...a.bossSkill===0&&a.bossPart===0?[a.recoveryUntil+secondWindup(p)]:[]],ours=[contactAt,...move===0?[recoveryUntil+secondWindup(e)]:[]];
   if(ours.some(t=>contacts.some(other=>Math.abs(t-other)<EAST_TIER_FIVE.gap)))return false;
  }
 }
 return true;
}
