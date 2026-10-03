// 原创短风呼啸：连续相位的风腔共鸣，去掉宽带噪声和金属泛音；启动时缓存。
export const SWORD_WIND_AUDIO = { rate: 48000, duration: .24, peak: .68, variants: 3, voices: 4 } as const;
export type SwordWindCue = 'wind-release' | 'wind-charge' | 'wind-dissolve';

export function synthSwordWindCue(kind: SwordWindCue, rate: number = SWORD_WIND_AUDIO.rate, variant = 0): [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] {
  if (!Number.isFinite(rate) || rate < 8000) throw new RangeError('风呼啸采样率无效');
  const release = kind === 'wind-release', charge = kind === 'wind-charge';
  const duration = release ? SWORD_WIND_AUDIO.duration : charge ? .11 : .09;
  const length = Math.ceil(rate * duration), left = new Float32Array(length), right = new Float32Array(length);
  const variation = ((Math.trunc(variant) % SWORD_WIND_AUDIO.variants) + SWORD_WIND_AUDIO.variants) % SWORD_WIND_AUDIO.variants;
  // 相邻非整数频率形成柔和的风腔带宽；没有随机噪声，也不采用单一哨音。
  const ratios = [.79, .88, .96, 1, 1.045, 1.115, 1.23];
  const weights = [.07, .1, .18, .32, .19, .1, .06];
  const offsets = [1.1, -.8, .6, 0, -.4, .9, -1.4];
  let phase = 0, peak = 0;
  const delayL = Math.round(rate * .006), delayR = Math.round(rate * .009);
  for (let i = 0; i < length; i++) {
    const t = i / rate, u = t / duration;
    const centre = release ? 340 + (700 + variation * 14) * Math.exp(-(((t - .032) / .052) ** 2))
      : charge ? 280 + 340 * u : 430 - 150 * u;
    phase += 2 * Math.PI * centre / rate;
    let cavity = 0;
    for (let band = 0; band < ratios.length; band++) {
      // 缓慢、微小的相位漂移提供气流流动感，避开尖锐抖动与机械电子滑音。
      const drift = .13 * Math.sin(2 * Math.PI * (7 + band * .7) * t + offsets[band]);
      cavity += Math.sin(phase * ratios[band] + offsets[band] + drift) * weights[band];
    }
    const breath = Math.sin(phase * 1.91 + .3) * .023 + Math.sin(phase * 2.137 + 1.2) * .012;
    const envelope = release ? (1 - Math.exp(-t / .009)) * Math.exp(-t / .055)
      : charge ? Math.sin(Math.PI * u) ** 2 : (1 - Math.exp(-t / .008)) * Math.exp(-t / .018);
    const fade = Math.min(1, (length - 1 - i) / (rate * .035));
    const dry = (cavity + breath) * envelope * fade;
    // 主体居中，轻微短反射增加空间感；不将整段呼啸错相扩宽。
    left[i] = dry + (i >= delayL ? left[i - delayL] * .025 : 0) * fade;
    right[i] = dry + (i >= delayR ? right[i - delayR] * .025 : 0) * fade;
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  }
  const scale = (release ? SWORD_WIND_AUDIO.peak : charge ? .045 : .025) / Math.max(.001, peak);
  for (let i = 0; i < length; i++) { left[i] *= scale; right[i] *= scale; }
  left[0] = right[0] = left[length - 1] = right[length - 1] = 0;
  return [left, right];
}

export function synthSwordWindHowl(rate: number = SWORD_WIND_AUDIO.rate, variant = 0) {
  return synthSwordWindCue('wind-release', rate, variant);
}
