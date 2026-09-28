export const XIAOBAO = {
  id: "xiaobao",
  name: "小宝",
  title: "听风小宗师",
  home: { x: 810, y: 725 },
  frameSize: 160,
  footY: 148,
  displaySize: 92,
  stride: 42,
  portrait: "/assets/xiaobao/portrait.webp",
  story: "小宝总穿着那件星星小衣，笑起来露出小门牙。没人见过他拜师，岚爷爷却说：这孩子先听懂了风，才学会走路。平时他在广场小步散游、拍手大笑；认真起来，一掌送风、一抱卸势，落地连叶子都不惊动。",
  saying: "风很大，也可以轻轻的。",
} as const;

const clip = (name: string, sheet: string, row: number, duration: number, loop = false) => ({ name, sheet, row, duration, loop, frames: 6 });
export const XIAOBAO_CLIPS = {
  idle: clip("听风待机", "motion", 0, 2100, true),
  walkDown: clip("正面小步", "motion", 1, 1000, true),
  walkSide: clip("侧面小步", "motion", 2, 1000, true),
  walkUp: clip("背面小步", "motion", 3, 1000, true),
  wave: clip("挥手招呼", "social", 0, 1200),
  laugh: clip("大笑鼓掌", "social", 1, 1400),
  bow: clip("抱拳致意", "social", 2, 1500),
  meditate: clip("盘腿听风", "social", 3, 2400, true),
  palm: clip("听风掌", "mastery", 0, 1050),
  guard: clip("抱圆卸风", "mastery", 1, 1200),
  step: clip("踏叶轻步", "mastery", 2, 1050),
  sleep: clip("安心小憩", "mastery", 3, 3000, true),
} as const;
export type XiaobaoClip = keyof typeof XIAOBAO_CLIPS;

// 预览和真实人物共用选帧，不另造一套看起来会动的预览动画。
export function xiaobaoPose(action: XiaobaoClip, elapsed: number, distance = 0) {
  const clip = XIAOBAO_CLIPS[action];
  const frameIndex = action.startsWith("walk")
    ? Math.floor(Math.max(0, distance) / XIAOBAO.stride * 6) % 6
    : action === "sleep" && elapsed >= clip.duration
      ? 4 + Math.floor((elapsed - clip.duration) / 900) % 2
      : Math.min(5, Math.floor(Math.max(0, clip.loop ? elapsed % clip.duration : elapsed) / clip.duration * 6));
  return { texture: `xiaobao-${clip.sheet}`, frame: clip.row * 6 + frameIndex, frameIndex, lift: action === "step" ? [0, 1, 8, 11, 2, 0][frameIndex] : 0 };
}
