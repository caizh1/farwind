import { props, enemyDefs } from "../../data/world";
import { items, type ItemId } from "../../data/content";
export type Slot = { id: ItemId; count: number } | null;
export type State = {
  schema_version: 1;
  player: { x: number; y: number; hp: number; stamina: number };
  bag: Slot[];
  hotbar: (ItemId | null)[];
  quest: number;
  side: number;
  collected: Record<string, number>;
  chests: string[];
  killed: string[];
  stones: number[];
  shortcut: boolean;
  time: number;
  reward: boolean;
  crafted: boolean;
};
export const initialState = (): State => ({
  schema_version: 1,
  player: { x: 670, y: 720, hp: 100, stamina: 100 },
  bag: Array(24).fill(null),
  hotbar: ["potion", "berry", null, null, null, null, null, null],
  quest: 0,
  side: 0,
  collected: {},
  chests: [],
  killed: [],
  stones: [],
  shortcut: false,
  time: 8 * 60,
  reward: false,
  crafted: false,
});
export function count(s: State, id: ItemId) {
  return s.bag.reduce((n, a) => n + (a?.id === id ? a.count : 0), 0);
}
export function add(s: State, id: ItemId, n: number) {
  const copy = structuredClone(s.bag);
  for (let i = 0; i < 24 && n; i++) {
    const a = copy[i];
    if (a?.id === id && a.count < 20) {
      const k = Math.min(n, 20 - a.count);
      a.count += k;
      n -= k;
    }
  }
  for (let i = 0; i < 24 && n; i++)
    if (!copy[i]) {
      const k = Math.min(20, n);
      copy[i] = { id, count: k };
      n -= k;
    }
  if (n) return false;
  s.bag = copy;
  return true;
}
export function remove(s: State, id: ItemId, n: number) {
  if (count(s, id) < n) return false;
  for (let i = 0; i < 24 && n; i++) {
    const a = s.bag[i];
    if (a?.id === id) {
      const k = Math.min(a.count, n);
      a.count -= k;
      n -= k;
      if (!a.count) s.bag[i] = null;
    }
  }
  return true;
}
export function craft(s: State) {
  const next = structuredClone(s);
  if (
    !remove(next, "herb", 2) ||
    !remove(next, "berry", 1) ||
    !add(next, "potion", 1)
  )
    return false;
  s.bag = next.bag;
  s.crafted = true;
  if (s.quest === 2) s.quest = 3;
  return true;
}
export function reward(s: State) {
  if (s.reward || s.quest !== 6) return false;
  if (!add(s, "potion", 3)) return false;
  s.reward = true;
  s.quest = 7;
  return true;
}
export function validate(raw: unknown): State {
  const s = raw as State;
  const num = (n: unknown, min: number, max: number) =>
    typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
  const strarr = (a: unknown) =>
    Array.isArray(a) &&
    a.length < 300 &&
    a.every((x) => typeof x === "string" && x.length < 80);
  if (
    !s ||
    s.schema_version !== 1 ||
    !s.player ||
    !num(s.player.x, 25, 3575) ||
    !num(s.player.y, 25, 2175) ||
    !num(s.player.hp, 1, 100) ||
    !num(s.player.stamina, 0, 100) ||
    !Array.isArray(s.bag) ||
    s.bag.length !== 24 ||
    !s.bag.every(
      (a) =>
        a === null ||
        (a &&
          Object.hasOwn(items, a.id) &&
          Number.isInteger(a.count) &&
          num(a.count, 1, 20)),
    ) ||
    !Array.isArray(s.hotbar) ||
    s.hotbar.length !== 8 ||
    !s.hotbar.every((a) => a === null || Object.hasOwn(items, a)) ||
    !Number.isInteger(s.quest) ||
    !num(s.quest, 0, 7) ||
    !num(s.side, 0, 2) ||
    !strarr(s.chests) ||
    !strarr(s.killed) ||
    !Array.isArray(s.stones) ||
    s.stones.length > 3 ||
    !s.stones.every((n) => Number.isInteger(n) && num(n, 0, 2)) ||
    typeof s.shortcut !== "boolean" ||
    typeof s.reward !== "boolean" ||
    typeof s.crafted !== "boolean" ||
    !num(s.time, 0, 1e8) ||
    !s.collected ||
    typeof s.collected !== "object" ||
    Object.entries(s.collected).length > 300 ||
    !Object.entries(s.collected).every(
      ([k, v]) => k.length < 80 && num(v, 0, 1e8),
    )
  )
    throw Error("存档损坏或版本不兼容，请导入有效的外部备份。");
  const validIds = (ids: string[], kind: string) =>
    new Set(ids).size === ids.length &&
    ids.every((id) => props.some((p) => p.id === id && p.kind === kind));
  if (
    !validIds(s.chests, "chest") ||
    !s.killed.every((id) => enemyDefs.some((e) => e.id === id)) ||
    !Object.keys(s.collected).every((id) =>
      props.some((p) => p.id === id && p.kind === "resource"),
    ) ||
    !s.stones.every((n, i) => n === i) ||
    !Number.isInteger(s.side) ||
    (s.shortcut && (s.stones.length !== 3 || s.quest < 6)) ||
    s.reward !== (s.quest === 7)
  )
    throw Error("存档世界状态不一致，请使用有效备份。");
  return structuredClone(s);
}
export function parseSave(text: string) {
  if (text.length > 200000) throw Error("存档超过 200 KB 限制");
  return validate(JSON.parse(text));
}

// 关键任务材料不可丢弃，避免有限敌人掉落耗尽后无法完成主线。
export function discard(s: State, id: ItemId) {
  if (id === "crystal") return false;
  return remove(s, id, 1);
}
