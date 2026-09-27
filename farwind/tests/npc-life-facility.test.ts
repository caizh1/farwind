import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { facilityEncounterState } from "./npc-combat-fixtures";
import { validate } from "../src/game/systems/state";
import { EastDefense } from "../src/game/systems/defense";
import { NpcLife } from "../src/game/systems/npcLife";
import { advanceTime } from "../src/game/systems/worldClock";
import {
  createEnemyAttack,
  advanceEnemyAttack,
} from "../src/game/systems/enemyAttack";
import { MAINTENANCE, LIFE } from "../src/data/npcLife";
import { props, type Prop } from "../src/data/world";
import { motionBlocked } from "../src/game/systems/obstacles";
const setup = () => {
  const s = facilityEncounterState(),
    d = new EastDefense(s.defense, 0),
    l = new NpcLife(s, d);
  return { s, d, l };
};
function tick(e: ReturnType<typeof setup>, ms: number) {
  for (let t = 0; t < ms; t += 20) {
    const dt = Math.min(20, ms - t),
      b = { queries: 2 };
    e.s.time = advanceTime(e.s.time, dt);
    e.d.update(e.d.now + dt, dt, e.s.player, b);
    e.l.step(dt, b);
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
        attackId: `test-defeat:${enemy.id}`,
        amount: 100,
        sourceType: "player-melee",
        eventId: enemy.eventId,
      },
      100,
    );
}
describe("维护点真实攻击与恢复", () => {
  it("导入或过期行动的目标坐标不能代替真实设施位置远程提交", () => {
    const e = setup();
    tick(e, 700);
    defeat(e);
    const n = e.s.life.people[2],
      t = e.s.life.tasks.find((t) => t.kind === "repair")!;
    n.gear = "carried";
    n.supplies.wood = 2;
    e.s.life.stores.wood -= 2;
    e.l.begin(n, {
      kind: "repair",
      target: { ...n.body! },
      facility: null,
      task: t.id,
      score: 150,
      label: "无效的远处维修目标",
    });
    const a = n.action!;
    a.phase = "perform";
    a.progress = a.duration;
    const wood = e.s.life.stores.wood + n.supplies.wood;
    e.l.complete(n, a);
    expect(e.s.life.facilities["wind-bell"]).toBe(90);
    expect(e.s.life.stores.wood + n.supplies.wood).toBe(wood);
    expect(e.s.life.events.some((e) => e.kind === "repair")).toBe(false);
    expect(n.action).toBeNull();
    expect(e.s.life.tasks[0].owner).toBeNull();
  });
  it("正式命中产生损坏，室内木匠不全知，巡视后实际取料到场维修", () => {
    const e = setup(),
      carpenter = e.s.life.people[2],
      bag = structuredClone(e.s.bag),
      wood = e.s.life.stores.wood;
    expect(motionBlocked(720, 620)).toBe(false);
    tick(e, 700);
    const damage = e.s.life.events.filter((x) => x.kind === "damage");
    expect(damage).toHaveLength(1);
    expect(damage[0].source).toBe(e.d.enemies[0].id);
    expect(damage[0].debug).toBe(false);
    expect(e.s.life.facilities["wind-bell"]).toBe(90);
    expect(carpenter.memories.some((m) => m.kind === "damage")).toBe(false);
    expect(e.l.candidates(carpenter).some((c) => c.kind === "repair")).toBe(
      false,
    );
    expect(
      e.s.life.tasks.filter((t) => t.subject === "wind-bell"),
    ).toHaveLength(1);
    defeat(e);
    const phases = new Set<string>();
    for (
      let t = 0;
      t < 80000 && e.s.life.facilities["wind-bell"] < 100;
      t += 100
    ) {
      tick(e, 100);
      if (carpenter.action?.kind === "repair")
        phases.add(carpenter.action.phase);
    }
    if (!phases.has("travel")) {
      mkdirSync("docs/npc-life/evidence", { recursive: true });
      writeFileSync(
        "docs/npc-life/evidence/facility-first-failure.json",
        JSON.stringify(
          {
            说明: "首轮真实巡视后取料未完成的原始状态，保留失败原因；未降低维修到场断言。",
            阶段: [...phases],
            状态: e.l.snapshot(),
          },
          null,
          2,
        ),
      );
    }
    expect(phases.has("stock")).toBe(true);
    expect(phases.has("travel")).toBe(true);
    expect(phases.has("perform")).toBe(true);
    expect(e.s.life.facilities["wind-bell"]).toBe(100);
    expect(e.s.life.events.filter((x) => x.kind === "repair")).toHaveLength(1);
    expect(e.s.life.stores.wood + carpenter.supplies.wood).toBe(wood - 2);
    expect(e.s.bag).toEqual(bag);
    expect(
      e.s.defense.guards
        .filter((g) => g.id.startsWith("north-"))
        .every((g) => g.dead && g.hp === 0),
    ).toBe(true);
    expect(e.l.dialogue("carpenter")).toContain("恢复至100%");
    expect(validate(e.s).life.facilities["wind-bell"]).toBe(100);
    mkdirSync("docs/npc-life/evidence", { recursive: true });
    writeFileSync(
      "docs/npc-life/evidence/facility-encounter-save.json",
      JSON.stringify(facilityEncounterState(), null, 2),
    );
    writeFileSync(
      "docs/npc-life/evidence/facility-combat-unit.json",
      JSON.stringify(
        {
          说明: "固定北门突破与旧伤亡，真实攻击使挂架90%，阿禾在安全后按日程巡视、取公共木料、实际到场修复；未注入损坏或报告。",
          行动阶段: [...phases],
          恢复: e.l.snapshot(),
        },
        null,
        2,
      ),
    );
  });
  it("人物目标优先，未进入居民区及原纵深之外的设施不会被追击", () => {
    const e = setup(),
      enemy = e.d.enemies[0];
    expect(e.d.target(enemy, { x: 730, y: 650, hp: 100 })?.id).toBe("player");
    Object.assign(enemy, { x: 820, y: 180 });
    expect(e.d.target(enemy, { x: 830, y: 1050, hp: 100 })).toBeUndefined();
    Object.assign(enemy, { x: 720, y: 620 });
    expect(e.d.target(enemy, e.s.player)?.id).toBe("wind-bell");
    expect(e.d.target(enemy, e.s.player)?.id).not.toBe("workbench");
  });
  it("同一攻击只损坏一次，伪造接触、隔墙命中和失效目标被拒绝", () => {
    const e = setup(),
      enemy = e.d.enemies[0],
      f = MAINTENANCE[0];
    enemy.targetId = f.id;
    enemy.attack = createEnemyAttack(
      enemy.id,
      1,
      enemy.type,
      0,
      enemy,
      f.place,
    );
    const contact = advanceEnemyAttack(enemy.attack, enemy, f.place, 500)!;
    expect(contact).toBeTruthy();
    expect(e.l.receiveHostileContact(f.id, { ...enemy }, contact)).toBe(false);
    expect(
      e.l.receiveHostileContact(f.id, enemy, {
        ...contact,
        attack: { ...contact.attack },
      }),
    ).toBe(false);
    const wall: Prop = {
      id: "test-facility-wall",
      art: "tree",
      x: 720,
      y: 643,
      w: 40,
      h: 10,
      solid: [40, 4],
    };
    props.push(wall);
    try {
      expect(e.l.receiveHostileContact(f.id, enemy, contact)).toBe(false);
    } finally {
      props.splice(props.indexOf(wall), 1);
    }
    expect(e.l.receiveHostileContact(f.id, enemy, contact)).toBe(true);
    expect(e.l.receiveHostileContact(f.id, enemy, contact)).toBe(false);
    expect(e.s.life.facilities[f.id]).toBe(90);
    expect(e.s.life.events.filter((x) => x.kind === "damage")).toHaveLength(1);
    e.s.life.facilities[f.id] = 0;
    expect(e.d.victim(f.id)).toBeUndefined();
    expect(e.l.damageFacility(f.id, 10, true)).toBe(false);
    expect(e.s.life.events.filter((x) => x.kind === "damage")).toHaveLength(1);
  });
  it("维修中暂停、取消和读档保留木料，完成提交与加载不重复消耗", () => {
    let e = setup();
    tick(e, 700);
    defeat(e);
    for (
      let t = 0;
      t < 80000 &&
      !(
        e.s.life.people[2].action?.kind === "repair" &&
        e.s.life.people[2].action?.phase === "perform" &&
        e.s.life.people[2].action!.progress > 1000
      );
      t += 100
    )
      tick(e, 100);
    const n = e.s.life.people[2],
      a = n.action!,
      stock = e.s.life.stores.wood + n.supplies.wood;
    expect(a.kind).toBe("repair");
    expect(a.progress).toBeGreaterThan(1000);
    const frozen = structuredClone(e.s);
    e.l.step(5000, { queries: 2 }, true);
    expect(e.s).toEqual(frozen);
    e.l.cancel(n, "单元中断检查");
    expect(e.s.life.facilities["wind-bell"]).toBe(90);
    expect(e.s.life.stores.wood + n.supplies.wood).toBe(stock);
    expect(e.s.life.tasks[0].owner).toBeNull();
    const saved = validate(frozen),
      d = new EastDefense(saved.defense, saved.life.elapsed);
    e = { s: saved, d, l: new NpcLife(saved, d) };
    expect(e.s.life.people[2].action!.progress).toBe(a.progress);
    tick(e, LIFE.repairMs + 500);
    expect(e.s.life.facilities["wind-bell"]).toBe(100);
    const restored = validate(e.s),
      owner = e.s.life.people[2];
    e.l.complete(owner, a);
    expect(validate(restored)).toEqual(restored);
    expect(e.s.life.stores.wood + owner.supplies.wood).toBe(stock - 2);
    expect(e.s.life.events.filter((x) => x.kind === "repair")).toHaveLength(1);
  });
  it("合法设施目标旧格式读档保留损坏，未提交的攻击不被重放", () => {
    const e = setup();
    tick(e, 300);
    e.d.sync();
    expect(e.s.defense.raid!.members[0].targetId).toBe("wind-bell");
    const saved = validate(e.s),
      d = new EastDefense(saved.defense, saved.life.elapsed),
      l = new NpcLife(saved, d);
    expect(d.enemies[0].attack).toBeUndefined();
    expect(saved.life.facilities["wind-bell"]).toBe(100);
    d.update(d.now + 100, 100, saved.player, { queries: 2 });
    l.step(100, { queries: 2 });
    expect(saved.life.facilities["wind-bell"]).toBe(100);
    saved.defense.raid!.members[0].targetId = "invalid-building";
    expect(() => validate(saved)).toThrow();
  });
});
