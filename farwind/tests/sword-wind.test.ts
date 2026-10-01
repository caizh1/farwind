import { describe, it, expect } from "vitest";
import {
  CombatController,
  attackConfig,
  inStrike,
  type Attack,
  type Target,
} from "../src/game/systems/combat";
import { initialState, validate } from "../src/game/systems/state";
import {
  hasSwordWind,
  completeWindLesson,
  initialSkills,
  swordWindSource,
} from "../src/game/systems/skills";
import { resolveSwordWindConfig, SWORD_WIND } from "../src/data/swordWind";
import {
  SwordWindSystem,
  swordWindBirth,
  swordWindGroundSegments,
  type WindMotion,
} from "../src/game/systems/swordWind";
import {
  firstRectContact,
  firstSwordWindBlocker,
  sweptTargetContact,
} from "../src/game/systems/swordWindGeometry";
import { TrainingDummy } from "../src/game/systems/training";
import { staggerEnemy } from "../src/game/systems/enemy";
import { Input } from "../src/game/systems/input";
import { CombatTimeline } from "../src/game/systems/timeline";
import { combatVisual, weaponSample, swordWindVisual } from "../src/data/animation";
import type { Prop } from "../src/data/world";
const noWall = () => null;
function attack(id = 4, facing: 0 | 1 | 2 | 3 = 3): Attack {
  return {
    id,
    comboId: 7,
    stage: 1,kind:"swordWind",delivery:"wind",config:{...SWORD_WIND.strike},
    start: 0,
    facing,
    hit: new Set(),
    swordWind: resolveSwordWindConfig(),
  };
}
function arena(enabled = true) {
  const c = new CombatController();
  c.swordWindEnabled = enabled;c.meleeFinisherEnabled=enabled;
  const p = { x: 0, y: 0, stamina: 100 },
    starts: Attack[] = [],
    release: { a: Attack; at: number }[] = [],
    hits: number[] = [];
  const tick = (from: number, to: number) =>
    c.update(
      from,
      to,
      3,
      p,
      [{ id: "靶", x: 20, y: 0, hp: 100 }],
      () => false,
      () => true,
      (_, stage) => hits.push(stage),
      (_, a) => starts.push(a),
      () => {},
      () => true,
      (a, _, at) => release.push({ a, at }),
    );
  const third = () => {
    c.requestAttack(0);
    tick(0, 0);
    c.requestAttack(150);
    tick(0, 235);
    c.requestAttack(385);
    tick(235, 500);
  };
  return { c, p, starts, release, hits, tick, third };
}
function motion(id: string, x: number, y = 0, hp = 100): WindMotion {
  const target = { id, x, y, hp };
  return { target, previous: { x, y }, current: { x, y } };
}
function shot() {
  const s = new SwordWindSystem();
  const w = s.launch(attack(), { x: 0, y: 0 }, 110, 36)!;
  return { s, w };
}
describe("技能状态和存档边界", () => {
  it("正式默认未学，测试授予仅影响查询，关闭无需清档", () => {
    const s = initialState();
    expect(s.skills.swordWindStage).toBe(0);
    expect(hasSwordWind(s, false)).toBe(false);
    expect(hasSwordWind(s, true)).toBe(true);
    expect(swordWindSource(s, true)).toBe("测试授予");
    expect(validate(s).skills.swordWindStage).toBe(0);
    expect(hasSwordWind(s, false)).toBe(false);
  });
  it("旧版缺字段默认未学；唯一学习事件授予可保存", () => {
    const s = initialState(),
      old: any = structuredClone(s);
    old.schema_version=6;old.skills={swordWind:false};
    delete old.skills;
    expect(validate(old).skills.swordWindStage).toBe(0);
    expect(validate(s).skills.swordWindStage).toBe(0);
    const learned=completeWindLesson(s,'windLessonResolved');
    expect(validate(JSON.parse(JSON.stringify(learned))).skills.swordWindStage).toBe(1);
    expect(swordWindSource(learned, false)).toBe("正式学习");
  });
  it("坏技能字段拒绝，高阶字段和临时实体不进入正式状态", () => {
    const s: any = initialState();
    s.skills.maxTargets = "all";
    s.swordWind = [{ id: 1 }];
    s.attack = attack();
    expect(validate(s).skills).toEqual(initialSkills());
    expect(validate(s)).not.toHaveProperty("swordWind");
    expect(validate(s)).not.toHaveProperty("attack");
    s.skills.swordWindStage = "true";
    expect(() => validate(s)).toThrow("技能");
    expect(resolveSwordWindConfig().maxTargets).toBe(1);
  });
});
describe("连段预约、输入和终结段", () => {
  it.each([false, true])("只按三次从不自动释放；拥有状态=%s", (enabled) => {
    const a = arena(enabled);
    a.third();
    a.tick(500, 1400);
    expect(a.starts.map((a) => a.stage)).toEqual([1, 2, 3]);
    expect(a.release).toHaveLength(0);
  });
  it("第四输入绑定第三刀，不能早跳有效期，重复预约不续期", () => {
    const a = arena();
    a.third();
    a.c.requestAttack(800);
    expect(a.c.pending).toBe(false);
    a.c.requestAttack(860);
    const expiry = a.c.bufferUntil;
    expect(a.c.reservationOwner).toBe(3);
    a.c.requestAttack(900);
    expect(a.c.bufferUntil).toBe(expiry);
    a.tick(500, 909.999);
    expect(a.c.attack?.stage).toBe(3);
    a.tick(909.999, 910);
    expect(a.c.attack?.stage).toBe(4);
    a.tick(910, 1020);
    expect(a.release).toHaveLength(0);
    a.tick(1020, 1585);
    a.c.requestAttack(1586);
    a.tick(1585, 1586);
    expect(a.starts.map((a) => a.stage)).toEqual([1, 2, 3, 4, 1]);
    expect(a.release).toHaveLength(0);
  });
  it("无技能第三刀仍在完整收招后重启第一刀", () => {
    const a = arena(false);
    a.third();
    a.c.requestAttack(860);
    a.tick(500, 1009.999);
    expect(a.c.attack?.stage).toBe(3);
    a.tick(1009.999, 1010);
    expect(a.c.attack?.stage).toBe(1);
  });
  it.each([1100, 1211])("结束后宽限输入在%s决定第四段或重启", (at) => {
    const a = arena();
    a.third();
    a.tick(500, at);
    a.c.requestAttack(at);
    a.tick(at, at);
    expect(a.c.attack?.stage).toBe(at === 1100 ? 4 : 1);
  });
  it("临时能力关闭后不能消费宽限中的隐藏第四段", () => {
    const a = arena();
    a.third();
    a.tick(500, 1050);
    expect(a.c.nextStage).toBe(4);
    a.c.meleeFinisherEnabled = false;
    a.c.requestAttack(1051);
    a.tick(1050, 1051);
    expect(a.c.attack?.stage).toBe(1);
  });
  it.each(["hurt", "cancelAttack", "reset"] as const)(
    "链被%s中断不迟到发射",
    (kind) => {
      const a = arena();
      a.third();
      a.c.requestAttack(860);
      a.c[kind]();
      a.tick(860, 1500);
      expect(a.release).toHaveLength(0);
      expect(a.c.pending).toBe(false);
    },
  );
  it("错误所属实例的预约被丢弃", () => {
    const a = arena();
    a.third();
    a.c.requestAttack(860);
    a.c.reservationOwner = 1;
    a.tick(500, 1200);
    expect(a.starts.map((a) => a.stage)).toEqual([1, 2, 3]);
  });
  it("长按、repeat及同刻等价键鼠只产生一个攻击实例", () => {
    const input = new Input(null, () => 0);
    input.keyDown("j");
    input.keyDown("j");
    input.keyDown("j", true);
    input.request("attack");
    const a = arena();
    a.c.requestActions(input.drain() as any, 0, a.p, 3);
    a.tick(0, 0);
    expect(a.starts).toHaveLength(1);
    expect(a.c.pending).toBe(false);
    expect(input.drain()).toEqual([]);
  });
  it("L>K>J优先级拒绝后不补攻击", () => {
    const a = arena();
    a.p.stamina = 0;
    a.c.requestActions(
      ["attack", "parry", "dash"].map((kind, sequence) => ({
        kind: kind as any,
        at: 0,
        sequence,
        axis: { x: 1, y: 0 },
      })),
      0,
      a.p,
      3,
    );
    a.c.flushActions(0, a.p);
    a.tick(0, 0);
    expect(a.starts).toHaveLength(0);
    expect(a.c.lastRejection).toBe("体力不足");
  });
  it("自动反斩仍为首刀限靶；不按后续时不自动生成剑风", () => {
    const a = arena();
    a.c.requestParry(0, 3);
    a.c.flushActions(0, a.p);
    a.c.succeedParry(100, "perfect", a.p, "敌人", { x: 50, y: 0 });
    a.c.advanceFrame(75);
    a.tick(100, 160);
    expect(a.c.attack).toMatchObject({
      stage: 1,
      automatic: true,
      primaryTarget: "敌人",
      counter: "perfect",
    });
    a.tick(160, 1400);
    expect(a.release).toHaveLength(0);
    expect(a.starts.map((a) => a.stage)).toEqual([1]);
  });
  it("自动反斩允许主动接二三四，但弹反前旧预约不能沿用", () => {
    const a = arena();
    a.c.requestAttack(0);
    a.tick(0, 0);
    a.c.requestAttack(30);
    a.c.requestParry(30, 3);
    a.c.flushActions(30, a.p);
    expect(a.c.pending).toBe(false);
    a.c.succeedParry(100, "normal", a.p, "敌人", { x: 50, y: 0 });
    a.c.advanceFrame(55);
    a.tick(100, 160);
    a.c.requestAttack(200);
    a.tick(160, 375);
    a.c.requestAttack(450);
    a.tick(375, 640);
    a.c.requestAttack(1000);
    a.tick(640, 1200);
    expect(a.starts.map((a) => a.stage)).toEqual([1, 1, 2, 3, 4]);
    expect(a.release).toHaveLength(0);
    expect(a.starts.at(-1)?.isFinisher).toBe(true);
  });
});
describe("独立剑风释放、取消和动画", () => {
  it.each([109.999, 110, 110.001, 400])(
    "跨释放边界%s仅一次模拟事件且无近战伤害",
    (to) => {
      const a = arena();
      a.c.attack = attack();
      a.tick(0, to);
      expect(a.release.length).toBe(to >= 110 ? 1 : 0);
      a.tick(to, to + 1);
      expect(a.release.length).toBe(1);
      expect(a.release[0].at).toBe(110);
      expect(a.hits).toEqual([]);
      expect(
        inStrike(
          a.p,
          { id: "贴身", x: 10, y: 0, hp: 100 },
          attack(),
          () => true,
        ),
      ).toBe(false);
    },
  );
  it("释放前K取消、前摇L拒绝，取消不遗留事件", () => {
    const a = arena();
    a.c.attack = attack();
    expect(a.c.requestDash(100, 100, { x: 1, y: 0 }, 3)).toBe(false);
    a.c.requestParry(100, 3);
    expect(a.c.flushActions(100, a.p)).toEqual(["parry"]);
    a.tick(100, 500);
    expect(a.release).toHaveLength(0);
  });
  it("有效与收招前段锁定，最后120ms消费合法K/L预输入", () => {
    for (const kind of ["parry", "dash"] as const) {
      const a = arena();
      a.c.attack = attack();
      a.tick(0, 110);
      a.c.requestActions(
        [{ kind, at: 200, sequence: 1, axis: { x: 1, y: 0 } }],
        200,
        a.p,
        3,
      );
      expect(a.c.flushActions(200, a.p)).toEqual([]);
      expect(a.c.attack?.kind).toBe("swordWind");
      expect(a.c.flushActions(280, a.p)).toEqual([kind]);
      expect(a.release).toHaveLength(1);
    }
  });
  it("发射后受伤、风步或弹反不会回收独立弹体", () => {
    const a = arena(),
      s = new SwordWindSystem();
    a.c.attack = attack();
    a.tick(0, 110);
    const w = s.launch(a.release[0].a, a.p, 110, 36)!;
    a.c.hurt();
    s.advance(110, 210, [], noWall);
    expect(w.terminated).toBe(false);
    expect(w.distance).toBe(90);
    expect(s.launch(a.release[0].a, a.p, 210, 36)).toBeNull();
  });
  it("四向专用图集八帧、统一镜像和采样点，不落入三刀偏移", () => {
    for (const facing of [0, 1, 2, 3] as const) {
      const frames = [0, 35, 70, 110, 135, 210, 270, 340].map((t) =>
        swordWindVisual(facing,t,attackConfig(attack())),
      );
      expect(new Set(frames.map((v) => v.frame)).size).toBe(8);
      expect(frames.every((v) => v.texture === "hero-sword-wind")).toBe(true);
    }
    const left = swordWindVisual(2,110,attackConfig(attack())).weapon!,
      right = swordWindVisual(3,110,attackConfig(attack())).weapon!;
    expect(left.tip.x).toBe(-right.tip.x);
    expect(left.tip.y).toBe(right.tip.y);
  });
});
describe("连续碰撞、首目标及阻挡顺序", () => {
  it.each([false, true])("共线目标数组反转=%s，始终只中A", (reverse) => {
    const { s, w } = shot(),
      targets = [motion("A", 120), motion("B", 180)];
    if (reverse) targets.reverse();
    const events = s.advance(110, 410, targets, noWall);
    expect(events.map((e) => e.target?.id)).toEqual(["A"]);
    expect(w.position.x).toBeCloseTo(92);
    expect(w.hit.size).toBe(1);
    expect(s.advance(410, 420, targets, noWall)).toEqual([]);
  });
  it("同刻重叠按稳定ID；有效免疫目标仍挡住，死敌和不可用对象跳过", () => {
    const { s } = shot(),
      dead = motion("死敌", 40, 0, 0),
      disabled = motion("禁用", 50);
    (disabled.target as any).disabled = true;
    const immune = motion("a", 120);
    (immune.target as any).immune = true;
    expect(
      s
        .advance(
          110,
          410,
          [dead, disabled, motion("b", 120), immune, motion("后排", 180)],
          noWall,
        )
        .map((e) => e.target?.id),
    ).toEqual(["a"]);
  });
  it("出生与离刃短路径重叠只结算一次，同刻墙优先", () => {
    const a = shot();
    expect(a.s.advance(110, 110, [motion("贴身", 0)], noWall)).toHaveLength(1);
    expect(a.s.advance(110, 130, [motion("贴身", 0)], noWall)).toEqual([]);
    const b = shot();
    expect(
      b.s.advance(110, 110, [motion("贴身", 8)], () => ({
        id: "薄墙",
        t: 0,
      }))[0].reason,
    ).toBe("obstacle");
  });
  it("扫掠完整高速路径，迎面及交叉移动目标均不能穿漏", () => {
    const a = shot(),
      m = motion("迎面", 80);
    m.previous = { x: 400, y: 0 };
    const e = a.s.advance(110, 410, [m], noWall)[0];
    expect(e.target?.id).toBe("迎面");
    expect(e.at).toBeCloseTo(
      110 +
        ((400 -
          swordWindBirth(attack(), { x: 0, y: 0 }, resolveSwordWindConfig())
            .position.x -
          28) /
          (900 + 320 / 0.3)) *
          1000,
    );
    const b = shot(),
      cross = motion("交叉", 140, 120);
    cross.previous = { x: 140, y: -120 };
    expect(b.s.advance(110, 410, [cross], noWall)[0]?.target?.id).toBe("交叉");
  });
  it("28宽度擦边正确；侧后方不受宽大特效影响", () => {
    for (const [y, hit] of [
      [28, true],
      [28.001, false],
      [60, false],
    ] as const) {
      const { s } = shot();
      expect(
        s
          .advance(110, 410, [motion("边缘", 120, y)], noWall)
          .some((e) => e.target),
      ).toBe(hit);
    }
    const { s } = shot();
    expect(s.advance(110, 410, [motion("背后", -50)], noWall)).toEqual([]);
  });
  it.each(["墙先", "敌先", "同刻"] as const)(
    "%s按真实接触参数裁决且障碍同刻优先",
    (order) => {
      const { s } = shot(),
        left = order === "墙先" ? 100 : order === "敌先" ? 150 : 106;
      const result = s.advance(110, 410, [motion("敌", 120)], (a, b, r) => {
        const t = firstRectContact(a, b, {
          left: left - r,
          right: left + 1 + r,
          top: -20,
          bottom: 20,
        });
        return t === null ? null : { id: "薄墙", t };
      });
      expect(result[0].reason).toBe(order === "敌先" ? "target" : "obstacle");
      expect(result).toHaveLength(1);
    },
  );
  it("射程从实际出生累计，边界可接触、射程外不命中；消散无伤害", () => {
    const a = shot();
    expect(
      a.s.advance(110, 500, [motion("射程外", 370)], noWall)[0].reason,
    ).toBe("range");
    expect(a.w.position.x).toBeCloseTo(
      swordWindBirth(attack(), { x: 0, y: 0 }, resolveSwordWindConfig())
        .position.x + 300,
    );
    expect(a.w.distance).toBe(300);
    expect(a.s.advance(500, 520, [motion("后来进入", 308)], noWall)).toEqual(
      [],
    );
    const b = shot();
    expect(
      b.s.advance(
        110,
        500,
        [
          motion(
            "边界",
            swordWindBirth(attack(), { x: 0, y: 0 }, resolveSwordWindConfig())
              .position.x + 328,
          ),
        ],
        noWall,
      )[0].reason,
    ).toBe("target");
  });
  it("配置、朝向、归属和伤害在发射时快照；死亡／会话清理保留唯一ID", () => {
    const s = new SwordWindSystem(),
      a = attack(),
      w = s.launch(a, { x: 0, y: 0 }, 110, 42)!;
    a.facing = 0;
    a.comboId = 99;
    a.swordWind!.strike.damage = 999 as any;
    expect(w).toMatchObject({
      facing: 3,
      comboId: 7,
      attackId: 4,
      maxTargets: 1,
    });
    expect(w.config.damage).toBe(42);
    expect(w.attack.config!.damage).toBe(36);
    s.clear();
    expect(s.snapshot()).toEqual([]);
    expect(s.events).toEqual([]);
    expect(s.launch(attack(5), { x: 0, y: 0 }, 500, 36)!.id).toBeGreaterThan(
      w.id,
    );
  });
  it("墙体查询返回最近而非数组第一，宽度扩张捕捉边角", () => {
    const make = (id: string, x: number): Prop => ({
      id,
      art: "墙",
      x,
      y: 510,
      w: 2,
      h: 10,
      solid: [2, 10],
    });
    const a = { x: 500, y: 486 },
      b = { x: 800, y: 486 },
      p = [make("远", 750), make("近", 600)];
    expect(firstSwordWindBlocker(a, b, 14, p)?.id).toBe("近");
    expect(firstSwordWindBlocker(a, b, 14, p.reverse())?.id).toBe("近");
    expect(firstSwordWindBlocker(a, b, 0, p)).toBeNull();
  });
  it("剑风越水与桥面通行，人物阻挡仍由独立地形处理", () => {
    expect(
      firstSwordWindBlocker({ x: 1200, y: 1120 }, { x: 1500, y: 1120 }, 14, [])
    ).toBeNull();
    expect(
      firstSwordWindBlocker({ x: 1090, y: 880 }, { x: 1090, y: 1450 }, 14, []),
    ).toBeNull();
    expect(
      firstSwordWindBlocker({ x: 2450, y: 1000 }, { x: 2800, y: 1000 }, 14, [])
    ).toBeNull();
    expect(
      firstSwordWindBlocker({ x: 2450, y: 1100 }, { x: 2800, y: 1100 }, 14, []),
    ).toBeNull();
  });
  it("安全寿命独立于射程，零移动碰撞与几何起始重叠成立", () => {
    const { s, w } = shot();
    (w.config as any).distance = 9999;
    expect(s.advance(110, 700, [], noWall)[0].reason).toBe("lifetime");
    expect(w.ended).toBe(560);
    expect(w.distance).toBe(405);
    expect(
      sweptTargetContact(
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 0 },
        2,
      ),
    ).toBe(0);
  });
});
describe("时间、训练与旧系统边界", () => {
  it.each([
    { steps: [1000 / 30] },
    { steps: [1000 / 60] },
    { steps: [1000 / 120] },
    { steps: [7, 19, 31, 11, 23] },
  ])("不同步长$steps保持同一移动目标首次接触", ({ steps }) => {
    const { s, w } = shot();
    let now = 110,
      i = 0;
    for (let guard = 0; guard < 200 && !w.terminated; guard++) {
      const prev = now;
      now = Math.min(410, now + steps[i++ % steps.length]);
      const m = motion("迎面", 400 - ((now - 110) * 320) / 300);
      m.previous = { x: 400 - ((prev - 110) * 320) / 300, y: 0 };
      s.advance(prev, now, [m], noWall);
    }
    expect(w.terminated).toBe(true);
    expect(w.ended).toBeCloseTo(
      110 +
        ((400 -
          swordWindBirth(attack(), { x: 0, y: 0 }, resolveSwordWindConfig())
            .position.x -
          28) /
          (900 + 320 / 0.3)) *
          1000,
      7,
    );
    expect([...w.hit]).toEqual(["迎面"]);
  });
  it("长步跨发射只推进出生之后时间", () => {
    const { s, w } = shot();
    s.advance(0, 160, [], noWall);
    expect(w.distance).toBe(45);
  });
  it("四向可见前缘与真实碰撞前缘同步，起始路径不跳过薄墙", () => {
    for (const facing of [0, 1, 2, 3] as const) {
      const a = attack(4, facing),
        cfg = resolveSwordWindConfig(),
        b = swordWindBirth(a, { x: 500, y: 500 }, cfg),
        v = [
          [0, 1],
          [0, -1],
          [-1, 0],
          [1, 0],
        ][facing];
      const imageForward =
        (b.position.x + b.visualOffset.x - 500) * v[0] +
        (b.position.y + b.visualOffset.y + cfg.art.bodyHeight - 500) * v[1] +
        cfg.art.frontEdge;
      const collisionForward =
        (b.position.x - 500) * v[0] +
        (b.position.y - 500) * v[1] +
        cfg.width / 2;
      expect(imageForward).toBeCloseTo(collisionForward);
      const s = new SwordWindSystem();
      s.launch(a, { x: 500, y: 500 }, 110, 36);
      expect(
        s.advance(110, 110, [], () => ({ id: "起始薄墙", t: 0.5 }))[0].reason,
      ).toBe("obstacle");
    }
  });
  it("世界停顿冻结弹体但接受预输入，多个停顿取最大", () => {
    const c = new CombatController(),
      t = new CombatTimeline(),
      { s, w } = shot();
    t.reset(0);
    c.hitStopRemaining=SWORD_WIND.hitStop;
    c.stopOnHit(1);
    expect(c.hitStopRemaining).toBe(36);
    const sim = t.frame(
      110,
      30,
      30,
      [{ kind: "attack", at: 15, sequence: 1, axis: { x: 1, y: 0 } }],
      c,
      {
        boundary: () => Infinity,
        advance: (p, n) => s.advance(p, n, [], noWall),
        input: (_, n) => c.requestAttack(n),
        resolve: () => {},
      },
    );
    expect(sim).toBe(110);
    expect(w.distance).toBe(0);
    expect(c.pending).toBe(true);
    expect(c.hitStopRemaining).toBe(6);
  });
  it("原木桩三连完成独立；远程旧快照不改新连段、不走生命或掉落", () => {
    const d = new TrainingDummy();
    for (let stage = 1; stage <= 3; stage++)
      d.hit({ ...attack(stage), stage,kind:"melee",delivery:"blade",config:undefined }, stage * 100);
    expect(d.snapshot(350)).toMatchObject({
      complete: true,
      damage: 68,
      stages: [1, 2, 3],
    });
    d.hit(attack(), 400, 36);
    expect(d.snapshot(400)).toMatchObject({
      complete: true,
      damage: 68,
      windDamage: 36,
    });
    expect(d.hit(attack(), 410, 36)).toBe(false);
    d.begin({ ...attack(10), stage: 1,kind:"melee",delivery:"blade",comboId: 99 });
    d.hit(attack(11), 500, 36);
    expect(d.snapshot(500).comboId).toBe(99);
    expect(d.snapshot(500).swordWind).toMatchObject({
      comboId: 7,
      damage: 36,
      firstTarget: d.id,
    });
    expect(d.hp).toBe(1);
    d.reset();
    expect(d.snapshot(501).swordWind).toBeNull();
  });
  it("第四击参数统一且120ms不会缩短已有更长失衡", () => {
    const cfg = resolveSwordWindConfig();
    expect(attackConfig(attack())).toEqual(cfg.strike);
    expect(cfg).toMatchObject({
      damage: 36,
      speed: 900,
      distance: 300,
      width: 28,
      lifetime: 450,
      hitStop: 32,
      maxTargets: 1,
    });
    const e = { staggerUntil: 800 };
    staggerEnemy(e, 100, cfg.strike.stagger);
    expect(e.staggerUntil).toBe(800);
  });
});

describe("上撩与地面切痕", () => {
  it("释放剑尖明显高于剑柄，左向离刃与地面出生对称", () => {
    for (const d of [0, 1, 2, 3] as const) {
      const p = swordWindVisual(d,110,attackConfig(attack())).weapon!;
      expect(p.tip.y).toBeLessThan(p.grip.y - 15);
    }
    const cfg = resolveSwordWindConfig(),
      left = swordWindBirth(attack(4, 2), { x: 0, y: 0 }, cfg),
      right = swordWindBirth(attack(), { x: 0, y: 0 }, cfg);
    expect(left.position.x).toBeCloseTo(-right.position.x);
    expect(left.visualOffset.x).toBeCloseTo(-right.visualOffset.x);
    expect(left.visualOffset.y).toBeCloseTo(right.visualOffset.y);
  });
  it.each([0, 1, 2, 3] as const)("方向%s只铺已裁决路径并裁切最后一段", (d) => {
    const s = new SwordWindSystem(),
      w = s.launch(attack(4, d), { x: 500, y: 500 }, 110, 36)!;
    expect(swordWindGroundSegments(w, 110)).toEqual([]);
    s.advance(110, 140, [], noWall);
    const segments = swordWindGroundSegments(w, 140),
      v = [
        [0, 1],
        [0, -1],
        [-1, 0],
        [1, 0],
      ][d],
      end = (w.position.x - 500) * v[0] + (w.position.y - 500) * v[1];
    expect(segments.length).toBeGreaterThan(0);
    for (const p of segments) {
      const start = (p.x - 500) * v[0] + (p.y - 500) * v[1] - 18;
      expect(start + (p.crop / 128) * 36).toBeLessThanOrEqual(end + 1e-8);
    }
  });
  it("命中首目标后残缝消隐，模拟停顿不变化，清理后无旧轨迹", () => {
    const { s, w } = shot();
    s.advance(110, 410, [motion("首目标", 140), motion("后方", 200)], noWall);
    expect([...w.hit]).toEqual(["首目标"]);
    const a = swordWindGroundSegments(w, w.ended!);
    expect(a.length).toBeGreaterThan(0);
    s.advance(w.ended!, w.ended!, [], noWall);
    expect(swordWindGroundSegments(w, w.ended!)).toEqual(a);
    const end = w.position.x;
    for (const p of a)
      expect(p.x - 18 + (p.crop / 128) * 36).toBeLessThanOrEqual(end + 1e-8);
    expect(swordWindGroundSegments(w, w.ended! + 850)).toEqual([]);
    s.clear();
    expect(s.winds).toEqual([]);
  });
});
