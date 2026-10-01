import { describe, expect, it } from "vitest";
import { PEOPLE, FACILITIES } from "../src/data/npcLife";
import {
  CAMP_BOSSES,
  type CampBossKind,
} from "../src/data/maps/windbell/campBosses";
import { ENCOUNTERS } from "../src/data/maps/windbell/encounters";
import { initialState, validate, parseSave } from "../src/game/systems/state";
import { settleEncounterDeath } from "../src/game/systems/encounterState";
import {
  grantMilestoneRunes,
  runeSnapshot,
} from "../src/game/systems/runeState";
import { SaveQueue } from "../src/game/systems/saveQueue";
import { StateCommit } from "../src/game/systems/stateCommit";

const safety = {
  combat: false,
  boss: false,
  defense: false,
  trial: false,
  story: false,
  action: false,
};
const observed = (count: number) => {
  const s = initialState();
  for (const person of PEOPLE.slice(0, count))
    s.life.observed[person.id] = {
      time: s.time,
      label: "观察到实际居民活动",
      space: "village",
    };
  return s;
};

describe("完整人口观察与首领奖励保存", () => {
  it.each([12, 13, 15])("观察%d人可以保存/读档，既有记录完整保留", (count) => {
    const s = observed(count),
      copy = parseSave(JSON.stringify(s));
    expect(Object.keys(copy.life.observed)).toHaveLength(count);
    expect(copy.life.observed).toEqual(s.life.observed);
  });
  it("拒绝非法人口ID、设施观察、未来/负数时间与非法空间", () => {
    for (const id of ["missing-resident", "player", FACILITIES[0].id]) {
      const s = observed(12);
      Object.assign(s.life.observed, {
        [id]: { time: s.time, label: "非法观察对象", space: "village" },
      });
      expect(() => validate(s)).toThrow("生活事件或设施记录无效");
    }
    for (const change of [
      { time: initialState().time + 1 },
      { time: -1 },
      { time: NaN },
      { space: "invalid" },
      { label: 42 },
    ]) {
      const s = observed(15);
      Object.assign(s.life.observed[PEOPLE[0].id]!, change);
      expect(() => validate(s)).toThrow("生活事件或设施记录无效");
    }
  });
  for (const boss of Object.keys(CAMP_BOSSES) as CampBossKind[])
    it(`${boss} 死亡→一次性符文→落盘→读档→装备生效`, async () => {
      const s = observed(15),
        camp = ENCOUNTERS.find((c) => c.id === CAMP_BOSSES[boss].camp)!;
      s.encounters.groups[camp.id].activated = true;
      for (const m of camp.members.filter((m) => !m.boss))
        settleEncounterDeath(s.encounters, m.id, false);
      s.encounters.groups[camp.id].boss!.stage = "battle";
      const before = structuredClone(s);
      expect(
        settleEncounterDeath(
          s.encounters,
          camp.members.find((m) => m.boss)!.id,
          true,
        ),
      ).toBe(true);
      const earned = grantMilestoneRunes(s, before),
        rune = earned.find((r) => r.acquisition.kind === "boss")!;
      expect(rune).toBeTruthy();
      expect(s.runes.slots).not.toContain(rune.id);
      expect(grantMilestoneRunes(s, before)).toEqual([]);
      let disk = "";
      const queue = new SaveQueue(async (snapshot) => {
        disk = JSON.stringify(snapshot);
      });
      await queue.enqueue(s);
      const restored = parseSave(disk);
      expect(restored.encounters.groups[camp.id].boss!.stage).toBe("defeated");
      expect(restored.runes.owned.filter((id) => id === rune.id)).toHaveLength(
        1,
      );
      expect(restored.life.observed).toEqual(s.life.observed);
      const equipped = runeSnapshot(
        restored,
        { kind: "equip", slot: 0, id: rune.id },
        safety,
      );
      await queue.enqueue(equipped);
      expect(parseSave(disk).runes.slots[0]).toBe(rune.id);
    });
  it("保存失败不发布配装，旧槽保留，重试只提交一次；脱战限制仍有效", async () => {
    let state = observed(15);
    state.runes.owned = ["r01", "r02"];
    const old = state;
    let writes = 0;
    const transaction = new StateCommit();
    const run = (fail: boolean) =>
      transaction.run(
        () => state,
        (s) => runeSnapshot(s, { kind: "equip", slot: 0, id: "r01" }, safety),
        async () => {
          writes++;
          if (fail) throw Error("测试保存失败");
        },
        (next) => (state = next),
      );
    await expect(run(true)).rejects.toThrow("测试保存失败");
    expect(state).toBe(old);
    expect(state.runes.slots[0]).toBeNull();
    await run(false);
    expect(writes).toBe(2);
    expect(state.runes.slots[0]).toBe("r01");
    expect(() =>
      runeSnapshot(state, { kind: "equip", slot: 1, id: "r01" }, safety),
    ).toThrow("同名符文已经装备");
    expect(() =>
      runeSnapshot(
        state,
        { kind: "equip", slot: 1, id: "r02" },
        { ...safety, combat: true },
      ),
    ).toThrow("脱战八秒");
  });
});
