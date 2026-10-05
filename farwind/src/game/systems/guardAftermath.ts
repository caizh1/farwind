import {GUARD_MEMORIAL} from '../../data/maps/windbell/layout';
export {GUARD_MEMORIAL} from '../../data/maps/windbell/layout';
import { GUARD_DEFS, type GuardId } from '../../data/defense';
import { DAY_NIGHT } from '../../data/dayNight';
import { HOMES } from '../../data/npcLife';
import {cancelPath,enemyNavigation} from './enemy';
import { initialLife } from './npcLifeState';
import type { State } from './state';
import type { DefenseState, GuardState } from './defenseState';
import type { EastDefense } from './defense';

export const GUARD_CARE = { safeMs: 12000, recruitCost: 80, recruitMinutes: 180 } as const;
const successors = ['云舟','叶秋','知弦','山青','砚川','竹音','麦青','溪禾','晓弦','岩青','林舟','晚弦'];
export type GuardMemorial = {
  id: string; guardId: GuardId; generation: number; diedAt: number; legacy: boolean;
  safeMs: number; collectedAt: number | null; buriedAt: number | null;
  flowers: boolean; recruitAt: number | null; arrivedAt: number | null;
};
export const guardName = (g: Pick<GuardState,'id'|'generation'>) => {
  const i = GUARD_DEFS.findIndex(d => d.id === g.id), generation = g.generation ?? 0;
  return generation === 0 ? GUARD_DEFS[i].name : successors[i] + (generation > 1 ? `·第${generation}期` : '');
};
export const memorialName = (r: GuardMemorial) => guardName({ id: r.guardId, generation: r.generation });
export const funeralTime = (r: GuardMemorial) => (Math.floor(r.collectedAt! / DAY_NIGHT.day) + 1) * DAY_NIGHT.day + DAY_NIGHT.dawn;
export const currentMemorial = (s: DefenseState, g: GuardState) => s.memorials?.find(r => r.guardId === g.id && r.generation === (g.generation ?? 0));

export function recordGuardDeath(s: DefenseState, g: GuardState, time: number, legacy = false) {
  const records = s.memorials ??= [];
  if (!currentMemorial(s, g)) records.push({ id: `${g.id}:${g.generation ?? 0}`, guardId: g.id,
    generation: g.generation ?? 0, diedAt: time, legacy, safeMs: 0, collectedAt: null,
    buriedAt: null, flowers: false, recruitAt: null, arrivedAt: null });
}

// 扩展字段兼容旧档；日期不详的旧伤亡在正式模拟中登记，绝不补满生命。
export function validateGuardMemorials(s: DefenseState, time: number = DAY_NIGHT.maxTime) {
  s.memorials ??= [];
  const minute = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= time;
  const optional = (v: unknown) => v === null || minute(v);
  if (!Array.isArray(s.memorials) || new Set(s.memorials.map(r => r?.id)).size !== s.memorials.length)
    throw Error('卫队纪念记录无效。');
  for (const g of s.guards) if (!Number.isSafeInteger(g.generation ?? 0) || (g.generation ?? 0) < 0 || (g.generation ?? 0) > 1e9)
    throw Error('卫兵补岗代次无效。');
  for (const r of s.memorials) {
    const g = s.guards.find(g => g.id === r?.guardId);
    if (!r || !g || !Number.isSafeInteger(r.generation) || r.generation < 0 || r.generation > (g.generation ?? 0) ||
      r.id !== `${r.guardId}:${r.generation}` || !minute(r.diedAt) || typeof r.legacy !== 'boolean' ||
      !Number.isFinite(r.safeMs) || r.safeMs < 0 || r.safeMs > GUARD_CARE.safeMs ||
      !optional(r.collectedAt) || !optional(r.buriedAt) || !optional(r.recruitAt) || !optional(r.arrivedAt) || typeof r.flowers !== 'boolean' ||
      (r.collectedAt !== null && (r.collectedAt < r.diedAt || r.safeMs !== GUARD_CARE.safeMs)) ||
      (r.buriedAt !== null && (r.collectedAt === null || r.buriedAt < funeralTime(r))) ||
      (r.flowers && r.buriedAt === null) ||
      (r.recruitAt !== null && (r.buriedAt === null || r.recruitAt < r.buriedAt)) ||
      (r.arrivedAt !== null && (r.recruitAt === null || r.arrivedAt < r.recruitAt + GUARD_CARE.recruitMinutes)) ||
      (r.generation < (g.generation ?? 0) ? r.arrivedAt === null : !g.dead || r.arrivedAt !== null))
      throw Error('卫队收殓、安葬与补岗记录不一致。');
  }
  for (const g of s.guards) {
    const history = s.memorials.filter(r => r.guardId === g.id && r.arrivedAt !== null);
    if (history.length !== (g.generation ?? 0) || history.some((r,i) => r.generation !== i))
      throw Error('卫兵身份与补岗历史不一致。');
  }
}

export function guardCareSafe(defense: EastDefense, g: GuardState) {
  const home = HOMES.find(h => h.id === 'barracks')!.door;
  return !defense.state.raid && !defense.arrows.length && !defense.allHostiles().some(e => e.hp > 0 && !e.disabled &&
    (defense.threatReason(defense.guardGate(g.id), e) || Math.hypot(e.x-g.x,e.y-g.y) < 380 || Math.hypot(e.x-home.x,e.y-home.y) < 380));
}

export function stepGuardAftermath(state: State, defense: EastDefense, ms: number, projectileRisk = false): string[] {
  const messages: string[] = [];
  for (const g of state.defense.guards) {
    if (!g.dead) continue;
    if (!currentMemorial(state.defense, g)) { recordGuardDeath(state.defense, g, state.time, true); defense.critical = true; }
    const r = currentMemorial(state.defense, g)!;
    const safe = !projectileRisk && !state.life.unavailable.homes.barracks && guardCareSafe(defense,g);
    if (r.collectedAt === null) {
      r.safeMs = safe ? Math.min(GUARD_CARE.safeMs,r.safeMs+ms) : 0;
      if (r.safeMs === GUARD_CARE.safeMs) {
        r.collectedAt = state.time; defense.critical = true;
        messages.push(`${memorialName(r)}已被送往营房，等待次日安葬。`);
      }
    }
    if (safe && r.collectedAt !== null && r.buriedAt === null && state.time >= funeralTime(r)) {
      r.buriedAt = state.time; defense.critical = true;
      messages.push(`晨风中，村民为${memorialName(r)}举行了简短悼念。姓名已刻入营房旁的卫队纪念碑。`);
    }
    if (safe && r.recruitAt !== null && state.time >= r.recruitAt + GUARD_CARE.recruitMinutes) {
      r.arrivedAt = state.time;
      const def = GUARD_DEFS.find(d => d.id === g.id)!, door = HOMES.find(h => h.id === 'barracks')!.door;
      Object.assign(g, { generation: (g.generation ?? 0)+1, hp: def.maxHP, dead: false, mode: 'return',
        space: 'village', x: door.x, y: door.y, offDuty: true, towerTransitMs: 0, peaceMs: 0, cooldownMs: 0 });
      const fresh = initialLife(state.time).people.find(n => n.id === g.id)!;
      fresh.gear = 'carried'; fresh.relations = {}; fresh.receipt = state.life.sequence; fresh.receiptFloor = state.life.sequence; fresh.reason = '新卫兵报到，沿路前往岗位';
      fresh.nextDecision = state.life.elapsed; fresh.speech.eventFloor = state.life.sequence;
      state.life.people[state.life.people.findIndex(n => n.id === g.id)] = fresh;
      state.life.tasks = state.life.tasks.filter(t => t.subject !== g.id && t.owner !== g.id);
      state.life.reservations = state.life.reservations.filter(r => r.owner !== g.id);
      delete state.life.observed[g.id];
      for (const n of state.life.people) {
        delete n.known[g.id]; delete n.social.visited[g.id];
        // 岗位编号沿用，旧身份的人际记忆不能移交给继任者；纪念碑永久保留旧姓名。
        delete n.relations[g.id];
        n.memories = n.memories.filter(m => !m.subjects.includes(g.id));
        if (n.action?.social?.partner === g.id) n.action = null;
      }
      const runtime = defense.runtime.get(g.id)!;
      cancelPath(runtime.nav); runtime.nav=enemyNavigation(); runtime.chaseMs=0; runtime.blockedTarget=null; runtime.blockedUntil=0; runtime.stuckMs=0; runtime.distance=0;
      runtime.attack = null; runtime.targetId = null; runtime.flashUntil = 0; runtime.moved = 0;
      defense.peaceOrders.delete(g.id);
      defense.guardReplaced?.(g.id);
      defense.critical = true;
      messages.push(`${guardName(g)}已到营房报到，正沿路前往村门补岗。${memorialName(r)}的纪念记录永久保留。`);
    }
  }
  return messages;
}

export function guardCareSnapshot(state: State, action: 'recruit'|'flowers', recordId: string, sequence: number): State {
  if (sequence !== state.economyRevision+1 || !Number.isSafeInteger(sequence) || sequence > 1e9)
    throw Error('请求已处理或过期，请重新打开卫队事务。');
  const door = HOMES.find(h => h.id === 'barracks')!.door, p = state.player;
  const onsite = state.life.playerSpace === 'barracks' || state.life.playerSpace === 'village' &&
    [door,GUARD_MEMORIAL].some(q => Math.hypot(p.x-q.x,p.y-q.y) < 125);
  if (!onsite) throw Error('请到营房或卫队纪念碑办理。');
  const next = structuredClone(state), r = next.defense.memorials?.find(r => r.id === recordId);
  if (!r || r.buriedAt === null) throw Error('请先等待收殓与次日安葬。');
  if (action === 'flowers') {
    if (r.flowers) throw Error('已经为这位卫兵献过花。');
    r.flowers = true;
  } else if (action === 'recruit') {
    const g = next.defense.guards.find(g => g.id === r.guardId)!;
    if (!g.dead || r.generation !== (g.generation ?? 0) || r.recruitAt !== null) throw Error('这个岗位已补齐或正在招募。');
    if (next.coins < GUARD_CARE.recruitCost) throw Error(`招募需要${GUARD_CARE.recruitCost}枚金币，尚未扣款。`);
    next.coins -= GUARD_CARE.recruitCost; r.recruitAt = next.time;
  } else throw Error('卫队事务无效。');
  next.economyRevision = sequence;
  return next;
}
