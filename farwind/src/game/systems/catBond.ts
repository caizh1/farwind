import { props, enemyDefs } from '../../data/world';
import { ENCOUNTERS } from '../../data/maps/windbell/encounters';
import { WORLD_BOUNDS } from '../../data/maps/windbell/bounds';
import type { State } from './state';

export const CAT_STAGES = [
  { score: 0, name: '熟悉', skill: '灵猫同行' },
  { score: 20, name: '亲近', skill: '寻风嗅迹' },
  { score: 45, name: '合拍', skill: '影爪共鸣' },
  { score: 75, name: '信赖', skill: '护主灵息' },
  { score: 100, name: '心有灵犀', skill: '四项能力强化' },
] as const;
export type CatCare = 'pet' | 'feed';
export type CatBondState = {
  score: number;
  memories: string[];
  day: number;
  pet: boolean;
  feed: boolean;
  rest: boolean;
  last: string;
  clawCooldown: number;
  guardCooldown: number;
  shield: number;
  shieldTime: number;
};
export const initialCatBond = (): CatBondState => ({
  score: 0, memories: [], day: 0, pet: false, feed: false, rest: false,
  last: '', clawCooldown: 0, guardCooldown: 0, shield: 0, shieldTime: 0,
});
export function catStage(score: number) {
  return CAT_STAGES.filter(stage => score >= stage.score).length - 1;
}
export function catBenefits(score: number) {
  const stage = catStage(score), full = stage === 4;
  return { stage, recovery: full ? .2 : .1, sniff: stage >= 1, radius: full ? 320 : 240,
    claw: stage >= 2, markBonus: full ? .2 : .15, guard: stage >= 3, shield: full ? 22 : 16 };
}

// 经历使用有界的正式世界编号，重复清怪和来回走路不能无限刷默契。
const memories = new Map<string, { points: number; name: string }>();
for (let x = 0; x < 16; x++) for (let y = 0; y < 12; y++)
  memories.set(`trail:${x}:${y}`, { points: 2, name: '共同探索新的路段' });
for (const group of ENCOUNTERS) for (const member of group.members)
  memories.set(`battle:${member.id}`, { points: member.boss ? 6 : member.elite ? 4 : 2, name: `并肩击退${group.name}的敌人` });
for (const enemy of enemyDefs) if (!memories.has(`battle:${enemy.id}`))
  memories.set(`battle:${enemy.id}`, { points: 2, name: '并肩击退林间敌人' });
for (const prop of props.filter(p => p.kind === 'chest' || p.kind === 'stone' || p.id === 'clue'))
  memories.set(`find:${prop.id}`, { points: prop.kind === 'chest' ? 3 : 2, name: `共同发现${prop.label ?? '旅途线索'}` });
memories.set('night', { points: 5, name: '一起聆听临水夜风' });
const careNames: Record<CatCare | 'rest', string> = { pet: '摸摸小黑', feed: '分享一份浆果', rest: '一起安心休息' };
export const catMemoryName = (key: string) => memories.get(key)?.name ?? careNames[key as CatCare | 'rest'] ?? '共同旅行';
export function catRemember(cat: CatBondState, key: string) {
  const memory = memories.get(key);
  if (!memory || cat.memories.includes(key)) return 0;
  cat.memories.push(key); cat.last = key;
  const old = cat.score; cat.score = Math.min(100, old + memory.points);
  return cat.score - old;
}
export function catDay(cat: CatBondState, time: number) {
  const day = Math.floor(time / 1440);
  if (cat.day !== day) { cat.day = day; cat.pet = cat.feed = cat.rest = false; }
}
export function catCareGain(cat: CatBondState, kind: CatCare | 'rest', time: number) {
  catDay(cat, time);
  if (cat[kind]) return 0;
  cat[kind] = true; cat.last = kind;
  const old = cat.score; cat.score = Math.min(100, old + (kind === 'feed' ? 3 : 2));
  return cat.score - old;
}
export function catTrailKey(p: { x: number; y: number }) {
  const x = Math.floor((p.x - WORLD_BOUNDS.left) / 400), y = Math.floor((p.y - WORLD_BOUNDS.top) / 400);
  return x >= 0 && x < 16 && y >= 0 && y < 12 ? `trail:${x}:${y}` : '';
}
export function migrateCatBond(s: Pick<State, 'killed' | 'chests' | 'stones' | 'night' | 'encounters'>) {
  const cat = initialCatBond();
  // 只认可存档中明确记录的经历，不用在线时长推测默契。
  for (const id of s.killed ?? []) catRemember(cat, `battle:${id}`);
  for (const group of Object.values(s.encounters?.groups ?? {})) for (const member of group.members ?? [])
    if (member.defeated && member.participated) catRemember(cat, `battle:${member.id}`);
  for (const id of s.chests ?? []) catRemember(cat, `find:${id}`);
  for (const index of s.stones ?? []) {
    const stone = props.find(p => p.kind === 'stone' && p.index === index);
    if (stone) catRemember(cat, `find:${stone.id}`);
  }
  if (s.night?.discovered) catRemember(cat, 'night');
  return cat;
}
export function validateCatBond(raw: unknown, time: number, maxHp = 100): CatBondState {
  const c = raw as CatBondState;
  const number = (v: unknown, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;
  if (!c || !Number.isInteger(c.score) || !number(c.score, 100) ||
    !Array.isArray(c.memories) || c.memories.length > memories.size ||
    new Set(c.memories).size !== c.memories.length || !c.memories.every(key => memories.has(key)) ||
    !Number.isInteger(c.day) || !number(c.day, Math.floor(time / 1440)) ||
    !['pet', 'feed', 'rest'].every(key => typeof c[key as CatCare | 'rest'] === 'boolean') ||
    !(c.last === '' || memories.has(c.last) || Object.hasOwn(careNames, c.last)) ||
    !number(c.clawCooldown, 12000) || !number(c.guardCooldown, 60000) ||
    (c.clawCooldown > 0 && !catBenefits(c.score).claw) || (c.guardCooldown > 0 && !catBenefits(c.score).guard) ||
    !number(c.shield, Math.ceil(catBenefits(c.score).shield * maxHp / 100)) || !number(c.shieldTime, 5000) ||
    (c.shield > 0 && (!catBenefits(c.score).guard || c.shieldTime === 0 || c.guardCooldown === 0)) ||
    (c.shieldTime === 0 && c.shield !== 0)) throw Error('小黑的默契或支援记录无效，请使用有效备份。');
  return structuredClone(c);
}
