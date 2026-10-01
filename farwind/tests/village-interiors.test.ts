import { describe, it, expect } from "vitest";
import {
  HOMES,
  FACILITIES,
  PRIVATE_STORAGE,
  ROOM,
  type SpaceId,
} from "../src/data/npcLife";
import {
  INTERIOR_FURNITURE,
  INTERIOR_SERVICE,
} from "../src/data/villageInteriors";
import { roomBlocked, spaceClear } from "../src/game/systems/npcNavigation";
import { initialState, add, count, validate } from "../src/game/systems/state";
import {
  economySnapshot,
  maxTradeQuantity,
  EconomyCommit,
} from "../src/game/systems/economy";
import { initialStock } from "../src/data/economy";
import { sleepSnapshot } from "../src/game/systems/sleep";
// 以真实房间几何遍历脚底通路，验证新增高柜没有堵住居民已有活动点。
function accessible(space: SpaceId, target: { x: number; y: number }) {
  const queue = [{ ...ROOM.entry }],
    seen = new Set<string>();
  while (queue.length) {
    const p = queue.shift()!,
      key = `${p.x},${p.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (
      Math.hypot(p.x - target.x, p.y - target.y) < 18 &&
      spaceClear(space, p, target)
    )
      return true;
    for (const [dx, dy] of [
      [10, 0],
      [-10, 0],
      [0, 10],
      [0, -10],
    ]) {
      const q = { x: p.x + dx, y: p.y + dy };
      if (
        !roomBlocked(space, q.x, q.y) &&
        spaceClear(space, p, q) &&
        !seen.has(`${q.x},${q.y}`)
      )
        queue.push(q);
    }
  }
  return false;
}
describe("十栋房屋室内真实通路", () => {
  it("每栋都有独立家具，所有床位、活动台、私人物品及服务柜台可从出口到达", () => {
    expect(HOMES).toHaveLength(10);
    expect(
      FACILITIES.filter(
        (f) => f.kind === "bed" && f.place.space === "barracks",
      ),
    ).toHaveLength(12);
    expect(
      FACILITIES.filter((f) => f.kind === "bed" && f.place.space === "inn"),
    ).toHaveLength(6);
    for (const h of HOMES) {
      expect(
        INTERIOR_FURNITURE.some((f) => f.space === h.id),
        h.name,
      ).toBe(true);
      for (const f of FACILITIES.filter((f) => f.place.space === h.id))
        expect(accessible(h.id, f.place), `${h.name}:${f.label}`).toBe(true);
      for (const box of PRIVATE_STORAGE.filter((b) => b.space === h.id))
        expect(accessible(h.id, box.use), `${h.name}:${box.label}`).toBe(true);
      for (const f of INTERIOR_FURNITURE.filter(
        (f) => f.space === h.id && !f.ground,
      ))
        expect(
          accessible(h.id, f.shop ? INTERIOR_SERVICE : { x: f.x, y: f.y + 20 }),
          `${h.name}:${f.label}`,
        ).toBe(true);
    }
  });
  it("旅馆柜台可办理夜间住宿，其它室内拒绝", () => {
    const s = initialState();
    s.time = 1200;
    s.life.playerSpace = "inn";
    Object.assign(s.player, INTERIOR_SERVICE);
    const safe = {
      conflict: false,
      action: false,
      threat: false,
      projectile: false,
    };
    expect(sleepSnapshot(s, 1, safe).time).toBe(1800);
    s.life.playerSpace = "general-shop";
    expect(() => sleepSnapshot(s, 1, safe)).toThrow("旅馆");
  });
});
describe("商品、补货与旧存档", () => {
  it("旧八类库存迁移保留既有交易，缺项拒绝；迁移后保存重读不补第二次", () => {
    const old: any = initialState();
    delete old.shopStockDay;
    old.shopStock = Object.fromEntries(
      Object.entries(initialStock()).slice(0, 8),
    );
    old.shopStock["general:potion"] = 0;
    const migrated = validate(old);
    expect(migrated.shopStock["general:potion"]).toBe(0);
    expect(migrated.shopStock["inn:soup"]).toBe(8);
    migrated.shopStock["inn:soup"] = 2;
    expect(
      validate(JSON.parse(JSON.stringify(migrated))).shopStock["inn:soup"],
    ).toBe(2);
    delete old.shopStock["general:wood"];
    expect(() => validate(old)).toThrow("旧商店库存缺失");
  });
  it("旧存档站在新增柜子的位置时安全迁移，保留生命、金币与居民行动", () => {
    const old: any = initialState();
    delete old.shopStockDay;
    old.life.playerSpace = "elder-home";
    Object.assign(old.player, { x: 680, y: 540, hp: 42 });
    const n = old.life.people.find((n: any) => n.id === "elder");
    n.body.space = "elder-home";
    n.body.x = 680;
    n.body.y = 540;
    const action = structuredClone(n.action),
      migrated = validate(old);
    expect(migrated.player).toMatchObject({ ...ROOM.entry, hp: 42 });
    expect(migrated.coins).toBe(old.coins);
    expect(migrated.life.people.find((n) => n.id === "elder")!.action).toEqual(
      action,
    );
    expect(
      migrated.life.people.find((n) => n.id === "elder")!.body,
    ).toMatchObject(ROOM.entry);
  });
  it("隔日仅补基础库存，保留超额收购，同日刷新不得补货", () => {
    const s = initialState();
    s.time = 1500;
    s.shopStock["general:potion"] = 0;
    s.shopStock["general:wood"] = 30;
    const n = economySnapshot(s, { kind: "restock", sequence: 1 });
    expect(n.shopStock["general:potion"]).toBe(8);
    expect(n.shopStock["general:wood"]).toBe(30);
    expect(n.shopStockDay).toBe(1);
    expect(() =>
      economySnapshot(validate(n), { kind: "restock", sequence: 2 }),
    ).toThrow("今天");
  });
  it.each([
    ["bread", 20, 10],
    ["tea", 0, 35],
    ["soup", 20, 50],
  ] as const)("%s购买、使用、重载保持正确恢复与数量", (item, hp, stamina) => {
    const s = initialState();
    s.player.hp = 30;
    s.player.stamina = 20;
    const bought = economySnapshot(s, {
      kind: "buy",
      shop: "inn",
      item,
      quantity: 2,
      sequence: 1,
    });
    const used = economySnapshot(bought, {
      kind: "consume",
      item,
      sequence: 2,
    });
    expect([used.player.hp, used.player.stamina, count(used, item)]).toEqual([
      30 + hp,
      20 + stamina,
      1,
    ]);
    expect(validate(JSON.parse(JSON.stringify(used)))).toEqual(used);
  });
  it("满状态不消耗，满包、缺钱、缺货的上限与事务一致", () => {
    const s = initialState();
    add(s, "bread", 1);
    expect(() =>
      economySnapshot(s, { kind: "consume", item: "bread", sequence: 1 }),
    ).toThrow("状态充足");
    expect(count(s, "bread")).toBe(1);
    s.coins = 6;
    expect(maxTradeQuantity(s, "inn", "bread")).toBe(0);
    expect(() =>
      economySnapshot(s, {
        kind: "buy",
        shop: "inn",
        item: "bread",
        quantity: 1,
        sequence: 1,
      }),
    ).toThrow("金币不足");
    s.coins = 120;
    s.shopStock["inn:bread"] = 0;
    expect(maxTradeQuantity(s, "inn", "bread")).toBe(0);
    s.shopStock["inn:bread"] = 12;
    s.bag = Array.from({ length: 24 }, () => ({
      id: "wood" as const,
      count: 20,
    }));
    expect(maxTradeQuantity(s, "inn", "bread")).toBe(0);
    expect(() =>
      economySnapshot(s, {
        kind: "buy",
        shop: "inn",
        item: "bread",
        quantity: 1,
        sequence: 1,
      }),
    ).toThrow("空间不足");
  });
  it("使用保存失败保持原物品和状态，成功后旧请求不能再次消耗", async () => {
    let s = initialState();
    s.player.hp = 20;
    add(s, "soup", 2);
    const before = structuredClone(s),
      commit = new EconomyCommit(),
      request = {
        kind: "consume" as const,
        item: "soup" as const,
        sequence: 1,
      };
    await expect(
      commit.run(
        () => s,
        request,
        async () => {
          throw Error("存储拒绝");
        },
        (next) => {
          s = next;
        },
      ),
    ).rejects.toThrow("存储拒绝");
    expect(s).toEqual(before);
    await commit.run(
      () => s,
      request,
      async () => {},
      (next) => {
        s = next;
      },
    );
    expect(count(s, "soup")).toBe(1);
    await expect(
      commit.run(
        () => s,
        request,
        async () => {},
        (next) => {
          s = next;
        },
      ),
    ).rejects.toThrow("已处理");
    expect(count(s, "soup")).toBe(1);
  });
});
