import { describe, expect, it } from "vitest";
import { RETURN_WIND_ORB, equipment, initialStock } from "../src/data/economy";
import { items } from "../src/data/content";
import { add, initialState, parseSave } from "../src/game/systems/state";
import { economySnapshot, incomingDamage, outgoingDamage, type EconomyRequest } from "../src/game/systems/economy";
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
