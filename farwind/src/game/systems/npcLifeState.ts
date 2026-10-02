import {XIAOBAO_WISHES,type XiaobaoWish} from './xiaobaoLifeState';
import {validOutdoorPoint} from "../../data/maps/windbell/bounds";
import {VILLAGE_ANCHORS} from '../../data/maps/windbell/layout';
import {
  PEOPLE,
  FACILITIES,
  HOMES,
  LIFE,
  ROOM,
  MAINTENANCE,
  PRIVATE_STORAGE,
  type ResidentId,
  type SpaceId,
  type Place,
  type Activity,
} from "../../data/npcLife";
export type Relation = {
  familiar: number;
  trust: number;
  wariness: number;
  lastPositive: number;
};
export type LifeEvent = {
  id: string;
  sequence: number;
  time: number;
  kind:
    | "alarm"
    | "clear"
    | "injury"
    | "down"
    | "death"
    | "damage"
    | "care"
    | "repair"
    | "help"
    | "visit"
    | "access"
    | "company"
    | "report"
    | "activity";
  place: Place;
  source: string;
  subjects: string[];
  result: string;
  debug: boolean;
};
export type Memory = {
  eventId: string;
  sequence: number;
  kind: LifeEvent["kind"];
  time: number;
  subjects: string[];
  result: string;
  source: "seen" | "alarm" | "report";
  importance: number;
  expires: number;
};
export type Action = {
  xiaobao?: {wish:XiaobaoWish;partner:ResidentId|null;material?:'wood'};
  social?: { partner: ResidentId; occasion: number } | null;
  id: number;
  kind: Activity;
  target: Place;
  facility: string | null;
  task: string | null;
  pickup: Place | null;
  phase: "collect" | "stock" | "travel" | "perform";
  progress: number;
  duration: number;
  started: number;
  failures: number;
  label: string;
};
export type PersonState = {
  id: ResidentId;
  body:
    | (Place & {
        hp: number;
        health: "healthy" | "hurt" | "down" | "convalescent";
        episode: number;
        recoverAt: number;
      })
    | null;
  action: Action | null;
  serial: number;
  committed: number;
  needs: { hunger: number; fatigue: number };
  emotion: number;
  gear: "locker" | "carried";
  supplies: { medicine: number; wood: number };
  blockedTarget: Place | null;
  blockedUntil: number;
  project: number;
  nextDecision: number;
  reason: string;
  pathFailures: number;
  alarm: 0 | 1 | 2;
  relations: Record<string, Relation>;
  memories: Memory[];
  receipt: number;
  receipts: number[];
  receiptFloor: number;
  known: Record<string, Place & { time: number }>;
  lastSupplyDay: number;
  lastMealDay: number;
  social: {
    cooldownUntil: number;
    occasionFloor: number;
    visited: Partial<Record<ResidentId, number>>;
  };
  speech: {
    eventFloor: number;
    nextAt: number;
    day: number;
    routines: Activity[];
  };
};
export type Reservation = {
  facility: string;
  owner: ResidentId;
  expires: number;
};
export type LifeTask = {
  id: string;
  kind: "treat" | "repair";
  subject: string;
  place: Place;
  owner: ResidentId | null;
  expires: number;
  attempts: number;
  retryAt: number;
};
export type LifeState = {
  version: 5;
  speechAt: number;
  speechUrgentAt: number;
  speechEventFloor: number;
  unavailable: {
    homes: Partial<Record<SpaceId, boolean>>;
    facilities: string[];
  };
  people: PersonState[];
  elapsed: number;
  sequence: number;
  events: LifeEvent[];
  reservations: Reservation[];
  tasks: LifeTask[];
  alarm: 0 | 1 | 2;
  clearSince: number | null;
  stores: {
    medicine: number;
    herbs: number;
    wood: number;
    food: number;
    day: number;
  };
  facilities: Record<string, number>;
  playerSpace: SpaceId;
  outside: { x: number; y: number };
  invitations: Partial<Record<SpaceId, number>>;
  observed: Partial<
    Record<ResidentId, { time: number; label: string; space: SpaceId }>
  >;
  lastDefenseSequence: number;
  defenseReceipts: string[];
};
export const initialLife = (time = 480): LifeState => ({
  version: 5,
  speechAt: 0,
  speechUrgentAt: 0,
  speechEventFloor: 0,
  unavailable: { homes: {}, facilities: [] },
  people: PEOPLE.map((p, i) => ({
    id: p.id,
    body:
      i < 3
        ? {
            space: "village",
            ...[
              { x: 670, y: 620 },
              { x: 1110, y: 570 },
              { ...VILLAGE_ANCHORS.carpenter },
            ][i],
            hp: 100,
            health: "healthy",
            episode: 0,
            recoverAt: 0,
          }
        : null,
    blockedTarget: null,
    blockedUntil: 0,
    action: null,
    serial: 0,
    committed: 0,
    needs: { hunger: 15, fatigue: 10 },
    emotion: 0,
    gear: "locker",
    supplies: { medicine: 0, wood: 0 },
    project: 0,
    nextDecision: i * 75,
    reason: "开始新的一天",
    pathFailures: 0,
    alarm: 0,
    relations: Object.fromEntries(
      p.friends.map((id) => [
        id,
        { familiar: 35, trust: 35, wariness: 0, lastPositive: -1440 },
      ]),
    ),
    memories: [],
    receipt: 0,
    receipts: [],
    receiptFloor: 0,
    known: {},
    lastSupplyDay: 0,
    lastMealDay: -1,
    social: { cooldownUntil: 0, occasionFloor: 0, visited: {} },
    speech: {
      eventFloor: 0,
      nextAt: 0,
      day: Math.floor(time / 1440),
      routines: [],
    },
  })),
  elapsed: 0,
  sequence: 0,
  events: [],
  reservations: [],
  tasks: [],
  alarm: 0,
  clearSince: null,
  stores: {
    medicine: 4,
    herbs: 8,
    wood: 6,
    food: 18,
    day: Math.floor(time / 1440),
  },
  facilities: Object.fromEntries(MAINTENANCE.map((f) => [f.id, 100])),
  playerSpace: "village",
  outside: { x: 670, y: 720 },
  invitations: {},
  observed: {},
  lastDefenseSequence: 0,
  defenseReceipts: [],
});
export function isSpace(v: unknown): v is SpaceId {
  return v === "village" || HOMES.some((h) => h.id === v);
}
export function validPlace(p: unknown): p is Place {
  const q = p as Place;
  return (
    !!q &&
    isSpace(q.space) &&
    Number.isFinite(q.x) &&
    Number.isFinite(q.y) &&
    (q.space === "village"
      ? validOutdoorPoint(q)
      : q.x >= ROOM.left &&
        q.x <= ROOM.right &&
        q.y >= ROOM.top &&
        q.y <= ROOM.bottom)
  );
}
// 读档入口白名单与上限；导航和表现不序列化。损坏事实拒绝，失效租约有界释放。
export function validateLife(raw: unknown, time: number): LifeState {
  const l = structuredClone(raw) as LifeState,
    num = (n: unknown, max = 1e12) =>
      typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= max,
    integer = (n: unknown, max = 1e9) => Number.isSafeInteger(n) && num(n, max),
    text = (s: unknown) => typeof s === "string" && s.length <= 160,
    subject = (id: string) =>
      id === "player" ||
      PEOPLE.some((p) => p.id === id) ||
      MAINTENANCE.some((f) => f.id === id) ||
      HOMES.some((h) => h.id === id) ||
      FACILITIES.some((f) => f.id === id),
    activity = (k: unknown) =>
      [
        "work",
        "eat",
        "sleep",
        "rest",
        "habit",
        "talk",
        "shelter",
        "treat",
        "escort",
        "repair",
        "count",
        "duty",
        "supply",
        "store",
      ].includes(k as string),
    kind = (k: unknown) =>
      [
        "alarm",
        "clear",
        "injury",
        "down",
        "death",
        "damage",
        "care",
        "repair",
        "help",
        "visit",
        "access",
        "company",
        "report",
        "activity",
      ].includes(k as string);
  if (l) l.defenseReceipts ??= [];
  // 主存档6的生活子版本1→2：保留进行中的行动、伤情、账本与已有携带事实。
  // 私人物品不可交易，迁移只确定已有物品的位置，不补充公共药品或材料。
  if (
    l &&
    ((l as { version?: number }).version === undefined ||
      (l as { version?: number }).version === 1)
  ) {
    Object.assign(l, { version: 2 });
    l.unavailable = { homes: {}, facilities: [] };
    for (const n of l.people ?? []) {
      const old = n as PersonState & { kit?: boolean; tools?: boolean };
      n.gear =
        (n.id === "healer" && old.kit) || (n.id === "carpenter" && old.tools)
          ? "carried"
          : "locker";
      // 旧取物点不再生成物品：保留动作但从实际私人箱子重新开始取物。
      if (
        n.action?.phase === "collect" &&
        n.action.kind !== "escort" &&
        n.gear === "locker"
      ) {
        const box = PRIVATE_STORAGE.find((b) => b.owner === n.id);
        if (box) {
          n.action.pickup = { ...box.use };
          n.action.progress = 0;
        }
      }
    }
  }
  // 子版本2→3增加短句去重与有限随身资源；旧档的药品与木料仍留在原公共库存。
  if (l && (l as { version?: number }).version === 2) {
    Object.assign(l, { version: 3 });
    l.speechAt = l.elapsed;
    l.speechUrgentAt = l.elapsed;
    l.speechEventFloor = l.sequence;
    for (const n of l.people ?? [])
      n.speech = {
        eventFloor: n.receipt,
        nextAt: l.elapsed,
        day: Math.floor(time / 1440),
        routines: [],
      };
    for (const n of l.people ?? []) n.supplies = { medicine: 0, wood: 0 };
  }
  // 子版本3→4：不重演旧社交经历，不增关系、不修改资源或已有伤情。
  if (l && (l as { version?: number }).version === 3) {
    Object.assign(l,{version:4});
    for (const n of l.people ?? []) {
      n.social = {
        cooldownUntil: l.elapsed,
        occasionFloor: l.sequence,
        visited: {},
      };
      if (n.action) n.action.social = null;
    }
  }
  if(l && (l as {version?:number}).version===4){
    const added=initialLife(time).people.find(n=>n.id==='xiaobao')!;
    if(!l.people.some(n=>n.id==='xiaobao'))l.people.push(added);
    Object.assign(l,{version:5});
  }
  if (
    !l ||
    l.version !== 5 ||
    !num(l.speechAt, l.elapsed + LIFE.speechPersonMs) ||
    !num(l.speechUrgentAt, l.elapsed + LIFE.speechPersonMs) ||
    !integer(l.speechEventFloor, l.sequence) ||
    !l.unavailable ||
    !l.unavailable.homes ||
    Object.keys(l.unavailable.homes).length > HOMES.length ||
    !Object.entries(l.unavailable.homes).every(
      ([id, closed]) =>
        id !== "village" && isSpace(id) && typeof closed === "boolean",
    ) ||
    !Array.isArray(l.unavailable.facilities) ||
    l.unavailable.facilities.length > FACILITIES.length ||
    new Set(l.unavailable.facilities).size !==
      l.unavailable.facilities.length ||
    !l.unavailable.facilities.every((id) =>
      FACILITIES.some((f) => f.id === id),
    ) ||
    !num(l.elapsed) ||
    !integer(l.sequence) ||
    ![0, 1, 2].includes(l.alarm) ||
    !(l.clearSince === null || num(l.clearSince, l.elapsed)) ||
    !integer(l.lastDefenseSequence) ||
    !Array.isArray(l.defenseReceipts) ||
    l.defenseReceipts.length > 80 ||
    !l.defenseReceipts.every(text) ||
    new Set(l.defenseReceipts).size !== l.defenseReceipts.length ||
    !isSpace(l.playerSpace) ||
    !validPlace({ ...l.outside, space: "village" }) ||
    !Array.isArray(l.people) ||
    l.people.length !== PEOPLE.length ||
    new Set(l.people.map((n) => n?.id)).size !== PEOPLE.length ||
    !l.stores ||
    !integer(l.stores.medicine, LIFE.maxMedicine) ||
    !integer(l.stores.herbs, LIFE.maxHerbs) ||
    !integer(l.stores.wood, LIFE.maxWood) ||
    !integer(l.stores.food, LIFE.maxFood) ||
    !integer(l.stores.day, 1e6) ||
    !l.facilities ||
    Object.keys(l.facilities).length !== MAINTENANCE.length ||
    !MAINTENANCE.every((f) => num(l.facilities[f.id], 100))
  )
    throw Error("居民生活存档结构无效。");
  for (const n of l.people) {
    n.lastMealDay ??= -1;
    n.blockedTarget ??= null;
    n.blockedUntil ??= 0;
    n.receipts ??= n.memories?.map((m) => m.sequence) ?? [];
    n.receiptFloor ??= Math.max(0, n.receipt - LIFE.eventLimit);
    const def = PEOPLE.find((p) => p.id === n.id);
    if (
      !def ||
      (def.id !== "xiaobao" && !def.id.includes("-")
        ? !n.body ||
          !validPlace(n.body) ||
          !num(n.body.hp, 100) ||
          !["healthy", "hurt", "down", "convalescent"].includes(
            n.body.health,
          ) ||
          (n.body.hp === 0) !== (n.body.health === "down") ||
          !integer(n.body.episode) ||
          !num(n.body.recoverAt)
        : n.body !== null) ||
      !(n.blockedTarget === null || validPlace(n.blockedTarget)) ||
      !num(n.blockedUntil) ||
      !integer(n.serial) ||
      !integer(n.committed, n.serial) ||
      !num(n.nextDecision) ||
      !text(n.reason) ||
      !num(n.project, 100) ||
      !integer(n.pathFailures, 100000) ||
      !integer(n.lastSupplyDay, 1e6) ||
      !Number.isSafeInteger(n.lastMealDay) ||
      n.lastMealDay < -1 ||
      n.lastMealDay > 1e6 ||
      ![0, 1, 2].includes(n.alarm) ||
      !num(n.emotion, 100) ||
      !["locker", "carried"].includes(n.gear) ||
      !n.supplies ||
      !integer(
        n.supplies.medicine,
        n.id === "healer" ? LIFE.carriedMedicine : 0,
      ) ||
      !integer(n.supplies.wood, n.id === "xiaobao" ? 1 : n.id === "carpenter" ? LIFE.carriedWood : 0) ||
      !n.speech ||
      !integer(n.speech.eventFloor, l.sequence) ||
      !num(n.speech.nextAt, l.elapsed + LIFE.speechPersonMs) ||
      !integer(n.speech.day, Math.floor(time / 1440)) ||
      !Array.isArray(n.speech.routines) ||
      n.speech.routines.length > 14 ||
      new Set(n.speech.routines).size !== n.speech.routines.length ||
      !n.speech.routines.every(activity) ||
      !n.social ||
      !num(n.social.cooldownUntil, l.elapsed + LIFE.socialCooldownMs) ||
      !integer(n.social.occasionFloor, l.sequence) ||
      !n.social.visited ||
      typeof n.social.visited !== "object" ||
      Array.isArray(n.social.visited) ||
      Object.keys(n.social.visited).length > PEOPLE.length - 1 ||
      !Object.entries(n.social.visited).every(
        ([id, seq]) =>
          id !== n.id &&
          PEOPLE.some((p) => p.id === id) &&
          integer(seq, l.sequence),
      ) ||
      !n.needs ||
      !num(n.needs.hunger, 100) ||
      !num(n.needs.fatigue, 100) ||
      !integer(n.receipt, l.sequence) ||
      !integer(n.receiptFloor, n.receipt) ||
      !Array.isArray(n.receipts) ||
      n.receipts.length > LIFE.eventLimit ||
      new Set(n.receipts).size !== n.receipts.length ||
      !n.receipts.every(
        (seq) => integer(seq, n.receipt) && seq > n.receiptFloor,
      ) ||
      !n.relations ||
      Object.keys(n.relations).length > 16 ||
      !Object.entries(n.relations).every(
        ([id, r]) =>
          subject(id) &&
          r &&
          num(r.familiar, 100) &&
          num(r.trust, 100) &&
          num(r.wariness, 100) &&
          Number.isFinite(r.lastPositive),
      ) ||
      !n.known ||
      // 身份白名单已限定总量；正常巡视可认识十五名居民及玩家。
      !Object.entries(n.known).every(
        ([id, p]) => subject(id) && validPlace(p) && num(p.time, time),
      ) ||
      !Array.isArray(n.memories) ||
      n.memories.length > LIFE.memoryLimit ||
      !n.memories.every(
        (m) =>
          m &&
          text(m.eventId) &&
          integer(m.sequence, l.sequence) &&
          kind(m.kind) &&
          num(m.time, time) &&
          Array.isArray(m.subjects) &&
          m.subjects.length <= 6 &&
          m.subjects.every(subject) &&
          text(m.result) &&
          ["seen", "alarm", "report"].includes(m.source) &&
          num(m.importance, 100) &&
          num(m.expires, 1e9),
      )
    )
      throw Error("人物状态或记忆无效。");
    const a = n.action;
    if (a && a.social === undefined) a.social = null;
    if (a && a.pickup === undefined) a.pickup = null;
    if (
      a !== null &&
      (!a ||
        !integer(a.id, n.serial) ||
        a.id <= n.committed ||
        !activity(a.kind) ||
        !validPlace(a.target) ||
        !(a.facility === null || FACILITIES.some((f) => f.id === a.facility)) ||
        !(a.task === null || text(a.task)) ||
        !(a.pickup === null || validPlace(a.pickup)) ||
        !["collect", "stock", "travel", "perform"].includes(a.phase) ||
        !num(a.progress, a.duration) ||
        !num(a.duration, 120000) ||
        !num(a.started, l.elapsed) ||
        !integer(a.failures, LIFE.retryLimit) ||
        !text(a.label))
    )
      throw Error("生活行动状态无效。");
    if (
      a?.social &&
      (a.kind !== "talk" ||
        a.facility !== null ||
        a.task !== null ||
        a.social.partner === n.id ||
        !PEOPLE.some((p) => p.id === a.social!.partner) ||
        !integer(a.social.occasion, l.sequence) ||
        a.social.occasion <=
          Math.max(
            n.social.occasionFloor,
            n.social.visited[a.social.partner] ?? 0,
          ))
    )
      throw Error("同伴探访目标或事件凭据无效。");
    if(a?.xiaobao && (n.id!=='xiaobao' || !Object.hasOwn(XIAOBAO_WISHES,a.xiaobao.wish) || !(a.xiaobao.partner===null || PEOPLE.some(p=>p.id===a.xiaobao!.partner && p.id!=='xiaobao'))))throw Error('小宝生活行动元数据无效。');
    if(a?.xiaobao?.material!==undefined&&a.xiaobao.material!=='wood')throw Error('送物材料无效。');
    if(a?.xiaobao){const m=a.xiaobao,partners={wind:'elder',wood:'carpenter',herb:'healer'};
      if(['wind','wood','herb'].includes(m.wish)&&(a.kind!=='talk'||m.partner!==partners[m.wish as keyof typeof partners]))throw Error('学习活动缺少实际在场的对应朋友。');
      if(m.material==='wood'&&(m.wish!=='deliver'||!(a.kind==='supply'&&(m.partner===null||m.partner==='carpenter'))))throw Error('木料取送活动无效。');
      if(m.wish==='deliver'&&!m.material&&(a.kind!=='supply'||!(m.partner===null||m.partner==='healer')))throw Error('药草采送活动无效。');
    }
    if (a?.phase === "stock") {
      const source = FACILITIES.find(
        (f) =>
          f.id ===
          (n.id === "healer" && a.kind === "treat"
            ? "pharmacy"
            : n.id === "carpenter" && a.kind === "repair"
              ? "tools"
              : ""),
      );
      if (
        !source ||
        a.facility !== source.id ||
        n.gear !== "carried" ||
        !a.pickup ||
        a.pickup.space !== source.place.space ||
        a.pickup.x !== source.place.x ||
        a.pickup.y !== source.place.y
      )
        throw Error("补给动作来源无效。");
    }
    if (a?.kind === "store") {
      const box = PRIVATE_STORAGE.find((b) => b.owner === n.id)!;
      if (
        a.target.space !== box.use.space ||
        a.target.x !== box.use.x ||
        a.target.y !== box.use.y
      )
        throw Error("私人物品只能归还到自己的储物箱。");
    }
  }
  if (
    !Array.isArray(l.events) ||
    l.events.length > LIFE.eventLimit ||
    !l.events.every(
      (e) =>
        e &&
        e.id === `life:${e.sequence}` &&
        integer(e.sequence, l.sequence) &&
        kind(e.kind) &&
        validPlace(e.place) &&
        num(e.time, time) &&
        text(e.source) &&
        Array.isArray(e.subjects) &&
        e.subjects.length <= 6 &&
        e.subjects.every(subject) &&
        text(e.result) &&
        typeof e.debug === "boolean",
    ) ||
    !Array.isArray(l.reservations) ||
    l.reservations.length > 24 ||
    !l.reservations.every(
      (r) =>
        r &&
        FACILITIES.some((f) => f.id === r.facility) &&
        !FACILITIES.some(
          (f) =>
            f.id === r.facility &&
            f.kind === "bed" &&
            f.owner &&
            f.owner !== r.owner,
        ) &&
        PEOPLE.some((p) => p.id === r.owner) &&
        num(r.expires),
    ) ||
    !Array.isArray(l.tasks) ||
    l.tasks.length > LIFE.taskLimit ||
    new Set(l.tasks.map((t) => t.id)).size !== l.tasks.length ||
    !l.tasks.every(
      (t) =>
        t &&
        text(t.id) &&
        ["treat", "repair"].includes(t.kind) &&
        subject(t.subject) &&
        validPlace(t.place) &&
        (t.owner === null || PEOPLE.some((p) => p.id === t.owner)) &&
        num(t.expires) &&
        integer(t.attempts, 1000) &&
        num(t.retryAt),
    ) ||
    !l.invitations ||
    Object.keys(l.invitations).length > HOMES.length ||
    !Object.entries(l.invitations).every(
      ([space, t]) => isSpace(space) && space !== "village" && num(t, 1e9),
    ) ||
    !l.observed ||
    Object.keys(l.observed).length > PEOPLE.length ||
    !Object.entries(l.observed).every(
      ([id, o]) =>
        PEOPLE.some((p) => p.id === id) &&
        o &&
        num(o.time, time) &&
        text(o.label) &&
        isSpace(o.space),
    )
  )
    throw Error("生活事件或设施记录无效。");
  l.reservations = l.reservations.filter(
    (r) =>
      r.expires > l.elapsed &&
      l.people.find((n) => n.id === r.owner)?.action?.facility === r.facility &&
      !l.unavailable.facilities.includes(r.facility) &&
      !l.unavailable.homes[
        FACILITIES.find((f) => f.id === r.facility)!.place.space
      ],
  );
  for (const f of FACILITIES)
    if (l.reservations.filter((r) => r.facility === f.id).length > f.capacity)
      throw Error("设施重复占用。");
  for (const t of l.tasks)
    if (
      t.owner &&
      (!l.people.find((n) => n.id === t.owner)?.action ||
        t.expires <= l.elapsed)
    ) {
      t.owner = null;
      t.expires = 0;
    }
  const place = (p: Place) => ({ space: p.space, x: p.x, y: p.y });
  if (
    l.stores.medicine +
      l.people.find((n) => n.id === "healer")!.supplies.medicine >
      LIFE.maxMedicine ||
    l.stores.wood + l.people.find((n) => n.id === "carpenter")!.supplies.wood + l.people.find(n=>n.id==='xiaobao')!.supplies.wood >
      LIFE.maxWood
  )
    throw Error("公共与随身物资合计超过上限。");
  const people = l.people.map((n) => ({
    id: n.id,
    body: n.body
      ? {
          ...place(n.body),
          hp: n.body.hp,
          health: n.body.health,
          episode: n.body.episode,
          recoverAt: n.body.recoverAt,
        }
      : null,
    action: n.action
      ? {
          ...(n.action.xiaobao ? {xiaobao:{wish:n.action.xiaobao.wish,partner:n.action.xiaobao.partner,...(n.action.xiaobao.material?{material:n.action.xiaobao.material}:{})}} : {}),
          id: n.action.id,
          kind: n.action.kind,
          target: place(n.action.target),
          pickup: n.action.pickup ? place(n.action.pickup) : null,
          facility: n.action.facility,
          task: n.action.task,
          phase: n.action.phase,
          progress: n.action.progress,
          duration: n.action.duration,
          started: n.action.started,
          failures: n.action.failures,
          label: n.action.label,
          social: n.action.social
            ? {
                partner: n.action.social.partner,
                occasion: n.action.social.occasion,
              }
            : null,
        }
      : null,
    blockedTarget: n.blockedTarget ? place(n.blockedTarget) : null,
    blockedUntil: n.blockedUntil,
    serial: n.serial,
    committed: n.committed,
    needs: { hunger: n.needs.hunger, fatigue: n.needs.fatigue },
    emotion: n.emotion,
    gear: n.gear,
    supplies: { medicine: n.supplies.medicine, wood: n.supplies.wood },
    project: n.project,
    nextDecision: n.nextDecision,
    reason: n.reason,
    pathFailures: n.pathFailures,
    alarm: n.alarm,
    relations: Object.fromEntries(
      Object.entries(n.relations).map(([id, r]) => [
        id,
        {
          familiar: r.familiar,
          trust: r.trust,
          wariness: r.wariness,
          lastPositive: r.lastPositive,
        },
      ]),
    ),
    memories: n.memories.map((m) => ({
      eventId: m.eventId,
      sequence: m.sequence,
      kind: m.kind,
      time: m.time,
      subjects: m.subjects,
      result: m.result,
      source: m.source,
      importance: m.importance,
      expires: m.expires,
    })),
    receipt: n.receipt,
    receipts: n.receipts,
    receiptFloor: n.receiptFloor,
    known: Object.fromEntries(
      Object.entries(n.known).map(([id, p]) => [
        id,
        { ...place(p), time: p.time },
      ]),
    ),
    lastSupplyDay: n.lastSupplyDay,
    lastMealDay: n.lastMealDay,
    social: {
      cooldownUntil: n.social.cooldownUntil,
      occasionFloor: n.social.occasionFloor,
      visited: { ...n.social.visited },
    },
    speech: {
      eventFloor: n.speech.eventFloor,
      nextAt: n.speech.nextAt,
      day: n.speech.day,
      routines: [...n.speech.routines],
    },
  }));
  return {
    version: 5,
    speechAt: l.speechAt,
    speechUrgentAt: l.speechUrgentAt,
    speechEventFloor: l.speechEventFloor,
    unavailable: {
      homes: { ...l.unavailable.homes },
      facilities: [...l.unavailable.facilities],
    },
    people,
    elapsed: l.elapsed,
    sequence: l.sequence,
    events: l.events.map((e) => ({
      id: e.id,
      sequence: e.sequence,
      time: e.time,
      kind: e.kind,
      place: place(e.place),
      source: e.source,
      subjects: e.subjects,
      result: e.result,
      debug: e.debug,
    })),
    reservations: l.reservations.map((r) => ({
      facility: r.facility,
      owner: r.owner,
      expires: r.expires,
    })),
    tasks: l.tasks.map((t) => ({
      id: t.id,
      kind: t.kind,
      subject: t.subject,
      place: place(t.place),
      owner: t.owner,
      expires: t.expires,
      attempts: t.attempts,
      retryAt: t.retryAt,
    })),
    alarm: l.alarm,
    clearSince: l.clearSince,
    stores: {
      medicine: l.stores.medicine,
      herbs: l.stores.herbs,
      wood: l.stores.wood,
      food: l.stores.food,
      day: l.stores.day,
    },
    facilities: l.facilities,
    playerSpace: l.playerSpace,
    outside: { x: l.outside.x, y: l.outside.y },
    invitations: l.invitations,
    observed: l.observed,
    lastDefenseSequence: l.lastDefenseSequence,
    defenseReceipts: l.defenseReceipts,
  };
}
