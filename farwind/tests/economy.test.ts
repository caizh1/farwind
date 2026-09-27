import { describe, it, expect, vi } from "vitest";
import { initialState, add, count, validate } from "../src/game/systems/state";
import {
  economySnapshot,
  EconomyCommit,
  incomingDamage,
  outgoingDamage,
  type EconomyRequest,
} from "../src/game/systems/economy";
import {
  serviceBuildings,
  serviceEntrances,
} from "../src/data/village-economy";
import { props, canDecorate } from "../src/data/world";
import { motionBlocked, clearMotionLine } from "../src/game/systems/obstacles";
import { DEFENSE_LAYOUT, RESERVED_PARCELS } from "../src/data/village";
const buy = (quantity = 1): EconomyRequest => ({
  sequence: 1,
  kind: "buy",
  shop: "general",
  item: "potion",
  quantity,
});
describe("真实交易和失败原子性", () => {
  it("购买、普通材料出售、库存及钱同步改变，原状态保持", () => {
    const s = initialState(),
      before = structuredClone(s),
      b = economySnapshot(s, buy(2));
    expect(s).toEqual(before);
    expect([
      b.coins,
      count(b, "potion"),
      b.shopStock["general:potion"],
    ]).toEqual([84, 2, 6]);
    add(b, "wood", 4);
    const sold = economySnapshot(b, {
      sequence: 2,
      kind: "sell",
      shop: "general",
      item: "wood",
      quantity: 4,
    });
    expect([
      sold.coins,
      count(sold, "wood"),
      sold.shopStock["general:wood"],
    ]).toEqual([92, 0, 24]);
    expect(() => economySnapshot(sold, { ...buy(), sequence: 2 })).toThrow(
      "已处理",
    );
  });
  it.each([0, -1, 1.5, NaN, Infinity, 100, Number.MAX_SAFE_INTEGER])(
    "非法数量%s不改状态",
    (quantity) => {
      const s = initialState(),
        before = structuredClone(s);
      expect(() => economySnapshot(s, buy(quantity))).toThrow();
      expect(s).toEqual(before);
    },
  );
  it("余额、库存、容量不足以及任务物品保护", () => {
    for (const setup of [
      (s: any) => (s.coins = 0),
      (s: any) => (s.shopStock["general:potion"] = 0),
      (s: any) =>
        (s.bag = Array.from({ length: 24 }, () => ({
          id: "stone",
          count: 20,
        }))),
    ]) {
      const s = initialState();
      setup(s);
      const before = structuredClone(s);
      expect(() => economySnapshot(s, buy())).toThrow();
      expect(s).toEqual(before);
    }
    const s = initialState();
    add(s, "crystal", 1);
    expect(() =>
      economySnapshot(s, {
        sequence: 1,
        kind: "sell",
        shop: "general",
        item: "crystal",
        quantity: 1,
      }),
    ).toThrow("不可出售");
    expect(count(s, "crystal")).toBe(1);
  });
  it("换药显式事务推进旧制作任务，空间不足不扣料", () => {
    const s = initialState();
    s.quest = 2;
    add(s, "herb", 2);
    add(s, "berry", 1);
    const r: EconomyRequest = {
      sequence: 1,
      kind: "exchange",
      shop: "healer",
      quantity: 1,
    };
    const next = economySnapshot(s, r);
    expect([next.crafted, next.quest, count(next, "potion")]).toEqual([
      true,
      3,
      1,
    ]);
    expect(count(s, "herb")).toBe(2);
    s.bag = Array.from({ length: 24 }, () => ({ id: "wood", count: 20 }));
    s.bag[0] = { id: "herb", count: 3 };
    s.bag[1] = { id: "berry", count: 2 };
    expect(() => economySnapshot(s, r)).toThrow("成品空间");
    expect(count(s, "herb")).toBe(3);
  });
  it("休息付费不推进世界时间，满血满体力不扣钱", () => {
    const s = initialState(),
      r: EconomyRequest = {
        sequence: 1,
        kind: "rest",
        shop: "inn",
        quantity: 1,
      };
    expect(() => economySnapshot(s, r)).toThrow("无需花费");
    s.player.hp = 25;
    s.player.stamina = 10;
    const next = economySnapshot(s, r);
    expect([
      next.player.hp,
      next.player.stamina,
      next.coins,
      next.time,
    ]).toEqual([100, 100, 108, 480]);
  });
  it("持久化完成前不发布，失败不发布，重入和旧请求不能重复扣款", async () => {
    let state = initialState(),
      finish!: () => void;
    const lock = new EconomyCommit(),
      publish = vi.fn((next) => (state = next));
    const deferred = new Promise<void>((ok) => (finish = ok)),
      write = vi.fn(() => deferred);
    const pending = lock.run(() => state, buy(), write, publish);
    expect(state.coins).toBe(120);
    expect(lock.busy).toBe(true);
    await expect(lock.run(() => state, buy(), write, publish)).rejects.toThrow(
      "正在保存",
    );
    finish();
    await pending;
    expect(publish).toHaveBeenCalledTimes(1);
    expect(state.coins).toBe(102);
    await expect(lock.run(() => state, buy(), write, publish)).rejects.toThrow(
      "已处理",
    );
    const before = structuredClone(state);
    await expect(
      lock.run(
        () => state,
        { ...buy(), sequence: 2 },
        async () => {
          throw Error("事务中止");
        },
        publish,
      ),
    ).rejects.toThrow("事务中止");
    expect(state).toEqual(before);
    expect(lock.busy).toBe(false);
    expect(publish).toHaveBeenCalledTimes(1);
  });
});
describe("装备和持久化迁移", () => {
  it("装备逐件占格、从背包转入栏位，实际改变两种伤害，卸装还原", () => {
    let s = initialState();
    add(s, "ironSword", 2);
    add(s, "leatherCoat", 1);
    expect(s.bag.filter((a) => a?.id === "ironSword")).toHaveLength(2);
    s = economySnapshot(s, {
      sequence: 1,
      kind: "equip",
      slot: "weapon",
      item: "ironSword",
    });
    s = economySnapshot(s, {
      sequence: 2,
      kind: "equip",
      slot: "armor",
      item: "leatherCoat",
    });
    expect([
      outgoingDamage(s, 18),
      incomingDamage(s, 10),
      incomingDamage(s, 2),
    ]).toEqual([22, 7, 1]);
    expect(validate(s)).toEqual(s);
    s = economySnapshot(s, {
      sequence: 3,
      kind: "equip",
      slot: "weapon",
      item: null,
    });
    expect(outgoingDamage(s, 18)).toBe(18);
    expect(count(s, "ironSword")).toBe(2);
  });
  it("满包不能卸下或错位穿戴，旧装备保留", () => {
    const s = initialState();
    s.equipment.weapon = "ironSword";
    s.bag = Array.from({ length: 24 }, () => ({ id: "wood", count: 20 }));
    expect(() =>
      economySnapshot(s, {
        sequence: 1,
        kind: "equip",
        slot: "weapon",
        item: null,
      }),
    ).toThrow("行囊已满");
    expect(s.equipment.weapon).toBe("ironSword");
    expect(() =>
      economySnapshot(s, {
        sequence: 1,
        kind: "equip",
        slot: "armor",
        item: "ironSword",
      }),
    ).toThrow("不匹配");
  });
  it("旧schema1补初值一次；地图迁移只+600一次，主线及袋中物品保留", () => {
    const old: any = initialState();
    old.schema_version = 1;
    delete old.coins;
    delete old.equipment;
    delete old.economyRevision;
    delete old.shopStock;
    delete old.map_version;
    old.player.x = 2300;
    old.quest = 3;
    old.crafted = true;
    add(old, "crystal", 1);
    const next = validate(old);
    expect([
      next.schema_version,
      next.coins,
      next.map_version,
      next.player.x,
      next.quest,
    ]).toEqual([6, 120, 6, 2900, 3]);
    next.coins = 17;
    expect(validate(next)).toEqual(next);
    expect(next.bag).toEqual(old.bag);
  });
  it.each([
    { coins: -1 },
    { coins: 1.5 },
    { equipment: { weapon: "leatherCoat", armor: null } },
    { shopStock: {} },
    { economyRevision: Infinity },
  ])("新结构损坏不以默认值覆盖:%j", (bad) => {
    expect(() => validate({ ...initialState(), ...bad })).toThrow();
  });
});
it("新增六栋建筑、四入口可站立，门口和未来地块保留，装饰避开门前", () => {
  expect(serviceBuildings).toHaveLength(6);
  expect(RESERVED_PARCELS).toHaveLength(4);
  for (const p of serviceEntrances) {
    expect(motionBlocked(p.x - 35, p.y + 35), p.id).toBe(false);
    expect(canDecorate(p.x, p.y + 35), p.id).toBe(false);
    expect(props.find((x) => x.id === p.id)).toBeTruthy();
  }
  for (const d of DEFENSE_LAYOUT)
    for (const p of [...d.posts, d.tower])
      expect(motionBlocked(p.x, p.y, d.towerId)).toBe(false);
});
