export const EAST_TOWER = {
  id: "east-gate-tower",
  x: 2030, y: 900, w: 200, h: 270,
  perch: { x: 2108, y: 780 },
  muzzle: { x: 2130, y: 746 },
  occupantGuardId: "east-archer",
  range: 550,
  gateId: "east-gate", outward: { x: 1, y: 0 },
} as const;
export const TOWERS = [EAST_TOWER,
  { id: "north-gate-tower", gateId: "north-gate", x: 680, y: 350, w: 200, h: 270,
    perch: { x: 700, y: 230 }, muzzle: { x: 675, y: 156 },
    occupantGuardId: "north-archer", range: 550, outward: { x: 0, y: -1 } },
  { id: "south-gate-tower", gateId: "south-gate", x: 1140, y: 1750, w: 200, h: 270,
    perch: { x: 1160, y: 1630 }, muzzle: { x: 1160, y: 1601 },
    occupantGuardId: "south-archer", range: 550, outward: { x: 0, y: 1 } },
] as const;
export type GateId = typeof TOWERS[number]["gateId"];
export const RAID_GATES = [
  { id: "east-gate", name: "东门", x: 2100, y: 1080, inside: { x: 1940, y: 1080 },
    entry: { x: 2140, y: 1080 }, spawns: [{ x: 2370, y: 1090 }, { x: 2390, y: 1140 }, { x: 2470, y: 1140 }, { x: 2430, y: 1180 }] },
  { id: "north-gate", name: "北门", x: 820, y: 220, inside: { x: 820, y: 380 },
    entry: { x: 820, y: 180 }, spawns: [{ x: 620, y: 120 }, { x: 660, y: 110 }, { x: 680, y: 130 }, { x: 640, y: 90 }] },
  { id: "south-gate", name: "南门", x: 900, y: 1820, inside: { x: 900, y: 1660 },
    entry: { x: 900, y: 1860 }, spawns: [{ x: 1140, y: 2060 }, { x: 1200, y: 2090 }, { x: 1160, y: 2110 }, { x: 1240, y: 2070 }] },
] as const;
export const GUARD_WEAPONS = {
  "watch-blade": { damage: 18, range: 76, windup: 280, cooldown: 1000 },
  "watch-bow": { damage: 22, range: 550, windup: 450, cooldown: 1500 },
} as const;
export const GUARD_ARMOR = { "watch-mail": 6, "watch-leather": 3 } as const;
export const GUARD_DEFS = [
  { id: "east-watch", name: "岑风", role: "melee", maxHP: 180,
    weaponId: "watch-blade", armorId: "watch-mail", postId: "east-north-post",
    post: { x: 2010, y: 970 }, cover: { x: 1920, y: 1060 },
    patrol: [{ x: 2010, y: 970 }], leash: 300 },
  { id: "east-patrol", name: "青禾", role: "melee", maxHP: 180,
    weaponId: "watch-blade", armorId: "watch-mail", postId: "east-south-post",
    post: { x: 2010, y: 1160 }, cover: { x: 1910, y: 1190 },
    patrol: [{ x: 2010, y: 1160 }, { x: 1960, y: 1210 }, { x: 1940, y: 1140 }], leash: 300 },
  { id: "east-archer", name: "弦雨", role: "archer", maxHP: 100,
    weaponId: "watch-bow", armorId: "watch-leather", postId: "east-gate-tower",
    post: { x: EAST_TOWER.x, y: EAST_TOWER.y }, cover: { x: EAST_TOWER.x, y: EAST_TOWER.y },
    patrol: [{ x: EAST_TOWER.x, y: EAST_TOWER.y }], leash: 0 },
  { id: "north-watch", name: "松岚", role: "melee", maxHP: 180,
    weaponId: "watch-blade", armorId: "watch-mail", postId: "north-west-post",
    post: { x: 740, y: 300 }, cover: { x: 760, y: 486 },
    patrol: [{ x: 740, y: 300 }], leash: 300 },
  { id: "north-patrol", name: "石泉", role: "melee", maxHP: 180,
    weaponId: "watch-blade", armorId: "watch-mail", postId: "north-east-post",
    post: { x: 920, y: 300 }, cover: { x: 860, y: 450 },
    patrol: [{ x: 920, y: 300 }, { x: 860, y: 410 }, { x: 860, y: 450 }], leash: 300 },
  { id: "north-archer", name: "林弦", role: "archer", maxHP: 100,
    weaponId: "watch-bow", armorId: "watch-leather", postId: "north-gate-tower",
    post: { x: 680, y: 350 }, cover: { x: 680, y: 350 }, patrol: [{ x: 680, y: 350 }], leash: 0 },
  { id: "south-watch", name: "麦川", role: "melee", maxHP: 180,
    weaponId: "watch-blade", armorId: "watch-mail", postId: "south-west-post",
    post: { x: 810, y: 1720 }, cover: { x: 790, y: 1592 },
    patrol: [{ x: 810, y: 1720 }], leash: 300 },
  { id: "south-patrol", name: "望禾", role: "melee", maxHP: 180,
    weaponId: "watch-blade", armorId: "watch-mail", postId: "south-east-post",
    post: { x: 990, y: 1720 }, cover: { x: 1020, y: 1590 },
    patrol: [{ x: 990, y: 1720 }, { x: 1030, y: 1680 }, { x: 950, y: 1630 }], leash: 300 },
  { id: "south-archer", name: "晴羽", role: "archer", maxHP: 100,
    weaponId: "watch-bow", armorId: "watch-leather", postId: "south-gate-tower",
    post: { x: 1140, y: 1750 }, cover: { x: 1140, y: 1750 }, patrol: [{ x: 1140, y: 1750 }], leash: 0 },
] as const;
export type GuardId = typeof GUARD_DEFS[number]["id"];
export const RAID_SPAWNS = [{ x: 2430, y: 1080 }, { x: 2390, y: 1140 }, { x: 2470, y: 1120 }] as const;
export const DEFENSE = { regenWait: 8000, regenPerSecond: 0.0075, retreatHP: 0.35,
  resumeHP: 0.65, speed: 100, enemySpeed: 66, arrowSpeed: 430, arrowLife: 1800,
  arrowLimit: 12, unitLimit: 3, historyUnitLimit: 4, arrowRange: 774, eventLimit: 120000 } as const;
export const RAID_TIMING = { protection: 300000, minInterval: 480000, maxInterval: 900000,
  warning: 3000, retry: 20000, checkpoint: 20000 } as const;
export const DEFENSE_RULES = { health: .8, scan: 150, approach: 400, lost: 1000,
  pursuit: 8000, reacquire: 2000, stuck: 2000, observationRange: 450 } as const;
export function nextDefenseRandom(seed: number) {
  seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0;
}
export const raidInterval = (seed: number) => RAID_TIMING.minInterval + seed % (RAID_TIMING.maxInterval - RAID_TIMING.minInterval + 1);
