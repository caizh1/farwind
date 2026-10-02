import {ENCOUNTERS} from '../../data/maps/windbell/encounters';
import {DEMON_KING, demonFormation, maliceMood} from '../../data/demonKing';
import type {EncounterState} from './encounterState';
import type {State} from './state';
export type DemonKingState = {introduced:boolean;retaliatedCamps?:string[]};
export const initialDemonKing = (encounters?:EncounterState):DemonKingState => ({introduced:false,retaliatedCamps:encounters?ENCOUNTERS.filter(d=>d.kind==='camp'&&encounters.groups[d.id]?.cleared).map(d=>d.id):[]});
// 已清剿据点本身就是去重后的持久化事实，不另存可漂移的计数器。
export const demonMalice = (encounters:EncounterState) => ENCOUNTERS.filter(d => d.kind === 'camp' && encounters.groups[d.id]?.cleared).length;
const clearedCamps=(s:State)=>ENCOUNTERS.filter(d=>d.kind==='camp'&&s.encounters.groups[d.id]?.cleared).map(d=>d.id);
export const pendingRetaliations=(s:State)=>clearedCamps(s).filter(id=>!(s.demonKing.retaliatedCamps??clearedCamps(s)).includes(id));
export function validateDemonKing(s:State):DemonKingState {
  if (!s.demonKing || typeof s.demonKing.introduced !== 'boolean' || s.demonKing.introduced && demonMalice(s.encounters) === 0)
    throw Error('魔王初见记录与清剿进度不一致。');
  // 旧存档只给已有清剿补基线，不在加载时回放历史报复。
  const camps=s.demonKing.retaliatedCamps===undefined?clearedCamps(s):s.demonKing.retaliatedCamps;
  const order=s.defense?.raid?.order;
  if(!Array.isArray(camps)||new Set(camps).size!==camps.length||camps.some(id=>!clearedCamps(s).includes(id))||
    order?.retaliationCamp&&(!camps.includes(order.retaliationCamp)||order.retaliationLevel!==undefined&&order.retaliationLevel!==camps.indexOf(order.retaliationCamp)+1))throw Error('魔王报复记录与据点清剿不一致。');
  return {introduced:s.demonKing.introduced,retaliatedCamps:[...camps]};
}
export function demonKingIntroduction(s:State) {
  if (!demonMalice(s.encounters) || s.demonKing.introduced) throw Error('当前没有待观看的魔王初见。');
  const next = structuredClone(s); next.demonKing.introduced = true; return next;
}
export function demonKingSummary(s:State) {
  const malice = demonMalice(s.encounters), f = demonFormation(malice,1);
  return `${DEMON_KING.name} · 恶意 ${malice} · ${maliceMood(malice)}${f.tier ? ` · 第${f.tier}档` : ''}`;
}
