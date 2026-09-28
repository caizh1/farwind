import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { initialState, validate } from "../src/game/systems/state";
import { prepareRaid } from "../src/game/systems/defense";
import { RAID_GATES } from "../src/data/defense";
import { motionBlocked, clearMeleeLine } from "../src/game/systems/obstacles";

const root = "docs/xiaobao/evidence/flight-gates";
const cases = [
  ...RAID_GATES.map((gate) => ({ gate, far: false })),
  { gate: RAID_GATES.find((gate) => gate.id === "north-gate")!, far: true },
];
for (const scenario of cases) {
  test(`${scenario.far ? "远端室外" : "广场"}真实危急飞援至${scenario.gate.name}：正式攻击、连续航程与唯一合法落印`, async ({
    page,
  }) => {
    mkdirSync(root, { recursive: true });
    const state = initialState(),
      gate = scenario.gate;
    state.time = 540;
    state.defense = prepareRaid(state.defense, state.player, gate.id, 1);
    const length = Math.hypot(
      gate.inside.x - gate.entry.x,
      gate.inside.y - gate.entry.y,
    );
    const inward = {
      x: (gate.inside.x - gate.entry.x) / length,
      y: (gate.inside.y - gate.entry.y) / length,
    };
    const pair = [20, 30, 40]
      .map((offset) => {
        const enemy = {
          x: gate.inside.x + inward.x * offset,
          y: gate.inside.y + inward.y * offset,
        };
        const resident = {
          x: enemy.x + inward.x * 35,
          y: enemy.y + inward.y * 35,
        };
        return { enemy, resident };
      })
      .find(
        ({ enemy, resident }) =>
          !motionBlocked(enemy.x, enemy.y) &&
          !motionBlocked(resident.x, resident.y) &&
          clearMeleeLine(enemy, resident),
      );
    expect(pair, "历史站位必须真实合法").toBeTruthy();
    Object.assign(state.defense.raid!.members[0], pair!.enemy);
    for (const guard of state.defense.guards.filter((guard) =>
      guard.id.startsWith(gate.id.split("-")[0] + "-"),
    ))
      Object.assign(guard, { hp: 0, dead: true, mode: "dead" });
    Object.assign(state.life.people[0].body!, pair!.resident, {
      space: "village",
      hp: 100,
      health: "healthy",
    });
    const origin = scenario.far
      ? [
          { x: 3900, y: 2040 },
          { x: 3750, y: 2040 },
          { x: 3800, y: 1960 },
        ].find((point) => !motionBlocked(point.x, point.y))!
      : { x: 810, y: 725 };
    expect(origin).toBeTruthy();
    Object.assign(state.xiaobao, origin, { task: "guard" });
    const valid = validate(state),
      key = gate.id + (scenario.far ? "-far" : "-plaza");
    writeFileSync(
      root + "/" + key + "-save.json",
      JSON.stringify(valid, null, 2) + "\n",
    );
    await page.goto("/");
    page.once("dialog", (dialog) => dialog.accept());
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "导入存档", exact: true }).click();
    const started = Date.now();
    await (
      await chooser
    ).setFiles({
      name: key + "-save.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(valid)),
    });
    await page.waitForFunction(
      () => (window as any).__farwind().xiaobao?.airborne,
      null,
      { polling: 5, timeout: 15000 },
    );
    const airborne = await page.evaluate(() => (window as any).__farwind()),
      departureWall = Date.now() - started;
    expect(airborne.state.xiaobao.flight.gate).toBe(gate.id);
    expect(airborne.xiaobao.metrics.flights).toBe(1);
    await page.waitForFunction(
      () =>
        (window as any)
          .__farwind()
          .xiaobao.events.some((event: any) => event.kind === "landing"),
      null,
      { polling: 5, timeout: 10000 },
    );
    const landed = await page.evaluate(() => (window as any).__farwind()),
      arrivalWall = Date.now() - started;
    const departure = landed.xiaobao.events.find(
        (event: any) => event.kind === "flight",
      ),
      landing = landed.xiaobao.events.find(
        (event: any) => event.kind === "landing",
      );
    expect(
      landed.xiaobao.events.filter((event: any) => event.kind === "landing"),
    ).toHaveLength(1);
    expect(landed.state.xiaobao.task).toBe("guard");
    expect(motionBlocked(landed.state.xiaobao.x, landed.state.xiaobao.y)).toBe(
      false,
    );
    expect(landed.state.xiaobao.cooldowns.flight).toBeGreaterThan(26000);
    expect(landing.at - departure.at).toBeLessThan(scenario.far ? 3600 : 2000);
    expect(
      landed.xiaobao.events.filter((event: any) => event.kind === "shield")
        .length,
    ).toBeGreaterThan(0);
    await page.screenshot({ path: root + "/" + key + ".png" });
    writeFileSync(
      root + "/" + key + ".json",
      JSON.stringify(
        {
          结果: "通过",
          说明: "正式历史来袭与既有门卫死亡为起始前提；健康居民正常被真实敌人选中攻击后，正式前线检测、保存、飞援和落印均由游戏推进。无运行时写状态或直接调用技能。离地至落地不包含警报确认和起飞200毫秒；墙钟另含文件导入与加载，不伪称精确报警耗时。",
          原点: origin,
          门: gate.id,
          离地至落地有效毫秒: landing.at - departure.at,
          加起飞有效毫秒: landing.at - departure.at + 200,
          导入至离地墙钟毫秒: departureWall,
          导入至落地墙钟毫秒: arrivalWall,
          起飞: airborne.xiaobao,
          落地: landed.xiaobao,
        },
        null,
        2,
      ) + "\n",
    );
  });
}
