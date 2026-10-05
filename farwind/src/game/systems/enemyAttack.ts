import {projectilePathClear} from './projectileGeometry';
import {sampleAttackTiming} from './attackTiming';
import {isWolfClaw,wolfClawRadius} from './wolfClaw';
import {clearMotionLine,motionBlocked,clearMeleeLine,type Point} from "./obstacles";
import {sweepMove,PARRY} from "./combat";
import {enemyBehavior,type EnemyKind} from '../../data/enemies';
import type {EliteKind} from '../../data/maps/windbell/elites';
import type {CampBossKind} from '../../data/maps/windbell/campBosses';
export const ENEMY_ATTACK={slime:{windup:450,lock:120,active:100,recovery:260,step:34,cooldown:1100,damage:10},leaf:{windup:650,lock:150,active:130,recovery:320,step:12,cooldown:1400,damage:18},spore:{windup:520,lock:120,active:140,recovery:360,step:0,cooldown:1800,damage:14},boar:{windup:560,lock:160,active:280,recovery:380,step:210,cooldown:1900,damage:20},raven:{windup:450,lock:120,active:170,recovery:380,step:95,cooldown:1600,damage:16},wolf:{windup:620,lock:230,active:180,recovery:460,step:105,cooldown:1700,damage:15},burrow:{windup:1050,lock:650,active:240,recovery:850,step:105,cooldown:2500,damage:18},guardian:{windup:850,lock:300,active:180,recovery:950,step:20,cooldown:2300,damage:22},priest:{windup:900,lock:200,active:2400,recovery:500,step:0,cooldown:4800,damage:0},bomber:{windup:650,lock:250,active:360,recovery:1450,step:180,cooldown:3600,damage:26},archer:{windup:800,lock:350,active:180,recovery:650,step:0,cooldown:2300,damage:16},bell:{windup:1100,lock:350,active:350,recovery:900,step:0,cooldown:7000,damage:0},shade:{windup:850,lock:350,active:240,recovery:850,step:130,cooldown:2100,damage:18},geomancer:{windup:1000,lock:350,active:1800,recovery:1000,step:0,cooldown:4500,damage:20},range:100,halfAngle:80*Math.PI/180} as const;
export const FUNGAL_BLAST_RADIUS=94;
export type AttackGeometry={a:Point;b:Point;radius:number;kind?:'sector'|'circle'|'ring';direction?:Point;halfAngle?:number;inner?:number};
export type BossGeometry={kind:'sector'|'circle'|'ring';point:Point;radius:number;halfAngle:number;rear?:boolean;offset?:number};
type AttackSpace={blocked:(x:number,y:number)=>boolean;clear:(a:Point,b:Point)=>boolean;melee:(a:Point,b:Point,id?:string)=>boolean;wall?:(a:Point,b:Point)=>boolean};
export type CombatTier=0|1|2;
export type ProjectileProfile={speed:number;life:number;radius:number;distance:number;size:number;needleSize:number};
export type EnemyAttack={aimTarget?:Point;aimAt?:number;combatTier?:CombatTier;chainPart?:1|2;projectile?:ProjectileProfile;eventId?:string|null;areaPattern?:'center'|'sides';attackId:string;attackerId:string;type:EnemyKind;elite?:EliteKind;step?:number;combo?:number;boss?:CampBossKind;bossSkill?:number;bossPart?:number;bossAttempt?:number;bossGeometry?:BossGeometry;bossShotAngles?:number[];shotAngles?:number[];bossArea?:'circle'|'ring';bossCocoon?:boolean;bossLaser?:boolean;bossStunned?:boolean;bossSideStep?:number;bossSideMotion?:number;supportTarget?:string;bombAt?:number;detonated?:boolean;blastPoint?:Point;startedAt:number;lockAt:number;contactAt:number;activeUntil:number;recoveryUntil:number;direction:Point;locked:boolean;shape:"sweep";range:number;halfAngle:number;parryable:boolean;damage:number;cancelled:boolean;resolved:boolean;emitted:boolean;motionAt:number;scanAt:number;previousGeometry?:AttackGeometry;geometry?:AttackGeometry;actualContactAt?:number;chargeSound?:boolean;strikeSound?:boolean;wallAt?:number;launched?:boolean};
export type EnemyContact={at:number;attack:EnemyAttack;origin:Point;geometry?:AttackGeometry;normal?:Point;training?:boolean;projectileId?:string;targetId?:string;bossHazardId?:string;blastId?:string;sampledPoint?:Point};
export const SPORE = { speed: 250, life: 1600, radius: 14, muzzle: 24, burst: 260 } as const;
// 旧规则和首领保留原弹体；新参数在正式攻击起手时快照，渲染与结算共用。
export function projectileProfile(a:Pick<EnemyAttack,'projectile'|'boss'>):ProjectileProfile {
 return a.boss?{speed:SPORE.speed,life:SPORE.life,radius:SPORE.radius,distance:400,size:20,needleSize:36}:a.projectile??{speed:SPORE.speed,life:SPORE.life,radius:SPORE.radius,distance:400,size:20,needleSize:36};
}
export function ordinaryProjectile(tier:1|2):ProjectileProfile {
 const speed=tier===2?400:350;return {speed,life:400/speed*1000,radius:tier===2?20:18,distance:400,size:tier===2?40:36,needleSize:tier===2?52:48};
}
export function attackResistsLightHit(a:EnemyAttack|undefined|null,now:number){return !!a&&!a.boss&&!a.cancelled&&(a.combatTier??0)>0&&['wolf','shade','boar','raven'].includes(a.type)&&now>=a.lockAt&&now<a.activeUntil;}
export function sporeOrigin(root:Point,d:Point,boss=false):Point{const muzzle=boss?SPORE.radius:SPORE.muzzle;return {x:root.x+d.x*muzzle,y:root.y+d.y*muzzle};}
export function sporeContactAt(origin:Point,d:Point,target:Point,started:number,ended:number,clear=clearMeleeLine,speed:number=SPORE.speed,radius:number=SPORE.radius):number|null {
 const dx=target.x-origin.x,dy=target.y-origin.y,along=dx*d.x+dy*d.y,side2=dx*dx+dy*dy-along*along;
 if(side2>radius*radius+1e-7||along<0&&Math.hypot(dx,dy)>radius)return null;
 const travel=Math.max(0,along-Math.sqrt(Math.max(0,radius*radius-side2))),time=started+travel/speed*1000;
 return time<=ended+1e-7&&projectilePathClear(origin,{x:origin.x+d.x*travel,y:origin.y+d.y*travel},radius,clear)?time:null;
}
export function aim(origin:Point,target:Point,fallback:Point={x:0,y:1}):Point {const d=Math.hypot(target.x-origin.x,target.y-origin.y);return d>1e-7?{x:(target.x-origin.x)/d,y:(target.y-origin.y)/d}:{...fallback};}
function baseEnemyAttack(attackerId:string,serial:number,type:string,now:number,origin:Point,target:Point,windup?:number,elite?:EliteKind,combatTier:CombatTier=0,chainPart?:1|2):EnemyAttack {
 const kind=enemyBehavior(type),base=ENEMY_ATTACK[kind],combo=elite==='alpha'?(serial%2?1:2):undefined;
 const m=elite==='alpha'?{...base,windup:650,lock:280,step:150,recovery:combo===1?140:1100}:elite==='ram'?{...base,windup:850,lock:400,active:400,step:300,recovery:1000}:elite==='brood'?{...base,windup:900,lock:350,recovery:1000}:base,duration=windup??(kind==='spore'&&!elite&&serial%2===0?880:m.windup);
 // contactAt只表示攻击段起点；首次真实接触另记actualContactAt。
 return {attackId:`${attackerId}:${serial}`,attackerId,type:kind,combatTier,...combatTier?{aimTarget:{x:target.x,y:target.y},aimAt:now}:{},...chainPart?{chainPart}:{},...combatTier&&['spore','archer'].includes(kind)?{projectile:ordinaryProjectile(combatTier)}:{},...kind==='spore'&&!elite&&serial%2===0?{shotAngles:[-.62,0,.62]}: {},...kind==='bomber'?{bombAt:now+duration+m.active+1000,parryable:false}: {},...elite?{elite,step:m.step,combo}: {},startedAt:now,lockAt:now+duration-m.lock,contactAt:now+duration,activeUntil:now+duration+m.active,recoveryUntil:now+duration+m.active+m.recovery,direction:aim(origin,target),locked:false,shape:"sweep",range:ENEMY_ATTACK.range,halfAngle:ENEMY_ATTACK.halfAngle,parryable:kind!=='bomber'&&kind!=='priest',damage:type==='canyonHunter'?18:type==='cliffLancer'?26:type==='cragAxeman'?(serial%2?40:72):m.damage,cancelled:false,resolved:false,emitted:false,motionAt:0,scanAt:now};
}
export const creatureCooldown=(a:EnemyAttack)=>a.elite==='alpha'?a.recoveryUntil+(a.combo===1?0:900):a.elite?a.recoveryUntil+800:a.contactAt+ENEMY_ATTACK[enemyBehavior(a.type)].cooldown;
// 母孢中央弹沿锁向发射，两侧弹交替扇区；锁向后弹道固定，身份独立。
export function sporeDirections(a:EnemyAttack):Point[]{
 if(a.bossShotAngles||a.shotAngles){const angle=Math.atan2(a.direction.y,a.direction.x);return (a.bossShotAngles??a.shotAngles!).map(offset=>({x:Math.cos(angle+offset),y:Math.sin(angle+offset)}));}
 if(a.elite!=='brood')return [{...a.direction}];
 const serial=Number(a.attackId.split(':').at(-1)),shift=serial%2?.18:-.18,angle=Math.atan2(a.direction.y,a.direction.x);
 return [-.6,0,.6].map(offset=>({x:Math.cos(angle+offset+(offset===0?0:shift)),y:Math.sin(angle+offset+(offset===0?0:shift))}));
}
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
export function sampleEnemyAttack(a:EnemyAttack,now:number,root:Point) {
 const timing=sampleAttackTiming(now,a.startedAt,a.contactAt-a.startedAt,a.activeUntil-a.contactAt,a.recoveryUntil-a.activeUntil);
 const m=ENEMY_ATTACK[enemyBehavior(a.type)];const phase:"charge"|"commit"|"active"|"recovery"=now<a.lockAt?"charge":now<a.contactAt?"commit":now<a.activeUntil?"active":"recovery";
 const start=phase==="charge"?a.startedAt:phase==="commit"?a.lockAt:phase==="active"?a.contactAt:a.activeUntil,end=phase==="charge"?a.lockAt:phase==="commit"?a.contactAt:phase==="active"?a.activeUntil:a.recoveryUntil,progress=clamp((now-start)/(end-start)),active=clamp((now-a.contactAt)/(a.activeUntil-a.contactAt)),d=a.direction,angle=Math.atan2(d.y,d.x)+(a.type==="leaf"?-.85+active*1.7:0);
 const tip=a.type==='boar'?29:a.type==='raven'?21:a.type==='spore'?24:a.type==='wolf'?24:a.type==='guardian'?34:12;
 const geometry:AttackGeometry=a.bossGeometry?{kind:a.bossGeometry.kind,a:{x:root.x,y:root.y},b:{x:root.x,y:root.y},radius:a.bossGeometry.radius,halfAngle:a.bossGeometry.halfAngle,direction:{x:Math.cos(Math.atan2(d.y,d.x)+(a.bossGeometry.offset??0)+(a.bossGeometry.rear?Math.PI:0)),y:Math.sin(Math.atan2(d.y,d.x)+(a.bossGeometry.offset??0)+(a.bossGeometry.rear?Math.PI:0))}}:a.type==="leaf"?{a:{x:root.x+Math.cos(angle)*16,y:root.y+Math.sin(angle)*16},b:{x:root.x+Math.cos(angle)*59,y:root.y+Math.sin(angle)*59},radius:13}:{a:{x:root.x+d.x*tip,y:root.y+d.y*tip},b:{x:root.x+d.x*tip,y:root.y+d.y*tip},radius:a.type==='boar'?23:a.type==='raven'?24:a.type==='spore'?8:a.type==='wolf'?20:a.type==='guardian'?35:28};
 if(isWolfClaw(a)){geometry.a={...a.bossGeometry!.point};geometry.b={...geometry.a};geometry.radius=wolfClawRadius(a,now);}
 const offset=a.type==="slime"?phase==="active"?{x:0,y:-Math.sin(progress*Math.PI)*13}:phase==="recovery"?{x:0,y:-Math.sin(progress*Math.PI*2)*(1-progress)*4}:{x:0,y:phase==="commit"?-progress*3:progress*3}:{x:phase==="commit"?-d.x*progress*5:0,y:phase==="commit"?-d.y*progress*5:phase==="recovery"?Math.sin(progress*Math.PI)*2:0};
 if(a.type==='raven')offset.y=phase==='active'?-Math.sin(progress*Math.PI)*20:0;
 return {phase,progress,direction:{...d},frame:phase==="charge"?1:phase==="commit"?2:phase==="active"?2:progress<.35?3:0,offset,motion:(a.step??m.step)*active,geometry,previousGeometry:a.previousGeometry??geometry,warningProgress:clamp((now-a.startedAt)/(a.contactAt-a.startedAt)),stage:timing.phase,active:timing.active&&!a.cancelled};
}
export function geometryTouches(g:AttackGeometry,p:Point) {
 if(g.kind){const dx=p.x-g.a.x,dy=p.y-g.a.y,d=Math.hypot(dx,dy);return d<=g.radius+1e-7&&(g.inner===undefined||d>=g.inner-1e-7)&&(g.kind!=='sector'||d<1e-7||(dx*(g.direction?.x??0)+dy*(g.direction?.y??1))/d>=Math.cos(g.halfAngle??Math.PI)-1e-7);}
 const dx=g.b.x-g.a.x,dy=g.b.y-g.a.y,u=clamp(((p.x-g.a.x)*dx+(p.y-g.a.y)*dy)/(dx*dx+dy*dy||1));return Math.hypot(p.x-g.a.x-dx*u,p.y-g.a.y-dy*u)<=g.radius+1e-7;
}
export const attackTouches=(event:EnemyContact,p:Point)=>geometryTouches(event.geometry??sampleEnemyAttack(event.attack,event.at,event.origin).geometry,event.sampledPoint??p);
export function delayEnemyAttack(a:EnemyAttack,ms:number) {
 // 全部阶段共用有效时钟；受击暂停不让缩圈或姿态继续前进。
 if(a.bombAt!==undefined)a.bombAt+=ms;if(a.aimAt!==undefined)a.aimAt+=ms;
 for(const key of ["startedAt","lockAt","contactAt","activeUntil","recoveryUntil","scanAt"] as const)a[key]+=ms;
}
export function advanceEnemyAttack(a:EnemyAttack,root:Point,target:Point,now:number,space:AttackSpace={blocked:motionBlocked,clear:clearMotionLine,melee:clearMeleeLine}):EnemyContact|null {
 if(a.cancelled)return null;
 if(!a.locked){
  const previous=a.aimTarget??target,at=a.aimAt??a.startedAt,u=a.combatTier&&now>a.lockAt&&at<a.lockAt?Math.max(0,Math.min(1,(a.lockAt-at)/(now-at))):1,point={x:previous.x+(target.x-previous.x)*u,y:previous.y+(target.y-previous.y)*u};
  a.direction=aim(root,point,a.direction);if(a.type==='geomancer'&&a.areaPattern&&a.bossGeometry)a.bossGeometry.point=point;
  if(now+1e-7>=a.lockAt)a.locked=true;else if(a.combatTier){a.aimTarget={x:target.x,y:target.y};a.aimAt=now;}
 }
 // 孢子在世界层生成独立飞行实例，喷口不会同时造成第二份近战伤害。
 if(a.type==='priest'){a.scanAt=now;return null;}
 if(a.type==='bomber'){const next=sampleEnemyAttack(a,now,root).motion,delta=Math.max(0,next-a.motionAt);sweepMove(root,a.direction.x*delta,a.direction.y*delta,space.blocked,space.clear);a.motionAt=next;a.scanAt=now;return null;}
 if(a.bossLaser||a.bossShotAngles||a.bossArea||a.bossCocoon||['spore','archer','bell'].includes(a.type)&&!a.boss){a.scanAt=now;return null;}
 let cursor=Math.max(a.scanAt,a.contactAt),event:EnemyContact|null=null;const end=Math.min(now,a.activeUntil);
 // 小段扫描复用同一姿态几何；二分首次接触，不把尚未命中的候选标为已结算。
 while(cursor<=end+1e-7&&now>=a.contactAt) {
  let to=Math.min(end,cursor+5);const before={x:root.x,y:root.y},fromMotion=a.motionAt,next={...before};let nextMotion=sampleEnemyAttack(a,to,root).motion,wall:number|undefined,physicalWall=true;
  if(a.type==='boar'){
   const wanted={x:before.x+a.direction.x*(nextMotion-fromMotion),y:before.y+a.direction.y*(nextMotion-fromMotion)};
   if(space.blocked(wanted.x,wanted.y)||!space.clear(before,wanted)){
    physicalWall=space.wall?.(before,wanted)??true;
    let lo=0,hi=1;for(let i=0;i<20;i++){const u=(lo+hi)/2,p={x:before.x+(wanted.x-before.x)*u,y:before.y+(wanted.y-before.y)*u};if(space.blocked(p.x,p.y)||!space.clear(before,p))hi=u;else lo=u;}
    wall=cursor+(to-cursor)*lo;to=wall;nextMotion=sampleEnemyAttack(a,to,root).motion;
    Object.assign(next,{x:before.x+(wanted.x-before.x)*lo,y:before.y+(wanted.y-before.y)*lo});
   }else Object.assign(next,wanted);
  }else sweepMove(next,a.direction.x*(nextMotion-fromMotion),a.direction.y*(nextMotion-fromMotion),space.blocked,space.clear);
  const direct=space.clear(before,next);
  const at=(time:number)=>{const u=to>cursor?(time-cursor)/(to-cursor):1,origin=direct?{x:before.x+(next.x-before.x)*u,y:before.y+(next.y-before.y)*u}:{...before};
   // 沿碰撞角滑动的扫掠路径不能用直线插值切入禁行区；预测与首次接触复用真实移动。
   if(!direct)sweepMove(origin,a.direction.x*(nextMotion-fromMotion)*u,a.direction.y*(nextMotion-fromMotion)*u,space.blocked,space.clear);
   return {origin,geometry:sampleEnemyAttack(a,time,origin).geometry};};
  let first:number|null=null;
  if(!a.emitted&&!a.resolved)for(let t=cursor;t<=to+1e-7;t=Math.min(to,t+1)) {
   const s=at(t);if(geometryTouches(s.geometry,target)&&space.melee(s.origin,target,a.attackerId)) {let lo=Math.max(cursor,t-1),hi=t;for(let i=0;i<18&&hi-lo>1e-6;i++){const mid=(lo+hi)/2,g=at(mid);if(geometryTouches(g.geometry,target)&&space.melee(g.origin,target,a.attackerId))hi=mid;else lo=mid;}first=hi;break;}if(t>=to)break;
  }
  a.previousGeometry=a.geometry;
  if(first!==null){const s=at(first);Object.assign(root,s.origin);a.geometry=s.geometry;a.motionAt=fromMotion+(nextMotion-fromMotion)*(to>cursor?(first-cursor)/(to-cursor):1);a.scanAt=first;a.actualContactAt=first;a.emitted=true;event={at:first,attack:a,origin:s.origin,geometry:s.geometry,normal:{x:-a.direction.x,y:-a.direction.y}};break;}
  Object.assign(root,next);a.motionAt=nextMotion;a.geometry=sampleEnemyAttack(a,to,root).geometry;a.scanAt=to;
  if(wall!==undefined){if(physicalWall)a.wallAt=wall;a.cancelled=true;return null;}
  if(to>=end)break;cursor=to;
 }
 if(now>=a.activeUntil&&!event)a.resolved=true;
 return event;
}
export function predictEnemyContact(a:EnemyAttack,root:Point,target:Point,now:number,space:AttackSpace={blocked:motionBlocked,clear:clearMotionLine,melee:clearMeleeLine},pausedFor=0) {
 // 停止滚动后的爆点已经确定，伙伴可据真实膨胀危险保护附近队友。
 if(a.type==='bomber')return !a.cancelled&&!a.detonated&&a.bombAt!==undefined&&now>=a.activeUntil&&now<=a.bombAt&&Math.hypot(root.x-target.x,root.y-target.y)<=FUNGAL_BLAST_RADIUS&&space.melee(root,target)?a.bombAt+Math.max(0,pausedFor):null;
 if(a.type==='priest'||a.type==='bell'||a.cancelled||a.emitted||a.resolved||now>=a.activeUntil)return null;
 if(a.bossLaser||a.bossArea||a.bossCocoon)return null;
 if(['spore','archer'].includes(a.type)&&!a.boss||a.bossShotAngles){if(a.launched)return null;const profile=projectileProfile(a),release=a.contactAt+Math.max(0,pausedFor),contacts=sporeDirections({...a,direction:a.locked?a.direction:aim(root,target)}).map(d=>sporeContactAt(sporeOrigin(root,d,!!a.boss),d,target,release,release+profile.life,(x,y)=>space.melee(x,y,a.attackerId),profile.speed,profile.radius)).filter(t=>t!==null);return contacts.length?Math.min(...contacts):null;}
 // 只排除普通近战绝不可能触及的目标；范围内与首领仍使用原来的逐毫秒精确扫描。
 if(!a.boss&&!a.bossGeometry){
  const direction=a.locked?a.direction:aim(root,target,a.direction),g=sampleEnemyAttack({...a,direction},a.contactAt,root).geometry;
  const reach=Math.max(0,(a.step??ENEMY_ATTACK[enemyBehavior(a.type)].step)-a.motionAt)*Math.hypot(direction.x,direction.y)+g.radius+Math.max(Math.hypot(g.a.x-root.x,g.a.y-root.y),Math.hypot(g.b.x-root.x,g.b.y-root.y));
  if(Math.hypot(target.x-root.x,target.y-root.y)>reach+1e-7)return null;
 }
 const copy:EnemyAttack={...a,direction:{...a.direction}},point={x:root.x,y:root.y};delayEnemyAttack(copy,Math.max(0,pausedFor));return advanceEnemyAttack(copy,point,target,copy.activeUntil,space)?.at??null;}
export const warningQuality=(lead:number|null)=>lead===null||lead<0?"none":lead<PARRY.precise?"perfect":lead<PARRY.active?"normal":"charge";

export function createEnemyAttack(...args:Parameters<typeof baseEnemyAttack>):EnemyAttack {
 const a=baseEnemyAttack(...args),tier=a.combatTier??0,serial=args[1];
 if(a.type==='archer')a.shotAngles=tier&&serial%2===0?[-.35,0,.35]:[0];
 if(tier&&['spore','archer'].includes(a.type))a.lockAt=Math.min(a.lockAt,a.contactAt-250);
 if(a.type==='bell')a.parryable=false;
 if(a.type==='geomancer'){a.bossArea='circle';a.parryable=false;a.bossGeometry={kind:'circle',point:{x:args[5].x,y:args[5].y},radius:52,halfAngle:Math.PI};if(tier)a.areaPattern=serial%2?'center':'sides';}
 if(tier===2&&a.type==='leaf'){
  a.chainPart??=1;
  if(a.chainPart===2)Object.assign(a,{lockAt:a.startedAt+200,contactAt:a.startedAt+450,activeUntil:a.startedAt+580,recoveryUntil:a.startedAt+1230,step:48});
 }
 return a;
}
// 连段继续使用正式攻击编号；取消、重击硬直、弹反或换目标都会切断后续。
export function enemyFollowup(e:{id:string;type:string;attack?:EnemyAttack|null;attackSerial?:number;hp:number;staggerUntil:number;targetId?:string|null;x:number;y:number},target:Point,now:number,targetId:string,permit:boolean):EnemyAttack|null {
 const a=e.attack;if(!a||a.chainPart!==1||a.cancelled||now<a.recoveryUntil||now<e.staggerUntil||e.hp<=0||e.targetId!==targetId||!permit||Math.hypot(e.x-target.x,e.y-target.y)>175||!clearMeleeLine(e,target))return null;
 const next=createEnemyAttack(e.id,e.attackSerial=(e.attackSerial??0)+1,e.type,now,e,target,undefined,undefined,2,2);next.damage=a.damage;next.eventId=a.eventId;return next;
}
