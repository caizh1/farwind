import { describe, it, expect, vi, beforeEach } from "vitest";
import { openCommissions } from "../src/game/ui/commissions";
import { StateCommit } from "../src/game/systems/stateCommit";
import { initialState, count, add } from "../src/game/systems/state";
import { settleEncounterDeath } from "../src/game/systems/encounterState";
import { ENCOUNTERS } from "../src/data/maps/windbell/encounters";
import type { World } from "../src/game/scenes/World";
import { save } from "../src/game/systems/save";

vi.mock("../src/game/systems/save", () => ({ save: vi.fn(async () => {}) }));

function fixture() {
  const handlers = new Map<string, () => void | Promise<void>>();
  const status = { hidden: true, textContent: "" };
  const buttons = [{ disabled: false }, { disabled: false }];
  let markup = "";
  const element = { classList: { add() {} }, setAttribute() {} };
  const world = {
    state: initialState(),
    defenseSaving: false,
    economy: new StateCommit(),
    ui: {
      economyBusy: false,
      open() {},
      close() {},
      focusPanel() {},
      skillJournal: () => "",
      shell(_title: string, body: string) {
        markup = body;
        handlers.clear();
      },
      button(id: string, fn: () => void | Promise<void>) {
        handlers.set(id, fn);
      },
      modal: {
        querySelector: (selector: string) =>
          selector === "#commission-feedback" ? status : element,
        querySelectorAll: () => buttons,
      },
    },
    publishState(next: ReturnType<typeof initialState>) {
      this.state = next;
    },
  };
  Object.assign(world.state.player, { x: 560, y: 810 });
  openCommissions(world as unknown as World);
  return { world, handlers, status, buttons, markup: () => markup };
}

beforeEach(() => vi.mocked(save).mockReset().mockResolvedValue(undefined));

describe("委托簿正式操作与保存边界", () => {
  it("保存期间不能重复领取，成功后只发两瓶补给并显示结果", async () => {
    const f = fixture();
    let finish!: () => void;
    vi.mocked(save).mockImplementationOnce(
      () => new Promise<void>((resolve) => (finish = resolve)),
    );
    const submit = f.handlers.get("commission-submit")!;
    const pending = submit();
    await Promise.resolve();
    await submit();
    expect(f.world.ui.economyBusy).toBe(true);
    expect(f.world.defenseSaving).toBe(true);
    expect(f.buttons.every((button) => button.disabled)).toBe(true);
    expect(count(f.world.state, "potion")).toBe(0);
    expect(save).toHaveBeenCalledTimes(1);
    finish();
    await pending;
    expect(count(f.world.state, "potion")).toBe(2);
    expect(f.world.state.fieldQuests["south-supply"]).toBe("active");
    expect(f.status.textContent).toContain("获得启程补给");
    expect(f.world.ui.economyBusy || f.world.defenseSaving).toBe(false);
    await f.handlers.get("commission-submit")!();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("保存失败保留原状态和材料，解除锁后可以重新办理", async () => {
    const f = fixture(),
      before = structuredClone(f.world.state);
    vi.mocked(save).mockRejectedValueOnce(Error("存储失败样本"));
    await f.handlers.get("commission-submit")!();
    expect(f.world.state).toEqual(before);
    expect(
      f.world.ui.economyBusy || f.world.defenseSaving || f.world.economy.busy,
    ).toBe(false);
    expect(f.status.textContent).toContain("存储失败样本");
    await f.handlers.get("commission-submit")!();
    expect(count(f.world.state, "potion")).toBe(2);
  });

  it("完成时实际扣两份药草并发放奖励，完成页不能重复结算", async () => {
    const f = fixture();
    await f.handlers.get("commission-submit")!();
    const camp = ENCOUNTERS.find((group) => group.id === "south-spore-camp")!;
    f.world.state.encounters.groups[camp.id].activated = true;
    for (const member of camp.members)
      settleEncounterDeath(f.world.state.encounters, member.id, false);
    add(f.world.state, "herb", 2);
    const coins = f.world.state.coins;
    f.handlers.get("commission-south")!();
    expect(f.markup()).toContain("可交付");
    await f.handlers.get("commission-submit")!();
    expect(f.world.state.fieldQuests["south-supply"]).toBe("complete");
    expect(count(f.world.state, "herb")).toBe(0);
    expect(count(f.world.state, "potion")).toBe(4);
    expect(f.world.state.coins).toBe(coins + 24);
    await f.handlers.get("commission-submit")!();
    expect(f.world.state.coins).toBe(coins + 24);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("未调查不能修路，已调查时沿用原材料扣除与永久开放规则", async () => {
    const f = fixture();
    f.handlers.get("commission-west")!();
    await f.handlers.get("commission-submit")!();
    expect(save).not.toHaveBeenCalled();
    f.world.state.mapProgress.westRoad = "surveyed";
    add(f.world.state, "wood", 4);
    add(f.world.state, "stone", 2);
    f.handlers.get("commission-west")!();
    await f.handlers.get("commission-submit")!();
    expect(f.world.state.mapProgress.westRoad).toBe("open");
    expect(count(f.world.state, "wood")).toBe(0);
    expect(count(f.world.state, "stone")).toBe(0);
    expect(f.status.textContent).toContain("旧道已经接通");
    await f.handlers.get("commission-submit")!();
    expect(save).toHaveBeenCalledTimes(1);
  });
});
