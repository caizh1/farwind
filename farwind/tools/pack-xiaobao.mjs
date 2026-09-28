import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";

// 只做确定性裁切、等比缩放和根对齐，不重绘已认可的人物身份。
const sources = "docs/xiaobao/art/sources", output = "public/assets/xiaobao";
const frameSize = 160, footY = 148, records = [];
for (const [id, source] of [["motion", "motion"], ["social", "social-fixed"], ["mastery", "mastery"]]) {
  const file = `${sources}/${source}-source.png`;
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const total = info.width * info.height, seen = new Uint8Array(total), queue = new Int32Array(total), bodies = [];
  // 生成器的格距有偏差，按连通主体切分，避免256等距裁切割掉鞋或头。
  for (let p = 0; p < total; p++) {
    if (seen[p] || data[p * 4 + 3] < 32) continue;
    let head = 0, tail = 1, left = info.width, top = info.height, right = 0, bottom = 0;
    seen[p] = 1; queue[0] = p;
    while (head < tail) {
      const n = queue[head++], x = n % info.width, y = Math.floor(n / info.width);
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
      for (const k of [x > 0 ? n - 1 : -1, x + 1 < info.width ? n + 1 : -1, y > 0 ? n - info.width : -1, y + 1 < info.height ? n + info.width : -1]) {
        if (k >= 0 && !seen[k] && data[k * 4 + 3] >= 32) { seen[k] = 1; queue[tail++] = k; }
      }
    }
    if (tail > 4000) bodies.push({ left, top, right, bottom });
  }
  if (bodies.length !== 24) throw Error(`${id}必须包含24个独立主体，实际${bodies.length}个，需修正源图间距`);
  bodies.sort((a, b) => a.top - b.top);
  const ordered = [];
  for (let row = 0; row < 4; row++) ordered.push(...bodies.slice(row * 6, row * 6 + 6).sort((a, b) => a.left - b.left));
  // 每套原图只采用一个尺度；盘腿、躬身或跳跃不能逐帧被放大。
  const neutral = ordered[0], scale = 104 / (neutral.bottom - neutral.top + 1), composite = [];
  const bounds = ordered.map((b) => ({ left: Math.max(0, b.left - 2), top: Math.max(0, b.top - 2), width: Math.min(info.width - Math.max(0, b.left - 2), b.right - b.left + 5), height: Math.min(info.height - Math.max(0, b.top - 2), b.bottom - b.top + 5) }));
  for (let i = 0; i < bounds.length; i++) {
    const b = bounds[i], body = ordered[i];
    let sum = 0, weight = 0;
    for (let y = body.bottom - 10; y <= body.bottom; y++) for (let x = body.left; x <= body.right; x++) {
      const alpha = data[(y * info.width + x) * 4 + 3];
      if (alpha > 32) { sum += x * alpha; weight += alpha; }
    }
    const width = Math.round(b.width * scale), height = Math.round(b.height * scale);
    const left = Math.round(frameSize / 2 - (sum / weight - b.left) * scale), top = footY - height;
    if (left < 4 || left + width > frameSize - 4 || top < 4) throw Error(`${id}第${i + 1}帧越出安全边界`);
    const input = await sharp(file).extract(b).resize(width, height).png().toBuffer();
    composite.push({ input, left: (i % 6) * frameSize + left, top: Math.floor(i / 6) * frameSize + top });
  }
  await sharp({ create: { width: 960, height: 640, channels: 4, background: "#00000000" } }).composite(composite).png().toFile(`${output}/${id}.png`);
  records.push({ 图集: id, 原图: file, 原图尺寸: [info.width, info.height], 运行文件: `${output}/${id}.png`, 帧尺寸: [160, 160], 帧数: 24, 地面根: [80, footY], 统一缩放: scale, 切分: bounds });
}
await sharp(`${sources}/concept-source.png`).resize({ width: 560 }).webp({ quality: 94 }).toFile(`${output}/portrait.webp`);
await writeFile(`${output}/manifest.json`, JSON.stringify({ 说明: "用户已认可身份原画；动作图集仍待用户美术验收。原照片不随游戏分发。透明通道原样保留。", 来源: "内置imagegen，Sharp仅裁切、等比缩放与脚底对齐", 资源: records }, null, 2) + "\n");
const manifest = JSON.parse(await readFile("public/assets/manifest.json", "utf8"));
const entries = records.map((r) => ({ ID: `xiaobao-${r.图集}`, 文件: `xiaobao/${r.图集}.png`, 尺寸: [960, 640], 透明通道: true, 动画: { 帧数: 24, 帧尺寸: [160, 160], 地面根: [80, footY] }, 来源: "内置imagegen，中文提示词保留于docs/xiaobao/art/prompts.md", 是否临时: true }));
entries.push({ ID: "dialogue-xiaobao", 文件: "xiaobao/portrait.webp", 尺寸: [560, 840], 透明通道: true, 动画: null, 来源: "用户已认可的内置imagegen人物原画", 是否临时: false });
manifest.资源 = [...manifest.资源.filter((r) => !entries.some((e) => e.ID === r.ID)), ...entries];
await writeFile("public/assets/manifest.json", JSON.stringify(manifest, null, 2) + "\n");
console.log("小宝三套图集已打包：12组动作，72帧，透明背景与固定地面根。");
