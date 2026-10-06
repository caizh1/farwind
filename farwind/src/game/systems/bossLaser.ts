import type {AttackGeometry,EnemyAttack} from './enemyAttack';
import type {BossHazard} from './campBossState';
import type {Point} from './obstacles';

// 新攻击快照样式；无版本的存档继续完成原来的单圈招式。
export const BOSS_LASER={count:8,windup:1200,rays:5000,pause:250,etch:1450,delay:500,echo:1450,recovery:900,reach:430,inner:52,radius:360,rayWidth:14,etchWidth:12,echoWidth:26,rotation:Math.PI/5,hitCooldown:1000} as const;
const LEGACY_LASER={...BOSS_LASER,rays:600,radius:230,rayWidth:8,rotation:0};
export const LASER_RADII=[140,250,360] as const;
export const LASER_ETCH=BOSS_LASER.rays+BOSS_LASER.pause;
export const LASER_ECHO=LASER_ETCH+BOSS_LASER.etch+BOSS_LASER.delay;
export const LASER_DURATION=LASER_ECHO+BOSS_LASER.echo;
export type LaserStage='charge'|'rays'|'pause'|'etch'|'delay'|'echo'|'recover';
export const isBossLaser=(a:EnemyAttack|null|undefined)=>a?.boss==='bound-branch'&&a.bossSkill===6&&a.bossLaser===true;
export const laserConfig=(h:BossHazard)=>h.laser?.version===2?BOSS_LASER:LEGACY_LASER;
export const laserRadii=(h:BossHazard)=>h.laser?.version===2?h.laser.radii??LASER_RADII:[h.radius];
export function laserSample(h:BossHazard,now:number){
 const c=laserConfig(h),t=now-h.activeAt,etch=c.rays+c.pause,echo=etch+c.etch+c.delay;
 const stage:LaserStage=t<0?'charge':t<c.rays?'rays':t<etch?'pause':t<etch+c.etch?'etch':t<echo?'delay':t<echo+c.echo?'echo':'recover';
 const progress=stage==='etch'?(t-etch)/c.etch:stage==='echo'?(t-echo)/c.echo:0;
 const start=h.laser!.angle,angle=stage==='rays'?start+c.rotation*Math.max(0,t)/1000:start+Math.PI*2*progress;
 return {stage,progress,angle,start,etch,echo};
}
export function laserRays(h:BossHazard,now=h.activeAt):AttackGeometry[]{
 const c=laserConfig(h),base=laserSample(h,now).angle;
 return Array.from({length:h.laser!.count},(_,i)=>{const angle=base+i*Math.PI*2/h.laser!.count,d={x:Math.cos(angle),y:Math.sin(angle)},reach=h.laser!.reaches?.[i]??c.reach;
  return {a:{x:h.point.x+d.x*Math.min(c.inner,reach),y:h.point.y+d.y*Math.min(c.inner,reach)},b:{x:h.point.x+d.x*reach,y:h.point.y+d.y*reach},radius:reach<c.inner?0:c.rayWidth};
 });
}
export function laserGeometries(h:BossHazard,now:number):AttackGeometry[]{
 const {stage,angle,progress}=laserSample(h,now),c=laserConfig(h);
 if(stage==='rays')return laserRays(h,now);
 if(stage!=='etch'&&stage!=='echo')return [];
 const width=stage==='etch'?c.etchWidth:c.echoWidth,half=Math.min(stage==='etch'?.11:.2,Math.max(.0075,progress*Math.PI));
 return laserRadii(h).map(radius=>({kind:'sector',a:h.point,b:h.point,radius:radius+width/2,inner:radius-width/2,direction:{x:Math.cos(angle-half),y:Math.sin(angle-half)},halfAngle:half}));
}
const clips=new WeakMap<BossHazard,{x:number;y:number;angle:number}>();
export function clipLaserRays(h:BossHazard,clear:(a:Point,b:Point)=>boolean,now=h.activeAt){
 const angle=laserSample(h,now).angle,previous=clips.get(h);
 if(h.laser!.version!==2&&h.laser!.reaches)return;
 if(previous&&previous.x===h.point.x&&previous.y===h.point.y&&previous.angle===angle)return;
 // 同一时刻供伙伴、主角和绘制共用，原点或方向变化必须重算。
 clips.set(h,{...h.point,angle});h.laser!.reaches=undefined;
 h.laser!.reaches=laserRays(h,now).map(g=>{
  if(clear(h.point,g.b))return BOSS_LASER.reach;
  let lo=0,hi:number=BOSS_LASER.reach;
  const d={x:(g.b.x-h.point.x)/BOSS_LASER.reach,y:(g.b.y-h.point.y)/BOSS_LASER.reach};
  for(let i=0;i<12;i++){const mid=(lo+hi)/2;if(clear(h.point,{x:h.point.x+d.x*mid,y:h.point.y+d.y*mid}))lo=mid;else hi=mid;}return lo;
 });
}
export function laserHitKey(h:BossHazard,stage:LaserStage,ring:number,target:string){return h.laser!.version===2&&stage!=='rays'?`${stage}:${ring}:${target}`:`${stage}:${target}`;}
export function laserCanHit(h:BossHazard,now:number,ring:number,target:string){
 const stage=laserSample(h,now).stage;
 return stage==='rays'&&h.laser!.version===2?now-(h.laser!.rayHits?.[target]??-Infinity)>=BOSS_LASER.hitCooldown:!h.used.includes(laserHitKey(h,stage,ring,target));
}
export function laserHazard(a:EnemyAttack):BossHazard{
 const modern=a.bossLaserVersion===2;
 return {id:a.attackId+':赤环',owner:a.attackerId,attempt:a.bossAttempt??0,kind:'ring',point:{...a.bossGeometry!.point},born:a.startedAt,activeAt:a.contactAt,expires:a.activeUntil,radius:modern?360:230,speed:0,damage:a.damage,used:[],laser:{count:BOSS_LASER.count,angle:Math.atan2(a.direction.y,a.direction.x),...modern?{version:2,radii:[...LASER_RADII],rayHits:{},centerLocked:false}:{}}};
}
export function laserPoint(h:BossHazard,angle:number,radius=h.radius):Point{return {x:h.point.x+Math.cos(angle)*radius,y:h.point.y+Math.sin(angle)*radius};}
