import type {Point} from './obstacles';
import {SwordWindSystem,type SwordWind,type WindMotion,type WindTarget} from './swordWind';
import {firstSwordWindBlocker} from './swordWindGeometry';

export const BLACK_HOLE={speed:900,width:48,radius:180,pullSpeed:260,core:18,open:240,hold:1440,close:320,dps:.4,tick:250,maxRifts:4} as const;
export const blackHoleChance=(level:number)=>level>0?Math.min(10,4+level)/100:0;
export type BlackHoleTarget=WindTarget&{kind?:string;passiveRoot?:unknown};
export type DimensionalRift=Point&{id:number;born:number;wind:SwordWind;A:number};
type Credit={target:BlackHoleTarget;rift:DimensionalRift;amount:number;ms:number};
export type BlackHolePort={clear:(a:Point,b:Point)=>boolean;move:(target:BlackHoleTarget,dx:number,dy:number)=>void;damage:(target:BlackHoleTarget,amount:number,rift:DimensionalRift,phase:'slash'|'dot')=>number};
const enemy=(t:BlackHoleTarget)=>t.hp>0&&!t.disabled&&(t.kind==='enemy'||t.kind==='defense-enemy');

// 派生风刃复用正式扫掠与障碍裁决，永远不进入原生连锁。
export class BlackHoleSlash {
 readonly blades=new SwordWindSystem();
 rifts:DimensionalRift[]=[];
 random:()=>number=()=>Math.random();
 private seen=new Set<number>();
 private bases=new Map<number,number>();
 private credits=new Map<string,Credit>();
 private serial=0;
 metrics={rolls:0,procs:0,slashHits:0,dotDamage:0,pulled:0};
 release(wind:SwordWind,level:number,A:number,damage=wind.config.damage){
  if(wind.attack.kind!=='swordWind'||wind.attack.counter||wind.config.trialLesson||wind.leg!=='out'||this.seen.has(wind.releaseId))return false;
  this.seen.add(wind.releaseId);
  if(this.seen.size>128)this.seen.delete(this.seen.values().next().value!);
  if(!level)return false;
  this.metrics.rolls++;
  if(this.random()>=blackHoleChance(level))return false;
  const config={...structuredClone(wind.config),name:'裂界·黑洞斩',angles:[0],maxTargets:1,speed:BLACK_HOLE.speed,width:BLACK_HOLE.width,damage,
   lifetime:Math.ceil(wind.config.distance/BLACK_HOLE.speed*1000)+100};
  const blade=this.blades.launch({...wind.attack,returnMode:undefined,rootActionId:wind.rootActionId,swordWind:config},wind.origin,wind.born,damage);
  if(!blade)return false;
  this.bases.set(blade.id,A);this.metrics.procs++;return true;
 }
 advance(prev:number,now:number,motions:WindMotion[],port:BlackHolePort,blocker=firstSwordWindBlocker){
  const eligible=motions.filter(m=>enemy(m.target as BlackHoleTarget));
  for(const event of this.blades.advance(prev,now,eligible,blocker)){
   const A=this.bases.get(event.wind.id)??0;
   if(event.target){port.damage(event.target as BlackHoleTarget,event.wind.config.damage,{id:0,...event.point,born:event.at,wind:event.wind,A},'slash');this.metrics.slashHits++;}
   if(event.terminal){
    this.rifts.push({id:++this.serial,...event.point,born:event.at,wind:event.wind,A});
    if(this.rifts.length>BLACK_HOLE.maxRifts)this.rifts.shift();
    this.bases.delete(event.wind.id);
   }
  }
  const activeCredits=new Set<string>(),pulled=new Set<string>(),targets=eligible.map(m=>m.target as BlackHoleTarget);
  for(const rift of this.rifts){
   const elapsed=Math.max(0,Math.min(now,rift.born+BLACK_HOLE.open+BLACK_HOLE.hold)-Math.max(prev,rift.born+BLACK_HOLE.open));
   if(!elapsed)continue;
   for(const target of targets){
    if(!enemy(target))continue;
    const distance=Math.hypot(target.x-rift.x,target.y-rift.y);
    if(distance>BLACK_HOLE.radius||!port.clear(target,rift))continue;
    const key=`${rift.id}:${target.id}`,credit=this.credits.get(key)??{target,rift,amount:0,ms:0};
    credit.amount+=AValue(rift)*elapsed/1000;credit.ms+=elapsed;
    this.credits.set(key,credit);activeCredits.add(key);
    if(credit.ms>=BLACK_HOLE.tick){this.metrics.dotDamage+=port.damage(target,credit.amount,rift,'dot');credit.amount=0;credit.ms=0;}
    // 首领与机关维持既有位移免疫；重叠裂缝只由最近者牵引一次。
    if(target.boss||target.passiveRoot||pulled.has(target.id)||distance<=BLACK_HOLE.core||!enemy(target))continue;
    const nearer=this.rifts.some(other=>other!==rift&&now>=other.born+BLACK_HOLE.open&&now<other.born+BLACK_HOLE.open+BLACK_HOLE.hold&&
     Math.hypot(target.x-other.x,target.y-other.y)<distance&&port.clear(target,other));
    if(nearer)continue;
    pulled.add(target.id);
    const amount=Math.min(distance-BLACK_HOLE.core,BLACK_HOLE.pullSpeed*elapsed/1000),before={x:target.x,y:target.y};
    port.move(target,(rift.x-target.x)/distance*amount,(rift.y-target.y)/distance*amount);
    this.metrics.pulled+=Math.hypot(target.x-before.x,target.y-before.y);
   }
  }
  // 离开或到期时仅结清实际在场时间，不补算范围外的伤害。
  for(const [key,credit] of this.credits)if(now>prev&&!activeCredits.has(key)){
   if(credit.amount>0&&enemy(credit.target)){this.metrics.dotDamage+=port.damage(credit.target,credit.amount,credit.rift,'dot');}
   this.credits.delete(key);
  }
  this.rifts=this.rifts.filter(r=>now<r.born+BLACK_HOLE.open+BLACK_HOLE.hold+BLACK_HOLE.close);
 }
 clear(){this.blades.clear();this.rifts=[];this.seen.clear();this.bases.clear();this.credits.clear();this.metrics={rolls:0,procs:0,slashHits:0,dotDamage:0,pulled:0};}
 snapshot(){return {metrics:{...this.metrics},blades:this.blades.snapshot(),rifts:this.rifts.map(({wind,...r})=>({...r,releaseId:wind.releaseId,radius:BLACK_HOLE.radius}))};}
}
const AValue=(r:DimensionalRift)=>r.A*BLACK_HOLE.dps;
