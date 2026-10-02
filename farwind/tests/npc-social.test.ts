import { describe, expect, it } from "vitest";
import { initialState, validate } from "../src/game/systems/state";
import { EastDefense } from "../src/game/systems/defense";
import { NpcLife } from "../src/game/systems/npcLife";
import { socialCandidate, socialReady } from "../src/game/systems/npcSocial";
import { LIFE, PEOPLE } from "../src/data/npcLife";
import { advanceTime } from "../src/game/systems/worldClock";

const setup = (time = 1080) => {
  const s = initialState();
  s.time = time;
  const d = new EastDefense(s.defense, 0),
    l = new NpcLife(s, d),
    visitor = s.life.people[0],
    patient = s.life.people[1];
  Object.assign(visitor.body!, { space: "elder-home", x: 830, y: 800 });
  Object.assign(patient.body!, {
    space: "healer-home",
    x: 460,
    y: 560,
    hp: 70,
    health: "convalescent",
    recoverAt: s.time + 180,
  });
  // 单元前提为已完成的照护事实；本测试验证探访，不把该前提当自然命中证据。
  const care = l.emit(
    "care",
    patient.body!,
    "carpenter",
    [patient.id],
    "同伴已经接受照护",
  );
  return { s, d, l, visitor, patient, care };
};
const informed = (e: ReturnType<typeof setup>) => {
  e.l.remember(e.visitor, e.care, "report");
  e.visitor.known[e.patient.id] = { ...e.patient.body!, time: e.s.time };
};
const tick = (e: ReturnType<typeof setup>, ms: number) => {
  for (let t = 0; t < ms; t += 100) {
    e.s.time = advanceTime(e.s.time, 100);
    const budget = { queries: 2 };
    e.l.step(100, budget);
    e.d.update(e.s.life.elapsed, 100, e.s.player, budget);
    e.l.consumeDefense(e.d.drainNotices());
  }
};

describe("战后同伴探访与认知边界", () => {
  it("仅知道世界伤情或仅知道位置都不追人，已获事实和近期位置才安排", () => {
    const e = setup();
    expect(socialCandidate(e.l, e.visitor)).toBeNull();
    e.visitor.known.healer = { ...e.patient.body!, time: e.s.time };
    expect(socialCandidate(e.l, e.visitor)).toBeNull();
    informed(e);
    const c = socialCandidate(e.l, e.visitor)!;
    expect(c.social).toEqual({ partner: "healer", occasion: e.care.sequence });
    expect(c.target.space).toBe("healer-home");
    e.visitor.known.healer.time = e.s.time - LIFE.socialKnownMinutes - 1;
    expect(socialCandidate(e.l, e.visitor)).toBeNull();
  });
  it("从长者住宅实际走到药房探望，同一经历存取后不重复加关系", () => {
    const e = setup();
    informed(e);
    const before = e.patient.relations.elder.trust,
      stock = { ...e.s.life.stores };
    expect(e.l.begin(e.visitor, socialCandidate(e.l, e.visitor)!)).toBe(true);
    tick(e, 25000);
    const events = e.s.life.events.filter((x) => x.kind === "company");
    expect(events).toHaveLength(1);
    expect(events[0].place.space).toBe("healer-home");
    expect(e.visitor.social.visited.healer).toBe(e.care.sequence);
    expect(e.patient.relations.elder.trust).toBe(before + 2);
    // 日常用餐与工作可能继续，社交本身不赠钱物；没有修改玩家背包。
    expect(e.s.bag).toEqual(initialState().bag);
    expect(e.s.life.stores.medicine).toBe(stock.medicine);
    const restored = validate(e.s),
      l = new NpcLife(
        restored,
        new EastDefense(restored.defense, restored.life.elapsed),
      );
    l.remember(restored.life.people[1], events[0], "report");
    expect(restored.life.people[1].relations.elder.trust).toBe(before + 2);
    expect(socialCandidate(l, restored.life.people[0])).toBeNull();
    expect(l.dialogue("healer")).toContain("到场探望");
  });
  it("同伴离开旧位置时不全知追踪、不远程结算，有限结束", () => {
    const e = setup();
    informed(e);
    expect(e.l.begin(e.visitor, socialCandidate(e.l, e.visitor)!)).toBe(true);
    // 同伴在未被看见的另一房间失能，不能按普通休养日程自己回到旧位置。
    Object.assign(e.patient.body!, {
      space: "carpenter-home",
      x: 460,
      y: 560,
      hp: 0,
      health: "down",
    });
    const before = e.patient.relations.elder.trust;
    tick(e, 90000);
    expect(e.s.life.events.some((x) => x.kind === "company")).toBe(false);
    expect(e.visitor.action?.social).toBeFalsy();
    expect(e.patient.relations.elder.trust).toBe(before);
    expect(e.visitor.known.healer.space).toBe("healer-home");
  });
  it("交谈中加载保留进度，睡眠或家具阻挡不能完成探望", () => {
    const e = setup();
    informed(e);
    Object.assign(e.visitor.body!, { space: "healer-home", x: 460, y: 595 });
    expect(e.l.begin(e.visitor, socialCandidate(e.l, e.visitor)!)).toBe(true);
    e.visitor.action!.phase = "perform";
    e.visitor.action!.progress = 1000;
    const mid = validate(e.s),
      l = new NpcLife(mid, new EastDefense(mid.defense, 0)),
      n = mid.life.people[0],
      a = n.action!;
    expect(a.progress).toBe(1000);
    expect(socialReady(l, n, a)).toBe(true);
    a.progress = a.duration;
    l.complete(n, a);
    l.complete(n, a);
    expect(mid.life.events.filter((x) => x.kind === "company")).toHaveLength(1);
    const sleeping = setup();
    informed(sleeping);
    Object.assign(sleeping.visitor.body!, {
      space: "healer-home",
      x: 460,
      y: 595,
    });
    sleeping.patient.action = {
      id: 1,
      kind: "sleep",
      target: sleeping.patient.body!,
      facility: "bed:healer",
      task: null,
      pickup: null,
      phase: "perform",
      progress: 0,
      duration: 3000,
      started: 0,
      failures: 0,
      label: "睡觉",
    };
    sleeping.patient.serial = 1;
    sleeping.l.begin(
      sleeping.visitor,
      socialCandidate(sleeping.l, sleeping.visitor)!,
    );
    expect(
      socialReady(sleeping.l, sleeping.visitor, sleeping.visitor.action!),
    ).toBe(false);
    expect(sleeping.s.life.events.some((x) => x.kind === "company")).toBe(
      false,
    );
  });
  it("积极卫兵也必须在私人窗口经岗位协调，警戒立即召回", () => {
    const window = PEOPLE[4].schedule.find((s) => s.activity === "habit")!,
      e = setup(window.from + 5),
      guard = e.s.life.people[4];
    guard.alarm = 0;
    e.l.remember(guard, e.care, "report");
    guard.known.healer = { ...e.patient.body!, time: e.s.time };
    e.l.decide(guard);
    expect(guard.action?.social?.partner).toBe("healer");
    expect(() => validate(e.s)).not.toThrow();
    expect(
      e.s.defense.guards.filter((g) => g.id.startsWith("east") && g.offDuty),
    ).toHaveLength(1);
    e.s.life.alarm = 2;
    e.l.decide(guard);
    expect(guard.action).toBeNull();
    expect(e.s.defense.guards[1].mode).toBe("return");
  });
  it("子版本3迁移不加关系或资源，新账本和意图有严格白名单", () => {
    const e = setup(),
      old: any = structuredClone(e.s);
    old.life.version = 3;
    for (const n of old.life.people) delete n.social;
    const migrated = validate(old);
    expect(migrated.life.version).toBe(5);
    expect(migrated.life.stores).toEqual(e.s.life.stores);
    expect(migrated.life.people[0].relations).toEqual(e.visitor.relations);
    expect(migrated.life.people[0].social.occasionFloor).toBe(
      e.s.life.sequence,
    );
    (migrated.life.people[0].social as any).presentation = {
      sprite: "禁止存表现对象",
    };
    expect(
      (validate(migrated).life.people[0].social as any).presentation,
    ).toBeUndefined();
    const bad = structuredClone(migrated);
    bad.life.people[0].social.visited.healer = bad.life.sequence + 1;
    expect(() => validate(bad)).toThrow();
  });
});
