import { describe, expect, it } from "vitest";
import {
  inStrike,
  CombatController,
  attackConfig,
  facingVector,
  type Attack,
  type Target,
} from "../src/game/systems/combat";
import {
  meleeBody,
  bodyIntersectsSector,
  MELEE_HEIGHT,
} from "../src/game/systems/meleeGeometry";
import { ENEMIES } from "../src/data/enemies";
import { CAMP_BOSSES } from "../src/data/maps/windbell/campBosses";

const swing = (facing: Attack["facing"] = 3, stage = 1): Attack => ({
  id: 1,
  stage,
  facing,
  start: 0,
  hit: new Set(),
});
const boar: Target & { type: string } = {
  id: "boar",
  type: "boar",
  x: 100,
  y: 0,
  hp: 90,
};

describe("近战与可见身体相交", () => {
  it("脚底点在射程外，刀仍能碰到林豕身体近侧", () => {
    expect(inStrike({ x: 0, y: 0 }, boar, swing(), () => true)).toBe(true);
  });
  for (const type of Object.keys(ENEMIES))
    for (const facing of [0, 1, 2, 3] as const) {
      it(`${type} 朝向${facing}：四向距离边缘含擦碰，完全离开才挥空`, () => {
        const target: Target = {
          id: type,
          type,
          hp: 100,
          x: 0,
          y: 0,
          hurtboxFacing: facing,
        };
        const body = meleeBody(target)!,
          xs = body.map((p) => p.x),
          ys = body.map((p) => p.y);
        const center = {
          x: (Math.min(...xs) + Math.max(...xs)) / 2,
          y: (Math.min(...ys) + Math.max(...ys)) / 2,
        };
        const [x, y] = facingVector(facing),
          a = swing(facing),
          radius = x
            ? (Math.max(...xs) - Math.min(...xs)) / 2
            : (Math.max(...ys) - Math.min(...ys)) / 2;
        const edge = attackConfig(a).range + radius;
        const place = (d: number) => ({
          ...target,
          x: x * d - center.x,
          y: y * d - center.y - MELEE_HEIGHT,
        });
        expect(inStrike({ x: 0, y: 0 }, place(edge), a, () => true)).toBe(true);
        expect(
          inStrike({ x: 0, y: 0 }, place(edge + 0.01), a, () => true),
        ).toBe(false);
        expect(inStrike({ x: 0, y: 0 }, place(-70), a, () => true)).toBe(false);
      });
    }
  it("角度边缘的身体擦碰，不扩大整个扇形", () => {
    const a = swing(),
      target = { ...boar, x: 40, y: 88, hurtboxFacing: 3 as const };
    expect(inStrike({ x: 0, y: 0 }, target, a, () => true)).toBe(true);
    expect(inStrike({ x: 0, y: 0 }, { ...target, y: 145 }, a, () => true)).toBe(
      false,
    );
  });
  it("只碰到羽翼、镰刃或虫洞碎土时不计身体；左向按实际镜像", () => {
    for (const [type, x, y] of [
      ["raven", 47, 107],
      ["leaf", 107, 118],
      ["burrow", 44, 133],
    ] as const) {
      const body = meleeBody({ type, x: 0, y: 0 })!,
        scale = ENEMIES[type].height / 60;
      expect(
        bodyIntersectsSector(
          body,
          { x: (x - 80) * scale, y: (y - 137.5) * scale },
          { x: 1, y: 0 },
          1,
          1.12,
        ),
      ).toBe(false);
    }
    const right = meleeBody({ ...boar, x: 0, hurtboxFacing: 3 })!,
      left = meleeBody({ ...boar, x: 0, hurtboxFacing: 2 })!;
    expect(left.map((p) => p.x)).toEqual(right.map((p) => -p.x));
  });
  it("扇形穿过身体中段、圆弧擦边、包含刀根都正确，不靠顶点采样", () => {
    const origin = { x: 0, y: 0 },
      direction = { x: 1, y: 0 };
    expect(
      bodyIntersectsSector(
        [
          { x: 40, y: -100 },
          { x: 50, y: -100 },
          { x: 50, y: 100 },
          { x: 40, y: 100 },
        ],
        origin,
        direction,
        92,
        0.1,
      ),
    ).toBe(true);
    expect(
      bodyIntersectsSector(
        [
          { x: 92, y: -5 },
          { x: 99, y: -5 },
          { x: 99, y: 5 },
          { x: 92, y: 5 },
        ],
        origin,
        direction,
        92,
        0.1,
      ),
    ).toBe(true);
    expect(
      bodyIntersectsSector(
        [
          { x: 92.01, y: -5 },
          { x: 99, y: -5 },
          { x: 99, y: 5 },
          { x: 92.01, y: 5 },
        ],
        origin,
        direction,
        92,
        0.1,
      ),
    ).toBe(false);
    expect(
      bodyIntersectsSector(
        [
          { x: -100, y: -100 },
          { x: 100, y: -100 },
          { x: 100, y: 100 },
          { x: -100, y: 100 },
        ],
        origin,
        direction,
        1,
        0.1,
      ),
    ).toBe(true);
  });
  it("隔墙仍查询双方地面根，死怪/禁用怪和剑风不走近战", () => {
    const calls: number[][] = [];
    expect(
      inStrike({ x: 0, y: 0 }, boar, swing(), (x, y, tx, ty) => {
        calls.push([x, y, tx, ty]);
        return false;
      }),
    ).toBe(false);
    expect(calls).toEqual([[0, 0, 100, 0]]);
    for (const target of [
      { ...boar, hp: 0 },
      { ...boar, disabled: true },
    ])
      expect(inStrike({ x: 0, y: 0 }, target, swing(), () => true)).toBe(false);
    expect(inStrike({ x: 0, y: 0 }, boar, {...swing(3, 1),kind:"swordWind",delivery:"wind"}, () => true)).toBe(false);
    expect(
      inStrike(
        { x: 0, y: 0 },
        boar,
        { ...swing(), delivery: "wind" },
        () => true,
      ),
    ).toBe(false);
  });
  it("普通、防守、投影和精英共用身体；四首领使用自己的建模尺寸", () => {
    for (const kind of ["enemy", "defense-enemy", "trainingProjection"])
      expect(
        inStrike({ x: 0, y: 0 }, { ...boar, kind }, swing(), () => true),
      ).toBe(true);
    expect(meleeBody({ ...boar, ...{ eliteLevel: 3 } })).toEqual(
      meleeBody(boar),
    );
    for (const boss of Object.keys(CAMP_BOSSES))
      expect(meleeBody({ ...boar, boss })).not.toEqual(meleeBody(boar));
    expect(meleeBody({ x: 0, y: 0, kind: "trainingDummy" })).toBeNull();
  });
  it("鸦妖视觉抬升不改变近战轮廓或四向结果", () => {
    const bird = { id: "bird", type: "raven", x: 65, y: 0, hp: 64 };
    expect(
      meleeBody({ ...bird, ...{ attack: { offset: { y: -20 } } } }),
    ).toEqual(meleeBody(bird));
    expect(inStrike({ x: 0, y: 0 }, bird, swing(), () => true)).toBe(true);
  });
  it("侧边多目标连招，每个攻击实例只打一次，前摇与收招不补打", () => {
    const c = new CombatController(),
      p = { x: 0, y: 0 },
      targets = [
        { ...boar, id: "a", x: 80 },
        { ...boar, id: "b", x: 86, y: 24 },
      ];
    const hits: string[] = [],
      starts: number[] = [];
    const tick = (prev: number, now: number) =>
      c.update(
        prev,
        now,
        3,
        p,
        targets,
        () => true,
        () => true,
        (e, stage) => hits.push(`${stage}:${e.id}`),
        (stage) => starts.push(stage),
      );
    c.requestAttack(0);
    tick(0, 74);
    expect(hits).toEqual([]);
    tick(74, 190);
    tick(190, 230);
    expect(hits).toEqual(["1:a", "1:b"]);
    c.requestAttack(240);
    tick(230, 335);
    tick(335, 525);
    c.requestAttack(530);
    tick(525, 665);
    tick(665, 1040);
    expect(starts).toEqual([1, 2, 3]);
    expect(hits).toEqual(["1:a", "1:b", "2:a", "2:b", "3:a", "3:b"]);
  });
});
