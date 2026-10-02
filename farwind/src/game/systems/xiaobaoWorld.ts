import {moveXiaobaoLife,suspendXiaobaoLife,noteXiaobaoHelp} from './xiaobaoLife';
import type { World } from "../scenes/World";
import { GUARD_DEFS, RAID_GATES } from "../../data/defense";
import { zoneFor, locallyProtected } from "../../data/defenseZones";
import { MAINTENANCE } from "../../data/npcLife";
import { DAY_NIGHT } from "../../data/dayNight";
import { regionAt } from "../../data/village";
import { clearMeleeLine, motionBlocked, type Point } from "./obstacles";
import { predictEnemyContact } from "./enemyAttack";
import {
  type XiaobaoAlly,
  type XiaobaoEnvironment,
  type XiaobaoFront,
} from "./xiaobaoCombat";
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export function xiaobaoAllies(w: World): XiaobaoAlly[] {
  const c = w.xiaobao!.controller,
    outside = w.state.life.playerSpace === "village",
    p = outside ? w.state.player : { ...w.state.life.outside, hp: 0 };
  const allies: XiaobaoAlly[] = [
    ...(outside && p.hp > 0
      ? [
          {
            ...p,
            id: "player",
            maxHP: 100,
            role: "player" as const,
            threatAt: null,
          },
        ]
      : []),
    ...(c.data.space==='village' ? [{
      id: "xiaobao",
      x: c.x,
      y: c.y,
      hp: c.data.hp,
      maxHP: 640,
      role: "self" as const,
      threatAt: null,
    }] : []),
    ...w.state.defense.guards
      .filter((g) => !g.dead && (g.space ?? "village") === "village")
      .map((g) => ({
        id: g.id,
        x: g.x,
        y: g.y,
        hp: g.hp,
        maxHP: GUARD_DEFS.find((d) => d.id === g.id)!.maxHP,
        role: "guard" as const,
        threatAt: null,
      })),
    ...w.state.life.people.flatMap((n) =>
      n.body?.space === "village" && n.body.hp > 0 && n.body.health !== "down"
        ? [
            {
              ...n.body,
              id: n.id,
              maxHP: 100,
              role: "resident" as const,
              threatAt: null,
            },
          ]
        : [],
    ),
    ...MAINTENANCE.filter((f) => w.state.life.facilities[f.id] > 0).map(
      (f) => ({
        ...f.place,
        id: f.id,
        hp: w.state.life.facilities[f.id],
        maxHP: 100,
        role: "facility" as const,
        threatAt: null,
      }),
    ),
  ];
  return allies;
}
export function xiaobaoEnvironment(w: World): XiaobaoEnvironment {
  const c = w.xiaobao!.controller,
    outside = w.state.life.playerSpace === "village",
    p = outside ? w.state.player : { ...w.state.life.outside, hp: 0 };
  if(w.life)w.life.xiaobaoDemonstrating=c.demonstration;
  // 静止菌根是可拆的环境机关，不作为伙伴自主索敌或持久施法目标。
  const enemies = [...w.enemies, ...w.defense.enemies].filter(e=>!e.passiveRoot),
    allies = xiaobaoAllies(w);
  for (const e of enemies) {
    if (
      e.hp <= 0 ||
      e.disabled ||
      !e.attack ||
      e.attack.cancelled ||
      e.attack.resolved
    )
      continue;
    const victim = allies.find((a) => a.id === e.targetId);
    if (!victim || e.attack.contactAt > w.sim + 600) continue;
    const at = predictEnemyContact(e.attack, e, victim, w.sim);
    if (at !== null && at <= w.sim + 600)
      victim.threatAt = Math.min(victim.threatAt ?? Infinity, at);
  }
  return {
    lifeMove:w.life ? (ms,budget)=>{const started=performance.now();moveXiaobaoLife(w.life,c,ms,budget);const cost=performance.now()-started;w.life.metrics.xiaobaoMoveMs+=cost;w.life.metrics.xiaobaoMoveMaxMs=Math.max(w.life.metrics.xiaobaoMoveMaxMs,cost);} : undefined,
    lifeEmergency:w.life ? active=>{if(active)suspendXiaobaoLife(w.life);} : undefined,
    lifeHelp:w.life ? id=>noteXiaobaoHelp(w.life,id) : undefined,
    now: w.sim,
    minute: w.state.time,
    player: { ...p, outside, region: regionAt(p).id },
    enemies,
    allies,
    recent: w.xiaobaoRecent,
    // 野怪追击时尚未创建攻击；从正式索敌结果识别主角的危险，不提前拉家园怪。
    playerThreats: c.data.task === "follow" && outside && p.hp > 0 ? enemies.filter(e =>
      e.hp > 0 && !e.disabled && e.nav.mode === "chase" && !e.nav.returning &&
      w.enemyVictim(e).id === "player").map(e => e.id) : [],
    fronts: () => xiaobaoFronts(w, allies),
    move: (...args) => w.defense.move(...args),
    hit: (...args) => w.xiaobaoHit(...args),
    blocked: (p) => motionBlocked(p.x, p.y),
    takeoffClear: (p) => !w.xiaobaoUnderRoof(p),
    checkpoint: (id) => w.checkpointXiaobaoFlight(id),
    message: (s) => w.ui.message(s),
  };
}
export function xiaobaoFronts(w: World, allies: XiaobaoAlly[]): XiaobaoFront[] {
  const defense = w.defense,
    now = w.sim,
    live = defense.allHostiles().filter((e) => e.hp > 0 && !e.disabled && !e.passiveRoot);
  const recent = w.state.life.events.filter(
    (e) =>
      !e.debug &&
      ["injury", "down", "damage", "death"].includes(e.kind) &&
      ((w.state.time - e.time) / DAY_NIGHT.speed) * 1000 <= 1500 &&
      e.place.space === "village",
  );
  const grouped = RAID_GATES.flatMap<XiaobaoFront & {battle:boolean;contactAt:number}>((g) => {
    const threats = live.filter((e) => {
      const record = defense.threats.get(e.id),
        reason = defense.threatReason(g.id, e),
        hurt = recent.some((r) => r.source === e.id);
      const actual = allies.find(
        (a) =>
          a.id === e.targetId &&
          a.threatAt !== null &&
          a.role !== "self" &&
          a.role !== "player",
      );
      const reported =
        record?.gateId === g.id &&
        record.reason !== "observe" &&
        now - record.lastSeen <= 1500;
      const seen = allies.some(
        (a) =>
          a.role === "resident" &&
          distance(a, e) <= 450 &&
          clearMeleeLine(a, e),
      );
      const nearest =
        RAID_GATES.reduce((a, b) =>
          distance(e, a.inside) <= distance(e, b.inside) ? a : b,
        ).id === g.id;
      return (
        !!reason || w.state.defense.raid?.gateId===g.id&&w.state.defense.raid.members.some(m=>m.id===e.id) ||
        (nearest &&
          (hurt || !!actual || (seen && locallyProtected(g.id, e)))) ||
        reported
      );
    });
    if (!threats.length) {
      const raid=w.state.defense.raid;
      return raid?.gateId===g.id && raid.phase==='warning'
        ? [{key:raid.id,gate:g.id,major:false,confirmed:true,priority:2,point:zoneFor(g.id).intercept,enemies:[],injured:false,battle:false,contactAt:Infinity}]
        : [];
    }
    const urgent = allies
      .filter(
        (a) =>
          ["resident", "facility"].includes(a.role) &&
          a.threatAt !== null &&
          threats.some((e) => e.targetId === a.id),
      )
      .sort((a, b) => a.threatAt! - b.threatAt! || a.id.localeCompare(b.id));
    urgent.sort((a,b)=>Number(b.role==='resident')-Number(a.role==='resident')||a.threatAt!-b.threatAt!||a.id.localeCompare(b.id));
    const injured = recent.some((r) => threats.some((e) => e.id === r.source));
    const intrusion = threats.some(
      (e) =>
        defense.threatReason(g.id, e) === "intrusion" ||
        regionAt(e).id === "village",
    );
    const battle = threats.some(
      (e) =>
        ["intrusion", "attack"].includes(defense.threatReason(g.id, e) ?? "") ||
        (e.attack && !e.attack.cancelled && !e.attack.resolved),
    );
    const failed =
      battle &&
      w.state.defense.guards.filter(
        (d) =>
          d.id.startsWith(g.id.split("-")[0]) &&
          !d.dead &&
          !d.offDuty &&
          (d.space ?? "village") === "village" &&
          d.hp / GUARD_DEFS.find((f) => f.id === d.id)!.maxHP >= 0.35,
      ).length < 2;
    const breach =
      intrusion &&
      threats.some(
        (e) =>
          (distance(e, g.inside) < 260 &&
            ((e.x - g.inside.x) * (g.inside.x - g.entry.x) +
              (e.y - g.inside.y) * (g.inside.y - g.entry.y)) /
              distance(g.inside, g.entry) >
              80) ||
          distance(e, { x: 760, y: 740 }) < 380,
      );
    const key =
      w.state.defense.raid?.gateId === g.id
        ? w.state.defense.raid.id
        : `front:${g.id}`;
    return [
      {
        key,
        gate: g.id,
        major: injured || urgent.length > 0 || failed || breach,
        confirmed:true,
        priority:
          urgent.some(a=>a.role==='resident') ? 5 : breach ? 4 : failed ? 3 : 2,
        point: urgent[0] ?? (breach ? [...threats].sort((a,b)=>distance(a,{x:760,y:740})-distance(b,{x:760,y:740}))[0] : null) ?? zoneFor(g.id).intercept,
        enemies: threats.map((e) => e.id),
        injured,
        battle,
        contactAt: Math.min(
          ...allies
            .filter(
              (a) =>
                a.threatAt !== null && threats.some((e) => e.targetId === a.id),
            )
            .map((a) => a.threatAt!),
        ),
      },
    ];
  });
  if (grouped.filter((g) => g.battle).length >= 2)
    for (const g of grouped) if (g.battle) g.major = true;
  return grouped;
}
