import { describe, expect, it } from "vitest";
import { RETURN_WIND_ORB, equipment, initialStock, shops, STARTER_COINS } from "../src/data/economy";
import { items } from "../src/data/content";
import { add, count, initialState, parseSave } from "../src/game/systems/state";
import { EconomyCommit, economySnapshot, incomingDamage, movementSpeed, outgoingDamage, maxTradeQuantity, type EconomyRequest } from "../src/game/systems/economy";
import { SPRINT } from "../src/game/systems/sprint";
import { equippedItem } from "../src/game/ui/equipment";

describe("旅人装备与永久归风珠", () => {
  it("新档、有效旧结构及重复读档都有同一颗保底宝珠，不增加背包或交易物品", () => {
    const fresh = initialState();
    const old = { ...structuredClone(fresh), schema_version: 12 };
    const restored = parseSave(JSON.stringify(old));
    const reloaded = parseSave(JSON.stringify(restored));
    for (const state of [fresh, restored, reloaded]) {
      expect(equippedItem(state, "orb").name).toBe("归风珠");
      expect(equippedItem(state, "orb").badge).toBe("默认装备");
      expect(state.bag).toEqual(fresh.bag);
      expect(state.hotbar).toEqual(fresh.hotbar);
      expect(state.coins).toBe(fresh.coins);
    }
    expect(reloaded).toEqual(restored);
    expect(RETURN_WIND_ORB.id in items).toBe(false);
    expect(RETURN_WIND_ORB.id in equipment).toBe(false);
    expect(Object.keys(initialStock()).some(key => key.includes(RETURN_WIND_ORB.id))).toBe(false);
  });
  it("装备详情跟随真实穿戴状态与伤害效果变化，归风珠不受武器护甲交易影响", () => {
    let state = initialState();
    const orb = equippedItem(state, "orb");
    expect([equippedItem(state, "weapon").name, equippedItem(state, "armor").name]).toEqual(["原有佩剑", "原有衣物"]);
    add(state, "ironSword", 1); add(state, "leatherCoat", 1);
    state = economySnapshot(state, { sequence: 1, kind: "equip", slot: "weapon", item: "ironSword" });
    state = economySnapshot(state, { sequence: 2, kind: "equip", slot: "armor", item: "leatherCoat" });
    expect([equippedItem(state, "weapon").name, equippedItem(state, "armor").name]).toEqual(["风杉铁剑", "旅人皮甲"]);
    expect([outgoingDamage(state, 18), incomingDamage(state, 10)]).toEqual([22, 7]);
    expect(equippedItem(state, "orb")).toEqual(orb);
    state = parseSave(JSON.stringify(state));
    state = economySnapshot(state, { sequence: 3, kind: "equip", slot: "weapon", item: null });
    expect(equippedItem(state, "weapon").name).toBe("原有佩剑");
    expect(equippedItem(state, "orb")).toEqual(orb);
  });
  it("满包仍能显示归风珠，伪造卸珠与出售请求被拒绝且不改原状态", () => {
    const state = initialState();
    state.bag = Array.from({ length: 24 }, () => ({ id: "wood" as const, count: 20 }));
    const before = structuredClone(state);
    expect(equippedItem(state, "orb").description).toContain("风铃村广场重生");
    expect(() => economySnapshot(state, { sequence: 1, kind: "equip", slot: "orb", item: null } as unknown as EconomyRequest)).toThrow("装备栏位无效");
    expect(() => economySnapshot(state, { sequence: 1, kind: "sell", shop: "general", item: RETURN_WIND_ORB.id, quantity: 1 } as unknown as EconomyRequest)).toThrow();
    expect(state).toEqual(before);
  });
});

describe("轻风靴购买、穿戴与存档", () => {
  const buy: EconomyRequest = { sequence: 1, kind: "buy", shop: "smith", item: "windBoots", quantity: 1 };
  it("开局买不起，金币不足不扣款、不扣库存、不发装备", () => {
    const s = initialState(), before = structuredClone(s);
    expect(shops.smith.goods.windBoots).toBeGreaterThan(STARTER_COINS);
    expect(maxTradeQuantity(s, "smith", "windBoots")).toBe(0);
    expect(() => economySnapshot(s, buy)).toThrow("金币不足");
    expect(s).toEqual(before);
  });
  it("攒够钱后购买，放在包里不加速；鞋槽穿戴、读档和卸下准确恢复速度", () => {
    let s = initialState();
    s.coins = shops.smith.goods.windBoots;
    s = economySnapshot(s, buy);
    expect([s.coins, count(s, "windBoots"), s.shopStock["smith:windBoots"]]).toEqual([0, 1, 3]);
    expect(movementSpeed(s, SPRINT.walkSpeed)).toBe(SPRINT.walkSpeed);
    s = economySnapshot(s, { sequence: 2, kind: "equip", slot: "feet", item: "windBoots" });
    s = parseSave(JSON.stringify(s));
    expect(s.equipment.feet).toBe("windBoots");
    expect(count(s, "windBoots")).toBe(0);
    expect(movementSpeed(s, SPRINT.walkSpeed)).toBe(187.5);
    expect(movementSpeed(s, SPRINT.runSpeed)).toBe(293.75);
    expect(equippedItem(s, "feet").description).toContain("25%");
    expect([incomingDamage(s, 10), outgoingDamage(s, 18)]).toEqual([10, 18]);
    s = economySnapshot(s, { sequence: 3, kind: "equip", slot: "feet", item: null });
    expect(count(s, "windBoots")).toBe(1);
    expect(movementSpeed(s, SPRINT.walkSpeed)).toBe(150);
    expect(parseSave(JSON.stringify(s))).toEqual(s);
  });
  it("第17版旧档仅补鞋槽和库存，原有钱、库存、装备与任务不变，重复读档幂等", () => {
    const old: any = initialState(); old.schema_version = 17;
    delete old.equipment.feet; delete old.shopStock["smith:windBoots"];
    old.coins = 47; old.shopStock["smith:ironSword"] = 2;
    old.equipment.weapon = "ironSword"; old.bag[0] = { id: "herb", count: 5 };
    const before = structuredClone(old), next = parseSave(JSON.stringify(old));
    expect(next.schema_version).toBe(initialState().schema_version);
    expect(next.equipment).toEqual({ ...old.equipment, feet: null });
    expect(next.shopStock).toEqual({ ...old.shopStock, "smith:windBoots": 4 });
    for (const key of ["coins", "bag", "quest", "skills", "encounters", "economyRevision"] as const) expect(next[key]).toEqual(old[key]);
    expect(count(next, "windBoots")).toBe(0);
    expect(parseSave(JSON.stringify(next))).toEqual(next);
    expect(old).toEqual(before);
  });
  it("鞋子不占武器护甲头槽，错槽和损坏新档被拒绝", () => {
    const s = initialState(); add(s, "windBoots", 1);
    for (const slot of ["weapon", "armor", "head"] as const) expect(() => economySnapshot(s, { sequence: 1, kind: "equip", slot, item: "windBoots" })).toThrow("不匹配");
    const bad = structuredClone(s); bad.equipment.feet = "ironSword";
    expect(() => parseSave(JSON.stringify(bad))).toThrow("装备状态无效");
    const missing: any = structuredClone(s); delete missing.equipment.feet;
    expect(() => parseSave(JSON.stringify(missing))).toThrow();
  });
  it("满包购买或卸鞋失败保持钱、库存和装备，保存失败不发布购买和移速加成", async () => {
    const s = initialState(); s.coins = 180;
    s.bag = Array.from({ length: 24 }, () => ({ id: "wood", count: 20 }));
    let before = structuredClone(s);
    expect(() => economySnapshot(s, buy)).toThrow("空间不足"); expect(s).toEqual(before);
    s.equipment.feet = "windBoots"; before = structuredClone(s);
    expect(() => economySnapshot(s, { sequence: 1, kind: "equip", slot: "feet", item: null })).toThrow("行囊已满"); expect(s).toEqual(before);
    const funded = initialState(); funded.coins = 180;
    const commit = new EconomyCommit(); let published = false;
    await expect(commit.run(() => funded, buy, async () => { throw Error("保存失败"); }, () => { published = true; })).rejects.toThrow("保存失败");
    expect(published).toBe(false); expect(funded.coins).toBe(180); expect(count(funded, "windBoots")).toBe(0);
    add(funded, "windBoots", 1);
    await expect(commit.run(() => funded, { sequence: 1, kind: "equip", slot: "feet", item: "windBoots" }, async () => { throw Error("保存失败"); }, () => { published = true; })).rejects.toThrow();
    expect(published).toBe(false); expect(movementSpeed(funded, 150)).toBe(150); expect(count(funded, "windBoots")).toBe(1);
  });
});
