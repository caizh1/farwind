import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { encounterState, pharmacyEncounterState } from "./npc-combat-fixtures";
import { initialState, validate } from "../src/game/systems/state";
import { EastDefense } from "../src/game/systems/defense";
import { NpcLife } from "../src/game/systems/npcLife";
import { advanceTime } from "../src/game/systems/worldClock";
import {
  advanceEnemyAttack,
  createEnemyAttack,
} from "../src/game/systems/enemyAttack";
import { motionBlocked } from "../src/game/systems/obstacles";
import { props, type Prop } from "../src/data/world";

const setup = (hp = 100) => {
  const s = encounterState(hp),
    d = new EastDefense(s.defense, 0),
    l = new NpcLife(s, d);
  return { s, d, l };
};
function tick(e: ReturnType<typeof setup>, ms: number) {
  for (let t = 0; t < ms; t += 20) {
    const dt = Math.min(20, ms - t),
      budget = { queries: 2 };
    e.s.time = advanceTime(e.s.time, dt);
    e.d.update(e.d.now + dt, dt, e.s.player, budget);
    e.l.step(dt, budget);
    e.l.consumeDefense(e.d.drainNotices());
  }
}
function defeat(e: ReturnType<typeof setup>) {
  for (const enemy of e.d.enemies)
    e.d.damageEnemy(
      enemy,
      {
        sourceId: "player",
        targetId: enemy.id,
        attackId: "验收中的真实伤害结算",
        amount: 100,
        sourceType: "player-melee",
        eventId: enemy.eventId,
      },
      100,
    );
}
describe("平民真实攻击、知识与救护", () => {
  it("小满配药中听到真实警报，离屋后目击伤员、到场照护，不提交半成品", () => {
    const s = pharmacyEncounterState(),
      d = new EastDefense(s.defense, 0),
      l = new NpcLife(s, d),
      e = { s, d, l },
      n = s.life.people[1],
      herbs = s.life.stores.herbs;
    expect(n.action?.kind).toBe("work");
    expect(n.action?.phase).toBe("perform");
    tick(e, 1000);
    expect(n.action?.kind).not.toBe("work");
    expect(s.life.stores.herbs).toBe(herbs);
    expect(s.life.people[0].body!.health).toBe("down");
    expect(n.body!.space).toBe("healer-home");
    expect(n.memories.some((m) => m.kind === "down")).toBe(false);
    defeat(e);
    for (
      let t = 0;
      t < 80000 && !s.life.events.some((ev) => ev.kind === "care");
      t += 100
    )
      tick(e, 100);
    const care = s.life.events.find((ev) => ev.kind === "care")!;
    expect(care).toBeTruthy();
    expect(care.debug).toBe(false);
    expect(care.source).toBe("healer");
    expect(n.body!.space).toBe("village");
    expect(n.supplies.medicine).toBe(1);
    expect(s.life.people[0].body!.health).toBe("convalescent");
    expect(
      n.memories.some((m) => m.kind === "down" && m.source === "seen"),
    ).toBe(true);
    mkdirSync("docs/npc-life/evidence", { recursive: true });
    writeFileSync(
      "docs/npc-life/evidence/pharmacy-encounter-save.json",
      JSON.stringify(pharmacyEncounterState(), null, 2),
    );
    writeFileSync(
      "docs/npc-life/evidence/pharmacy-crisis-unit.json",
      JSON.stringify(
        {
          说明: "进行中的配药旧档遇实际突破警报。小满室内未全知伤情，离屋后目击并实际到场照护；没有提交被中断的配药。",
          状态: s,
        },
        null,
        2,
      ),
    );
  });
  it("加载后攻击编号复用仍识别新的守卫伤情，旧通知重放不重复记忆", () => {
    const s = initialState(),
      d = new EastDefense(s.defense, 0),
      l = new NpcLife(s, d),
      guard = s.defense.guards[0];
    const event = {
      sourceId: "same-hostile",
      targetId: guard.id,
      attackId: "same-hostile:1",
      amount: 10,
      sourceType: "enemy-melee" as const,
      eventId: null,
    };
    d.damageGuard(event, { id: event.sourceId, hp: 48 });
    const first = d.drainNotices();
    l.consumeDefense(first);
    l.consumeDefense(first);
    expect(s.life.events.filter((e) => e.kind === "injury")).toHaveLength(1);
    l.step(20, { queries: 2 });
    const saved = validate(s),
      next = new EastDefense(saved.defense, 0),
      life = new NpcLife(saved, next);
    next.damageGuard(event, { id: event.sourceId, hp: 48 });
    const second = next.drainNotices();
    life.consumeDefense(second);
    life.consumeDefense(second);
    expect(saved.life.events.filter((e) => e.kind === "injury")).toHaveLength(
      2,
    );
    expect(second[0].eventKey).not.toBe(first[0].eventKey);
  });
  it("实际移动中的平民受到攻击几何命中，伤情中断日程，近处知道而室内远方不知道", () => {
    const e = setup(),
      before = { ...e.s.life.people[0].body! };
    expect(motionBlocked(before.x, before.y)).toBe(false);
    tick(e, 1000);
    mkdirSync("docs/npc-life/evidence", { recursive: true });
    writeFileSync(
      "docs/npc-life/evidence/civilian-contact-unit.json",
      JSON.stringify(
        {
          说明: "固定突破样本，运行一秒的真实攻击与生活状态，用于核对目击视线。",
          状态: e.s,
          战斗: e.d.snapshot(),
        },
        null,
        2,
      ),
    );
    const n = e.s.life.people[0],
      events = e.s.life.events.filter(
        (x) => x.kind === "injury" && x.source.startsWith("raid-"),
      );
    expect(n.body!.hp).toBeLessThan(100);
    expect(n.body!.y).not.toBe(before.y);
    expect(events).toHaveLength(1);
    expect(events[0].debug).toBe(false);
    expect(n.body!.health).toBe("hurt");
    expect(n.body!.recoverAt).toBe(0);
    expect(n.action?.kind).not.toBe("work");
    expect(
      e.s.life.people[1].memories.some((m) => m.eventId === events[0].id),
    ).toBe(true);
    expect(
      e.s.life.people[2].memories.some((m) => m.eventId === events[0].id),
    ).toBe(false);
    expect(e.d.critical).toBe(true);
    validate(e.s);
  });
  it("实际失能后停止移动，不被补刀成死亡；击退、稳定确认、到场急救、读档与休养闭环", () => {
    const e = setup(8);
    writeFileSync(
      "docs/npc-life/evidence/civilian-encounter-save.json",
      JSON.stringify(e.s, null, 2),
    );
    tick(e, 1000);
    const patient = e.s.life.people[0];
    expect(patient.body!.health).toBe("down");
    const down = { ...patient.body! };
    tick(e, 2500);
    expect(patient.body).toEqual(down);
    expect(
      e.s.life.events.filter(
        (x) => x.kind === "down" && x.source === e.d.enemies[0].id,
      ),
    ).toHaveLength(1);
    expect(e.d.civilianTargets!().some((n) => n.id === "elder")).toBe(false);
    defeat(e);
    tick(e, 100000);
    const care = e.s.life.events.filter(
      (x) => x.kind === "care" && x.subjects.includes("elder"),
    );
    expect(care).toHaveLength(1);
    expect(care[0].debug).toBe(false);
    expect(patient.body!.hp).toBe(45);
    expect(patient.body!.health).toBe("convalescent");
    expect(e.s.life.people[1].supplies.medicine).toBe(1);
    expect(
      e.s.life.tasks.filter((t) => t.kind === "treat" && t.subject === "elder"),
    ).toHaveLength(0);
    const s = validate(JSON.parse(JSON.stringify(e.s))),
      d = new EastDefense(s.defense, 0),
      l = new NpcLife(s, d);
    expect(s.life.people[0].body).toEqual(patient.body);
    const restore = { s, d, l };
    tick(restore, 150000);
    expect(s.life.people[0].body!.health).toBe("healthy");
    expect(
      s.life.events.filter(
        (x) => x.kind === "care" && x.subjects.includes("elder"),
      ),
    ).toHaveLength(1);
    expect(
      s.defense.guards
        .filter((g) => g.id.startsWith("north-"))
        .every((g) => g.dead && g.hp === 0),
    ).toBe(true);
  });
  it("九十生命的真实轻伤仍可治疗，救治不降低生命且休养后恢复日程", () => {
    const e = setup();
    tick(e, 1000);
    expect(e.s.life.people[0].body!.hp).toBe(90);
    expect(e.l.needsTreatment("elder")).toBe(true);
    expect(
      e.s.life.tasks.some((t) => t.subject === "elder" && t.kind === "treat"),
    ).toBe(true);
    defeat(e);
    tick(e, 90000);
    expect(
      e.s.life.events.filter(
        (x) => x.kind === "care" && x.subjects.includes("elder"),
      ),
    ).toHaveLength(1);
    expect(e.s.life.people[0].body!.hp).toBe(90);
    expect(e.l.needsTreatment("elder")).toBe(false);
    tick(e, 150000);
    expect(e.s.life.people[0].body!.health).toBe("healthy");
    expect(e.s.life.people[0].action?.kind).not.toBe("rest");
  });
  it("同一接触重复派发只结算一次，友方与伪造、隔墙、跨空间接触均不扣生命", () => {
    const e = setup(),
      enemy = e.d.enemies[0],
      patient = e.s.life.people[0];
    enemy.targetId = "elder";
    enemy.attack = createEnemyAttack(
      enemy.id,
      1,
      enemy.type,
      0,
      enemy,
      patient.body!,
    );
    const contact = advanceEnemyAttack(
      enemy.attack,
      enemy,
      patient.body!,
      550,
    )!;
    expect(contact).not.toBeNull();
    expect(
      e.l.receiveHostileContact("elder", { ...enemy, id: "player" }, contact),
    ).toBe(false);
    expect(
      e.l.receiveHostileContact("elder", enemy, {
        ...contact,
        attack: { ...contact.attack },
      }),
    ).toBe(false);
    expect(e.l.receiveHostileContact("elder", enemy, contact)).toBe(true);
    const hp = patient.body!.hp,
      count = e.s.life.events.length;
    expect(e.l.receiveHostileContact("elder", enemy, contact)).toBe(false);
    expect(patient.body!.hp).toBe(hp);
    expect(e.s.life.events).toHaveLength(count);
    patient.body!.space = "elder-home";
    contact.attack.resolved = false;
    expect(e.l.receiveHostileContact("elder", enemy, contact)).toBe(false);
    patient.body!.space = "village";
    const wall: Prop = {
      id: "npc-contact-wall",
      art: "house",
      x: 850,
      y: 503,
      w: 4,
      h: 4,
      solid: [4, 4],
      cover: "high",
    };
    props.push(wall);
    try {
      expect(e.l.receiveHostileContact("elder", enemy, contact)).toBe(false);
    } finally {
      props.splice(props.indexOf(wall), 1);
    }
    expect(patient.body!.hp).toBe(hp);
  });
  it("室内与失能平民不作为目标，目标出空间后未释放攻击取消且不转嫁", () => {
    const e = setup(),
      enemy = e.d.enemies[0];
    tick(e, 20);
    expect(enemy.targetId).toBe("elder");
    expect(enemy.attack).not.toBeNull();
    Object.assign(e.s.life.people[0].body!, {
      space: "elder-home",
      x: 570,
      y: 800,
    });
    tick(e, 700);
    expect(enemy.attack).toBeNull();
    expect(e.s.life.people[0].body!.hp).toBe(100);
    expect(e.d.civilianTargets!().some((n) => n.id === "carpenter")).toBe(
      false,
    );
  });
  it("真实伤害对原休养期限作废，暂停不增加伤害、进度或需求", () => {
    const e = setup();
    Object.assign(e.s.life.people[0].body!, {
      hp: 60,
      health: "convalescent",
      recoverAt: e.s.time + 0.01,
    });
    // 独立推进攻击先命中，不能由过期休养把新伤补满。
    for (let t = 20; t <= 600; t += 20)
      e.d.update(t, 20, e.s.player, { queries: 2 });
    expect(e.s.life.people[0].body!.health).toBe("hurt");
    expect(e.s.life.people[0].body!.recoverAt).toBe(0);
    const before = structuredClone(e.s);
    e.l.step(5000, { queries: 2 }, true);
    expect(e.s).toEqual(before);
    e.s.time += 5;
    e.l.step(20, { queries: 2 });
    expect(e.s.life.people[0].body!.hp).toBe(50);
  });
  it("中途攻击读档不补发旧命中；平民目标白名单兼容且未出生的新来袭仍被缺员规则拒绝", () => {
    const e = setup();
    tick(e, 200);
    expect(e.s.defense.raid!.members[0].targetId).toBe("elder");
    const saved = validate(JSON.parse(JSON.stringify(e.s)));
    const restored = new EastDefense(saved.defense, 0);
    new NpcLife(saved, restored);
    expect(restored.enemies[0].attack).toBeUndefined();
    restored.update(20, 20, saved.player, { queries: 2 });
    expect(saved.life.people[0].body!.hp).toBe(100);
    expect(
      restored.canScheduleAtGate(
        "north-gate",
        saved.player,
        saved.defense.raid!.spawns,
      ),
    ).toBe(false);
    saved.defense.raid!.members[0].targetId = "unknown-resident";
    expect(() => validate(saved)).toThrow();
  });
  it("没有见过伤员不能读全局任务坐标，目击后取得有限位置且目标不再暗中追踪", () => {
    const e = setup();
    Object.assign(e.s.life.people[0].body!, {
      space: "elder-home",
      x: 570,
      y: 800,
      hp: 40,
      health: "hurt",
    });
    e.l.ensureTask("treat", "elder", e.s.life.people[0].body!);
    const medic = e.s.life.people[1],
      task = e.s.life.tasks.find((t) => t.subject === "elder")!;
    expect(e.l.treatmentPlace(medic, task)).toBeNull();
    Object.assign(medic.body!, { space: "elder-home", x: 600, y: 800 });
    e.l.step(20, { queries: 2 });
    expect(e.l.treatmentPlace(medic, task)).toMatchObject({
      space: "elder-home",
      x: e.s.life.people[0].body!.x,
      y: e.s.life.people[0].body!.y,
    });
    Object.assign(e.s.life.people[0].body!, {
      space: "village",
      x: 650,
      y: 710,
    });
    expect(e.l.treatmentPlace(medic, task)?.space).toBe("elder-home");
    e.s.time += 121;
    expect(e.l.treatmentPlace(medic, task)).toBeNull();
  });
});
