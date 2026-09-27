import { LIFE, person, type Place, type ResidentId } from "../../data/npcLife";
import type { Action, PersonState } from "./npcLifeState";
import type { Candidate, NpcLife } from "./npcLife";
import { distance, spaceBlocked, spaceClear } from "./npcNavigation";

const approach = (p: Place): Place | null => {
  for (const [dx, dy] of [
    [0, 35],
    [-35, 0],
    [35, 0],
    [0, -35],
    [-28, 28],
    [28, 28],
  ]) {
    const q = { space: p.space, x: p.x + dx, y: p.y + dy };
    if (!spaceBlocked(q.space, q.x, q.y) && spaceClear(q.space, q, p)) return q;
  }
  return null;
};
const awake = (life: NpcLife, id: ResidentId) => {
  const n = life.data.people.find((n) => n.id === id)!;
  const guard = life.state.defense.guards.find((g) => g.id === id);
  return (
    life.live(id) &&
    (!guard ||
      (!life.defense.runtime.get(id)?.attack &&
        !["intercept", "attack", "retreat"].includes(guard.mode))) &&
    n.body?.health !== "down" &&
    !(n.action?.kind === "sleep" && n.action.phase === "perform")
  );
};

// 只用本人已知的救护经历与位置安排探访；不从世界健康表搜索伤员。
export function socialCandidate(
  life: NpcLife,
  n: PersonState,
): Candidate | null {
  const l = life.data,
    d = person(n.id)!,
    p = life.body(n.id)!;
  if (
    n.alarm ||
    l.elapsed < n.social.cooldownUntil ||
    d.traits.compassion < LIFE.socialMinCompassion ||
    n.needs.hunger > LIFE.socialMaxHunger ||
    n.needs.fatigue > LIFE.socialMaxFatigue ||
    (n.body && n.body.health !== "healthy")
  )
    return null;
  const window = d.schedule.find(
      (s) => life.state.time % 1440 >= s.from && life.state.time % 1440 < s.to,
    ),
    afterCrisis = n.memories.some(
      (m) =>
        m.kind === "clear" &&
        m.time + LIFE.socialRecoveryMinutes > life.state.time,
    );
  if (
    !window ||
    (!afterCrisis && !["rest", "habit", "talk"].includes(window.activity)) ||
    (n.id.includes("-") && !["rest", "habit", "talk"].includes(window.activity))
  )
    return null;
  for (const m of [...n.memories].reverse()) {
    if (
      !["care", "help"].includes(m.kind) ||
      m.time + LIFE.socialMemoryMinutes < life.state.time
    )
      continue;
    const partner = m.subjects.find((id) => id !== n.id && !!person(id)) as
      ResidentId | undefined;
    if (
      !partner ||
      m.sequence <=
        Math.max(n.social.occasionFloor, n.social.visited[partner] ?? 0)
    )
      continue;
    const known = n.known[partner],
      relation = n.relations[partner];
    if (
      !known ||
      known.time + LIFE.socialKnownMinutes < life.state.time ||
      !relation ||
      relation.familiar < LIFE.socialMinFamiliar
    )
      continue;
    const target = approach(known);
    if (
      !target ||
      !life.available(target) ||
      !life.routeSafe(p, target) ||
      !life.safe(target)
    )
      continue;
    return {
      kind: "talk",
      target,
      facility: null,
      task: null,
      score:
        LIFE.socialBaseScore +
        d.traits.compassion * LIFE.socialCompassionWeight -
        distance(p, target) * LIFE.socialDistanceWeight,
      label: `探望${person(partner)!.name}，交换近日见闻`,
      social: { partner, occasion: m.sequence },
    };
  }
  return null;
}

export function socialReady(life: NpcLife, n: PersonState, a: Action) {
  const id = a.social?.partner,
    p = life.body(n.id)!,
    q = id && life.body(id);
  return (
    !!id &&
    !!q &&
    awake(life, id) &&
    !n.alarm &&
    life.safe(p) &&
    life.safe(q) &&
    p.space === q.space &&
    distance(p, q) < LIFE.socialRange &&
    spaceClear(p.space, p, q)
  );
}

export function updateSocial(life: NpcLife, n: PersonState, a: Action) {
  if (!a.social) return true;
  if (life.data.elapsed - a.started > LIFE.socialTravelMs) return false;
  const p = life.body(n.id)!,
    q = life.body(a.social.partner)!;
  // 只有亲眼看见才更新目标；错过旧位置后有限结束，不全地图追踪。
  if (
    p.space === q.space &&
    distance(p, q) < LIFE.observation &&
    spaceClear(p.space, p, q)
  ) {
    if (!awake(life, a.social.partner)) return false;
    const target = approach(q);
    if (!target || !life.routeSafe(p, target) || !life.safe(target))
      return false;
    a.target = target;
    n.known[a.social.partner] = { ...q, time: life.state.time };
  }
  return !(
    p.space === a.target.space &&
    distance(p, a.target) < 8 &&
    !socialReady(life, n, a)
  );
}

export function finishSocial(life: NpcLife, n: PersonState, a: Action) {
  if (!a.social || !socialReady(life, n, a)) return;
  const partner = life.data.people.find((p) => p.id === a.social!.partner)!;
  n.social.visited[partner.id] = a.social.occasion;
  n.social.cooldownUntil = life.data.elapsed + LIFE.socialCooldownMs;
  // 一次交谈各转述一条近期重要事实；调用已有知情与距离校验，不能凭空报告。
  for (const [from, to] of [
    [n, partner],
    [partner, n],
  ]) {
    const m = [...from.memories]
      .reverse()
      .find(
        (m) =>
          ["care", "help", "injury", "death"].includes(m.kind) &&
          m.time + LIFE.socialMemoryMinutes >= life.state.time &&
          !to.receipts.includes(m.sequence),
      );
    if (m) life.report(from.id, to.id, m.eventId);
  }
  life.emit(
    "company",
    life.body(n.id)!,
    n.id,
    [partner.id, n.id],
    `${person(n.id)!.name}到场探望${person(partner.id)!.name}并交换近日见闻`,
  );
}
