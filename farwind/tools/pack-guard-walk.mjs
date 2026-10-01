import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

// 原行走帧与新绘制的反向迈步帧交替；这里只做裁切、等比缩放和地面根对齐。
const source = "public/assets/village-defense/m3/guard-source.png";
const opposite = ["front", "back", "side"].map(
  (direction) => `docs/npc-life/locomotion/sources/guard-${direction}-opposite.png`,
);
const output = "public/assets/village-defense/m3/guard-walk.png";
const size = 160;
const footY = 148;

function bounds(data, width, height) {
  let left = width, right = -1, top = height, bottom = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3] > 8) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
  if (right < left) throw Error("卫兵素材出现空帧");
  let sum = 0, weight = 0;
  for (let y = top; y <= top + (bottom - top) * 0.22; y++)
    for (let x = left; x <= right; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 8) { sum += x * alpha; weight += alpha; }
    }
  return { left, top, width: right - left + 1, height: bottom - top + 1, headX: sum / weight };
}

const frames = [], records = [];
for (let row = 0; row < 3; row++) {
  for (let col = 0; col < 2; col++) {
    const file = col ? opposite[row] : source;
    const original = sharp(file);
    const meta = await original.metadata();
    const region = col
      ? { left: 0, top: 0, width: meta.width, height: meta.height }
      : { left: 256, top: [0, 341, 683][row], width: 256, height: [341, 342, 341][row] };
    const { data, info } = await sharp(file).extract(region).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const box = bounds(data, info.width, info.height);
    const scale = 128 / box.height;
    const width = Math.round(box.width * scale), height = Math.round(box.height * scale);
    const left = Math.round(80 - (box.headX - box.left) * scale), top = footY - height;
    if (left < 3 || left + width > size - 3 || top < 3)
      throw Error(`卫兵第${row * 2 + col + 1}帧越过安全边界`);
    const cropped = await sharp(file).extract({
      left: region.left + box.left, top: region.top + box.top,
      width: box.width, height: box.height,
    }).resize(width, height).png().toBuffer();
    const frame = await sharp({ create: {
      width: size, height: size, channels: 4, background: "#00000000",
    } }).composite([{ input: cropped, left, top }]).png().toBuffer();
    frames.push({ input: frame, left: col * size, top: row * size });
    records.push({ 朝向: ["朝前", "朝后", "朝右"][row], 步相: col ? "另一只脚迈步" : "原有迈步",
      来源: file, 摘要: createHash("sha256").update(frame).digest("hex") });
  }
}
await sharp({ create: { width: 320, height: 480, channels: 4, background: "#00000000" } })
  .composite(frames).png().toFile(output);
const manifestFile = "docs/npc-life/locomotion/manifest.json";
const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
manifest.说明 = "四套居民与弓手图集，加近战卫兵三个朝向的左右脚交替帧；最终美术仍待用户验收。左右只由Actor镜像。";
manifest.资源 = manifest.资源.filter((item) => item.ID !== "defender-guard-walk");
manifest.资源.push({ ID: "defender-guard-walk", 人物: "近战卫兵", 文件: output,
  帧尺寸: [160, 160], 帧数: 6, 地面根: [80, footY], 帧: records,
  来源: "原卫兵行走帧与内置imagegen生成的反向迈步帧；Sharp仅裁切、等比缩放和对齐", 是否临时: true });
await writeFile(manifestFile, JSON.stringify(manifest, null, 2) + "\n");
const globalFile = "public/assets/manifest.json";
const global = JSON.parse(await readFile(globalFile, "utf8"));
global.资源 = global.资源.filter((item) => item.ID !== "defender-guard-walk");
global.资源.push({ ID: "defender-guard-walk", 文件: output.replace("public/assets/", ""),
  尺寸: [320, 480], 透明通道: true, 动画: { 帧数: 6, 帧尺寸: [160, 160], 地面根: [80, footY] },
  来源: "原卫兵行走帧与内置imagegen生成的反向迈步帧", 是否临时: true });
await writeFile(globalFile, JSON.stringify(global, null, 2) + "\n");
console.log("已打包近战卫兵三个朝向的左右脚交替步相。");
