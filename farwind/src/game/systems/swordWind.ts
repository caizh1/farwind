import { attackConfig, facingVector, type Attack, type Target } from "./combat";
import {
  resolveSwordWindConfig,
  type SwordWindConfig,
} from "../../data/swordWind";
import { SWORD_WIND_RELEASES } from "../../data/swordWindArt";
import { firstSwordWindBlocker, sweptTargetContact } from "./swordWindGeometry";
import type { Point } from "./obstacles";
export type WindTarget = Target & { disabled?: boolean; radius?: number };
export type WindMotion = {
  target: WindTarget;
  previous: Point;
  current: Point;
};
export type WindEnd = "target" | "obstacle" | "range" | "lifetime";
export type SwordWind = {
  id: number;
  attackId: number;
  comboId: number;
  source: string;
  config: SwordWindConfig;
  attack: Attack;
  born: number;
  previous: Point;
  position: Point;
  origin: Point;
  facing: Attack["facing"];
  distance: number;
  maxTargets: number | "all";
  hit: Set<string>;
  terminated: boolean;
  reason?: WindEnd;
  ended?: number;
  contact?: Point;
  visualOffset: Point;
  initialChecked: boolean;
};
export type WindEvent = {
  wind: SwordWind;
  at: number;
  point: Point;
  target?: WindTarget;
  reason: WindEnd;
};
// 纯呈现数据：只铺裁决完成的地面路径，不参与碰撞、伤害或存档。
export function swordWindGroundSegments(w: SwordWind, now: number) {
  if (!w.initialChecked) return [];
  const [dx, dy] = facingVector(w.facing),
    m = w.config.art;
  const extent = Math.max(
    0,
    (w.position.x - w.origin.x) * dx + (w.position.y - w.origin.y) * dy,
  );
  const birth = swordWindBirth(w.attack, w.origin, w.config).position;
  const birthDistance =
    (birth.x - w.origin.x) * dx + (birth.y - w.origin.y) * dy;
  const segments = [];
  for (
    let start = 8, index = 0;
    start < extent;
    start += m.groundStep, index++
  ) {
    const age =
      now -
      w.born -
      (Math.max(0, start - birthDistance) / w.config.speed) * 1000;
    if (age < 0 || age >= m.groundLifetime) continue;
    segments.push({
      index,
      x: w.origin.x + dx * (start + m.groundStep / 2),
      y: w.origin.y + dy * (start + m.groundStep / 2),
      frame: Math.min(5, Math.floor(age / m.groundFrame)),
      crop: (128 * Math.min(m.groundStep, extent - start)) / m.groundStep,
      alpha: Math.min(1, (m.groundLifetime - age) / m.groundFade) * 0.88,
    });
  }
  return segments;
}
const mix = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
export function swordWindBirth(
  attack: Attack,
  root: Point,
  config: SwordWindConfig,
) {
  const [x, y] = facingVector(attack.facing),
    angle = Math.atan2(y, x),
    tip =
      SWORD_WIND_RELEASES[
        attack.facing === 0 ? 0 : attack.facing === 1 ? 1 : 2
      ];
  const anchor =
      config.art.attachments[
        attack.facing === 0 ? 0 : attack.facing === 1 ? 1 : 2
      ],
    attachment = {
      x: anchor[0],
      y: anchor[1] * (attack.facing === 2 ? -1 : 1),
    };
  const ax = attachment.x * Math.cos(angle) - attachment.y * Math.sin(angle),
    ay = attachment.x * Math.sin(angle) + attachment.y * Math.cos(angle);
  const visual = {
    x: tip.x * (attack.facing === 2 ? -1 : 1) - ax,
    y: tip.y - ay,
  };
  // 可见前缘与碰撞前缘共用接触平面。上身投影只转回地面高度，不把剑尖屏幕高度当地图坐标。
  const forward = Math.max(
      config.spawnForward,
      visual.x * x +
        (visual.y + config.art.bodyHeight) * y +
        config.art.frontEdge -
        config.width / 2,
    ),
    ground = { x: x * forward, y: y * forward };
  // root→出生点的完整起始路径仍参与扫掠，因此此锚点不会跳过贴身目标或薄墙。
  return {
    position: { x: root.x + ground.x, y: root.y + ground.y },
    visualOffset: { x: visual.x - ground.x, y: visual.y - ground.y },
  };
}
export class SwordWindSystem {
  serial = 0;
  winds: SwordWind[] = [];
  lastAttackId = 0;
  events: WindEvent[] = [];
  clear() {
    this.winds = [];
    this.lastAttackId = 0;
    this.events = [];
  }
  launch(attack: Attack, root: Point, at: number, damage: number) {
    if (attack.stage !== 4 || attack.id <= this.lastAttackId) return null;
    this.lastAttackId = attack.id;
    if (this.winds.some((w) => !w.terminated)) return null;
    const base = attack.swordWind ?? resolveSwordWindConfig(),
      config = {
        ...structuredClone(base),
        damage,
        maxTargets: 1 as number | "all",
      },
      birth = swordWindBirth(attack, root, config);
    const snapshot: Attack = {
      ...attack,
      hit: new Set(),
      config: { ...attackConfig(attack) },
      swordWind: config,
    };
    const wind: SwordWind = {
      id: ++this.serial,
      attackId: attack.id,
      comboId: attack.comboId ?? attack.id,
      source: "hero",
      config,
      attack: snapshot,
      born: at,
      previous: { ...birth.position },
      position: { ...birth.position },
      origin: { ...root },
      facing: attack.facing,
      distance: 0,
      maxTargets: 1,
      hit: new Set(),
      terminated: false,
      visualOffset: birth.visualOffset,
      initialChecked: false,
    };
    this.winds.push(wind);
    return wind;
  }
  advance(
    prev: number,
    now: number,
    targets: WindMotion[],
    blocker = firstSwordWindBlocker,
  ) {
    const result: WindEvent[] = [];
    for (const w of this.winds) {
      if (w.terminated || now < w.born) continue;
      const from = Math.max(prev, w.born),
        until = Math.min(now, w.born + w.config.lifetime),
        [vx, vy] = facingVector(w.facing);
      const scan = (a: Point, b: Point, start: number, end: number) => {
        const wall = blocker(a, b, w.config.width / 2),
          contacts: { target: WindTarget; t: number; center: Point }[] = [];
        for (const motion of targets) {
          const target = motion.target;
          if (target.hp <= 0 || target.disabled || w.hit.has(target.id))
            continue;
          const u = (at: number) =>
              now > prev
                ? Math.max(0, Math.min(1, (at - prev) / (now - prev)))
                : 1,
            old = mix(motion.previous, motion.current, u(start)),
            current = mix(motion.previous, motion.current, u(end)),
            t = sweptTargetContact(
              a,
              b,
              old,
              current,
              w.config.width / 2 + (target.radius ?? 14),
            );
          if (t !== null)
            contacts.push({ target, t, center: mix(old, current, t) });
        }
        contacts.sort(
          (a, b) => a.t - b.t || a.target.id.localeCompare(b.target.id),
        );
        const target = contacts[0];
        // 同刻实体障碍优先；无敌有效目标也消费剑风，伤害入口自行裁决。
        const obstacle = !!wall && (!target || wall.t <= target.t + 1e-8),
          t = obstacle ? wall!.t : target?.t;
        if (t === undefined) return false;
        const point = mix(a, b, t);
        w.position = point;
        w.terminated = true;
        w.reason = obstacle ? "obstacle" : "target";
        w.ended = start + (end - start) * t;
        if (!obstacle) w.hit.add(target.target.id);
        const dx = obstacle ? vx : target.center.x - point.x,
          dy = obstacle ? vy : target.center.y - point.y,
          len = Math.hypot(dx, dy) || 1;
        w.contact = {
          x: point.x + ((dx / len) * w.config.width) / 2,
          y: point.y + ((dy / len) * w.config.width) / 2,
        };
        const event: WindEvent = {
          wind: w,
          at: w.ended,
          point: { ...w.contact },
          target: obstacle ? undefined : target.target,
          reason: w.reason,
        };
        result.push(event);
        return true;
      };
      if (!w.initialChecked) {
        w.initialChecked = true;
        if (scan(w.origin, w.position, w.born, w.born)) continue;
      }
      if (until < from) continue;
      const travel = Math.min(
          w.config.distance - w.distance,
          (w.config.speed * (until - from)) / 1000,
        ),
        end = from + (travel / w.config.speed) * 1000,
        a = { ...w.position },
        b = { x: a.x + vx * travel, y: a.y + vy * travel };
      w.previous = a;
      if (scan(a, b, from, end)) {
        w.distance += Math.hypot(w.position.x - a.x, w.position.y - a.y);
        continue;
      }
      w.position = b;
      w.distance += travel;
      if (
        w.distance >= w.config.distance - 1e-7 ||
        until >= w.born + w.config.lifetime
      ) {
        w.terminated = true;
        w.reason =
          w.distance >= w.config.distance - 1e-7 ? "range" : "lifetime";
        w.ended = end;
        result.push({ wind: w, at: end, point: { ...b }, reason: w.reason });
      }
    }
    this.events.push(...result);
    if (this.events.length > 80) this.events.splice(0, this.events.length - 80);
    this.winds = this.winds.filter(
      (w) =>
        !w.terminated ||
        now - w.ended! <
          (w.reason === "target" ? w.config.art.hit : w.config.art.dissolve),
    );
    return result;
  }
  snapshot() {
    return this.winds.map((w) => ({
      ...w,
      hit: [...w.hit],
      attack: { ...w.attack, hit: [...w.attack.hit] },
    }));
  }
}
