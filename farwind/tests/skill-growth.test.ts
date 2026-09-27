import { describe, it, expect } from "vitest";
import { initialState, validate } from "../src/game/systems/state";
import {
  completeWindLesson,
  effectiveWindStage,
} from "../src/game/systems/skills";
import { LESSON_IDS } from "../src/data/windLessons";
import {
  resolveSwordWindConfig,
  type SwordWindStage,
} from "../src/data/swordWind";
import {
  SwordWindSystem,
  type WindMotion,
} from "../src/game/systems/swordWind";
import { type Attack } from "../src/game/systems/combat";
import { firstSwordWindBlocker } from "../src/game/systems/swordWindGeometry";
import {
  waterSurfaceAt,
  waterTrailSamples,
  WIND_WATER,
} from "../src/game/systems/swordWindWater";
import { terrainBlocked, type Prop } from "../src/data/world";
import { StateCommit } from "../src/game/systems/stateCommit";
const noWall = () => null;
const target = (id: string, x: number, y = 500, extra = {}) => {
  const t = { id, x, y, hp: 100, ...extra };
  return { target: t, previous: { x, y }, current: { x, y } };
};
function shot(stage: Exclude<SwordWindStage, 0>, root = { x: 500, y: 500 }) {
  const system = new SwordWindSystem(),
    config = resolveSwordWindConfig(stage);
  const attack: Attack = {
    id: 1,
    stage: 4,
    start: 0,
    hit: new Set(),
    facing: 3,
    swordWind: config,
  };
  const center = system.launch(attack, root, 110, config.damage)!;
  return { system, center, attack, winds: [...system.winds] };
}
function complete(stage: number) {
  let s = initialState();
  for (let i = 0; i < stage; i++) {
    if (i === 1) s.skills.devices.serialValve = 1;
    if (i === 2) s.skills.devices.leakClosed = true;
    if (i === 4) {
      s.skills.devices.splitLeft = 1;
      s.skills.devices.splitRight = 2;
    }
    s = completeWindLesson(s, LESSON_IDS[i]);
  }
  return s;
}
describe("永久学习与迁移", () => {
  it.each([0, 1, 2, 3, 4, 5])("阶段%s可保存导入，重复事件不升级", (stage) => {
    const s = complete(stage),
      v = validate(JSON.parse(JSON.stringify(s)));
    expect(v.skills.swordWindStage).toBe(stage);
    if (stage) expect(completeWindLesson(v, LESSON_IDS[stage - 1])).toEqual(v);
    expect(v.player).toEqual(initialState().player);
    expect(v.quest).toBe(0);
  });
  it.each([undefined, false, true])(
    "旧布尔%s不丢失，迁移不伪造经历",
    (learned) => {
      const s: any = initialState();
      s.schema_version = 6;
      s.skills = learned === undefined ? undefined : { swordWind: learned };
      s.bag[0] = { id: "herb", count: 5 };
      s.defense.guards[0].dead = true;
      s.defense.guards[0].hp = 0;
      s.defense.guards[0].mode = "dead";
      const v = validate(s);
      expect(v.schema_version).toBe(7);
      expect(v.skills.swordWindStage).toBe(learned ? 1 : 0);
      expect(v.skills.completedLessons).toEqual([]);
      expect(v.bag).toEqual(s.bag);
      expect(v.defense.guards[0].dead).toBe(true);
      expect(validate(v)).toEqual(v);
    },
  );
  it("乱序事实按前置补结算，不重复解谜", () => {
    let s = initialState();
    s.skills.devices.splitLeft = 1;
    s.skills.devices.splitRight = 2;
    s = completeWindLesson(s, LESSON_IDS[4]);
    s = completeWindLesson(s, LESSON_IDS[3]);
    s.skills.devices.leakClosed = true;
    s = completeWindLesson(s, LESSON_IDS[2]);
    s.skills.devices.serialValve = 1;
    s = completeWindLesson(s, LESSON_IDS[1]);
    expect(validate(s).skills.swordWindStage).toBe(0);
    s = completeWindLesson(s, LESSON_IDS[0]);
    expect(validate(s).skills.swordWindStage).toBe(5);
  });
  it.each([-1, 0.5, 6, NaN, "3"])("非法阶段%s拒绝", (stage) => {
    const s: any = initialState();
    s.skills.swordWindStage = stage;
    expect(() => validate(s)).toThrow("技能");
  });
  it("无来源高阶、未知事实与装置不一致拒绝，临时配置被裁掉", () => {
    const s: any = initialState();
    s.skills.swordWindStage = 5;
    expect(() => validate(s)).toThrow("技能");
    s.skills.swordWindStage = 0;
    s.skills.completedLessons = ["fake"];
    expect(() => validate(s)).toThrow("技能");
    const v: any = complete(2);
    v.skills.devices.serialValve = 0;
    expect(() => validate(v)).toThrow("技能");
    const clean: any = initialState();
    clean.skills.damage = 999;
    clean.trial = 5;
    expect(validate(clean).skills).not.toHaveProperty("damage");
    expect(validate(clean)).not.toHaveProperty("trial");
    expect(effectiveWindStage(initialState(), true)).toBe(1);
    expect(validate(initialState()).skills.swordWindStage).toBe(0);
  });
  it("保存失败不发布阶段，原证据副本可重试，锁冻结后释放", async () => {
    const commit = new StateCommit();
    let live = initialState(),
      writes = 0;
    const fact = () => completeWindLesson(live, LESSON_IDS[0]);
    await expect(
      commit.run(
        () => live,
        fact,
        async () => {
          writes++;
          throw Error("模拟事务中断");
        },
        (s) => (live = s),
      ),
    ).rejects.toThrow("中断");
    expect(live.skills.swordWindStage).toBe(0);
    expect(commit.busy).toBe(false);
    await commit.run(
      () => live,
      fact,
      async () => {
        writes++;
      },
      (s) => (live = s),
    );
    expect(live.skills.swordWindStage).toBe(1);
    expect(writes).toBe(2);
  });
});
describe("五阶段独立弹道", () => {
  it.each([1, 2, 3, 4, 5] as const)("阶段%s参数与航程一致", (stage) => {
    const c = resolveSwordWindConfig(stage);
    expect(c.damage).toBe(36);
    expect(c.distance).toBe(stage >= 4 ? 420 : 300);
    expect(c.width).toBe(stage >= 4 ? 64 : 28);
    expect(c.lifetime).toBeGreaterThan((c.distance / c.speed) * 1000);
  });
  it.each([false, true])("双穿按路径排序，数组反转%s不改变结果", (reverse) => {
    const { system, center } = shot(2),
      targets = [target("A", 650), target("B", 720), target("C", 790)];
    if (reverse) targets.reverse();
    expect(
      system
        .advance(110, 650, targets, noWall)
        .filter((e) => e.target)
        .map((e) => e.target!.id),
    ).toEqual(["A", "B"]);
    expect(
      system.events.filter((e) => e.kind === "hit").map((e) => e.terminal),
    ).toEqual([false, true]);
    expect(center.targetCount).toBe(2);
    expect(center.terminated).toBe(true);
  });
  it("机关不耗敌方名额，多帧同目标不重复", () => {
    const { system } = shot(2),
      targets = [
        target("铃", 610, 500, { windSensitive: true }),
        target("A", 650),
        target("B", 720),
      ];
    const hits = [
      ...system.advance(110, 200, targets, noWall),
      ...system.advance(200, 650, targets, noWall),
    ]
      .filter((e) => e.target)
      .map((e) => e.target!.id);
    expect(hits).toEqual(["铃", "A", "B"]);
  });
  it("贯通所有有限路径目标，但墙后、死敌、禁用目标不能命中", () => {
    const { system } = shot(3),
      wall: Prop = {
        id: "石墙",
        art: "rock",
        x: 780,
        y: 530,
        w: 20,
        h: 80,
        solid: [20, 80],
      };
    const targets = [
      target("C", 820),
      target("B", 720),
      target("A", 650),
      target("死", 670, 500, { hp: 0 }),
      target("禁", 680, 500, { disabled: true }),
    ];
    const events = system.advance(110, 650, targets, (a, b, r) =>
      firstSwordWindBlocker(a, b, r, [wall]),
    );
    expect(events.filter((e) => e.target).map((e) => e.target!.id)).toEqual([
      "A",
      "B",
    ]);
    expect(events.at(-1)?.reason).toBe("obstacle");
  });
  it("疾风实际宽度和射程扩大，敌人贴边可中，边外不中", () => {
    const thin = shot(3),
      wide = shot(4),
      targets = [
        target("宽边", 700, 542),
        target("远端", 930),
        target("边外", 700, 548),
      ];
    expect(
      thin.system.advance(110, 750, targets, noWall).filter((e) => e.target),
    ).toEqual([]);
    expect(
      wide.system
        .advance(110, 750, targets, noWall)
        .filter((e) => e.target)
        .map((e) => e.target!.id),
    ).toEqual(["宽边", "远端"]);
    expect(wide.center.reason).toBe("range");
    expect(wide.center.distance).toBeCloseTo(420);
  });
  it("三向同次释放共享去重，不填满扇形，方向与快照稳定", () => {
    const { system, winds, attack } = shot(5);
    expect(winds).toHaveLength(3);
    expect(new Set(winds.map((w) => w.releaseId)).size).toBe(1);
    winds.forEach((w, i) =>
      expect(Math.atan2(w.direction.y, w.direction.x)).toBeCloseTo(
        [-Math.PI / 6, 0, Math.PI / 6][i],
        12,
      ),
    );
    const targets = [
      target("重叠", 550, 500, { radius: 44 }),
      target("左", 730, 367),
      target("中", 780),
      target("右", 730, 633),
      target("空隙", 760, 430),
    ];
    attack.facing = 1;
    attack.swordWind!.damage = 999;
    const hits = system
      .advance(110, 750, targets, noWall)
      .filter((e) => e.target);
    expect(hits.filter((e) => e.target!.id === "重叠")).toHaveLength(1);
    expect(hits.map((e) => e.target!.id).sort()).toEqual(
      ["中", "右", "左", "重叠"].sort(),
    );
    expect(winds.every((w) => w.config.damage === 36)).toBe(true);
  });
  it("侧刃遇墙仅销毁自身，宽足迹不能从窄缝穿墙", () => {
    const { system, winds } = shot(5);
    const events = system.advance(110, 450, [], (a, b) =>
      b.y < a.y ? { id: "上墙", t: 0.5 } : null,
    );
    expect(events.filter((e) => e.reason === "obstacle")).toHaveLength(1);
    expect(winds[0].reason).toBe("obstacle");
    expect(winds[1].terminated).toBe(false);
    expect(winds[2].terminated).toBe(false);
    const objects: Prop[] = [
      {
        id: "上沿",
        art: "rock",
        x: 750,
        y: 475,
        w: 20,
        h: 30,
        solid: [20, 30],
      },
      {
        id: "下沿",
        art: "rock",
        x: 750,
        y: 555,
        w: 20,
        h: 30,
        solid: [20, 30],
      },
    ];
    expect(
      firstSwordWindBlocker(
        { x: 600, y: 500 },
        { x: 800, y: 500 },
        32,
        objects,
      ),
    ).not.toBeNull();
  });
  it("教学快照只能触动对应教学对象，不能伤敌或借用其他传承", () => {
    const { system, center } = shot(4);
    center.config.trialLesson = LESSON_IDS[3];
    const events = system.advance(
      110,
      650,
      [
        target("敌", 650),
        target("另一课", 700, 500, { lessonId: LESSON_IDS[0] }),
        target("本课", 750, 500, {
          lessonId: LESSON_IDS[3],
          windSensitive: true,
        }),
      ],
      noWall,
    );
    expect(events.filter((e) => e.target).map((e) => e.target!.id)).toEqual([
      "本课",
    ]);
    expect(center.targetCount).toBe(0);
  });
});
describe("划水轨迹与资源边界", () => {
  it("剑风越水，人物仍被水挡住；桥上不产生水迹", () => {
    expect(
      firstSwordWindBlocker({ x: 1200, y: 1120 }, { x: 1500, y: 1120 }, 32, []),
    ).toBeNull();
    expect(terrainBlocked(1280, 1120)).toBe(true);
    expect(waterSurfaceAt(1280, 1120)).toBe("pond");
    expect(waterSurfaceAt(1090, 1120)).toBeNull();
    expect(waterSurfaceAt(2600, 1100)).toBeNull();
    expect(waterSurfaceAt(2600, 900)).toBe("stream");
    expect(waterSurfaceAt(800, 800)).toBeNull();
  });
  it("水迹沿实际裁决路径，暂停相位稳定，超时清理且数量有界", () => {
    const { system, center } = shot(4, { x: 1100, y: 1120 });
    system.advance(110, 430, [], noWall);
    const samples = waterTrailSamples(center, 430);
    expect(samples.length).toBeGreaterThan(0);
    expect(waterTrailSamples(center, 430)).toEqual(samples);
    expect(samples.every((s) => s.x <= center.position.x + 1e-7)).toBe(true);
    expect(samples.length * 4).toBeLessThanOrEqual(WIND_WATER.capacity);
    expect(waterTrailSamples(center, 2500)).toEqual([]);
    expect(center.position.x).toBeLessThan(1600);
  });
});
