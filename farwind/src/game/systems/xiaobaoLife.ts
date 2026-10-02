import {
  FACILITIES,
  HOMES,
  LIFE,
  MAINTENANCE,
  PRIVATE_STORAGE,
  ROOM,
  person,
  type Place,
  type ResidentId,
} from "../../data/npcLife";
import { XIAOBAO } from "../../data/xiaobao";
import { inProtected } from "../../data/defenseZones";
import { RAID_GATES } from "../../data/defense";
import type { NpcLife, Candidate } from "./npcLife";
import type { Action, PersonState } from "./npcLifeState";
import { distance, moveLife, spaceBlocked, spaceClear } from "./npcNavigation";
import type { XiaobaoCombat } from "./xiaobaoCombat";
import {
  XIAOBAO_WISHES,
  type XiaobaoWish,
  type XiaobaoProject,
  type XiaobaoLifeIntent,
} from "./xiaobaoLifeState";
import type { State } from "./state";

const friends: Record<XiaobaoProject, ResidentId> = {
  wind: "elder",
  wood: "carpenter",
  herb: "healer",
};
const me = (life: NpcLife) => life.data.people.find((n) => n.id === "xiaobao")!;
const project = (key: XiaobaoWish): key is XiaobaoProject =>
  ["wind", "wood", "herb"].includes(key);
const awake = (life: NpcLife, id: ResidentId) =>
  life.live(id) &&
  life.data.people.find((n) => n.id === id)?.action?.kind !== "sleep";
const safe = (life: NpcLife, p: Place) =>
  (p.space !== "village" || inProtected(p)) &&
  life.safe(p) &&
  life.available(p);

export function newXiaobaoDay(state: State) {
  const s = state.xiaobao.life,
    day = Math.floor(state.time / 1440);
  if (s.day === day) return;
  // 每天只抽一次，跨过多天也不补发曾经没有实际完成的成果。
  s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0;
  s.day = day;
  s.done = [];
  const keys = (Object.keys(XIAOBAO_WISHES) as XiaobaoWish[]).filter(
    (key) => !project(key) || s.projects[key].stage < 3,
  );
  const open = (["wind", "wood", "herb"] as XiaobaoProject[]).filter(
    (k) => s.projects[k].stage < 3,
  );
  s.main = open.length
    ? open[(s.seed >>> 8) % open.length]
    : keys[s.seed % keys.length];
  const alternatives = keys.filter((k) => k !== s.main);
  s.optional = alternatives[(s.seed >>> 16) % alternatives.length];
  const recent = state.life.people
    .find((n) => n.id === "xiaobao")
    ?.memories.some(
      (m) => ["injury", "down"].includes(m.kind) && m.time + 180 > state.time,
    );
  if (recent) {
    s.optional =
      s.main === "visit" ? keys.find((key) => key !== "visit")! : s.main;
    s.main = "visit";
  }
}

function record(
  life: NpcLife,
  text: string,
  kind: "activity" | "company" | "help" = "activity",
  subjects: string[] = ["xiaobao"],
) {
  const event = life.emit(
    kind,
    life.body("xiaobao")!,
    "xiaobao",
    subjects,
    text,
  );
  const s = life.state.xiaobao.life;
  s.journal.push({ sequence: event.sequence, time: event.time, text });
  s.journal = s.journal.slice(-32);
}

export function noteXiaobaoHelp(life: NpcLife, id: string) {
  const target = life.data.people.find((n) => n.id === id);
  if (!target) return;
  record(
    life,
    `到场放出护印，保护即将受击的${person(target.id)!.name}。`,
    "help",
    [id],
  );
}

export function suspendXiaobaoLife(life: NpcLife) {
  const n = me(life),
    s = life.state.xiaobao.life;
  if (n.action) {
    s.metrics.interrupted++;
    life.cancel(n, "村庄有难，先保护大家");
  }
  n.reason = "村庄有难，先保护大家";
  s.done = s.done.filter((k) => k !== "visit" && k !== "deliver");
  if (s.promise?.status === "waiting") s.promise.status = "cancelled";
  const x = life.state.xiaobao;
  if (x.task === "guard" || x.task === "follow") {
    s.resumeTask = x.task;
    x.task = "free";
  }
}

export function requestXiaobaoFollow(state: State): string {
  const n = state.life.people.find((n) => n.id === "xiaobao")!,
    s = state.xiaobao.life;
  newXiaobaoDay(state);
  if (s.emergency || state.defense.raid || state.life.alarm) {
    return "村里还没平安，我要先守住村灯。等大家安全了再商量，好吗？";
  }
  if (state.xiaobao.task === "follow") return "一起！我已经与你同行了。";
  if (
    s.promise &&
    s.promise.expires > state.time &&
    s.promise.status !== "cancelled"
  )
    return s.promise.reason;
  const hungry = n.needs.hunger > 65,
    tired = n.needs.fatigue > 80 || state.xiaobao.rest > 0;
  const later =
    !!n.action &&
    n.action.phase === "perform" &&
    !["rest", "sleep"].includes(n.action.kind);
  const response = hungry || tired ? "declined" : later ? "later" : "accepted";
  const reason = hungry
    ? "我肚子饿了，先吃点东西，再来找我吧。"
    : tired
      ? "我想先好好休息，精神好了再一起走。"
      : later
        ? `我想先${n.action!.label}。做完就和你一起走，一个小时内没等到我就重新约，好吗？`
        : "一起！村灯若有危险，我会先回去护村。";
  s.promise = {
    response,
    reason,
    expires: state.time + 60,
    actionId: n.action?.id ?? 0,
    status: response === "later" ? "waiting" : "done",
  };
  if (response === "accepted") {
    state.xiaobao.task = "follow";
    state.xiaobao.wait = null;
    state.xiaobao.command = null;
    if (n.action) s.metrics.interrupted++;
    n.action = null;
    n.reason = "答应与你同行，村庄有难时先护村";
    state.life.reservations = state.life.reservations.filter(
      (r) => r.owner !== "xiaobao",
    );
    for (const task of state.life.tasks)
      if (task.owner === "xiaobao") {
        task.owner = null;
        task.expires = 0;
      }
  }
  return reason;
}

export function requestXiaobaoTask(state: State, task: "free" | "guard" | "follow"): string {
  if (task === "follow") return requestXiaobaoFollow(state);
  const x = state.xiaobao, s = x.life;
  if (s.promise) s.promise.status = "cancelled";
  s.resumeTask = s.emergency && task === "guard" ? "guard" : null;
  x.task = s.emergency ? "free" : task;
  return s.emergency
    ? task === "guard" ? "先护村，大家平安后再接着巡护。" : "先把村庄守平安，再去做今天想做的事。"
    : task === "guard" ? "村灯，我看着。" : "好，我去做今天想做的事。";
}

function approach(life: NpcLife, target: Place): Place | null {
  return (
    [
      [35, 0],
      [-35, 0],
      [0, 35],
      [0, -35],
      [28, 28],
      [-28, 28],
    ]
      .map(([dx, dy]) => ({ ...target, x: target.x + dx, y: target.y + dy }))
      .find(
        (p) =>
          !spaceBlocked(p.space, p.x, p.y) &&
          spaceClear(p.space, p, target) &&
          safe(life, p),
      ) ?? null
  );
}

function nearby(life: NpcLife, id: ResidentId) {
  const p = life.body("xiaobao")!,
    q = life.body(id);
  return q &&
    awake(life, id) &&
    q.space === p.space &&
    distance(p, q) < LIFE.observation &&
    spaceClear(p.space, p, q)
    ? q
    : null;
}

function candidates(
  life: NpcLife,
  n: PersonState,
): (Candidate & {
  wish?: XiaobaoWish;
  partner?: ResidentId;
  material?: "wood";
})[] {
  const state = life.state,
    s = state.xiaobao.life,
    p = life.body("xiaobao")!,
    list: (Candidate & {
      wish?: XiaobaoWish;
      partner?: ResidentId;
      material?: "wood";
    })[] = [];
  const add = (
    c: Candidate & {
      wish?: XiaobaoWish;
      partner?: ResidentId;
      material?: "wood";
    },
  ) => {
    if (
      safe(life, c.target) &&
      life.routeSafe(p, c.target, 70) &&
      (!c.facility || life.facilityFree(n, c.facility)) &&
      !(
        n.blockedUntil > life.data.elapsed &&
        n.blockedTarget?.space === c.target.space &&
        distance(n.blockedTarget, c.target) < 25
      )
    )
      list.push({ ...c, score: c.score - distance(p, c.target) * 0.018 });
  };
  const plain = (
    kind: Candidate["kind"],
    target: Place,
    label: string,
    score: number,
    facility: string | null = null,
    wish?: XiaobaoWish,
    partner?: ResidentId,
    material?: "wood",
  ) =>
    add({
      kind,
      target,
      label,
      score,
      facility,
      task: null,
      wish,
      partner,
      material,
    });
  const night = state.time % 1440 >= 1260 || state.time % 1440 < 360;
  if (
    n.needs.hunger > 65 ||
    (n.lastMealDay !== s.day &&
      state.time % 1440 >= 720 &&
      state.time % 1440 < 840)
  ) {
    if (life.data.stores.food > 0)
      plain(
        "eat",
        FACILITIES.find((f) => f.id === "seat:elder-home")!.place,
        "吃饭，下午才有精神",
        190 + n.needs.hunger,
        "seat:elder-home",
      );
    else n.reason = "家里的食物暂时不足，先休息，等待下一批补给";
  }
  const aftercare = s.aftercareUntil > state.time && n.memories.some(m =>
    m.time + 180 > state.time && (
      (["injury", "down", "care"].includes(m.kind) && !s.done.includes("visit")) ||
      (m.kind === "damage" && !s.done.includes("deliver"))
    ));
  // 战后可执行的帮助先于夜间作息；达到原有疲劳阈值仍必须先休息。
  if ((night && !aftercare) || n.needs.fatigue > 80) {
    for (const bed of life.beds(n))
      plain(
        "sleep",
        bed.place,
        bed.owner ? "回自己的床上安心睡觉" : "家暂时进不去，到旅馆空床睡觉",
        180 + n.needs.fatigue,
        bed.id,
      );
    if (list.some((c) => c.kind === "sleep")) return list;
  }
  if (n.needs.fatigue > 60) plain("rest", p, "歇一会儿，再去做想做的事", 145);
  const tools = FACILITIES.find((f) => f.id === "tools")!.place;
  const pickup = approach(life, tools);
  if (
    pickup &&
    n.supplies.wood === 0 &&
    life.data.stores.wood > 0 &&
    ((s.projects.wood.stage > 0 && s.projects.wood.stage < 3) ||
      s.aftercareUntil > state.time)
  )
    plain(
      "supply",
      pickup,
      "到工坊取一份木料，放进自己的篮子",
      135,
      null,
      "deliver",
      undefined,
      "wood",
    );
  for (const key of ["wind", "wood", "herb"] as XiaobaoProject[]) {
    const q = nearby(life, friends[key]);
    const goal = s.projects[key],
      rel = n.relations[friends[key]]?.familiar ?? 0;
    if (
      q &&
      goal.stage < 3 &&
      goal.lastDay < s.day &&
      (key !== "wood" || goal.stage === 0 || n.supplies.wood > 0)
    ) {
      const target = approach(life, q);
      const labels = {
        wind: [
          "听岚爷爷讲风与村庄的故事",
          "跟岚爷爷观察风向，亲手记一页笔记",
          "整理三天观察，完成自己的风向小本",
        ],
        wood: [
          "跟阿禾认识木纹和工具",
          "跟阿禾把自己的木料雕成鸟形",
          "装好木鸟的翅膀，完成第一只小木鸟",
        ],
        herb: [
          "跟小满认识止血草的叶片",
          "跟小满分辨常用药草的气味",
          "独立辨认常用药草，请小满核对",
        ],
      };
      if (target)
        plain(
          "talk",
          target,
          labels[key][goal.stage],
          95 + s.interests[key] * 0.2 + rel * 0.1 + (s.main === key ? 30 : 0),
          null,
          key,
          friends[key],
        );
    }
  }
  if (s.aftercareUntil > state.time) {
    const q = nearby(life, "carpenter"),
      target = q && approach(life, q),
      carpenter = life.data.people.find((n) => n.id === "carpenter")!;
    if (
      target &&
      n.supplies.wood > 0 &&
      carpenter.supplies.wood < 2 &&
      n.memories.some((m) => m.kind === "damage")
    )
      plain(
        "supply",
        target,
        "把篮里的木料送给阿禾，帮助战后检修",
        175,
        null,
        "deliver",
        "carpenter",
        "wood",
      );
    const injured = [...new Set(n.memories
      .filter(m => ["injury", "down", "care"].includes(m.kind) && m.time + 180 > state.time)
      .flatMap(m => m.subjects)
      .filter((id): id is ResidentId => !!person(id) && id !== "xiaobao"))];
    for (const id of injured) {
      const known = n.known[id],
        q = nearby(life, id),
        had = n.memories.some(
          (m) =>
            ["injury", "down", "care"].includes(m.kind) &&
            m.subjects.includes(id) &&
            m.time + 180 > state.time,
        );
      if (q && had && !s.done.includes("visit")) {
        const target = approach(life, q);
        if (target)
          plain(
            "talk",
            target,
            `看看${person(id)!.name}恢复得怎样`,
            165,
            null,
            "visit",
            id,
          );
      } else if (known && had && !s.done.includes("visit"))
        plain(
          "rest",
          known,
          `沿安全路线去探望${person(id)!.name}`,
          125,
          null,
          "visit",
          id,
        );
    }
  }
  // 材料只进入居民公共账本，不改变玩家背包或地图采集、据点进度。
  const herbPoint: Place = {
    space: "village",
    x: XIAOBAO.home.x + 170,
    y: XIAOBAO.home.y + 100,
  };
  if (!s.done.includes("deliver") && life.data.stores.herbs < LIFE.maxHerbs) {
    if (s.basket === 0)
      plain(
        "supply",
        herbPoint,
        "在安全草坡采一篮药草",
        90 + (s.main === "deliver" ? 30 : 0),
        null,
        "deliver",
      );
    else {
      const q = nearby(life, "healer");
      const target = q && approach(life, q);
      if (target)
        plain(
          "supply",
          target,
          "把采好的药草送给小满",
          130,
          null,
          "deliver",
          "healer",
        );
    }
  }
  for (const key of ["practice", "play", "wander"] as const) {
    if (s.done.includes(key)) continue;
    const nearPoint = RAID_GATES[(s.seed >>> 4) % RAID_GATES.length].inside;
    const target: Place =
      key === "wander"
        ? { space: "village", ...nearPoint }
        : {
            space: "village",
            ...XIAOBAO.home,
            x: XIAOBAO.home.x + (key === "play" ? 85 : 0),
            y: XIAOBAO.home.y + 50,
          };
    plain(
      "habit",
      target,
      key === "practice"
        ? "练一会儿轻轻的听风掌"
        : key === "play"
          ? "在广场玩踏叶小步"
          : "去安全近郊听听风",
      75 + (s.main === key ? 35 : s.optional === key ? 20 : 0),
      null,
      key,
    );
  }
  if (!s.done.includes("visit"))
    for (const id of ["elder", "healer", "carpenter"] as const) {
      const q = nearby(life, id),
        target = q && approach(life, q);
      if (target)
        plain(
          "talk",
          target,
          `找${person(id)!.name}聊一会儿`,
          80 + (s.optional === "visit" ? 25 : 0),
          null,
          "visit",
          id,
        );
    }
  // 看不到朋友时只去最后见过的位置或其住所，不读取全地图精确实时位置。
  const pending = (["wind", "wood", "herb"] as XiaobaoProject[]).filter(
    (k) =>
      s.projects[k].stage < 3 &&
      s.projects[k].lastDay < s.day &&
      (k !== "wood" || s.projects[k].stage === 0 || n.supplies.wood > 0),
  );
  pending.sort(
    (a, b) =>
      Number(b === s.main) - Number(a === s.main) ||
      s.interests[b] - s.interests[a],
  );
  const wantsDelivery = !!s.basket && life.data.stores.herbs < LIFE.maxHerbs;
  const friend =
    (wantsDelivery ? "healer" : friends[pending[0]]) ??
    (["elder", "healer", "carpenter"] as const)[s.seed % 3];
  const known = n.known[friend],
    home = person(friend)!.home;
  const target =
    known && known.time + LIFE.socialKnownMinutes >= state.time
      ? known
      : { space: home, x: 730, y: 780 };
  plain(
    "rest",
    target,
    `去${person(friend)!.name}常在的地方看看`,
    wantsDelivery ? 105 : pending.length ? 70 : 45,
  );
  plain(
    "rest",
    FACILITIES.find((f) => f.id === "plaza-seat")!.place,
    "坐下来听一会儿风",
    25,
    "plaza-seat",
  );
  plain("rest", p, "原地安全歇一会儿", 10);
  return list.sort(
    (a, b) => b.score - a.score || a.label.localeCompare(b.label),
  );
}

function finish(life: NpcLife, n: PersonState, a: Action) {
  const s = life.state.xiaobao.life,
    meta = a.xiaobao;
  if (meta?.partner && !nearby(life, meta.partner)) return false;
  if (meta?.material === "wood") {
    if (
      !meta.partner
        ? n.supplies.wood > 0 || life.data.stores.wood <= 0
        : n.supplies.wood <= 0 ||
          life.data.people.find((n) => n.id === "carpenter")!.supplies.wood >= 2
    )
      return false;
  } else if (meta?.wish === "deliver") {
    if (!meta.partner) {
      if (s.basket || life.data.stores.herbs >= LIFE.maxHerbs) return false;
    } else if (s.basket !== 1 || life.data.stores.herbs >= LIFE.maxHerbs)
      return false;
  }
  if (a.kind === "eat" && life.data.stores.food <= 0) return false;
  if (
    meta?.wish === "wood" &&
    s.projects.wood.stage > 0 &&
    n.supplies.wood <= 0
  )
    return false;
  life.complete(n, a);
  if (n.action === a) return false;
  if (meta?.material === "wood") {
    if (!meta.partner) {
      life.data.stores.wood--;
      n.supplies.wood++;
    } else {
      n.supplies.wood--;
      life.data.people.find((n) => n.id === "carpenter")!.supplies.wood++;
    }
  } else if (meta?.wish === "deliver") {
    if (!meta.partner) s.basket = 1;
    else {
      life.data.stores.herbs++;
      s.basket = 0;
    }
  }
  s.metrics.completed++;
  if (meta) {
    const final = meta.wish !== "deliver" || !!meta.partner;
    if (final && !s.done.includes(meta.wish)) s.done.push(meta.wish);
    if (project(meta.wish)) {
      const p = s.projects[meta.wish];
      if (p.lastDay < s.day && p.stage < 3) {
        p.lastDay = s.day;
        p.stage++;
        s.interests[meta.wish] = Math.min(100, s.interests[meta.wish] + 5);
        if (meta.wish === "wood" && p.stage === 3) n.supplies.wood--;
      }
    }
    record(
      life,
      meta.wish === "deliver" && !meta.partner && !meta.material
        ? "亲手采好一篮药草，准备送给小满。"
        : `${a.label}，已经做到了。${project(meta.wish) ? `心愿「${XIAOBAO_WISHES[meta.wish]}」完成第${s.projects[meta.wish].stage}阶段。` : ""}`,
      meta.partner ? "company" : "activity",
      meta.partner ? ["xiaobao", meta.partner] : ["xiaobao"],
    );
  }
  if (!meta && (a.kind === "eat" || a.kind === "sleep"))
    record(
      life,
      a.kind === "eat"
        ? "在家里吃过饭，肚子不饿了。"
        : "在安全的床位睡过一觉，精神好多了。",
    );
  const promise = s.promise;
  if (
    promise?.response === "later" &&
    promise.status === "waiting" &&
    promise.actionId === a.id &&
    promise.expires > life.state.time
  ) {
    promise.status = "done";
    life.state.xiaobao.task = "follow";
    n.reason = "答应的事做完了，现在与你同行";
  }
  return true;
}

export function stepXiaobaoLife(life: NpcLife, ms: number) {
  const n = me(life),
    x = life.state.xiaobao,
    s = x.life;
  newXiaobaoDay(life.state);
  if (s.promise?.status === "waiting" && s.promise.expires <= life.state.time) {
    s.promise.status = "cancelled";
    record(life, "约好的同行时间过了，需要重新商量。");
  }
  if (!s.emergency && s.resumeTask) {
    const pending = n.memories.some(
      (m) =>
        m.time + 180 > life.state.time && (
          (["injury", "down", "care"].includes(m.kind) && !s.done.includes("visit")) ||
          (m.kind === "damage" && !s.done.includes("deliver"))
        ),
    );
    if (
      !pending ||
      s.aftercareUntil <= life.state.time ||
      (s.done.includes("visit") && s.done.includes("deliver"))
    ) {
      if (
        s.resumeTask === "guard" ||
        (s.promise?.response !== "declined" && s.promise?.status === "done" &&
          s.promise.expires > life.state.time)
      )
        x.task = s.resumeTask;
      else {
        if (s.promise) s.promise.status = "cancelled";
        n.reason = "村庄平安了，同行约定需要重新确认";
      }
      s.resumeTask = null;
    }
  }
  if (s.emergency || x.rest || x.task !== "free" || life.xiaobaoDemonstrating) {
    if (n.action) {
      s.metrics.interrupted++;
      life.cancel(
        n,
        s.emergency
          ? "先保护村庄"
          : x.rest
            ? "护风调息，暂不能活动"
            : life.xiaobaoDemonstrating
              ? "应邀演武，做完再安排生活"
              : "接受委托，暂放下个人安排",
      );
    }
    if(life.xiaobaoDemonstrating&&!s.emergency&&!x.rest)n.reason="应邀演武，做完再安排生活";
    return;
  }
  const a = n.action;
  if (a) {
    if (
      !life.available(a.target) ||
      (a.facility && !life.reserve(n, a.facility))
    ) {
      fail(life, n, "地点或预约已不可用，重新安排");
      return;
    }
    const partner = a.xiaobao?.partner;
    if (partner) {
      const q = nearby(life, partner);
      if (q) {
        const target = approach(life, q);
        if (target) a.target = target;
      } else if (
        a.phase === "perform" ||
        (a.target.space === x.space &&
          distance(life.body("xiaobao")!, a.target) < 8)
      ) {
        fail(life, n, "朋友已经离开或正在睡觉，稍后再来");
        return;
      }
    }
    if (
      !(a.kind === "sleep" && a.phase === "perform") &&
      life.data.elapsed - a.started > 90000
    ) {
      fail(life, n, "没能按时到场或朋友已经离开，换个安排");
      return;
    }
    const p = life.body("xiaobao")!;
    if (
      p.space === a.target.space &&
      distance(p, a.target) < 8 &&
      (!partner || !!nearby(life, partner))
    ) {
      a.phase = "perform";
      a.progress = Math.min(a.duration, a.progress + ms);
      if (a.kind === "sleep") {
        n.needs.fatigue = Math.max(0, n.needs.fatigue - ms / 120);
        if (life.state.time % 1440 >= 1260 || life.state.time % 1440 < 360)
          return;
      }
      if (a.progress >= a.duration && !finish(life, n, a))
        fail(life, n, "完成条件发生变化，没有记录成果");
    } else a.phase = "travel";
    return;
  }
  if (life.data.elapsed < n.nextDecision) return;
  n.nextDecision = life.data.elapsed + LIFE.decisionMs;
  const list = candidates(life, n);
  life.scores.set("xiaobao", list);
  for (const c of list) {
    if (c.facility === "") c.facility = null;
    if (life.begin(n, c)) {
      n.reason = c.label;
      n.action!.duration =
        c.kind === "rest"
          ? 12000
          : c.kind === "eat"
            ? 7000
            : c.kind === "sleep"
              ? 8000
              : c.wish === "wander"
                ? 12000
                : 10000;
      if (c.wish)
        n.action!.xiaobao = {
          wish: c.wish,
          partner: c.partner ?? null,
          ...(c.material ? { material: c.material } : {}),
        };
      s.metrics.attempts++;
      break;
    }
  }
}

function fail(life: NpcLife, n: PersonState, reason: string) {
  const s = life.state.xiaobao.life;
  s.metrics.failed++;
  if (n.action) {
    n.blockedTarget = { ...n.action.target };
    n.blockedUntil = life.data.elapsed + 30000;
    record(life, `${n.action.label}没完成：${reason}。`);
  }
  life.cancel(n, reason);
}

export function xiaobaoLifeIntent(life: NpcLife): XiaobaoLifeIntent | null {
  const a = me(life).action;
  if (!a) return null;
  const key = a.xiaobao?.wish;
  const action =
    a.phase === "travel"
      ? "idle"
      : a.kind === "sleep"
        ? "sleep"
        : a.kind === "eat"
          ? "eat"
          : key === "deliver"
            ? a.xiaobao?.partner || a.xiaobao?.material
              ? "carry"
              : "gather"
            : key === "wind"
              ? "write"
              : key === "wood"
                ? "bow"
                : key === "herb"
                  ? "gather"
                  : key === "practice"
                    ? "palm"
                    : key === "play"
                      ? "step"
                      : key === "wander"
                        ? "meditate"
                        : a.kind === "talk"
                          ? "wave"
                          : "meditate";
  return { ...a.target, action, elapsed: a.progress, label: a.label };
}

// 唯一执行者是小宝控制器；居民系统只管理意图、预约、进度与结果。
export function moveXiaobaoLife(
  life: NpcLife,
  c: XiaobaoCombat,
  ms: number,
  budget: { queries: number },
) {
  const n = me(life),
    x = c.data,
    urgent = x.life.emergency;
  let intent = xiaobaoLifeIntent(life);
  if (x.space !== "village" && (urgent || x.task !== "free"))
    intent = {
      space: "village",
      ...HOMES.find((h) => h.id === x.space)!.door,
      action: "idle",
      elapsed: 0,
      label: urgent ? "出门赶赴防线" : "出门与你会合",
    };
  if (!intent) {
    c.action = "idle";
    return;
  }
  const old = { space: x.space, x: c.x, y: c.y },
    body = { ...old };
  const nav = life.nav("xiaobao");
  const peers = life.data.people
    .filter((p) => p.id !== "xiaobao")
    .map((p) => life.body(p.id)!)
    .filter((p) => p.space === body.space);
  const road =
    body.space === "village" && intent.space === "village"
      ? {
          ...intent,
          ...c.route(intent, { clear: (a, b) => spaceClear("village", a, b) }),
        }
      : intent;
  // 战斗村道骨架包含荒野节点；生活不能为了接上近处道路越过保护边界。
  const waypoint = urgent || safe(life, road) ? road : intent;
  moveLife(
    body,
    waypoint,
    ms,
    life.data.elapsed,
    budget,
    nav,
    (p) => (urgent ? true : safe(life, p)),
    peers,
    (space) => !life.data.unavailable.homes[space],
  );
  x.space = body.space;
  c.x = body.x;
  c.y = body.y;
  x.x = c.x;
  x.y = c.y;
  if (body.space !== old.space) c.motion.reset();
  else c.motion.update({ dx: c.x - old.x, dy: c.y - old.y, dt: ms / 1000 });
  const moving = body.space === old.space && distance(body, old) > 0.001;
  if (moving) {
    c.facing = c.motion.direction;
    c.action =
      (x.life.basket || n.supplies.wood) && c.facing >= 2
        ? "carry"
        : c.facing === 0
          ? "walkDown"
          : c.facing === 1
            ? "walkUp"
            : "walkSide";
  } else
    c.action =
      body.space === intent.space && distance(body, intent) < 8
        ? intent.action
        : "idle";
  c.elapsed = intent.elapsed;
  c.status = intent.label;
  if (nav.stuck > LIFE.routeStuckMs && n.action) {
    n.pathFailures++;
    fail(life, n, "通路受阻，释放预约并换个安排");
  }
}

export function xiaobaoDiary(state: State) {
  const s = state.xiaobao.life,
    n = state.life.people.find((n) => n.id === "xiaobao")!;
  const goals = (["wind", "wood", "herb"] as XiaobaoProject[])
    .map(
      (k) =>
        `${XIAOBAO_WISHES[k]}：${s.projects[k].stage}/3${s.projects[k].stage === 3 ? "，家里可以查看成果" : ""}`,
    )
    .join("\n");
  const recent =
    s.journal
      .slice(-8)
      .map((e) => `第${Math.floor(e.time / 1440) + 1}日 · ${e.text}`)
      .join("\n") || "还没有写下今天的经历。";
  const x = state.xiaobao;
  const intention = s.emergency
    ? "先保护村庄"
    : x.rest
      ? "护风调息，精神恢复后再活动"
      : x.task === "follow"
        ? x.wait ? "在约好的地方等你" : "与你同行，留意村庄的安危"
        : x.task === "guard"
          ? x.gate === "all" ? "巡视村庄，保护大家" : `在${RAID_GATES.find(g => g.id === x.gate)!.name}巡护`
          : n.reason;
  return `今天最想：${XIAOBAO_WISHES[s.main]}\n有空还想：${XIAOBAO_WISHES[s.optional]}\n现在打算：${intention}\n\n慢慢实现的心愿\n${goals}\n\n最近的日记\n${recent}`;
}

export function xiaobaoThought(n: PersonState): string | undefined {
  if (!n.action || n.action.phase !== "perform") return;
  const key = n.action.xiaobao?.wish;
  if (n.action.xiaobao?.material === "wood")
    return "这份木料带好了，想帮阿禾一点忙。";
  if (n.action.kind === "eat") return "先吃饱，下午还想做好多事。";
  return key === "wind"
    ? "今天的风，也要记在我的小本子里。"
    : key === "wood"
      ? "这一刀慢一点，小木鸟会更好看。"
      : key === "herb"
        ? "这一片叶子，我想自己认出来。"
        : key === "deliver"
          ? "这一篮药草，是我亲手采的。"
          : key === "practice"
            ? "掌风轻一点，叶子就不会疼。"
            : key === "play"
              ? "踏过叶子，像风一样轻！"
              : key === "wander"
                ? "这里的风声，和广场不一样呢。"
                : key === "visit"
                  ? "来看你平平安安的，我就放心啦。"
                  : undefined;
}
