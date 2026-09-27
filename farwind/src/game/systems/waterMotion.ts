import { BRIDGES, POND } from "../../data/world";

// 浮动幅度为世界像素，flowSpeed为源纹理像素/秒；锚点按正式原图及实际显示原点换算。
export const WATER = {
  maxDelta: 50,
  depth: { pond: -19, shore: -17, lily: -16, bridge: -15 },
  fountain: {
    sourceSize: 390, flowSpeed: 66, flowAlpha: 0.9,
    layers: { flow: 0.01, basin: 0.02 },
    sizes: { ripple: [0.15, 0.06], splash: [0.065, 0.065], drop: [0.014, 0.021] },
    impacts: [[120, 241], [192, 268], [260, 240]] as const,
    ripplePeriod: 2200, rippleAlpha: 0.75, dropsPerImpact: 3, dropPeriod: 850, dropHeight: 13,
    splashPeriod: 1070, splashAlpha: 0.52, splashVariation: 0.15, dropAlpha: 0.85, dropSpread: 3,
  },
  pond: { waves: 12, glints: 7, ripples: 3, waveAlpha: 0.78, glintAlpha: 0.85,
    wavePeriod: 7200, waveDrift: 8, glintPeriod: 6300, ripplePeriod: 8200,
    verticalDrift: 1.5, verticalPhase: 0.71, rippleAlpha: 0.32,
    lilyAmplitude: 1.25, lilyPeriod: 5800 },
} as const;

export class EnvironmentClock {
  time = 0;
  running = false;
  advance(delta: number, playing: boolean) {
    if (!playing) { this.running = false; return 0; }
    // 恢复首帧丢弃挂起期间的delta；只推进有效游玩时间，不补算或补发粒子。
    if (!this.running) { this.running = true; return 0; }
    const step = Number.isFinite(delta) ? Math.max(0, Math.min(WATER.maxDelta, delta)) : 0;
    this.time += step;
    return step;
  }
  reset() { this.time = 0; this.running = false; }
}

export function ripplePhase(time: number, period: number, phase = 0) {
  const progress = ((time / period + phase) % 1 + 1) % 1;
  return { progress, scale: 0.45 + progress * 1.05, alpha: Math.sin(progress * Math.PI) * (1 - progress) };
}

export function fountainPoint(image: { x: number; y: number; displayWidth: number; displayHeight: number; originX: number; originY: number }, u: number, v: number) {
  return { x: image.x + (u / WATER.fountain.sourceSize - image.originX) * image.displayWidth,
    y: image.y + (v / WATER.fountain.sourceSize - image.originY) * image.displayHeight };
}

export function lilyAnchors() {
  return Array.from({length:18}, (_,i) => {
    const a=i*2.4;
    return {x:POND.x+Math.cos(a)*(180+(i%4)*9),y:POND.y+Math.sin(a)*155,flower:i%3===0,phase:i*1.71};
  });
}

export function waterContains(x: number, y: number, margin = 0) {
  return ((x-POND.x)/(POND.rx-margin))**2+((y-POND.y)/(POND.ry-margin))**2<1;
}

export function clearOfBridges(x: number, y: number, radius = 14) {
  return !BRIDGES.some(b => x>b.x-radius && x<b.x+b.w+radius && y>b.y-radius && y<b.y+b.h+radius);
}

// 椭圆是凸集：包含贴片最大包围矩形四角，就包含动画全过程的全部像素。
// 仅将装饰贴片向池中心收敛，地图/岸线/通行数据不变，避免整池逐帧离屏滤镜。
export function fitWaterPatch(x: number, y: number, halfWidth: number, halfHeight: number) {
  for (let i = 0; i < 80; i++) {
    if ([-halfWidth, halfWidth].every(dx => [-halfHeight, halfHeight].every(dy => waterContains(x + dx, y + dy, 10)))) return { x, y };
    x = POND.x + (x - POND.x) * 0.95; y = POND.y + (y - POND.y) * 0.95;
  }
  throw new Error("水纹贴片尺寸超出池塘可容纳范围");
}
