import sharp from "sharp";
import { writeFile } from "node:fs/promises";
const { data, info } = await sharp(
  "docs/training-dummy/assets/dummy-source.png",
)
  .trim()
  .resize({ width: 90 })
  .png()
  .toBuffer({ resolveWithObject: true });
await sharp(data)
  .extract({ left: 0, top: 0, width: 90, height: info.height - 20 })
  .toFile("public/assets/training-body.png");
await sharp(data)
  .extract({ left: 0, top: info.height - 22, width: 90, height: 22 })
  .toFile("public/assets/training-base.png");
await writeFile(
  "docs/training-dummy/assets/metadata.json",
  JSON.stringify(
    {
      来源: "内置image_gen原创生成，未登记用户美术认可",
      整体尺寸: [90, info.height],
      身体尺寸: [90, info.height - 20],
      底座尺寸: [90, 22],
      身体根偏移: [0, -20],
      碰撞占地: [26, 14],
      说明: "身体与底座重叠2像素，身体单独摆动，逻辑根不移动",
    },
    null,
    2,
  ),
);
