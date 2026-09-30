import {PARRY} from './combat';
import {unit} from './combatFeedback';
import type {EnemyBody} from './enemy';
import type {CampBossKind} from '../../data/maps/windbell/campBosses';

// 四种体态共用真实弹反时钟；幅度只作用于素材，脚底碰撞根和硬直不变。
const PROFILES={
 'spore-heart':{turn:.13,lean:8,squash:.08,sway:.035,debris:'菌冠抖落'},
 'thorn-crown':{turn:.23,lean:11,squash:.045,sway:.045,debris:'爪下扬尘'},
 'crag-tusk':{turn:.17,lean:9,squash:.065,sway:.025,debris:'苔屑碎石'},
 'bound-branch':{turn:.25,lean:12,squash:.035,sway:.04,debris:'枝叶散落'},
} as const satisfies Record<CampBossKind,{turn:number;lean:number;squash:number;sway:number;debris:string}>;
type Body={hp?:number;boss?:CampBossKind;parried?:EnemyBody['parried'];bossBattle?:EnemyBody['bossBattle'];attack?:EnemyBody['attack']};
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const smooth=(n:number)=>{const u=clamp(n);return u*u*(3-2*u);};
export function sampleBossParry(body:Body,now:number){
 const p=body.parried,kind=body.boss,b=body.bossBattle;
 if(!kind||!p||(body.hp??1)<=0||now<p.at||now>=p.until||p.until<=p.at||b&&(now<b.entryUntil||now<b.transformUntil))return null;
 const elapsed=now-p.at,duration=p.until-p.at,profile=PROFILES[kind],quality=p.perfect?'perfect':'normal';
 const impact=Math.min(PARRY[quality].stop,duration*.1),peak=Math.min(155,duration*.3),recover=Math.min(180,duration*.35),recoverAt=duration-recover;
 const phase=elapsed<impact?'impact':elapsed<peak?'recoil':elapsed<recoverAt?'brace':'recover';
 const recoil=smooth((elapsed-impact)/(peak-impact)),recovery=smooth((elapsed-recoverAt)/recover);
 const strength=(phase==='impact'?.62:phase==='recoil'?.62+.38*recoil:1)*(1-recovery),power=p.perfect?1.4:1;
 const progress=phase==='impact'?0:phase==='recoil'?.2+.25*recoil:phase==='brace'?.5:.6+.4*clamp((elapsed-recoverAt)/recover);
 // 破护心茧复用失衡状态，其方向来自玩家斩击；先换成首领朝玩家的来袭方向。
 const incoming=body.attack?.bossCocoon?{x:-p.direction.x,y:-p.direction.y}:p.direction;
 const direction=unit(incoming),side=Math.abs(direction.x)>.1?Math.sign(direction.x):Math.sign(direction.y)||1;
 const wobble=phase==='brace'?Math.sin((elapsed-peak)/65)*profile.sway*strength:0;
 return {phase,elapsed,duration,progress,strength,quality,debris:profile.debris,direction,
  x:-direction.x*profile.lean*.35*strength*power,y:-direction.y*profile.lean*.2*strength*power,
  rotation:-side*(profile.turn*strength+wobble)*power,scaleX:1+profile.squash*.5*strength*power,scaleY:1-profile.squash*strength*power,
  // 撑地轻尘在最大失衡时释放一次；重复采样和读档不会重新喷发。
  braceAt:p.at+peak,braceElapsed:Math.max(0,elapsed-peak)};
}
export type BossParryPose=NonNullable<ReturnType<typeof sampleBossParry>>;
