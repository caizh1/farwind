import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
const root = "public/assets/npc-life";
const sources = "docs/npc-life/art/sources";
const records = [];
const bounds = async (file, extract) => {
  const source = sharp(file);
  if (extract) source.extract(extract);
  const { data, info } = await source
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let left = info.width,
    top = info.height,
    right = -1,
    bottom = -1,
    clear = 0,
    partial = 0;
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++) {
      const a = data[(y * info.width + x) * 4 + 3];
      if (a === 0) clear++;
      if (a > 0 && a < 255) partial++;
      if (a > 8) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  if (!clear || right < left) throw Error(`${file}没有有效主体或真实透明通道`);
  // 脚部中心而非整张图的边界中心，避免抬手或工具摆动带动整个人左右跳。
  let sum = 0,
    weight = 0;
  for (
    let y = Math.max(top, bottom - Math.round((bottom - top) * 0.08));
    y <= bottom;
    y++
  )
    for (let x = left; x <= right; x++) {
      const a = data[(y * info.width + x) * 4 + 3];
      if (a > 8) {
        sum += x * a;
        weight += a;
      }
    }
  return {
    left,
    top,
    width: right - left + 1,
    height: bottom - top + 1,
    footX: sum / weight,
    footY: bottom + 1,
    clear,
    partial,
  };
};
for (const id of ["elder", "healer", "carpenter"]) {
  const file = `${sources}/${id}-work-source.png`,
    meta = await sharp(file).metadata();
  if (meta.width % 4) throw Error(`${id}动作图集无法按四列切分`);
  const cell = meta.width / 4,
    crops = [],
    ref = await bounds(`public/assets/${id}.png`, {
      left: 0,
      top: 0,
      width: 128,
      height: 128,
    });
  for (let i = 0; i < 4; i++)
    crops.push(
      await bounds(file, {
        left: i * cell,
        top: 0,
        width: cell,
        height: meta.height,
      }),
    );
  const scale = 112 / Math.max(...crops.map((c) => c.height)),
    composite = [];
  for (let i = 0; i < 4; i++) {
    const c = crops[i],
      width = Math.round(c.width * scale),
      height = Math.round(c.height * scale),
      left = Math.round(64 - (c.footX - c.left) * scale),
      top = ref.footY - height;
    if (left < 2 || left + width > 126 || top < 2)
      throw Error(`${id}第${i + 1}帧越过安全边界，需要美术修正`);
    const input = await sharp(file)
      .extract({
        left: i * cell + c.left,
        top: c.top,
        width: c.width,
        height: c.height,
      })
      .resize(width, height)
      .png()
      .toBuffer();
    composite.push({ input, left: i * 128 + left, top });
  }
  await sharp({
    create: { width: 512, height: 128, channels: 4, background: "#00000000" },
  })
    .composite(composite)
    .png()
    .toFile(`${root}/${id}-work.png`);
  records.push({
    ID: `${id}-work`,
    文件: `${id}-work.png`,
    源文件: file,
    源尺寸: [meta.width, meta.height],
    尺寸: [512, 128],
    帧尺寸: [128, 128],
    帧数: 4,
    脚底行: ref.footY,
    切分: crops,
    来源: "内置imagegen，既有角色身份参考；Sharp仅裁切、等比例缩放与脚底对齐",
    许可状态: "生成素材，商业权利和最终美术待复核",
    是否临时: true,
  });
}
for (const [id, width, height] of [
  ["bed", 192, 330],
  ["table", 264, 165],
]) {
  const file = `${sources}/${id}-source.png`,
    meta = await sharp(file).metadata(),
    c = await bounds(file);
  await sharp(file)
    .extract({ left: c.left, top: c.top, width: c.width, height: c.height })
    .resize({ width: width - 16, height: height - 16, fit: "inside" })
    .extend({ top: 8, bottom: 8, left: 8, right: 8, background: "#00000000" })
    .png()
    .toFile(`${root}/${id}.png`);
  records.push({
    ID: `life-${id}`,
    文件: `${id}.png`,
    源文件: file,
    源尺寸: [meta.width, meta.height],
    裁切: c,
    来源: "内置imagegen，现有房屋风格参考；Sharp裁切并等比例缩放",
    许可状态: "生成素材，商业权利和最终美术待复核",
    是否临时: true,
  });
}
await writeFile(
  "docs/npc-life/art/manifest.json",
  JSON.stringify(
    {
      说明: "运行图、原始生成图与实际切分均保留；脚底按既有角色参考对齐，不登记最终美术通过。",
      资源: records,
    },
    null,
    2,
  ) + "\n",
);
const global = JSON.parse(
  await readFile("public/assets/manifest.json", "utf8"),
);
global.资源 = global.资源.filter((r) => !records.some((n) => n.ID === r.ID));
global.资源.push(...records.map((r) => ({ ...r, 文件: `npc-life/${r.文件}` })));
await writeFile(
  "public/assets/manifest.json",
  JSON.stringify(global, null, 2) + "\n",
);
