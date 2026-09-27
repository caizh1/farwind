import {COUNTER_WEAPONS} from "./counterArt";
import {FEEDBACK} from '../game/systems/combatFeedback';
import type { Facing, MotionAction } from "../game/systems/locomotion";
import {SWORD_WIND_WEAPONS, SWORD_WIND_HERO_PROVISIONAL} from './swordWindArt';
import { COMBAT, PARRY, resolveStrike, type StrikeConfig, type ParryAction } from "../game/systems/combat";
export const COMBAT_ACTION_ART = {
  frameSize: 160,
  displaySize: 145,
  footY: 154,
} as const;
export type CombatVisual = {
  weapon?: WeaponPose;
  texture: string;
  frame: number;
  clip: string;
  frameIndex: number;
  facing: Facing;
  phase: "windup" | "active" | "recovery" | "ready" | "settle" | "dash" | "guard" | "brace" | "deflect";
  phaseProgress: number;
  provisional: boolean;
};
export type WeaponPose={grip:{x:number;y:number};tip:{x:number;y:number};visible:boolean;progress:number;alpha:number;provisional:boolean};
export function swordWindVisual(facing:Facing,elapsed:number,m:StrikeConfig):CombatVisual {
 const end=m.windup+m.active,total=end+m.recovery,t=Math.max(0,Math.min(total,elapsed));
 const phase=t<m.windup?'windup':t<end?'active':'recovery',start=phase==='windup'?0:phase==='active'?m.windup:end,duration=phase==='windup'?m.windup:phase==='active'?m.active:m.recovery,progress=Math.min(1,(t-start)/duration);
 const times=[0,m.windup*35/110,m.windup*70/110,m.windup,m.windup+m.active*.25,end,end+m.recovery*60/190,end+m.recovery*130/190];let pose=0;for(let i=1;i<times.length;i++)if(t>=times[i])pose=i;
 const view=facing===0?0:facing===1?1:2,sample=SWORD_WIND_WEAPONS[view][pose],point=(p:{x:number;y:number})=>({x:p.x*(facing===2?-1:1),y:p.y});
 return {texture:'hero-sword-wind',frame:view*8+pose,clip:`hero/sword-wind/${facing}`,frameIndex:pose,facing,phase,phaseProgress:progress,provisional:SWORD_WIND_HERO_PROVISIONAL,weapon:{grip:point(sample.grip),tip:point(sample.tip),visible:phase==='active',progress,alpha:phase==='active'?.45:0,provisional:SWORD_WIND_HERO_PROVISIONAL}};
}
// 独立防御图集，固定根[80,154]；左向镜像仍只由 Actor 设置。
const parryPoints=[
 [[125,220,45,116],[433,183,330,94],[634,168,532,54],[858,139,960,54],[1174,225,1302,220],[1382,210,1344,120]],
 [[182,522,258,445],[414,522,466,440],[681,463,723,374],[894,431,1006,375],[1190,520,1310,490],[1430,518,1501,425]],
 [[166,853,247,755],[425,824,488,720],[662,775,551,683],[928,752,805,672],[1205,849,1328,814],[1446,855,1492,745]],
] as const;
const parryRoots=[[[143,334],[408,334],[658,334],[907,334],[1167,334],[1416,334]],[[143,659],[408,659],[658,659],[907,659],[1167,659],[1416,659]],[[143,964],[408,964],[658,964],[907,964],[1167,964],[1416,964]]] as const;
export function parryWeapon(facing:Facing,pose:number) {
 const view=facing===0?0:facing===1?1:2,p=parryPoints[view][pose],r=parryRoots[view][pose];
 const point=(i:number)=>({x:(p[i]-r[0])*(145/460)*(facing===2?-1:1),y:(p[i+1]-r[1])*(145/460)});
 return {grip:point(0),tip:point(2),visible:false,progress:0,alpha:0,provisional:true};
}
function defensivePose(facing:Facing,pose:number,phase:CombatVisual["phase"],progress:number):CombatVisual {
 return {texture:"hero-parry-v2",frame:(facing===0?0:facing===1?1:2)*6+pose,clip:`hero/parry-v2/${facing}`,frameIndex:pose,facing,phase,phaseProgress:progress,provisional:true,weapon:parryWeapon(facing,pose)};
}
export function parryVisual(a:ParryAction,now:number,ready=false):CombatVisual {
 const elapsed=now-a.start,success=a.successAt!==undefined?now-a.successAt:null;
 const pose=ready?5:success!==null?success<20?1:2:elapsed<PARRY.active?0:5;
 return defensivePose(a.facing,pose,pose===0?"guard":pose===1?"brace":pose===2?"deflect":"ready",success!==null?Math.min(1,success/PARRY.resume):Math.min(1,elapsed/PARRY.recovery));
}
export function counterVisual(a:import("../game/systems/combat").Attack,now:number,improved=true):CombatVisual {
 const m=a.config??resolveStrike(1,a.counter),elapsed=now-a.start,pose=elapsed<20?2:elapsed<m.windup?3:elapsed<m.windup+m.active?4:5;
 const phase=elapsed<m.windup?"windup":elapsed<m.windup+m.active?"active":"recovery";
 const start=phase==="windup"?0:phase==="active"?m.windup:m.windup+m.active,duration=phase==="windup"?m.windup:phase==="active"?m.active:m.recovery;
 if(improved&&elapsed>=FEEDBACK.counterMotion) {
  // 115ms内四个真实挥剑姿态；历史采样取同一帧的剑尖，避免画一条脱离手与剑的独立弧线。
  const index=phase==='windup'?0:phase==='active'?1+Math.min(3,Math.floor((elapsed-m.windup)/m.active*4)):5;
  const sample=COUNTER_WEAPONS[a.facing===0?0:a.facing===1?1:2][index],point=(p:{x:number;y:number})=>({x:p.x*(a.facing===2?-1:1),y:p.y});
  return {texture:'hero-counter-v3',frame:(a.facing===0?0:a.facing===1?1:2)*6+index,clip:`hero/counter/${a.facing}`,frameIndex:index,facing:a.facing,phase,phaseProgress:Math.min(1,(elapsed-start)/duration),provisional:true,weapon:{grip:point(sample.grip),tip:point(sample.tip),visible:phase==='active',progress:Math.min(1,(elapsed-start)/duration),alpha:phase==='active'?.85:0,provisional:true}};
 }
 const result=defensivePose(a.facing,pose,phase,Math.min(1,(elapsed-start)/duration));
 result.clip=`hero/counter/${a.facing}`;
 result.weapon={...parryWeapon(a.facing,pose),visible:phase==="active",progress:result.phaseProgress,alpha:phase==="active"?.85:0};
 return result;
}
export function combatVisual(
  stage: number,
  facing: Facing,
  elapsed: number,
  enter = false,
  move: StrikeConfig = resolveStrike(stage),
): CombatVisual {
  if(stage===4)return swordWindVisual(facing,elapsed,move);
  const activeEnd = move.windup + move.active;
  const total = activeEnd + move.recovery;
  const t = Math.max(0, Math.min(elapsed, total));
  const phase =
    t < move.windup ? "windup" : t < activeEnd ? "active" : "recovery";
  const phaseStart =
    phase === "windup" ? 0 : phase === "active" ? move.windup : activeEnd;
  const phaseDuration =
    phase === "windup"
      ? move.windup
      : phase === "active"
        ? move.active
        : move.recovery;
  const phaseProgress = Math.min(1, (t - phaseStart) / phaseDuration);
  const view = facing === 0 ? 0 : facing === 1 ? 1 : 2;
  const boundaries = combatPoseTimes(stage, facing,move);
  let frameIndex = 0;
  for (let i = 1; i < boundaries.length; i++)
    if (t >= boundaries[i]) frameIndex = i;
  let frame = (stage - 1) * 6 + frameIndex;
  if (facing >= 1 && stage === 1 && enter && t < move.windup * 0.55)
    frame = t < 16 ? 18 : t < 30 ? 19 : 20;
  return {
    texture:
      facing >= 2
        ? "hero-combat-side"
        : facing === 1
          ? "hero-combat-back"
          : "hero-combat-action",
    frame: facing >= 1 ? frame : view * 18 + (stage - 1) * 6 + frameIndex,
    clip:
      facing >= 1 && frame >= 18
        ? `hero/draw/${facing}`
        : `hero/combat/${facing}/${stage}`,
    frameIndex: facing >= 1 && frame >= 18 ? frame - 18 : frameIndex,
    facing,
    phase,
    phaseProgress,
    provisional: true,
  };
}
export type Clip = {
  texture: string;
  frames: number[];
  flip: boolean;
  name: string;
  provisional?: boolean;
};
const sequence = (start: number) =>
  Array.from({ length: 8 }, (_, i) => start + i);
const clips = {
  side: { idle: [0], walk: sequence(1), run: sequence(27) },
  down: { idle: [9], walk: sequence(10), run: sequence(35) },
  up: { idle: [18], walk: sequence(19), run: sequence(43) },
};
export function clipFor(cat: boolean, d: Facing, action: MotionAction): Clip {
  if (!cat && action === "attack")
    return {
      texture: "hero",
      frames: [d * 6 + 5],
      flip: false,
      name: `hero/attack/${d}`,
    };
  const view = d === 0 ? "down" : d === 1 ? "up" : "side";
  return {
    texture: cat ? "cat-motion" : "hero-motion",
    frames:
      cat && view === "up" && action === "run"
        ? [43, 44, 45, 46, 47, 48]
        : clips[view][action === "attack" ? "idle" : action],
    flip: d === 2,
    name: `${cat ? "cat" : "hero"}/${action}/${d}`,
    provisional: false,
  };
}

export function settleVisual(
  facing: Facing,
  elapsed: number,
  stage = 3,
): CombatVisual {
  const index = Math.min(
    3,
    Math.floor(Math.max(0, elapsed) / (COMBAT.settle / 4)),
  );
  return {
    ...combatVisual(1, facing, 335),
    frame: (facing === 1
      ? stage === 1
        ? [24, 25, 26, 23]
        : stage === 2
          ? [27, 28, 29, 22]
          : [21, 20, 22, 23]
      : [19, 21, 22, 23])[index],
    clip: `hero/settle/${facing}`,
    frameIndex: index,
    phase: "settle",
    phaseProgress: Math.min(1, elapsed / COMBAT.settle),
  };
}
// 源图局部武器点与分帧脚下根一致。所有点均通过同一仿射变换映射到角色地面根。
const sideRoots = [
  [
    [140, 252],
    [405, 252],
    [634, 252],
    [891, 252],
    [1156, 252],
    [1410, 252],
  ],
  [
    [135, 499],
    [389, 499],
    [626, 499],
    [886, 499],
    [1140, 499],
    [1394, 499],
  ],
  [
    [123, 750],
    [388, 750],
    [633, 750],
    [889, 750],
    [1138, 750],
    [1387, 750],
  ],
];
const sideWeapons = [
  [
    [181, 193, 256, 206],
    [366, 98, 318, 46],
    [710, 165, 780, 120],
    [960, 166, 1038, 158],
    [1218, 197, 1278, 222],
    [1437, 200, 1508, 212],
  ],
  [
    [181, 443, 252, 465],
    [435, 423, 495, 371],
    [697, 397, 746, 325],
    [943, 356, 992, 299],
    [1170, 319, 1105, 278],
    [1425, 323, 1398, 266],
  ],
  [
    [158, 570, 104, 512],
    [411, 606, 346, 562],
    [700, 617, 784, 562],
    [950, 712, 1025, 750],
    [1206, 703, 1280, 717],
    [1433, 700, 1510, 702],
  ],
];
const backRoots = [
  [
    [250, 450],
    [765, 450],
    [1285, 450],
    [258, 957],
    [765, 957],
    [1285, 957],
  ],
  [
    [162, 250],
    [462, 250],
    [760, 250],
    [156, 574],
    [443, 574],
    [744, 574],
  ],
  [
    [156, 890],
    [443, 890],
    [744, 890],
    [165, 1174],
    [443, 1174],
    [744, 1174],
  ],
];
const backWeapons = [
  [
    [350, 350, 440, 410],
    [755, 145, 620, 60],
    [1370, 180, 1460, 80],
    [260, 650, 260, 542],
    [725, 650, 650, 565],
    [1200, 844, 1120, 900],
  ],
  // 首帧复用上一刀真实左侧收势；坐标按600→440源尺度转换。
  [
    [100, 167, 41, 208],
    [397, 144, 311, 99],
    [690, 88, 608, 33],
    [152, 362, 151, 282],
    [501, 385, 562, 310],
    [739, 363, 737, 282],
  ],
  [
    [149, 671, 149, 597],
    [452, 701, 388, 657],
    [759, 689, 801, 617],
    [145, 986, 77, 931],
    [365, 1049, 298, 1017],
    [809, 1101, 870, 1140],
  ],
];
// 第二刀保持低位蓄势；90–175ms穿过前方，210ms后才带到侧上方。
// 控制器时长和伤害不变，选帧与武器插值共同读取这些姿态时刻。
export function combatPoseTimes(stage: number, facing: Facing,m:StrikeConfig=resolveStrike(stage)) {
  const
    end = m.windup + m.active;
  if (facing >= 2 && stage === 2)
    return [
      m.windup,
      m.windup + 30,
      m.windup + 85,
      end,
      end + 35,
      end + m.recovery * 0.5,
    ];
  if (facing === 1)
    return [
      0,
      m.windup * 0.55,
      m.windup,
      m.windup + m.active * 0.4,
      end - 15,
      end + m.recovery * 0.31,
    ];
  return [
    0,
    m.windup * 0.55,
    m.windup,
    m.windup + m.active * 0.5,
    end,
    end + m.recovery * 0.5,
  ];
}
function poseWeapon(stage: number, facing: Facing, elapsed: number,m:StrikeConfig) {
  const times = combatPoseTimes(stage, facing,m);
  let i = 0;
  while (i < 4 && elapsed >= times[i + 1]) i++;
  const t = Math.max(
    0,
    Math.min(1, (elapsed - times[i]) / (times[i + 1] - times[i])),
  );
  const transform = (pose: number, offset: number) => {
    const p = (facing === 1 ? backWeapons : sideWeapons)[stage - 1][pose],
      root = (facing === 1 ? backRoots : sideRoots)[stage - 1][pose];
    const size = facing === 1 ? (stage === 1 ? 600 : 440) : 348;
    return {
      x: (((p[offset] - root[0]) * 145) / size) * (facing === 2 ? -1 : 1),
      y: ((p[offset + 1] - root[1]) * 145) / size,
    };
  };
  const mix = (offset: number) => {
    const a = transform(i, offset),
      b = transform(i + 1, offset);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  };
  return { grip: mix(0), tip: mix(2) };
}

// 当前图集有效期两姿态的手工标注（160×160，原点为画布左上）。
// 正背视图独立标注；左向只在根局部坐标下水平镜像。仍为待美术校准原型。
const activeWeaponPoints = [
  [
    [
      [72, 119, 42, 89],
      [75, 137, 76, 166],
    ],
    [
      [82, 139, 49, 108],
      [83, 88, 115, 40],
    ],
    [
      [74, 68, 47, 26],
      [83, 150, 109, 180],
    ],
  ],
  [
    [
      [67, 106, 35, 74],
      [64, 98, 32, 66],
    ],
    [
      [72, 110, 46, 72],
      [76, 102, 42, 52],
    ],
    [
      [76, 83, 76, 38],
      [66, 104, 36, 62],
    ],
  ],
  [
    [
      [76, 104, 44, 74],
      [100, 122, 139, 117],
    ],
    [
      [91, 128, 130, 96],
      [94, 81, 120, 40],
    ],
    [
      [73, 78, 35, 43],
      [92, 150, 122, 170],
    ],
  ],
] as const;
export function weaponSample(stage: number, facing: Facing, elapsed: number,m:StrikeConfig=resolveStrike(stage)):WeaponPose {
  if(stage===4)return swordWindVisual(facing,elapsed,m).weapon!;
  const sample = combatVisual(stage, facing, elapsed,false,m);
  const view = facing === 0 ? 0 : facing === 1 ? 1 : 2;
  const index = sample.frameIndex < 3 ? 0 : 1;
  const [gx, gy, tx, ty] = activeWeaponPoints[view][stage - 1][index];
  const scale = COMBAT_ACTION_ART.displaySize / COMBAT_ACTION_ART.frameSize;
  const point = (x: number, y: number) => ({
    x: (x - 80) * scale * (facing === 2 ? -1 : 1),
    y: (y - COMBAT_ACTION_ART.footY) * scale,
  });
  return {
    ...(facing >= 1
      ? poseWeapon(stage, facing, elapsed,m)
      : { grip: point(gx, gy), tip: point(tx, ty) }),
    visible: sample.phase === "active",
    progress: sample.phaseProgress,
    // 每个实际姿态内短暂亮起后衰减，不独立旋转一条悬空圆弧。
    alpha:
      sample.phase === "active"
        ? 0.5 * (1 - ((sample.phaseProgress * 2) % 1))
        : 0,
    provisional: true,
  };
}
