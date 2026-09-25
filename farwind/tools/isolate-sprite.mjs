import sharp from "sharp";
// 切格只保留最大连通角色，移除跨格胡须／邻帧尾尖；不重绘或变形姿态。
export async function isolated(buffer) {
  const { data, info } = await sharp(buffer)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const n = info.width * info.height,
    seen = new Uint8Array(n);
  let largest = [];
  for (let start = 0; start < n; start++) {
    if (seen[start] || data[start * 4 + 3] < 8) continue;
    const group = [start];
    seen[start] = 1;
    for (let j = 0; j < group.length; j++) {
      const p = group[j],
        x = p % info.width,
        y = Math.floor(p / info.width);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx,
            yy = y + dy;
          if (xx < 0 || xx >= info.width || yy < 0 || yy >= info.height)
            continue;
          const q = yy * info.width + xx;
          if (!seen[q] && data[q * 4 + 3] >= 8) {
            seen[q] = 1;
            group.push(q);
          }
        }
    }
    if (group.length > largest.length) largest = group;
  }
  const mask = new Uint8Array(n);
  for (const p of largest) {
    const x = p % info.width,
      y = Math.floor(p / info.width);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx,
          yy = y + dy;
        if (xx >= 0 && xx < info.width && yy >= 0 && yy < info.height)
          mask[yy * info.width + xx] = 1;
      }
  }
  for (let p = 0; p < n; p++) if (!mask[p]) data[p * 4 + 3] = 0;
  return sharp(data, { raw: info }).png().toBuffer();
}
