import {enemyProfile} from './enemies';

export const DEMON_KING = {
  name: '？？？',
  title: '寂冠之王',
  firstWords: '这片土地，也有它们活下去的位置。',
  firstAppearance: '风声忽然停了一瞬。远处的黑焰中，一顶破碎的王冠缓缓转动。那个身影没有追来，只留下低沉的话语。',
  maxUnits: 10,
  spawnGap: 52,
  profileVersion: 1,
} as const;
export type RaidOrder = {source: 'wild' | 'demon-king'; malice: number; profileVersion: 1};
export function historicalRaidMember(value:unknown) {
  if(typeof value!=='string')return false;
  const match=/^(?:east-raid|raid)-([1-9][0-9]{0,9}):([1-9][0-9]?)$/.exec(value);
  return !!match&&Number(match[1])<=1e9&&Number(match[2])<=DEMON_KING.maxUnits;
}
export const wildOrder = ():RaidOrder => ({source:'wild',malice:0,profileVersion:1});
export function validRaidOrder(order: RaidOrder | undefined) {
  return order === undefined || !!order && order.profileVersion === 1 && Number.isSafeInteger(order.malice) &&
    order.malice >= 0 && order.malice <= 1e6 &&
    (order.source === 'wild' ? order.malice === 0 : order.source === 'demon-king' && order.malice > 0);
}
export function maliceTier(malice:number) {
  if (!Number.isSafeInteger(malice) || malice < 0 || malice > 1e6) throw Error('魔王恶意值无效。');
  return malice === 0 ? 0 : 1 + Math.floor(malice / 10);
}
export function demonFormation(malice:number, baseCount:number) {
  const tier = maliceTier(malice);
  if (!Number.isInteger(baseCount) || baseCount < 1 || baseCount > 3) throw Error('基础袭村编队无效。');
  const count = tier === 0 ? baseCount : Math.min(DEMON_KING.maxUnits, baseCount + 5 + tier - 1);
  const eliteLevel = Math.floor(malice / 10);
  const elites = eliteLevel === 0 ? 0 : Math.min(4, 1 + Math.floor(malice / 20));
  return {tier,count,eliteLevel,elites};
}
// 事件快照的版本固定；所有实际生命、伤害和血条读取同一配置。
export function raidUnitProfile(type:string, eliteLevel=0, profileVersion=1) {
  if (!['slime','leaf'].includes(type) || !Number.isSafeInteger(eliteLevel) || eliteLevel < 0 || eliteLevel > 1e5 || profileVersion !== 1)
    throw Error('来袭魔物属性配置无效。');
  return {maxHP:Math.round(enemyProfile(type).hp * (1 + eliteLevel * .3)), damage:(type === 'leaf' ? 18 : 10) + eliteLevel * 4};
}
export function maliceMood(malice:number) {
  return malice === 0 ? '容忍共存' : malice < 10 ? '戒备与驱逐' : malice < 20 ? '王令报复' : malice < 30 ? '全面敌对' : '战争';
}
