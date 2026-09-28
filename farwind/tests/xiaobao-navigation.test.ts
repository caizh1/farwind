import { it, expect } from "vitest";
import { motionBlocked } from "../src/game/systems/obstacles";
import { mkdirSync, writeFileSync } from "node:fs";
import { XIAOBAO_ROADS } from "../src/data/xiaobaoCombat";
import {
  XiaobaoCombat, xiaobaoGatePoint,
  type XiaobaoEnvironment,
} from "../src/game/systems/xiaobaoCombat";
import { initialDefense } from "../src/game/systems/defenseState";
import { EastDefense } from "../src/game/systems/defense";
import { RAID_GATES } from "../src/data/defense";
import { zoneFor } from "../src/data/defenseZones";
it("地面长途路点必须是当前地图合法空地", () => {
  const points = [...XIAOBAO_ROADS.nodes, ...XIAOBAO_ROADS.patrol];
  mkdirSync("docs/xiaobao/evidence/integration", { recursive: true });
  const report = points.map(({ x, y }) => ({
    x,
    y,
    阻挡: motionBlocked(x, y),
  }));
  writeFileSync(
    "docs/xiaobao/evidence/integration/navigation-candidates.json",
    JSON.stringify({ 说明: "绕开池塘的候选路点检查", 路点: report }, null, 2) +
      "\n",
  );
  expect(report.filter((p) => p.阻挡)).toEqual([]);
});
it("指定三门驻防真实地面路径可达，途中没有穿水或瞬移", () => {
  const records: any[] = [];
  for (const gate of RAID_GATES) {
    const c = new XiaobaoCombat(),
      d = new EastDefense(initialDefense(), 0);
    c.data.task = "guard";
    c.data.gate = gate.id;
    const env: XiaobaoEnvironment = {
      now: 0,
      minute: 480,
      player: { x: 740, y: 780, hp: 100, outside: true, region: "village" },
      enemies: [],
      allies: [],
      fronts: () => [],
      recent: null,
      move: (...args) => d.move(...args),
      hit: () => ({ applied: false, killed: false, damage: 0 }),
      message: () => {},
    };
    let time = 0,
      previous = { x: c.x, y: c.y };
    while (
      time < 120000 &&
      Math.hypot(
        c.x - xiaobaoGatePoint(gate.id).x,
        c.y - xiaobaoGatePoint(gate.id).y,
      ) > 15
    ) {
      time += 20;
      env.now = d.now = time;
      c.tick(20, env, { queries: 2 });
      expect(motionBlocked(c.x, c.y)).toBe(false);
      expect(
        Math.hypot(c.x - previous.x, c.y - previous.y),
      ).toBeLessThanOrEqual(3.401);
      previous = { x: c.x, y: c.y };
    }
    records.push({
      门: gate.id,
      耗时毫秒: time,
      终点: previous,
      状态: c.status,
      寻路: c.snapshot().navigation,
    });
    writeFileSync(
      "docs/xiaobao/evidence/integration/navigation-progress.json",
      JSON.stringify({ 说明: "实际地面路径首因诊断", 记录: records }, null, 2) +
        "\n",
    );
    expect(time, gate.name).toBeLessThan(120000);
  }
  writeFileSync(
    "docs/xiaobao/evidence/integration/navigation.json",
    JSON.stringify(
      {
        结果: "通过",
        说明: "正式碰撞和共用寻路，20毫秒步长、每帧两次总查询预算，无状态注入或瞬移。",
        记录: records,
      },
      null,
      2,
    ) + "\n",
  );
}, 120000);
