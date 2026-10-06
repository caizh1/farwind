import type {Point} from './obstacles';
import {SwordWindSystem,type SwordWind,type WindMotion,type WindTarget} from './swordWind';
import {firstSwordWindBlocker} from './swordWindGeometry';
import {BLACK_HOLE,blackHoleChance,blackHoleDps,blackHoleConfig,type BlackHoleConfig} from '../../data/blackHole';
export {BLACK_HOLE,blackHoleChance,blackHoleDps,blackHoleConfig,type BlackHoleConfig} from '../../data/blackHole';
export type BlackHoleTarget=WindTarget&{kind?:string;passiveRoot?:unknown;bossBattle?:{entryUntil:number;transformUntil:number}};
export type DimensionalRift=Point&BlackHoleConfig&{id:number;born:number;wind:SwordWind;A:number;dps:number};
type Credit={target:BlackHoleTarget;rift:DimensionalRift;amount:number;ms:number};
export type BlackHolePort={eastBossPullHandled?:boolean;clear:(a:Point,b:Point)=>boolean;move:(target:BlackHoleTarget,dx:number,dy:number)=>void;damage:(target:BlackHoleTarget,amount:number,rift:DimensionalRift,phase:'slash'|'dot')=>number};
const enemy=(t:BlackHoleTarget)=>t.hp>0&&!t.disabled&&(t.kind==='enemy'||t.kind==='defense-enemy');

// 派生风刃复用正式扫掠与障碍裁决，永远不进入原生连锁。
export class BlackHoleSlash {
 readonly blades=new SwordWindSystem();
 rifts:DimensionalRift[]=[];
 random:()=>number=()=>Math.random();
 private seen=new Set<number>();
 private releases=new Map<number,{A:number;dps:number;config:BlackHoleConfig}>();
 private credits=new Map<string,Credit>();
 private serial=0;
 metrics={rolls:0,procs:0,slashHits:0,dotDamage:0,pulled:0};
 release(wind:SwordWind,level:number,A:number,damage=wind.config.damage,geometry:BlackHoleConfig=blackHoleConfig()){
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
  this.releases.set(blade.id,{A,dps:blackHoleDps(A,level),config:{...geometry}});this.metrics.procs++;return true;
 }
 advance(prev:number,now:number,motions:WindMotion[],port:BlackHolePort,blocker=firstSwordWindBlocker){
  const eligible=motions.filter(m=>enemy(m.target as BlackHoleTarget));
  for(const event of this.blades.advance(prev,now,eligible,blocker)){
   const {A,dps,config}=this.releases.get(event.wind.id)??{A:0,dps:0,config:blackHoleConfig()};
   if(event.target){port.damage(event.target as BlackHoleTarget,event.wind.config.damage,{id:0,...event.point,...config,born:event.at,wind:event.wind,A,dps},'slash');this.metrics.slashHits++;}
   if(event.terminal){
    this.rifts.push({id:++this.serial,...event.point,...config,born:event.at,wind:event.wind,A,dps});
    if(this.rifts.length>BLACK_HOLE.maxRifts)this.rifts.shift();
    this.releases.delete(event.wind.id);
   }
  }
  const activeCredits=new Set<string>(),pulled=new Set<string>(),targets=eligible.map(m=>m.target as BlackHoleTarget);
  for(const rift of this.rifts){
   const elapsed=Math.max(0,Math.min(now,rift.born+BLACK_HOLE.open+rift.hold)-Math.max(prev,rift.born+BLACK_HOLE.open));
   if(!elapsed)continue;
   for(const target of targets){
    if(!enemy(target))continue;
    const distance=Math.hypot(target.x-rift.x,target.y-rift.y);
    if(distance>rift.pullRadius||!port.clear(target,rift))continue;
    if(distance<=rift.radius){
     const key=`${rift.id}:${target.id}`,credit=this.credits.get(key)??{target,rift,amount:0,ms:0};
     credit.amount+=rift.dps*elapsed/1000;credit.ms+=elapsed;
     this.credits.set(key,credit);activeCredits.add(key);
     // 大步长补结算完整跳数，余量留待下一帧；单跳不因帧长突破10点上限。
     while(credit.ms>=BLACK_HOLE.tick&&enemy(target)){
      const amount=Math.min(credit.amount,rift.dps*BLACK_HOLE.tick/1000);
      this.metrics.dotDamage+=port.damage(target,amount,rift,'dot');credit.amount-=amount;credit.ms-=BLACK_HOLE.tick;
     }
    }
    // 东侧首领半强度牵引；其他首领与机关保持免疫。
    if((target.boss&&target.boss!=='bound-branch')||target.boss==='bound-branch'&&(port.eastBossPullHandled||!this.eastPullAllowed(target,now))||target.passiveRoot||pulled.has(target.id)||distance<=BLACK_HOLE.core||!enemy(target))continue;
    const nearer=this.rifts.some(other=>other!==rift&&now>=other.born+BLACK_HOLE.open&&now<other.born+BLACK_HOLE.open+other.hold&&
     Math.hypot(target.x-other.x,target.y-other.y)<=other.pullRadius&&Math.hypot(target.x-other.x,target.y-other.y)<distance&&port.clear(target,other));
    if(nearer)continue;
    pulled.add(target.id);
    const amount=Math.min(distance-BLACK_HOLE.core,BLACK_HOLE.pullSpeed*(target.boss==='bound-branch'?.5:1)*elapsed/1000),before={x:target.x,y:target.y};
    port.move(target,(rift.x-target.x)/distance*amount,(rift.y-target.y)/distance*amount);
    this.metrics.pulled+=Math.hypot(target.x-before.x,target.y-before.y);
   }
  }
  // 离开或到期时仅结清实际在场时间，不补算范围外的伤害。
  for(const [key,credit] of this.credits)if(now>prev&&!activeCredits.has(key)){
   if(credit.amount>0&&enemy(credit.target)){this.metrics.dotDamage+=port.damage(credit.target,credit.amount,credit.rift,'dot');}
   this.credits.delete(key);
  }
  this.rifts=this.rifts.filter(r=>now<r.born+BLACK_HOLE.open+r.hold+BLACK_HOLE.close);
 }
 private eastPullAllowed(target:BlackHoleTarget,now:number){const b=target.bossBattle;return !b||now>=b.entryUntil&&now>=b.transformUntil;}
 // 正式世界先执行牵引，再采样首领攻击；其余目标仍走原推进顺序。
 pullEastBoss(prev:number,now:number,targets:BlackHoleTarget[],port:BlackHolePort){
  for(const target of targets){if(target.boss!=='bound-branch'||!enemy(target)||!this.eastPullAllowed(target,now))continue;
   const rift=this.rifts.filter(r=>now>=r.born+BLACK_HOLE.open&&prev<r.born+BLACK_HOLE.open+r.hold&&Math.hypot(target.x-r.x,target.y-r.y)<=r.pullRadius&&port.clear(target,r)).sort((a,b)=>Math.hypot(target.x-a.x,target.y-a.y)-Math.hypot(target.x-b.x,target.y-b.y))[0];
   if(!rift)continue;const elapsed=Math.max(0,Math.min(now,rift.born+BLACK_HOLE.open+rift.hold)-Math.max(prev,rift.born+BLACK_HOLE.open)),distance=Math.hypot(target.x-rift.x,target.y-rift.y);
   if(distance<=BLACK_HOLE.core||!elapsed)continue;
   const amount=Math.min(distance-BLACK_HOLE.core,130*elapsed/1000),before={x:target.x,y:target.y};port.move(target,(rift.x-target.x)/distance*amount,(rift.y-target.y)/distance*amount);this.metrics.pulled+=Math.hypot(target.x-before.x,target.y-before.y);
  }
 }
 clear(){this.blades.clear();this.rifts=[];this.seen.clear();this.releases.clear();this.credits.clear();this.metrics={rolls:0,procs:0,slashHits:0,dotDamage:0,pulled:0};}
 snapshot(){return {metrics:{...this.metrics},blades:this.blades.snapshot(),rifts:this.rifts.map(({wind,...r})=>({...r,releaseId:wind.releaseId}))};}
}
