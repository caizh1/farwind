import { describe, it, expect } from "vitest";
import { initialState, parseSave } from "../src/game/systems/state";
import {
  WIND_GIFTS,
  initialWindGifts,
  offerWindGift,
  chooseWindGift,
  giftValue,
  giftEffect,
  validateWindGifts,
  giftChoiceSnapshot,
  type WindGiftId,
} from "../src/game/systems/windGifts";
import {
  RuneCombat,
  type RuneTarget,
  type RuneEvent,
} from "../src/game/systems/runeCombat";
import { CombatController, STRIKES } from "../src/game/systems/combat";
import { resolveDamage, type DamageEvent } from "../src/game/systems/damage";
import { StateCommit } from "../src/game/systems/stateCommit";

const hit: DamageEvent = {
  sourceId: "敌人",
  targetId: "player",
  attackId: "实伤",
  amount: 23,
  sourceType: "enemy-melee",
  eventId: null,
};
const source = { id: "敌人", faction: "hostile" as const, hp: 100, armor: 0 };

function arena(level = 1) {
  const state = initialState();
  state.player.x = 0;
  state.player.y = 0;
  state.windGifts.held = [{ id: "riposte", level }];
  const enemies: RuneTarget[] = [
    { id: "正前方", x: 100, y: 0, hp: 1000 },
    { id: "扇形侧翼", x: 90, y: 70, hp: 1000 },
    { id: "背后", x: -70, y: 0, hp: 1000 },
    { id: "障碍后", x: 120, y: 0, hp: 1000 },
    { id: "射程外", x: 220, y: 0, hp: 1000 },
  ];
  const events: RuneEvent[] = [];
  const engine = new RuneCombat({
    state: () => state,
    targets: () => enemies,
    A: () => 18,
    clear: (_a, b) => b !== enemies[3],
    visible: () => true,
    blocker: () => null,
    push: () => "immune",
    sound: () => {},
    checkpoint: () => {},
    damage: (e, ev) => {
      const h = resolveDamage(
        {
          sourceId: "player",
          targetId: e.id,
          attackId: ev.eventId,
          amount: ev.amount,
          sourceType: "player-rune",
          eventId: null,
        },
        { id: "player", faction: "village", hp: state.player.hp, armor: 0 },
        { id: e.id, faction: "hostile", hp: e.hp, armor: 0 },
      );
      if (h.applied) {
        e.hp = h.hp;
        events.push(ev);
      }
      return h;
    },
  });
  engine.random = () => 1;
  return { state, enemies, events, engine };
}

describe("风赐持续累加与存档安全", () => {
  it("一千次正式候选领取可以超过六种和二级，其他候选不会因升级重抽", () => {
    const gifts = initialWindGifts();
    for (let i = 0; i < 1000; i++) {
      offerWindGift(gifts, `累加:${i}`, i * 17, true);
      chooseWindGift(gifts, `累加:${i}`, gifts.pending[0].candidates[0]);
    }
    expect(gifts.held.length).toBeGreaterThan(6);
    expect(gifts.held.every((g) => g.level > 2)).toBe(true);
    expect(gifts.held.reduce((n, g) => n + g.level, 0)).toBe(1000);
    expect(validateWindGifts(gifts)).toEqual(gifts);
    const state = initialState();
    state.windGifts = gifts;
    expect(parseSave(JSON.stringify(state)).windGifts).toEqual(gifts);
    offerWindGift(gifts, "待选甲", 3, true);
    offerWindGift(gifts, "待选乙", 4, true);
    const second = structuredClone(gifts.pending[1]);
    chooseWindGift(gifts, "待选甲", gifts.pending[0].candidates[0]);
    expect(gifts.pending[0]).toEqual(second);
  });
  it("旧一二级记录保留，非法等级和重复种类拒绝导入", () => {
    const state = initialState();
    state.windGifts.held = [
      { id: "armor", level: 1 },
      { id: "riposte", level: 2 },
    ];
    expect(parseSave(JSON.stringify(state)).windGifts.held).toEqual(
      state.windGifts.held,
    );
    for (const level of [
      0,
      -1,
      0.5,
      NaN,
      Infinity,
      Number.MAX_SAFE_INTEGER + 1,
    ])
      expect(() =>
        validateWindGifts({
          ...initialWindGifts(),
          held: [{ id: "armor", level }],
        }),
      ).toThrow("风赐记录");
    expect(() =>
      validateWindGifts({
        ...initialWindGifts(),
        held: [
          { id: "armor", level: 1 },
          { id: "armor", level: 2 },
        ],
      }),
    ).toThrow("风赐记录");
  });
  it("高等级领取保存失败不加级，不消费凭据", async () => {
    let state = initialState();
    state.windGifts.held = [{ id: "armor", level: 150 }];
    offerWindGift(state.windGifts, "高阶奖励", 4, true);
    const id = state.windGifts.pending[0].candidates[0],
      before = structuredClone(state),
      commit = new StateCommit();
    await expect(
      commit.run(
        () => state,
        (s) => giftChoiceSnapshot(s, "高阶奖励", id),
        async () => {
          throw Error("保存失败");
        },
        (s) => (state = s),
      ),
    ).rejects.toThrow("保存失败");
    expect(state).toEqual(before);
  });
  it("风甲每级百分之一，百分百之后不形成负伤害或回血，护盾仍按减伤后吸收", () => {
    for (const level of [1, 2, 50, 99, 100, 130]) {
      const gifts = initialWindGifts();
      gifts.held = [{ id: "armor", level }];
      const result = resolveDamage(hit, source, {
        id: "player",
        faction: "village",
        hp: 100,
        armor: 0,
        incomingScale: Math.max(0, 1 - giftValue(gifts, "armor")),
      });
      expect(result.damage).toBeCloseTo(23 * Math.max(0, 1 - level * 0.01));
      expect(result.hp).toBeLessThanOrEqual(100);
    }
    const shield = { amount: 10, remaining: 1000 };
    expect(
      resolveDamage(hit, source, {
        id: "player",
        faction: "village",
        hp: 100,
        armor: 0,
        incomingScale: 0.5,
        shield,
      }).damage,
    ).toBe(1.5);
    expect(giftEffect("armor", 13)).toContain("−13%");
  });
  it("持续增伤不再被百分之六十或一万伤害静默截断，减耗不能反向恢复体力", () => {
    const h = arena();
    const ev = h.engine.native(
      "高阶近战",
      h.enemies[0],
      100,
      1,
      false,
      false,
      "out",
      120,
    );
    expect(ev.amount).toBe(12100);
    expect(
      resolveDamage({ ...hit, amount: ev.amount }, source, {
        id: "player",
        faction: "village",
        hp: 100,
        armor: 0,
      }).killed,
    ).toBe(true);
    const gifts = initialWindGifts();
    gifts.held = [{ id: "thrift", level: 13 }];
    const c = new CombatController();
    c.dashCostMultiplier = Math.max(0, 1 - giftValue(gifts, "thrift"));
    const player = { x: 0, y: 0, stamina: 30 };
    c.requestActions(
      [{ kind: "dash", at: 0, sequence: 1, axis: { x: 1, y: 0 } }],
      0,
      player,
      3,
    );
    c.flushActions(0, player);
    expect(player.stamina).toBe(30);
  });
});

describe("回锋一次近战与扇形剑气", () => {
  it("无弹反无强化；剑风不消耗，下一次近战增伤且只释放一道剑气", () => {
    const h = arena(3),
      e = h.enemies[0];
    h.engine.captureGiftAttack("普通攻击", false);
    expect(h.engine.native("普通攻击", e, 100, 1).amount).toBe(100);
    h.engine.armGiftRiposte();
    h.engine.captureGiftAttack("剑风", true);
    h.engine.releaseGiftAttack("剑风", h.state.player, { x: 1, y: 0 });
    expect(h.events).toHaveLength(0);
    expect(h.engine.native("剑风", e, 100, 1, true).amount).toBe(100);
    h.engine.captureGiftAttack("强化近战", false);
    expect(h.engine.native("强化近战", e, 100, 1).amount).toBe(160);
    h.engine.releaseGiftAttack("强化近战", h.state.player, { x: 1, y: 0 });
    h.engine.releaseGiftAttack("强化近战", h.state.player, { x: 1, y: 0 });
    expect(h.events.map((ev) => ev.targetId)).toEqual(["正前方", "扇形侧翼"]);
    expect(
      h.events.every(
        (ev) =>
          Math.abs(ev.amount - 21.6) < 1e-8 &&
          ev.tags.includes("riposte_fan") &&
          ev.sourceKind !== "native",
      ),
    ).toBe(true);
    expect(
      h.engine.effects.filter((e) => e.visual === "wind-gift-fan"),
    ).toHaveLength(1);
    h.engine.captureGiftAttack("后续近战", false);
    expect(h.engine.native("后续近战", e, 100, 1).amount).toBe(100);
  });
  it("同一强化挥击命中多敌均增伤，取消后的下一击不继承，死亡和场景清理不恢复蓄势", () => {
    const h = arena();
    h.engine.armGiftRiposte();
    h.engine.captureGiftAttack("挥击", false);
    for (const e of h.enemies)
      expect(h.engine.native("挥击", e, 100, 1).amount).toBe(120);
    h.engine.captureGiftAttack("取消后重开", false);
    expect(h.engine.native("取消后重开", h.enemies[0], 100, 1).amount).toBe(
      100,
    );
    h.state.player.hp = 0;
    h.engine.releaseGiftAttack("挥击", h.state.player, { x: 1, y: 0 });
    expect(h.events).toHaveLength(0);
    h.engine.clear();
    expect(h.engine.giftRiposteReady).toBe(false);
    expect(h.engine.giftRipostes.size).toBe(0);
  });
  it("回锋快照保留起手等级，持续获得新弹反不改变正在挥击的增益", () => {
    const h = arena();
    h.engine.armGiftRiposte();
    h.engine.captureGiftAttack("第一击", false);
    h.state.windGifts.held[0].level = 2;
    h.engine.armGiftRiposte();
    h.engine.captureGiftAttack("第二击", false);
    expect(h.engine.native("第一击", h.enemies[0], 100, 1).amount).toBe(120);
    expect(h.engine.native("第二击", h.enemies[0], 100, 1).amount).toBe(140);
    expect(Object.keys(WIND_GIFTS)).toHaveLength(61);
  });
});
