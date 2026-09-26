import sharp from "sharp";
import { writeFile } from "node:fs/promises";
const directory = "docs/combat-followup/assets";
// 仅分帧核查，不接入运行图集；没有按透明包围盒改变比例。
for (let i = 0; i < 4; i++) {
  await sharp(`${directory}/side-settle-candidate.png`)
    .extract({ left: i * 543, top: 0, width: 543, height: 724 })
    .png()
    .toFile(`${directory}/side-settle-${i}.png`);
}
await writeFile(
  `${directory}/candidate-metadata.json`,
  JSON.stringify(
    {
      状态: "未通过样板核查，不接入游戏",
      生成方式: "内置 image_gen，参考现有侧向六姿态和已通过走跑图集",
      资源尺寸: [2172, 724],
      分帧尺寸: [543, 724],
      基础朝向: "右",
      裁切偏移: [
        [0, 0],
        [543, 0],
        [1086, 0],
        [1629, 0],
      ],
      角色地面根: "尚未校准；拒绝前不设运行缩放或伪造精确锚点",
      未通过原因: [
        "首帧剑位没有接上现有攻击末帧",
        "头身与线稿存在差异",
        "需要先通过横向单刀正常速度样板，不能扩展其余方向",
      ],
    },
    null,
    2,
  ),
);
