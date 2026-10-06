import {eastWalkStride} from './eastBossLocomotion';
import type {AnimatedEnemy,EnemyPose} from './enemyAnimation';
import type {EnemyAttack} from './enemyAttack';
import {BOSS_RULES} from '../../data/maps/windbell/campBosses';
import {createBossAttack,bossEngagementRange} from './campBossCombat';
import {eastDuoCanStart} from './eastBossTierFive';

export type EastPose={clip:string;time:number;direction:number;phase:string};
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
// 八方向从朝下开始逆时针编号，与 Blender 绕竖轴旋转一致。边界留五度回差。
export function eastDirection(x:number,y:number,previous=0){
 if(Math.hypot(x,y)<1e-6)return previous;
 const angle=Math.atan2(x,y),old=previous*Math.PI/4,diff=Math.atan2(Math.sin(angle-old),Math.cos(angle-old));
 return Math.abs(diff)<Math.PI/8+Math.PI/36?previous:(Math.round(angle/(Math.PI/4))+8)%8;
}
export function eastAttackTime(a:EnemyAttack,now:number,shift=false){
 const source=shift?[0,500,850,1150,1370]:a.bossPart?[0,a.lockAt===a.startedAt?0:50,400,600,820]:[0,400,750,950,1030];
 const actual=[a.startedAt,a.lockAt,a.contactAt,a.activeUntil,a.recoveryUntil];
 for(let i=1;i<actual.length;i++)if(now<actual[i])return source[i-1]+(source[i]-source[i-1])*clamp((now-actual[i-1])/Math.max(1,actual[i]-actual[i-1]));
 return source[4];
}
export class EastBossAnimation{
 lastBody?:{x:number;y:number;faceX?:number;faceY?:number};aim={x:0,y:1};
 lastScythe:'left'|'right'='left';direction=0;lastNow=-Infinity;previous='idle';changedAt=0;turnUntil=0;turnClip='turn-right';walkAt=0;lastDistance=0;walkPhase=0;stopClip='stop';
 // 只读预取：在副本上采样正式时钟与已选定连段，不选招、不推进真实战斗或步态。
 forecast(body:AnimatedEnemy,a:EnemyAttack|null|undefined,now:number,base:EnemyPose,distance:number):EastPose[]{
  const animation=Object.assign(new EastBossAnimation(),this),copy={...body,bossBattle:body.bossBattle?{...body.bossBattle}:undefined};
  let attack=a&&!a.cancelled&&now<a.recoveryUntil?{...a}:undefined;
  const times=new Set(Array.from({length:31},(_,i)=>i*500/30));
  if(attack)for(const at of [attack.lockAt,attack.contactAt,attack.activeUntil,attack.recoveryUntil])if(at>=now&&at<=now+500)times.add(at-now);
  const result:EastPose[]=[],speed=body.eastMotion?.speed??0,aim=this.aim,target={x:body.x+aim.x*1000,y:body.y+aim.y*1000};
  for(const offset of [...times].sort((a,b)=>a-b)){
   const at=now+offset,b=copy.bossBattle;
   if(attack&&at>=attack.recoveryUntil){
    const part=attack.bossPart??0;
    if(b&&(attack.bossSkill===8&&part<7||attack.bossSkill===0&&part===0)){
     b.move=attack.bossSkill!;b.part=part+1;
     attack=createBossAttack({...copy,boss:'bound-branch'} as import('./enemy').EnemyBody,attack.recoveryUntil,target,b);
    }else{
     if(b&&!attack.cancelled){b.move=-1;b.lastSkill=attack.bossSkill;b.exposedUntil=Math.max(b.exposedUntil,at+500);}
     attack=undefined;
    }
   }
   if(!attack&&b&&(b.move===0||b.move>=7)&&base.action!=='walk'&&speed<.1&&at>=b.nextAt&&at>=b.entryUntil&&at>=b.transformUntil&&!a?.cancelled&&(body.hp??1)>0){
    // 已排定但尚未开始的动作可以预取；没有排定动作时不猜测玩家或选招结果。
    const enemy=copy as import('./enemy').EnemyBody,point=enemy.nav?.lastSeen??target;
    const starts=Math.max(now,b.nextAt,...(enemy.eastPeers??[]).filter(p=>p!==body&&p.hp>0).map(p=>p.bossBattle?.eastMajorUntil??0));
    if(at>=starts&&Math.hypot(point.x-body.x,point.y-body.y)<=bossEngagementRange('bound-branch',b)){
     const pending=createBossAttack({...enemy,boss:'bound-branch'},starts,point,b);
     if(eastDuoCanStart(enemy,b.move,at,pending.contactAt,pending.recoveryUntil))attack=pending;
    }
   }
   const moving=!attack&&base.action==='walk';
   copy.x=body.x+(moving?(body.face?.x??0)*speed*offset/1000:0);copy.y=body.y+(moving?(body.face?.y??1)*speed*offset/1000:0);
   if(body.eastMotion){const turn=body.eastMotion.turn;copy.eastMotion={...body.eastMotion,turn:turn&&turn.elapsed+offset<200?{...turn,elapsed:turn.elapsed+offset}:undefined};if(turn&&turn.elapsed+offset>=200){const angle=(turn.from+turn.sign)*Math.PI/4;copy.face={x:Math.sin(angle),y:Math.cos(angle)};}}
   result.push(animation.sample(copy,attack,at,{...base,elapsed:base.elapsed+offset},distance+(moving?speed*offset/1000:0)));
  }
  // 玩家变向和障碍停步不可预知；只预取当前支撑相附近的短入口，不装整套移动片段。
  const transitions:EastPose[]=[];
  if((!a||a.cancelled||now>=a.recoveryUntil)&&!body.parried&&(body.hp??1)>0&&['idle','start','walk','stop'].some(c=>this.previous===c||this.previous.startsWith(c+'-'))){
   const add=(clip:string,times:number[])=>{for(const time of times)transitions.push({clip,time,direction:this.direction,phase:'移动预取'});};
   add('start',[0,80]);
   if(base.action==='walk')for(const delta of [-1,0,1]){const step=(Math.round(this.walkPhase*8)+delta+8)%8;add(step?'stop-'+step:'stop',[0,80]);}
   else for(const sign of ['left','right'])for(const foot of ['left','right'])add('walk-turn-'+sign+'-'+foot,[0,50]);
  }
  return [...result.slice(0,7),...transitions,...result.slice(7)];
 }
 sample(body:AnimatedEnemy,a:EnemyAttack|null|undefined,now:number,base:EnemyPose,distance:number):EastPose{
  if(now<this.lastNow){this.previous='idle';this.changedAt=now;this.turnUntil=0;this.walkAt=distance;this.lastBody=undefined;}
  this.lastNow=now;
  const b=body.bossBattle,live=!!a&&!a.cancelled&&now>=a.startedAt&&now<a.recoveryUntil;
  if(a?.bossSkill===0)this.lastScythe=a.bossPart?'right':'left';
  const last=this.lastBody,dx=last?body.x-last.x:0,dy=last?body.y-last.y:0;
  // 行走使用已被基础采样器确认的自主位移；旧攻击朝向不能覆盖追赶和停步。
  if(live)this.aim={...a!.direction};
  else if(base.action==='walk'&&Math.hypot(dx,dy)>.001)this.aim=body.eastMotion&&body.face?{...body.face}:{x:dx,y:dy};
  else if(body.face&&(!last||body.face.x!==last.faceX||body.face.y!==last.faceY))this.aim={...body.face};
  this.lastBody={x:body.x,y:body.y,faceX:body.face?.x,faceY:body.face?.y};
  const desired=eastDirection(this.aim.x,this.aim.y,this.direction);
  let clip='idle',time=now%1200,phase='警戒';
  if((body.hp??1)<=0){clip='death';time=base.elapsed;phase='死亡';}
  else if(b&&now<b.entryUntil){clip='entry';time=Math.max(0,BOSS_RULES.appearance-(b.entryUntil-now));phase='现身';}
  else if(b&&now<b.transformUntil){clip='transform';time=Math.max(0,BOSS_RULES.transform-(b.transformUntil-now));phase='阶段转换';}
  else if(body.parried&&now>=body.parried.at&&now<body.parried.until){clip=(body.parried.perfect?'perfect-':'parry-')+this.lastScythe;time=1000*clamp((now-body.parried.at)/(body.parried.until-body.parried.at));phase='弹反失衡';}
  else if(base.action==='hurt'&&!live){clip='hurt';time=base.elapsed;phase='受击';}
  else if(live){
   const skill=a!.bossSkill??0;
   phase=now<a!.contactAt?'蓄力':now<a!.activeUntil?'出手':'收势';
   if(skill===7){clip='summon';time=Math.max(0,now-a!.startedAt);}
   else if(skill===8){if(!a!.bossPart&&now<a!.lockAt){clip='vine-enter';time=1200*clamp((now-a!.startedAt)/(a!.lockAt-a!.startedAt));}else if(a!.bossPart===7&&now>=a!.activeUntil){clip='vine-exit';time=900*clamp((now-a!.activeUntil)/(a!.recoveryUntil-a!.activeUntil));}else{clip=(a!.bossPart??0)%2?'vine-right':'vine-left';const actual=[a!.startedAt,a!.lockAt,a!.contactAt,a!.activeUntil,a!.recoveryUntil],source=[0,324,674,794,1000];time=1000;for(let i=1;i<actual.length;i++)if(now<actual[i]){time=source[i-1]+(source[i]-source[i-1])*clamp((now-actual[i-1])/Math.max(1,actual[i]-actual[i-1]));break;}}}
   else if(skill===0){clip=(a!.bossPart?'cross-right':'cross-left')+(body.eastStepBlocked?'-planted':'');time=eastAttackTime(a!,now);}
   else if(skill===4){clip='shift';time=eastAttackTime(a!,now,true);}
   else{
    const name=({1:'needles',2:'roots',3:'cocoon',5:'ritual',6:'laser'} as Record<number,string>)[skill];
    if(now<a!.contactAt){clip=name+'-enter';const duration=({1:900,2:1100,3:900,5:1100,6:1200} as Record<number,number>)[skill];time=duration*clamp((now-a!.startedAt)/(a!.contactAt-a!.startedAt));}
    else if(now<a!.activeUntil){clip=name+'-hold';time=(now-a!.contactAt)%600;}
    else{clip=name+'-exit';time=(skill===6?900:220)*clamp((now-a!.activeUntil)/(a!.recoveryUntil-a!.activeUntil));}
   }
  }else if(b&&b.exposedUntil>now){const remaining=b.exposedUntil-now;clip=remaining<300?'recover':'exposed';time=remaining<300?300-remaining:now%1000;phase='弱点暴露';}
  else if(b?.move===0&&b.part===1&&b.nextAt>now&&!a?.cancelled){clip='cross-link';time=160-clamp((b.nextAt-now)/160)*160;phase='借势换镰';}
  else if(base.action==='walk'){
   if(this.previous.startsWith('walk-turn-')){const phase=this.previous.endsWith('-left')?0:.5;this.walkPhase=(phase+200/900)%1;this.changedAt=now-200;}
   else if(!['walk','start'].includes(this.previous)){this.changedAt=now;this.walkPhase=0;}
   else if(this.previous==='walk')this.walkPhase=(this.walkPhase+Math.max(0,distance-this.lastDistance)/eastWalkStride(desired*Math.PI/4))%1;
   clip=now-this.changedAt<200?'start':'walk';time=clip==='start'?now-this.changedAt:this.walkPhase*1000;phase='移动';
  }else if((['walk','start'].includes(this.previous)||this.previous.startsWith('stop'))){
   if(!this.previous.startsWith('stop')){this.changedAt=now;const step=Math.round(this.walkPhase*8)%8;this.stopClip=step?'stop-'+step:'stop';}
   if(now-this.changedAt<240){clip=this.stopClip;time=now-this.changedAt;phase='停步';}

  }
  const turn=body.eastMotion?.turn;
  if(turn&&!live&&['idle','walk','start','stop'].some(n=>clip===n||clip.startsWith(n+'-'))){
   clip='walk-turn-'+(turn.sign<0?'left':'right')+'-'+turn.support;time=turn.elapsed;this.direction=(turn.from%8+8)%8;this.turnUntil=0;phase='支撑转弯';
  }else if(clip==='idle'&&(desired!==this.direction||now<this.turnUntil)){
   if(now>=this.turnUntil){const delta=(desired-this.direction+12)%8-4,step=delta<0?-1:1;this.direction=(this.direction+step+8)%8;this.changedAt=now;this.turnUntil=now+240;this.turnClip=step<0?'turn-left':'turn-right';}
   clip=this.turnClip;time=now-this.changedAt;phase='转身';
  }else if(!(clip==='death'||clip.startsWith('parry')||clip.startsWith('perfect'))){this.direction=desired;this.turnUntil=0;}
  this.previous=clip;this.lastDistance=distance;
  return {clip,time:Math.max(0,time),direction:this.direction,phase};
 }
}

export type EastFrame={page:number;rect:[number,number,number,number];pivot:[number,number];sockets:Record<string,[number,number]>};
export type EastClip={duration:number;loop:boolean;markers?:Record<string,number>;support?:string;turnDegrees?:number;startPhase?:number;endPhase?:number;directions:Record<string,{at:number;frame:string}[]>};
export type EastAtlas={version:3;kind:'bound-branch';referenceHeight:512;sourceHash:string;assetHash?:string;baseFrames?:string[];alphaMode?:{png:'straight';ktx:'premultiplied'};pages:{png:string;ktx:string;gzip?:string;gzipBytes?:number;width:number;height:number;bytes:number;compressedBytes:number}[];frames:Record<string,EastFrame>;clips:Record<string,EastClip>;说明:string};
export function eastFrameAt(m:EastAtlas,p:EastPose){
 const clip=m.clips[p.clip],frames=clip?.directions[String(p.direction)];if(!frames?.length)return undefined;
 const t=clip.loop?p.time%clip.duration:Math.min(p.time,clip.duration);
 let lo=0,hi=frames.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(frames[mid].at<=t)lo=mid;else hi=mid-1;}
 return {id:frames[lo].frame,frame:m.frames[frames[lo].frame],index:lo,sequence:frames};
}
