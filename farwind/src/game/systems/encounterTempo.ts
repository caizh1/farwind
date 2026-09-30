import type {EnemyBody} from './enemy';
import type {Point} from './obstacles';
export const ENCOUNTER_TEMPO={radius:340,melee:1,ranged:1,viewMargin:70} as const;
// 许可由仍在主要出手阶段的正式实例推导，无独立锁或计数器；死亡、取消、换目标和超时自然释放。
export function playerAttackPermitted(enemy:EnemyBody,targetId:string,player:Point,peers:readonly EnemyBody[],now:number,view?:{left:number;right:number;top:number;bottom:number}){
 if(targetId!=='player'||Math.hypot(enemy.x-player.x,enemy.y-player.y)>ENCOUNTER_TEMPO.radius)return true;
 if(view&&(enemy.x<view.left-ENCOUNTER_TEMPO.viewMargin||enemy.x>view.right+ENCOUNTER_TEMPO.viewMargin||enemy.y<view.top-ENCOUNTER_TEMPO.viewMargin||enemy.y>view.bottom+ENCOUNTER_TEMPO.viewMargin))return false;
 const ranged=enemy.type==='spore',limit=ranged?ENCOUNTER_TEMPO.ranged:ENCOUNTER_TEMPO.melee;
 return peers.filter(e=>e!==enemy&&e.hp>0&&!e.disabled&&e.targetId==='player'&&Math.hypot(e.x-player.x,e.y-player.y)<=ENCOUNTER_TEMPO.radius&&(e.type==='spore')===ranged&&e.attack&&!e.attack.cancelled&&now<e.attack.activeUntil).length<limit;
}
