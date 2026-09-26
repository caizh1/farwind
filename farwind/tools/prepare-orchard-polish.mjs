import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";

const root = "public/assets/village-polish";
const records = [];
for (const [id, width, height, display, anchor, placement, purpose] of [
  [
    "orchard-flower-bed",
    630,
    240,
    [210, 80],
    [0, 0],
    [[230, 1480]],
    "南侧果园低矮花床，地表阶段绘制",
  ],
  [
    "village-bench",
    270,
    150,
    [90, 50],
    [0.5, 1],
    [
      [940, 1380],
      [1540, 1350],
    ],
    "池边两个木长椅，按落地点排序的非交互装饰",
  ],
]) {
  const source = `${root}/${id}-source.png`;
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let left = info.width,
    top = info.height,
    right = -1,
    bottom = -1;
  let transparent = 0,
    partial = 0;
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++) {
      const alpha = data[(y * info.width + x) * 4 + 3];
      if (alpha === 0) transparent++;
      else if (alpha < 255) partial++;
      if (alpha > 2) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  if (!transparent || right < 0)
    throw Error(`${id} 缺少真实透明背景或有效内容`);
  // 只为定位忽略极低透明度噪点；保留8源像素余量，阴影和边缘不做二值化。
  left = Math.max(0, left - 8);
  top = Math.max(0, top - 8);
  right = Math.min(info.width - 1, right + 8);
  bottom = Math.min(info.height - 1, bottom + 8);
  const crop = { left, top, width: right - left + 1, height: bottom - top + 1 };
  const file = `${root}/${id}.png`;
  await sharp(source)
    .extract(crop)
    .resize({
      width,
      height,
      fit: "contain",
      position: "bottom",
      background: "#00000000",
    })
    .png()
    .toFile(file);
  const output = await sharp(file).metadata();
  const { data: pixels } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  left = width;
  top = height;
  right = -1;
  bottom = -1;
  let min = 255,
    max = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const alpha = pixels[(y * width + x) * 4 + 3];
      min = Math.min(min, alpha);
      max = Math.max(max, alpha);
      if (alpha > 2) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  if (!output.hasAlpha || min !== 0 || max !== 255)
    throw Error(`${id} 运行图透明通道不合格`);
  records.push({
    ID: id,
    文件: `village-polish/${id}.png`,
    源文件: `village-polish/${id}-source.png`,
    用途: purpose,
    来源: "内置 imagegen，实际图片参考；Sharp 保留alpha裁切缩放，完整提示词见 docs/visual-polish/orchard/prompts.json",
    源尺寸: [info.width, info.height],
    源有效裁切: crop,
    源透明像素: transparent,
    源半透明像素: partial,
    尺寸: [output.width, output.height],
    透明通道: output.hasAlpha,
    运行透明度范围: [min, max],
    运行有效边界: { 左: left, 上: top, 右: right, 下: bottom },
    显示尺寸: display,
    锚点: anchor,
    世界坐标: placement,
    碰撞占地: null,
    动画: null,
    是否临时: false,
    透明处理: "保留源alpha及半透明阴影，无白底抠除或棋盘格",
    验证状态: "待运行截图验收",
  });
}
const path = "public/assets/manifest.json";
const manifest = JSON.parse(await readFile(path, "utf8"));
manifest.资源 = [
  ...manifest.资源.filter((r) => !records.some((n) => n.ID === r.ID)),
  ...records,
];
await writeFile(path, JSON.stringify(manifest, null, 2));
await writeFile(
  "docs/visual-polish/orchard/asset-processing.json",
  JSON.stringify(
    {
      说明: "两张独立生成主体；未用几何图形临摹。花床保留210×80地表区域，长椅保留90像素宽度及原落地点；均不新增碰撞。",
      资源: records,
    },
    null,
    2,
  ),
);
console.log("两项正式素材已处理并登记");
