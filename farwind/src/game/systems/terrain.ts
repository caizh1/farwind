import { TRAINING } from "./training";
import Phaser from "phaser";
import {
  roads,
  roadWidth,
  WORLD,
  POND,
  BRIDGES,
  villageAreas,
  canDecorate,
  shoreFlowers,
  inReworkArea,
  inVillageDecorArea,
  showLayoutLabels,
} from "../../data/world";
import type { World } from "../scenes/World";

export function makeTerrain(this: World) {
  // 候选手绘门只在资源层切帧，柱脚与横梁各自排序，门洞不产生矩形碰撞。
  const gate = this.textures.get("village-gate");
  gate.add("west", 0, 0, 0, 310, 1211);
  gate.add("east", 0, 1000, 0, 299, 1211);
  gate.add("beam", 0, 310, 0, 690, 420);
  this.textures.get("fence").add("boundary",0,0,120,274,186);
  this.textures.get("vertical-fence").add("trim",0,380,67,169,1446);
  const grass = this.textures.get("grass").getSourceImage() as HTMLImageElement,
    forest = this.textures.get("forest").getSourceImage() as HTMLImageElement,
    road = this.textures.get("road").getSourceImage() as HTMLImageElement,
    earth = this.textures
      .get("packed-earth")
      .getSourceImage() as HTMLImageElement,
    bridge = this.textures.get("bridge").getSourceImage() as HTMLImageElement,
    herb = this.textures.get("herb").getSourceImage() as HTMLImageElement,
    rock = this.textures.get("rock").getSourceImage() as HTMLImageElement,
    pond = this.textures.get("pond-water").getSourceImage() as HTMLImageElement,
    flowerBed = this.textures.get("orchard-flower-bed").getSourceImage() as HTMLImageElement;
  const groundKeys: string[] = [];
  this.events.once("shutdown", () => groundKeys.forEach(key => this.textures.remove(key)));
  for (let cy = 0; cy < WORLD.height; cy += 550)
    for (let cx = 0; cx < WORLD.width; cx += 600) {
      const key = `ground-${cx}-${cy}`,
        texture = this.textures.createCanvas(key, 600, 550)!;
      groundKeys.push(key);
      const c = texture.context;
      c.translate(-cx, -cy);
      const gp = c.createPattern(grass, "repeat")!;
      gp.setTransform(new DOMMatrix().scale(0.6));
      const rp = c.createPattern(road, "repeat")!;
      rp.setTransform(new DOMMatrix().scale(0.25));
      c.fillStyle = gp;
      c.fillRect(cx, cy, 600, 550);
      c.save();
      const fp = c.createPattern(forest, "repeat")!;
      fp.setTransform(new DOMMatrix().scale(0.6));
      c.fillStyle = fp;
      c.fillRect(2100, 0, 1200, WORLD.height);
      for (let band = 0; band < 12; band++) {
        c.globalAlpha = band / 12;
        c.fillRect(1860 + band * 20, 0, 20, 2200);
      }
      c.restore();
      {
        c.fillStyle = rp;
        c.fillRect(WORLD.ruins, 0, WORLD.width - WORLD.ruins, WORLD.height);
        c.fillStyle = "#64817465";
        c.fillRect(WORLD.ruins, 0, WORLD.width - WORLD.ruins, WORLD.height);
      }
      c.beginPath();
      c.moveTo(2620, 650);
      c.bezierCurveTo(2540, 850, 2700, 1250, 2570, 1580);
      c.strokeStyle = "#bab18b";
      c.lineWidth = 92;
      c.stroke();
      c.strokeStyle = c.createPattern(
        this.textures.get("water").getSourceImage() as HTMLImageElement,
        "repeat",
      )!;
      c.lineWidth = 68;
      c.stroke();
      c.lineCap = "round";
      c.lineJoin = "round";
      // 全部外轮廓先画，随后全部路面覆盖，交叉点内部没有后画的描边。
      for (const outline of [true, false]) {
        for (const [index, path] of roads.entries()) {
          c.beginPath();
          path.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
          c.strokeStyle = outline ? "#9f9d62" : rp;
          c.lineWidth = roadWidth(index) + (outline ? 15 : 0);
          c.stroke();
        }
        if (outline) {
          c.beginPath();
          c.ellipse(670, 760, 245, 150, 0, 0, Math.PI * 2);
          c.fillStyle = rp;
          c.fill();
          c.strokeStyle = "#b1a06b";
          c.lineWidth = 6;
          c.stroke();
        }
      }
      c.beginPath();
      c.ellipse(TRAINING.x, TRAINING.y, 76, 52, 0, 0, Math.PI * 2);
      c.fillStyle = "#b2a16a88";
      c.fill();
      // 草地中的夯土边缘略有起伏，低饱和土色上叠手绘土粒，不铺石板。
      const soil = c.createPattern(earth, "repeat")!;
      soil.setTransform(new DOMMatrix().scale(0.32));
      c.save();
      c.beginPath();
      c.moveTo(1430, 343);
      c.bezierCurveTo(1530, 327, 1760, 342, 1876, 340);
      c.bezierCurveTo(1890, 440, 1875, 605, 1883, 715);
      c.quadraticCurveTo(1780, 736, 1660, 723);
      c.quadraticCurveTo(1540, 738, 1422, 717);
      c.bezierCurveTo(1406, 612, 1428, 466, 1418, 367);
      c.closePath();
      c.clip();
      c.fillStyle = "#b69b70";
      c.fillRect(1400, 330, 500, 410);
      c.globalAlpha = 0.6;
      c.fillStyle = soil;
      c.fillRect(1400, 330, 500, 410);
      c.restore();
      // 院内仅是门前与药床旁磨出的土，保留草地，不铺满方形石路。
      c.save();
      c.beginPath();
      c.moveTo(1060, 406);
      c.bezierCurveTo(1150, 403, 1200, 473, 1188, 540);
      c.quadraticCurveTo(1178, 610, 1120, 650);
      c.quadraticCurveTo(1060, 632, 1034, 570);
      c.bezierCurveTo(1010, 510, 1010, 443, 1060, 406);
      c.closePath();
      c.globalAlpha = 0.42;
      c.fillStyle = soil;
      c.fill();
      c.restore();
      // 低矮花床保持地面装饰和原区域，所有区块从同一世界坐标采样。
      c.drawImage(flowerBed, 230, 1480, 210, 80);
      for (let i = 0; i < 4; i++) {
        c.fillStyle = "#8b6541";
        c.fillRect(200 + i * 17, 1070, 12, 40);
      }
      // 地面→岸底→整片池水→浅水过渡→荷叶→桥，角色仍按落地点独立排序。
      c.beginPath();
      for (let i = 0; i <= 96; i++) {
        const a = i / 96 * Math.PI * 2,
          edge = 10 + Math.sin(a * 7) * 2 + Math.sin(a * 13) * 1.8,
          x = POND.x + Math.cos(a) * (POND.rx + edge),
          y = POND.y + Math.sin(a) * (POND.ry + edge);
        if (i) c.lineTo(x, y); else c.moveTo(x, y);
      }
      c.closePath();
      c.fillStyle = "#b2b57e";
      c.fill();
      c.save();
      c.beginPath();
      c.ellipse(POND.x, POND.y, POND.rx, POND.ry, 0, 0, Math.PI * 2);
      c.clip();
      // 每个区块都从同一世界矩形采样，既不重复也不重新起算相位。
      c.drawImage(pond, POND.x - POND.rx, POND.y - POND.ry, POND.rx * 2, POND.ry * 2);
      for (const [inset, alpha] of [[2, 0.22], [5, 0.12], [8, 0.06]]) {
        c.beginPath();
        c.ellipse(POND.x, POND.y, POND.rx - inset, POND.ry - inset, 0, 0, Math.PI * 2);
        c.strokeStyle = `rgba(176,204,163,${alpha})`;
        c.lineWidth = 5;
        c.stroke();
      }
      c.restore();
      // 少量沿岸旧素材打散机械椭圆；只改装饰，不改变池水和桥的逻辑边界。
      for (const [i, a] of [0.1, 0.5, 0.9, 1.5, 2.1, 2.6, 3.6, 4.2, 4.65, 5.3, 5.85].entries()) {
        const x = POND.x + Math.cos(a) * (POND.rx + 7),
          y = POND.y + Math.sin(a) * (POND.ry + 7);
        if (BRIDGES.some(b => x > b.x - 12 && x < b.x + b.w + 12 && y > b.y - 12 && y < b.y + b.h + 12)) continue;
        c.drawImage(i % 2 ? herb : rock, x - 8, y - 10, 16, 15);
      }
      for (let i = 0; i < 18; i++) {
        const a = i * 2.4,
          x = POND.x + Math.cos(a) * (180 + (i % 4) * 9),
          y = POND.y + Math.sin(a) * 155;
        c.fillStyle = "#719c5a";
        c.beginPath();
        c.ellipse(x, y, 10, 5, 0, 0, 7);
        c.fill();
        if (i % 3 === 0) {
          c.fillStyle = "#f2b6bc";
          c.fillRect(x - 3, y - 5, 6, 5);
        }
      }
      for (const b of BRIDGES) {
        // 透明桥素材横向存放，裁掉画布留白后转为原来的南北桥轴线。
        c.save();
        c.translate(b.x + b.w / 2, b.y + b.h / 2);
        c.rotate(Math.PI / 2);
        c.drawImage(
          bridge,
          0,
          92,
          1983,
          601,
          -b.h / 2,
          -(b.w + 8) / 2,
          b.h,
          b.w + 8,
        );
        c.restore();
      }
      // 沿湖岸与主路之外点缀花簇，避免覆盖通行信息。
      for (const { x, y, pink } of shoreFlowers) {
        if (inReworkArea(x, y)) {
          c.drawImage(herb, x - 12, y - 19, 24, 24);
          continue;
        }
        c.fillStyle = "#668b43";
        c.fillRect(x, y, 8, 8);
        c.fillStyle = pink ? "#efb0ac" : "#f1d18d";
        c.fillRect(x + 2, y - 3, 4, 5);
      }
      c.fillStyle = "#496c4030";
      for (let i = 0; i < 45; i++) {
        const x = cx + ((i * 137) % 600),
          y = cy + ((i * 79) % 550);
        if ((inReworkArea(x, y) || inVillageDecorArea(x, y)) && !canDecorate(x, y, 7)) continue;
        c.beginPath();
        c.ellipse(x, y, 7, 2, 0.4, 0, 7);
        c.fill();
      }
      texture.refresh();
      this.add.image(cx, cy, key).setOrigin(0).setDepth(-20);
    }
  const debug = showLayoutLabels(import.meta.env.DEV, window.location.search);
  this.data.set("layoutLabelCount", debug ? villageAreas.length : 0);
  if (debug)
    villageAreas.forEach((area) => {
      this.add
        .text(
          area.x,
          area.y + (area.id === "A" ? 180 : 90),
          `${area.id}  ${area.name}`,
          {
            fontFamily: "serif",
            fontSize: "18px",
            color: "#fff4cf",
            stroke: "#375a3c",
            strokeThickness: 4,
            backgroundColor: "#294f3ac0",
            padding: { x: 9, y: 5 },
          },
        )
        .setOrigin(0.5)
        .setDepth(1900);
    });
}
