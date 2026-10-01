import {fungalShieldActive,FUNGAL} from './fungalCombat';
import type {Point} from './obstacles';
import type {EnemyBody} from './enemy';
import {CAMP_BOSSES,BOSS_RULES} from '../../data/maps/windbell/campBosses';
// 仅定义战斗差异；不拥有第二套生命、命中去重或世界实例。
export const GUARDIAN={turnSpeed:1.2,frontDot:.35,reduction:.65,breakMs:1200} as const;
export function turnToward(facing:Point,target:Point,seconds:number):Point{
 const angle=Math.atan2(facing.y,facing.x),wanted=Math.atan2(target.y,target.x),delta=Math.atan2(Math.sin(wanted-angle),Math.cos(wanted-angle));
 const step=Math.min(Math.abs(delta),GUARDIAN.turnSpeed*Math.max(0,seconds))*Math.sign(delta);
 return {x:Math.cos(angle+step),y:Math.sin(angle+step)};
}
export function enemyProtection(e:Pick<EnemyBody,'type'|'x'|'y'|'face'|'guardOpenUntil'|'staggerUntil'|'attack'|'boss'|'bossBattle'|'hp'|'fungalShield'>,origin:Point|undefined,now:number,breaksGuard=false){
 if(e.boss&&e.bossBattle){
  const b=e.bossBattle,a=e.attack,hpFloor=now<b.entryUntil||now<b.transformUntil?e.hp:b.phase===1?CAMP_BOSSES[e.boss].hp*.5:0;
  if(now<b.exposedUntil)return {reduction:0,hpFloor};
  if(a?.bossCocoon&&!a.cancelled&&now>=a.contactAt&&now<a.activeUntil){
   const d=origin?Math.hypot(origin.x-e.x,origin.y-e.y):0,back=!!origin&&d>0&&((origin.x-e.x)*a.direction.x+(origin.y-e.y)*a.direction.y)/d<-.35;
   if(breaksGuard||back){b.exposedUntil=now+BOSS_RULES.exposed;a.cancelled=true;e.staggerUntil=now+800;return {reduction:0,hpFloor};}
   return {reduction:.8,hpFloor};
  }
  if(e.boss==='spore-heart')return {reduction:b.phase===2?Math.min(.55,.15+(b.roots?.filter(r=>r.hp>0).length??0)*.2):.2,hpFloor};
  return {reduction:BOSS_RULES.reduction,hpFloor};
 }
 if(fungalShieldActive(e,now))return {reduction:FUNGAL.reduction};
 if(e.type!=='guardian')return {reduction:0};
 if(breaksGuard){if(now>=(e.guardOpenUntil??0))e.guardOpenUntil=now+GUARDIAN.breakMs;return {reduction:0};}
 if(now<(e.guardOpenUntil??0)||now<e.staggerUntil||e.attack&&now>=e.attack.activeUntil&&now<e.attack.recoveryUntil)return {reduction:0};
 if(!origin)return {reduction:0};
 const d=Math.hypot(origin.x-e.x,origin.y-e.y),f=e.face??e.attack?.direction??{x:0,y:1};
 return {reduction:d>0&&((origin.x-e.x)*f.x+(origin.y-e.y)*f.y)/d>GUARDIAN.frontDot?GUARDIAN.reduction:0};
}
export function wolfFlank(e:Pick<EnemyBody,'id'|'x'|'y'>,target:Point):Point{
 const d=Math.max(1,Math.hypot(e.x-target.x,e.y-target.y)),side=[...e.id].reduce((n,c)=>n+c.charCodeAt(0),0)%2?1:-1;
 return {x:target.x-(e.y-target.y)/d*100*side,y:target.y+(e.x-target.x)/d*100*side};
}
