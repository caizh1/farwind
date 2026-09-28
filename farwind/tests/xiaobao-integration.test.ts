import { it, expect } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { initialState, validate } from "../src/game/systems/state";
import { EastDefense } from "../src/game/systems/defense";
import { NpcLife } from "../src/game/systems/npcLife";
import { XiaobaoCombat } from "../src/game/systems/xiaobaoCombat";
import { xiaobaoEnvironment } from "../src/game/systems/xiaobaoWorld";
import { resolveDamage } from "../src/game/systems/damage";
import {
  advanceNight,
  makeNightPlan,
  mayStartNight,
  nightWarningSnapshot,
} from "../src/game/systems/nightDirector";
import { advanceTime, dayNumber } from "../src/game/systems/worldClock";
import { GUARD_DEFS, RAID_GATES, RAID_TIMING } from "../src/data/defense";
import type { World } from "../src/game/scenes/World";

it("正式有无小宗师对照：居民生活与正常夜间导演共同运行30场，三门各10场，无补血或强刷", () => {
  const companionEnabled = process.env.XIAOBAO_BASELINE !== "1";
  const root = companionEnabled
    ? "docs/xiaobao/evidence/integration"
    : "docs/xiaobao/evidence/integration-baseline";
  mkdirSync(root, { recursive: true });
  const s = initialState(),
    before = structuredClone(s),
    d = new EastDefense(s.defense, 0),
    life = new NpcLife(s, d),
    c = new XiaobaoCombat();
  s.xiaobao.task = "guard";
  c.bind(s.xiaobao, true);
  const records: any[] = [],
    seeds: any[] = [],
    hits: any[] = [],
    messages: string[] = [];
  let chosenNight = 0;
  const guardHits: { id: string; damage: number; time: number }[] = [],
    residentInjuries: any[] = [];
  let lastLifeSequence = s.life.sequence;
  const w = {
    state: s,
    enemies: [],
    defense: d,
    xiaobao: { controller: c },
    sim: 0,
    xiaobaoRecent: null,
    xiaobaoUnderRoof: () => false,
    checkpointXiaobaoFlight: (id: string) => {
      try {
        validate(s);
      } catch (e) {
        writeFileSync(
          root + "/flight-checkpoint-failure.json",
          JSON.stringify(
            {
              说明: "起飞同步保存首因",
              错误: (e as Error).message,
              完成场次: records.length,
              小宝: c.snapshot(),
              状态: s,
            },
            null,
            2,
          ) + "\n",
        );
        throw e;
      }
      c.confirmFlight(id);
    },
    ui: { message: (text: string) => messages.push(text) },
    xiaobaoHit: (e: any, event: any, released: any) => {
      const hp = e.hp,
        applied = d.damageEnemy(e, event, released);
      if (applied)
        hits.push({
          事件: event.eventId,
          目标: e.id,
          伤害: hp - e.hp,
          时间: d.now,
        });
      return { applied, killed: applied && e.hp === 0, damage: hp - e.hp };
    },
  } as unknown as World;
  d.protection = (id) => (companionEnabled ? c.protection(id) : {});
  d.companionTarget = () =>
    companionEnabled && c.available
      ? { id: "xiaobao", x: c.x, y: c.y, hp: c.data.hp, health: "healthy" }
      : undefined;
  d.companionContact = (e, contact) =>
    c.receive(
      contact,
      e,
      (event) =>
        resolveDamage(
          event,
          { id: e.id, hp: e.hp, faction: "hostile", armor: 0 },
          {
            id: "xiaobao",
            hp: c.data.hp,
            faction: "village",
            armor: 12,
            ...c.protection("xiaobao"),
          },
        ),
      w.sim,
    );
  const seedFor = (night: number, gate: number, count: number) => {
    for (let seed = 1; seed < 200000; seed++) {
      const trial = { ...s, defense: { ...s.defense, seed } },
        plan = makeNightPlan(trial, night);
      if (
        plan.outcome === "pending" &&
        plan.gate === RAID_GATES[gate].id &&
        plan.count === count
      )
        return seed;
    }
    throw Error("未找到正式随机序列");
  };
  const advance = (dt: number) => {
    const previous = s.time,
      next = advanceTime(previous, dt),
      night = dayNumber(next);
    if (
      night > 1 &&
      Math.floor((previous - 1020) / 1440) < Math.floor((next - 1020) / 1440) &&
      night > chosenNight
    ) {
      const gate = records.length % 3,
        count = 1 + (Math.floor(records.length / 3) % 3),
        seed = seedFor(night, gate, count);
      s.defense.seed = seed;
      chosenNight = night;
      seeds.push({
        夜次: night,
        种子: seed,
        目标门: RAID_GATES[gate].id,
        数量: count,
      });
    }
    s.time = next;
    advanceNight(s, previous);
    const budget = { queries: 2 };
    w.sim = d.now + dt;
    if (companionEnabled) c.tick(dt, xiaobaoEnvironment(w), budget);
    d.update(w.sim, dt, s.player, budget);
    life.step(dt, budget);
    const notices = d.drainNotices();
    life.consumeDefense(notices);
    for (const notice of notices)
      if (
        notice.kind === "hit" &&
        (notice.damage ?? 0) > 0 &&
        GUARD_DEFS.some((g) => g.id === notice.id)
      )
        guardHits.push({
          id: notice.id,
          damage: notice.damage!,
          time: notice.at,
        });
    for (const event of s.life.events)
      if (
        event.sequence > lastLifeSequence &&
        !event.debug &&
        ["injury", "down"].includes(event.kind) &&
        event.subjects.some(
          (id) =>
            s.life.people.some((p) => p.id === id) &&
            !GUARD_DEFS.some((g) => g.id === id),
        )
      )
        residentInjuries.push(event);
    lastLifeSequence = s.life.sequence;
    c.drain();
    if (d.now % 10000 === 0)
      writeFileSync(
        root + "/waiting.json",
        JSON.stringify(
          {
            说明: "正式等待路径诊断",
            模拟时间: d.now,
            世界时间: s.time,
            计划: s.night.plan,
            小宝: c.snapshot(),
            卫队: d.snapshot(),
          },
          null,
          2,
        ) + "\n",
      );
    expect(s.defense.guards.every((g) => !g.dead)).toBe(true);
    if (d.critical) {
      validate(s);
      d.acknowledged(s.defense.sequence);
      d.critical = false;
    }
    if (mayStartNight(s)) {
      try {
        const n = nightWarningSnapshot(s, undefined, [], d);
        validate(n);
        Object.assign(s, n);
        d.rebind(s.defense);
        life.rebind(s, d);
        c.bind(s.xiaobao);
      } catch (e) {
        s.defense.retryMs = RAID_TIMING.retry;
      }
    }
  };
  for (let n = 0; n < 30; n++) {
    const wait = d.now;
    while (!s.defense.raid && d.now - wait < 4800000) advance(1000);
    expect(s.defense.raid, `第${n + 1}场正常调度`).not.toBeNull();
    const event = structuredClone(s.defense.raid!),
      start = d.now,
      hitStart = hits.length;
    expect(event.gateId).toBe(RAID_GATES[n % 3].id);
    expect(event.members).toHaveLength(1 + (Math.floor(n / 3) % 3));
    for (const def of GUARD_DEFS.filter((g) =>
      g.id.startsWith(event.gateId.split("-")[0]),
    ))
      expect(
        s.defense.guards.find((g) => g.id === def.id)!.hp,
      ).toBeGreaterThanOrEqual(def.maxHP * 0.8);
    while (s.defense.raid && d.now - start < 130000) advance(20);
    expect(s.defense.raid, `第${n + 1}场正式结束`).toBeNull();
    expect(c.data.task).toBe("guard");
    validate(s);
    records.push({
      场次: n + 1,
      门: event.gateId,
      数量: event.members.length,
      正式事件: event.id,
      有效战斗毫秒: d.now - start,
      小宝实际命中: hits.slice(hitStart),
      小宝位置: { x: c.x, y: c.y },
      小宝生命: c.data.hp,
      守卫生命: s.defense.guards.map((g) => ({ id: g.id, hp: g.hp })),
      累计守卫正式受击: guardHits.length,
      累计守卫生命伤害: guardHits.reduce((sum, hit) => sum + hit.damage, 0),
      累计居民正式伤情: residentInjuries.length,
      回报: c.data.reports,
    });
    writeFileSync(
      root + "/progress.json",
      JSON.stringify({ 说明: "正式30场集成进行中", 记录: records }, null, 2) +
        "\n",
    );
  }
  if (companionEnabled)
    expect(hits.length, "小宝必须实际参加正式战斗，不能仅陪跑").toBeGreaterThan(
      0,
    );
  else expect(hits.length, "无同伴基线不得出现小宝命中").toBe(0);
  expect([s.quest, s.killed, s.coins, s.bag, s.pendingDrops]).toEqual([
    before.quest,
    before.killed,
    before.coins,
    before.bag,
    before.pendingDrops,
  ]);
  writeFileSync(
    root + "/thirty-events.json",
    JSON.stringify(
      {
        结果: "通过",
        小宝参与: companionEnabled,
        说明: "正式夜间导演、健康准入、防御伤害与居民生活；确定随机种子仅控制未来黄昏计划，不调用生成函数强刷，不手工补血。纯模拟加速，不计作真实浏览器长测。",
        有效模拟总毫秒: d.now,
        门别分布: { 东门: 10, 北门: 10, 南门: 10 },
        数量分布: { 一只: 12, 两只: 9, 三只: 9 },
        小宝实际命中总数: hits.length,
        自动飞援次数: c.metrics.flights,
        守卫正式受击: guardHits,
        守卫生命伤害总数: guardHits.reduce((sum, hit) => sum + hit.damage, 0),
        居民正式伤情: residentInjuries,
        人工补血次数: 0,
        人工战斗指令次数: 0,
        随机序列: seeds,
        记录: records,
      },
      null,
      2,
    ) + "\n",
  );
}, 600000);
