import {
  STARTER_COINS,
  MAX_COINS,
  initialStock,
  stackLimit,
  isEquipment,
  equipment,
  type EquipmentId,
} from "../../data/economy";
import { props, enemyDefs, WORLD } from "../../data/world";
import { items, type ItemId } from "../../data/content";
import { initialDefense, migrateEastDefense, validateDefense, type DefenseState } from "./defenseState";
export type Slot = { id: ItemId; count: number } | null;
export type State = {
  skills: {swordWind:boolean};
  schema_version: 4;
  defense: DefenseState;
  coins: number;
  equipment: { weapon: EquipmentId | null; armor: EquipmentId | null };
  shopStock: Record<string, number>;
  economyRevision: number;
  map_version?: 2 | 3 | 4 | 5 | 6;
  player: { x: number; y: number; hp: number; stamina: number };
  bag: Slot[];
  hotbar: (ItemId | null)[];
  quest: number;
  side: number;
  collected: Record<string, number>;
  chests: string[];
  killed: string[];
  pendingDrops: { enemyId: string; item: ItemId; x: number; y: number }[];
  dashCooldownRemaining: number;
  stones: number[];
  shortcut: boolean;
  time: number;
  reward: boolean;
  crafted: boolean;
};
export const initialState = (): State => ({
  skills: {swordWind:false},
  schema_version: 4,
  defense: initialDefense(),
  coins: STARTER_COINS,
  equipment: { weapon: null, armor: null },
  shopStock: initialStock(),
  economyRevision: 0,
  map_version: 6,
  player: { x: 670, y: 720, hp: 100, stamina: 100 },
  bag: Array(24).fill(null),
  hotbar: ["potion", "berry", null, null, null, null, null, null],
  quest: 0,
  side: 0,
  collected: {},
  chests: [],
  killed: [],
  pendingDrops: [],
  dashCooldownRemaining: 0,
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
  if (!Object.hasOwn(items, id) || !Number.isSafeInteger(n) || n < 1 || n > 480)
    return false;
  const limit = stackLimit(id);
  const copy = structuredClone(s.bag);
  for (let i = 0; i < 24 && n; i++) {
    const a = copy[i];
    if (a?.id === id && a.count < limit) {
      const k = Math.min(n, limit - a.count);
      a.count += k;
      n -= k;
    }
  }
  for (let i = 0; i < 24 && n; i++)
    if (!copy[i]) {
      const k = Math.min(limit, n);
      copy[i] = { id, count: k };
      n -= k;
    }
  if (n) return false;
  s.bag = copy;
  return true;
}
export function remove(s: State, id: ItemId, n: number) {
  if (!Object.hasOwn(items, id) || !Number.isSafeInteger(n) || n < 1 || n > 480)
    return false;
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
  const s = structuredClone(raw) as State;
  if(s && s.skills===undefined)s.skills={swordWind:false};
  if(s && (!s.skills || typeof s.skills.swordWind!=="boolean"))throw Error("存档技能状态无效");
  // 只持久化正式学习；高阶配置、临时授予与飞行实体均不进入存档。
  if(s)s.skills={swordWind:s.skills.swordWind};
  const version = (s as { schema_version?: number })?.schema_version;
  if (s && version === 1) {
    s.pendingDrops ??= [];
    s.dashCooldownRemaining ??= 0;
    (s as {schema_version:number}).schema_version = 2;
    s.coins = STARTER_COINS;
    s.equipment = { weapon: null, armor: null };
    s.shopStock = initialStock();
    s.economyRevision = 0;
  }
  if (s && (s as {schema_version:number}).schema_version === 2) {
    s.schema_version = 4;
    s.defense = initialDefense();
  }
  if (s && version === 3) { s.defense = migrateEastDefense(s.defense); s.schema_version = 4; }
  const num = (n: unknown, min: number, max: number) =>
    typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
  const strarr = (a: unknown) =>
    Array.isArray(a) &&
    a.length < 300 &&
    a.every((x) => typeof x === "string" && x.length < 80);
  if (
    !s ||
    s.schema_version !== 4 ||
    (s.map_version !== undefined &&
      s.map_version !== 2 &&
      s.map_version !== 3 &&
      s.map_version !== 4 &&
      s.map_version !== 5 &&
      s.map_version !== 6) ||
    !s.player ||
    !num(
      s.player.x,
      25,
      s.map_version !== undefined ? WORLD.width - 25 : 3575,
    ) ||
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
          num(a.count, 1, stackLimit(a.id))),
    ) ||
    !Array.isArray(s.hotbar) ||
    s.hotbar.length !== 8 ||
    !s.hotbar.every((a) => a === null || Object.hasOwn(items, a)) ||
    !Number.isInteger(s.quest) ||
    !num(s.quest, 0, 7) ||
    !num(s.side, 0, 2) ||
    !strarr(s.chests) ||
    !strarr(s.killed) ||
    !Array.isArray(s.pendingDrops) ||
    s.pendingDrops.length > enemyDefs.length ||
    !s.pendingDrops.every(
      (d) =>
        d &&
        typeof d.enemyId === "string" &&
        Object.hasOwn(items, d.item) &&
        num(d.x, 30, s.map_version !== undefined ? WORLD.width - 30 : 3570) &&
        num(d.y, 80, 2170),
    ) ||
    !num(s.dashCooldownRemaining, 0, 650) ||
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
  if (
    !Number.isSafeInteger(s.coins) ||
    !num(s.coins, 0, MAX_COINS) ||
    !Number.isSafeInteger(s.economyRevision) ||
    !num(s.economyRevision, 0, 1e9) ||
    !s.equipment ||
    !["weapon", "armor"].every((slot) => {
      const id = s.equipment[slot as "weapon" | "armor"];
      return id === null || (isEquipment(id) && equipment[id].slot === slot);
    }) ||
    !s.shopStock ||
    typeof s.shopStock !== "object" ||
    Object.keys(s.shopStock).length !== Object.keys(initialStock()).length ||
    !Object.keys(initialStock()).every(
      (key) =>
        Number.isSafeInteger(s.shopStock[key]) &&
        num(s.shopStock[key], 0, 9999),
    )
  )
    throw Error("存档交易或装备状态无效，请使用有效备份。");
  s.defense = validateDefense(s.defense);
  const validIds = (ids: string[], kind: string) =>
    new Set(ids).size === ids.length &&
    ids.every((id) => props.some((p) => p.id === id && p.kind === kind));
  if (
    !validIds(s.chests, "chest") ||
    !s.killed.every((id) => enemyDefs.some((e) => e.id === id)) ||
    !s.pendingDrops.every(
      (d) =>
        s.killed.includes(d.enemyId) &&
        enemyDefs.some(
          (e) =>
            e.id === d.enemyId &&
            d.item === (e.type === "leaf" ? "crystal" : "berry"),
        ),
    ) ||
    new Set(s.pendingDrops.map((d) => d.enemyId)).size !==
      s.pendingDrops.length ||
    !Object.keys(s.collected).every((id) =>
      props.some((p) => p.id === id && p.kind === "resource"),
    ) ||
    !s.stones.every((n, i) => n === i) ||
    !Number.isInteger(s.side) ||
    (s.shortcut && (s.stones.length !== 3 || s.quest < 6)) ||
    s.reward !== (s.quest === 7)
  )
    throw Error("存档世界状态不一致，请使用有效备份。");
  // 旧地图只平移森林与遗迹；稳定交互编号及背包、任务全部保留。
  if (s.map_version === undefined) {
    if (s.player.x >= 1450) s.player.x += 600;
    s.pendingDrops.forEach((d) => {
      if (d.x >= 1450) d.x += 600;
    });
    s.map_version = 2;
  }
  // 村界版本3不平移世界；进入场景时按真实碰撞修复不合法站位。
  if (s.map_version === 2) s.map_version = 3;
  // 生活建筑版本4不平移世界；场景根据正式碰撞就近恢复旧站位。
  if (s.map_version === 3) s.map_version = 4;
  // 东门塔基版本5不平移世界，不重复执行旧地图迁移。
  if (s.map_version === 4) s.map_version = 5;
  // 三门塔基版本6无坐标平移；旧档碰撞由场景就近修复。
  if (s.map_version === 5) s.map_version = 6;
  return structuredClone(Object.fromEntries(Object.keys(initialState()).map(key=>[key,s[key as keyof State]]))) as State;
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
