import {EXTRA_WIND_GIFTS,GIFT_RESONANCES,type ResonanceId} from "./windGiftCatalog";
export {EXTRA_WIND_GIFTS,GIFT_RESONANCES};
import type { State } from "./state";
export const WIND_GIFTS = {
  ...EXTRA_WIND_GIFTS,
  blade: { name: "砺刃", effect: "原生近战伤害 +12%", value: 0.12 },
  gale: { name: "聚风", effect: "原生剑风伤害 +12%", value: 0.12 },
  blackHole: {name:"裂界·黑洞斩",effect:"I攻击5%触发星云风刃与次元裂缝，每级增加1个百分点，最高10%；裂缝牵引周围敌人，并造成40%基础普通攻击伤害／秒",value:.05},
  riposte: {
    name: "回锋",
    effect:
      "成功弹反后，下次近战伤害 +20%，并释放40%基础普通攻击伤害的扇形剑气",
    value: 0.2,
  },
  shock: {
    name: "震刃",
    effect: "终结技命中冲击：基础普通攻击 30%，半径90，最多五目标，冷却1秒",
    value: 0.3,
  },
  chain: {
    name: "闪链",
    effect: "原生攻击命中跳跃至最多两目标：基础普通攻击20%，冷却1.5秒",
    value: 0.2,
  },
  stride: { name: "追风", effect: "移动速度 +8%", value: 0.08 },
  thrift: { name: "节息", effect: "风步体力消耗 −10%", value: 0.1 },
  breath: { name: "回息", effect: "体力恢复速度 +15%", value: 0.15 },
  armor: {
    name: "风甲",
    effect: "受到的战斗伤害 −1%，伤害最低为0",
    value: 0.01,
  },
  potion: { name: "添药", effect: "恢复药剂治疗量 +15%", value: 0.15 },
  spring: { name: "泉息", effect: "整场遭遇结束恢复6点生命", value: 6 },
  poise: { name: "稳架", effect: "成功弹反恢复3点体力", value: 3 },
} as const;
export type WindGiftId = keyof typeof WIND_GIFTS;
export type GiftChoice = { receipt: string; candidates: WindGiftId[] };
export type WindGiftState = {
  held: { id: WindGiftId; level: number }[];
  pending: GiftChoice[];
  receipts: string[];
  cooldowns: { shock: number; chain: number };
};
export const GIFT_RIPOSTE = {
  fanDamage: 0.4,
  range: 180,
  halfAngle: Math.PI / 3,
} as const;
export const initialWindGifts = (): WindGiftState => ({
  held: [],
  pending: [],
  receipts: [],
  cooldowns: { shock: 0, chain: 0 },
});
export function seedHash(text: string, seed = 2166136261) {
  let n = seed >>> 0;
  for (const c of text) n = Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0;
  return n;
}
export function randomSeed() {
  const a = new Uint32Array(1);
  globalThis.crypto.getRandomValues(a);
  return a[0];
}
export const giftLevel = (s: WindGiftState, id: WindGiftId) =>
  s.held.find((g) => g.id === id)?.level ?? 0;
export const giftValue = (s: WindGiftState, id: WindGiftId) =>
  id==='blackHole' ? (giftLevel(s,id)>0?Math.min(10,4+giftLevel(s,id))/100:0) : giftLevel(s, id) * WIND_GIFTS[id].value;
export const giftCappedValue=(s:WindGiftState,id:WindGiftId)=>giftDisplayValue(id,giftLevel(s,id));
export function giftDisplayValue(id:WindGiftId,level:number){const extra=EXTRA_WIND_GIFTS[id as keyof typeof EXTRA_WIND_GIFTS];return extra?Math.min(extra.cap??Infinity,extra.value*level):id==='blackHole'?(level>0?Math.min(10,4+level)/100:0):WIND_GIFTS[id].value*level;}
export function resonanceLevel(s:WindGiftState,id:ResonanceId){return Math.min(...GIFT_RESONANCES[id].components.map(c=>giftLevel(s,c)));}
export function giftEffect(id: WindGiftId, level: number) {
  const extra=EXTRA_WIND_GIFTS[id as keyof typeof EXTRA_WIND_GIFTS];
  if(extra)return extra.effect.replace('{v}',String(Math.round(giftDisplayValue(id,level)*(extra.unit==='%'?100:1)*100)/100));
  if(id==='blackHole')return `I每次施放${Math.round(Math.min(.1,.05+.01*(level-1))*100)}%触发黑洞斩；风刃命中或抵达终点后撕开次元裂缝，牵引180范围内敌人1.44秒，持续造成40%基础普通攻击伤害／秒。首领与机关不被强制位移。每级触发率增加1个百分点，最高10%。`;
  const value = Math.round(
    WIND_GIFTS[id].value *
      level *
      (id === "spring" || id === "poise" ? 1 : 100),
  );
  const legacy:Partial<Record<WindGiftId,string>> = {
    blade: `原生近战伤害 +${value}%`,
    gale: `原生剑风伤害 +${value}%`,
    riposte: `成功弹反后，下次近战伤害 +${value}%，并释放${Math.round(GIFT_RIPOSTE.fanDamage * level * 100)}%基础普通攻击伤害的扇形剑气（120°、180距离）`,
    shock: `终结技命中冲击：基础普通攻击 ${value}%，半径90，最多五目标，冷却1秒`,
    chain: `原生攻击跳跃附伤 ${value}%，最多两目标，冷却1.5秒`,
    stride: `移速 +${value}%`,
    thrift: `风步体力消耗 −${value}%，消耗最低为0`,
    breath: `体力恢复 +${value}%`,
    armor: `受到的战斗伤害 −${value}%，伤害最低为0`,
    potion: `恢复药剂治疗量 +${value}%`,
    spring: `整场结束恢复${value}生命`,
    poise: `成功弹反恢复${value}体力`,
  };return legacy[id]??WIND_GIFTS[id].effect;
}
export function offerWindGift(
  s: WindGiftState,
  receipt: string,
  seed: number,
  windUnlocked: boolean,
) {
  if (s.receipts.includes(receipt)) return false;
  const available = (Object.keys(WIND_GIFTS) as WindGiftId[]).filter(
    (id) => windUnlocked || !['gale','blackHole',...Object.keys(EXTRA_WIND_GIFTS).filter(k=>EXTRA_WIND_GIFTS[k as keyof typeof EXTRA_WIND_GIFTS].group.startsWith('I')||['holdWind','curledWind','borrowWind','storedTurn','guidingEdge','duet','cyclicBreath','duality'].includes(k))].includes(id),
  );
  const sorted = available.sort(
    (a, b) =>
      seedHash(`${receipt}:${a}`, seed) - seedHash(`${receipt}:${b}`, seed) ||
      a.localeCompare(b),
  );
  // 已持有项始终可以再次强化；候选和领取凭据在同一快照保存。
  s.receipts.push(receipt);
  if (sorted.length >= 3)
    s.pending.push({ receipt, candidates: sorted.slice(0, 3) });
  return true;
}
export function chooseWindGift(
  s: WindGiftState,
  receipt: string,
  id: WindGiftId,
) {
  const choice = s.pending.find((c) => c.receipt === receipt);
  if (!choice?.candidates.includes(id))
    throw Error("此风赐候选已失效，请从手记查看待领奖励。");
  const old = s.held.find((g) => g.id === id);
  if (old) {
    if (!Number.isSafeInteger(old.level + 1))
      throw Error("风赐等级超出可精确保存的数值范围。");
    old.level++;
  } else s.held.push({ id, level: 1 });
  s.pending = s.pending.filter((c) => c.receipt !== receipt);
}
export function giftChoiceSnapshot(
  state: State,
  receipt: string,
  id: WindGiftId,
) {
  const next = structuredClone(state);
  chooseWindGift(next.windGifts, receipt, id);
  return next;
}
export function advanceGiftCooldowns(s: WindGiftState, delta: number) {
  for (const id of ["shock", "chain"] as const)
    s.cooldowns[id] = Math.max(0, s.cooldowns[id] - delta);
}
export function validateWindGifts(raw: unknown): WindGiftState {
  const s = structuredClone(raw) as WindGiftState,
    valid = (id: unknown) =>
      typeof id === "string" && Object.hasOwn(WIND_GIFTS, id);
  const receipt = (r: unknown) =>
    typeof r === "string" && r.length > 0 && r.length <= 160;
  if (
    !s ||
    !s.cooldowns ||
    !["shock", "chain"].every(
      (id) =>
        Number.isFinite(s.cooldowns[id as "shock" | "chain"]) &&
        s.cooldowns[id as "shock" | "chain"] >= 0 &&
        s.cooldowns[id as "shock" | "chain"] <= (id === "shock" ? 1000 : 1500),
    ) ||
    !Array.isArray(s.held) ||
    s.held.some(
      (g) => !valid(g?.id) || !Number.isSafeInteger(g.level) || g.level < 1,
    ) ||
    new Set(s.held.map((g) => g.id)).size !== s.held.length ||
    !Array.isArray(s.receipts) ||
    s.receipts.length > 10000 ||
    s.receipts.some((r) => !receipt(r)) ||
    new Set(s.receipts).size !== s.receipts.length ||
    !Array.isArray(s.pending) ||
    s.pending.length > 200 ||
    new Set(s.pending.map((c) => c.receipt)).size !== s.pending.length ||
    s.pending.some(
      (c) =>
        !receipt(c?.receipt) ||
        !s.receipts.includes(c.receipt) ||
        !Array.isArray(c.candidates) ||
        c.candidates.length !== 3 ||
        new Set(c.candidates).size !== 3 ||
        c.candidates.some((id) => !valid(id)),
    )
  )
    throw Error("风赐记录无效，上一份有效存档仍保留。");
  return s;
}
