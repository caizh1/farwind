import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { HOMES, GUARD_LANDINGS, type Place } from "../src/data/npcLife";
import { lifeNavigation, moveLife } from "../src/game/systems/npcNavigation";

describe("生活寻路预算", () => {
  it("记录相同真实地图路线的规划批次与耗时", () => {
    const door = (id: string): Place => ({
      space: "village",
      ...HOMES.find((h) => h.id === id)!.door,
    });
    const routes: [string, Place, Place][] = [
      ["北塔到营房", GUARD_LANDINGS["north-archer"]!, door("barracks")],
      ["南塔到营房", GUARD_LANDINGS["south-archer"]!, door("barracks")],
      ["药房到旅馆", door("healer-home"), door("inn")],
      ["长者住宅到旅馆", door("elder-home"), door("inn")],
      [
        "工坊到集结点",
        door("carpenter-home"),
        { space: "village", x: 760, y: 740 },
      ],
    ];
    const samples = [];
    for (let run = 0; run < 3; run++)
      for (const [name, start, target] of routes) {
        const body = { ...start },
          nav = lifeNavigation(),
          times: number[] = [];
        for (let batch = 0; batch < 128; batch++) {
          const started = performance.now();
          moveLife(body, target, 16, batch * 16, { queries: 1 }, nav);
          times.push(performance.now() - started);
          if (nav.nav.path.length || nav.nav.failed || !nav.queries) break;
        }
        expect(nav.nav.failed, name).toBe(false);
        samples.push({
          路线: name,
          轮次: run + 1,
          批次: times.length,
          查询: nav.queries,
          总规划毫秒: times.reduce((a, b) => a + b, 0),
          最大批次毫秒: Math.max(...times),
        });
      }
    mkdirSync("docs/npc-life/evidence", { recursive: true });
    writeFileSync(
      "docs/npc-life/evidence/navigation-performance.json",
      JSON.stringify(
        {
          说明: "固定真实地图、同一五条路线各三轮；首次缓存与后续缓存分别记录。时间为本机墙钟，不代表帧率。",
          样本: samples,
        },
        null,
        2,
      ),
    );
  });
});
