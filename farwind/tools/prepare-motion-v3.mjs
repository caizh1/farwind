import { isolated } from "./isolate-sprite.mjs";
import sharp from "sharp";
import fs from "node:fs/promises";
const root = "public/assets/animation/round-three";
// 沿用第二轮128²画布与显式地面根，原有35帧逐像素保留；只追加必要竖向跑步。
const config = {
  hero: {
    scale: 0.275,
    roots: [230, 666, 1105, 1549],
    floors: [430, 862],
    down: [0, 1, 2, 3, 4, 5, 6, 7],
    up: [0, 4, 5, 2, 1, 6, 3, 7],
  },
  cat: {
    scale: 0.2,
    roots: [228, 669, 1110, 1550],
    floors: [415, 858],
    down: [0, 1, 2, 3, 4, 5, 6, 7],
    up: [0, 1, 2, 4, 7, 6],
    upScale: 0.15,
    upFloors: [409, 835],
  },
};
const manifest = [];
for (const [id, c] of Object.entries(config)) {
  const layers = [],
    frames = [];
  const old = `public/assets/animation/round-two/${id}-motion.png`;
  for (let i = 0; i < 35; i++)
    layers.push({
      input: await sharp(old)
        .extract({
          left: (i % 8) * 128,
          top: Math.floor(i / 8) * 128,
          width: 128,
          height: 128,
        })
        .png()
        .toBuffer(),
      left: (i % 8) * 128,
      top: Math.floor(i / 8) * 128,
    });
  let index = 35;
  for (const direction of ["down", "up"]) {
    const file = `${id}-${direction}-run-source.png`,
      meta = await sharp(`${root}/${file}`).metadata(),
      scale = direction === "up" ? (c.upScale ?? c.scale) : c.scale,
      floors = direction === "up" ? (c.upFloors ?? c.floors) : c.floors;
    for (const source of c[direction]) {
      const col = source % 4,
        row = Math.floor(source / 4),
        left = Math.round((col * meta.width) / 4),
        right = Math.round(((col + 1) * meta.width) / 4),
        top = Math.round((row * meta.height) / 2),
        bottom = Math.round(((row + 1) * meta.height) / 2);
      const slice = await sharp(`${root}/${file}`)
        .extract({ left, top, width: right - left, height: bottom - top })
        .png()
        .toBuffer();
      const cut = await sharp(await isolated(slice))
        .resize(
          Math.round((right - left) * scale),
          Math.round((bottom - top) * scale),
        )
        .png()
        .toBuffer();
      const x = 64 - Math.round((c.roots[col] - left) * scale),
        y = 124 - Math.round((floors[row] - top) * scale);
      const canvas = await sharp({
        create: {
          width: 384,
          height: 384,
          channels: 4,
          background: "#00000000",
        },
      })
        .composite([{ input: cut, left: 128 + x, top: 128 + y }])
        .png()
        .toBuffer();
      layers.push({
        input: await sharp(canvas)
          .extract({ left: 128, top: 128, width: 128, height: 128 })
          .png()
          .toBuffer(),
        left: (index % 8) * 128,
        top: Math.floor(index / 8) * 128,
      });
      frames.push({
        帧: index++,
        动作: direction === "up" ? "向上跑步" : "向下跑步",
        源文件: file,
        来源帧: source,
        原始画布: [meta.width, meta.height],
        切格: [left, top, right - left, bottom - top],
        源地面锚点: [c.roots[col] - left, floors[row] - top],
        统一尺度: scale,
        画布: [128, 128],
        锚点: [64, 124],
      });
    }
  }
  const packed = await sharp({
    create: { width: 1024, height: 896, channels: 4, background: "#00000000" },
  })
    .composite(layers)
    .raw()
    .toBuffer();
  // 合成器会对半透明像素做预乘舍入，原35帧用原始字节覆盖，避免无关变化。
  const original = await sharp(old).raw().toBuffer();
  for (let f = 0; f < 35; f++)
    for (let y = 0; y < 128; y++) {
      const offset = ((Math.floor(f / 8) * 128 + y) * 1024 + (f % 8) * 128) * 4;
      original.copy(packed, offset, offset, offset + 512);
    }
  await sharp(packed, { raw: { width: 1024, height: 896, channels: 4 } })
    .png()
    .toFile(`${root}/${id}-motion.png`);
  manifest.push({
    ID: id,
    图集: [1024, 896],
    有效帧: index,
    保留帧: "0—34与第二轮逐像素一致",
    来源: "内置imagegen生成，角色身份参考第二轮原图",
    许可: "生成素材商业权利未审查",
    临时: false,
    说明:
      id === "cat"
        ? "背面剔除两个腿序不合理候选，保留6个姿态，不重复凑帧"
        : "正背面各8个新姿态",
    帧: frames,
  });
}
await fs.writeFile(
  `${root}/manifest.json`,
  JSON.stringify({ 版本: 3, 素材: manifest }, null, 2) + "\n",
);
