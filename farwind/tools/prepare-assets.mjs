import sharp from "sharp";
const root = new URL("../public/assets/", import.meta.url).pathname;
const names = [
  "house",
  "shop",
  "tower",
  "well",
  "tree",
  "pink",
  "bush",
  "fence",
  "chest",
  "chest-open",
  "rune",
  "sign",
  "herb",
  "berry",
  "wood",
  "rock",
];
const cols = [0, 327, 650, 960, 1254],
  rows = [0, 405, 733, 1000, 1254];
const manifest = [];
for (let i = 0; i < 16; i++) {
  const x = i % 4,
    y = Math.floor(i / 4);
  const source = await sharp(root + "environment-source.png")
    .extract({
      left: cols[x],
      top: rows[y],
      width: cols[x + 1] - cols[x],
      height: rows[y + 1] - rows[y],
    })
    .png()
    .toBuffer();
  await sharp(source)
    .trim({ threshold: 15 })
    .png()
    .toFile(root + names[i] + ".png");
  const meta = await sharp(root + names[i] + ".png").metadata();
  manifest.push({
    id: names[i],
    用途: "独立场景物体",
    来源: "内置图像生成，参考用户设计图",
    权利: "未完成商业权利审查",
    尺寸: [meta.width, meta.height],
    锚点: [0.5, 1],
    临时: false,
  });
}
async function frames(name, rowStart, rowEnd, indices) {
  const layers = [];
  for (let i = 0; i < indices.length; i++) {
    const n = indices[i],
      col = n % 6,
      row = Math.floor(n / 6);
    const top = rowStart === null ? row * 209 : rowStart,
      bottom = rowStart === null ? (row + 1) * 209 : rowEnd;
    const b = await sharp(root + "characters-source.png")
      .extract({ left: col * 209, top, width: 209, height: bottom - top })
      .png()
      .toBuffer();
    const trimmed = await sharp(b).trim({ threshold: 15 }).png().toBuffer();
    const meta = await sharp(trimmed).metadata();
    const h = name === "cat" ? 68 : 108,
      w = Math.round((meta.width / meta.height) * h);
    const buf = await sharp(trimmed)
      .resize({ width: Math.min(w, 124), height: h, fit: "inside" })
      .png()
      .toBuffer();
    const m = await sharp(buf).metadata();
    layers.push({
      input: buf,
      left: i * 128 + Math.floor((128 - m.width) / 2),
      top: 124 - m.height,
    });
  }
  await sharp({
    create: {
      width: 128 * indices.length,
      height: 128,
      channels: 4,
      background: "#00000000",
    },
  })
    .composite(layers)
    .png()
    .toFile(root + name + ".png");
  manifest.push({
    id: name,
    用途: "动画角色",
    来源: "内置图像生成，裁切并统一脚底",
    权利: "未完成商业权利审查",
    尺寸: [128 * indices.length, 128],
    锚点: [0.5, 0.969],
    动画: { 帧数: indices.length, 帧宽: 128, 帧高: 128 },
    临时: false,
  });
}
await frames(
  "hero",
  null,
  null,
  Array.from({ length: 24 }, (_, i) => i),
);
await frames("cat", 836, 990, [0, 1, 2, 3, 4, 5]);
await frames("elder", 990, 1254, [0, 1]);
await frames("healer", 990, 1254, [2, 3]);
await frames("carpenter", 990, 1254, [4, 5]);
// 统一登记器保留专项子目录资产，避免重新裁切时抹掉正式接入记录。
await import("./asset-report.mjs");
