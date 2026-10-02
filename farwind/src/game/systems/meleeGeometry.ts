import { ENEMIES, type EnemyKind } from "../../data/enemies";
import {
  CAMP_BOSSES,
  type CampBossKind,
} from "../../data/maps/windbell/campBosses";
import type { Facing } from "./locomotion";

type Point = { x: number; y: number };
// 原始160px帧的身体中心与半径：[cx, cy, rx, ry]，依次为正面、背面、侧面。
// 对照实际idle/walk/attack帧；排除镰刃、展开羽翼、尾巴和虫洞碎土。
type Body = readonly [number, number, number, number];
type Views = readonly [Body, Body, Body];
export const MELEE_BODIES = {
  slime: [
    [80, 117, 33, 20],
    [80, 120, 34, 17],
    [81, 117, 31, 20],
  ],
  leaf: [
    [80, 112, 19, 25],
    [80, 110, 20, 27],
    [81, 112, 20, 25],
  ],
  spore: [
    [80, 110, 27, 28],
    [80, 110, 27, 28],
    [82, 111, 27, 27],
  ],
  boar: [
    [80, 111, 22, 27],
    [80, 110, 23, 28],
    [82, 112, 36, 25],
  ],
  raven: [
    [80, 110, 14, 25],
    [80, 110, 15, 25],
    [84, 111, 17, 24],
  ],
  wolf: [
    [80, 110, 13, 27],
    [80, 110, 14, 27],
    [84, 111, 25, 23],
  ],
  burrow: [
    [80, 115, 24, 22],
    [80, 115, 24, 22],
    [82, 117, 31, 19],
  ],
  guardian: [
    [80, 112, 27, 25],
    [80, 112, 27, 25],
    [81, 112, 25, 25],
  ],
  priest: [[80,112,20,25],[80,112,20,25],[81,112,21,25]],
  bomber: [[80,119,29,20],[80,119,29,20],[82,119,31,20]],
  archer:[[80,111,20,30],[80,111,20,30],[81,111,24,30]],
  bell:[[80,112,20,25],[80,112,20,25],[81,112,21,25]],
  shade:[[80,110,13,27],[80,110,14,27],[84,111,25,23]],
  geomancer:[[80,112,27,25],[80,112,27,25],[81,112,25,25]],
} as const satisfies Record<EnemyKind, Views>;
// 高清主体的身体轮廓直接按世界高度标定；武器、尾巴、粒子不扩大受击面。
// 参数为脚底相对中心与半径的高度比例，与图集裁切和源图像素完全独立。
export const BOSS_MELEE_BODIES = {
  "spore-heart": [[0,-.39,.34,.39],[0,-.39,.35,.39],[0,-.39,.36,.39]],
  "thorn-crown": [[0,-.39,.23,.39],[0,-.39,.24,.39],[.20,-.36,.70,.36]],
  "crag-tusk": [[0,-.38,.30,.38],[0,-.38,.30,.38],[.06,-.36,.48,.36]],
  "bound-branch": [[0,-.40,.23,.40],[0,-.40,.24,.40],[0,-.40,.25,.40]],
} as const satisfies Record<CampBossKind, Views>;
type BossGroundTarget=Point&{boss?:string;hurtboxFacing?:Facing};
function bossGroundProfile(boss:BossGroundTarget,padding=10){
 const kind=boss.boss as CampBossKind,h=CAMP_BOSSES[kind].height,side=(boss.hurtboxFacing??0)>=2,mirror=boss.hurtboxFacing===2?-1:1;
 return {x:boss.x+(side&&kind==='thorn-crown'?h*.16*mirror:side&&kind==='crag-tusk'?h*.05*mirror:0),y:boss.y,rx:h*(side&&kind==='thorn-crown'?.50:side&&kind==='crag-tusk'?.36:.22)+padding,ry:h*.12+padding};
}
export function bossGroundContains(boss:BossGroundTarget,p:Point,padding=10){
  if(!boss.boss||!Object.hasOwn(CAMP_BOSSES,boss.boss))return false;
  const shape=bossGroundProfile(boss,padding);
  return ((p.x-shape.x)/shape.rx)**2+((p.y-shape.y)/shape.ry)**2<1;
}

// 首领移动挤入角色后，允许角色沿占位椭圆向外脱离，禁止进一步穿入。
export function bossGroundBlocks(boss:BossGroundTarget,from:Point,to:Point){
  if(!bossGroundContains(boss,to))return false;
  if(!bossGroundContains(boss,from))return true;
  const shape=bossGroundProfile(boss);
  const distance=(p:Point)=>((p.x-shape.x)/shape.rx)**2+((p.y-shape.y)/shape.ry)**2;
  return distance(to)<=distance(from);
}

// 沿用命中反馈的共同身体平面；攻击从脚底上移28px，墙体始终查地面根。
export const MELEE_HEIGHT = 28;
export type MeleeBodyTarget = Point & {
  type?: string;
  kind?: string;
  boss?: string;
  hurtboxFacing?: Facing;
};
export function meleeBody(target: MeleeBodyTarget): Point[] | null {
  // 木桩沿用已有四向点判定与自身底座豁免；本次校准怪物及练习投影。
  if (target.kind === "trainingDummy") return null;
  const facing = target.hurtboxFacing ?? 0,
    view = facing === 0 ? 0 : facing === 1 ? 1 : 2;
  let body: Body, scale: number;let anchor={x:80,y:137.5};
  if (target.boss && Object.hasOwn(BOSS_MELEE_BODIES, target.boss)) {
    const boss = target.boss as CampBossKind;
    body = BOSS_MELEE_BODIES[boss][view];
    scale = CAMP_BOSSES[boss].height;anchor={x:0,y:0};
  } else if (target.type && Object.hasOwn(MELEE_BODIES, target.type)) {
    const kind = target.type as EnemyKind;
    body = MELEE_BODIES[kind][view];
    scale = ENEMIES[kind].height / 60;
  } else return null;
  const [cx, cy, rx, ry] = body;
  const mirror = facing === 2 ? -1 : 1;
  // 八边凸轮廓切去透明角落；镜像与EnemyView相同，鸦妖lift和Boss后仰只属表现。
  const outline=target.boss?[
    [-1,0],[-.7,-.7],[0,-1],[.7,-.7],[1,0],[.9,.9],[.7,1],[-.7,1],[-.9,.9],
  ]:[
    [-1, 0],
    [-0.7, -0.7],
    [0, -1],
    [0.7, -0.7],
    [1, 0],
    [0.7, 0.7],
    [0, 1],
    [-0.7, 0.7],
  ];return outline.map(([x, y]) => ({
    x: target.x + (cx - anchor.x + x * rx) * scale * mirror,
    y: target.y + (cy - anchor.y + y * ry) * scale,
  }));
}

const EPS = 1e-7;
const cross = (a: Point, b: Point) => a.x * b.y - a.y * b.x;
const subtract = (a: Point, b: Point): Point => ({
  x: a.x - b.x,
  y: a.y - b.y,
});
// 凸轮廓与扇形的精确相交：顶点、包围原点、径向边、圆弧与轮廓边。
export function bodyIntersectsSector(
  body: readonly Point[],
  origin: Point,
  direction: Point,
  range: number,
  halfAngle: number,
) {
  const points = body.map((p) => subtract(p, origin));
  const inside = (p: Point) => {
    const d = Math.hypot(p.x, p.y);
    return (
      d <= range + EPS &&
      p.x * direction.x + p.y * direction.y >= d * Math.cos(halfAngle) - EPS
    );
  };
  if (points.some(inside)) return true;
  let positive = false,
    negative = false;
  const rays = [-halfAngle, halfAngle].map((a) => ({
    x: (direction.x * Math.cos(a) - direction.y * Math.sin(a)) * range,
    y: (direction.x * Math.sin(a) + direction.y * Math.cos(a)) * range,
  }));
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length],
      edge = subtract(b, a);
    const side = cross(edge, { x: -a.x, y: -a.y });
    positive ||= side > EPS;
    negative ||= side < -EPS;
    for (const ray of rays) {
      const denominator = cross(edge, ray);
      if (Math.abs(denominator) <= EPS) continue;
      const t = -cross(a, ray) / denominator,
        u = -cross(a, edge) / denominator;
      if (t >= -EPS && t <= 1 + EPS && u >= -EPS && u <= 1 + EPS) return true;
    }
    const q = edge.x * edge.x + edge.y * edge.y;
    if (q <= EPS) continue;
    const dot = a.x * edge.x + a.y * edge.y;
    const discriminant =
      dot * dot - q * (a.x * a.x + a.y * a.y - range * range);
    if (discriminant < -EPS) continue;
    for (const sign of [-1, 1]) {
      const t = (-dot + sign * Math.sqrt(Math.max(0, discriminant))) / q;
      if (
        t >= -EPS &&
        t <= 1 + EPS &&
        inside({ x: a.x + edge.x * t, y: a.y + edge.y * t })
      )
        return true;
    }
  }
  return !(positive && negative);
}
