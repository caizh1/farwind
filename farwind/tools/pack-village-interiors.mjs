import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
const input = "docs/village-interiors/furniture-source.png",
  out = "public/assets/village-interiors";
await mkdir(out, { recursive: true });
const { data, info } = await sharp(input)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const ys = [0, 317, 620, 906, info.height];
const names = [
  "bookcase",
  "herb-cabinet",
  "tools-rack",
  "food-shelf",
  "stove",
  "weapons-rack",
  "linen-cabinet",
  "crate-stack",
  "travel-cabinet",
  "wall-map",
  "windbell",
  "rug",
  "counter",
  "bread",
  "tea",
  "soup",
];
const records = [];
for (let row = 0; row < 4; row++) {
  const spans = [];
  let begin = -1;
  for (let x = 0; x < info.width; x++) {
    let occupied = false;
    for (let y = ys[row]; y < ys[row + 1]; y++)
      if (data[(y * info.width + x) * 4 + 3] > 10) {
        occupied = true;
        break;
      }
    if (occupied && begin < 0) begin = x;
    if (!occupied && begin >= 0) {
      spans.push([begin, x]);
      begin = -1;
    }
  }
  if (begin >= 0) spans.push([begin, info.width]);
  // 小孤立高光合并到最近的主体，列间透明留白才是裁切边界。
  const groups = [];
  for (const s of spans) {
    const last = groups.at(-1);
    if (last && s[0] - last[1] < 20) last[1] = s[1];
    else groups.push([...s]);
  }
  if (groups.length !== 4) console.log("原始透明间隔", spans);
  if (groups.length !== 4)
    throw Error(`第${row + 1}行分组数错误：${JSON.stringify(groups)}`);
  for (let col = 0; col < 4; col++) {
    const [left, right] = groups[col];
    let top = ys[row + 1],
      bottom = ys[row];
    for (let y = ys[row]; y < ys[row + 1]; y++)
      for (let x = left; x < right; x++)
        if (data[(y * info.width + x) * 4 + 3] > 10) {
          top = Math.min(top, y);
          bottom = Math.max(bottom, y + 1);
        }
    const id = names[row * 4 + col],
      rect = {
        left: Math.max(0, left - 1),
        top: Math.max(0, top - 1),
        width: Math.min(info.width, right + 1) - Math.max(0, left - 1),
        height: Math.min(info.height, bottom + 1) - Math.max(0, top - 1),
      };
    await sharp(input)
      .extract(rect)
      .resize({
        width: 512,
        height: 512,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 94, alphaQuality: 100 })
      .toFile(`${out}/${id}.webp`);
    records.push({
      标识: id,
      裁切: rect,
      说明: "透明手绘家具或可使用食物，按脚底排序显示",
    });
  }
}
await writeFile(
  `${out}/manifest.json`,
  JSON.stringify({ 来源: input, 资源: records }, null, 2),
);
console.log("十六项室内家具与食物素材已完整裁切。");
