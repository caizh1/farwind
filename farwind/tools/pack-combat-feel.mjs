import sharp from "sharp";
import { writeFile } from "node:fs/promises";
const source = "docs/combat-feel/assets/side-combo-source.png";
const { data, info } = await sharp(source)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const seen = new Uint8Array(info.width * info.height),
  groups = [];
for (let seed = 0; seed < seen.length; seed++) {
  if (seen[seed] || data[seed * 4 + 3] < 16) continue;
  const group = [seed];
  seen[seed] = 1;
  for (let i = 0; i < group.length; i++) {
    const p = group[i],
      x = p % info.width,
      y = Math.floor(p / info.width);
    for (const q of [p - 1, p + 1, p - info.width, p + info.width]) {
      if (q < 0 || q >= seen.length || seen[q] || data[q * 4 + 3] < 16)
        continue;
      if (
        Math.abs((q % info.width) - x) +
          Math.abs(Math.floor(q / info.width) - y) !==
        1
      )
        continue;
      seen[q] = 1;
      group.push(q);
    }
  }
  if (group.length > 1000) groups.push(group);
}
if (groups.length !== 24) throw Error(`应有24个完整姿态，实际${groups.length}`);
const center = (g) => [
  g.reduce((n, p) => n + (p % info.width), 0) / g.length,
  g.reduce((n, p) => n + Math.floor(p / info.width), 0) / g.length,
];
groups.sort(
  (a, b) =>
    Math.floor(center(a)[1] / 256) - Math.floor(center(b)[1] / 256) ||
    center(a)[0] - center(b)[0],
);
// 人体脚下根按行标注，不按每帧最低透明像素重新缩放；同一0.46比例。
const roots = [
  [
    [140, 252],
    [405, 252],
    [634, 252],
    [891, 252],
    [1156, 252],
    [1410, 252],
  ],
  [
    [135, 499],
    [389, 499],
    [626, 499],
    [886, 499],
    [1140, 499],
    [1394, 499],
  ],
  [
    [123, 750],
    [388, 750],
    [633, 750],
    [889, 750],
    [1138, 750],
    [1387, 750],
  ],
  [
    [128, 980],
    [376, 980],
    [628, 980],
    [886, 980],
    [1124, 980],
    [1393, 980],
  ],
].flat();
const composite = [];
for (let i = 0; i < 24; i++) {
  const raw = Buffer.alloc(348 * 348 * 4),
    [rx, ry] = roots[i];
  for (const p of groups[i]) {
    const x = (p % info.width) - rx + 174,
      y = Math.floor(p / info.width) - ry + 335;
    if (x >= 0 && x < 348 && y >= 0 && y < 348)
      data.copy(raw, (y * 348 + x) * 4, p * 4, p * 4 + 4);
  }
  const frame = await sharp(raw, {
    raw: { width: 348, height: 348, channels: 4 },
  })
    .resize(160, 160)
    .png()
    .toBuffer();
  composite.push({
    input: frame,
    left: (i % 6) * 160,
    top: Math.floor(i / 6) * 160,
  });
}
await sharp({
  create: {
    width: 960,
    height: 640,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite(composite)
  .png()
  .toFile("public/assets/animation/hero-combat-side.png");
await writeFile(
  "docs/combat-feel/assets/atlas-metadata.json",
  JSON.stringify(
    {
      来源: source,
      生成标记: "内置image_gen生成，透明背景与第15姿态经定向修订",
      基础朝向: "右；左向局部水平镜像",
      源尺寸: [1536, 1024],
      源地面根: roots,
      裁切偏移: roots.map(([x, y]) => [x - 174, y - 335]),
      统一缩放: 160 / 348,
      帧尺寸: [160, 160],
      帧地面根: [80, 154],
      动作行: ["横斩", "反斩", "终结斩", "拔剑与收剑"],
      已获用户美术认可: false,
    },
    null,
    2,
  ),
);

// 从同一源图提取短剑层，供即时移动退出使用，保持刀刃长度和贴图风格。
await sharp(source)
  .extract({ left: 181, top: 185, width: 80, height: 40 })
  .png()
  .toFile("public/assets/animation/hero-carry-sword.png");
