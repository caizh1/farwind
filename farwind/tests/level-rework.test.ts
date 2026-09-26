import { describe, expect, it } from "vitest";
import {
  BRIDGES,
  canDecorate,
  props,
  roads,
  shoreFlowers,
  showLayoutLabels,
  VILLAGE_GATE,
} from "../src/data/world";
import {
  clearMotionLine,
  motionBlocked,
  propLineBlocker,
} from "../src/game/systems/obstacles";
import { FIELD_TARGETS, TRAINING } from "../src/game/systems/training";

describe("局部返修的实际通行与装饰保留空间", () => {
  it("两柱脚分别阻挡，门洞双向连续可走，横梁不参与碰撞", () => {
    const gate = props.find((p) => p.id === "village-gate")!;
    expect(gate.solid).toBeUndefined();
    for (const side of ["west", "east"]) {
      const p = props.find((p) => p.id === `village-gate-post-${side}`)!;
      const a = { x: p.x, y: p.y - 60 },
        b = { x: p.x, y: p.y + 50 };
      expect(motionBlocked(p.x, p.y - 10)).toBe(true);
      expect(propLineBlocker(a, b, "motion")).toBe(p.id);
      expect(clearMotionLine(a, b)).toBe(false);
    }
    for (const offset of [-40, 0, 40]) {
      const a = { x: VILLAGE_GATE.x + offset, y: 920 },
        b = { x: a.x, y: 1110 };
      expect(clearMotionLine(a, b)).toBe(true);
      expect(clearMotionLine(b, a)).toBe(true);
    }
  });
  it("短支路、练习净空和北岸主路连续可走，靶数量与稳定编号保留", () => {
    for (const [a, b] of [
      [
        { x: 1110, y: 750 },
        { x: 1110, y: 450 },
      ],
      [
        { x: 1640, y: 860 },
        { x: 1640, y: 560 },
      ],
      [
        { x: 1120, y: 750 },
        { x: 1390, y: 860 },
      ],
      [
        { x: 1390, y: 860 },
        { x: 1600, y: 860 },
      ],
      [
        { x: 1760, y: 900 },
        { x: 1870, y: 920 },
      ],
    ])
      expect(clearMotionLine(a, b)).toBe(true);
    expect(clearMotionLine({ x: 960, y: 650 }, { x: 960, y: 620 })).toBe(true);
    expect(clearMotionLine({ x: 960, y: 620 }, { x: 850, y: 620 })).toBe(true);
    expect(
      props.filter((p) => p.art === "training-base").map((p) => p.id),
    ).toEqual([TRAINING.id, ...FIELD_TARGETS.map((t) => t.id)]);
    for (const t of FIELD_TARGETS)
      for (const [dx, dy] of [
        [70, 0],
        [-70, 0],
        [0, 70],
        [0, -80],
      ])
        expect(motionBlocked(t.x + dx, t.y + dy)).toBe(false);
  });
  it("正常模式无工程标号，开发模式也必须显式开启", () => {
    expect(showLayoutLabels(false, "?layoutDebug=1")).toBe(false);
    expect(showLayoutLabels(true, "")).toBe(false);
    expect(showLayoutLabels(true, "?layoutDebug=0")).toBe(false);
    expect(showLayoutLabels(true, "?layoutDebug=1")).toBe(true);
  });
  it("两个真实路牌有站位和无遮挡交互视线，不埋入结构树篱", () => {
    for (const [id, stand] of [
      ["training-guide", { x: 1680, y: 700 }],
      ["village-guide", { x: 1950, y: 1210 }],
    ] as const) {
      const p = props.find((p) => p.id === id)!;
      expect(motionBlocked(stand.x, stand.y)).toBe(false);
      expect(clearMotionLine(stand, p, id)).toBe(true);
    }
  });
  it("生成花簇不占道路、桥面、门洞、NPC或练习空间", () => {
    expect(shoreFlowers.length).toBeGreaterThan(0);
    for (const p of shoreFlowers) expect(canDecorate(p.x, p.y, 12)).toBe(true);
    for (const path of roads)
      for (let i = 1; i < path.length; i++)
        expect(
          canDecorate(
            (path[i - 1][0] + path[i][0]) / 2,
            (path[i - 1][1] + path[i][1]) / 2,
          ),
        ).toBe(false);
    for (const b of BRIDGES)
      expect(canDecorate(b.x + b.w / 2, b.y + b.h / 2)).toBe(false);
    for (const p of [
      ...props.filter((p) => p.kind === "npc"),
      TRAINING,
      ...FIELD_TARGETS,
    ])
      expect(canDecorate(p.x, p.y)).toBe(false);
    expect(canDecorate(VILLAGE_GATE.x, VILLAGE_GATE.y)).toBe(false);
  });
});
