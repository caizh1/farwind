import type {EnemyBody} from './enemy';
import type {Point} from './obstacles';
export const ENCOUNTER_TEMPO={radius:1100,melee:1,ranged:1,damage:2,heavy:1,support:1,viewMargin:70} as const;
export const enemyCombatRole=(e:Pick<EnemyBody,'type'|'passiveRoot'>)=>e.passiveRoot?'passive':e.type==='priest'?'support':e.type==='spore'?'ranged':['boar','burrow','guardian','bomber'].includes(e.type)?'heavy':'melee';
// 许可由仍在主要出手阶段的正式实例推导，无独立锁或计数器；死亡、取消、换目标和超时自然释放。
export function playerAttackPermitted(enemy:EnemyBody,targetId:string,player:Point,peers:readonly EnemyBody[],now:number,view?:{left:number;right:number;top:number;bottom:number}){
 if(targetId!=='player'&&!['bomber','priest'].includes(enemy.type)||Math.hypot(enemy.x-player.x,enemy.y-player.y)>ENCOUNTER_TEMPO.radius)return true;
 if(view&&(enemy.x<view.left-ENCOUNTER_TEMPO.viewMargin||enemy.x>view.right+ENCOUNTER_TEMPO.viewMargin||enemy.y<view.top-ENCOUNTER_TEMPO.viewMargin||enemy.y>view.bottom+ENCOUNTER_TEMPO.viewMargin))return false;
 if(enemy.boss)return true;
 const role=enemyCombatRole(enemy),live=peers.filter(e=>e!==enemy&&e.hp>0&&!e.disabled&&!e.boss&&(e.targetId==='player'||['bomber','priest'].includes(e.type))&&Math.hypot(e.x-player.x,e.y-player.y)<=ENCOUNTER_TEMPO.radius&&e.attack&&!e.attack.cancelled&&now<(e.attack.bombAt??e.attack.activeUntil));
 if(role==='support')return live.filter(e=>enemyCombatRole(e)==='support').length<ENCOUNTER_TEMPO.support;
 const damaging=live.filter(e=>!['support','passive'].includes(enemyCombatRole(e))),boss=peers.some(e=>e.boss&&e.hp>0&&!e.disabled&&Math.hypot(e.x-player.x,e.y-player.y)<ENCOUNTER_TEMPO.radius);
 if(damaging.length>=(boss?1:ENCOUNTER_TEMPO.damage))return false;
 if(role==='heavy'&&damaging.some(e=>enemyCombatRole(e)==='heavy'))return false;
 return damaging.filter(e=>(enemyCombatRole(e)==='ranged')===(role==='ranged')).length<(role==='ranged'?ENCOUNTER_TEMPO.ranged:ENCOUNTER_TEMPO.melee);
}
