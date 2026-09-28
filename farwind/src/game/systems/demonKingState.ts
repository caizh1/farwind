import {ENCOUNTERS} from '../../data/maps/windbell/encounters';
import {DEMON_KING, demonFormation, maliceMood} from '../../data/demonKing';
import type {EncounterState} from './encounterState';
import type {State} from './state';
export type DemonKingState = {introduced:boolean};
export const initialDemonKing = ():DemonKingState => ({introduced:false});
// 已清剿据点本身就是去重后的持久化事实，不另存可漂移的计数器。
export const demonMalice = (encounters:EncounterState) => ENCOUNTERS.filter(d => d.kind === 'camp' && encounters.groups[d.id]?.cleared).length;
export function validateDemonKing(s:State):DemonKingState {
  if (!s.demonKing || typeof s.demonKing.introduced !== 'boolean' || s.demonKing.introduced && demonMalice(s.encounters) === 0)
    throw Error('魔王初见记录与清剿进度不一致。');
  return {introduced:s.demonKing.introduced};
}
export function demonKingIntroduction(s:State) {
  if (!demonMalice(s.encounters) || s.demonKing.introduced) throw Error('当前没有待观看的魔王初见。');
  const next = structuredClone(s); next.demonKing.introduced = true; return next;
}
export function demonKingSummary(s:State) {
  const malice = demonMalice(s.encounters), f = demonFormation(malice,1);
  return `${DEMON_KING.name} · 恶意 ${malice} · ${maliceMood(malice)}${f.tier ? ` · 第${f.tier}档` : ''}`;
}
