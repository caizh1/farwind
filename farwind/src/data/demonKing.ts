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
export type RaidOrder = {source: 'wild' | 'demon-king'; malice: number; profileVersion: 1; retaliationCamp?:string; retaliationLevel?:number};
// 报复部队沿已有荒野道路行军；起点位于地图边缘，村门仍走正式防御路径。
export const RETALIATION_ROUTES = {
  'east-gate': [{x:4190,y:1100},{x:3710,y:1100},{x:3040,y:1100},{x:2580,y:1100},{x:2140,y:1080}],
  'south-gate': [{x:1250,y:3320},{x:1250,y:2820},{x:1000,y:2450},{x:1050,y:2040},{x:900,y:1860}],
  'north-gate': [{x:1480,y:-1230},{x:1480,y:-730},{x:1030,y:-260},{x:560,y:-140},{x:620,y:120},{x:820,y:180}],
  'west-gate': [{x:-2010,y:1490},{x:-1700,y:1490},{x:-700,y:1340},{x:-340,y:1430},{x:40,y:1430}],
} as const;
export function historicalRaidMember(value:unknown) {
  if(typeof value!=='string')return false;
  const match=/^(?:east-raid|raid)-([1-9][0-9]{0,9}):([1-9][0-9]?)$/.exec(value);
  return !!match&&Number(match[1])<=1e9&&Number(match[2])<=DEMON_KING.maxUnits;
}
export const wildOrder = ():RaidOrder => ({source:'wild',malice:0,profileVersion:1});
export function validRaidOrder(order: RaidOrder | undefined) {
  return order === undefined || !!order && order.profileVersion === 1 && Number.isSafeInteger(order.malice) &&
    order.malice >= 0 && order.malice <= 1e6 &&
    (order.retaliationCamp===undefined||order.source==='demon-king'&&typeof order.retaliationCamp==='string'&&['south-spore-camp','west-wolf-den','north-boar-camp','east-thorn-camp'].includes(order.retaliationCamp)) &&
    (order.retaliationLevel===undefined||!!order.retaliationCamp&&Number.isSafeInteger(order.retaliationLevel)&&order.retaliationLevel>0&&order.retaliationLevel<=Math.min(order.malice,1e5)) &&
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
export function raidFormation(order:RaidOrder,baseCount:number) {
  const formation=demonFormation(order.malice,baseCount);
  // 新报复按波次逐阶增强，全员使用镰灵；缺少波次字段的旧在途编队保持原属性。
  if(order.retaliationLevel!==undefined)return {tier:order.retaliationLevel,count:DEMON_KING.maxUnits,eliteLevel:order.retaliationLevel,elites:DEMON_KING.maxUnits};
  return order.retaliationCamp?{...formation,count:DEMON_KING.maxUnits}:formation;
}
// 单夜至多一次骚扰；恶意0～4的来袭概率依次为50%、60%、70%、80%、90%。
export const harassmentChance = (malice:number) => Math.min(90,50+malice*10);
// 事件快照的版本固定；所有实际生命、伤害和血条读取同一配置。
export function raidUnitProfile(type:string, eliteLevel=0, profileVersion=1) {
  if (!['slime','leaf'].includes(type) || !Number.isSafeInteger(eliteLevel) || eliteLevel < 0 || eliteLevel > 1e5 || profileVersion !== 1)
    throw Error('来袭魔物属性配置无效。');
  return {maxHP:Math.round(enemyProfile(type).hp * (1 + eliteLevel * .3)), damage:(type === 'leaf' ? 18 : 10) + eliteLevel * 4};
}
export function retaliationSummary(order:RaidOrder) {
  if(order.retaliationLevel===undefined)return `${DEMON_KING.maxUnits} 只魔物`;
  const p=raidUnitProfile('leaf',order.retaliationLevel);
  return `${DEMON_KING.maxUnits} 只${enemyProfile('leaf').name} · 精英 ${order.retaliationLevel} 阶（每只生命 ${p.maxHP}，伤害 ${p.damage}）`;
}
export function maliceMood(malice:number) {
  return malice === 0 ? '容忍共存' : malice < 10 ? '戒备与驱逐' : malice < 20 ? '王令报复' : malice < 30 ? '全面敌对' : '战争';
}
