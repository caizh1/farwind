import { GUARD_DEFS, type GuardId } from "./defense";
export type ResidentId = "elder" | "healer" | "carpenter" | GuardId;
export type SpaceId =
  | "village"
  | "elder-home"
  | "healer-home"
  | "carpenter-home"
  | "barracks"
  | "inn";
export type Place = { space: SpaceId; x: number; y: number };
export type Activity =
  | "work"
  | "eat"
  | "sleep"
  | "rest"
  | "habit"
  | "talk"
  | "shelter"
  | "treat"
  | "escort"
  | "repair"
  | "count"
  | "duty"
  | "supply"
  | "store";
export type Schedule = {
  from: number;
  to: number;
  activity: Activity;
  place: Place;
  facility?: string;
  label: string;
  fallback: Activity;
};
export const LIFE = {
  speed: 86,
  decisionMs: 900,
  minActionMs: 3000,
  workMs: 8000,
  treatMs: 5000,
  repairMs: 7000,
  reservationMs: 12000,
  taskLeaseMs: 15000,
  clearMs: 10000,
  dangerRadius: 210,
  gateAlertRadius: 320,
  villageAlertRadius: 450,
  observation: 360,
  memoryLimit: 24,
  eventLimit: 80,
  taskLimit: 16,
  maxMedicine: 12,
  maxHerbs: 16,
  maxWood: 12,
  maxFood: 24,
  minGateReady: 2,
  maxGateAway: 1,
  retryLimit: 3,
  pathRetryMs: 1800,
  transferMs: 1500,
  pathNodesPerBatch: 64,
} as const;
// 楼梯落脚位逐项核验：北塔下方是旧风塔，南塔下方是工坊边缘，不能统一偏移。
export const GUARD_LANDINGS: Partial<Record<GuardId, Place>> = {
  "east-archer": { space: "village", x: 2030, y: 940 },
  "north-archer": { space: "village", x: 800, y: 390 },
  "south-archer": { space: "village", x: 1050, y: 1790 },
};
export const ROOM = {
  left: 380,
  right: 1020,
  top: 420,
  bottom: 960,
  entry: { x: 700, y: 910 },
} as const;
export const HOMES = [
  {
    id: "elder-home",
    name: "岚爷爷的家",
    building: "resident-cottage-1",
    door: { x: 550, y: 650 },
    owners: ["elder"],
    private: "风向笔记与旧风铃",
  },
  {
    id: "healer-home",
    name: "小满的药房与卧室",
    building: "shop",
    door: { x: 1110, y: 460 },
    owners: ["healer"],
    private: "植物图鉴与晾药架",
  },
  {
    id: "carpenter-home",
    name: "阿禾的家",
    building: "west-cottage",
    door: { x: 310, y: 900 },
    owners: ["carpenter"],
    private: "木鸟与工具箱",
  },
  {
    id: "barracks",
    name: "风铃营房",
    building: "barracks-building",
    door: { x: 1995, y: 650 },
    owners: GUARD_DEFS.map((d) => d.id),
    private: "独立床铺与具名储物箱",
  },
  {
    id: "inn",
    name: "归风旅馆客房侧门",
    building: "inn-building",
    door: { x: 1550, y: 1640 },
    owners: [] as ResidentId[],
    private: "六张临时床铺；住所受阻时按空位入住",
  },
] as const;
export const outdoor = (x: number, y: number): Place => ({
  space: "village",
  x,
  y,
});
const indoor = (space: SpaceId, x: number, y: number): Place => ({
  space,
  x,
  y,
});
export const FACILITIES = [
  ...HOMES.flatMap((h) =>
    h.owners.map((id, i) => ({
      id: `bed:${id}`,
      kind: "bed",
      owner: id,
      capacity: 1,
      place: indoor(h.id, 460 + (i % 5) * 110, 560 + Math.floor(i / 5) * 120),
      label: `${id === "elder" ? "岚爷爷" : id === "healer" ? "小满" : id === "carpenter" ? "阿禾" : GUARD_DEFS.find((d) => d.id === id)!.name}的床位`,
    })),
  ),
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `guest-bed:${i}`,
    kind: "bed",
    owner: "",
    capacity: 1,
    place: indoor("inn", 460 + (i % 3) * 160, 560 + Math.floor(i / 3) * 120),
    label: `旅馆临时床位${i + 1}`,
  })),
  ...HOMES.map((h) => ({
    id: `seat:${h.id}`,
    kind: "seat",
    owner: "",
    capacity: 1,
    place: indoor(h.id, 570, 800),
    label: "餐桌座位",
  })),
  {
    id: "pharmacy",
    kind: "work",
    owner: "healer",
    capacity: 1,
    place: indoor("healer-home", 830, 800),
    label: "配药工作位",
  },
  {
    id: "tools",
    kind: "work",
    owner: "carpenter",
    capacity: 1,
    place: outdoor(412, 1010),
    label: "木工工作位",
  },
  {
    id: "plaza-seat",
    kind: "seat",
    owner: "",
    capacity: 1,
    place: outdoor(730, 780),
    label: "广场休息处",
  },
  {
    id: "medical",
    kind: "aid",
    owner: "",
    capacity: 2,
    place: outdoor(780, 690),
    label: "广场救护点",
  },
  {
    id: "assembly",
    kind: "shelter",
    owner: "",
    capacity: 4,
    place: outdoor(760, 740),
    label: "风铃集结处",
  },
  {
    id: "west-refuge",
    kind: "shelter",
    owner: "",
    capacity: 4,
    place: outdoor(460, 720),
    label: "西巷备用集结处",
  },
  {
    id: "south-refuge",
    kind: "shelter",
    owner: "",
    capacity: 4,
    place: outdoor(1000, 1220),
    label: "杂货铺前集结处",
  },
] as const;
export const MAINTENANCE = [
  { id: "wind-bell", name: "广场警报风铃", place: outdoor(720, 650) },
  { id: "workbench", name: "木工台", place: outdoor(412, 1010) },
] as const;
export type PersonDef = {
  id: ResidentId;
  name: string;
  job: string;
  art: string;
  home: SpaceId;
  bed: string;
  ability: { medicine: number; repair: number };
  traits: { fear: number; compassion: number; duty: number; curiosity: number };
  habit: string;
  wish: string;
  schedule: Schedule[];
  friends: ResidentId[];
};
const slot = (
  from: number,
  to: number,
  activity: Activity,
  place: Place,
  label: string,
  facility?: string,
): Schedule => ({
  from: from * 60,
  to: to * 60,
  activity,
  place,
  label,
  facility,
  fallback: "rest",
});
const resident = (
  id: "elder" | "healer" | "carpenter",
  name: string,
  job: string,
  home: SpaceId,
  traits: PersonDef["traits"],
  schedule: Schedule[],
  habit: string,
  wish: string,
): PersonDef => ({
  id,
  name,
  job,
  art: id,
  home,
  bed: `bed:${id}`,
  ability: {
    medicine: id === "healer" ? 1 : 0,
    repair: id === "carpenter" ? 1 : 0,
  },
  traits,
  habit,
  wish,
  schedule,
  friends: id === "elder" ? ["healer", "carpenter"] : ["elder"],
});
export const PEOPLE: PersonDef[] = [
  resident(
    "elder",
    "岚爷爷",
    "守风人",
    "elder-home",
    { fear: 0.15, compassion: 0.7, duty: 1, curiosity: 0.2 },
    [
      slot(
        0,
        6,
        "sleep",
        indoor("elder-home", 460, 560),
        "在家睡觉",
        "bed:elder",
      ),
      slot(6, 9, "work", outdoor(670, 620), "检查风铃、记录风向"),
      slot(9, 12, "talk", outdoor(730, 780), "广场讲旧事", "plaza-seat"),
      slot(
        12,
        14,
        "eat",
        indoor("elder-home", 570, 800),
        "午饭与休息",
        "seat:elder-home",
      ),
      slot(14, 18, "work", outdoor(720, 650), "整理风向笔记"),
      slot(18, 21, "habit", indoor("elder-home", 830, 800), "擦拭旧风铃"),
      slot(
        21,
        24,
        "sleep",
        indoor("elder-home", 460, 560),
        "在家睡觉",
        "bed:elder",
      ),
    ],
    "离开前总会再看一眼风铃",
    "记下一个月的风向",
  ),
  resident(
    "healer",
    "小满",
    "药师",
    "healer-home",
    { fear: 0.9, compassion: 1, duty: 0.6, curiosity: 0.65 },
    [
      slot(
        0,
        6,
        "sleep",
        indoor("healer-home", 460, 560),
        "在家睡觉",
        "bed:healer",
      ),
      slot(6, 9, "work", outdoor(1070, 620), "照料药田"),
      slot(
        9,
        12,
        "work",
        indoor("healer-home", 830, 800),
        "配药与接待",
        "pharmacy",
      ),
      slot(
        12,
        14,
        "eat",
        indoor("healer-home", 570, 800),
        "午饭与休息",
        "seat:healer-home",
      ),
      slot(14, 17, "work", outdoor(1110, 570), "出诊、整理药草"),
      slot(17, 19, "supply", outdoor(1070, 620), "收药"),
      slot(
        19,
        22,
        "habit",
        indoor("healer-home", 830, 800),
        "画植物图鉴",
        "pharmacy",
      ),
      slot(
        22,
        24,
        "sleep",
        indoor("healer-home", 460, 560),
        "在家睡觉",
        "bed:healer",
      ),
    ],
    "闲下来会画一片新叶子",
    "补完村边植物图鉴",
  ),
  resident(
    "carpenter",
    "阿禾",
    "木匠",
    "carpenter-home",
    { fear: 0.45, compassion: 0.75, duty: 0.8, curiosity: 0.3 },
    [
      slot(
        0,
        6,
        "sleep",
        indoor("carpenter-home", 460, 560),
        "在家睡觉",
        "bed:carpenter",
      ),
      slot(6, 12, "work", outdoor(412, 1010), "修工具、做木工", "tools"),
      slot(
        12,
        14,
        "eat",
        indoor("carpenter-home", 570, 800),
        "午饭与休息",
        "seat:carpenter-home",
      ),
      slot(14, 18, "work", outdoor(412, 1010), "木工与保养工具", "tools"),
      slot(18, 21, "habit", indoor("carpenter-home", 830, 800), "雕刻木鸟"),
      slot(
        21,
        24,
        "sleep",
        indoor("carpenter-home", 460, 560),
        "在家睡觉",
        "bed:carpenter",
      ),
    ],
    "出门总先清点工具",
    "雕好一只送给村子的木鸟",
  ),
  ...GUARD_DEFS.map((g, i): PersonDef => {
    const bed = FACILITIES.find((f) => f.id === `bed:${g.id}`)!.place;
    // 每门窗口错开；守备不足时明确推迟，不补人或补血。
    const begin = [6, 12, 19][i % 3];
    return {
      id: g.id,
      name: g.name,
      job: g.role === "archer" ? "弓卫" : "卫兵",
      art: g.role === "archer" ? "defender-archer" : "defender-guard",
      home: "barracks",
      bed: `bed:${g.id}`,
      ability: { medicine: 0, repair: 0 },
      traits: {
        fear: i % 3 === 2 ? 0.7 : 0.25,
        compassion: i % 3 === 1 ? 0.85 : 0.4,
        duty: i % 3 === 0 ? 1 : 0.7,
        curiosity: i % 3 === 1 ? 0.9 : 0.25,
      },
      habit:
        i % 3 === 0
          ? "检查装备与村门"
          : i % 3 === 1
            ? "训练后与居民交谈"
            : "整理箭羽、临水观察",
      wish: "守住村门并平安下岗",
      friends: i % 3 === 1 ? ["healer", "elder"] : ["elder"],
      schedule: [
        slot(0, begin, "duty", outdoor(g.post.x, g.post.y), "值守"),
        slot(begin, begin + 2, "sleep", bed, "轮休", "bed:" + g.id),
        slot(
          begin + 2,
          begin + 3,
          "habit",
          i % 3 === 2
            ? outdoor(1540, 1390)
            : indoor(
                "barracks",
                460 + (i % 5) * 110,
                800 + Math.floor(i / 5) * 70,
              ),
          i % 3 === 2 ? "临水休息" : i % 3 === 1 ? "训练、聊天" : "检查装备",
        ),
        slot(begin + 3, 24, "duty", outdoor(g.post.x, g.post.y), "值守"),
      ],
    };
  }),
];
export const person = (id: string) => PEOPLE.find((p) => p.id === id);
export const ACTION_LABELS: Record<Activity, string> = {
  work: "工作",
  eat: "吃饭",
  sleep: "睡觉",
  rest: "休息",
  habit: "个人习惯",
  talk: "交谈",
  shelter: "避难",
  treat: "救治",
  escort: "陪同转移",
  repair: "维修",
  count: "清点人员",
  duty: "值守",
  supply: "取放物品",
  store: "归还私人物品",
};

// 每人恰有一件不可交易的私人物品；位置由生活状态唯一记录，不复制公共库存。
export const PRIVATE_STORAGE = PEOPLE.map((p) => {
  const bed = FACILITIES.find((f) => f.id === p.bed)!;
  return {
    id: `locker:${p.id}`,
    owner: p.id,
    space: p.home,
    x: bed.place.x + 50,
    y: bed.place.y - 54,
    label: `${p.name}的储物箱`,
    item:
      p.id === "healer"
        ? "药箱"
        : p.id === "carpenter"
          ? "工具包"
          : p.id === "elder"
            ? "风向笔记"
            : p.id.endsWith("archer")
              ? "箭羽整理盒"
              : p.id.endsWith("spear")
                ? "保养布"
                : "巡逻手册",
    use: indoor(p.home, bed.place.x + 50, bed.place.y - 25),
  };
});
