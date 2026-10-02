import { describe, it, expect, afterEach } from "vitest";
import { syncMapGeometry } from "../src/data/world";
afterEach(() => syncMapGeometry(false));
import { initialState, validate } from "../src/game/systems/state";
import { NpcLife } from "../src/game/systems/npcLife";
import { EastDefense, prepareRaid } from "../src/game/systems/defense";
import { XiaobaoCombat } from "../src/game/systems/xiaobaoCombat";
import {
  xiaobaoEnvironment,
  xiaobaoAllies,
} from "../src/game/systems/xiaobaoWorld";
import {
  newXiaobaoDay,
  xiaobaoDiary,
  requestXiaobaoFollow,
  requestXiaobaoTask,
  stepXiaobaoLife,
  moveXiaobaoLife,
} from "../src/game/systems/xiaobaoLife";
import { advanceTime } from "../src/game/systems/worldClock";
import { RAID_GATES } from "../src/data/defense";
import { FACILITIES, PRIVATE_STORAGE } from "../src/data/npcLife";
import type { World } from "../src/game/scenes/World";
import { writeFileSync, mkdirSync } from "node:fs";
import { StateCommit } from "../src/game/systems/stateCommit";
import { SaveQueue } from "../src/game/systems/saveQueue";

import { spaceBlocked } from "../src/game/systems/npcNavigation";
export function lifeFixture(seed = 20261002) {
  const s = initialState(),
    d = new EastDefense(s.defense, 0),
    life = new NpcLife(s, d),
    c = new XiaobaoCombat();
  s.xiaobao.life.seed = seed;
  c.bind(s.xiaobao, true);
  const w = {
    state: s,
    defense: d,
    life,
    xiaobao: { controller: c },
    enemies: [],
    sim: 0,
    xiaobaoRecent: null,
    xiaobaoUnderRoof: () => false,
    checkpointXiaobaoFlight: (id: string) => c.confirmFlight(id),
    ui: { message: () => {} },
    enemyVictim: () => ({ id: "player" }),
    xiaobaoHit: (e: any, event: any, released: any) => {
      const hp = e.hp,
        applied = d.damageEnemy(e, event, released);
      return { applied, killed: applied && e.hp === 0, damage: hp - e.hp };
    },
  } as unknown as World;
  const advance = (ms: number, step = 100) => {
    for (let t = 0; t < ms; t += step) {
      const dt = Math.min(step, ms - t),
        b = { queries: 2 };
      s.time = advanceTime(s.time, dt);
      w.sim += dt;
      d.now = w.sim;
      c.tick(dt, xiaobaoEnvironment(w), b);
      d.update(w.sim, dt, s.player, b);
      life.step(dt, b);
      life.consumeDefense(d.drainNotices());
      if (w.sim % 30000 === 0) validate(s);
    }
  };
  return {
    s,
    d,
    life,
    c,
    w,
    advance,
    n: s.life.people.find((n) => n.id === "xiaobao")!,
  };
}

describe("小宗师的自主生活与第一护村优先级", () => {
  it("结构20迁移只新增生活，保留原有伤情、冷却、资源和委托，重复读档稳定", () => {
    const current = initialState(),
      old: any = structuredClone(current);
    old.schema_version = 20;
    old.life.version = 4;
    old.life.people = old.life.people.filter((n: any) => n.id !== "xiaobao");
    delete old.xiaobao.life;
    delete old.xiaobao.space;
    old.xiaobao.autoSupport = false;
    old.xiaobao.hp = 310;
    old.xiaobao.cooldowns.flight = 12345;
    old.xiaobao.task = "follow";
    const next = validate(old);
    expect(next.schema_version).toBe(initialState().schema_version);
    expect(next.life.version).toBe(5);
    expect(next.xiaobao).toMatchObject({
      hp: 310,
      task: "follow",
      autoSupport: true,
    });
    expect(next.xiaobao.cooldowns.flight).toBe(12345);
    expect([next.coins, next.bag, next.defense, next.quest]).toEqual([
      old.coins,
      old.bag,
      old.defense,
      old.quest,
    ]);
    expect(validate(next)).toEqual(next);
  });
  it("当天心愿不随刷新重抽，住宿跨日不凭空写成果", () => {
    const e = lifeFixture(17);
    newXiaobaoDay(e.s);
    const goals = structuredClone(e.s.xiaobao.life);
    newXiaobaoDay(e.s);
    expect(e.s.xiaobao.life).toEqual(goals);
    const loaded = validate(e.s);
    newXiaobaoDay(loaded);
    expect(loaded.xiaobao.life).toEqual(goals);
    loaded.time += 1440 * 4;
    newXiaobaoDay(loaded);
    expect(loaded.xiaobao.life.projects).toEqual(goals.projects);
    expect(loaded.xiaobao.life.journal).toEqual([]);
  });
  it("长期成果全部完成后仍选择可做的每日心愿，伤情探望不产生重复心愿", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const e = lifeFixture(seed);
      e.s.time = 1500;
      e.s.xiaobao.life.day = 0;
      for (const p of Object.values(e.s.xiaobao.life.projects)) {
        p.stage = 3;
        p.lastDay = 0;
      }
      newXiaobaoDay(e.s);
      expect(["wind", "wood", "herb"]).not.toContain(e.s.xiaobao.life.main);
      expect(["wind", "wood", "herb"]).not.toContain(e.s.xiaobao.life.optional);
      e.s.xiaobao.life.day = 0;
      e.life.emit(
        "injury",
        e.life.body("xiaobao")!,
        "slime-2",
        ["xiaobao", "elder"],
        "在场看到受伤",
      );
      newXiaobaoDay(e.s);
      expect(e.s.xiaobao.life.main).toBe("visit");
      expect(e.s.xiaobao.life.optional).not.toBe("visit");
      expect(() => validate(e.s)).not.toThrow();
    }
  });
  it("不在场、重复结算和同一天不能推进多阶段心愿", () => {
    const e = lifeFixture();
    newXiaobaoDay(e.s);
    e.life.step(1200, { queries: 0 });
    const a = e.n.action!;
    expect(a).not.toBeNull();
    expect(e.s.xiaobao.life.journal).toEqual([]);
    stepXiaobaoLife(e.life, 30000);
    expect(e.s.xiaobao.life.projects.wind.stage).toBe(0);
    e.advance(120000);
    const stages = Object.values(e.s.xiaobao.life.projects).map((p) => p.stage);
    expect(stages.every((p) => p <= 1)).toBe(true);
    expect(e.s.xiaobao.life.journal.length).toBeGreaterThan(0);
    expect(validate(e.s)).toMatchObject({
      schema_version: initialState().schema_version,
    });
  });
  it("邀请可以婉拒、稍后兑现，重复点击不重抽，也不绕开护村", () => {
    const e = lifeFixture();
    e.n.needs.fatigue = 90;
    const answer = requestXiaobaoFollow(e.s);
    expect(answer).toContain("休息");
    expect(e.s.xiaobao.task).toBe("free");
    expect(requestXiaobaoFollow(e.s)).toBe(answer);
    e.s.xiaobao.life.promise = null;
    e.n.needs.fatigue = 10;
    e.life.begin(e.n, {
      kind: "habit",
      target: { space: "village", x: e.c.x, y: e.c.y },
      label: "练掌",
      score: 100,
      facility: null,
      task: null,
    });
    e.n.action!.phase = "perform";
    e.n.action!.duration = 1000;
    expect(requestXiaobaoFollow(e.s)).toContain("做完");
    e.advance(1200);
    expect(e.s.xiaobao.task).toBe("follow");
    e.s.xiaobao.life.emergency = true;
    e.s.xiaobao.task = "free";
    expect(requestXiaobaoFollow(e.s)).toContain("守住");
  });
  it("接受邀请中断在途安排后，日记显示实际同行与等候打算", () => {
    const e = lifeFixture();
    newXiaobaoDay(e.s);
    e.life.step(1200, {queries: 0});
    expect(e.n.action?.phase).toBe("travel");
    const interrupted = e.s.xiaobao.life.metrics.interrupted;
    expect(requestXiaobaoFollow(e.s)).toContain("一起");
    expect(e.n.action).toBeNull();
    expect(e.s.xiaobao.life.metrics.interrupted).toBe(interrupted + 1);
    expect(xiaobaoDiary(e.s)).toContain("现在打算：与你同行");
    e.s.xiaobao.wait = {...e.s.player, region: "village"};
    expect(xiaobaoDiary(e.s)).toContain("现在打算：在约好的地方等你");
    e.s.xiaobao.life.emergency = true;
    expect(xiaobaoDiary(e.s)).toContain("现在打算：先保护村庄");
  });
  it.each(["正常", "疲劳", "未亲历"] as const)("夜间战后%s：依据真实守卫伤情先探望，保留强制休息阈值", mode => {
    const e = lifeFixture();
    e.s.time = 1300;
    const guard = e.s.defense.guards.find(g => g.id === "east-patrol")!;
    Object.assign(guard, {x: 850, y: 775, hp: 80, space: "village"});
    Object.assign(e.s.xiaobao, {x: 815, y: 775});
    e.c.bind(e.s.xiaobao, true);
    e.n.nextDecision = 0;
    e.n.action = null;
    e.n.needs.hunger = 20;
    e.n.needs.fatigue = mode === "疲劳" ? 81 : 10;
    newXiaobaoDay(e.s);
    e.s.xiaobao.life.aftercareUntil = e.s.time + 180;
    if (mode !== "未亲历") {
      const event = e.life.emit("injury", e.life.body(guard.id)!, guard.id, [guard.id], "驻防战斗受伤");
      e.life.remember(e.n, event, "seen");
    }
    stepXiaobaoLife(e.life, 50);
    if (mode === "正常") expect(e.n.action?.xiaobao?.partner).toBe("east-patrol");
    else expect(e.n.action?.kind).toBe("sleep");
  });
  it.each(["accepted", "later"] as const)("战后探望完成且没有维修事实时，立即恢复已经兑现的%s同行约定", response => {
    const e = lifeFixture();
    newXiaobaoDay(e.s);
    const guard = e.s.defense.guards.find(g => g.id === "east-patrol")!;
    const event = e.life.emit("injury", e.life.body(guard.id)!, guard.id, [guard.id], "驻防战斗受伤");
    e.life.remember(e.n, event, "seen");
    Object.assign(e.s.xiaobao.life, {aftercareUntil: e.s.time + 180, resumeTask: "follow", done: ["visit"], promise: {response, status: "done", expires: e.s.time + 60, actionId: 0, reason: "一起！"}});
    stepXiaobaoLife(e.life, 50);
    expect(e.s.xiaobao.task).toBe("follow");
    expect(e.s.xiaobao.life.resumeTask).toBeNull();
  });
  it.each(["free", "guard"] as const)("危机中重新选择%s后，不会恢复已经撤销的旧同行", task => {
    const e = lifeFixture();
    newXiaobaoDay(e.s);
    Object.assign(e.s.xiaobao.life, {emergency: true, resumeTask: "follow", promise: {response: "accepted", status: "done", expires: e.s.time + 60, actionId: 0, reason: "一起！"}});
    expect(requestXiaobaoTask(e.s, task)).toContain("先");
    expect(e.s.xiaobao.task).toBe("free");
    expect(e.s.xiaobao.life.promise?.status).toBe("cancelled");
    e.s.xiaobao.life.emergency = false;
    stepXiaobaoLife(e.life, 50);
    expect(e.s.xiaobao.task).toBe(task);
    expect(e.s.xiaobao.life.resumeTask).toBeNull();
  });
  it.each(["village", "elder-home"] as const)("在%s应邀演武原地完成，期间生活不能重新派行动", space => {
    const e = lifeFixture();
    Object.assign(e.s.xiaobao, {space, x: space === "village" ? 450 : 570, y: space === "village" ? 650 : 560});
    e.c.bind(e.s.xiaobao, true);
    const origin = {x: e.c.x, y: e.c.y};
    e.c.perform("palm", e.s.player);
    for (let elapsed = 0; e.c.demonstration && elapsed < 20000; elapsed += 100) {
      e.advance(100);
      expect(e.c.x).toBe(origin.x);
      expect(e.c.y).toBe(origin.y);
      expect(e.n.action).toBeNull();
    }
    expect(e.c.demonstration).toBe(false);
    expect(e.s.xiaobao.life.journal).toEqual([]);
    expect(() => validate(e.s)).not.toThrow();
  });
  it.each(
    RAID_GATES.flatMap((g) =>
      ["睡觉", "室内", "采集", "演武", "随行", "等候", "冷却", "调息"].map(
        (mode) => [g.id, mode] as const,
      ),
    ),
  )("%s正式来袭覆盖%s与旧关闭回援字段", (gate, mode) => {
    const e = lifeFixture();
    e.s.xiaobao.task = "follow";
    e.s.xiaobao.autoSupport = false;
    e.s.xiaobao.wait = { x: e.c.x, y: e.c.y, region: "village" };
    e.life.begin(e.n, {
      kind: "rest",
      target: { space: "village", x: e.c.x, y: e.c.y },
      label: "测试休息",
      score: 100,
      facility: "plaza-seat",
      task: null,
    });
    if (mode === "演武") e.c.perform("all", e.s.player);
    if (mode === "冷却") e.s.xiaobao.cooldowns.flight = 20000;
    if (mode === "调息") {
      e.s.xiaobao.rest = 30000;
      e.s.xiaobao.hp = 0;
    }
    if (mode === "睡觉" || mode === "室内") {
      Object.assign(
        e.s.xiaobao,
        FACILITIES.find((f) => f.id === "bed:xiaobao")!.place,
      );
      e.c.bind(e.s.xiaobao, true);
      e.n.action!.target = {
        ...FACILITIES.find((f) => f.id === "bed:xiaobao")!.place,
      };
      e.n.action!.kind = "sleep";
      e.n.action!.facility = "bed:xiaobao";
    }
    if (mode === "采集") {
      e.n.action!.kind = "supply";
      e.n.action!.xiaobao = { wish: "deliver", partner: null };
    }
    if (mode === "随行")
      e.s.xiaobao.command = {
        kind: "protect",
        target: null,
        center: { ...e.s.player },
        remaining: 5000,
      };
    if (gate === "west-gate") {
      e.s.mapProgress.westRoad = "open";
      syncMapGeometry(true);
    }
    e.s.defense = prepareRaid(e.s.defense, e.s.player, gate, 1);
    e.d.rebind(e.s.defense);
    e.d.restore(0);
    e.advance(155);
    expect(e.s.xiaobao.life.emergency).toBe(true);
    expect(e.s.xiaobao.wait).toBeNull();
    expect(e.n.action).toBeNull();
    expect(e.c.demonstration).toBe(false);
    expect(e.s.xiaobao.command).toBeNull();
    if (mode === "调息") {
      expect(e.c.available).toBe(false);
      expect(e.s.xiaobao.hp).toBe(0);
      expect(e.s.xiaobao.rest).toBeGreaterThan(29800);
    }
    if (mode === "冷却")
      expect(e.s.xiaobao.cooldowns.flight).toBeGreaterThan(19800);
    expect(e.s.life.reservations.some((r) => r.owner === "xiaobao")).toBe(
      false,
    );
  });
  it("正式来袭预警已开始时立即护村，敌人尚未生成也释放生活预约", () => {
    const e = lifeFixture();
    e.life.step(2000, { queries: 0 });
    e.s.defense = prepareRaid(e.s.defense, e.s.player, "east-gate", 1, true);
    e.d.rebind(e.s.defense);
    e.d.restore(0);
    expect(e.d.enemies).toHaveLength(0);
    e.advance(155);
    expect(e.s.xiaobao.life.emergency).toBe(true);
    expect(e.n.action).toBeNull();
    expect(e.s.life.reservations.some((r) => r.owner === "xiaobao")).toBe(
      false,
    );
  });
  it("邀请保存失败不发布承诺，旧档保留且之后可以正常保存", async () => {
    const e = lifeFixture(),
      commit = new StateCommit();
    let current = e.s,
      published = 0,
      saved = structuredClone(current),
      reject = true;
    const queue = new SaveQueue(async (next) => {
      if (reject) throw Error("模拟磁盘保存失败");
      saved = structuredClone(next);
    });
    const invite = () =>
      commit.run(
        () => current,
        (state) => {
          const next = structuredClone(state);
          requestXiaobaoFollow(next);
          return next;
        },
        (next) => queue.enqueue(next),
        (next) => {
          current = next;
          published++;
        },
      );
    await expect(invite()).rejects.toThrow("保存失败");
    expect(published).toBe(0);
    expect(current.xiaobao.life.promise).toBeNull();
    expect(saved).toEqual(e.s);
    expect(commit.busy).toBe(false);
    reject = false;
    await invite();
    expect(published).toBe(1);
    expect(saved.xiaobao.task).toBe("follow");
    expect(current).toEqual(saved);
  });
  it("药草与木料只在到场完成后结算，中断和重复完成不增减库存", () => {
    const e = lifeFixture();
    const tools = FACILITIES.find((f) => f.id === "tools")!.place;
    Object.assign(e.s.xiaobao, {
      space: "village",
      x: tools.x + 35,
      y: tools.y,
    });
    e.c.bind(e.s.xiaobao, true);
    e.life.begin(e.n, {
      kind: "supply",
      target: { space: "village", x: e.c.x, y: e.c.y },
      label: "到场取木料",
      score: 100,
      task: null,
      facility: null,
    });
    const a = e.n.action!;
    a.xiaobao = { wish: "deliver", partner: null, material: "wood" };
    a.duration = 100;
    a.phase = "perform";
    const stock = e.s.life.stores.wood;
    expect(() => validate(e.s)).not.toThrow();
    stepXiaobaoLife(e.life, 50);
    expect(e.s.life.stores.wood).toBe(stock);
    stepXiaobaoLife(e.life, 50);
    expect(e.s.life.stores.wood).toBe(stock - 1);
    expect(e.n.supplies.wood).toBe(1);
    e.life.complete(e.n, a);
    expect(e.s.life.stores.wood).toBe(stock - 1);
    expect(e.n.supplies.wood).toBe(1);
    expect(
      validate(e.s).life.people.find((n) => n.id === "xiaobao")!.supplies.wood,
    ).toBe(1);
    e.life.begin(e.n, {
      kind: "supply",
      target: { space: "village", x: e.c.x + 500, y: e.c.y },
      label: "还未到场采药",
      score: 100,
      task: null,
      facility: null,
    });
    e.n.action!.xiaobao = { wish: "deliver", partner: null };
    e.life.cancel(e.n, "途中中断");
    expect(e.s.xiaobao.life.basket).toBe(0);
  });
  it("日常长途不会接入更近的荒野路点，沿保护区实际到工坊取料", () => {
    const e = lifeFixture();
    Object.assign(e.s.xiaobao, { space: "village", x: 310, y: 900 });
    e.c.bind(e.s.xiaobao, true);
    const tools = FACILITIES.find((f) => f.id === "tools")!.place;
    e.life.begin(e.n, {
      kind: "supply",
      target: { ...tools, x: tools.x + 35 },
      label: "沿保护区取木料",
      score: 100,
      task: null,
      facility: null,
    });
    e.n.action!.xiaobao = { wish: "deliver", partner: null, material: "wood" };
    e.advance(60000);
    expect(e.n.supplies.wood).toBe(1);
    expect(
      e.s.xiaobao.life.journal.some((j) =>
        j.text.includes("沿保护区取木料，已经做到了"),
      ),
    ).toBe(true);
  });
  it("真正给遇险朋友施放护印才记录帮助，平安旁观者不获得虚构救援", () => {
    const e = lifeFixture(),
      elder = e.life.data.people.find((n) => n.id === "elder")!;
    const p = e.life.body("elder")!;
    Object.assign(e.s.xiaobao, { space: "village", x: p.x, y: p.y });
    e.c.bind(e.s.xiaobao, true);
    const env = xiaobaoEnvironment(e.w);
    env.allies = [
      {
        ...p,
        id: "elder",
        role: "resident",
        hp: 100,
        maxHP: 100,
        threatAt: 100,
      },
    ];
    const before = elder.relations.xiaobao?.trust ?? 0;
    e.c.shield(env, 96, 2500, "实际护印");
    expect((elder.relations.xiaobao?.trust ?? 0) - before).toBe(8);
    expect(e.s.xiaobao.life.journal.at(-1)?.text).toContain("保护即将受击");
    const count = e.s.xiaobao.life.journal.length;
    env.allies[0].threatAt = null;
    e.c.shield(env, 96, 2500, "平安护印");
    expect(e.s.xiaobao.life.journal).toHaveLength(count);
  });
  it("小宝有独立床位与能实际站到的个人收纳位置，不与书架或原床重叠", () => {
    const bed = FACILITIES.find((f) => f.id === "bed:xiaobao")!,
      elder = FACILITIES.find((f) => f.id === "bed:elder")!,
      box = PRIVATE_STORAGE.find((b) => b.owner === "xiaobao")!;
    expect(bed.place).not.toEqual(elder.place);
    expect(box.space).toBe("elder-home");
    expect(spaceBlocked(box.use.space, box.use.x, box.use.y)).toBe(false);
  });
  it("住所不可用时预约旅馆空床，原床与旅馆均不可用时不无限等候", () => {
    const e = lifeFixture();
    e.s.time = 1320;
    e.s.life.unavailable.homes["elder-home"] = true;
    e.life.step(2000, { queries: 0 });
    expect(e.n.action?.kind).toBe("sleep");
    expect(e.n.action?.target.space).toBe("inn");
    e.s.life.unavailable.homes.inn = true;
    stepXiaobaoLife(e.life, 100);
    expect(e.n.action).toBeNull();
    expect(e.s.life.reservations.some((r) => r.owner === "xiaobao")).toBe(
      false,
    );
    expect(e.n.reason).toContain("不可用");
  });
  it("过期同行约定在危机解除后要求重新确认", () => {
    const e = lifeFixture();
    requestXiaobaoFollow(e.s);
    expect(e.s.xiaobao.task).toBe("follow");
    e.s.defense = prepareRaid(e.s.defense, e.s.player, "east-gate", 1);
    e.d.rebind(e.s.defense);
    e.d.restore(0);
    e.advance(155);
    expect(e.s.xiaobao.task).toBe("free");
    expect(e.s.xiaobao.life.promise?.status).toBe("done");
    e.s.xiaobao.life.emergency = false;
    e.s.xiaobao.life.aftercareUntil = 0;
    e.s.time += 100;
    stepXiaobaoLife(e.life, 100);
    expect(e.s.xiaobao.task).toBe("free");
    expect(e.s.xiaobao.life.resumeTask).toBeNull();
  });
  it("室内不参与室外索敌，危机先实际出门，调息不能被当作可行动", () => {
    const e = lifeFixture(),
      bed = FACILITIES.find((f) => f.id === "bed:xiaobao")!;
    Object.assign(e.s.xiaobao, bed.place);
    e.c.bind(e.s.xiaobao, true);
    expect(e.c.available).toBe(false);
    expect(xiaobaoAllies(e.w).some((a) => a.id === "xiaobao")).toBe(false);
    const before = { x: e.c.x, y: e.c.y };
    e.s.xiaobao.life.emergency = true;
    moveXiaobaoLife(e.life, e.c, 100, { queries: 2 });
    expect(e.s.xiaobao.space).toBe("elder-home");
    expect(Math.hypot(e.c.x - before.x, e.c.y - before.y)).toBeLessThan(15);
    e.advance(15000);
    expect(e.s.xiaobao.space).toBe("village");
    e.s.xiaobao.hp = 0;
    e.s.xiaobao.rest = 30000;
    e.advance(100);
    expect(e.c.available).toBe(false);
    expect(e.s.xiaobao.rest).toBeGreaterThan(0);
  });
  it("恶意生活数据、未来日记和非法行动元数据拒绝，未知字段不落盘", () => {
    for (const change of [
      (s: any) => (s.xiaobao.life.seed = -1),
      (s: any) => (s.xiaobao.life.projects.wind.stage = 9),
      (s: any) => (s.xiaobao.space = "bad-room"),
      (s: any) =>
        (s.xiaobao.life.journal = Array(40).fill({
          sequence: 0,
          time: 0,
          text: "坏",
        })),
    ]) {
      const s = initialState();
      change(s);
      expect(() => validate(s)).toThrow();
    }
    const s: any = initialState();
    s.xiaobao.life.extra = "不应保存";
    expect((validate(s).xiaobao.life as any).extra).toBeUndefined();
    s.xiaobao.life.journal = [
      { sequence: 1, time: s.time + 1, text: "未来经历" },
    ];
    expect(() => validate(s)).toThrow();
  });
  it.skipIf(process.env.XIAOBAO_SKIP_SEEDS === "1")(
    "二十个固定种子各运行五个游戏日，记录真实完成与退出原因",
    () => {
      const rows = [];
      for (let seed = 1; seed <= 20; seed++) {
        const e = lifeFixture(seed),
          started = performance.now();
        const failures: string[] = [],
          cancel = e.life.cancel.bind(e.life);
        e.life.cancel = (n, why) => {
          if (n.id === "xiaobao")
            failures.push(
              `${e.s.time.toFixed(1)} ${n.action?.label}：${why} (${e.c.x.toFixed(0)},${e.c.y.toFixed(0)},${e.s.xiaobao.space}) 目标 ${JSON.stringify(n.action?.target)}`,
            );
          cancel(n, why);
        };
        e.advance(4800000, 500);
        const metrics = e.s.xiaobao.life.metrics,
          settled = metrics.completed + metrics.failed;
        rows.push({
          种子: seed,
          游戏日: 5,
          完成率: metrics.completed / settled,
          统计: metrics,
          心愿: e.s.xiaobao.life.projects,
          日记: e.s.xiaobao.life.journal,
          退出原因: failures,
          关系: e.n.relations,
          耗时毫秒: performance.now() - started,
        });
        mkdirSync("docs/xiaobao-life/evidence", { recursive: true });
        writeFileSync(
          "docs/xiaobao-life/evidence/seeds.json",
          JSON.stringify(
            {
              说明: "使用正式地图、寻路、居民和小宝控制器；固定半秒模拟步长，不等同真实浏览器长测。",
              结果: rows,
            },
            null,
            2,
          ),
        );
        expect(
          e.n.action === null ||
            e.s.life.elapsed - e.n.action.started < 90000 ||
            e.n.action.kind === "sleep",
        ).toBe(true);
        expect(metrics.completed).toBeGreaterThan(0);
        expect(metrics.completed / settled).toBeGreaterThanOrEqual(0.9);
        expect(
          Object.values(e.s.xiaobao.life.projects).some((p) => p.stage === 3),
        ).toBe(true);
        expect(e.s.quest).toBe(initialState().quest);
      }
      mkdirSync("docs/xiaobao-life/evidence", { recursive: true });
      writeFileSync(
        "docs/xiaobao-life/evidence/seeds.json",
        JSON.stringify(
          {
            说明: "使用正式地图、寻路、居民和小宝控制器；固定半秒模拟步长，不等同真实浏览器长测。",
            结果: rows,
          },
          null,
          2,
        ),
      );
    },
    600000,
  );
});
