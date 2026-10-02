import { describe, it, expect } from "vitest";
import {
  XiaobaoCombat,
  type XiaobaoEnvironment,
  type XiaobaoFront,
} from "../src/game/systems/xiaobaoCombat";
import {
  initialXiaobao,
  validateXiaobao,
} from "../src/game/systems/xiaobaoState";
import { XIAOBAO_SKILLS } from "../src/data/xiaobaoCombat";
import {
  enemyNavigation,
  companionControl,
  type EnemyBody,
} from "../src/game/systems/enemy";
import {
  resolveDamage,
  resolveReleasedDamage,
} from "../src/game/systems/damage";
import { initialState, validate } from "../src/game/systems/state";
import { enemyDefs } from "../src/data/world";
import { prepareRaid } from "../src/game/systems/defense";
import { EastDefense } from "../src/game/systems/defense";
import { xiaobaoFronts } from "../src/game/systems/xiaobaoWorld";
import type { World } from "../src/game/scenes/World";
function enemy(id: string, x = 870, y = 725): EnemyBody {
  return {
    id,
    type: "slime",
    x,
    y,
    hp: 1000,
    homeX: x,
    homeY: y,
    cool: 0,
    windup: 0,
    staggerUntil: 0,
    nav: enemyNavigation(),
    ai: "家园",
    disabled: false,
    recovered: false,
  };
}
function fixture(enemies: EnemyBody[] = []) {
  const c = new XiaobaoCombat(),
    hits: { id: string; amount: number; time: number }[] = [],
    messages: string[] = [];
  let fronts: XiaobaoFront[] = [];
  const env: XiaobaoEnvironment = {
    now: 0,
    minute: 480,
    player: { x: 740, y: 780, hp: 100, outside: true, region: "village" },
    enemies,
    allies: [],
    fronts: () => fronts,
    recent: null,
    blocked: () => false,
    clear: () => true,
    melee: () => true,
    takeoffClear: () => true,
    message: (s) => messages.push(s),
    move: (body, _nav, target, speed, dt, _budget, allowed) => {
      const d = Math.hypot(target.x - body.x, target.y - body.y),
        step = Math.min(d, speed * dt),
        to = {
          x: body.x + ((target.x - body.x) / (d || 1)) * step,
          y: body.y + ((target.y - body.y) / (d || 1)) * step,
        };
      if (allowed(to) && !env.blocked!(to) && env.clear!(body, to)) {
        body.x = to.x;
        body.y = to.y;
        return step;
      }
      return 0;
    },
    hit: (e, event, source) => {
      const result = resolveReleasedDamage(event, source, {
        id: e.id,
        faction: "hostile",
        hp: e.hp,
        armor: 0,
      });
      if (result.applied) {
        e.hp = result.hp;
        hits.push({ id: e.id, amount: result.damage, time: c.data.clock });
      }
      return result;
    },
  };
  const step = (ms: number) => {
    for (let t = 0; t < ms; t += 5) {
      env.now += Math.min(5, ms - t);
      c.tick(Math.min(5, ms - t), env, { queries: 2 });
    }
  };
  return {
    c,
    env,
    hits,
    messages,
    step,
    setFronts: (f: XiaobaoFront[]) => (fronts = f),
  };
}
const front = (
  key = "真实来袭",
  gate: "east-gate" | "north-gate" | "south-gate" = "east-gate",
  priority = 3,
): XiaobaoFront => ({
  key,
  gate,
  major: true,
  priority,
  point: { x: 1300, y: 1080 },
  enemies: [],
  injured: false,
});
describe("随行护卫的距离与危险优先级", () => {
  it("安全距离内原地巡护，过近时主动让出主角身边的空间", () => {
    for (const offset of [150, 10]) {
      const f = fixture();
      f.c.data.task = "follow";
      f.env.player = { ...f.env.player, x: 1000, y: 725 };
      f.c.x = 1000 + offset;
      f.c.y = 725;
      const start = { x: f.c.x, y: f.c.y };
      f.step(3000);
      const gap = Math.hypot(f.c.x - 1000, f.c.y - 725);
      expect(gap).toBeGreaterThanOrEqual(120);
      expect(gap).toBeLessThanOrEqual(220);
      if (offset === 150) expect({ x: f.c.x, y: f.c.y }).toEqual(start);
      const settled = { x: f.c.x, y: f.c.y };
      f.step(1500);
      expect({ x: f.c.x, y: f.c.y }).toEqual(settled);
    }
  });
  it("落后主角超过旧牵引距离时仍先攻击主角身边的危险", () => {
    const e = enemy("主角攻击者", 1110), f = fixture([e]);
    f.c.data.task = "follow";
    f.c.data.autoSupport = false;
    f.env.player = { ...f.env.player, x: 1160, y: 725 };
    e.targetId = "player";
    f.step(1000);
    expect(f.hits.some(h => h.id === e.id)).toBe(true);
  });
  it("默认战术优先主角攻击者，不先打自己身边的敌人", () => {
    const near = enemy("自身攻击者", 850, 785), threat = enemy("主角攻击者", 1150), f = fixture([near, threat]);
    f.c.data.task = "follow";
    f.c.data.autoSupport = false;
    f.env.player = { ...f.env.player, x: 990, y: 725 };
    near.targetId = "xiaobao";
    threat.targetId = "player";
    f.step(5);
    expect(f.c.targetId).toBe(threat.id);
    f.step(900);
    expect(f.hits[0]?.id).toBe(threat.id);
  });
  it("主角满血遇险也优先护卫，不启动远处村庄飞援", () => {
    const e = enemy("主角攻击者", 1140), f = fixture([e]);
    f.c.data.task = "follow";
    f.env.player = { ...f.env.player, x: 1040, y: 725 };
    e.targetId = "player";
    f.setFronts([front()]);
    f.step(5);
    expect(f.c.data.flight).toBeNull();
    expect(f.c.targetId).toBe(e.id);
  });
  it("识别正式追击但尚未出手的敌人，不主动攻击附近的家园怪", () => {
    const chasing = enemy("正在追击", 1120), passive = enemy("家园旁观", 850), f = fixture([chasing, passive]);
    f.c.data.task = "follow";
    f.c.data.autoSupport = false;
    f.env.player = { ...f.env.player, x: 1080, y: 725 };
    f.env.playerThreats = [chasing.id];
    f.step(5);
    expect(chasing.targetId).toBeUndefined();
    expect(f.c.targetId).toBe(chasing.id);
    const idle = fixture([passive]);
    idle.c.data.task = "follow";
    idle.c.data.autoSupport = false;
    idle.step(3000);
    expect(idle.hits).toHaveLength(0);
    expect(idle.c.targetId).toBeNull();
  });
  it("正在支援村庄时主角遇险，暂时转为护卫且不把援护伤害记到村庄战报", () => {
    const e = enemy("主角攻击者", 1140), f = fixture([e]);
    f.c.data.task = "follow";
    f.env.player = { ...f.env.player, x: 1040, y: 725 };
    e.targetId = "player";
    f.c.data.support = { key: "村庄支援", gate: "east-gate", age: 0, hits: 0, kills: 0, injured: false };
    f.setFronts([front()]);
    f.step(1000);
    expect(f.c.anchor(f.env)).toEqual({ x: 1040, y: 725, hp: 100, outside: true, region: "village" });
    expect(f.hits.some(h => h.id === e.id)).toBe(true);
    expect(f.c.data.support?.hits).toBe(0);
    expect(f.c.data.flight).toBeNull();
  });
  it("未释放的次要攻击让位给主角攻击者，取消不消耗真气和冷却", () => {
    const secondary = enemy("次要目标", 870, 800), threat = enemy("主角攻击者", 1120), f = fixture([secondary, threat]);
    f.c.data.task = "follow";
    f.c.data.autoSupport = false;
    f.env.player = { ...f.env.player, x: 1040, y: 725 };
    secondary.targetId = "xiaobao";
    threat.targetId = "player";
    f.c.start("rock", secondary);
    f.step(5);
    expect(f.c.data.cast?.target).toBe(threat.id);
    expect(f.c.data.cooldowns.rock).toBe(0);
    expect(f.c.data.qi).toBe(100);
  });
  it("技能全在冷却时仍能从护卫圈外赶来拦截，不被移动边界锁在原地", () => {
    const e = enemy("主角攻击者", 1210), f = fixture([e]);
    f.c.data.task = "follow";
    f.c.data.autoSupport = false;
    f.env.player = { ...f.env.player, x: 1260, y: 725 };
    e.targetId = "player";
    for (const skill of Object.keys(XIAOBAO_SKILLS) as (keyof typeof XIAOBAO_SKILLS)[]) f.c.data.cooldowns[skill] = 10000;
    f.step(1000);
    expect(f.c.targetId).toBe(e.id);
    expect(f.c.x).toBeGreaterThan(1000);
    expect(f.hits).toHaveLength(0);
  });
  it("主角撤出战圈后停止追敌并归队，等候指令保持原点", () => {
    const e = enemy("已远离的攻击者", 870), f = fixture([e]);
    f.c.data.task = "follow";
    f.c.data.autoSupport = false;
    f.c.targetId = e.id;
    e.targetId = "player";
    f.env.player = { ...f.env.player, x: 1500, y: 725 };
    f.step(5000);
    expect(f.c.targetId).toBeNull();
    expect(f.hits).toHaveLength(0);
    expect(Math.hypot(f.c.x - 1500, f.c.y - 725)).toBeLessThanOrEqual(220);
    f.c.command("wait", f.env);
    const waiting = { x: f.c.x, y: f.c.y };
    f.env.player.x = 1800;
    f.step(3000);
    expect({ x: f.c.x, y: f.c.y }).toEqual(waiting);
    f.c.command("return", f.env);
    f.step(5000);
    expect(Math.hypot(f.c.x - 1800, f.c.y - 725)).toBeLessThanOrEqual(220);
  });
});
describe("小宗师正式技能结算", () => {
  it("门外静止野怪仅被卫队看见，不锁住全村巡护；进入保护区才成为真实前线", () => {
    const s = initialState(),
      d = new EastDefense(s.defense, 0);
    const e = enemy("slime-2", 2320, 1100);
    d.external = [e];
    d.threats.set(e.id, {
      id: e.id,
      gateId: "east-gate",
      reason: "observe",
      lastSeen: 0,
      progress: 500,
      approachMs: 0,
      lastProgress: 0,
      assigned: [],
    });
    const w = { state: s, defense: d, sim: 0 } as unknown as World;
    expect(xiaobaoFronts(w, [])).toEqual([]);
    e.x = 2200;
    const actual = xiaobaoFronts(w, []);
    expect(actual).toHaveLength(1);
    expect(actual[0].enemies).toContain(e.id);
  });
  it("同一推进轮次先移动再收到警报，起飞提交保存当前根而非上一帧位置", () => {
    const f = fixture();
    f.c.data.task = "guard";
    f.c.data.gate = "east-gate";
    let calls = 0,
      saved = 0;
    f.env.fronts = () => (++calls < 2 ? [] : [front()]);
    f.env.checkpoint = (id) => {
      const snapshot = validateXiaobao(f.c.data, [], []);
      expect(snapshot.x).toBe(f.c.x);
      expect(snapshot.y).toBe(f.c.y);
      expect(Math.hypot(snapshot.x - 810, snapshot.y - 725)).toBeGreaterThan(1);
      f.c.confirmFlight(id);
      saved++;
    };
    f.c.tick(160, f.env, { queries: 2 });
    expect(saved).toBe(1);
    expect(f.c.data.flight?.stage).toBe("takeoff");
  });
  it("手动落点隔墙或越距取消未支付前摇，资源不足即时给出原因", () => {
    const e = enemy("a", 1180),
      f = fixture([e]);
    f.env.melee = (_a, b) => b.x !== 1000;
    f.c.start("rock", e, { x: 1000, y: 725 });
    f.step(5);
    expect(f.c.data.cast).toBeNull();
    expect(f.c.data.qi).toBe(100);
    expect(f.c.data.cooldowns.rock).toBe(0);
    f.c.data.task = "follow";
    f.env.recent = { id: e.id, at: f.env.now };
    f.c.data.qi = 10;
    expect(() => f.c.command("rock", f.env)).toThrow(/真气/);
    f.c.data.qi = 100;
    f.c.data.cooldowns.rock = 6000;
    expect(() => f.c.command("rock", f.env)).toThrow(/冷却/);
  });
  it("来袭敌人以小宝为正式攻击目标时允许完整保存恢复，任意未知目标仍拒绝", () => {
    const s = initialState();
    s.defense = prepareRaid(s.defense, s.player, "north-gate", 1);
    s.defense.raid!.members[0].targetId = "xiaobao";
    expect(validate(s).defense.raid!.members[0].targetId).toBe("xiaobao");
    s.defense.raid!.members[0].targetId = "不存在的角色";
    expect(() => validate(s)).toThrow(/存档/);
  });
  it("同一连续控制窗口最多800毫秒，恢复后1秒内新控制减半", () => {
    const e = enemy("控制样本");
    companionControl(e, 0, 600);
    companionControl(e, 550, 600);
    companionControl(e, 790, 600);
    expect(e.staggerUntil).toBe(800);
    companionControl(e, 850, 600);
    expect(e.staggerUntil).toBe(1150);
    const copy = {
      ...e,
      staggerUntil: 100,
      companionControlLimit: 200,
      companionControlGrace: 1100,
    };
    companionControl(copy, 50, 600);
    expect(copy.staggerUntil).toBe(200);
  });
  it("危急護阵替代未释放攻击，稳健与护人战术留足护阵真气", () => {
    const e = enemy("a"),
      f = fixture([e]);
    f.c.data.task = "follow";
    f.env.recent = { id: e.id, at: 0 };
    f.c.start("thunder", e);
    f.env.allies = [
      {
        id: "player",
        x: 820,
        y: 725,
        hp: 20,
        maxHP: 100,
        role: "player",
        threatAt: 500,
      },
    ];
    f.step(5);
    expect(f.c.data.cast?.skill).toBe("guard");
    expect(f.c.data.cast?.age).toBe(0);
    expect(f.c.data.cooldowns.thunder).toBe(0);
    f.step(100);
    expect(f.c.data.shields[0].amount).toBe(120);
  });
  it("新决定的技能和起飞不借用决定前的5毫秒，普通警报留下真实战报", () => {
    const e = enemy("a"),
      f = fixture([e]);
    e.hp = 72;
    f.c.data.task = "follow";
    f.env.player = { ...f.env.player, x: 810, y: 725 };
    f.env.recent = { id: e.id, at: 0 };
    f.step(5);
    expect(f.c.data.cast?.age).toBe(0);
    f.step(139);
    expect(f.hits).toHaveLength(0);
    f.step(1);
    expect(f.hits).toHaveLength(1);
    const normal = fixture();
    normal.c.data.task = "guard";
    normal.setFronts([{ ...front(), major: false }]);
    normal.step(5);
    normal.setFronts([]);
    normal.step(2000);
    expect(normal.c.data.reports.at(-1)).toMatchObject({
      event: "真实来袭",
      hits: 0,
      gate: "east-gate",
    });
    const a = fixture();
    a.setFronts([front()]);
    a.step(5);
    expect(a.c.data.flight?.age).toBe(0);
    a.step(195);
    expect(a.c.airborne).toBe(false);
    a.step(5);
    expect(a.c.airborne).toBe(true);
  });
  it("等候点不主动拉怪，护人战术先处理低血友军真实攻击者", () => {
    const near = enemy("near", 900),
      threat = enemy("threat", 1030),
      f = fixture([near, threat]);
    f.c.data.task = "follow";
    f.c.data.tactic = "protect";
    f.c.data.wait = { x: 810, y: 725, region: "village" };
    f.step(200);
    expect(f.hits).toHaveLength(0);
    expect(f.c.data.cast).toBeNull();
    f.c.data.wait = null;
    f.env.player = {
      x: 850,
      y: 725,
      hp: 100,
      outside: true,
      region: "village",
    };
    near.targetId = "player";
    threat.targetId = "player";
    f.env.allies = [
      {
        id: "player",
        x: 850,
        y: 725,
        hp: 20,
        maxHP: 100,
        role: "player",
        threatAt: 5000,
      },
    ];
    f.step(150);
    expect(f.c.targetId).not.toBeNull();
    expect(f.c.data.cast).not.toBeNull();
  });
  it("听风掌只打前方三个合法目标，前摇和后摇不重复扣血", () => {
    const es = [
        enemy("a"),
        enemy("b", 875, 730),
        enemy("c", 875, 720),
        enemy("d", 880, 725),
        enemy("back", 755, 725),
      ],
      f = fixture(es);
    expect(f.c.start("palm", es[0])).toBe(true);
    f.step(139);
    expect(f.hits).toHaveLength(0);
    f.step(401);
    expect(f.hits.map((h) => h.id).sort()).toEqual(["a", "b", "c"]);
    expect(f.hits.every((h) => h.amount === 72)).toBe(true);
    expect(f.c.data.cast).toBeNull();
  });
  it("三叠掌三次释放，取消未释放后段不会退款或重打", () => {
    const e = enemy("a"),
      f = fixture([e]);
    f.c.start("triple", e);
    f.step(180);
    expect(f.hits.map((h) => h.amount)).toEqual([52]);
    f.step(240);
    expect(f.hits.map((h) => h.amount)).toEqual([52, 64]);
    f.step(280);
    expect(f.hits.map((h) => h.amount)).toEqual([52, 64, 96]);
    const cooldown = f.c.data.cooldowns.triple;
    f.c.cancel();
    f.step(200);
    expect(f.hits).toHaveLength(3);
    expect(f.c.data.cooldowns.triple).toBe(cooldown - 200);
  });
  it("目标死亡或隔墙取消前摇，不支付真气或冷却", () => {
    for (const blocked of [true, false]) {
      const e = enemy("a"),
        f = fixture([e]);
      f.c.start("thunder", e);
      if (blocked) f.env.melee = () => false;
      else e.hp = 0;
      f.step(420);
      expect(f.hits).toHaveLength(0);
      expect(f.c.data.qi).toBe(100);
      expect(f.c.data.cooldowns.thunder).toBe(0);
      expect(f.c.data.cast).toBeNull();
    }
  });
  it("星指连续扫掠穿透两个目标，后一个只有72伤害", () => {
    const es = [enemy("a", 910), enemy("b", 950), enemy("c", 990)],
      f = fixture(es);
    f.c.start("star", es[0]);
    f.step(1200);
    expect(f.hits.map((h) => [h.id, h.amount])).toEqual([
      ["a", 96],
      ["b", 72],
    ]);
    expect(f.c.data.effects).toHaveLength(0);
  });
  it("回风刃去回各打一次、每段最多四个，并在墙前折返", () => {
    const es = [0, 1, 2, 3, 4].map((i) => enemy(String(i), 880 + i * 50)),
      f = fixture(es);
    f.env.melee = (a, b) => a.x <= 1160 && b.x <= 1160;
    f.c.start("blade", es[0]);
    f.step(1700);
    expect(f.hits.filter((h) => h.amount === 90)).toHaveLength(4);
    expect(f.hits.filter((h) => h.amount === 54)).toHaveLength(4);
    for (const e of es)
      expect(f.hits.filter((h) => h.id === e.id).length).toBeLessThanOrEqual(2);
    expect(f.c.data.effects).toHaveLength(0);
  });
  for (const [skill, total, duration] of [
    ["rock", 240, 1600],
    ["fire", 210, 4500],
    ["thunder", 180, 700],
    ["unity", 440, 3800],
  ] as const)
    it(`${XIAOBAO_SKILLS[skill].name}总伤害、实例终点与正式时序`, () => {
      const e = enemy("a", 1000),
        f = fixture([e]);
      f.c.start(skill, e);
      f.step(duration);
      expect(f.hits.reduce((n, h) => n + h.amount, 0)).toBe(total);
      expect(f.hits.map((h) => h.time)).toEqual(XIAOBAO_SKILLS[skill].times);
      expect(f.c.data.effects).toHaveLength(0);
    });
  it("自动群攻锁释放位置，手动群攻锁下令位置", () => {
    for (const manual of [false, true]) {
      const e = enemy("a", 1000),
        f = fixture([e]);
      f.c.start("rock", e, manual ? { x: 1000, y: 725 } : undefined);
      f.step(695);
      e.x = 1180;
      f.step(5);
      expect(f.c.data.effects[0].center.x).toBe(manual ? 1000 : 1180);
      expect(f.hits).toHaveLength(manual ? 0 : 1);
    }
  });
  it("雷链只跳真实且不同的敌人，五跳合计520", () => {
    const es = Array.from({ length: 5 }, (_, i) =>
        enemy(String(i), 1000 + i * 100),
      ),
      f = fixture(es);
    f.c.start("chain", es[0]);
    f.step(1200);
    expect(f.hits.map((h) => h.amount)).toEqual([144, 120, 100, 84, 72]);
    expect(new Set(f.hits.map((h) => h.id)).size).toBe(5);
  });
  it("已释放领域在调息、换任务后仍推进，恢复不重放已有命中", () => {
    const e = enemy("a", 1000),
      f = fixture([e]);
    f.c.start("fire", e);
    f.step(1200);
    expect(f.hits).toHaveLength(2);
    f.c.data.hp = 0;
    f.c.data.rest = 30000;
    f.c.data.cast = null;
    f.c.data.task = "guard";
    f.c.taskChanged();
    const saved = structuredClone(f.c.data),
      loaded = new XiaobaoCombat();
    loaded.bind(structuredClone(saved), true);
    f.c.bind(saved, true);
    f.step(3200);
    expect(f.hits.map((h) => h.amount)).toEqual([60, 30, 30, 30, 30, 30]);
    expect(f.c.data.rest).toBe(26800);
    expect(loaded.data.effects[0].stage).toBe(2);
  });
  it("同时重叠火域与归元火息同一时刻只扣较高的一份", () => {
    const e = enemy("a", 1000),
      f = fixture([e]);
    f.c.start("fire", e);
    f.step(400);
    const first = structuredClone(f.c.data.effects[0]);
    const duplicate = structuredClone(first);
    duplicate.id += "另一个";
    f.c.data.effects.push(duplicate);
    f.step(800);
    expect(f.hits.map((h) => h.amount)).toEqual([60, 30]);
  });
  it("护盾最多五人、不叠加，按护甲减伤护盾顺序且不会治疗", () => {
    const f = fixture();
    f.env.allies = Array.from({ length: 6 }, (_, i) => ({
      id: String(i),
      x: 810 + i * 5,
      y: 725,
      hp: 20 + i,
      maxHP: 100,
      role: "guard",
      threatAt: i === 4 ? 100 : null,
    }));
    f.c.shield(f.env, 96, 2500, "一次");
    f.c.shield(f.env, 96, 2000, "第二次");
    expect(f.c.data.shields).toHaveLength(5);
    expect(
      f.c.data.shields.every((s) => s.amount === 120 && s.remaining === 2500),
    ).toBe(true);
    const shield = { amount: 120, remaining: 2000 },
      result = resolveDamage(
        {
          sourceId: "e",
          targetId: "xiaobao",
          attackId: "一次",
          amount: 200,
          sourceType: "enemy-melee",
          eventId: null,
        },
        { id: "e", hp: 1, faction: "hostile", armor: 0 },
        {
          id: "xiaobao",
          hp: 50,
          faction: "village",
          armor: 12,
          reduction: 0.8,
          shield,
        },
      );
    expect(result.hp).toBe(50);
    expect(shield.amount).toBeCloseTo(82.4);
    expect(result.damage).toBe(0);
  });
  it("救急实际连续位移、墙前止步，不穿水墙也不无限追人", () => {
    const e = enemy("a", 940),
      f = fixture([e]);
    f.env.blocked = (p) => p.x > 875;
    f.env.clear = (_a, b) => b.x <= 875;
    f.c.start("rescue", e, { x: 950, y: 725 });
    let previous = f.c.x;
    for (let i = 0; i < 96; i++) {
      f.step(5);
      expect(f.c.x - previous).toBeLessThanOrEqual(3.501);
      previous = f.c.x;
    }
    expect(f.c.x).toBeLessThanOrEqual(875);
    expect(f.hits).toHaveLength(0);
    expect(f.c.data.cast).toBeNull();
  });
});
describe("飞援、委托与结构8保存", () => {
  it("飞援接受仅请求一次提交，未确认不离地；确认或有效存档恢复后继续", () => {
    const f = fixture(),
      requests: string[] = [];
    f.env.checkpoint = (id) => requests.push(id);
    f.setFronts([front()]);
    f.step(1000);
    expect(requests).toHaveLength(1);
    expect(f.c.airborne).toBe(false);
    expect(f.c.data.flight?.age).toBe(200);
    expect(f.c.data.cooldowns.flight).toBe(0);
    const saved = validateXiaobao(f.c.data, [], []),
      loaded = new XiaobaoCombat();
    loaded.bind(saved, true);
    loaded.tick(5, f.env, { queries: 2 });
    expect(loaded.airborne).toBe(true);
    f.c.confirmFlight(requests[0]);
    f.step(5);
    expect(f.c.airborne).toBe(true);
    expect(f.c.data.cooldowns.flight).toBe(30000);
    const bad = structuredClone(saved);
    bad.flight!.stage = "landing";
    bad.flight!.age = 0;
    expect(() => validateXiaobao(bad, [], [])).toThrow(/小宝/);
  });
  it("耗尽支援航程后仅安全返降，不放护印，不接受新增前线改道", () => {
    const f = fixture();
    f.setFronts([front()]);
    f.step(205);
    f.c.data.flight!.travelled = 4999;
    f.step(5);
    expect(f.c.data.flight!.active).toBe(false);
    f.setFronts([front("更高前线", "north-gate", 5)]);
    f.step(1000);
    expect(f.c.data.flight).toBeNull();
    expect(f.c.history.filter((e) => e.kind === "shield")).toHaveLength(0);
  });
  it("普通观察不升空、重大事件飞行不回气，连续到场只落印一次", () => {
    const f = fixture();
    const alarm = front();
    f.setFronts([{ ...alarm, major: false }]);
    f.step(150);
    expect(f.c.data.flight).toBeNull();
    f.c.data.qi = 0;
    f.setFronts([alarm]);
    f.step(150);
    expect(f.c.data.flight?.stage).toBe("takeoff");
    const qi = f.c.data.qi;
    const launchClock = f.c.data.clock + (200 - f.c.data.flight!.age);
    f.step(200);
    expect(f.c.airborne).toBe(true);
    expect(f.c.data.cooldowns.flight).toBe(
      30000 - (f.c.data.clock - launchClock),
    );
    const previous = { x: f.c.x, y: f.c.y };
    f.step(5);
    expect(
      Math.hypot(f.c.x - previous.x, f.c.y - previous.y),
    ).toBeLessThanOrEqual(8.001);
    expect(f.c.data.qi).toBe(qi);
    f.env.allies = [
      {
        id: "player",
        ...alarm.point,
        hp: 100,
        maxHP: 100,
        role: "player",
        threatAt: null,
      },
    ];
    f.step(900);
    expect(f.c.data.flight).toBeNull();
    expect(f.c.history.filter((e) => e.kind === "landing")).toHaveLength(1);
    expect(f.c.data.shields[0].amount).toBe(120);
    f.step(300);
    expect(f.c.metrics.flights).toBe(1);
  });
  it("警报解除在起飞前取消且冷却仍为零；空中解除无落印", () => {
    for (const airborne of [false, true]) {
      const f = fixture();
      f.setFronts([front()]);
      f.step(airborne ? 205 : 5);
      f.setFronts([]);
      f.step(1200);
      expect(f.c.data.flight).toBeNull();
      expect(f.c.data.shields).toHaveLength(0);
      expect(f.c.data.cooldowns.flight > 0).toBe(airborne);
    }
  });
  it("短航程均匀飞行至少200毫秒，落点被占重新选择而不塞坐标", () => {
    const f = fixture(),
      alarm = front();
    alarm.point = { x: 900, y: 725 };
    f.setFronts([alarm]);
    f.c.beginFlight(alarm, f.env);
    f.step(300);
    expect(f.c.data.flight?.stage).toBe("cruise");
    expect(f.c.x).toBeCloseTo(855);
    f.env.blocked = (p) => p.x === 900 && p.y === 725;
    f.step(700);
    expect(f.c.data.flight).toBeNull();
    expect(f.c.x === 900 && f.c.y === 725).toBe(false);
  });
  it("主备用落点全失效先悬停，150毫秒有界查探，恢复地面后安全降落无护印", () => {
    const f = fixture(),
      alarm = front();
    f.setFronts([alarm]);
    f.step(205);
    f.env.blocked = () => true;
    f.step(1000);
    expect(f.c.data.flight?.stage).toBe("hover");
    const before = f.c.metrics.landingChecks;
    f.step(500);
    expect(f.c.metrics.landingChecks - before).toBeLessThanOrEqual(32);
    f.env.blocked = () => false;
    f.step(1600);
    expect(f.c.data.flight).toBeNull();
    expect(f.c.data.shields).toHaveLength(0);
  });
  it("随行关闭回援、调息与护主危急分别挡住自动起飞", () => {
    for (const mode of ["关闭", "调息", "护主"]) {
      const f = fixture();
      f.c.data.task = "follow";
      f.setFronts([front()]);
      if (mode === "关闭") f.c.data.autoSupport = false;
      if (mode === "调息") {
        f.c.data.hp = 0;
        f.c.data.rest = 30000;
      }
      if (mode === "护主") {
        f.env.player.hp = 20;
        f.env.allies = [
          {
            id: "player",
            x: 740,
            y: 780,
            hp: 20,
            maxHP: 100,
            role: "player",
            threatAt: 400,
          },
        ];
      }
      f.step(200);
      expect(f.c.data.flight).toBeNull();
    }
  });
  it("飞行存档保持空中投影根、冷却和任务，零时步冻结全部状态", () => {
    const f = fixture();
    f.c.data.task = "follow";
    f.setFronts([front()]);
    f.step(350);
    const saved = validateXiaobao(f.c.data, [], []),
      loaded = new XiaobaoCombat();
    loaded.bind(structuredClone(saved), true);
    expect([loaded.x, loaded.y]).toEqual([f.c.x, f.c.y]);
    expect(loaded.airborne).toBe(true);
    expect(loaded.data.task).toBe("follow");
    const before = loaded.snapshot();
    loaded.tick(0, f.env, { queries: 2 });
    expect(loaded.snapshot()).toEqual(before);
    expect(loaded.data.cooldowns.flight).toBe(f.c.data.cooldowns.flight);
  });
  it("结构7旧存档迁移默认完整小宝，非法飞行和未释放阶段拒绝", () => {
    const old = initialState("旅人") as any;
    old.schema_version = 7;
    delete old.xiaobao;
    const current = validate(old);
    expect(current.schema_version).toBe(initialState().schema_version);
    expect(current.xiaobao).toEqual(initialXiaobao());
    const f = fixture([enemy(enemyDefs[0].id)]);
    f.c.start("fire", f.env.enemies[0]);
    f.c.data.cast!.stage = 1;
    expect(() => validateXiaobao(f.c.data, [], [])).toThrow(/小宝/);
    const fly = fixture();
    fly.setFronts([front()]);
    fly.step(205);
    fly.c.data.flight!.travelled = 5001;
    expect(() => validateXiaobao(fly.c.data, [], [])).toThrow(/小宝/);
  });
});
