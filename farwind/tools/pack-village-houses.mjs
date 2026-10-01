import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

// 生成图未严格等分；裁切线取每栋之间的真实透明间隙。
const source = "docs/village-houses/design-source.png";
const root = "public/assets/village-houses";
const rows = [[0, 401, 716, 1062, 1389, 1774], [0, 359, 725, 1066, 1405, 1774]];
const houses = [
  ["home", "西巷旧宅", 280, 310],
  ["resident-cottage-1", "岚爷爷的家", 180, 235],
  ["west-cottage", "阿禾的家", 230, 255],
  ["resident-cottage-2", "西巷小屋", 180, 235],
  ["general-building", "风铃杂货铺", 210, 235],
  ["carpenter-workshop", "阿禾的木工坊", 195, 210],
  ["smith-building", "溪石铁匠铺", 205, 250],
  ["shop", "小满的药房", 290, 310],
  ["barracks-building", "风铃营房", 170, 220],
  ["inn-building", "归风旅馆", 210, 255],
];
const meta = await sharp(source).metadata();
assert.equal(meta.width, 1774, "源图宽度变化，需重新确认裁切间隙");
assert.equal(meta.height, 887, "源图高度变化，需重新确认裁切间隙");
assert.ok(meta.hasAlpha, "源图必须透明");
await mkdir(root, { recursive: true });
const records = [], tiles = [];
for (const [i, [id, name, width, height]] of houses.entries()) {
  const row = Math.floor(i / 5), col = i % 5;
  const cell = { left: rows[row][col], top: row * 443, width: rows[row][col + 1] - rows[row][col], height: row ? 444 : 443 };
  const { data, info } = await sharp(source).extract(cell).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width, top = info.height, right = -1, bottom = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] <= 10) continue;
    left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  assert.ok(left > 0 && top > 0 && right < info.width - 1 && bottom < info.height - 1, `${name}裁切线碰到有效内容`);
  const crop = { left: cell.left + left - 1, top: cell.top + top - 1, width: right - left + 3, height: bottom - top + 3 };
  // 与原显示比例一致；无外加地面、碰撞或场景对象。
  const buffer = await sharp(source).extract(crop).resize(width * 2, height * 2, { fit: "fill" }).webp({ quality: 92, alphaQuality: 100 }).toBuffer();
  await writeFile(`${root}/${id}.webp`, buffer);
  const { data: pixels, info: dimensions } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (const [x, y] of [[0, 0], [dimensions.width - 1, 0], [0, dimensions.height - 1], [dimensions.width - 1, dimensions.height - 1]])
    assert.equal(pixels[(y * dimensions.width + x) * 4 + 3], 0, `${name}角落必须完全透明`);
  records.push({ 标识: id, 名称: name, 纹理: `village-house-${id}`, 文件: `village-houses/${id}.webp`, 源裁切: crop, 像素尺寸: [width * 2, height * 2], 显示尺寸: [width, height], 锚点: [0.5, 1], 碰撞: "沿用建筑原占地", 字节数: buffer.length });
  const tile = await sharp(source).extract(crop).resize({ width: 300, height: 330, fit: "contain", background: "#00000000" }).png().toBuffer();
  tiles.push({ input: tile, left: col * 344 + 22, top: row * 418 + 95 });
}
assert.equal(records.length, 10, "必须覆盖全部十栋房屋");
const labels = houses.map(([, name], i) => `<text x="${Math.floor(i % 5) * 344 + 172}" y="${Math.floor(i / 5) * 418 + 454}" text-anchor="middle" font-size="22" fill="#493c2d">${name}</text>`).join("");
const legend = Buffer.from(`<svg width="1720" height="932"><style>text{font-family:'PingFang SC',sans-serif}</style><text x="860" y="42" text-anchor="middle" font-size="29" fill="#493c2d">风铃村 · 十栋房屋细节设计</text><text x="860" y="71" text-anchor="middle" font-size="18" fill="#776b58">红陶瓦 · 石木墙 · 各有生活痕迹 · 门前保持净空</text>${labels}</svg>`);
await sharp({ create: { width: 1720, height: 932, channels: 4, background: "#eee7d5" } }).composite([...tiles, { input: legend }]).png().toFile("docs/village-houses/design-board.png");
await writeFile(`${root}/manifest.json`, JSON.stringify({ 说明: "内置图像生成工具制作设计图，逐栋透明裁切；运行外观和设计图使用同一源图。", 资源: records }, null, 2));
console.log("十栋房屋已裁切，透明边界与覆盖检查通过。");
