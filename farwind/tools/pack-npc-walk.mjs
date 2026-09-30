import sharp from "sharp";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";

// 只切分、等比缩放与对齐生成姿态；不靠旋转、拉伸或复制站立帧伪造走路。
const root = "docs/npc-life/locomotion",
  out = "public/assets/npc-life/motion";
const names = {
  archer: "弓手",
  elder: "岚爷爷",
  healer: "小满",
  carpenter: "阿禾",
};
const frameSize = 160,
  footY = 148,
  columns = 7;
const requested = process.argv.slice(2),
  ids = requested.length ? requested : Object.keys(names);
if (ids.some((id) => !names[id])) throw Error("包含未知人物");
await mkdir(out, { recursive: true });
const records = [];

function cuts(data, width, height, axis, count) {
  const size = axis ? height : width,
    counts = Array(size).fill(0);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3] > 8) counts[axis ? y : x]++;
  const edges = [0];
  for (let i = 1; i < count; i++) {
    const ideal = (size * i) / count,
      radius = (size / count) * 0.22;
    let best = Math.round(ideal);
    for (let p = Math.floor(ideal - radius); p <= ideal + radius; p++)
      if (
        counts[p] < counts[best] ||
        (counts[p] === counts[best] &&
          Math.abs(p - ideal) < Math.abs(best - ideal))
      )
        best = p;
    if (counts[best]) throw Error("人物跨越格子边界，需要修正源图间距");
    edges.push(best);
  }
  return [...edges, size];
}
function bounds(data, width, height) {
  let left = width,
    right = -1,
    top = height,
    bottom = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3] > 8) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
  if (right < left) throw Error("出现空人物帧");
  let sum = 0,
    weight = 0;
  // 用头部中心固定躯干横轴；持弓、篮子和抬起的脚不能带动整个人左右跳。
  for (let y = top; y <= top + (bottom - top) * 0.22; y++)
    for (let x = left; x <= right; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 8) {
        sum += x * alpha;
        weight += alpha;
      }
    }
  return {
    left,
    top,
    width: right - left + 1,
    height: bottom - top + 1,
    headX: sum / weight,
  };
}
for (const id of ids) {
  const source = `${root}/sources/${id}-walk-source.png`,
    { data, info } = await sharp(source)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
  let clear = 0;
  for (let i = 3; i < data.length; i += 4) clear += data[i] === 0 ? 1 : 0;
  if (clear / info.width / info.height < 0.3)
    throw Error(`${names[id]}缺少真实透明背景`);
  const ys = cuts(data, info.width, info.height, 1, 3),
    cells = [];
  for (let row = 0; row < 3; row++) {
    const stripHeight = ys[row + 1] - ys[row],
      strip = await sharp(source)
        .extract({
          left: 0,
          top: ys[row],
          width: info.width,
          height: stripHeight,
        })
        .ensureAlpha()
        .raw()
        .toBuffer(),
      xs = cuts(strip, info.width, stripHeight, 0, columns);
    for (let col = 0; col < columns; col++) {
      const box = {
          left: xs[col],
          top: ys[row],
          width: xs[col + 1] - xs[col],
          height: stripHeight,
        },
        raw = await sharp(source).extract(box).ensureAlpha().raw().toBuffer();
      cells.push({ box, tight: bounds(raw, box.width, box.height) });
    }
  }
  const scale = 128 / cells[0].tight.height,
    frames = [],
    hashes = [],
    frameRecords = [];
  for (const [i, { box, tight }] of cells.entries()) {
    const width = Math.round(tight.width * scale),
      height = Math.round(tight.height * scale),
      left = Math.round(80 - (tight.headX - tight.left) * scale),
      top = footY - height;
    if (left < 3 || left + width > 157 || top < 3)
      throw Error(`${names[id]}第${i + 1}帧越过安全边界`);
    const input = await sharp(source)
        .extract({
          left: box.left + tight.left,
          top: box.top + tight.top,
          width: tight.width,
          height: tight.height,
        })
        .resize(width, height)
        .png()
        .toBuffer(),
      frame = await sharp({
        create: {
          width: frameSize,
          height: frameSize,
          channels: 4,
          background: "#00000000",
        },
      })
        .composite([{ input, left, top }])
        .png()
        .toBuffer(),
      hash = createHash("sha256").update(frame).digest("hex");
    hashes.push(hash);
    frames.push({
      input: frame,
      left: (i % columns) * frameSize,
      top: Math.floor(i / columns) * frameSize,
    });
    frameRecords.push({
      帧: i,
      朝向: ["朝前", "朝后", "朝右"][Math.floor(i / columns)],
      动作: i % columns ? `行走第${i % columns}帧` : "站稳",
      源格: box,
      裁切: tight,
      摘要: hash,
    });
  }
  if (new Set(hashes).size !== 21) throw Error(`${names[id]}存在重复姿态`);
  const file = `${out}/${id}-walk.png`;
  await sharp({
    create: {
      width: columns * frameSize,
      height: 3 * frameSize,
      channels: 4,
      background: "#00000000",
    },
  })
    .composite(frames)
    .png()
    .toFile(file);
  records.push({
    ID: `npc-motion-${id}`,
    人物: names[id],
    文件: file,
    源文件: source,
    帧尺寸: [160, 160],
    帧数: 21,
    站立帧: 3,
    行走帧: 18,
    地面根: [80, footY],
    统一缩放: scale,
    帧: frameRecords,
    来源: "内置imagegen，保持现有人物身份；Sharp仅切分、等比缩放和地面根对齐",
    是否临时: true,
  });
}
const manifestFile = `${root}/manifest.json`;
let previous = [];
try {
  previous = JSON.parse(await readFile(manifestFile, "utf8")).资源;
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const resources = [
  ...previous.filter((r) => !records.some((n) => n.ID === r.ID)),
  ...records,
];
await writeFile(
  manifestFile,
  JSON.stringify(
    {
      说明: "四种人物的真实步态补齐；最终美术仍待用户验收。左右只由Actor镜像。",
      资源: resources,
    },
    null,
    2,
  ) + "\n",
);
const globalFile = "public/assets/manifest.json",
  global = JSON.parse(await readFile(globalFile, "utf8"));
global.资源 = [
  ...global.资源.filter((r) => !records.some((n) => n.ID === r.ID)),
  ...records.map((r) => ({
    ID: r.ID,
    文件: r.文件.replace("public/assets/", ""),
    尺寸: [1120, 480],
    透明通道: true,
    动画: { 帧数: 21, 帧尺寸: [160, 160], 地面根: [80, 148] },
    来源: r.来源,
    是否临时: true,
  })),
];
await writeFile(globalFile, JSON.stringify(global, null, 2) + "\n");
console.log(
  `已打包${records.length}种人物，每种三个朝向、六帧步态与独立站立帧。`,
);
