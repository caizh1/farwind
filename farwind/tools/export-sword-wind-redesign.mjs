import { mkdir, writeFile } from 'node:fs/promises';
import { synthSwordWindCue, SWORD_WIND_AUDIO } from '../src/game/systems/swordWindAudio.ts';
const dir = 'docs/sword-wind-audio-redesign', rate = SWORD_WIND_AUDIO.rate;
await mkdir(dir, { recursive: true });
function wave(channels) {
  const frames = channels[0].length, buffer = Buffer.alloc(44 + frames * 4);
  buffer.write('RIFF'); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(2, 22);
  buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 4, 28);
  buffer.writeUInt16LE(4, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(frames * 4, 40);
  for (let i = 0; i < frames; i++) for (let c = 0; c < 2; c++) buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, channels[c][i] * .25)) * 32767), 44 + (i * 2 + c) * 2);
  return buffer;
}
const release = synthSwordWindCue('wind-release');
await writeFile(`${dir}/after.wav`, wave(release));
await writeFile(`${dir}/short-howl.wav`, wave(release));
const sequence = [new Float32Array(rate * 4), new Float32Array(rate * 4)];
function mix(kind, at, variant) {
  const channels = synthSwordWindCue(kind, rate, variant), offset = Math.round(at * rate);
  for (let c = 0; c < 2; c++) for (let i = 0; i < channels[c].length && offset + i < sequence[c].length; i++) sequence[c][offset + i] += channels[c][i];
}
for (let n = 0; n < 8; n++) {
  const at = .15 + n * .4;
  mix('wind-charge', at, 0); mix('wind-release', at + .11, n % 3); mix('wind-dissolve', at + .35, 0);
}
await writeFile(`${dir}/continuous.wav`, wave(sequence));
await writeFile(`${dir}/short-howl-preview.wav`, wave(sequence));
await writeFile(`${dir}/preview.html`, `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>剑风音效试听</title><style>body{font:17px/1.7 system-ui;background:#15221f;color:#eee;max-width:700px;margin:5vh auto;padding:24px}section{padding:18px;margin:20px 0;border:1px solid #55766a;border-radius:14px}audio{width:100%}h1{font-size:28px}p{color:#c0cec8}</style><h1>I 攻击 · 剑风音效重设计</h1><p>原创风腔合成，释放声 240 毫秒；不使用宽带噪声或金属泛音。默认游戏音量 25%。新旧释放声峰值相同；请保持设备音量一致进行比较。</p><section><h2>旧版 · 风腔呼啸</h2><audio controls src="before.wav"></audio></section><section><h2>新版 · 短促柔和的风呼啸</h2><audio controls src="after.wav"></audio></section><section><h2>新版 · 连续施放</h2><audio controls src="continuous.wav"></audio><p>按 400 毫秒基础节奏编排，包含起手、三种细微释放变体与消散。此段为离线试听；实际命中时机由战斗决定。</p></section><p>音色、听感与设备体验待试听确认。</p></html>`);
console.log('剑风新版单次、连续施放与新旧试听页已生成。');
