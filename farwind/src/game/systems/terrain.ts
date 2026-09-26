import { TRAINING } from "./training";
import Phaser from "phaser";
import { roads } from "../../data/world";
import type { World } from "../scenes/World";

export function makeTerrain(this: World) {
  const grass = this.textures.get("grass").getSourceImage() as HTMLImageElement,
    forest = this.textures.get("forest").getSourceImage() as HTMLImageElement,
    road = this.textures.get("road").getSourceImage() as HTMLImageElement;
  for (let cy = 0; cy < 2200; cy += 550)
    for (let cx = 0; cx < 3600; cx += 600) {
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
      c.fillRect(1500, 0, 1200, 2200);
      for (let band = 0; band < 12; band++) {
        c.globalAlpha = band / 12;
        c.fillRect(1260 + band * 20, 0, 20, 2200);
      }
      c.restore();
      if (cx >= 2700) {
        c.fillStyle = rp;
        c.fillRect(cx, cy, 600, 550);
        c.fillStyle = "#64817465";
        c.fillRect(cx, cy, 600, 550);
      }
      c.beginPath();
      c.moveTo(2020, 650);
      c.bezierCurveTo(1940, 850, 2100, 1250, 1970, 1580);
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
      for (const path of roads) {
        c.beginPath();
        path.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
        c.strokeStyle = "#9f9d62";
        c.lineWidth = 140;
        c.stroke();
        c.strokeStyle = rp;
        c.lineWidth = 125;
        c.stroke();
      }
      c.beginPath();
      c.ellipse(670, 760, 245, 150, 0, 0, Math.PI * 2);
      c.fillStyle = rp;
      c.fill();
      c.strokeStyle = "#b1a06b";
      c.lineWidth = 6;
      c.stroke();
      c.beginPath();
      c.ellipse(TRAINING.x, TRAINING.y, 76, 52, 0, 0, Math.PI * 2);
      c.fillStyle = "#b2a16a88";
      c.fill();
      c.fillStyle = "#496c4030";
      for (let i = 0; i < 45; i++) {
        const x = cx + ((i * 137) % 600),
          y = cy + ((i * 79) % 550);
        c.beginPath();
        c.ellipse(x, y, 7, 2, 0.4, 0, 7);
        c.fill();
      }
      texture.refresh();
      this.add.image(cx, cy, key).setOrigin(0).setDepth(-20);
    }
  this.add
    .text(670, 490, "风铃村", {
      fontFamily: "serif",
      fontSize: "24px",
      color: "#fff4cf",
      stroke: "#375a3c",
      strokeThickness: 3,
    })
    .setOrigin(0.5)
    .setDepth(500);
}
