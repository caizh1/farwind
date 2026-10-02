type Body={hp:number;disabled?:boolean};
type CombatWorld={enemies:readonly Body[];defense?:{enemies:readonly Body[]}};
// 夜袭部队与荒野、召唤、机关共用十二个活动敌对单位名额；友军不占用。
export const activeHostileCount=(w:CombatWorld)=>[...w.enemies,...w.defense?.enemies??[]].filter(e=>e.hp>0&&!e.disabled).length;
