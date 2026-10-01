import { StateCommit } from "../src/game/systems/stateCommit";
import { Input } from "../src/game/systems/input";
import { writeFileSync, mkdirSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { initialState, validate, parseSave } from "../src/game/systems/state";
import { EastDefense, prepareRaid } from "../src/game/systems/defense";
import { NpcLife } from "../src/game/systems/npcLife";
import {
  PEOPLE,
  FACILITIES,
  LIFE,
  PRIVATE_STORAGE,
  HOMES,
  GUARD_LANDINGS,
} from "../src/data/npcLife";
import { advanceTime } from "../src/game/systems/worldClock";
import { motionBlocked } from "../src/game/systems/obstacles";
import { spaceBlocked, spaceClear } from "../src/game/systems/npcNavigation";
import { createEnemyAttack } from "../src/game/systems/enemyAttack";
import { serviceEntrances } from "../src/data/village-economy";
const setup = () => {
  const s = initialState(),
    d = new EastDefense(s.defense, 0),
    l = new NpcLife(s, d);
  return { s, d, l };
};
const tick = (e: ReturnType<typeof setup>, ms: number) => {
  for (let t = 0; t < ms; t += 100) {
    const step = Math.min(100, ms - t);
    e.s.time = advanceTime(e.s.time, step);
    const b = { queries: 2 };
    e.l.step(step, b);
    e.d.update(e.l.data.elapsed, step, { x: 670, y: 720, hp: 100 }, b);
    e.l.consumeDefense(e.d.drainNotices());
  }
};
describe("居民生活 M1 基础与事务", () => {
  it("十五个稳定身份、独立床位和卫兵唯一权威状态", () => {
    const { s, l } = setup();
    expect(PEOPLE).toHaveLength(15);
    expect(new Set(PRIVATE_STORAGE.map((s) => s.owner)).size).toBe(15);
    expect(
      new Set(
        FACILITIES.filter((f) => f.kind === "bed" && f.owner).map(
          (f) => f.owner,
        ),
      ).size,
    ).toBe(15);
    expect(s.life.people.slice(3).every((n) => n.body === null)).toBe(true);
    s.defense.guards[0].x += 5;
    expect(l.body("east-watch")!.x).toBe(s.defense.guards[0].x);
  });
  it("版本5迁移不改变伤亡、背包、任务与库存；重复迁移稳定", () => {
    const { s } = setup();
    const old: any = structuredClone(s);
    old.schema_version = 5;old.skills={swordWind:false};
    delete old.life;
    Object.assign(old.defense.guards[0], { hp: 0, dead: true, mode: "dead" });
    old.defense.guards[1].hp = 73;
    old.coins = 17;
    old.bag[0] = { id: "wood", count: 4 };
    const next = validate(old);
    expect(next.schema_version).toBe(15);
    expect(next.defense.guards[0].dead).toBe(true);
    expect(next.defense.guards[1].hp).toBe(73);
    expect(next.coins).toBe(17);
    expect(next.bag).toEqual(old.bag);
    expect(validate(next)).toEqual(next);
  });
  it("单人床预约互斥，取消释放，读档丢弃过期租约", () => {
    const { s, l } = setup();
    const a = s.life.people[0],
      b = s.life.people[1];
    expect(l.reserve(a, "plaza-seat")).toBe(true);
    expect(l.reserve(b, "plaza-seat")).toBe(false);
    l.cancel(a, "测试取消");
    expect(l.reserve(b, "plaza-seat")).toBe(true);
    s.life.elapsed = 13000;
    expect(validate(s).life.reservations).toEqual([]);
    expect(l.reserve(b, "bed:elder")).toBe(false);
  });
  it("配药完成一次扣料产出，中途取消无消耗，重复提交无效果", () => {
    const { s, l } = setup(),
      n = s.life.people[1];
    Object.assign(n.body!, FACILITIES.find((f) => f.id === "pharmacy")!.place);
    l.begin(n, {
      kind: "work",
      target: n.body!,
      score: 80,
      label: "配药",
      facility: "pharmacy",
      task: null,
    });
    const a = n.action!;
    a.progress = 3000;
    const mid = validate(s);
    expect(mid.life.people[1].action!.progress).toBe(3000);
    const stock = { ...s.life.stores };
    l.cancel(n, "警报");
    expect(s.life.stores).toEqual(stock);
    l.begin(n, {
      kind: "work",
      target: n.body!,
      score: 80,
      label: "配药",
      facility: "pharmacy",
      task: null,
    });
    const complete = n.action!;
    n.gear = "carried"; // 单元提交前置：人物已实际取出自己唯一的药箱。
    complete.phase = "perform";
    complete.progress = complete.duration;
    l.complete(n, complete);
    expect(s.life.stores.herbs).toBe(stock.herbs - 2);
    expect(s.life.stores.medicine).toBe(stock.medicine + 1);
    l.complete(n, complete);
    expect(s.life.stores.medicine).toBe(stock.medicine + 1);
    expect(parseSave(JSON.stringify(s)).life.stores).toEqual(s.life.stores);
  });
  it("暂停不推进时间、需要、工作与资源", () => {
    const e = setup(),
      before = structuredClone(e.s);
    e.l.step(10000, { queries: 2 }, true);
    expect(e.s).toEqual(before);
  });
  it("动态实体随真实位置和空间变化，旧位置不保留交互实体", () => {
    const { s, l } = setup();
    s.life.people[1].body!.x = 900;
    expect(l.entities().find((p) => p.id === "healer")!.x).toBe(900);
    s.life.people[1].body!.space = "healer-home";
    expect(l.entities().some((p) => p.id === "healer")).toBe(false);
    expect(l.entities("healer-home").find((p) => p.id === "healer")!.x).toBe(
      900,
    );
  });
  it("非法字段、空间、越界记忆和重复床占用被拒绝", () => {
    for (const mutate of [
      (s: any) => (s.life.people[0].body.space = "fake"),
      (s: any) => (s.life.people[1].needs.hunger = NaN),
      (s: any) => (s.life.events = Array(81).fill({})),
      (s: any) =>
        (s.life.people[4].body = { x: 500, y: 500, space: "village" }),
    ]) {
      const { s } = setup();
      mutate(s);
      expect(() => validate(s)).toThrow();
    }
  });
  it("性格影响合法决策，药师救护而长者清点、木匠避难", () => {
    const { s, l } = setup();
    s.life.alarm = 2;
    s.life.people.forEach((n) => (n.alarm = 2));
    l.debugInjury("carpenter");
    expect(
      l.candidates(s.life.people[1]).sort((a, b) => b.score - a.score)[0].kind,
    ).toBe("treat");
    expect(
      l.candidates(s.life.people[0]).sort((a, b) => b.score - a.score)[0].kind,
    ).toBe("count");
  });
  it("村门小袭扰不全村停工，突破居民警戒线升级", () => {
    const e = setup();
    e.s.defense = prepareRaid(e.s.defense, e.s.player, "east-gate");
    e.d = new EastDefense(e.s.defense, 0);
    e.l.rebind(e.s, e.d);
    e.l.restore();
    e.l.step(100, { queries: 2 });
    expect(e.s.life.alarm).toBe(1);
    expect(
      e.l.candidates(e.s.life.people[1]).some((c) => c.kind === "work"),
    ).toBe(true);
    Object.assign(e.d.enemies[0], { x: 1840, y: 1080 });
    e.l.step(100, { queries: 2 });
    expect(e.s.life.alarm).toBe(2);
    expect(e.s.life.people[1].action?.phase).toBe("collect");
    expect(e.s.life.people[1].gear).toBe("locker");
    let carried = false;
    for (let t = 0; t < 30000; t += 100) {
      tick(e, 100);
      carried ||= e.s.life.people[1].gear === "carried";
    }
    expect(carried).toBe(true);
  });
  it("远处敌人不鸣村铃，附近未被驻防接管的敌人仍参与生活安全", () => {
    const e = setup();
    e.s.time = 1140;
    e.d.external = [
      {
        id: "远方样本",
        x: 3000,
        y: 1500,
        homeX: 3000,
        homeY: 1500,
        hp: 48,
      } as any,
    ];
    tick(e, 3000);
    expect(e.s.life.alarm).toBe(0);
    expect(e.s.defense.guards.filter((g) => g.offDuty)).toHaveLength(4);
    e.d.external = [
      { id: "近处样本", x: 760, y: 740, homeX: 760, homeY: 740, hp: 48 } as any,
    ];
    expect(e.d.hostiles()).toHaveLength(0);
    expect(e.l.safe({ space: "village", x: 760, y: 750 })).toBe(false);
    e.l.step(100, { queries: 2 });
    expect(e.s.life.alarm).toBe(2);
  });
  it("东门普通来袭只召回东门，北南门仍按守备额度轮休", () => {
    const e = setup();
    e.s.time = 1140;
    e.s.defense = prepareRaid(e.s.defense, e.s.player, "east-gate");
    e.d = new EastDefense(e.s.defense, 0);
    e.l.rebind(e.s, e.d);
    e.l.restore();
    tick(e, 3000);
    expect(e.s.life.alarm).toBe(1);
    expect(
      e.s.defense.guards.filter((g) => g.id.startsWith("east") && g.offDuty),
    ).toHaveLength(0);
    for (const prefix of ["north", "south"]) {
      const guard = e.s.defense.guards.find(
        (g) => g.id === `${prefix}-archer`,
      )!;
      expect(guard.offDuty).toBe(true);
      expect(e.d.peaceOrders.has(guard.id)).toBe(true);
    }
    const memory = e.l.emit(
      "alarm",
      { space: "village", x: 720, y: 650 },
      "bell",
      [],
      "村门袭扰，保持局部警戒",
    );
    const isolated = setup();
    isolated.l.remember(isolated.s.life.people[1], memory, "alarm");
    e.s.time = 900;
    expect(
      isolated.l
        .candidates(isolated.s.life.people[1])
        .some((c) => c.label.includes("近日遇险")),
    ).toBe(false);
  });
  it("到场治疗和维修消耗公共资源，玩家背包保持不变", () => {
    const e = setup();
    e.l.debugInjury("elder", 70);
    const n = e.s.life.people[1],
      task = e.s.life.tasks[0];
    Object.assign(n.body!, task.place);
    e.l.begin(n, {
      kind: "treat",
      target: task.place,
      score: 150,
      label: "救护",
      facility: null,
      task: task.id,
    });
    const before = e.s.life.stores.medicine;
    n.action!.phase = "perform";
    n.gear = "carried";
    // 本例检验到场提交；实际补给移动、取消与读档由子版本3专项覆盖。
    n.supplies.medicine = 1;
    e.s.life.stores.medicine--;
    n.action!.progress = n.action!.duration;
    e.l.complete(n, n.action!);
    expect(e.s.life.people[0].body!.hp).toBe(75);
    expect(e.s.life.stores.medicine).toBe(before - 1);
    expect(e.s.bag.every((x) => x === null)).toBe(true);
    e.l.damageFacility("workbench", 50, true);
    const carpenter = e.s.life.people[2],
      repair = e.s.life.tasks.find((t) => t.kind === "repair")!;
    Object.assign(carpenter.body!, repair.place);
    e.l.begin(carpenter, {
      kind: "repair",
      target: repair.place,
      score: 150,
      label: "维修",
      facility: null,
      task: repair.id,
    });
    const wood = e.s.life.stores.wood;
    carpenter.action!.phase = "perform";
    carpenter.gear = "carried";
    carpenter.supplies.wood = 2;
    e.s.life.stores.wood -= 2;
    carpenter.action!.progress = carpenter.action!.duration;
    e.l.complete(carpenter, carpenter.action!);
    expect(e.s.life.facilities.workbench).toBe(100);
    expect(e.s.life.stores.wood).toBe(wood - 2);
  });
  it("死亡守卫绝不接受治疗或轮休恢复", () => {
    const { s, l, d } = setup(),
      g = s.defense.guards[0];
    Object.assign(g, { hp: 0, dead: true, mode: "dead" });
    d.healGuard(g.id, 30);
    d.leaveGuard(g.id);
    expect(g.hp).toBe(0);
    expect(g.dead).toBe(true);
    expect(l.helpPlayer(g.id)).toBe(false);
    expect(validate(s).defense.guards[0].dead).toBe(true);
  });
  it("未知事件不生成对白，同一记忆和转述不刷关系", () => {
    const { s, l } = setup();
    Object.assign(s.life.people[2].body!, { x: 1800, y: 1500 });
    const e = l.emit(
      "help",
      l.body("healer")!,
      "player",
      ["healer"],
      "玩家照护",
    );
    expect(l.dialogue("carpenter")).not.toContain("谢谢");
    const n = s.life.people[1],
      trust = n.relations.player.trust;
    l.remember(n, e, "report");
    expect(n.relations.player.trust).toBe(trust);
    Object.assign(s.life.people[2].body!, l.body("healer"));
    expect(l.report("healer", "carpenter", e.id)).toBe(true);
    expect(l.dialogue("carpenter")).toContain("听小满说");
    expect(l.report("healer", "carpenter", e.id)).toBe(true);
    expect(
      s.life.people[2].memories.filter((m) => m.eventId === e.id),
    ).toHaveLength(1);
  });
  it("模拟一小时无穿墙与永久预约泄漏", () => {
    const e = setup();
    tick(e, 40000);
    mkdirSync(".parry-local", { recursive: true });
    writeFileSync(
      ".parry-local/npc-diagnostic.json",
      JSON.stringify({
        指标: e.l.metrics,
        人物: e.l.snapshot().people.map((n) => ({
          身份: n.id,
          位置: n.body,
          行动: n.action?.label,
          原因: n.reason,
          路径: n.path,
        })),
      }),
    );
    expect(e.s.life.people.some((n) => n.action)).toBe(true);
    expect(e.s.life.reservations.length).toBeLessThanOrEqual(12);
    expect(() => validate(e.s)).not.toThrow();
  }, 30000);
});
describe("居民生活 M2/M3 连续模拟与恢复", () => {
  it("三居民一日实际经过工作、吃饭、回家睡觉；项目推进", () => {
    const e = setup(),
      seen = new Map<string, Set<string>>(
        PEOPLE.slice(0, 3).map((p) => [p.id, new Set()]),
      );
    let recorded = false;
    for (let t = 0; t < 960000; t += 100) {
      tick(e, 100);
      if (!recorded && e.s.time >= 1380) {
        recorded = true;
        writeFileSync(
          ".parry-local/npc-late-night.json",
          JSON.stringify(e.l.snapshot()),
        );
      }
      for (const n of e.s.life.people.slice(0, 3))
        if (n.action?.phase === "perform")
          seen.get(n.id)!.add(`${n.action.kind}:${n.body!.space}`);
    }
    mkdirSync(".parry-local", { recursive: true });
    writeFileSync(
      ".parry-local/npc-day.json",
      JSON.stringify({
        作息: Object.fromEntries([...seen].map(([k, v]) => [k, [...v]])),
        状态: e.l.snapshot(),
      }),
    );
    for (const p of PEOPLE.slice(0, 3)) {
      expect(
        [...seen.get(p.id)!].some((k) => k.startsWith("work:")),
        p.id,
      ).toBe(true);
      expect(seen.get(p.id)!.has(`eat:${p.home}`), p.id).toBe(true);
      expect(seen.get(p.id)!.has(`sleep:${p.home}`), p.id).toBe(true);
    }
    expect(e.s.life.people[1].project).toBeGreaterThan(0);
    expect(e.s.life.people[2].project).toBeGreaterThan(0);
    expect(() => validate(e.s)).not.toThrow();
  }, 30000);
  it("五日库存、事件、记忆与设施占用有界，存档不超过200KB", () => {
    const e = setup(),
      totals = { steps: 0, decisions: 0, queries: 0, ms: 0, maxMs: 0 };
    for (let day = 0; day < 5; day++) {
      tick(e, 960000);
      for (const key of ["steps", "decisions", "queries", "ms"] as const)
        totals[key] += e.l.metrics[key];
      totals.maxMs = Math.max(totals.maxMs, e.l.metrics.maxMs);
      e.s = validate(e.s);
      e.d = new EastDefense(e.s.defense, e.l.data.elapsed);
      e.l = new NpcLife(e.s, e.d);
    }
    expect(e.s.life.events.length).toBeLessThanOrEqual(LIFE.eventLimit);
    expect(
      e.s.life.people.every((n) => n.memories.length <= LIFE.memoryLimit),
    ).toBe(true);
    expect(e.s.life.reservations.length).toBeLessThanOrEqual(12);
    expect(e.s.life.stores.medicine).toBeLessThanOrEqual(LIFE.maxMedicine);
    expect(e.s.life.stores.food).toBeLessThanOrEqual(LIFE.maxFood);
    expect(JSON.stringify(e.s).length).toBeLessThan(200000);
    mkdirSync(".parry-local", { recursive: true });
    writeFileSync(
      ".parry-local/npc-soak.json",
      JSON.stringify({
        模拟天数: 5,
        存档字符数: JSON.stringify(e.s).length,
        公共库存: e.s.life.stores,
        预约数量: e.s.life.reservations.length,
        路径失败: e.s.life.people.map((n) => ({
          人物: n.id,
          失败: n.pathFailures,
        })),
        指标: totals,
      }),
    );
  }, 60000);
  it("真实驻防伤情经统一事件形成医疗需求，安全解除后到场治疗", () => {
    const e = setup();
    e.s.defense = prepareRaid(e.s.defense, e.s.player, "east-gate");
    e.s.defense.guards[0].hp = 180;
    // 同伴保留正常健康，避免把两人旧伤样本误当成标准防线。
    e.s.defense.guards[1].hp = 75;
    /* 固定起始样本保留旧伤，新伤必须来自实际敌人命中。 */ e.d =
      new EastDefense(e.s.defense, 0);
    e.l = new NpcLife(e.s, e.d);
    for (let t = 0; t < 90000 && e.s.defense.raid; t += 100) tick(e, 100);
    const injuries = e.s.life.events.filter(
      (x) => x.kind === "injury" && !x.debug,
    );
    expect(injuries.length).toBeGreaterThan(0);
    tick(e, 100000);
    writeFileSync(
      ".parry-local/npc-natural-care.json",
      JSON.stringify(e.l.snapshot()),
    );
    expect(e.s.life.events.some((x) => x.kind === "care" && !x.debug)).toBe(
      true,
    );
    expect(e.s.defense.guards.every((g) => !g.dead)).toBe(true);
    expect(e.s.life.alarm).toBe(0);
  }, 30000);
  it("两名重伤守卫的失败防线不让药师闯敌或治疗已阵亡者", () => {
    const e = setup();
    e.s.time = 600;
    e.s.defense = prepareRaid(e.s.defense, e.s.player, "east-gate");
    e.s.defense.guards[0].hp = 75;
    e.s.defense.guards[1].hp = 75;
    e.d = new EastDefense(e.s.defense, 0);
    e.l = new NpcLife(e.s, e.d);
    let guarded = false;
    for (let frame = 0; frame < 120000; frame += 50) {
      const budget = { queries: 2 };
      for (let step = 0; step < 50; step += 5) {
        e.s.time = advanceTime(e.s.time, 5);
        e.d.update(frame + step + 5, 5, e.s.player, budget);
        e.l.step(5, budget);
        e.l.consumeDefense(e.d.drainNotices());
        const n = e.s.life.people[1];
        if (n.action?.kind === "treat" && n.action.phase === "perform")
          expect(e.l.safe(n.body!)).toBe(true);
        if (e.s.life.alarm === 2 && !e.l.safe(e.l.body("east-watch")!)) {
          guarded = true;
          expect(n.action?.kind).not.toBe("treat");
        }
      }
    }
    expect(guarded).toBe(true);
    const casualties = e.s.defense.guards.filter((g) => g.dead);
    expect(casualties.length).toBeGreaterThan(0);
    const restored = validate(e.s),
      d = new EastDefense(restored.defense, 120000),
      life = new NpcLife(restored, d);
    for (const g of casualties) {
      d.healGuard(g.id, 30);
      expect(life.state.defense.guards.find((n) => n.id === g.id)!.hp).toBe(0);
      expect(life.helpPlayer(g.id)).toBe(false);
    }
  }, 30000);
  it("治疗、撤离、睡觉与移动中读档保留必要进度，无重复药品提交", () => {
    for (const kind of ["treat", "shelter", "sleep", "work"] as const) {
      const e = setup(),
        n = e.s.life.people[1];
      e.l.debugInjury("elder", 70);
      const task = e.s.life.tasks[0],
        target =
          kind === "treat"
            ? task.place
            : kind === "sleep"
              ? FACILITIES.find((f) => f.id === "bed:healer")!.place
              : FACILITIES.find((f) => f.id === "pharmacy")!.place;
      e.l.begin(n, {
        kind,
        target,
        score: 150,
        label: "中途恢复",
        facility: kind === "sleep" ? "bed:healer" : null,
        task: kind === "treat" ? task.id : null,
      });
      n.action!.progress = 1000;
      const clean = validate(e.s),
        loaded = new NpcLife(clean, new EastDefense(clean.defense, 0));
      expect(clean.life.people[1].action!.progress).toBe(1000);
      expect(clean.life.people[1].body).toEqual(n.body);
      const medicine = clean.life.stores.medicine;
      loaded.cancel(clean.life.people[1], "取消恢复行动");
      expect(clean.life.stores.medicine).toBe(medicine);
      expect(clean.life.tasks.every((t) => t.owner === null)).toBe(true);
    }
  });
  it("每门最多一人离岗，召回不瞬移，离塔不能发箭", () => {
    const e = setup();
    e.s.time = 1140;
    tick(e, 10000);
    for (const prefix of ["east", "north", "south"])
      expect(
        e.s.defense.guards.filter((g) => g.id.startsWith(prefix) && g.offDuty)
          .length,
      ).toBeLessThanOrEqual(1);
    const archer = e.s.defense.guards[2];
    expect(archer.offDuty).toBe(true);
    const position = { x: archer.x, y: archer.y };
    e.d.recallGuard(archer.id);
    expect({ x: archer.x, y: archer.y }).toEqual(position);
    const hostile: any = { id: "probe", x: 2250, y: 1050, hp: 48 };
    e.d.fire(archer, hostile, "禁止离岗箭");
    expect(e.d.arrows).toEqual([]);
  }, 30000);
  it("世界实际推进顺序下弓卫走到营房床位，不能只生成轮休行动", () => {
    const e = setup();
    e.s.time = 1140;
    const trace: any[] = [];
    for (const p of Object.values(GUARD_LANDINGS))
      expect(motionBlocked(p.x, p.y)).toBe(false);
    for (let t = 0; t < 60000; t += 100) {
      e.s.time = advanceTime(e.s.time, 100);
      const budget = { queries: 2 };
      e.d.update(t + 100, 100, { x: 670, y: 720, hp: 100 }, budget);
      e.l.step(100, budget);
      e.l.consumeDefense(e.d.drainNotices());
      if (t % 1000 === 0)
        trace.push({
          时间: t,
          人物: structuredClone(
            e.l.snapshot().people.filter((n) => n.id.endsWith("archer")),
          ),
          卫兵: e.s.defense.guards
            .filter((g) => g.id.endsWith("archer"))
            .map((g) => ({ ...g })),
          命令: [...e.d.peaceOrders],
        });
    }
    writeFileSync(
      ".parry-local/guard-bed-diagnostic.json",
      JSON.stringify({ 说明: "真实推进顺序，每秒记录轮休路径", 记录: trace }),
    );
    for (const g of e.s.defense.guards.filter((g) => g.id.endsWith("archer"))) {
      expect(g.space, g.id).toBe("barracks");
      expect(
        e.s.life.people.find((n) => n.id === g.id)!.action?.phase,
        g.id,
      ).toBe("perform");
    }
  }, 30000);
  it("和平午休结束后四门巡卫实际返岗，帧步长与快进均不能留下轮休者", () => {
    for (const step of [1000 / 60, 100]) {
      const e = setup();
      e.s.time = 720;
      const returned = new Set<string>(), left = new Set<string>();
      for (let now = step; e.s.time < 16.2 * 60; now += step) {
        const before = new Map(e.s.defense.guards.map(g=>[g.id,{space:g.space??"village",x:g.x,y:g.y}]));
        e.s.time = advanceTime(e.s.time, step);
        const budget = { queries: 2 };
        e.d.update(now, step, { x: 2200, y: 1100, hp: 56 }, budget);
        e.l.step(step, budget);
        e.l.consumeDefense(e.d.drainNotices());
        for (const g of e.s.defense.guards.filter(g=>g.id.endsWith("patrol"))) {
          const old = before.get(g.id)!;
          if (g.offDuty) left.add(g.id);
          if (e.s.time > 900 && !g.offDuty && left.has(g.id)) returned.add(g.id);
          // 过门切换空间使用各自坐标原点，只比较同一空间内的真实位移。
          if (old.space === (g.space??"village")) expect(Math.hypot(g.x-old.x,g.y-old.y)).toBeLessThanOrEqual(100 * step / 1000 + 1e-5);
        }
      }
      expect([...left].sort()).toEqual(["east-patrol", "north-patrol", "south-patrol", "west-patrol"]);
      expect([...returned].sort(), `步长 ${step}`).toEqual(["east-patrol", "north-patrol", "south-patrol", "west-patrol"]);
      expect(e.s.defense.guards.every(g=>!g.offDuty)).toBe(true);
    }
  }, 30000);
  it("四名弓卫分别到场临水休息，窗口结束后全部沿路返岗", () => {
    const e = setup(), rested = new Set<string>();
    let saved = false;
    e.s.time = 1140;
    for (let now=100; e.s.time<1380; now+=100) {
      e.s.time=advanceTime(e.s.time,100);
      const budget={queries:2};
      e.d.update(now,100,e.s.player,budget);
      e.l.step(100,budget);e.l.consumeDefense(e.d.drainNotices());
      if (!saved && e.s.time >= 1260) {
        saved = true;
        const sample = structuredClone(e.s);
        Object.assign(sample.player, {x:1650,y:1420});
        mkdirSync("docs/npc-life/evidence", {recursive:true});
        writeFileSync("docs/npc-life/evidence/guard-rest-save.json",JSON.stringify(validate(sample),null,2));
      }
      for (const g of e.s.defense.guards.filter(g=>g.id.endsWith("archer"))) {
        const n=e.s.life.people.find(n=>n.id===g.id)!;
        if(n.action?.label==="临水休息" && n.action.phase==="perform") {
          rested.add(g.id);
          expect(g.space).toBe("village");
          expect(Math.hypot(g.x-n.action.target.x,g.y-n.action.target.y)).toBeLessThan(6);
        }
      }
    }
    expect([...rested].sort()).toEqual(["east-archer","north-archer","south-archer","west-archer"]);
    for (const g of e.s.defense.guards.filter(g=>g.id.endsWith("archer"))) {
      expect(g.offDuty,g.id).toBe(false);
      expect(g.mode,g.id).toBe("post");
      expect(e.s.life.people.find(n=>n.id===g.id)!.pathFailures,g.id).toBe(0);
    }
  }, 30000);
  it("旧档中的共用休息目标会重新评估，保留身体、生命与已提交进度", () => {
    const e=setup(), rested=new Set<string>(), health=new Map(e.s.defense.guards.map(g=>[g.id,g.hp]));
    e.s.time=1310;
    for (const [id,x,y] of [["east-archer",1531.3,1371.9],["north-archer",1545.6,1376.9],["south-archer",1533.9,1406.1]] as const) {
      const g=e.s.defense.guards.find(g=>g.id===id)!, n=e.s.life.people.find(n=>n.id===id)!;
      Object.assign(g,{space:"village",x,y,offDuty:true,mode:"life",towerTransitMs:0});
      n.gear="carried";n.project=2;
      e.l.begin(n,{kind:"habit",target:{space:"village",x:1540,y:1390},facility:null,task:null,score:80,label:"临水休息"});
    }
    e.s=validate(e.s);e.d=new EastDefense(e.s.defense,0);e.l=new NpcLife(e.s,e.d);
    for(let now=100;now<=80000;now+=100) {
      e.s.time=advanceTime(e.s.time,100);
      const budget={queries:2};e.d.update(now,100,e.s.player,budget);e.l.step(100,budget);e.l.consumeDefense(e.d.drainNotices());
      for(const g of e.s.defense.guards.filter(g=>g.id.endsWith("archer")&&g.id!=="west-archer")) {
        const n=e.s.life.people.find(n=>n.id===g.id)!;
        if(n.action?.label==="临水休息" && n.action.phase==="perform")rested.add(g.id);
        expect(g.hp).toBe(health.get(g.id));expect(g.dead).toBe(false);expect(n.project).toBeGreaterThanOrEqual(2);
      }
    }
    expect([...rested].sort()).toEqual(["east-archer","north-archer","south-archer"]);
    for(const g of e.s.defense.guards.filter(g=>g.id.endsWith("archer")&&g.id!=="west-archer")) {
      expect(g.offDuty,g.id).toBe(false);
      expect(e.s.life.people.find(n=>n.id===g.id)!.pathFailures,g.id).toBe(0);
    }
  },30000);
});
describe("夜间睡眠首因诊断", () => {
  it("到达独立床位", () => {
    const e = setup();
    e.s.time = 1320;
    tick(e, 60000);
    writeFileSync(
      ".parry-local/npc-night.json",
      JSON.stringify({ 状态: e.l.snapshot() }),
    );
    expect(e.s.life.people[0].action?.kind).toBe("sleep");
    expect(e.s.life.people[0].action?.phase).toBe("perform");
  }, 30000);
});

describe("生活边界、恢复与认知反证", () => {
  it("未到场或进度不足的工作绝不提交", () => {
    const e = setup(),
      n = e.s.life.people[1],
      stock = { ...e.s.life.stores };
    e.l.begin(n, {
      kind: "work",
      target: FACILITIES.find((f) => f.id === "pharmacy")!.place,
      score: 80,
      label: "配药",
      facility: "pharmacy",
      task: null,
    });
    e.l.complete(n, n.action!);
    expect(e.s.life.stores).toEqual(stock);
    expect(n.committed).toBe(0);
  });
  it("晚到转述可以获知旧事实，记忆裁剪后重复事件不能刷关系", () => {
    const e = setup(),
      n = e.s.life.people[2];
    Object.assign(n.body!, { x: 1800, y: 1800 });
    const old = e.l.emit(
      "help",
      e.l.body("healer")!,
      "player",
      ["carpenter"],
      "照护报告",
    );
    const newer = e.l.emit("alarm", n.body!, "bell", [], "局部报告");
    e.l.remember(n, newer, "report");
    e.l.remember(n, old, "report");
    expect(n.memories.some((m) => m.eventId === old.id)).toBe(true);
    const trust = n.relations.player.trust;
    for (let i = 0; i < 100; i++)
      e.l.remember(
        n,
        e.l.emit("report", n.body!, "elder", [], "重复日常压缩"),
        "report",
      );
    e.l.remember(n, old, "report");
    expect(n.relations.player.trust).toBe(trust);
    expect(n.receipts.length).toBeLessThanOrEqual(80);
    expect(validate(e.s).life.people[2].receiptFloor).toBeGreaterThan(0);
  });
  it("长期堵门有限失败，冷却目标并预约备用床，预约不泄漏", () => {
    const e = setup(),
      n = e.s.life.people[0],
      blocked = { space: "elder-home" as const, x: 830, y: 750 };
    e.s.time = 1320;
    e.l.begin(n, {
      kind: "sleep",
      target: blocked,
      facility: null,
      task: null,
      score: 200,
      label: "堵门诊断",
    });
    Object.assign(n.body!, { space: "elder-home", x: 700, y: 910 });
    n.nextDecision = 1e9;
    for (let i = 0; i < 27; i++) e.l.step(1000, { queries: 2 });
    expect(n.pathFailures).toBe(3);
    expect(n.blockedTarget).toEqual(blocked);
    expect(n.blockedUntil).toBeGreaterThan(e.s.life.elapsed);
    expect(n.action?.kind).toBe("sleep");
    expect(n.action?.target.space).toBe("inn");
    expect(e.s.life.reservations.filter((r) => r.owner === n.id)).toHaveLength(
      1,
    );
    expect(e.s.life.reservations.find((r) => r.owner === n.id)?.facility).toBe(
      n.action?.facility,
    );
    expect(validate(e.s).life.people[0].blockedTarget).toEqual(blocked);
  });
  it("失去行动能力者保持原位，急救后才接受陪同转移", () => {
    const e = setup();
    e.l.debugInjury("elder", 100);
    const p = { ...e.s.life.people[0].body! };
    tick(e, 1000);
    expect(e.s.life.people[0].body).toEqual(p);
    expect(e.s.life.people[0].action).toBeNull();
  });
  it("守备不足时说明推迟离岗，伤亡不会补人", () => {
    const e = setup();
    e.s.time = 360;
    Object.assign(e.s.defense.guards[1], { dead: true, hp: 0, mode: "dead" });
    e.l.decide(e.s.life.people[3]);
    expect(e.s.defense.guards[0].offDuty).not.toBe(true);
    expect(e.s.life.people[3].reason).toContain("守备不足");
    expect(e.s.defense.guards[1].dead).toBe(true);
  });
  it("存档字段白名单剔除表现对象和未声明载荷", () => {
    const e = setup();
    (e.s.life.people[0] as any).sprite = { texture: "不能保存" };
    (e.s.life.people[0].body as any).texture = "不能保存";
    (e.s.life.people[0].supplies as any).sprite = { texture: "不能保存" };
    (e.s.life.people[0].speech as any).callback = "不能保存";
    expect((validate(e.s).life.people[0] as any).sprite).toBeUndefined();
    expect((validate(e.s).life.people[0].body as any).texture).toBeUndefined();
    expect(
      (validate(e.s).life.people[0].supplies as any).sprite,
    ).toBeUndefined();
    expect(
      (validate(e.s).life.people[0].speech as any).callback,
    ).toBeUndefined();
  });
});

it("驻防通知一次读取后分发，重复批次和读档不重复形成伤情事件", () => {
  const e = setup(),
    g = e.s.defense.guards[0];
  e.d.damageGuard(
    {
      sourceId: "actual-probe",
      targetId: g.id,
      attackId: "single-hit:1",
      amount: 10,
      sourceType: "enemy-melee",
      eventId: null,
    },
    { id: "actual-probe", hp: 100 },
  );
  const batch = e.d.drainNotices();
  expect(e.d.drainNotices()).toEqual([]);
  e.l.consumeDefense(batch);
  const sequence = e.s.life.sequence;
  e.l.consumeDefense(batch);
  expect(e.s.life.sequence).toBe(sequence);
  const restored = validate(e.s),
    life = new NpcLife(restored, new EastDefense(restored.defense, 0));
  life.consumeDefense(batch);
  expect(restored.life.sequence).toBe(sequence);
});

it("相同和平场景记录驻防基线与生活增量的真实耗时和查询量", () => {
  const samples: any[] = [];
  for (const enabled of [false, true])
    for (let run = 0; run < 3; run++) {
      const e = setup(),
        times: number[] = [];
      for (let t = 0; t < 120000; t += 100) {
        e.s.time = advanceTime(e.s.time, 100);
        const budget = { queries: 2 },
          start = performance.now();
        if (enabled) e.l.step(100, budget);
        e.d.update(t + 100, 100, { x: 670, y: 720, hp: 100 }, budget);
        if (enabled) e.l.consumeDefense(e.d.drainNotices());
        times.push(performance.now() - start);
      }
      times.sort((a, b) => a - b);
      samples.push({
        启用生活: enabled,
        轮次: run + 1,
        步数: times.length,
        总耗时毫秒: times.reduce((a, b) => a + b, 0),
        中位步毫秒: times[600],
        九五分位步毫秒: times[1140],
        生活耗时毫秒: e.l.metrics.ms,
        寻路查询: e.l.metrics.queries,
        预约: e.s.life.reservations.length,
        事件: e.s.life.events.length,
      });
    }
  mkdirSync("docs/npc-life/evidence", { recursive: true });
  writeFileSync(
    "docs/npc-life/evidence/simulation-performance.json",
    JSON.stringify(
      {
        说明: "固定初始存档、100毫秒步长、相同三小时和平场景。只比较客户端规则模拟，不含Phaser渲染；本机并行工作和缓存会影响耗时。",
        样本: samples,
      },
      null,
      2,
    ),
  );
  expect(samples.every((x) => x.预约 <= 12)).toBe(true);
}, 30000);

it("青禾接下安全可行的急救后护送，守门人数保持且先到场会合", () => {
  const e = setup(),
    medic = e.s.life.people[1],
    patient = e.s.life.people[0],
    guard = e.s.defense.guards[1],
    helper = e.s.life.people[4];
  e.l.debugInjury("elder", 70);
  const task = e.s.life.tasks[0];
  Object.assign(guard, { x: 700, y: 655 });
  Object.assign(medic.body!, {
    space: patient.body!.space,
    x: patient.body!.x,
    y: patient.body!.y,
  });
  e.l.begin(medic, {
    kind: "treat",
    target: task.place,
    score: 200,
    facility: null,
    task: task.id,
    label: "真实到场急救前提",
  });
  medic.action!.phase = "perform";
  medic.gear = "carried";
  medic.supplies.medicine = 1;
  e.s.life.stores.medicine--;
  medic.action!.progress = medic.action!.duration;
  e.l.complete(medic, medic.action!);
  expect(helper.action?.kind).toBe("escort");
  expect(helper.action?.phase).toBe("collect");
  expect(guard.offDuty).toBe(true);
  expect(
    e.s.defense.guards.filter(
      (g) => g.id.startsWith("east") && !g.offDuty && !g.dead,
    ),
  ).toHaveLength(2);
  const p = { ...patient.body! };
  e.l.step(100, { queries: 2 });
  expect(patient.body).toEqual(p);
  let arrived = false;
  for (let t = 0; t < 15000; t += 100) {
    tick(e, 100);
    arrived ||=
      patient.body!.space === "village" &&
      Math.hypot(patient.body!.x - 780, patient.body!.y - 690) < 20;
  }
  writeFileSync(
    ".parry-local/npc-escort.json",
    JSON.stringify({ 状态: e.l.snapshot(), 卫兵: e.s.defense.guards }),
  );
  expect(arrived).toBe(true);
  expect(helper.action).toBeNull();
  expect(guard.mode).toBe("return");
  expect(patient.body!.health).toBe("convalescent");
});

it("保存结束清理发生在提交边界，恢复后的新界面按键不会被首帧清空", async () => {
  const keys = new Input(null);
  let finish!: () => void;
  const operation = new StateCommit(
    () => {},
    () => {
      keys.pressed.clear();
      keys.drain();
    },
  );
  const e = setup();
  const pending = operation.run(
    () => e.s,
    (s) => s,
    () => new Promise<void>((resolve) => (finish = resolve)),
    () => {},
  );
  keys.keyDown("Tab");
  keys.keyUp("Tab");
  expect(operation.busy).toBe(true);
  // 提交锁已生效；写入器在当前同步帧收齐后启动。
  await Promise.resolve();
  finish();
  await pending;
  expect(keys.take("tab")).toBe(false);
  keys.keyDown("Tab");
  keys.keyUp("Tab");
  expect(keys.take("tab")).toBe(true);
});
it("已锁定卫兵进屋后敌人取消前摇，不跨空间结算旧命中", () => {
  const e = setup();
  e.s.defense = prepareRaid(e.s.defense, e.s.player, "east-gate");
  e.d = new EastDefense(e.s.defense, 0);
  e.l.rebind(e.s, e.d);
  e.l.restore();
  const g = e.s.defense.guards[0],
    enemy = e.d.enemies[0];
  Object.assign(enemy, { x: g.x - 30, y: g.y, targetId: g.id });
  enemy.attack = createEnemyAttack(enemy.id, 1, enemy.type, 0, enemy, g);
  g.space = "barracks";
  g.x = enemy.x;
  g.y = enemy.y;
  g.offDuty = true;
  const hp = g.hp;
  e.d.update(1000, 100, { x: 670, y: 720, hp: 100 }, { queries: 2 });
  expect(g.hp).toBe(hp);
  expect(enemy.attack).toBeNull();
});
it("维修需求不会给室内木匠全知记忆，实际收到报告后才可认领", () => {
  const e = setup(),
    n = e.s.life.people[2];
  Object.assign(n.body!, { space: "carpenter-home", x: 570, y: 800 });
  e.l.damageFacility("wind-bell", 50, true);
  expect(e.l.candidates(n).some((c) => c.kind === "repair")).toBe(false);
  const event = e.s.life.events.at(-1)!;
  e.l.remember(n, event, "report");
  expect(e.l.candidates(n).some((c) => c.kind === "repair")).toBe(true);
});

describe("生活子版本2：私人取放与备用住宿", () => {
  it("子版本1迁移携带事实，重复加载不补充公共库存或复活卫兵", () => {
    const e = setup(),
      old: any = structuredClone(e.s);
    delete old.life.version;
    delete old.life.unavailable;
    for (const n of old.life.people) {
      delete n.gear;
      n.kit = n.id === "healer";
      n.tools = false;
    }
    Object.assign(old.defense.guards[0], { hp: 0, dead: true, mode: "dead" });
    old.life.stores.medicine = 1;
    const next = validate(old);
    expect(next.life.version).toBe(4);
    expect(next.life.people[1].gear).toBe("carried");
    expect(next.life.stores.medicine).toBe(1);
    expect(next.defense.guards[0].dead).toBe(true);
    expect(next.bag).toEqual(old.bag);
    expect(validate(next)).toEqual(next);
    expect(JSON.stringify(next.life)).not.toContain('"kit"');
  });
  it("必须到自己的箱子取物，中断不丢物，归还中读档不复制物品", () => {
    let e = setup();
    const box = PRIVATE_STORAGE.find((b) => b.owner === "healer")!,
      pharmacy = FACILITIES.find((f) => f.id === "pharmacy")!;
    let n = e.s.life.people[1];
    Object.assign(n.body!, box.use);
    e.l.begin(n, {
      kind: "work",
      target: pharmacy.place,
      facility: pharmacy.id,
      task: null,
      score: 90,
      label: "配药",
    });
    n.nextDecision = 1e9;
    const stock = structuredClone(e.s.life.stores),
      bag = structuredClone(e.s.bag);
    tick(e, 1400);
    expect(n.gear).toBe("locker");
    expect(n.action!.phase).toBe("collect");
    e.s = validate(e.s);
    e.d = new EastDefense(e.s.defense, e.s.life.elapsed);
    e.l = new NpcLife(e.s, e.d);
    n = e.s.life.people[1];
    tick(e, 100);
    expect(n.gear).toBe("carried");
    expect(n.action!.phase).toBe("travel");
    e.l.cancel(n, "警报中断");
    expect(n.gear).toBe("carried");
    expect(e.s.life.reservations.some((r) => r.owner === n.id)).toBe(false);
    e.l.begin(n, e.l.storeCandidate(n)!);
    n.nextDecision = 1e9;
    tick(e, 700);
    e.s = validate(e.s);
    e.d = new EastDefense(e.s.defense, e.s.life.elapsed);
    e.l = new NpcLife(e.s, e.d);
    n = e.s.life.people[1];
    const returning = n.action!;
    tick(e, 800);
    expect(n.gear).toBe("locker");
    e.l.complete(n, returning);
    expect(n.gear).toBe("locker");
    expect(e.s.life.stores).toEqual(stock);
    expect(e.s.bag).toEqual(bag);
    expect(e.l.storageText(box.id)).toContain("存放在箱中");
  });
  it("没有工作物品不能提交产出，物品归属不可伪造成任意储物点", () => {
    const e = setup(),
      n = e.s.life.people[1],
      f = FACILITIES.find((f) => f.id === "pharmacy")!;
    Object.assign(n.body!, f.place);
    e.l.begin(n, {
      kind: "work",
      target: f.place,
      facility: f.id,
      task: null,
      score: 90,
      label: "配药",
    });
    const before = structuredClone(e.s.life.stores),
      a = n.action!;
    a.phase = "perform";
    a.progress = a.duration;
    e.l.complete(n, a);
    expect(e.s.life.stores).toEqual(before);
    expect(n.committed).toBe(0);
    const invalid: any = structuredClone(e.s);
    invalid.life.people[1].gear = "other-locker";
    expect(() => validate(invalid)).toThrow();
  });
  it("三个住所不可进入时真实前往旅馆，各占一张空床，读档和恢复入口不瞬移", () => {
    let e = setup();
    e.s.time = 1320;
    e.s.life.unavailable.homes = {
      "elder-home": true,
      "healer-home": true,
      "carpenter-home": true,
    };
    tick(e, 300); // 覆盖三人的错峰首次决策；仍远小于前往旅馆的旅行时间。
    expect(
      e.s.life.people.slice(0, 3).every((n) => n.body!.space === "village"),
    ).toBe(true);
    expect(
      e.s.life.people
        .slice(0, 3)
        .every((n) => n.action?.target.space === "inn"),
    ).toBe(true);
    tick(e, 65000);
    for (const n of e.s.life.people.slice(0, 3)) {
      expect(n.body!.space, n.id).toBe("inn");
      expect(n.action?.kind).toBe("sleep");
      expect(n.action?.phase).toBe("perform");
    }
    expect(
      new Set(e.s.life.people.slice(0, 3).map((n) => n.action!.facility)).size,
    ).toBe(3);
    const positions = e.s.life.people
      .slice(0, 3)
      .map((n) => structuredClone(n.body));
    e.s = validate(e.s);
    e.d = new EastDefense(e.s.defense, e.s.life.elapsed);
    e.l = new NpcLife(e.s, e.d);
    expect(e.s.life.people.slice(0, 3).map((n) => n.body)).toEqual(positions);
    e.s.life.unavailable.homes = {};
    tick(e, 1000);
    expect(
      e.s.life.people.slice(0, 3).every((n) => n.body!.space === "inn"),
    ).toBe(true);
    tick(e, 65000);
    for (const n of e.s.life.people.slice(0, 3))
      expect(
        n.body!.space,
        JSON.stringify({
          id: n.id,
          body: n.body,
          action: n.action,
          reason: n.reason,
          nav: e.l.nav(n.id),
        }),
      ).toBe(PEOPLE.find((p) => p.id === n.id)!.home);
  }, 30000);
  it("床位不可用选择备用床，临时床容量与主人床归属都校验", () => {
    const e = setup(),
      n = e.s.life.people[1];
    e.s.life.unavailable.facilities = ["bed:healer"];
    const bed = e.l.beds(n)[0];
    expect(bed.place.space).toBe("inn");
    expect(e.l.reserve(n, bed.id)).toBe(true);
    expect(e.l.reserve(e.s.life.people[0], bed.id)).toBe(false);
    const invalid: any = structuredClone(e.s);
    invalid.life.reservations = [
      { facility: "bed:healer", owner: "elder", expires: 1000 },
    ];
    expect(() => validate(invalid)).toThrow();
  });
});

describe("生活子版本3：真实补给与守恒", () => {
  it("装药中读档不提前扣料，取消保留随身药，到场治疗只消耗一次", () => {
    let e = setup();
    const medic = e.s.life.people[1];
    e.l.debugInjury("elder", 70);
    medic.gear = "carried";
    Object.assign(medic.body!, e.l.materialSource("medicine"));
    const candidate = e.l.candidates(medic).find((c) => c.kind === "treat")!;
    expect(e.l.begin(medic, candidate)).toBe(true);
    expect(medic.action?.phase).toBe("stock");
    const initial = e.s.life.stores.medicine;
    tick(e, 1000);
    expect(medic.supplies.medicine).toBe(0);
    expect(e.s.life.stores.medicine).toBe(initial);
    expect(
      e.s.life.reservations.some(
        (r) => r.facility === "pharmacy" && r.owner === "healer",
      ),
    ).toBe(true);
    const saved = validate(e.s),
      d = new EastDefense(saved.defense, 0);
    e = { s: saved, d, l: new NpcLife(saved, d) };
    tick(e, 600);
    const next = e.s.life.people[1];
    expect(next.supplies.medicine).toBe(2);
    expect(e.s.life.stores.medicine).toBe(initial - 2);
    expect(e.s.life.reservations.some((r) => r.facility === "pharmacy")).toBe(
      false,
    );
    e.l.cancel(next, "安全演练中断");
    expect(next.supplies.medicine).toBe(2);
    expect(validate(e.s).life.people[1].supplies.medicine).toBe(2);
    for (
      let t = 0;
      t < 80000 && !e.s.life.events.some((ev) => ev.kind === "care");
      t += 100
    )
      tick(e, 100);
    expect(e.s.life.events.filter((ev) => ev.kind === "care")).toHaveLength(1);
    expect(next.supplies.medicine).toBe(1);
    expect(e.s.life.stores.medicine).toBe(initial - 2);
    expect(e.s.bag.every((x) => x === null)).toBe(true);
    expect(e.s.life.people[0].body!.hp).toBe(75);
    expect(validate(e.s).life.people[1].supplies).toEqual(next.supplies);
  });
  it("维修先到工坊领取有限木料，再到受损风铃维修，加载不再扣材料", () => {
    const e = setup(),
      carpenter = e.s.life.people[2],
      initial = e.s.life.stores.wood;
    carpenter.gear = "carried";
    e.l.damageFacility("wind-bell", 50, true);
    const event = e.s.life.events.at(-1)!;
    e.l.remember(carpenter, event, "report");
    let collected = false;
    for (
      let t = 0;
      t < 80000 && !e.s.life.events.some((ev) => ev.kind === "repair");
      t += 100
    ) {
      const before = e.s.life.stores.wood;
      tick(e, 100);
      if (before !== e.s.life.stores.wood) {
        const source = e.l.materialSource("wood");
        expect(carpenter.body!.space).toBe(source.space);
        expect(
          Math.hypot(
            carpenter.body!.x - source.x,
            carpenter.body!.y - source.y,
          ),
        ).toBeLessThan(6);
        expect(carpenter.supplies.wood).toBe(2);
        collected = true;
      }
    }
    expect(collected).toBe(true);
    expect(e.s.life.facilities["wind-bell"]).toBe(100);
    expect(carpenter.supplies.wood).toBe(0);
    expect(e.s.life.stores.wood).toBe(initial - 2);
    expect(e.s.life.events.filter((ev) => ev.kind === "repair")).toHaveLength(
      1,
    );
    const restored = validate(e.s),
      d = new EastDefense(restored.defense, 0);
    tick({ s: restored, d, l: new NpcLife(restored, d) }, 5000);
    expect(restored.life.stores.wood).toBe(initial - 2);
  });
  it("补给入口关闭时不远程取药，已在药箱中的药仍可用于安全救护", () => {
    const e = setup(),
      medic = e.s.life.people[1];
    e.l.debugInjury("elder", 70);
    medic.gear = "carried";
    e.s.life.unavailable.homes["healer-home"] = true;
    expect(e.l.candidates(medic).some((c) => c.kind === "treat")).toBe(false);
    tick(e, 1500);
    expect(e.s.life.stores.medicine).toBe(4);
    medic.supplies.medicine = 1;
    e.s.life.stores.medicine--;
    expect(e.l.candidates(medic).some((c) => c.kind === "treat")).toBe(true);
    const bad = structuredClone(e.s);
    bad.life.stores.medicine = LIFE.maxMedicine;
    expect(() => validate(bad)).toThrow("合计超过上限");
  });
});

it("营房入口演练后每门只有一人沿路去备用床，塔位停射，调试事实可读档", () => {
  const e = setup();
  e.s.time = 1140;
  e.l.debugAccess("east-archer");
  expect(e.s.life.events.at(-1)?.debug).toBe(true);
  expect(e.s.life.events.at(-1)?.kind).toBe("access");
  tick(e, 60000);
  for (const prefix of ["east", "north", "south"]) {
    const group = e.s.defense.guards.filter((g) => g.id.startsWith(prefix));
    expect(group.filter((g) => !g.offDuty && !g.dead)).toHaveLength(2);
    const away = group.find((g) => g.offDuty)!;
    expect(away.space, prefix).toBe("inn");
    expect(e.s.life.people.find((n) => n.id === away.id)?.body).toBeNull();
    e.d.fire(
      away,
      { id: "probe", x: 2250, y: 1050, hp: 48 } as any,
      "离岗负向样本",
    );
  }
  expect(e.d.arrows).toEqual([]);
  expect(validate(e.s).life.unavailable.homes.barracks).toBe(true);
}, 30000);

it("取物途中入口关闭立即释放救护认领，等待可用物品而不隔门制造药箱", () => {
  const e = setup(),
    n = e.s.life.people[1];
  e.l.debugInjury("elder", 70);
  const task = e.s.life.tasks[0];
  e.l.begin(n, {
    kind: "treat",
    target: task.place,
    facility: null,
    task: task.id,
    score: 200,
    label: "取箱救护",
  });
  expect(n.action?.phase).toBe("collect");
  const stock = e.s.life.stores.medicine;
  e.l.debugAccess("healer");
  tick(e, 2000);
  expect(n.gear).toBe("locker");
  expect(n.action?.kind).toBe("rest");
  expect(e.s.life.tasks.find((t) => t.id === task.id)?.owner).toBeNull();
  expect(e.s.life.reservations.some((r) => r.owner === n.id)).toBe(false);
  expect(e.s.life.stores.medicine).toBe(stock);
});

it("旅馆客房侧门留足行走误差，不能抢占原补给服务点", () => {
  const home = HOMES.find((h) => h.id === "inn")!,
    service = serviceEntrances.find((p) => p.id === "service-inn")!;
  expect(motionBlocked(home.door.x, home.door.y)).toBe(false);
  for (const dx of [-6, 0, 6])
    for (const dy of [-6, 0, 6]) {
      const x = 1630 + dx,
        y = 1650 + dy;
      expect(Math.hypot(x - service.x, y - service.y)).toBeLessThan(
        Math.hypot(x - home.door.x, y - home.door.y),
      );
    }
});

it("室内床角阻挡实际救治，只有绕到同侧才结算药品与伤情", () => {
  const e = setup(),
    patient = e.s.life.people[0],
    medic = e.s.life.people[1];
  Object.assign(patient.body!, { space: "elder-home", x: 432, y: 485 });
  Object.assign(medic.body!, { space: "elder-home", x: 415, y: 505 });
  expect(spaceBlocked("elder-home", patient.body!.x, patient.body!.y)).toBe(
    false,
  );
  expect(spaceBlocked("elder-home", medic.body!.x, medic.body!.y)).toBe(false);
  expect(spaceClear("elder-home", medic.body!, patient.body!)).toBe(false);
  e.l.debugInjury("elder", 70);
  medic.gear = "carried";
  medic.supplies.medicine = 1;
  e.s.life.stores.medicine--;
  const task = e.s.life.tasks.find((t) => t.subject === "elder")!;
  expect(
    e.l.begin(medic, {
      kind: "treat",
      target: task.place,
      score: 200,
      label: "安全到场救护",
      facility: null,
      task: task.id,
    }),
  ).toBe(true);
  const a = medic.action!,
    stock = e.s.life.stores.medicine,
    hp = patient.body!.hp,
    receipt = medic.committed;
  a.phase = "perform";
  a.progress = a.duration;
  e.l.complete(medic, a);
  expect(patient.body!.hp).toBe(hp);
  expect(medic.supplies.medicine).toBe(1);
  expect(medic.committed).toBe(receipt);
  expect(e.s.life.events.some((event) => event.kind === "care")).toBe(false);
  Object.assign(medic.body!, { x: 432, y: 470 });
  expect(spaceClear("elder-home", medic.body!, patient.body!)).toBe(true);
  e.l.complete(medic, a);
  expect(patient.body!.hp).toBe(hp + 45);
  expect(medic.supplies.medicine).toBe(0);
  expect(e.s.life.stores.medicine).toBe(stock);
  expect(e.s.life.events.filter((event) => event.kind === "care")).toHaveLength(
    1,
  );
});
