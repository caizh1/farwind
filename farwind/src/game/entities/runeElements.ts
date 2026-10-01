import type { RuneInk } from './runeView';
import type { RuneFx } from '../systems/runeCombat';
import { isLightningFx, paintLightning } from './runeLightning';

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => 1 - (1 - clamp(v)) ** 3;
const polar = (x: number, y: number, r: number, a: number) => [x + Math.cos(a) * r, y + Math.sin(a) * r];
const C = { ink: '#244d63', blue: '#4a9ec9', cyan: '#8be4eb', white: '#fff2cd', gold: '#eebc63', red: '#a43d30', flame: '#ec7840' };

// 有收尖的笔触，填充的是形体而不是整块光晕；两端保留方向感。
function ribbon(g: RuneInk, pts: number[][], width: number, color: string, alpha: number) {
  const left: number[][] = [], right: number[][] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], before = pts[Math.max(0, i - 1)], after = pts[Math.min(pts.length - 1, i + 1)];
    const dx = after[0] - before[0], dy = after[1] - before[1], length = Math.hypot(dx, dy) || 1;
    const w = width * Math.sin(Math.PI * (i + .25) / (pts.length - .5));
    left.push([p[0] - dy / length * w, p[1] + dx / length * w]);
    right.push([p[0] + dy / length * w, p[1] - dx / length * w]);
  }
  g.solid([...left, ...right.reverse()], color, alpha);
}
function shard(g: RuneInk, x: number, y: number, length: number, a: number, color: string, alpha: number) {
  const tip = polar(x, y, length, a), l = polar(x, y, length * .22, a + 1.57), r = polar(x, y, length * .22, a - 1.57);
  g.solid([l, tip, r, polar(x, y, length * .18, a + Math.PI)], C.ink, alpha * .7);
  g.solid([[x, y], tip, r], color, alpha);
}
function arc(x: number, y: number, r: number, start: number, end: number, flat = 1) {
  return Array.from({ length: 22 }, (_, i) => { const a = start + (end - start) * i / 21; return [x + Math.cos(a) * r, y + Math.sin(a) * r * flat]; });
}
export function paintElectricArc(g: RuneInk, x: number, y: number, h: number, alpha: number, seed: number, time = 0) {
  const pts = Array.from({ length: 9 }, (_, i) => [x + (i === 0 || i === 8 ? 0 : Math.sin(seed + i * 4.7 + Math.floor(time / 40) * .8) * h * .12), y - h + i / 8 * h]);
  ribbon(g, pts, 3.8, C.ink, alpha * .8);
  ribbon(g, pts, 2.3, C.cyan, alpha);
  g.path(pts, C.white, alpha, 1.2);
}
function impact(g: RuneInk, x: number, y: number, radius: number, t: number, alpha: number, simple: boolean, fire = false) {
  const z = radius * (.28 + ease(t) * .72), color = fire ? C.gold : C.cyan;
  // 落点水冠／焰冠是裂片形体；不是角色周围的彩色圆圈。
  const n = simple ? 5 : 9;
  for (let i = 0; i < n; i++) {
    const a = i * Math.PI * 2 / n + .2, p = polar(x, y, z * .8, a);
    const lift = Math.sin(clamp(t * 2) * Math.PI) * (8 + (i % 3) * 5);
    shard(g, p[0], p[1] - lift, (9 + i % 3 * 4) * (1 - t), a - .6, color, alpha * (1 - t));
  }
  for (let i = 0; i < 3; i++) {
    ribbon(g, arc(x, y, z, i * 2.094 + .2, i * 2.094 + 1.5), 2.8 * (1 - t), color, alpha * .7);
  }
}

export function paintWaveCrest(g: RuneInk, x: number, y: number, radius: number, angle: number, t: number, alpha: number, electric: boolean, simple: boolean) {
  const pts = arc(x, y, radius, angle - 1.4, angle + 1.4);
  ribbon(g, pts, 8, C.ink, alpha * .65);
  ribbon(g, pts, 5.6, '#50b9bb', alpha * .8);
  ribbon(g, arc(x, y, radius + 2, angle - 1.34, angle + 1.34), 2.1, '#d5f6e5', alpha);
  const n = simple ? 4 : 7;
  for (let i = 0; i < n; i++) {
    const a = angle - 1.2 + i / (n - 1) * 2.4, p = polar(x, y, radius, a);
    ribbon(g, [[p[0] - Math.cos(a) * 8, p[1] - Math.sin(a) * 8], p, polar(p[0], p[1], 10 + Math.sin(t * 4 + i) * 3, a - .3), polar(p[0], p[1], 16, a - .75)], 3, '#c4eee0', alpha * .85);
  }
  if (electric) {
    const snake = pts.map((p, i) => [p[0] + Math.cos(angle) * Math.sin(i * 2.6 + t * 3) * 5, p[1] + Math.sin(angle) * Math.sin(i * 2.6 + t * 3) * 5]);
    g.path(snake, C.gold, alpha, 3.2); g.path(snake, C.white, alpha, 1.1);
  }
}

// 只读战斗时钟和事件元数据：画质、闪光设置不参与伤害、AI或计时。
export function paintElementFx(g: RuneInk, f: RuneFx, now: number, simple: boolean, lowFlash: boolean): boolean {
  const v = f.visual, age = now - f.born;
  if (age < 0 || age >= f.life) return true;
  const x = f.point.x, y = f.point.y, r = f.radius, u = age / f.life, flash = lowFlash ? .55 : 1;
  const alpha = clamp(age / 28) * (1 - u);
  if (v === 'thunder-charge') {
    paintElectricArc(g, x + 17, y - 7, 27, alpha * .9, f.id, age);
    shard(g, x + 17, y - 32, 7, -1.4, C.white, alpha * flash);
    return true;
  }
  if (v === 'thunder-wheel') {
    const z = 45 + ease(u) * 10;
    for (let i = 0; i < 3; i++) ribbon(g, arc(x, y - 74, z, i * 2.094 + u, i * 2.094 + 1.85 + u, .48), 3, C.gold, alpha);
    for (let i = 0; i < (simple ? 4 : 8); i++) {
      const a = i * Math.PI / 4, p = polar(x, y - 74, z, a);
      shard(g, p[0], y - 74 + (p[1] - y + 74) * .48, 12, -1.57, C.white, alpha);
    }
    return true;
  }
  if (isLightningFx(f)) {
    paintLightning(g, f, now, simple, lowFlash);
    if (v === 'storm-wave' && age >= (f.lead ?? 0)) {
      const t = clamp((age - (f.lead ?? 0)) / Math.max(1, f.life - (f.lead ?? 0)));
      paintWaveCrest(g, x, y, r * (.6 + ease(t) * .4), -.1, t, (1 - t) * .9, true, simple);
    }
    return true;
  }
  if (v === 'cloud-crown' || v === 'storm-mist') {
    // 雷雾中央只画云与电势；真正落雷只画在有 lead 的目标事件上。
    for (let i = 0; i < (simple ? 3 : 5); i++) {
      const px = x + (i - 2) * 16;
      g.ellipse(px, y - 88 + Math.sin(i * 2 + age / 400) * 4, 22, 12, C.ink, alpha * .28, 1, true);
      ribbon(g, arc(px, y - 91, 18, 3.2, 5.8, .5), 3, '#a6c4d8', alpha * .7);
    }
    ribbon(g, arc(x, y - 77, 48, 0, Math.PI * 2, .28), 1.8, C.gold, alpha);
    if (v === 'storm-mist') {
      for (let i = 0; i < (simple ? 2 : 4); i++) ribbon(g, arc(x, y, r * (.4 + i * .14), age / 900 + i, age / 900 + i + 2.8, .7), 5, '#997aa8', alpha * .35);
    }
    return true;
  }
  if (/^(wave|breaker|wall-wave|storm-wave|return-wave|phantom-wave|mirror-sea)$/.test(v)) {
    const angle = Math.atan2(f.direction?.y ?? 0, f.direction?.x ?? 1);
    if (v === 'mirror-sea') for (let i = 0; i < 3; i++) paintWaveCrest(g, x, y, r, i * 2.094, u, alpha * .8, false, simple);
    else paintWaveCrest(g, x, y, r * (.35 + ease(u) * .65), angle, u, alpha, v === 'storm-wave', simple);
    return true;
  }
  if (/^phoenix|^mirror-phoenix$/.test(v)) {
    const flight = v === 'phoenix-flight', rebirth = (v === 'phoenix' || v === 'mirror-phoenix') && f.lead !== 0 && !flight;
    const lead = f.lead ?? (rebirth ? 360 : 0), elapsed = age - lead;
    if (flight) {
      g.stamp?.('flame', x, y - 14, 22, 48, .9, Math.atan2(f.direction?.y ?? 0, f.direction?.x ?? 1) + Math.PI / 2);
      return true;
    }
    if (elapsed < 0) {
      const charge = clamp(age / Math.max(1, lead));
      for (let i = 0; i < (simple ? 6 : 12); i++) {
        const a = i * 2.399, p = polar(x, y - 22, 45 * (1 - charge) + 8, a);
        shard(g, p[0], p[1] - charge * 8, 5, a + 1, i % 2 ? '#8c6957' : C.gold, .8 * charge);
      }
      ribbon(g, arc(x, y, 18 + charge * 4, 0, Math.PI * 2, .7), 2, C.red, .6);
      return true;
    }
    const t = clamp(elapsed / Math.max(1, f.life - lead)), opening = ease(elapsed / (rebirth ? 170 : 110)), fade = 1 - ease(clamp((elapsed - (rebirth ? 460 : 120)) / (rebirth ? 980 : 320)));
    if (rebirth && fade > .01) g.stamp?.('phoenix', x, y - 47 - opening * 12, (105 + opening * 130), 80 + opening * 18, fade * (lowFlash ? .7 : .95));
    const n = simple ? 5 : 10;
    if (elapsed < 420) for (let i = 0; i < n; i++) {
      const a = i * Math.PI * 2 / n + .15, p = polar(x, y, r * opening, a);
      // 火环在提交帧就抵达真实伤害边界，随后向上卷起再熄灭。
      const fireAlpha = Math.max(0, 1 - elapsed / 420) * flash;
      g.stamp?.('flame', p[0], p[1] - 15, rebirth ? 33 : 20, rebirth ? 61 : 34, fireAlpha * .85, a + Math.PI / 2);
      ribbon(g, arc(x, y, r, a, a + 2 * Math.PI / n * .84), 4 * fireAlpha, C.flame, fireAlpha);
    }
    impact(g, x, y, r, t, (1 - t) * flash, simple, true);
    for (let i = 0; i < (simple ? 4 : 9); i++) {
      const a = i * 2.399 + f.id, distance = rebirth && t > .45 ? 46 * (1 - t) : 15 + ease(t) * r;
      const p = polar(x, y - 22 - t * 25, distance, a);
      shard(g, p[0], p[1], 6 * (1 - t), a + t, i % 2 ? C.gold : C.flame, (1 - t) * .8);
    }
    if (rebirth && t > .45) shard(g, x, y - 29, 9 * (1 - t), -1.57, C.gold, (1 - t) * flash);
    if (v === 'mirror-phoenix' && t > .2) for (let i = 0; i < 3; i++) {
      const a = -2.7 + i * .9, p = polar(x, y - 26, 32, a);
      shard(g, p[0], p[1], 20, a, C.white, (1 - t) * .85);
    }
    return true;
  }
  return false;
}
