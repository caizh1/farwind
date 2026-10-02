import type {EliteKind} from '../../data/maps/windbell/elites';
import type { Facing } from './locomotion';
import { enemyProfile, enemyKind } from '../../data/enemies';
import { SlimeAnimation, timedPose, slimeFacing, SLIME_TIMES, type SlimeBody, type SlimePose } from './slimeAnimation';
import type { EnemyAttack } from './enemyAttack';
import type {CampBossKind} from '../../data/maps/windbell/campBosses';
import type {BossBattle} from './campBossState';
export type EnemyPose = Omit<SlimePose,'action'|'provisional'> & {action:SlimePose['action']|'wall';provisional:boolean};
export type AnimatedEnemy = SlimeBody & {type:string;passiveRoot?:{owner:string;index:number;attempt:number;kind?:'root'|'sac'|'rock'|'sigil'};hurtboxFacing?:Facing;boss?:CampBossKind;bossBattle?:BossBattle;maxHP?:number;eliteLevel?:number;elite?:EliteKind;face?:{x:number;y:number};wallHit?:{at:number;until:number}};
export class EnemyAnimation {
  motion=new SlimeAnimation();
  sample(body:AnimatedEnemy,attack:EnemyAttack|null|undefined,now:number):EnemyPose {
    const base=this.motion.sample(body,attack,now),kind=enemyKind(body.type);
    if(kind==='slime')return base;
    if(kind==='guardian'&&body.face&&!attack&&['idle','walk'].includes(base.action))base.facing=slimeFacing(body.face.x,body.face.y,base.facing);
    const profile=enemyProfile(kind),block=(base.facing===0?0:base.facing===1?1:2)*profile.frames;
    if(kind==='leaf'||kind==='spore') {
      if(base.action==='walk') {
        const index=Math.floor((this.motion.distance%profile.stride)/profile.stride*8);
        return {...base,index,frame:block+4+index};
      }
      if(base.action==='attack'&&attack) {
        const charge=attack.lockAt-attack.startedAt,lock=attack.contactAt-attack.lockAt,active=attack.activeUntil-attack.contactAt,recovery=attack.recoveryUntil-attack.activeUntil;
        // 四格蓄力、一格锁向、三格出手、四格收招；出手不能提前至锁向期。
        const boundaries=[0,charge*.25,charge*.55,charge*.8,charge,charge+lock,charge+lock+active/3,charge+lock+active*2/3,charge+lock+active,charge+lock+active+recovery*.25,charge+lock+active+recovery*.5,charge+lock+active+recovery*.75];
        let index=0;for(let i=1;i<boundaries.length;i++)if(base.elapsed>=boundaries[i])index=i;
        return {...base,index,frame:block+12+index,phase:index<4?'charge':index<5?'commit':index<8?'active':'recovery'};
      }
      return base;
    }
    let frame=base.index,index=base.index,action:EnemyPose['action']=base.action,phase=base.phase;
    if(action!=='death'&&action!=='parry'&&action!=='perfect'&&kind==='boar'&&body.wallHit&&now<body.wallHit.until){
      action='wall';phase='stagger';index=timedPose([100,180,360,210],now-body.wallHit.at);frame=36+index;
    }else if(action==='walk'){index=Math.floor((this.motion.distance%profile.stride)/profile.stride*4);frame=4+index;}
    else if(action==='attack'&&attack){
      const charge=attack.lockAt-attack.startedAt,lock=attack.contactAt-attack.lockAt,active=attack.activeUntil-attack.contactAt,recovery=attack.recoveryUntil-attack.activeUntil;
      const boundaries=[0,charge*.6,charge,charge+lock*.5,charge+lock,charge+lock+active*.5,charge+lock+active,charge+lock+active+recovery*.55];
      index=0;for(let i=1;i<8;i++)if(base.elapsed>=boundaries[i])index=i;frame=8+index;phase=index<2?'charge':index<4?'commit':index<6?'active':'recovery';
    }else if(action==='hurt')frame=16+index;
    else if(action==='death'){index=timedPose([140,230,350,580],base.elapsed);frame=20+index;}
    else if(action==='parry'||action==='perfect'){
      if(profile.frames===24){index=base.phase==='impact'?0:base.phase==='stagger'?1:2+Math.min(1,Math.floor((base.index-7)/3));frame=16+index;}
      else frame=24+index;
    }
    return {...base,action,phase,index,frame:block+frame};
  }
}
// 前摇、弹反、暂停和实际步态沿用已验证的史莱姆采样器，物种仅映射独立姿态。
export {SLIME_TIMES};
