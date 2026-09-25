import sharp from "sharp";
import fs from "node:fs/promises";
const root = "public/assets/animation/round-two";
import { isolated } from "./isolate-sprite.mjs";
const grid = (cols, rows) => {
  const cells = [];
  for (let r = 0; r < rows.length - 1; r++)
    for (let c = 0; c < cols.length - 1; c++)
      cells.push([
        cols[c],
        rows[r],
        cols[c + 1] - cols[c],
        rows[r + 1] - rows[r],
      ]);
  return cells;
};
const repeated = (values, n) =>
  Array.from({ length: n }, (_, i) => values[i % values.length]);
const sheets = {
  hero: [
    {
      file: "hero-walk-source.png",
      start: 1,
      scale: 0.267,
      cells: grid([0, 443, 887, 1330, 1774], [0, 443, 887]),
      roots: repeated([265, 710, 1155, 1598], 8),
      floors: [427, 432, 435, 426, 858, 860, 860, 857],
      action: "侧向行走",
    },
    {
      file: "hero-down-source.png",
      start: 9,
      scale: 0.287,
      cells: grid([0, 420, 840, 1254], [0, 440, 835, 1254]),
      roots: [235, 640, 1040, 235, 642, 1041, 235, 635, 1032],
      floors: [421, 430, 427, 824, 828, 827, 1212, 1217, 1217],
      action: "正面待机与行走",
    },
    {
      file: "hero-up-source.png",
      start: 18,
      scale: 0.278,
      cells: grid([0, 418, 836, 1254], [0, 434, 832, 1254]),
      roots: [235, 630, 1035, 235, 640, 1040, 235, 640, 1030],
      floors: [410, 421, 421, 822, 822, 822, 1220, 1216, 1219],
      action: "背面待机与行走",
    },
    {
      file: "hero-run-source.png",
      start: 27,
      scale: 0.267,
      cells: grid([0, 443, 887, 1330, 1774], [0, 450, 887]),
      roots: repeated([265, 710, 1155, 1598], 8),
      floors: [443, 443, 443, 443, 875, 875, 875, 875],
      action: "侧向奔跑，腾空不贴地",
    },
  ],
  cat: [
    {
      file: "cat-walk-source.png",
      start: 1,
      scale: 0.242,
      cells: grid([0, 460, 900, 1330, 1774], [0, 443, 887]),
      roots: repeated([270, 715, 1156, 1596], 8),
      floors: [408, 407, 406, 407, 800, 799, 799, 799],
      action: "侧向行走",
    },
    {
      file: "cat-vertical-source.png",
      start: 9,
      scale: 0.28,
      cells: grid([0, 370, 650, 1024], [0, 290, 568, 842, 1050, 1260, 1536]),
      roots: [
        235, 520, 806, 235, 520, 806, 235, 520, 806, 225, 516, 811, 225, 516,
        811, 225, 516, 811,
      ],
      floors: [
        280, 284, 284, 560, 562, 562, 832, 831, 832, 1035, 1043, 1043, 1255,
        1253, 1255, 1470, 1477, 1476,
      ],
      action: "正背面待机与行走",
    },
    {
      file: "cat-run-source.png",
      start: 27,
      scale: 0.318,
      cells: grid([0, 443, 887, 1330, 1774], [0, 445, 887]),
      roots: repeated([245, 685, 1126, 1564], 8),
      floors: [390, 390, 390, 390, 761, 761, 761, 761],
      action: "侧向小跑，腾空不贴地",
    },
  ],
};
const manifest = [];
for (const [id, parts] of Object.entries(sheets)) {
  const layers = [
      {
        input: await sharp(`docs/animation/round-one/${id}-motion.png`)
          .extract({ left: 0, top: 0, width: 128, height: 128 })
          .png()
          .toBuffer(),
        left: 0,
        top: 0,
      },
    ],
    frames = [{ 帧: 0, 来源: "上一轮用户通过的侧向待机", 地面锚点: [64, 124] }];
  for (const s of parts) {
    const source = await sharp(`${root}/${s.file}`).metadata();
    for (let i = 0; i < s.cells.length; i++) {
      const [left, top, width, height] = s.cells[i],
        index = s.start + i;
      const slice = await sharp(`${root}/${s.file}`)
        .extract({ left, top, width, height })
        .png()
        .toBuffer();
      const scaled = await sharp(await isolated(slice))
        .resize(Math.round(width * s.scale), Math.round(height * s.scale))
        .png()
        .toBuffer();
      const x = 64 - Math.round((s.roots[i] - left) * s.scale),
        y = 124 - Math.round((s.floors[i] - top) * s.scale);
      const canvas = await sharp({
        create: {
          width: 384,
          height: 384,
          channels: 4,
          background: "#00000000",
        },
      })
        .composite([{ input: scaled, left: x + 128, top: y + 128 }])
        .png()
        .toBuffer();
      const out = await sharp(canvas)
        .extract({ left: 128, top: 128, width: 128, height: 128 })
        .png()
        .toBuffer();
      layers.push({
        input: out,
        left: (index % 8) * 128,
        top: Math.floor(index / 8) * 128,
      });
      frames.push({
        帧: index,
        动作: s.action,
        源文件: s.file,
        来源帧: i,
        源画布: [source.width, source.height],
        源切格: s.cells[i],
        源锚点: [s.roots[i] - left, s.floors[i] - top],
        统一尺度: s.scale,
        目标画布: [128, 128],
        地面锚点: [64, 124],
      });
    }
  }
  await sharp({
    create: { width: 1024, height: 640, channels: 4, background: "#00000000" },
  })
    .composite(layers)
    .png()
    .toFile(`${root}/${id}-motion.png`);
  manifest.push({
    ID: id,
    来源: "内置imagegen，多轮候选检查后选用；侧向待机保留上一轮通过版本",
    许可: "生成素材商业权利未审查",
    处理: "固定源切格与每张源图统一尺度；显式锚点；清除跨格孤立碎片；不按各帧包围盒缩放；跑步保留腾空",
    图集: [1024, 640],
    有效帧: 35,
    竖向奔跑: "尚无独立素材，暂用同方向行走",
    帧: frames,
  });
}
await fs.writeFile(
  `${root}/manifest.json`,
  JSON.stringify({ 版本: 2, 素材: manifest }, null, 2),
);
