import { describe, expect, it } from "vitest";
import { attackTouches } from "../src/game/systems/enemyAttack";
import {
  VILLAGE_BOUNDS,
  VILLAGE_PORTALS,
  VILLAGE_WALLS,
  GATE_POST_OFFSET,
  portalAnchor,
  regionAt,
  inPolygon,
  villageClearance,
  DEFENSE_LAYOUT,
} from "../src/data/village";
import {
  props,
  WORLD,
  region,
  canDecorate,
  inVillageDecorArea,
  type Prop,
} from "../src/data/world";
import {
  motionBlocked,
  clearMotionLine,
  shotLineBlocker,
} from "../src/game/systems/obstacles";
import { initialState, validate } from "../src/game/systems/state";
import {
  localPath,
  updateEnemy,
  enemyNavigation,
  NAV,
  type EnemyBody,
} from "../src/game/systems/enemy";
describe("围合、合法出口、区域与查询分层", () => {
  it("整圈边界逐点直穿与斜穿只在三个门洞开放；西门和四角不能穿过", () => {
    const { left, right, top, bottom } = VILLAGE_BOUNDS;
    for (const [axis, fixed, start, end] of [
      ["x", left, top, bottom],
      ["x", right, top, bottom],
      ["y", top, left, right],
      ["y", bottom, left, right],
    ] as const) {
      for (let n = start; n <= end; n += 4) {
        const point = axis === "x" ? { x: fixed, y: n } : { x: n, y: fixed };
        const passage = VILLAGE_PORTALS.some(
          (p) =>
            p.open &&
            p.axis === axis &&
            (axis === "x" ? p.x : p.y) === fixed &&
            Math.abs((axis === "x" ? p.y : p.x) - n) <=
              GATE_POST_OFFSET - (axis === "x" ? 23 : 31),
        );
        const a = {
          x: point.x - (axis === "x" ? 60 : 0),
          y: point.y - (axis === "y" ? 60 : 0),
        };
        const b = {
          x: point.x + (axis === "x" ? 60 : 0),
          y: point.y + (axis === "y" ? 60 : 0),
        };
        expect(clearMotionLine(a, b), `边界 ${fixed},${n}`).toBe(passage);
        if (!passage)
          expect(
            clearMotionLine({ ...a, y: a.y - 20 }, { ...b, y: b.y + 20 }),
          ).toBe(false);
      }
    }
    for (const p of [
      { x: left, y: top },
      { x: right, y: top },
      { x: left, y: bottom },
      { x: right, y: bottom },
    ]) {
      expect(
        clearMotionLine(
          { x: p.x - 100, y: p.y - 100 },
          { x: p.x + 100, y: p.y + 100 },
        ),
      ).toBe(false);
      expect(
        clearMotionLine(
          { x: p.x - 100, y: p.y + 100 },
          { x: p.x + 100, y: p.y - 100 },
        ),
      ).toBe(false);
    }
    expect(VILLAGE_PORTALS.filter((p) => p.open)).toHaveLength(3);
    expect(VILLAGE_WALLS).toHaveLength(7);
  });
  it("门柱独立阻挡，门洞与偏移40位置双向通行；西侧封闭", () => {
    for (const gate of VILLAGE_PORTALS) {
      for (const offset of [-40, 0, 40]) {
        const a = portalAnchor(gate, false),
          b = portalAnchor(gate, true);
        if (gate.axis === "x") {
          a.y += offset;
          b.y += offset;
        } else {
          a.x += offset;
          b.x += offset;
        }
        expect(clearMotionLine(a, b), gate.id).toBe(gate.open);
        expect(clearMotionLine(b, a)).toBe(gate.open);
      }
      for (const side of [0, 1]) {
        const post = props.find((p) => p.id === `${gate.id}-post-${side}`)!;
        expect(motionBlocked(post.x, post.y - 13)).toBe(true);
      }
    }
  });
  it("相同横坐标按多边形分辨村内、北山路、南荒野和出口邻接", () => {
    expect(region(900, 720)).toBe("风铃村");
    expect(region(900, 120)).toBe("北部山路");
    expect(region(900, 2000)).toBe("南部荒野");
    expect(regionAt({ x: 2170, y: 1080 }).id).toBe("forest");
    expect(
      inPolygon({ x: 0, y: 1 }, [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 1, y: 2 },
      ]),
    ).toBe(false);
    for (const p of VILLAGE_PORTALS.filter((p) => p.open)) {
      expect(regionAt(portalAnchor(p, false)).id).toBe("village");
      expect(regionAt(portalAnchor(p, true)).id).toBe(p.outsideRegion);
    }
  });
  it("门口路线、六个规划岗位可站立，正式局部寻路能跨门", () => {
    for (const d of DEFENSE_LAYOUT) {
      for (const p of d.posts)
        expect(motionBlocked(p.x, p.y), `${d.portalId} 岗位`).toBe(false);
      for (const dx of [-40, 0, 40]) for (const dy of [-40, 0])
        expect(motionBlocked(d.tower.x + dx, d.tower.y + dy), `${d.portalId} 规划塔基地面`).toBe(false);
      for (let i = 1; i < d.route.length; i++)
        expect(clearMotionLine(d.route[i - 1], d.route[i])).toBe(true);
      const a = d.route[0],
        b = d.route.at(-1)!;
      const path = localPath(
        a,
        (p) => Math.hypot(p.x - b.x, p.y - b.y) < 8,
        b,
        (p) => Math.hypot(p.x - a.x, p.y - a.y) < 480,
      );
      expect(path.path, d.portalId).not.toBeNull();
      expect(path.visited).toBeLessThanOrEqual(NAV.nodes);
    }
  });
  it("高处射击只豁免指定己方低墙，不豁免高墙，也不把水面当身体障碍", () => {
    const low: Prop = {
      id: "test-low",
      art: "fence",
      x: 1000,
      y: 1000,
      w: 40,
      h: 40,
      solid: [40, 40],
      cover: "low",
      owner: "village",
    };
    const high: Prop = { ...low, id: "test-roof", x: 1060, cover: "high" },
      a = { x: 950, y: 980 },
      b = { x: 1100, y: 980 };
    expect(shotLineBlocker(a, b, undefined, [low])).toBe(low.id);
    expect(
      shotLineBlocker(a, b, { origin: a, lowCoverIds: [low.id] }, [low]),
    ).toBeUndefined();
    expect(
      shotLineBlocker(a, b, { origin: a, lowCoverIds: [low.id, high.id] }, [
        low,
        high,
      ]),
    ).toBe(high.id);
    expect(
      shotLineBlocker(
        a,
        b,
        { origin: { x: 900, y: 980 }, lowCoverIds: [low.id] },
        [low],
      ),
    ).toBe(low.id);
    expect(
      shotLineBlocker(a, b, { origin: a, lowCoverIds: [low.id] }, [
        { ...low, owner: undefined },
      ]),
    ).toBe(low.id);
    expect(clearMotionLine({ x: 1200, y: 1100 }, { x: 1400, y: 1100 })).toBe(
      false,
    );
    expect(
      shotLineBlocker({ x: 1200, y: 1100 }, { x: 1400, y: 1100 }),
    ).toBeUndefined();
  });
  it("村门、村墙与规划岗位不接受生成装饰", () => {
    for (const p of VILLAGE_PORTALS)
      expect(villageClearance(p.x, p.y, 12)).toBe(false);
    for (const { a, b } of VILLAGE_WALLS)
      expect(villageClearance((a.x + b.x) / 2, (a.y + b.y) / 2, 12)).toBe(
        false,
      );
    for (const d of DEFENSE_LAYOUT)
      for (const p of [...d.posts, d.tower])
        expect(villageClearance(p.x, p.y, 12)).toBe(false);
  });
});
it("新村界与缓冲区的生成灌木全部遵守正式装饰排除规则", () => {
  for (const p of props.filter(
    (p) => p.id.startsWith("bush-") && inVillageDecorArea(p.x, p.y),
  ))
    expect(canDecorate(p.x, p.y, p.w / 2), p.id).toBe(true);
  for (const id of ["bush-16", "bush-24", "bush-40"])
    expect(props.find((p) => p.id === id)).toBeUndefined();
});
describe("版本迁移与正式敌人预算", () => {
  it("旧地图加600仅一次；版本2仅升级版本；世界、任务背包不丢", () => {
    const old = initialState();
    delete old.map_version;
    old.player.x = 2300;
    old.killed = ["leaf-1"];
    old.pendingDrops = [
      { enemyId: "leaf-1", item: "crystal", x: 2320, y: 1070 },
    ];
    const moved = validate(old);
    expect(moved.map_version).toBe(3);
    expect(moved.player.x).toBe(2900);
    expect(moved.pendingDrops[0].x).toBe(2920);
    expect(validate(moved)).toEqual(moved);
    const v2 = { ...initialState(), map_version: 2 as const };
    v2.quest = 3;
    v2.crafted = true;
    v2.player.x = 2450;
    const next = validate(v2);
    expect(next.player).toEqual(v2.player);
    expect(next.quest).toBe(3);
    expect(next.bag).toEqual(v2.bag);
    expect(v2.map_version).toBe(2);
    expect(() => validate({ ...next, map_version: 4 })).toThrow();
    expect(WORLD).toEqual({
      width: 4200,
      height: 2200,
      forest: 2050,
      ruins: 3300,
    });
  });
  it("低横坐标也可受真实攻击；导航预算耗尽等待下一帧而非穿墙", () => {
    const enemy = (): EnemyBody => ({
      id: "fixture-enemy",
      type: "slime",
      x: 900,
      y: 1950,
      homeX: 900,
      homeY: 1950,
      hp: 100,
      cool: 0,
      windup: 0,
      staggerUntil: 0,
      nav: enemyNavigation(),
      ai: "",
      disabled: false,
      recovered: false,
    });
    const e = enemy(),
      p = { x: 900, y: 2000 };
    updateEnemy(e, p, 1000, 20);
    expect(e.windup).toBeGreaterThan(0);
    const contact = updateEnemy(e, p, 1700, 800);
    expect(contact?.attack.attackerId).toBe(e.id);
    expect(contact && attackTouches(contact, p)).toBe(true);
    const protectedBody = enemy();
    protectedBody.y = protectedBody.homeY = 1700;
    expect(
      updateEnemy(protectedBody, { x: 900, y: 1750 }, 1000, 20),
    ).toBeNull();
    expect(protectedBody.windup).toBe(0);
    expect(protectedBody.rejection).toBe("家园追击边界");
    const body = enemy();
    body.x = 2050;
    body.y = 1400;
    body.homeX = 2050;
    body.homeY = 1400;
    const budget = { queries: 0 };
    updateEnemy(body, { x: 2200, y: 1400 }, 2000, 20, budget);
    expect(body.nav.queries).toBe(0);
    expect(body.ai).toBe("等待查询");
    budget.queries = 1;
    updateEnemy(body, { x: 2200, y: 1400 }, 2100, 20, budget);
    expect(body.nav.queries).toBe(1);
    expect(budget.queries).toBe(0);
  });
});
