import { initialState, validate } from "../src/game/systems/state";
import { prepareRaid } from "../src/game/systems/defense";
import { person, FACILITIES } from "../src/data/npcLife";
import { NpcLife } from "../src/game/systems/npcLife";
import { EastDefense } from "../src/game/systems/defense";

// 固定起始存档代表已有来袭与既有伤亡；之后只调用正式模拟和伤害入口。
export function encounterState(hp = 100) {
  const s = initialState();
  s.time = 540;
  s.defense = prepareRaid(s.defense, s.player, "north-gate", 1);
  Object.assign(s.defense.raid!.members[0], { x: 850, y: 490 });
  for (const g of s.defense.guards.filter((g) => g.id.startsWith("north-")))
    Object.assign(g, { hp: 0, dead: true, mode: "dead" });
  Object.assign(s.life.people[0].body!, {
    space: "village",
    x: 850,
    y: 515,
    hp,
    health: hp === 100 ? "healthy" : "hurt",
  });
  Object.assign(s.life.people[1].body!, { space: "village", x: 800, y: 560 });
  s.life.people[1].gear = "carried";
  s.life.people[1].supplies.medicine = 2;
  s.life.stores.medicine -= 2;
  Object.assign(s.life.people[2].body!, {
    space: "carpenter-home",
    x: 570,
    y: 800,
  });
  return validate(s);
}

export function pharmacyEncounterState(hp = 8) {
  const s = encounterState(hp),
    life = new NpcLife(s, new EastDefense(s.defense, 0)),
    n = s.life.people[1];
  Object.assign(n.body!, FACILITIES.find((f) => f.id === "pharmacy")!.place);
  life.begin(
    n,
    life.candidates(n).find((c) => c.facility === "pharmacy")!,
  );
  // 合法进行中的旧档样本；后续警报、受伤与照护不由夹具注入。
  n.action!.phase = "perform";
  n.action!.progress = 3000;
  return validate(s);
}

export function facilityEncounterState() {
  const s = encounterState();
  s.time = 780;
  Object.assign(s.player, { x: 830, y: 1050 });
  Object.assign(s.defense.raid!.members[0], { x: 720, y: 620 });
  for (const n of s.life.people.filter((n) => n.body))
    Object.assign(n.body!, { space: person(n.id)!.home, x: 460, y: 560 });
  return validate(s);
}
