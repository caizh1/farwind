import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
const manifest = JSON.parse(
  await readFile("docs/combat-contact/assets/back-metadata.json", "utf8"),
);
const frames = [];
const buffers = [];
for (const sheet of manifest.源图) {
  const { data, info } = await sharp(sheet.路径)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 0; i < sheet.地面根.length; i++) {
    const [rx, ry] = sheet.地面根[i],
      size = sheet.裁切尺寸,
      raw = Buffer.alloc(size * size * 4);
    const [cw, ch] = sheet.格尺寸;
    const col = i % 3,
      row = Math.floor(i / 3);
    for (
      let y = sheet.行边界?.[row] ?? Math.round(row * ch);
      y < (sheet.行边界?.[row + 1] ?? Math.round((row + 1) * ch));
      y++
    )
      for (let x = Math.round(col * cw); x < Math.round((col + 1) * cw); x++) {
        const tx = Math.round(x - rx + size / 2),
          ty = Math.round(y - ry + (size * 154) / 160);
        if (tx >= 0 && tx < size && ty >= 0 && ty < size)
          data.copy(
            raw,
            (ty * size + tx) * 4,
            (y * info.width + x) * 4,
            (y * info.width + x) * 4 + 4,
          );
      }
    const index = frames.length;
    const buffer =
      index === 6
        ? buffers[5]
        : await sharp(raw, { raw: { width: size, height: size, channels: 4 } })
            .resize(160, 160)
            .png()
            .toBuffer();
    buffers.push(buffer);
    frames.push({
      input: buffer,
      left: (index % 6) * 160,
      top: Math.floor(index / 6) * 160,
    });
  }
}
await sharp({
  create: {
    width: 960,
    height: Math.ceil(frames.length / 6) * 160,
    channels: 4,
    background: "#00000000",
  },
})
  .composite(frames)
  .png()
  .toFile("public/assets/animation/hero-combat-back.png");
console.log(
  `已打包${frames.length}帧背向动作，统一地面根[80,154]，未改走跑素材。`,
);
