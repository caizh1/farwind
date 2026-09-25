import sharp from "sharp";
import fs from "node:fs/promises";
const root = "public/assets/";
const records = [];
let pixels = 0;
for (const file of (await fs.readdir(root)).filter(
  (f) => f.endsWith(".png") && !f.includes("-source"),
)) {
  const m = await sharp(root + file).metadata();
  pixels += m.width * m.height;
  const id = file.replace(".png", "");
  const character = [
    "hero",
    "cat",
    "elder",
    "healer",
    "carpenter",
    "slime",
    "leaf",
  ].includes(id);
  records.push({
    ID: id,
    文件: file,
    用途: id.startsWith("icon-")
      ? "物品图标"
      : character
        ? "动画角色"
        : ["grass", "road", "forest", "water"].includes(id)
          ? "地表材质"
          : "场景物体",
    来源: "内置图像生成，用户设计图作为风格参考；Sharp 裁切与透明图集处理",
    许可状态: "生成素材，尚未完成商业权利审查",
    尺寸: [m.width, m.height],
    透明通道: m.hasAlpha,
    锚点: ["hero", "cat"].includes(id)
      ? [0.5, 0.96875]
      : id.startsWith("icon-")
        ? [0.5, 0.5]
        : [0.5, 1],
    动画: character
      ? {
          帧尺寸: [128, 128],
          帧数: m.width / 128,
          说明:
            id === "hero"
              ? "四方向各六帧：待机、四帧行走、攻击"
              : id === "cat"
                ? "六帧行走，零帧待机"
                : "居民两帧；敌人四种动作",
        }
      : null,
    是否临时: false,
  });
}
const report = {
  说明: "原始生成图带 -source 后缀，不由运行场景加载。商业权利与最终美术质量分别待复核。运行生成的地表区块、水面及特效见代码。",
  资源: records,
  运行解码纹理估算: {
    素材RGBA字节: pixels * 4,
    地表区块RGBA字节: 3600 * 2200 * 4,
    说明: "保守估算包括物品图标；不含 WebGL 驱动副本、帧缓冲及浏览器缓存。地表按 600×550 区块绘制，不是一张大陆大纹理。",
  },
};
await fs.writeFile(root + "manifest.json", JSON.stringify(report, null, 2));
console.log(
  `登记 ${records.length} 项素材，静态素材解码约 ${((pixels * 4) / 1024 ** 2).toFixed(1)} MiB`,
);
