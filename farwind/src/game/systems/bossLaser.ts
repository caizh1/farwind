import type {AttackGeometry,EnemyAttack} from './enemyAttack';
import type {BossHazard} from './campBossState';
import type {Point} from './obstacles';

// 所有阶段共用正式战斗时钟。道数可调整，画面和伤害同时读取此配置。
export const BOSS_LASER={count:8,windup:1200,rays:600,pause:250,etch:1450,delay:500,echo:1450,recovery:900,reach:430,inner:52,radius:230,rayWidth:8,etchWidth:12,echoWidth:26} as const;
export const LASER_ETCH=BOSS_LASER.rays+BOSS_LASER.pause;
export const LASER_ECHO=LASER_ETCH+BOSS_LASER.etch+BOSS_LASER.delay;
export const LASER_DURATION=LASER_ECHO+BOSS_LASER.echo;
export type LaserStage='charge'|'rays'|'pause'|'etch'|'delay'|'echo'|'recover';
export const isBossLaser=(a:EnemyAttack|null|undefined)=>a?.boss==='bound-branch'&&a.bossSkill===6&&a.bossLaser===true;
export function laserSample(h:BossHazard,now:number){
 const t=now-h.activeAt;
 const stage:LaserStage=t<0?'charge':t<BOSS_LASER.rays?'rays':t<LASER_ETCH?'pause':t<LASER_ETCH+BOSS_LASER.etch?'etch':t<LASER_ECHO?'delay':t<LASER_DURATION?'echo':'recover';
 const progress=stage==='etch'?(t-LASER_ETCH)/BOSS_LASER.etch:stage==='echo'?(t-LASER_ECHO)/BOSS_LASER.echo:0;
 const start=h.laser!.angle,angle=start+Math.PI*2*progress;
 return {stage,progress,angle,start};
}
export function laserRays(h:BossHazard):AttackGeometry[]{
 return Array.from({length:h.laser!.count},(_,i)=>{const angle=h.laser!.angle+i*Math.PI*2/h.laser!.count,d={x:Math.cos(angle),y:Math.sin(angle)};
  const reach=h.laser!.reaches?.[i]??BOSS_LASER.reach;
  return {a:{x:h.point.x+d.x*Math.min(BOSS_LASER.inner,reach),y:h.point.y+d.y*Math.min(BOSS_LASER.inner,reach)},b:{x:h.point.x+d.x*reach,y:h.point.y+d.y*reach},radius:reach<BOSS_LASER.inner?0:BOSS_LASER.rayWidth};
 });
}
export function laserGeometries(h:BossHazard,now:number):AttackGeometry[]{
 const {stage,angle}=laserSample(h,now);
 if(stage==='rays')return laserRays(h);
 if(stage!=='etch'&&stage!=='echo')return [];
 const width=stage==='etch'?BOSS_LASER.etchWidth:BOSS_LASER.echoWidth,half=Math.min(stage==='etch'?.11:.2,Math.max(.0075,laserSample(h,now).progress*Math.PI));
 // 扇区带内半径，只扫圆周附近，不把圈内安全地面算成伤害。
 return [{kind:'sector',a:h.point,b:h.point,radius:h.radius+width/2,inner:h.radius-width/2,direction:{x:Math.cos(angle-half),y:Math.sin(angle-half)},halfAngle:half}];
}
export function clipLaserRays(h:BossHazard,clear:(a:Point,b:Point)=>boolean){
 if(h.laser!.reaches)return;
 h.laser!.reaches=laserRays(h).map(g=>{
  if(clear(h.point,g.b))return BOSS_LASER.reach;
  let lo=0,hi:number=BOSS_LASER.reach;
  const d={x:(g.b.x-h.point.x)/BOSS_LASER.reach,y:(g.b.y-h.point.y)/BOSS_LASER.reach};
  for(let i=0;i<12;i++){const mid=(lo+hi)/2;if(clear(h.point,{x:h.point.x+d.x*mid,y:h.point.y+d.y*mid}))lo=mid;else hi=mid;}return lo;
 });
}
export function laserHazard(a:EnemyAttack):BossHazard{
 return {id:a.attackId+':赤环',owner:a.attackerId,attempt:a.bossAttempt??0,kind:'ring',point:{...a.bossGeometry!.point},born:a.startedAt,activeAt:a.contactAt,expires:a.activeUntil,radius:BOSS_LASER.radius,speed:0,damage:a.damage,used:[],laser:{count:BOSS_LASER.count,angle:Math.atan2(a.direction.y,a.direction.x)}};
}
export function laserPoint(h:BossHazard,angle:number,radius=h.radius):Point{return {x:h.point.x+Math.cos(angle)*radius,y:h.point.y+Math.sin(angle)*radius};}
