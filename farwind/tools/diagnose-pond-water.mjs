import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
const root = "docs/visual-polish";
await mkdir(root, { recursive: true });
const file = "public/assets/water.png";
const { data, info } = await sharp(file)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const pixel = (x, y, k) => data[(y * info.width + x) * 4 + k];
function difference(horizontal, edge) {
  let total = 0,
    maximum = 0;
  const n = horizontal ? info.height : info.width;
  for (let p = 0; p < n; p++)
    for (let k = 0; k < 3; k++) {
      const a = horizontal
        ? pixel(edge ? 0 : 300, p, k)
        : pixel(p, edge ? 0 : 300, k);
      const b = horizontal
        ? pixel(edge ? info.width - 1 : 301, p, k)
        : pixel(p, edge ? info.height - 1 : 301, k);
      const d = Math.abs(a - b);
      total += d;
      maximum = Math.max(maximum, d);
    }
  return { 平均通道差: total / (n * 3), 最大通道差: maximum };
}
await sharp({
  create: {
    width: info.width * 3,
    height: info.height * 3,
    channels: 4,
    background: "#00000000",
  },
})
  .composite(
    Array.from({ length: 9 }, (_, i) => ({
      input: file,
      left: (i % 3) * info.width,
      top: Math.floor(i / 3) * info.height,
    })),
  )
  .png()
  .toFile(`${root}/old-water-tiled-3x3.png`);
const source = await sharp("public/assets/ground-source.png")
  .extract({ left: 0, top: 627, width: 627, height: 627 })
  .ensureAlpha()
  .raw()
  .toBuffer();
await writeFile(
  `${root}/water-diagnosis.json`,
  JSON.stringify(
    {
      图片尺寸: [info.width, info.height],
      透明度范围: [
        data
          .filter((_, i) => i % 4 === 3)
          .reduce((a, b) => Math.min(a, b), 255),
        data.filter((_, i) => i % 4 === 3).reduce((a, b) => Math.max(a, b), 0),
      ],
      裁切来源: "ground-source.png 左下象限，左=0，上=627，宽高=627",
      与源裁切逐字节相同: source.equals(data),
      左右接缝: difference(true, true),
      上下接缝: difference(false, true),
      横向内部相邻列: difference(true, false),
      纵向内部相邻行: difference(false, false),
      纹理重复边界: { 竖向: 1254, 横向: 1254 },
      地表分块边界: { 竖向: 1200, 横向: 1100 },
      说明: "颜色通道差为0至255量纲；平铺图用于直接检查颜色及波纹结构，提示词的可平铺声明不能代替验证。",
    },
    null,
    2,
  ),
);
