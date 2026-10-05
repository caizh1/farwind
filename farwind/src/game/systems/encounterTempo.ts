import {combatRole} from '../../data/maps/windbell/encounters';
import {enemyBehavior} from '../../data/enemies';
import type {EnemyBody} from './enemy';
import type {Point} from './obstacles';
export const ENCOUNTER_TEMPO={radius:1100,melee:1,ranged:1,damage:2,heavy:1,support:1,viewMargin:70,startGap:250} as const;
export const enemyCombatRole=(e:Pick<EnemyBody,'type'|'passiveRoot'>)=>e.passiveRoot?'passive':combatRole(enemyBehavior(e.type));
export type AttackPressure=Point&{group:string;owner:string;type:EnemyBody['type'];until:number};
// 弹体与地面区沿用原出手组；一轮扇射只占一个远程槽。
export function playerAttackPermitted(enemy:EnemyBody,_targetId:string,player:Point,peers:readonly EnemyBody[],now:number,view?:{left:number;right:number;top:number;bottom:number},pressure:readonly AttackPressure[]=[]){
 if(Math.hypot(enemy.x-player.x,enemy.y-player.y)>ENCOUNTER_TEMPO.radius)return true;
 if(view&&(enemy.x<view.left-70||enemy.x>view.right+70||enemy.y<view.top-70||enemy.y>view.bottom+70))return false;
 if(enemy.boss)return true;
 const nearby=peers.filter(e=>!e.boss&&Math.hypot(e.x-player.x,e.y-player.y)<=ENCOUNTER_TEMPO.radius);
 if(enemy.combatTier&&nearby.some(e=>e!==enemy&&now-(e.lastAttackStarted??e.attack?.startedAt??-Infinity)<250))return false;
 const groups=new Map<string,ReturnType<typeof enemyCombatRole>>();
 for(const e of nearby)if(e!==enemy&&e.hp>0&&!e.disabled&&e.attack&&!e.attack.cancelled&&now<(e.attack.bombAt??e.attack.activeUntil))groups.set(e.attack.attackId,enemyCombatRole(e));
 for(const p of pressure)if(p.until>now&&Math.hypot(p.x-player.x,p.y-player.y)<=ENCOUNTER_TEMPO.radius)groups.set(p.group,combatRole(enemyBehavior(p.type)));
 const live=[...groups.values()],role=enemyCombatRole(enemy);
 if(role==='passive')return false;
 if(role==='support')return live.filter(r=>r==='support').length<1;
 const damaging=live.filter(r=>r!=='support'&&r!=='passive'),late=enemy.combatTier===2||nearby.some(e=>e.combatTier===2),boss=peers.some(e=>e.boss&&e.hp>0&&!e.disabled&&Math.hypot(e.x-player.x,e.y-player.y)<1100);
 if(damaging.length>=(boss?1:late?3:2))return false;
 if(role==='heavy'&&damaging.includes('heavy'))return false;
 return damaging.filter(r=>(r==='ranged')===(role==='ranged')).length<(role==='ranged'?1:enemy.combatTier?2:1);
}
