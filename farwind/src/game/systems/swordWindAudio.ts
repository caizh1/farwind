// 原创风呼啸：低频风压、变频共振风体、短刃缘气流；预生成，不在释放帧做滤波计算。
export const SWORD_WIND_AUDIO = { rate: 48000, duration: .46, peak: .68 } as const;

function bandpass(rate: number) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x: number, frequency: number, q: number) => {
    const w = 2 * Math.PI * frequency / rate, a = Math.sin(w) / (2 * q);
    const y = (a * x - a * x2 + 2 * Math.cos(w) * y1 - (1 - a) * y2) / (1 + a);
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
}

export function synthSwordWindHowl(rate: number = SWORD_WIND_AUDIO.rate): [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] {
  if (!Number.isFinite(rate) || rate < 8000) throw new RangeError('风呼啸采样率无效');
  const length = Math.ceil(rate * SWORD_WIND_AUDIO.duration);
  const left = new Float32Array(length), right = new Float32Array(length);
  const howl = bandpass(rate), upper = bandpass(rate), pressure = bandpass(rate);
  let seed = 3791, air = 0, bass = 0, brightBase = 0, side = 0, peak = 0;
  const noise = () => { seed = seed * 16807 % 2147483647; return seed / 1073741824 - 1; };
  const bassStep = 1 - Math.exp(-2 * Math.PI * 110 / rate);
  const sideStep = 1 - Math.exp(-2 * Math.PI * 1900 / rate);
  const delay = Math.round(rate * .0009);
  for (let i = 0; i < length; i++) {
    const t = i / rate, u = t / SWORD_WIND_AUDIO.duration, n = noise();
    // 先卷起再掠走的风腔滑音，保留噪声，不用单一正弦音冒充风声。
    const centre = 330 + 1100 * Math.exp(-(((t - .085) / .09) ** 2));
    const airStep = 1 - Math.exp(-2 * Math.PI * (3100 - 2000 * u) / rate);
    air += airStep * (n - air); bass += bassStep * (n - bass);
    brightBase += .16 * (n - brightBase); side += sideStep * (noise() - side);
    const turbulence = .82 + .1 * Math.sin(2 * Math.PI * 19 * t) + .08 * Math.sin(2 * Math.PI * 47 * t + 1.7);
    const body = Math.exp(-(((t - .085) / .155) ** 2));
    const wind = (howl(n, centre, 4.2) * 3.2 + upper(n, centre * 2.07, 2.5) * .65 + (air - bass) * .72) * body * turbulence;
    const push = pressure(n, 170 - 60 * u, .7) * 1.7 * Math.exp(-t / .1);
    const edge = (n - brightBase) * .16 * Math.exp(-t / .024);
    const envelope = Math.min(1, t / .006) * Math.min(1, (length - 1 - i) / (rate * .045));
    left[i] = (wind + push + edge) * envelope;
    // 风压留在中央，短延迟和少量独立气流提供宽度，单声道合并仍有风体。
    right[i] = (i >= delay ? left[i - delay] * .94 : left[i] * .94) + side * .055 * body * envelope;
    right[i] *= Math.min(1, (length - 1 - i) / (rate * .045));
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  }
  const scale = SWORD_WIND_AUDIO.peak / Math.max(.001, peak);
  for (let i = 0; i < length; i++) { left[i] *= scale; right[i] *= scale; }
  left[0] = right[0] = left[length - 1] = right[length - 1] = 0;
  return [left, right];
}
