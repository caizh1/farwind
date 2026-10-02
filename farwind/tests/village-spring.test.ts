import { describe, it, expect } from "vitest";
import { props } from "../src/data/world";
import { initialState, validate } from "../src/game/systems/state";
import { springSnapshot } from "../src/game/systems/villageSpring";
import { StateCommit } from "../src/game/systems/stateCommit";
import { type RuneSafety } from "../src/game/systems/runeState";
import { motionBlocked, clearMotionLine } from "../src/game/systems/obstacles";

const safe: RuneSafety = { combat: false, boss: false, defense: false, trial: false, story: false, action: false };
const wounded = () => {
  const state = initialState();
  Object.assign(state.player, { x: 680, y: 920, hp: 27, stamina: 8 });
  return state;
};
describe("村庄饮用泉水", () => {
  it("沿用现有泉水，四侧可达；只恢复生命体力且支持读档", () => {
    const spring = props.find(p => p.id === "plaza-fountain")!;
    expect(spring.label).toContain("饮用泉水");
    for (const point of [{ x: 680, y: 920 }, { x: 680, y: 820 }, { x: 605, y: 870 }, { x: 755, y: 870 }]) {
      const state = wounded(); Object.assign(state.player, point);
      expect(motionBlocked(point.x, point.y)).toBe(false);
      expect(clearMotionLine(point, spring, spring.id)).toBe(true);
      const next = springSnapshot(state, safe);
      expect(validate(JSON.parse(JSON.stringify(next)))).toEqual(next);
      expect(next).toEqual({ ...state, player: { ...state.player, hp: 100, stamina: 100 } });
      expect(state.player.hp).toBe(27);
    }
  });
  it("拒绝远程、室内、倒下、未脱战或正在行动，满状态不重复保存", () => {
    for (const key of Object.keys(safe) as (keyof RuneSafety)[])
      expect(() => springSnapshot(wounded(), { ...safe, [key]: true })).toThrow("暂时无法");
    const far = wounded(); far.player.y = 985;
    expect(() => springSnapshot(far, safe)).toThrow("泉水旁");
    const indoor = wounded(); indoor.life.playerSpace = "general-shop";
    expect(() => springSnapshot(indoor, safe)).toThrow("泉水旁");
    const dead = wounded(); dead.player.hp = 0;
    expect(() => springSnapshot(dead, safe)).toThrow("倒下");
    const full = wounded(); full.player.hp = full.player.stamina = 100;
    expect(() => springSnapshot(full, safe)).toThrow("已满");
  });
  it("保存失败不发布恢复结果，保存期间重复饮用不产生并发状态", async () => {
    let state = wounded(); const before = structuredClone(state), commit = new StateCommit();
    await expect(commit.run(() => state, s => springSnapshot(s, safe), async () => { throw Error("保存失败"); }, next => { state = next; })).rejects.toThrow("保存失败");
    expect(state).toEqual(before); expect(commit.busy).toBe(false);
    let finish!: () => void;
    const pending = commit.run(() => state, s => springSnapshot(s, safe), () => new Promise<void>(resolve => { finish = resolve; }), next => { state = next; });
    await Promise.resolve();
    await expect(commit.run(() => state, s => springSnapshot(s, safe), async () => {}, next => { state = next; })).rejects.toThrow("正在保存");
    expect(state).toEqual(before); finish(); await pending;
    expect(state.player).toMatchObject({ hp: 100, stamina: 100 });
  });
});
