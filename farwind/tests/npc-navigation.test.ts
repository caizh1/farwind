import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { HOMES, GUARD_LANDINGS, type Place } from "../src/data/npcLife";
import { lifeNavigation, moveLife } from "../src/game/systems/npcNavigation";
import { pathSearch, localPath } from "../src/game/systems/enemy";
import { LIFE } from "../src/data/npcLife";

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
        expect(nav.search, name).toBeNull();
        expect(nav.maxExpanded).toBeLessThanOrEqual(LIFE.pathNodesPerBatch);
        samples.push({
          路线: name,
          轮次: run + 1,
          批次: times.length,
          查询: nav.queries,
          总规划毫秒: times.reduce((a, b) => a + b, 0),
          最大批次毫秒: Math.max(...times),
          最多展开节点: nav.maxExpanded,
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
  it("分步搜索与原局部搜索结果相同，每批节点数有界", () => {
    let checks = 0;
    const query = {
        blocked: (x: number, y: number) => x === 40 && Math.abs(y) < 120,
        clear: () => true,
      },
      start = { x: 0, y: 0 },
      target = { x: 100, y: 0 },
      goal = (p: { x: number; y: number }) => {
        checks++;
        return p.x === target.x && p.y === target.y;
      };
    const expected = localPath(start, goal, target, () => true, query),
      search = pathSearch(start, goal, target, () => true, query);
    let result = search.next();
    while (!result.done) {
      const before = checks;
      for (let i = 0; i < LIFE.pathNodesPerBatch && !result.done; i++)
        result = search.next();
      expect(checks - before).toBeLessThanOrEqual(LIFE.pathNodesPerBatch);
    }
    expect(result.value).toEqual(expected);
    expect(expected.path).not.toBeNull();
  });
  it("待规划时不移动、不凭空撞墙，预算为零不展开，换目标释放搜索", () => {
    const body = { ...GUARD_LANDINGS["north-archer"]! },
      nav = lifeNavigation(),
      target = {
        space: "village" as const,
        ...HOMES.find((h) => h.id === "barracks")!.door,
      },
      before = { ...body };
    moveLife(body, target, 16, 0, { queries: 1 }, nav);
    expect(nav.search).not.toBeNull();
    expect(body).toEqual(before);
    const batches = nav.batches;
    moveLife(body, target, 16, 16, { queries: 0 }, nav);
    expect(nav.batches).toBe(batches);
    expect(nav.stuck).toBe(0);
    moveLife(body, { ...body, y: body.y + 20 }, 16, 32, { queries: 1 }, nav);
    expect(nav.search).toBeNull();
    expect(
      Math.hypot(body.x - before.x, body.y - before.y),
    ).toBeLessThanOrEqual(LIFE.speed * 0.016 + 0.001);
  });
});
