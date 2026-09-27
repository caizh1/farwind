import {isSpace,validPlace} from './npcLifeState';
import type {SpaceId} from '../../data/npcLife';
import { GUARD_DEFS, RAID_TIMING, raidInterval, type GateId, type GuardId } from "../../data/defense";
export type GuardMode = "post" | "patrol" | "intercept" | "attack" | "retreat" | "recover" | "dead" | "life" | "return";
export type GuardState = {
  id: GuardId; x: number; y: number; hp: number; dead: boolean;
  weaponId: "watch-blade" | "watch-bow"; armorId: "watch-mail" | "watch-leather";
  space?: SpaceId; offDuty?: boolean; towerTransitMs?: number;
  postId: string; mode: GuardMode; peaceMs: number; cooldownMs: number;
};
export type RaidMember = { id: string; type: "slime" | "leaf"; x: number; y: number;
  hp: number; cooldownMs: number; targetId: string | null };
export type RaidState = { id: string; sequence: number; gateId: GateId; spawns: { x: number; y: number }[]; phase: "warning" | "approach" | "fighting" | "retreat";
  ageMs: number; members: RaidMember[] };
export type DefenseState = { guards: GuardState[]; sequence: number; completedSequence: number;
  raid: RaidState | null; protectionMs: number; cooldownMs: number; retryMs: number; seed: number };
export function initialDefense(): DefenseState {
  return { guards: GUARD_DEFS.map(d => ({ id: d.id, ...d.post, hp: d.maxHP, dead: false,
    weaponId: d.weaponId, armorId: d.armorId, postId: d.postId, mode: "post", peaceMs: 0, cooldownMs: 0 })),
    sequence: 0, completedSequence: 0, raid: null, protectionMs: RAID_TIMING.protection, cooldownMs: raidInterval(1729), retryMs: 0, seed: 1729 };
}
export function validateDefense(raw: unknown): DefenseState {
  const s = raw as DefenseState;
  const num = (n: unknown, max: number) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= max;
  const seq = (n: unknown) => Number.isSafeInteger(n) && num(n, 1e9);
  const point = (p: { x: number; y: number }) => num(p.x, 4170) && p.x >= 30 && num(p.y, 2170) && p.y >= 80;
  if (!s || !seq(s.sequence) || !seq(s.completedSequence) || s.completedSequence > s.sequence ||
    !num(s.protectionMs, RAID_TIMING.protection) || !num(s.cooldownMs, RAID_TIMING.maxInterval) ||
    !num(s.retryMs, RAID_TIMING.retry) || !Number.isSafeInteger(s.seed) || !num(s.seed, 4294967295) || s.seed === 0 ||
    !Array.isArray(s.guards) || s.guards.length !== GUARD_DEFS.length ||
    new Set(s.guards.map(g => g?.id)).size !== GUARD_DEFS.length || !s.guards.every(g => {
      const d = GUARD_DEFS.find(d => d.id === g?.id);
      return !!d && point(g) && num(g.hp, d.maxHP) && typeof g.dead === "boolean" && g.dead === (g.hp === 0) &&
        g.weaponId === d.weaponId && g.armorId === d.armorId && g.postId === d.postId &&
        ["post", "patrol", "intercept", "attack", "retreat", "recover", "dead", "life", "return"].includes(g.mode) &&
        (g.space===undefined||isSpace(g.space)) && (g.offDuty===undefined||typeof g.offDuty==="boolean") && (g.towerTransitMs===undefined||num(g.towerTransitMs,1800)) && (g.space===undefined||validPlace({...g,space:g.space})) && (g.dead ? g.mode === "dead" : g.mode !== "dead") && num(g.peaceMs, 8000) && num(g.cooldownMs, 5000);
    })) throw Error("驻防存档损坏，请使用有效备份。");
  const r = s.raid;
  if (r !== null && (!r || r.sequence !== s.sequence || r.sequence <= s.completedSequence ||
    (r.id !== `east-raid-${r.sequence}` && r.id !== `raid-${r.sequence}`) ||
    !["east-gate", "north-gate", "south-gate"].includes(r.gateId) || !["warning", "approach", "fighting", "retreat"].includes(r.phase) ||
    !num(r.ageMs, 120000) || !Array.isArray(r.members) || r.members.length < 1 || r.members.length > 4 ||
    !Array.isArray(r.spawns) || r.spawns.length !== r.members.length || !r.spawns.every(point) ||
    new Set(r.members.map(m => m?.id)).size !== r.members.length || !r.members.every((m, i) =>
      m && m.id === `${r.id}:${i + 1}` && ["slime", "leaf"].includes(m.type) && point(m) &&
      num(m.hp, m.type === "slime" ? 48 : 72) && num(m.cooldownMs, 5000) &&
      (m.targetId === null || m.targetId === "player" || GUARD_DEFS.some(g => g.id === m.targetId)))))
    throw Error("来袭存档损坏，请使用有效备份。");
  if (r === null && s.completedSequence !== s.sequence) throw Error("来袭结算序号不一致。");
  return structuredClone(s);
}

// 仅结构3执行一次扩编；先严格检验旧三人记录，再添加新岗位，绝不补满旧伤亡。
export function migrateEastDefense(raw: unknown): DefenseState {
  const old = structuredClone(raw) as DefenseState;
  if (!old || !Array.isArray(old.guards) || old.guards.length !== 3 ||
    !old.guards.every(g => GUARD_DEFS.slice(0, 3).some(d => d.id === g?.id)))
    throw Error("旧驻防记录缺失，不能自动覆盖伤亡。");
  const base = initialDefense();
  old.guards.push(...base.guards.slice(3));
  Object.assign(old, { protectionMs: base.protectionMs, cooldownMs: base.cooldownMs, retryMs: 0, seed: base.seed });
  if (old.raid) {
    old.raid.gateId = "east-gate";
    old.raid.spawns = [{ x: 2430, y: 1080 }, { x: 2390, y: 1140 }, { x: 2470, y: 1120 }, { x: 2430, y: 1180 }].slice(0, old.raid.members.length);
  }
  return validateDefense(old);
}
