import {EXTRA_WIND_GIFTS} from '../game/systems/windGiftCatalog';
import type {WindGiftState} from '../game/systems/windGifts';

// 实战与教学预览共用纯数值定义，预览无需加载战斗引擎。
export const BLACK_HOLE={speed:900,width:48,radius:180,pullSpeed:260,core:18,open:240,hold:1440,close:320,dps:.4,tick:250,tickBonus:3,tickDamageCap:10,maxRifts:4} as const;
export const blackHoleChance=(level:number)=>level>0?Math.min(10,4+level)/100:0;
// 保留一级的普攻系数，每次升级给每250毫秒的跳伤加3点，单跳10点封顶。
export const blackHoleDps=(A:number,level:number)=>level>0?Math.min(BLACK_HOLE.tickDamageCap,A*BLACK_HOLE.dps*BLACK_HOLE.tick/1000+BLACK_HOLE.tickBonus*(level-1))*1000/BLACK_HOLE.tick:0;
export type BlackHoleConfig={radius:number;pullRadius:number;hold:number};
export function blackHoleConfig(gifts?:Pick<WindGiftState,'held'>):BlackHoleConfig{
 const bonus=(id:'riftRadius'|'riftSuction'|'riftDuration')=>Math.min(EXTRA_WIND_GIFTS[id].cap,EXTRA_WIND_GIFTS[id].value*(gifts?.held.find(g=>g.id===id)?.level??0));
 const radius=BLACK_HOLE.radius*(1+bonus('riftRadius'));
 return {radius,pullRadius:radius+BLACK_HOLE.radius*bonus('riftSuction'),hold:BLACK_HOLE.hold+bonus('riftDuration')+bonus('riftRadius')*3000};
}
