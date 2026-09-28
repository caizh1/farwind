// 五阶段为永久本领；执行参数只从程序定义读取。
export type SwordWindStage = 0 | 1 | 2 | 3 | 4 | 5;
export const SWORD_WIND = {
  name: "剑风·一线斩",
  strike: {
    windup: 110,
    active: 100,
    recovery: 190,
    range: 0,
    angle: 0,
    damage: 36,
    step: 8,
    knock: 12,
    flash: 120,
    stagger: 120,
  },
  speed: 900,
  distance: 300,
  width: 28,
  lifetime: 450,
  hitStop: 32,
  maxTargets: 1 as number | "all",
  spawnForward: 8,
  cancelTail: 120,
  art: {
    release: 64,
    flight: 108,
    hit: 160,
    dissolve: 96,
    flightSize: 128,
    hitSize: 144,
    frontEdge: 41,
    bodyHeight: 28,
    groundStep: 36,
    groundHeight: 52,
    groundFrame: 110,
    groundLifetime: 850,
    groundFade: 200,
    attachments: [
      [-40, -23],
      [26, 23],
      [28, -32],
    ],
  },
} as const;
export type SwordWindConfig = Omit<typeof SWORD_WIND, 'name' | 'distance' | 'width' | 'lifetime' | 'hitStop'> & {
  name:string; stage:Exclude<SwordWindStage,0>; distance:number; width:number; lifetime:number;
  damage:number; hitStop:number; angles:readonly number[]; trialLesson?:string;
};
export function resolveSwordWindConfig(stage:Exclude<SwordWindStage,0>=1):SwordWindConfig {
  if(!Number.isInteger(stage)||stage<1||stage>5)throw Error('剑风阶段无效');
  const distance=stage>=4?420:300;
  return {...structuredClone(SWORD_WIND),stage,name:['一线斩','一线斩·双穿','一线斩·贯通','疾风斩','三向疾风斩'][stage-1],
    distance,width:stage>=4?64:28,lifetime:Math.max(450,Math.ceil(distance/SWORD_WIND.speed*1000)+100),
    damage:SWORD_WIND.strike.damage,maxTargets:stage===1?1:stage===2?2:'all',angles:stage===5?[-Math.PI/6,0,Math.PI/6]:[0]};
}
