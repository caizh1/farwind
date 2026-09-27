import { describe, expect, it } from "vitest";
import { initialState, validate } from "../src/game/systems/state";
import { EastDefense } from "../src/game/systems/defense";
import { NpcLife } from "../src/game/systems/npcLife";
import { chooseSpeech } from "../src/game/systems/npcSpeech";
import { FACILITIES, LIFE } from "../src/data/npcLife";
const setup = () => {
  const s = initialState(),
    l = new NpcLife(s, new EastDefense(s.defense, 0));
  s.life.playerSpace = "healer-home";
  Object.assign(s.player, { x: 830, y: 845 });
  const healer = s.life.people.find((n) => n.id === "healer")!;
  Object.assign(
    healer.body!,
    FACILITIES.find((f) => f.id === "pharmacy")!.place,
  );
  return { s, l, healer };
};
describe("环境短句的认知、频率与读档", () => {
  it("只有真实工作阶段才说配药，每天同类短句一次且不改资源和关系", () => {
    const { s, l, healer } = setup();
    healer.gear = "carried";
    l.begin(healer, {
      kind: "work",
      target: healer.body!,
      facility: "pharmacy",
      task: null,
      score: 80,
      label: "配药",
    });
    const before = structuredClone({
      stores: s.life.stores,
      relations: healer.relations,
    });
    expect(chooseSpeech(l)).toBeNull();
    healer.action!.phase = "perform";
    expect(chooseSpeech(l)?.text).toContain("药还在配");
    s.life.elapsed += LIFE.speechPersonMs + 1;
    expect(chooseSpeech(l)).toBeNull();
    expect({ stores: s.life.stores, relations: healer.relations }).toEqual(
      before,
    );
    const restored = validate(s),
      next = new NpcLife(restored, new EastDefense(restored.defense, 0));
    expect(chooseSpeech(next)).toBeNull();
    expect(restored.life.people[1].speech.routines).toEqual(["work"]);
  });
  it("未知室外事件不能说，近距离实际转述后明确使用听说模板", () => {
    const { s, l, healer } = setup(),
      elder = s.life.people[0];
    const event = l.emit(
      "care",
      { space: "elder-home", x: 600, y: 820 },
      "healer",
      ["elder"],
      "实际照护记录",
    );
    expect(healer.memories).toHaveLength(0);
    expect(chooseSpeech(l)).toBeNull();
    Object.assign(elder.body!, { space: "healer-home", x: 780, y: 835 });
    expect(l.report("elder", "healer", event.id)).toBe(true);
    expect(chooseSpeech(l)?.text).toContain("听同伴说，岚爷爷已经接受救治");
    s.life.elapsed += LIFE.speechPersonMs;
    expect(chooseSpeech(l)).toBeNull(); // 同一事件不会由另一人在同一区域再刷一遍。
    const restored = validate(s);
    expect(
      chooseSpeech(new NpcLife(restored, new EastDefense(restored.defense, 0))),
    ).toBeNull();
  });
  it("紧急信息可打断闲聊冷却，后续救治知识压过旧伤情", () => {
    const { s, l, healer } = setup();
    healer.gear = "carried";
    l.begin(healer, {
      kind: "work",
      target: healer.body!,
      facility: "pharmacy",
      task: null,
      score: 80,
      label: "配药",
    });
    healer.action!.phase = "perform";
    expect(chooseSpeech(l)?.urgent).toBe(false);
    s.life.alarm = 2;
    l.emit("alarm", { ...healer.body! }, "bell", [], "居民区威胁");
    expect(chooseSpeech(l)?.text).toContain("带着药箱");
    l.emit("injury", healer.body!, "enemy", ["elder"], "真实伤情");
    l.emit("care", healer.body!, "healer", ["elder"], "已救治");
    s.life.elapsed += LIFE.speechAreaMs;
    expect(chooseSpeech(l)?.text).toContain("已经接受救治");
  });
  it("跨空间、隔家具、睡眠及阵亡角色不产生短句，超限载荷拒绝", () => {
    const { s, l, healer } = setup();
    l.emit("injury", healer.body!, "enemy", ["elder"], "真实伤情");
    s.life.playerSpace = "village";
    expect(chooseSpeech(l)).toBeNull();
    s.life.playerSpace = "healer-home";
    Object.assign(s.player, { x: 830, y: 700 }); // 桌子阻断视线。
    expect(chooseSpeech(l)).toBeNull();
    healer.speech.routines = Array(15).fill("work");
    expect(() => validate(s)).toThrow();
  });
  it("子版本2迁移不复播旧经历，也不发资源或改变死亡事实", () => {
    const { s, l } = setup();
    l.emit("care", s.life.people[1].body!, "healer", ["elder"], "既有经历");
    const old: any = structuredClone(s);
    old.life.version = 2;
    delete old.life.speechAt;
    delete old.life.speechUrgentAt;
    delete old.life.speechEventFloor;
    for (const n of old.life.people) {
      delete n.speech;
      delete n.supplies;
    }
    Object.assign(old.defense.guards[0], { hp: 0, dead: true, mode: "dead" });
    const next = validate(old),
      life = new NpcLife(next, new EastDefense(next.defense, 0));
    expect(next.life.version).toBe(4);
    expect(next.life.stores).toEqual(s.life.stores);
    expect(next.defense.guards[0].dead).toBe(true);
    expect(chooseSpeech(life)).toBeNull();
    expect(validate(next)).toEqual(next);
  });
});
