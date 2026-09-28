import {creatureMaxHP} from '../../data/maps/windbell/elites';
import {historicalRaidMember} from '../../data/demonKing';
import {ENCOUNTER_UNITS,encounterUnit} from "../../data/maps/windbell/encounters";
import {unitState,type EncounterState} from "./encounterState";
import {validOutdoorPoint} from "../../data/maps/windbell/bounds";
import { XIAOBAO } from "../../data/xiaobao";
import {
  XIAOBAO_SKILLS,
  type XiaobaoSkill,
  type XiaobaoTask,
  type XiaobaoTactic,
} from "../../data/xiaobaoCombat";
import { RAID_GATES, GUARD_DEFS, type GateId } from "../../data/defense";
import { PEOPLE } from "../../data/npcLife";
import { enemyDefs, WORLD } from "../../data/world";
import { enemyProfile } from "../../data/enemies";
import { motionBlocked, type Point } from "./obstacles";
export type XiaobaoCast = {
  id: string;
  skill: Exclude<XiaobaoSkill, "flight">;
  age: number;
  stage: number;
  released: boolean;
  fixedCenter: boolean;
  origin: Point;
  center: Point;
  direction: Point;
  target: string | null;
  task: XiaobaoTask;
};
export type XiaobaoEffect = XiaobaoCast & {
  hit: string[];
  last: Point;
  returnAt: number;
  travelled: number;
};
export type XiaobaoFlight = {
  id: string;
  key: string;
  gate: GateId | null;
  priority: number;
  stage: "takeoff" | "cruise" | "hover" | "landing";
  age: number;
  origin: Point;
  goal: Point;
  backups: Point[];
  safe: Point;
  travelled: number;
  leg: number;
  rerouted: boolean;
  active: boolean;
  imprint: boolean;
};
export type XiaobaoState = {
  known: boolean;
  task: XiaobaoTask;
  gate: GateId | "all";
  tactic: XiaobaoTactic;
  autoSupport: boolean;
  x: number;
  y: number;
  hp: number;
  qi: number;
  clock: number;
  serial: number;
  cooldowns: Record<XiaobaoSkill, number>;
  rest: number;
  recovery: number;
  peace: number;
  reduction: number;
  shields: { id: string; amount: number; remaining: number }[];
  cast: XiaobaoCast | null;
  effects: XiaobaoEffect[];
  flight: XiaobaoFlight | null;
  support: {
    key: string;
    gate: GateId;
    age: number;
    hits: number;
    kills: number;
    injured: boolean;
  } | null;
  alarmCycle: number;
  alarmActive: boolean;
  responded: string[];
  command: {
    kind: "focus" | "protect" | "rock" | "fire" | "thunder" | "unity";
    target: string | null;
    center: Point;
    remaining: number;
  } | null;
  wait: (Point & { region: string }) | null;
  affected: {
    id: string;
    hp: number;
    x: number;
    y: number;
    control: number;
    controlGrace: number;
    controlLimit: number;
    space: "village";
  }[];
  reports: {
    event: string;
    gate: GateId;
    hits: number;
    kills: number;
    injured: boolean;
    result: string;
    time: number;
  }[];
};
export function initialXiaobao(): XiaobaoState {
  return {
    known: false,
    task: "free",
    gate: "all",
    tactic: "steady",
    autoSupport: true,
    ...XIAOBAO.home,
    hp: 640,
    qi: 100,
    clock: 0,
    serial: 0,
    cooldowns: Object.fromEntries(
      Object.keys(XIAOBAO_SKILLS).map((k) => [k, 0]),
    ) as XiaobaoState["cooldowns"],
    rest: 0,
    recovery: 0,
    peace: 6000,
    reduction: 0,
    shields: [],
    cast: null,
    effects: [],
    flight: null,
    support: null,
    alarmCycle: 0,
    alarmActive: false,
    responded: [],
    command: null,
    wait: null,
    affected: [],
    reports: [],
  };
}
// 来自外部备份的状态必须完整校验，不把未知字段或越界实例发布到世界。
export function validateXiaobao(
  raw: unknown,
  killed: readonly string[],
  raidIds: readonly string[],
  encounters?:EncounterState,
): XiaobaoState {
  const s = structuredClone(raw) as XiaobaoState;
  const fail = () => {
    throw Error("小宝存档状态无效，上一份有效存档仍保留。");
  };
  const n = (v: unknown, max: number, min = 0) =>
    typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
  const text = (v: unknown) =>
    typeof v === "string" && v.length > 0 && v.length <= 160;
  const point = (p: Point) =>
    !!p && validOutdoorPoint(p);
  const gate = (v: unknown) => RAID_GATES.some((g) => g.id === v);
  const task = (v: unknown) =>
    ["free", "guard", "follow"].includes(v as string);
  const enemy = (v: unknown) =>
    enemyDefs.some((e) => e.id === v) ||
    ENCOUNTER_UNITS.some(e=>e.id===v) ||
    raidIds.includes(v as string) ||
    historicalRaidMember(v);
  const ally = (v: unknown) =>
    [
      "player",
      "xiaobao",
      ...GUARD_DEFS.map((g) => g.id),
      ...PEOPLE.map((p) => p.id),
    ].includes(v as string);
  const ids = (v: unknown, max: number, valid: (v: unknown) => boolean) =>
    Array.isArray(v) &&
    v.length <= max &&
    new Set(v).size === v.length &&
    v.every(valid);
  const skills = Object.keys(XIAOBAO_SKILLS) as XiaobaoSkill[];
  if (
    !s ||
    !point(s) ||
    !task(s.task) ||
    !(s.gate === "all" || gate(s.gate)) ||
    !["steady", "protect", "full"].includes(s.tactic) ||
    typeof s.known !== "boolean" ||
    typeof s.autoSupport !== "boolean" ||
    !n(s.hp, 640) ||
    !n(s.qi, 100) ||
    !n(s.clock, 1e12) ||
    !n(s.serial, 1e9) ||
    !Number.isSafeInteger(s.serial) ||
    !n(s.rest, 30000) ||
    !n(s.recovery, 5000) ||
    !n(s.peace, 6000) ||
    !n(s.reduction, 600) ||
    (s.hp === 0) !== s.rest > 0 ||
    !s.cooldowns ||
    Object.keys(s.cooldowns).length !== skills.length ||
    !skills.every((k) => n(s.cooldowns[k], XIAOBAO_SKILLS[k].cooldown)) ||
    !Array.isArray(s.shields) ||
    s.shields.length > 24 ||
    !ids(
      s.shields.map((a) => a?.id),
      24,
      ally,
    ) ||
    !s.shields.every((a) => n(a.amount, 120) && n(a.remaining, 2500))
  )
    fail();
  const cast = (c: XiaobaoCast) =>
    c &&
    text(c.id) &&
    skills.includes(c.skill) &&
    c.skill !== ("flight" as string) &&
    n(c.age, 5000) &&
    Number.isInteger(c.stage) &&
    n(
      c.stage,
      c.skill === "rescue" ? 2 : XIAOBAO_SKILLS[c.skill].times.length,
    ) &&
    typeof c.released === "boolean" &&
    typeof c.fixedCenter === "boolean" &&
    point(c.origin) &&
    point(c.center) &&
    !!c.direction &&
    n(c.direction.x, 1, -1) &&
    n(c.direction.y, 1, -1) &&
    Math.abs(Math.hypot(c.direction.x, c.direction.y) - 1) < 0.001 &&
    (c.target === null || enemy(c.target)) &&
    task(c.task);
  if (
    (s.cast !== null &&
      (!cast(s.cast) ||
        s.cast.age >= XIAOBAO_SKILLS[s.cast.skill].recovery ||
        s.cast.stage >
          (s.cast.skill === "triple" ? 3 : s.cast.skill === "rescue" ? 2 : 1) ||
        s.cast.released !== s.cast.stage > 0)) ||
    !Array.isArray(s.effects) ||
    s.effects.length > 5 ||
    !ids(
      s.effects.map((e) => e.id),
      5,
      text,
    ) ||
    !s.effects.every(
      (e) =>
        cast(e) &&
        e.released &&
        ["star", "blade", "rock", "fire", "chain", "unity"].includes(e.skill) &&
        ids(e.hit, 168, (v) => text(v)) &&
        point(e.last) &&
        n(e.returnAt, 480) &&
        n(e.travelled, 720),
    ) ||
    s.effects.filter((e) => ["star", "blade"].includes(e.skill)).length > 2 ||
    s.effects.filter((e) => ["rock", "fire", "unity"].includes(e.skill))
      .length > 2 ||
    s.effects.filter((e) => e.skill === "chain").length > 1
  )
    fail();
  if (s.flight) {
    const f = s.flight;
    if (
      !text(f.id) ||
      !text(f.key) ||
      !(f.gate === null || gate(f.gate)) ||
      !n(f.priority, 5) ||
      !["takeoff", "cruise", "hover", "landing"].includes(f.stage) ||
      !n(f.age, 1e9) ||
      !point(f.origin) ||
      !point(f.goal) ||
      !point(f.safe) ||
      !Array.isArray(f.backups) ||
      f.backups.length > 2 ||
      !f.backups.every(point) ||
      !n(f.travelled, 5000) ||
      !n(f.leg, 5000) ||
      typeof f.rerouted !== "boolean" ||
      typeof f.active !== "boolean" ||
      typeof f.imprint !== "boolean" ||
      (f.stage === "takeoff" && f.age > 200) ||
      (f.stage === "landing" && f.age > 250)
    )
      fail();
    if (
      s.cast !== null ||
      (f.stage === "takeoff" &&
        Math.hypot(s.x - f.origin.x, s.y - f.origin.y) > 0.1) ||
      (f.stage === "landing" &&
        (Math.hypot(s.x - f.goal.x, s.y - f.goal.y) > 0.1 ||
          motionBlocked(s.x, s.y))) ||
      (f.active && (!s.support || s.support.gate !== f.gate))
    )
      fail();
  }
  if (
    !n(s.alarmCycle, 1e9) ||
    !Number.isSafeInteger(s.alarmCycle) ||
    typeof s.alarmActive !== "boolean" ||
    !ids(s.responded, 32, text) ||
    (s.command &&
      (!["focus", "protect", "rock", "fire", "thunder", "unity"].includes(
        s.command.kind,
      ) ||
        !(s.command.target === null || enemy(s.command.target)) ||
        !point(s.command.center) ||
        !n(s.command.remaining, 5000))) ||
    (s.wait &&
      (!point(s.wait) ||
        !["village", "forest", "ruins", "north", "south", "west"].includes(
          s.wait.region,
        )))
  )
    fail();
  if (
    s.support &&
    (!text(s.support.key) ||
      !gate(s.support.gate) ||
      !n(s.support.age, 1e9) ||
      !n(s.support.hits, 1e6) ||
      !n(s.support.kills, 1000) ||
      typeof s.support.injured !== "boolean")
  )
    fail();
  if (Array.isArray(s.affected))
    for (const e of s.affected)
      if (e && e.controlLimit === undefined) e.controlLimit = e.control;
  if (
    !Array.isArray(s.affected) ||
    !ids(
      s.affected.map((e) => e?.id),
      enemyDefs.length+ENCOUNTER_UNITS.length,
      (id) => enemyDefs.some((e) => e.id === id)||ENCOUNTER_UNITS.some(e=>e.id===id),
    ) ||
    !s.affected.every(
      (e) =>
        !killed.includes(e.id) &&
        (!encounterUnit(e.id)||(!!encounters&&!unitState(encounters,e.id)!.defeated)) &&
        point(e) &&
        n(
          e.hp,
          creatureMaxHP((enemyDefs.find((d) => d.id === e.id)??encounterUnit(e.id))!.type,encounterUnit(e.id)?.elite),
          0.001,
        ) &&
        n(e.control, 800) &&
        n(e.controlGrace, 1000) &&
        n(e.controlLimit, 800) &&
        e.space === "village",
    ) ||
    !Array.isArray(s.reports) ||
    s.reports.length > 10 ||
    !s.reports.every(
      (r) =>
        text(r.event) &&
        gate(r.gate) &&
        n(r.hits, 1e6) &&
        n(r.kills, 1000) &&
        typeof r.injured === "boolean" &&
        text(r.result) &&
        n(r.time, 1e8),
    )
  )
    fail();
  if (
    s.flight === undefined ||
    s.support === undefined ||
    s.command === undefined ||
    s.wait === undefined ||
    (s.hp === 0 && (s.cast !== null || s.flight !== null)) ||
    (s.flight !== null && typeof s.flight !== "object") ||
    (s.support !== null && typeof s.support !== "object") ||
    (s.command !== null && typeof s.command !== "object") ||
    (s.wait !== null && typeof s.wait !== "object")
  )
    fail();
  if ((!s.flight || s.flight.stage === "takeoff") && motionBlocked(s.x, s.y)) {
    const safe = [
      s,
      ...Array.from({ length: 15 }, (_, i) => ({
        x: s.x + Math.cos((i * Math.PI) / 4) * (i < 8 ? 88 : 130),
        y: s.y + Math.sin((i * Math.PI) / 4) * (i < 8 ? 88 : 130),
      })),
    ].some((p) => point(p) && !motionBlocked(p.x, p.y));
    if (!safe) fail();
  }
  // 明确白名单；所有嵌套对象也从定义字段取值。
  const pick = <T extends object>(v: T, keys: readonly string[]): T =>
    Object.fromEntries(
      keys.map((k) => [k, (v as Record<string, unknown>)[k]]),
    ) as T;
  const castKeys = [
    "id",
    "skill",
    "age",
    "stage",
    "released",
    "fixedCenter",
    "origin",
    "center",
    "direction",
    "target",
    "task",
  ];
  const cleanPoint = (p: Point) => ({ x: p.x, y: p.y });
  const cleanCast = <T extends XiaobaoCast>(c: T): T => ({
    ...c,
    origin: cleanPoint(c.origin),
    center: cleanPoint(c.center),
    direction: cleanPoint(c.direction),
  });
  if (s.cast) s.cast = cleanCast(pick(s.cast, castKeys));
  s.effects = s.effects.map((e) => ({
    ...cleanCast(
      pick(e, [...castKeys, "hit", "last", "returnAt", "travelled"]),
    ),
    last: cleanPoint(e.last),
  }));
  if (s.flight)
    s.flight = pick(s.flight, [
      "id",
      "key",
      "gate",
      "priority",
      "stage",
      "age",
      "origin",
      "goal",
      "backups",
      "safe",
      "travelled",
      "leg",
      "rerouted",
      "active",
      "imprint",
    ]);
  if (s.flight) {
    s.flight.origin = cleanPoint(s.flight.origin);
    s.flight.goal = cleanPoint(s.flight.goal);
    s.flight.safe = cleanPoint(s.flight.safe);
    s.flight.backups = s.flight.backups.map(cleanPoint);
  }
  s.shields = s.shields.map((a) => pick(a, ["id", "amount", "remaining"]));
  s.affected = s.affected.map((e) =>
    pick(e, [
      "id",
      "hp",
      "x",
      "y",
      "control",
      "controlGrace",
      "controlLimit",
      "space",
    ]),
  );
  s.reports = s.reports.map((r) =>
    pick(r, ["event", "gate", "hits", "kills", "injured", "result", "time"]),
  );
  if (s.support)
    s.support = pick(s.support, [
      "key",
      "gate",
      "age",
      "hits",
      "kills",
      "injured",
    ]);
  if (s.command)
    s.command = pick(s.command, ["kind", "target", "center", "remaining"]);
  if (s.wait) s.wait = pick(s.wait, ["x", "y", "region"]);
  return pick(s, Object.keys(initialXiaobao()));
}
