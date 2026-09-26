import sharp from "sharp";
import { readFile, writeFile, mkdir } from "node:fs/promises";
const root = "public/assets/village-polish";
await mkdir(root, { recursive: true });
const records = [];
for (const [id, file, width, height, display, anchor, foot] of [
  [
    "carpenter-workbench",
    "carpenter-workbench",
    351,
    198,
    [117, 66],
    [0.5, 1],
    null,
  ],
  ["fountain", "plaza-fountain", 390, 390, [130, 130], [0.5, 1], [100, 45]],
  ["pond-water", "pond-water", 1040, 920, [520, 460], [0, 0], null],
]) {
  const source = `${root}/${file}-source.png`;
  const meta = await sharp(source).metadata();
  let crop = { left: 0, top: 0, width: meta.width, height: meta.height };
  let transparent = 0,
    partial = 0;
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let minAlpha = 255,
    maxAlpha = 0;
  for (let i = 3; i < data.length; i += 4) {
    const a = data[i];
    minAlpha = Math.min(minAlpha, a);
    maxAlpha = Math.max(maxAlpha, a);
    if (a === 0) transparent++;
    if (a > 0 && a < 255) partial++;
  }
  if (id !== "pond-water") {
    let l = info.width,
      t = info.height,
      r = 0,
      b = 0;
    for (let y = 0; y < info.height; y++)
      for (let x = 0; x < info.width; x++) {
        const a = data[(y * info.width + x) * 4 + 3];
        if (a > 2) {
          l = Math.min(l, x);
          t = Math.min(t, y);
          r = Math.max(r, x);
          b = Math.max(b, y);
        }
      }
    if (!transparent) throw Error(`${file} 无真实透明背景`);
    // 忽略alpha≤2的画布噪点定位；向外保留8像素，不二值化半透明水花/阴影。
    l = Math.max(0, l - 8);
    t = Math.max(0, t - 8);
    r = Math.min(info.width - 1, r + 8);
    b = Math.min(info.height - 1, b + 8);
    crop = { left: l, top: t, width: r - l + 1, height: b - t + 1 };
  }
  let pipeline = sharp(source).extract(crop);
  // 整片水底必须不透明，去除生成器意外给出的全图半透明，保留RGB笔触。
  if (id === "pond-water") pipeline = pipeline.removeAlpha();
  const resized = await pipeline
    .resize({
      width,
      height,
      fit: id === "pond-water" ? "fill" : "contain",
      position: "bottom",
      background: "#00000000",
    })
    .png()
    .toBuffer();
  await writeFile(`${root}/${file}.png`, resized);
  const output = await sharp(resized).metadata();
  const { data: pixels, info: dimensions } = await sharp(resized)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let l = dimensions.width,
    t = dimensions.height,
    r = 0,
    b = 0,
    min = 255,
    max = 0;
  for (let y = 0; y < dimensions.height; y++)
    for (let x = 0; x < dimensions.width; x++) {
      const a = pixels[(y * dimensions.width + x) * 4 + 3];
      min = Math.min(min, a);
      max = Math.max(max, a);
      if (a > 2) {
        l = Math.min(l, x);
        t = Math.min(t, y);
        r = Math.max(r, x);
        b = Math.max(b, y);
      }
    }
  if (id === "pond-water" && min !== 255) throw Error("池水底图应完全不透明");
  records.push({
    运行透明度范围: [min, max],
    运行有效边界: { 左: l, 上: t, 右: r, 下: b },
    ID: id,
    文件: `village-polish/${file}.png`,
    源文件: `village-polish/${file}-source.png`,
    用途:
      id === "pond-water" ? "池塘整片底图，独立于森林溪流" : "正式手绘场景物体",
    来源: "内置 imagegen，输入项目设计图、房屋、手绘桥梁；Sharp 可复现裁切缩放",
    尺寸: [output.width, output.height],
    源尺寸: [meta.width, meta.height],
    源有效裁切: crop,
    透明通道: output.hasAlpha,
    源透明度范围: [minAlpha, maxAlpha],
    源透明像素: transparent,
    源半透明像素: partial,
    显示尺寸: display,
    锚点: anchor,
    碰撞占地: foot,
    动画: id === "fountain" ? "主体静态，池内两处轻微扩散涟漪" : null,
    是否临时: false,
    透明处理:
      id === "pond-water"
        ? "去除全图半透明，保留原RGB，运行底图不透明"
        : "保留源alpha，含水花和阴影",
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
  "docs/visual-polish/asset-processing.json",
  JSON.stringify(
    {
      说明: "源图均为内置生成图片，未使用几何主体替代；裁切缩放保留alpha，不额外抠图；池水无重复平铺，不需要新3×3平铺图。",
      资源: records,
    },
    null,
    2,
  ),
);
console.log("三项正式资产已处理和登记，等待运行验收");
