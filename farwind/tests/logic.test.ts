import { describe, it, expect } from "vitest";
import {
  discard,
  initialState,
  add,
  craft,
  count,
  reward,
  parseSave,
  validate,
} from "../src/game/systems/state";
describe("背包和制作事务", () => {
  it("背包满时不丢失物品", () => {
    const s = initialState();
    s.bag = Array.from({ length: 24 }, () => ({
      id: "stone" as const,
      count: 20,
    }));
    const before = structuredClone(s);
    expect(add(s, "herb", 1)).toBe(false);
    expect(s).toEqual(before);
  });
  it("材料不足制作不扣料", () => {
    const s = initialState();
    add(s, "herb", 2);
    const before = structuredClone(s);
    expect(craft(s)).toBe(false);
    expect(s).toEqual(before);
  });
  it("成品放不下时制作不扣料", () => {
    const s = initialState();
    s.bag = Array.from({ length: 24 }, () => ({
      id: "stone" as const,
      count: 20,
    }));
    s.bag[0] = { id: "herb", count: 20 };
    s.bag[1] = { id: "berry", count: 20 };
    const before = structuredClone(s);
    expect(craft(s)).toBe(false);
    expect(s).toEqual(before);
  });
  it("扣料释放格子后能容纳成品", () => {
    const s = initialState();
    s.bag = Array.from({ length: 24 }, () => ({
      id: "stone" as const,
      count: 20,
    }));
    s.bag[0] = { id: "herb", count: 2 };
    s.bag[1] = { id: "berry", count: 1 };
    expect(craft(s)).toBe(true);
    expect(count(s, "potion")).toBe(1);
    expect(count(s, "herb")).toBe(0);
  });
  it("奖励最多发放一次", () => {
    const s = initialState();
    s.quest = 6;
    expect(reward(s)).toBe(true);
    expect(reward(s)).toBe(false);
    expect(count(s, "potion")).toBe(3);
  });
});
describe("结构化存档", () => {
  it("往返恢复完整世界状态", () => {
    const s = initialState();
    s.chests = ["village-chest"];
    s.killed = ["leaf-1"];
    s.stones = [0, 1, 2];
    s.shortcut = true;
    s.quest = 6;
    s.collected = { "herb-v1": 480 };
    add(s, "wood", 2);
    const restored = parseSave(JSON.stringify(s));
    expect(restored).toEqual(s);
    restored.player.x = 100;
    expect(s.player.x).toBe(670);
  });
  it("拒绝损坏和不兼容存档", () => {
    for (const v of [
      "{",
      "null",
      "{}",
      JSON.stringify({ ...initialState(), schema_version: 2 }),
      JSON.stringify({ ...initialState(), bag: [{ id: "unknown", count: 1 }] }),
      "x".repeat(200001),
    ])
      expect(() => parseSave(v)).toThrow();
  });
  it("拒绝非有限坐标及非法物品数量", () => {
    const s = initialState();
    s.player.x = Infinity;
    expect(() => validate(s)).toThrow();
    s.player.x = 50;
    s.bag[0] = { id: "herb", count: -1 };
    expect(() => validate(s)).toThrow();
  });
});

it("关键材料不可丢弃，普通材料可以释放空间", () => {
  const s = initialState();
  add(s, "crystal", 1);
  add(s, "wood", 1);
  expect(discard(s, "crystal")).toBe(false);
  expect(count(s, "crystal")).toBe(1);
  expect(discard(s, "wood")).toBe(true);
  expect(count(s, "wood")).toBe(0);
});
