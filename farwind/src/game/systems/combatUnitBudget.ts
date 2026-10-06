type Body={hp:number;disabled?:boolean;eastCloneRestore?:{hp:number};bossBattle?:{cloneSpawnAt?:number;cloneUsed?:boolean}};
type CombatWorld={enemies:readonly Body[];defense?:{enemies:readonly Body[]};wilderness?:{pendingCount:number};tradeRoad?:{pendingCount:number}};
// 夜袭部队与荒野、召唤、机关共用十二个活动敌对单位名额；友军不占用。
export const pendingEastClone=(e:Body)=>e.hp>0&&!e.disabled&&((e.eastCloneRestore?.hp??0)>0||e.bossBattle?.cloneSpawnAt!==undefined&&!e.bossBattle.cloneUsed);
export const activeHostileCount=(w:CombatWorld)=>[...w.enemies,...w.defense?.enemies??[]].filter(e=>e.hp>0&&!e.disabled).length+w.enemies.filter(pendingEastClone).length+(w.wilderness?.pendingCount??0)+(w.tradeRoad?.pendingCount??0);
// 返回原野时，恢复旧敌人也必须预留已在场敌人和出生预告的名额。
export function resumeHostile(w:CombatWorld,body:Body){if(body.hp<=0||!body.disabled||activeHostileCount(w)>=12)return false;body.disabled=false;return true;}
