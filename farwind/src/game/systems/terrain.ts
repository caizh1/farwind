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
  showLayoutLabels,
} from "../../data/world";
import type { World } from "../scenes/World";

export function makeTerrain(this: World) {
  // 候选手绘门只在资源层切帧，柱脚与横梁各自排序，门洞不产生矩形碰撞。
  const gate = this.textures.get("village-gate");
  gate.add("west", 0, 0, 0, 310, 1211);
  gate.add("east", 0, 1000, 0, 299, 1211);
  gate.add("beam", 0, 310, 0, 690, 420);
  const fountain = this.textures.createCanvas("fountain", 150, 150)!;
  const fc = fountain.context;
  const ellipse = (
    x: number,
    y: number,
    rx: number,
    ry: number,
    color: string,
  ) => {
    fc.beginPath();
    fc.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    fc.fillStyle = color;
    fc.fill();
  };
  ellipse(75, 120, 70, 26, "#4f655950");
  ellipse(75, 113, 64, 29, "#7b8173");
  ellipse(75, 105, 64, 29, "#d0c6a0");
  ellipse(75, 105, 51, 21, "#59999b");
  ellipse(75, 104, 42, 15, "#85bbad");
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    fc.strokeStyle = "#929784";
    fc.lineWidth = 2;
    fc.beginPath();
    fc.moveTo(75 + Math.cos(a) * 53, 105 + Math.sin(a) * 23);
    fc.lineTo(75 + Math.cos(a) * 64, 105 + Math.sin(a) * 29);
    fc.stroke();
  }
  fc.fillStyle = "#9ca38f";
  fc.fillRect(65, 57, 20, 51);
  fc.fillStyle = "#dad1ad";
  fc.fillRect(66, 57, 7, 49);
  ellipse(75, 60, 29, 12, "#777f70");
  ellipse(75, 55, 30, 11, "#d5cda9");
  ellipse(75, 54, 24, 7, "#79b9b4");
  fc.strokeStyle = "#d6f0de";
  fc.lineWidth = 3;
  fc.beginPath();
  fc.moveTo(75, 53);
  fc.quadraticCurveTo(67, 14, 57, 48);
  fc.moveTo(75, 53);
  fc.quadraticCurveTo(86, 12, 95, 48);
  fc.moveTo(75, 55);
  fc.lineTo(75, 24);
  fc.stroke();
  for (const x of [48, 98]) {
    fc.fillStyle = "#bce1d3";
    fc.fillRect(x, 60, 3, 37);
  }
  fountain.refresh();
  const grass = this.textures.get("grass").getSourceImage() as HTMLImageElement,
    forest = this.textures.get("forest").getSourceImage() as HTMLImageElement,
    road = this.textures.get("road").getSourceImage() as HTMLImageElement,
    earth = this.textures
      .get("packed-earth")
      .getSourceImage() as HTMLImageElement,
    bridge = this.textures.get("bridge").getSourceImage() as HTMLImageElement,
    herb = this.textures.get("herb").getSourceImage() as HTMLImageElement;
  for (let cy = 0; cy < WORLD.height; cy += 550)
    for (let cx = 0; cx < WORLD.width; cx += 600) {
      const key = `ground-${cx}-${cy}`,
        texture = this.textures.createCanvas(key, 600, 550)!;
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
      // 保留范围外的果园花床与木工台。
      for (const [x, y, w, h] of [[230, 1480, 210, 80]]) {
        c.fillStyle = "#84613c";
        c.fillRect(x, y, w, h);
        for (let row = 0; row < h; row += 24) {
          c.fillStyle = "#b29259";
          c.fillRect(x + 5, y + row, w - 10, 7);
          for (let col = 10; col < w; col += 23) {
            c.fillStyle = "#5b823a";
            c.fillRect(x + col, y + row + 9, 9, 9);
            c.fillStyle = x < 500 ? "#f1b6ab" : "#a1bb62";
            c.fillRect(x + col + 2, y + row + 8, 4, 4);
          }
        }
      }
      c.fillStyle = "#745436";
      c.fillRect(360, 940, 105, 35);
      c.fillStyle = "#c19a60";
      c.fillRect(354, 930, 117, 25);
      for (let i = 0; i < 4; i++) {
        c.fillStyle = "#8b6541";
        c.fillRect(200 + i * 17, 1070, 12, 40);
      }
      // 池塘盖住穿水的土路，桥面随后绘制，碰撞引用相同参数。
      c.beginPath();
      c.ellipse(POND.x, POND.y, POND.rx + 12, POND.ry + 12, 0, 0, Math.PI * 2);
      c.fillStyle = "#b2b57e";
      c.fill();
      c.beginPath();
      c.ellipse(POND.x, POND.y, POND.rx, POND.ry, 0, 0, Math.PI * 2);
      c.fillStyle = c.createPattern(
        this.textures.get("water").getSourceImage() as HTMLImageElement,
        "repeat",
      )!;
      c.fill();
      c.strokeStyle = "#648f73";
      c.lineWidth = 8;
      c.stroke();
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
      for (const [x, y] of [
        [900, 1350],
        [1500, 1320],
      ]) {
        c.fillStyle = "#624d32";
        c.fillRect(x, y, 9, 30);
        c.fillRect(x + 70, y, 9, 30);
        c.fillStyle = "#bb9058";
        c.fillRect(x - 5, y - 3, 90, 13);
        c.fillRect(x - 5, y + 15, 90, 12);
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
        if (inReworkArea(x, y) && !canDecorate(x, y, 7)) continue;
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
