import {MAX_COINS} from '../../data/economy';
import type {State} from './state';
import {unitState,settleEncounterDeath} from './encounterState';
import {encounterUnit} from '../../data/maps/windbell/encounters';
import {seedHash} from './windGifts';

// 固定主线结晶必掉；普通资源由实例身份和存档种子决定，死亡通知与读档不重抽。
export const combatResourceDrop=(id:string,seed:number,required=false)=>required||seedHash(`${id}:掉落`,seed)%100<25;

export const combatCoinValue=(enemy:{elite?:unknown;boss?:unknown})=>enemy.boss?35:enemy.elite?8:3;
// 调用者必须已经通过正式死亡的幂等门禁；满包不影响钱包，溢出不建待领队列。
export function creditCombatCoins(s:State,enemy:{elite?:unknown;boss?:unknown},eligible:boolean){
 const amount=eligible?Math.min(MAX_COINS-s.coins,combatCoinValue(enemy)):0;
 s.coins+=amount;return amount;
}
// 死亡标记与金币修改属于同一个快照，读档后不会重新发奖。
export function settleEncounterCoins(s:State,id:string,direct:boolean,rewardDrop:boolean){
 const member=unitState(s.windMemory.active?.encounters??s.encounters,id),definition=encounterUnit(id);
 const eligible=direct||!!member?.participated;
 if(!definition||!settleEncounterDeath(s.windMemory.active?.encounters??s.encounters,id,s.windMemory.active?false:rewardDrop))return null;
 return s.windMemory.active?0:creditCombatCoins(s,definition,eligible);
}
