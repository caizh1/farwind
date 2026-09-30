import type {EnemyBody} from './enemy';
import {sweepMove,type StrikeConfig} from './combat';
import {motionBlocked,clearMotionLine,type Point} from './obstacles';
import {GUARDIAN} from './enemyTraits';
export const ENEMY_REACTION={light:90,heavy:125,maxDisplacement:36,interruptRecovery:420,slimeRecovery:240} as const;
export type EnemyRecoil={at:number;until:number;vector:Point;progress:number};

// 只在正式扣血完成后调用；受创、打断和破防分别记录，已释放弹体归独立系统。
export function reactToEnemyHit(e:EnemyBody,now:number,move:StrikeConfig,direction:Point,guarded:boolean,heavy:boolean,guardBroken=false){
 if(e.boss){
  const broken=e.bossBattle&&now<e.bossBattle.exposedUntil&&!!e.attack?.bossCocoon;
  if(broken){e.attack!.cancelled=true;e.parried={at:now,until:now+800,direction:{...direction},perfect:false};e.staggerUntil=now+800;e.staggerSince=now;}
  return {guarded,interrupted:!!broken,guardBroken:!!broken};
 }
 const a=e.attack,interruptible=heavy||e.type==='slime'&&!!a&&now<a.contactAt;
 const interrupted=interruptible&&!!a&&!a.cancelled&&!a.emitted&&!a.launched;
 if(interrupted){a!.cancelled=true;e.windup=0;e.cool=Math.max(e.cool,now+(heavy?ENEMY_REACTION.interruptRecovery:ENEMY_REACTION.slimeRecovery));}
 const stagger=guardBroken?GUARDIAN.breakMs:guarded?0:move.stagger;
 e.staggerUntil=Math.max(e.staggerUntil,now+stagger);e.staggerSince=now;
 if(guardBroken)e.parried={at:now,until:now+GUARDIAN.breakMs,direction:{...direction},perfect:false};
 const old=e.recoil,remaining=old?1-old.progress:0,n=Math.max(.001,Math.hypot(direction.x,direction.y));
 const vector={x:direction.x/n*move.knock*(guarded?.35:1)+(old?.vector.x??0)*remaining,y:direction.y/n*move.knock*(guarded?.35:1)+(old?.vector.y??0)*remaining};
 const length=Math.hypot(vector.x,vector.y),scale=Math.min(1,ENEMY_REACTION.maxDisplacement/Math.max(.001,length));
 e.recoil=e.hp<=0?undefined:{at:now,until:now+(heavy?ENEMY_REACTION.heavy:ENEMY_REACTION.light),vector:{x:vector.x*scale,y:vector.y*scale},progress:0};
 e.nav.path=[];e.nav.failed=false;
 return {guarded,interrupted,guardBroken};
}
export function advanceEnemyRecoil(e:Pick<EnemyBody,'x'|'y'|'recoil'>,now:number,blocked=motionBlocked,clear=clearMotionLine){
 const r=e.recoil;if(!r)return;
 const u=Math.max(0,Math.min(1,(now-r.at)/(r.until-r.at))),progress=1-(1-u)**2,step=Math.max(0,progress-r.progress);
 if(step>0)sweepMove(e,r.vector.x*step,r.vector.y*step,blocked,clear);
 r.progress=progress;if(u>=1)e.recoil=undefined;
}
