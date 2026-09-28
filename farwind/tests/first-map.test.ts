import { describe, it, expect } from "vitest";
import {
  BUILDING_LOTS,
  SERVICE_SIGNS,
  VILLAGE_ANCHORS,
  MASTER_PLAN,
  PLANNED_POIS,
} from "../src/data/maps/windbell/layout";
import { ROAD_DEFINITIONS } from "../src/data/maps/windbell/roads";
import { props, WORLD } from "../src/data/world";
import { HOMES, FACILITIES, PEOPLE } from "../src/data/npcLife";
import { motionBlocked, clearMotionLine } from "../src/game/systems/obstacles";
import { groundChunks } from "../src/game/systems/terrainChunks";
import { initialState, parseSave } from "../src/game/systems/state";
import { SAVE_DATABASE } from "../src/game/systems/save";

describe("第一张地图村庄归位与地面资源边界", () => {
  it("地图与蓝图身份唯一，兴趣点落在对应区域且特殊挑战计入总量", () => {
    for (const list of [props, BUILDING_LOTS, ROAD_DEFINITIONS, PLANNED_POIS])
      expect(new Set(list.map((p) => p.id)).size).toBe(list.length);
    for (const region of MASTER_PLAN.regions) {
      const pois = PLANNED_POIS.filter((p) => p.region === region.id);
      expect(pois.length).toBe(region.pois);
      for (const p of pois) {
        expect(p.x).toBeGreaterThanOrEqual(region.x);
        expect(p.x).toBeLessThanOrEqual(region.x + region.w);
        expect(p.y).toBeGreaterThanOrEqual(region.y);
        expect(p.y).toBeLessThanOrEqual(region.y + region.h);
      }
    }
    expect(PLANNED_POIS.filter((p) => p.kind === "camp")).toHaveLength(4);
    expect(PLANNED_POIS.filter((p) => p.kind === "elite")).toHaveLength(3);
    expect(PLANNED_POIS.filter((p) => p.kind === "boss")).toHaveLength(1);
  });
  it("建筑、居民入口、工作位与商店使用实际运行锚点", () => {
    for (const b of BUILDING_LOTS) {
      expect(
        props.find((p) => p.id === b.id),
        b.name,
      ).toMatchObject({ x: b.x, y: b.y, w: b.w, h: b.h, solid: [...b.solid] });
    }
    for (const home of HOMES)
      expect(home.door).toEqual(
        BUILDING_LOTS.find((b) => b.id === home.building)!.door,
      );
    expect(FACILITIES.find((f) => f.id === "tools")!.place).toMatchObject(
      VILLAGE_ANCHORS.carpenter,
    );
    for (const slot of PEOPLE.find(
      (p) => p.id === "carpenter",
    )!.schedule.filter((s) => s.facility === "tools"))
      expect(slot.place).toMatchObject(VILLAGE_ANCHORS.carpenter);
  });
  it("全部建筑入口、工作点和服务点均有连续的真实地面通路", () => {
    const step = 20,
      cols = Math.ceil(WORLD.width / step),
      rows = Math.ceil(WORLD.height / step);
    const start =
      Math.round(VILLAGE_ANCHORS.start.y / step) * cols +
      Math.round(VILLAGE_ANCHORS.start.x / step);
    const seen = new Set([start]),
      queue = [start];
    for (let i = 0; i < queue.length; i++) {
      const n = queue[i],
        x = (n % cols) * step,
        y = Math.floor(n / cols) * step;
      for (const [dx, dy] of [
        [step, 0],
        [-step, 0],
        [0, step],
        [0, -step],
      ]) {
        const nx = x + dx,
          ny = y + dy,
          k = Math.round(ny / step) * cols + Math.round(nx / step);
        if (
          nx < 30 ||
          nx > 2100 ||
          ny < 80 ||
          ny > WORLD.height - 30 ||
          seen.has(k) ||
          motionBlocked(nx, ny) ||
          !clearMotionLine({ x, y }, { x: nx, y: ny })
        )
          continue;
        seen.add(k);
        queue.push(k);
      }
    }
    const targets = [
      ...BUILDING_LOTS.map((b) => ({ name: b.name, ...b.door })),
      ...SERVICE_SIGNS.map((s) => ({ name: s.name, ...s.point })),
      { name: "木工工作位", ...VILLAGE_ANCHORS.carpenter },
      {name:"公共委托簿",...VILLAGE_ANCHORS.ledgerApproach},
    ];
    for (const t of targets) {
      expect(motionBlocked(t.x, t.y), `${t.name}的落脚点不可阻挡`).toBe(false);
      expect(
        queue.some((n) => {
          const p = { x: (n % cols) * step, y: Math.floor(n / cols) * step };
          return (
            Math.hypot(t.x - p.x, t.y - p.y) <= 30 && clearMotionLine(p, t)
          );
        }),
        `${t.name}必须实际连通`,
      ).toBe(true);
    }
    expect(rows).toBeGreaterThan(0);
  });
  it("店招保留服务身份但不占用门前地面，开发预留牌已撤下", () => {
    for (const sign of SERVICE_SIGNS) {
      const p = props.find((p) => p.id === sign.id)!;
      expect(p.kind).toBe("sign");
      expect(p.solid).toBeUndefined();
      expect(p.displayAt).toBeDefined();
      expect(p.y).not.toBe(p.displayAt!.y);
      for (const tree of props.filter(
        (t) => t.art === "tree" || t.art === "pink",
      )) {
        const covered =
          tree.y >= p.y &&
          Math.abs(tree.x - p.x) < tree.w / 2 + 12 &&
          tree.y - tree.h < p.y &&
          tree.y > p.y - 75;
        expect(covered, `${p.label}的交互位不应藏在${tree.id}树冠后`).toBe(
          false,
        );
      }
    }
    expect(
      props.filter((p) => p.id.startsWith("parcel-") && p.kind === "sign"),
    ).toEqual([]);
    expect(props.find((p) => p.id === "training-guide")!.art).toBe(
      "training-book",
    );
  });
  it("区块选择覆盖视窗，移动后远处块可淘汰，预算与全图面积无关", () => {
    const first = groundChunks(
      { left: 2110, top: 1380, right: 3390, bottom: 2100 },
      6400,
      4800,
    );
    const second = groundChunks(
      { left: 4700, top: 3300, right: 5980, bottom: 4020 },
      6400,
      4800,
    );
    expect(first.length).toBeLessThanOrEqual(25);
    expect(second.length).toBeLessThanOrEqual(25);
    expect(second.some((b) => first.some((a) => a.key === b.key))).toBe(false);
    for (let y = 1380; y < 2100; y += 50)
      for (let x = 2110; x < 3390; x += 50)
        expect(
          first.some(
            (c) => x >= c.x && x < c.x + 600 && y >= c.y && y < c.y + 550,
          ),
        ).toBe(true);
    expect(new Set(first.map((c) => c.key)).size).toBe(first.length);
  });
  it("四个地图边缘不会产生越界地面块", () => {
    for (const [x, y] of [
      [0, 0],
      [6400, 0],
      [0, 4800],
      [6400, 4800],
    ])
      for (const c of groundChunks(
        { left: x - 640, top: y - 360, right: x + 640, bottom: y + 360 },
        6400,
        4800,
      )) {
        expect(c.x).toBeGreaterThanOrEqual(0);
        expect(c.y).toBeGreaterThanOrEqual(0);
        expect(c.x).toBeLessThan(6400);
        expect(c.y).toBeLessThan(4800);
      }
  });
  it("新地图独立保存并能往返，旧地图导入明确拒绝而不修改输入", () => {
    const s = initialState(),
      text = JSON.stringify(s);
    expect(parseSave(text)).toEqual(s);
    expect(SAVE_DATABASE).not.toBe("farwind-save");
    const legacy = { ...s, map_version: 6 };
    expect(() => parseSave(JSON.stringify(legacy))).toThrow("旧地图");
    expect(legacy.map_version).toBe(6);
    expect(MASTER_PLAN.regions.reduce((n, r) => n + r.pois, 0)).toBe(24);
    expect(MASTER_PLAN.regions.reduce((n, r) => n + r.encounters, 0)).toBe(32);
  });
});
