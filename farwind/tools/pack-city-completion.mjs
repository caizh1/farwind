import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

// 仅做素材裁切、切帧、等比规范化与检测，不修改生成图的内容或透明通道。
const root = path.resolve(import.meta.dirname, '..');
const folder = path.join(root, 'public/assets/windwhisper-city/completion');
const sourceFolder = path.join(folder, 'sources');
const reportFolder = path.join(root, 'docs/windwhisper-city/completion');
await fs.mkdir(folder, { recursive: true });
const grids = {
  'street-props-a': [3, 2, ['fruit-stall', 'herb-stall', 'cloth-stall', 'cargo-cart', 'street-lamp', 'street-bench']],
  'street-props-b': [3, 2, ['notice-board', 'cargo-crates', 'city-flag', 'city-planter', 'market-counter', 'check-booth']],
  'fortification-parts': [3, 2, ['wall-horizontal', 'wall-vertical', 'wall-corner', 'gate-lintel', 'wall-stairs', 'firing-platform']],
  'interior-furniture-a': [3, 3, ['bed-blue', 'bed-red', 'bookcase', 'writing-desk', 'round-table', 'room-chair', 'storage-chest', 'tavern-counter', 'room-fireplace']],
  'interior-furniture-b': [3, 3, ['forge-anvil', 'forge-furnace', 'clinic-bed', 'medicine-cabinet', 'guild-desk', 'weapon-rack', 'wind-console', 'broken-valve', 'repaired-valve']],
  'interior-details': [3, 3, ['letter-box', 'tool-bag', 'supply-bag', 'city-emblem', 'water-basin', 'room-door', 'flower-pot', 'wall-lamp', 'crystal-pedestal']],
  'city-ground-tiles': [2, 2, ['street-tile', 'plaza-tile', 'wood-floor', 'underground-tile']],
  'city-roof-symbols': [4, 2, ['roof-tower', 'roof-hall', 'roof-archive', 'roof-guild', 'roof-barracks', 'roof-inn', 'roof-house', 'roof-gate']],
  'wind-effects': [3, 2, ['wind-blade-blue', 'wind-blade-gold', 'wind-pressure', 'core-charge', 'crystal-sparks', 'celebration-sparks']],
  'interior-wall-modules': [2, 2, ['room-wall-back', 'room-wall-side', 'underground-wall', 'room-open-door']],
};
const actors = ['captain', 'merchant', 'innkeeper', 'keeper', 'guard', 'archer', 'artisan', 'herbalist', 'scholar', 'citizen', 'traveler', 'apprentice'];
const animations = Object.fromEntries(actors.map(id => [id + '-walk', [4, 3]]));
animations['guard-actions-v2'] = [4, 2];
animations['citizen-actions-v2'] = [4, 2];
animations['guardian-actions-v2'] = [2, 2];
const warnings = [], entries = [];
function bounds(data, width, height, channels, threshold = 32) {
  let left = width, top = height, right = -1, bottom = -1, opaque = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * channels + channels - 1] < threshold) continue;
    opaque++; left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  if (right < 0) throw Error('素材没有有效主体。');
  return { left, top, width: right - left + 1, height: bottom - top + 1, opaque };
}
async function analyse(input) {
  const m = await sharp(input).metadata();
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { m, info, body: bounds(data, info.width, info.height, info.channels), data };
}
async function split(input, columns, rows, rectangular = false) {
  const { info, data } = await analyse(input);
  const { width, height } = info;
  // imagegen 会裁去整张图集的透明外边距；不能假设返回图片仍保留等宽格边。
  // 只用连通主体确定裁切框，不涂改像素或以阈值代替原图透明通道。
  const seen = new Uint8Array(width * height), queue = new Int32Array(width * height), components = [];
  if (!rectangular) for (let origin = 0; origin < seen.length; origin++) {
    if (seen[origin] || data[origin * 4 + 3] < 200) continue;
    let count = 0, head = 0, tail = 1, left = width, right = 0, top = height, bottom = 0, sumX = 0, sumY = 0;
    queue[0] = origin; seen[origin] = 1;
    while (head < tail) {
      const at = queue[head++], x = at % width, y = Math.floor(at / width);
      count++; sumX += x; sumY += y; left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      for (const neighbor of [x ? at - 1 : -1, x + 1 < width ? at + 1 : -1, y ? at - width : -1, y + 1 < height ? at + width : -1])
        if (neighbor >= 0 && !seen[neighbor] && data[neighbor * 4 + 3] >= 200) { seen[neighbor] = 1; queue[tail++] = neighbor; }
    }
    if (count >= 100) components.push({ count, left, right, top, bottom, x: sumX / count, y: sumY / count });
  }
  const groups = Array.from({ length: columns * rows }, () => []);
  for (const c of components) {
    const x = Math.min(columns - 1, Math.floor(c.x * columns / width)), y = Math.min(rows - 1, Math.floor(c.y * rows / height));
    groups[y * columns + x].push(c);
  }
  const frames = [];
  frames.cropRegions = [];
  frames.sourceSize = [width, height];
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
    const group = groups[y * columns + x];
    if (!rectangular && !group.length) throw Error(`图集第${y * columns + x + 1}格没有独立主体，须重新核对源图。`);
    const maxArea = Math.max(...group.map(c => c.count), 1), bodies = group.filter(c => c.count >= Math.max(100, maxArea * .005));
    const left = rectangular ? Math.round(x * width / columns) : Math.max(0, Math.min(...bodies.map(c => c.left)) - 12);
    const top = rectangular ? Math.round(y * height / rows) : Math.max(0, Math.min(...bodies.map(c => c.top)) - 12);
    const right = rectangular ? Math.round((x + 1) * width / columns) : Math.min(width, Math.max(...bodies.map(c => c.right)) + 13);
    const bottom = rectangular ? Math.round((y + 1) * height / rows) : Math.min(height, Math.max(...bodies.map(c => c.bottom)) + 13);
    const w = right - left, h = bottom - top;
    frames.push(await sharp(input).extract({ left, top, width: w, height: h }).png().toBuffer());
    frames.cropRegions.push({ left, top, right, bottom });
  }
  return frames;
}
for (const file of (await fs.readdir(sourceFolder)).filter(f => f.endsWith('.png')).sort()) {
  const id = file.slice(0, -4), input = path.join(sourceFolder, file), full = await analyse(input);
  if (['guard-actions', 'citizen-actions', 'guardian-actions'].includes(id)) continue;
  if (id !== 'city-ground-tiles' && !full.m.hasAlpha) throw Error(`${id} 缺少真实透明通道。`);
  if (animations[id]) {
    const [columns, rows] = animations[id], frames = await split(input, columns, rows);
    const packed = [], measurements = [], frameSize = id === 'guardian-actions-v2' ? 512 : 256;
    for (let i = 0; i < frames.length; i++) {
      const { info, body } = await analyse(frames[i]);
      const crop = frames.cropRegions[i];
      if (crop.left === 0 || crop.top === 0 || crop.right === frames.sourceSize[0] || crop.bottom === frames.sourceSize[1])
        warnings.push(`${id} 第${i + 1}帧裁切靠近源图外沿，须对照源图确认完整。`);
      const foot = Math.round(frameSize * .94);
      const targetHeight = Math.round(frameSize * .84);
      const scale = Math.min(1, targetHeight / body.height, (frameSize - 24) / body.width);
      const w = Math.max(1, Math.round(body.width * scale)), h = Math.max(1, Math.round(body.height * scale));
      const cut = await sharp(frames[i]).extract({ left: body.left, top: body.top, width: body.width, height: body.height }).resize(w, h).png().toBuffer();
      packed.push({ input: cut, left: Math.round(frameSize / 2 - w / 2) + (i % columns) * frameSize, top: foot - h + Math.floor(i / columns) * frameSize });
      measurements.push({ frame: i, sourceCrop: crop, nativeBody: [body.width, body.height], packedBody: [w, h], foot: [frameSize / 2, foot] });
      if (body.height < (id === 'guardian-actions-v2' ? 360 : 180)) warnings.push(`${id} 第${i + 1}帧有效原生高度不足两倍目标显示高度。`);
    }
    const output = path.join(folder, id + '.webp');
    await sharp({ create: { width: frameSize * columns, height: frameSize * rows, channels: 4, background: '#00000000' } }).composite(packed).webp({ quality: 95 }).toFile(output);
    entries.push({ id, source: 'sources/' + file, file: id + '.webp', kind: 'animation', width: frameSize * columns, height: frameSize * rows, frameSize, columns, rows, foot: [.5, .94], measurements, status: '已切帧，动作与运行未验证' });
  } else if (grids[id]) {
    const [columns, rows, names] = grids[id], frames = await split(input, columns, rows, id === 'city-ground-tiles');
    for (let i = 0; i < frames.length; i++) {
      const part = await analyse(frames[i]);
      const isGround = id === 'city-ground-tiles';
      const body = isGround ? { left: 0, top: 0, width: part.info.width, height: part.info.height } : part.body;
      const output = path.join(folder, names[i] + '.webp');
      await sharp(frames[i]).extract({ left: body.left, top: body.top, width: body.width, height: body.height }).webp({ quality: 95 }).toFile(output);
      const crop = frames.cropRegions[i];
      if (!isGround && (crop.left === 0 || crop.top === 0 || crop.right === frames.sourceSize[0] || crop.bottom === frames.sourceSize[1])) warnings.push(`${names[i]} 靠近源图外沿，需对照原生轮廓。`);
      entries.push({ id: names[i], source: 'sources/' + file, frame: i, file: names[i] + '.webp', kind: isGround ? 'ground' : 'prop', width: body.width, height: body.height, foot: [.5, 1], status: '已裁切，运行未验证' });
    }
  } else {
    // 裁切只去除透明边距，原生像素保持原尺寸，静态素材不插值放大。
    const b = full.body;
    await sharp(input).extract({ left: b.left, top: b.top, width: b.width, height: b.height }).webp({ quality: 95 }).toFile(path.join(folder, id + '.webp'));
    entries.push({ id, source: 'sources/' + file, file: id + '.webp', kind: 'building', width: b.width, height: b.height, sourceWidth: full.m.width, sourceHeight: full.m.height, foot: [.5, 1], status: '已裁切，脚底与运行未验证' });
  }
}
await fs.writeFile(path.join(folder, 'manifest.json'), JSON.stringify({ version: 1, status: '素材生产中，未通过运行验收', assets: entries }, null, 2) + '\n');
await fs.writeFile(path.join(reportFolder, 'ASSET-INSPECTION.md'), '# 素材导入检测\n\n本报告只核对原生尺寸、透明通道与切帧，不代表美术或正式运行验收通过。\n\n' + `已导出${entries.length}项素材。\n\n` + (warnings.length ? '## 需要复核\n\n' + warnings.map(w => '- ' + w).join('\n') : '未检测到格边或有效像素告警。动作身份、透视、门位和运行仍待复核。') + '\n');
console.log(JSON.stringify({ 已导出: entries.length, 待复核: warnings.length }));
