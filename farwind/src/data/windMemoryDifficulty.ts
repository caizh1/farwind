// 规则版本固定在远征实例中；旧实例不携带此字段，继续使用原有强度。
export type WindMemoryDifficulty={version:1;level:number};
export const MEMORY_LIMIT=1_000_000_000;
export function memoryStrength(difficulty:WindMemoryDifficulty|undefined,strong=false){
 const n=difficulty?.level??0;
 return {health:1+n*(strong ? .18 : .12),damage:1+n*(strong ? .08 : .06),movement:1+Math.min(.5,n*.05),attack:1+Math.min(strong ? .4 : .3,n*(strong ? .04 : .03)),frequency:1+Math.min(strong ? .6 : .5,n*(strong ? .06 : .05))};
}
export const memoryHealth=(base:number,difficulty?:WindMemoryDifficulty,strong=false)=>Math.ceil(base*memoryStrength(difficulty,strong).health);
export const memoryCoins=(base:number,difficulty?:WindMemoryDifficulty)=>Math.ceil(base*(1+(difficulty?.level??0)*.1));
export function validateMemoryDifficulty(raw:unknown):WindMemoryDifficulty|undefined{
 if(raw===undefined)return;
 const d=raw as WindMemoryDifficulty;
 if(!d||d.version!==1||!Number.isSafeInteger(d.level)||d.level<1||d.level>MEMORY_LIMIT)throw Error('风忆强度记录无效。');
 return {version:1,level:d.level};
}
