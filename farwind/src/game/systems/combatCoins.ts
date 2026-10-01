import {MAX_COINS} from '../../data/economy';
import type {State} from './state';
import {unitState,settleEncounterDeath} from './encounterState';
import {encounterUnit} from '../../data/maps/windbell/encounters';

export const combatCoinValue=(enemy:{elite?:unknown;boss?:unknown})=>enemy.boss?35:enemy.elite?8:3;
// 调用者必须已经通过正式死亡的幂等门禁；满包不影响钱包，溢出不建待领队列。
export function creditCombatCoins(s:State,enemy:{elite?:unknown;boss?:unknown},eligible:boolean){
 const amount=eligible?Math.min(MAX_COINS-s.coins,combatCoinValue(enemy)):0;
 s.coins+=amount;return amount;
}
// 死亡标记与金币修改属于同一个快照，读档后不会重新发奖。
export function settleEncounterCoins(s:State,id:string,direct:boolean,rewardDrop:boolean){
 const member=unitState(s.encounters,id),definition=encounterUnit(id);
 const eligible=direct||!!member?.participated;
 if(!definition||!settleEncounterDeath(s.encounters,id,rewardDrop))return null;
 return creditCombatCoins(s,definition,eligible);
}
