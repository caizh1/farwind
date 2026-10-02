import type { SpaceId } from "../../data/npcLife";

export const XIAOBAO_WISHES = {
  wind: "留下自己的风向笔记",
  wood: "做出第一只木鸟",
  herb: "学会辨认村庄常用药草",
  practice: "把听风掌练得更轻",
  play: "找个朋友一起玩",
  visit: "去看看惦记的朋友",
  wander: "到近郊听一听风",
  deliver: "帮村里送一趟材料",
} as const;
export type XiaobaoWish = keyof typeof XIAOBAO_WISHES;
export type XiaobaoProject = "wind" | "wood" | "herb";
export type XiaobaoLifeState = {
  version: 1;
  seed: number;
  day: number;
  basket: number;
  main: XiaobaoWish;
  optional: XiaobaoWish;
  done: XiaobaoWish[];
  projects: Record<XiaobaoProject, { stage: number; lastDay: number }>;
  interests: Record<XiaobaoProject, number>;
  journal: { sequence: number; time: number; text: string }[];
  promise: {
    response: "accepted" | "later" | "declined";
    expires: number;
    actionId: number;
    reason: string;
    status: "waiting" | "done" | "cancelled";
  } | null;
  emergency: boolean;
  clearSince: number | null;
  aftercareUntil: number;
  resumeTask: "follow" | "guard" | null;
  metrics: {
    attempts: number;
    completed: number;
    failed: number;
    interrupted: number;
  };
};
export const initialXiaobaoLife = (): XiaobaoLifeState => ({
  version: 1,
  seed: 20261002,
  day: -1,
  basket: 0,
  main: "wind",
  optional: "play",
  done: [],
  projects: {
    wind: { stage: 0, lastDay: -1 },
    wood: { stage: 0, lastDay: -1 },
    herb: { stage: 0, lastDay: -1 },
  },
  interests: { wind: 65, wood: 55, herb: 50 },
  journal: [],
  promise: null,
  emergency: false,
  clearSince: null,
  aftercareUntil: 0,
  resumeTask: null,
  metrics: { attempts: 0, completed: 0, failed: 0, interrupted: 0 },
});

// 导入存档也必须经过同一白名单，不能让日记、承诺或行动元数据无限增长。
export function validateXiaobaoLife(raw: unknown): XiaobaoLifeState {
  const s = raw as XiaobaoLifeState;
  const num = (n: unknown, max = 1e12, min = 0) =>
    typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
  const day = (n: unknown) => Number.isSafeInteger(n) && num(n, 1e6, -1);
  const wish = (v: unknown) =>
    typeof v === "string" && Object.hasOwn(XIAOBAO_WISHES, v);
  const text = (v: unknown) =>
    typeof v === "string" && v.length > 0 && v.length <= 160;
  if (
    !s ||
    s.version !== 1 ||
    !Number.isSafeInteger(s.seed) ||
    !num(s.seed, 0xffffffff) ||
    !day(s.day) ||
    !Number.isInteger(s.basket) ||
    !num(s.basket, 1) ||
    !wish(s.main) ||
    !wish(s.optional) ||
    s.main === s.optional ||
    !Array.isArray(s.done) ||
    s.done.length > 8 ||
    new Set(s.done).size !== s.done.length ||
    !s.done.every(wish) ||
    !s.projects ||
    !s.interests ||
    !["wind", "wood", "herb"].every((k) => {
      const p = s.projects[k as XiaobaoProject];
      return (
        p &&
        Number.isInteger(p.stage) &&
        num(p.stage, 3) &&
        day(p.lastDay) &&
        p.lastDay <= s.day &&
        num(s.interests[k as XiaobaoProject], 100)
      );
    }) ||
    !Array.isArray(s.journal) ||
    s.journal.length > 32 ||
    !s.journal.every(
      (e) =>
        e &&
        Number.isSafeInteger(e.sequence) &&
        num(e.sequence) &&
        num(e.time, 1e8) &&
        text(e.text),
    ) ||
    typeof s.emergency !== "boolean" ||
    !(s.clearSince === null || num(s.clearSince)) ||
    !num(s.aftercareUntil, 1e8) ||
    !(
      s.resumeTask === undefined ||
      s.resumeTask === null ||
      ["follow", "guard"].includes(s.resumeTask)
    ) ||
    !s.metrics ||
    !["attempts", "completed", "failed", "interrupted"].every(
      (k) =>
        Number.isSafeInteger(s.metrics[k as keyof typeof s.metrics]) &&
        num(s.metrics[k as keyof typeof s.metrics], 1e9),
    ) ||
    (s.promise !== null &&
      (!s.promise ||
        !["accepted", "later", "declined"].includes(s.promise.response) ||
        !["waiting", "done", "cancelled"].includes(s.promise.status) ||
        !num(s.promise.expires, 1e8) ||
        !Number.isSafeInteger(s.promise.actionId) ||
        !num(s.promise.actionId, 1e9) ||
        !text(s.promise.reason)))
  )
    throw Error("小宝的生活记录无效，上一份有效存档仍保留。");
  const projects = Object.fromEntries(
    ["wind", "wood", "herb"].map((k) => [
      k,
      {
        stage: s.projects[k as XiaobaoProject].stage,
        lastDay: s.projects[k as XiaobaoProject].lastDay,
      },
    ]),
  ) as XiaobaoLifeState["projects"];
  return {
    version: 1,
    seed: s.seed,
    day: s.day,
    basket: s.basket,
    main: s.main,
    optional: s.optional,
    done: [...s.done],
    projects,
    interests: {
      wind: s.interests.wind,
      wood: s.interests.wood,
      herb: s.interests.herb,
    },
    journal: s.journal.map((e) => ({
      sequence: e.sequence,
      time: e.time,
      text: e.text,
    })),
    promise: s.promise
      ? {
          response: s.promise.response,
          expires: s.promise.expires,
          actionId: s.promise.actionId,
          reason: s.promise.reason,
          status: s.promise.status,
        }
      : null,
    emergency: s.emergency,
    clearSince: s.clearSince,
    aftercareUntil: s.aftercareUntil,
    resumeTask: s.resumeTask ?? null,
    metrics: {
      attempts: s.metrics.attempts,
      completed: s.metrics.completed,
      failed: s.metrics.failed,
      interrupted: s.metrics.interrupted,
    },
  };
}
export type XiaobaoLifeIntent = {
  space: SpaceId;
  x: number;
  y: number;
  action:
    | "idle"
    | "sleep"
    | "meditate"
    | "palm"
    | "wave"
    | "laugh"
    | "step"
    | "bow"
    | "eat"
    | "gather"
    | "carry"
    | "write";
  elapsed: number;
  label: string;
};
