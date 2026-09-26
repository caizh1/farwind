import sharp from "sharp";
import { writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const directory = "public/assets/animation/sword-wind",
  source = "docs/sword-wind/assets";
let acceptance = { 资源: [] };
try {
  acceptance = JSON.parse(await readFile(`${source}/acceptance.json`, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
// 认可只属于当次实际图集；素材改变后不能自动继承旧认可。
const approved = new Set();
// 每个视角固定同一缩放，不按含剑包围盒缩放；保留原始透明像素，不删除连通区域。
const roots = [[[218,418],[650,418],[1068,418],[229,846],[635,846],[1067,846],[232,1218],[653,1218]],[[212,424],[642,424],[1037,424],[223,826],[633,826],[1052,826],[227,1184],[637,1184]],[[216,416],[648,416],[1049,416],[216,834],[644,834],[1050,834],[217,1209],[628,1209]]];
const columns = Array.from({length:3},()=>Array.from({length:3},()=>[0,440,870,1254]));
const rows = [[0,430,870,1254],[0,435,860,1254],[0,430,860,1254]];
const weapons = [[[180,312,85,406],[575,302,482,338],[1081,320,1182,385],[305,579,385,452],[658,528,627,414],[1145,570,1012,465],[246,1090,366,1020],[700,1060,774,922]],[[309,335,382,399],[568,331,485,366],[1106,307,1174,231],[298,617,381,518],[695,560,713,445],[1107,596,1005,525],[282,1040,357,960],[732,1090,793,1152]],[[174,316,272,394],[570,306,522,364],[1133,335,1245,380],[311,613,398,467],[692,558,711,438],[1073,592,955,490],[287,1060,366,968],[690,1101,808,1163]]];
const hero = [],
  audit = [];
for (let view = 0; view < 3; view++) {
  const file = `hero-${["down", "up", "side"][view]}-rise-source.png`,
    { data, info } = await sharp(`${source}/${file}`)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
  for (let pose = 0; pose < 8; pose++) {
    const cols = 3,
      row = Math.floor(pose / cols),
      col = pose % cols,
      [rx, ry] = roots[view][pose],
      crop = 650,
      raw = Buffer.alloc(crop * crop * 4);
    for (let y = view===0&&row===1&&col===1?407:rows[view][row]; y < rows[view][row + 1]; y++)
      for (
        let x = columns[view][row][col];
        x < columns[view][row][col + 1];
        x++
      ) {
        // 正面第二列鞋底与下一帧剑尖之间有透明间隙；按间隙分格，不丢弃任何可见源像素。
        if(view===0 && col===1){const seam=x>=610&&x<=675?407:430;if(row===0&&y>=seam)continue;if(row===1&&y<seam)continue;}
        const tx = Math.round(x - rx + crop / 2),
          ty = Math.round(y - ry + (crop * 154) / 160);
        if (tx < 0 || tx >= crop || ty < 0 || ty >= crop) {
          if (data[(y * info.width + x) * 4 + 3] > 16)
            throw Error(`${file}姿态${pose}存在裁切`);
          continue;
        }
        data.copy(
          raw,
          (ty * crop + tx) * 4,
          (y * info.width + x) * 4,
          (y * info.width + x) * 4 + 4,
        );
      }
    hero.push({
      input: await sharp(raw, {
        raw: { width: crop, height: crop, channels: 4 },
      })
        .resize(160, 160)
        .png()
        .toBuffer(),
      left: pose * 160,
      top: view * 160,
    });
  }
}
await sharp({
  create: { width: 1280, height: 480, channels: 4, background: "#00000000" },
})
  .composite(hero)
  .png()
  .toFile(`${directory}/hero-sword-wind.png`);
// 效果使用固定源格与固定缩放；命中独立标注真实接触核心。
const effects = [
  ["ground",6,3,512,512,512,[[256,335],[768,335],[1280,335],[256,788],[768,788],[1280,788]]],
  [
    "release",
    4,
    2,
    768,
    512,
    512,
    [
      [400, 256],
      [1180, 256],
      [400, 756],
      [1180, 756],
    ],
  ],
  [
    "flight",
    6,
    3,
    512,
    512,
    512,
    [
      [256, 256],
      [768, 256],
      [1280, 256],
      [256, 768],
      [768, 768],
      [1280, 768],
    ],
  ],
  [
    "hit",
    8,
    4,
    384,
    512,
    768,
    [
      [345, 285],
      [695, 285],
      [990, 282],
      [1390, 282],
      [270, 763],
      [650, 763],
      [1030, 763],
      [1390, 763],
    ],
  ],
  [
    "dissolve",
    4,
    2,
    768,
    512,
    512,
    [
      [380, 256],
      [1150, 256],
      [380, 768],
      [1150, 768],
    ],
  ],
];
for (const [name, count, cols, w, h, crop, anchors] of effects) {
  const { data, info } = await sharp(`${source}/${name}-source.png`)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true }),
    cells = [];
  for (let i = 0; i < count; i++) {
    const raw = Buffer.alloc(crop * crop * 4),
      [rx, ry] = anchors[i],
      col = i % cols,
      row = Math.floor(i / cols);
    for (let y = row * h; y < (row + 1) * h; y++)
      for (let x = col * w; x < (col + 1) * w; x++) {
        const tx = Math.round(x - rx + crop / 2),
          ty = Math.round(y - ry + crop / 2);
        if (tx < 0 || tx >= crop || ty < 0 || ty >= crop) {
          if (data[(y * info.width + x) * 4 + 3] > 16)
            throw Error(`${name}姿态${i}存在裁切`);
          continue;
        }
        data.copy(
          raw,
          (ty * crop + tx) * 4,
          (y * info.width + x) * 4,
          (y * info.width + x) * 4 + 4,
        );
      }
    cells.push({
      input: await sharp(raw, {
        raw: { width: crop, height: crop, channels: 4 },
      })
        .resize(128, 128)
        .png()
        .toBuffer(),
      left: i * 128,
      top: 0,
    });
  }
  await sharp({
    create: {
      width: 128 * count,
      height: 128,
      channels: 4,
      background: "#00000000",
    },
  })
    .composite(cells)
    .png()
    .toFile(`${directory}/sword-wind-${name}.png`);
}
for (const name of [
  "hero-sword-wind",
  ...effects.map((e) => `sword-wind-${e[0]}`),
]) {
  const hash = createHash("sha256").update(await readFile(`${directory}/${name}.png`)).digest("hex");
  if (acceptance.资源.some(entry => entry.ID === name && entry.图集SHA256 === hash)) approved.add(name);
  const size = name.startsWith("hero") ? 160 : 128,
    { data, info } = await sharp(`${directory}/${name}.png`)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
  for (let row = 0; row < info.height / size; row++)
    for (let col = 0; col < info.width / size; col++) {
      let pixels = 0,
        edge = 0;
      const bounds = [size, size, 0, 0];
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++)
          if (
            data[((row * size + y) * info.width + col * size + x) * 4 + 3] > 16
          ) {
            pixels++;
            bounds[0] = Math.min(bounds[0], x);
            bounds[1] = Math.min(bounds[1], y);
            bounds[2] = Math.max(bounds[2], x);
            bounds[3] = Math.max(bounds[3], y);
            if (x === 0 || y === 0 || x === size - 1 || y === size - 1) edge++;
          }
      audit.push({
        图集: name,
        帧: row * (info.width / size) + col,
        有效像素: pixels,
        边界像素: edge,
        可见边界: bounds,
      });
    }
  await sharp(`${directory}/${name}.png`)
    .flatten({ background: "#537459" })
    .png()
    .toFile(`docs/sword-wind/evidence/${name}-contact.png`);
}
await writeFile(
  `${source}/metadata.json`,
  JSON.stringify(
    {
      说明: "内置图像生成；源图保留，不删除连通区域；本文件只记录素材，玩法接入见设计文档",
      临时: true,
      用户美术认可: false,
      认可记录: "acceptance.json；仅摘要一致的资源继承用户视觉认可，整套素材仍包含待验效果",
      已认可图集: [...approved],
      角色: {
        临时: !approved.has("hero-sword-wind"),
        用户美术认可: approved.has("hero-sword-wind"),
        帧尺寸: 160,
        显示尺寸: 145,
        地面根: [80, 154],
        统一源裁切: 650,
        动作: "沉腰低剑、低位加速、上撩释放、高位随挥、收剑",
        来源: ["hero-down-rise-source.png","hero-up-rise-source.png","hero-side-rise-source.png"],
        源根: roots,
        源剑柄剑尖: weapons,
        视角: ["正面", "背面", "右侧面"],
        左向: "仅Actor以局部根镜像",
        帧时刻: [0, 35, 70, 110, 135, 210, 270, 340],
        持续时间: 400,
        释放标记: 110,
        离刃帧: 3,
        离刃锚点: "帧3剑柄至剑尖的百分之三十五处；上撩时风层从刃面展开，地面与上身分别映射",
        刃面比例: 0.35,
        效果接点: [[-40,-23],[26,23],[28,-32]],
      },
      效果: effects.map(([name, count, cols, w, h, crop, anchors]) => ({
        名称: name,
        临时: !approved.has(`sword-wind-${name}`),
        用户美术认可: approved.has(`sword-wind-${name}`),
        帧数: count,
        帧尺寸: 128,
        源格: [w, h],
        源裁切: crop,
        锚点: anchors,
        持续时间:
          name === "release"
            ? 64
            : name === "flight"
              ? 108
              : name === "hit"
                ? 160
                : name === "ground" ? 660 : 96,
        循环区间: name === "flight" ? [0, 5] : null,
        方向变换: { 右: 0, 下: 90, 左: 180, 上: 270 },
      })),
      逐帧检查: audit,
    },
    null,
    2,
  ),
);
console.log("已打包24帧升斩角色及28帧独立效果，审计结果已写入中文元数据");
const samples = weapons.map((view, v) =>
  view.map((p, i) => ({
    grip: {
      x: ((p[0] - roots[v][i][0]) * 145) / 650,
      y: ((p[1] - roots[v][i][1]) * 145) / 650,
    },
    tip: {
      x: ((p[2] - roots[v][i][0]) * 145) / 650,
      y: ((p[3] - roots[v][i][1]) * 145) / 650,
    },
  })),
);
await writeFile(
  "src/data/swordWindArt.ts",
  `// 由 pack-sword-wind.mjs 生成；固定根与统一缩放的武器采样，认可状态来自当前图集摘要。\nexport const SWORD_WIND_HERO_PROVISIONAL = ${!approved.has("hero-sword-wind")};\nexport const SWORD_WIND_WEAPONS = ${JSON.stringify(samples)} as const;\nexport const SWORD_WIND_RELEASES = ${JSON.stringify(samples.map(view=>{const p=view[3];return {x:p.grip.x+(p.tip.x-p.grip.x)*.35,y:p.grip.y+(p.tip.y-p.grip.y)*.35};}))} as const;\n`,
);
const manifest = JSON.parse(
  await readFile("public/assets/manifest.json", "utf8"),
);
const entries = [];
for (const [name, count, size, rows] of [
  ["hero-sword-wind", 24, 160, 3],
  ...effects.map((e) => [`sword-wind-${e[0]}`, e[1], 128, 1]),
]) {
  entries.push({
    ID: name,
    文件: `animation/sword-wind/${name}.png`,
    用途: name === "hero-sword-wind" ? "第四击专用角色动作" : "独立剑风效果",
    来源: "内置图像生成；固定根裁切与统一缩放打包，源图及元数据保留在剑风文档目录",
    尺寸: [(size * count) / rows, size * rows],
    透明通道: true,
    锚点: name === "hero-sword-wind" ? [0.5, 154 / 160] : [0.5, 0.5],
    动画: { 帧尺寸: size, 有效帧: count, 循环: name === "sword-wind-flight" },
    是否临时: !approved.has(name),
    验证状态: approved.has(name)
      ? `固定预览与实机已检查；用户视觉验收通过（${acceptance.确认日期}），不代表音色、手感或设备性能验收`
      : "固定预览与实机已检查；用户美术及音色尚未验收",
  });
}
manifest.资源 = [
  ...manifest.资源.filter((e) => !entries.some((n) => n.ID === e.ID)),
  ...entries,
];
manifest.剑风动作估算 = {
  图集数量: 6,
  有效帧: 52,
  解码RGBA字节: entries.reduce((n, e) => n + e.尺寸[0] * e.尺寸[1] * 4, 0),
  说明: "仅新增六个剑风图集，不含源图或预览；估算不代表设备性能",
};
await writeFile(
  "public/assets/manifest.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
