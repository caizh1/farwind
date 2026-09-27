import Phaser from "phaser";
import { POND, BRIDGES, roads, roadWidth } from "../../data/world";
import { WIND_WATER, waterTrailSamples } from "../systems/swordWindWater";
import type { SwordWind } from "../systems/swordWind";
type Slot = { image: Phaser.GameObjects.Image; key: string };
let serial = 0;
export class SwordWindWaterView {
  private slots: Slot[] = [];
  private regions = new Map<
    string,
    {
      container: Phaser.GameObjects.Container;
      x: number;
      y: number;
      width: number;
      height: number;
      texture: string;
    }
  >();
  private disposed = false;
  private samples: {
    wind: number;
    x: number;
    y: number;
    region: string;
    age: number;
  }[] = [];
  constructor(private scene: Phaser.Scene) {
    const id = ++serial;
    const definitions = [
      {
        id: "pond",
        x: POND.x - POND.rx,
        y: POND.y - POND.ry,
        width: POND.rx * 2,
        height: POND.ry * 2,
      },
      { id: "stream", x: 2480, y: 650, width: 260, height: 930 },
    ];
    for (const r of definitions) {
      const key = `wind-water-mask-${id}-${r.id}`,
        texture = scene.textures.createCanvas(key, r.width, r.height)!,
        c = texture.context;
      c.fillStyle = "#ffffff";
      if (r.id === "pond") {
        c.beginPath();
        c.ellipse(POND.rx, POND.ry, POND.rx, POND.ry, 0, 0, Math.PI * 2);
        c.fill();
      } else {
        c.strokeStyle = "#ffffff";
        c.lineWidth = 68;
        c.beginPath();
        c.moveTo(2620 - r.x, 650 - r.y);
        c.bezierCurveTo(
          2540 - r.x,
          850 - r.y,
          2700 - r.x,
          1250 - r.y,
          2570 - r.x,
          1580 - r.y,
        );
        c.stroke();
        c.globalCompositeOperation = "destination-out";
        c.lineCap = "round";
        c.lineJoin = "round";
        for (const [index, path] of roads.entries()) {
          c.lineWidth = roadWidth(index) + 15;
          c.beginPath();
          path.forEach(([x, y], i) =>
            i ? c.lineTo(x - r.x, y - r.y) : c.moveTo(x - r.x, y - r.y),
          );
          c.stroke();
        }
        c.globalCompositeOperation = "source-over";
      }
      for (const b of BRIDGES) c.clearRect(b.x - r.x, b.y - r.y, b.w, b.h);
      texture.refresh();
      const container = scene.add
        .container(r.x, r.y)
        .setDepth(-17.5)
        .setVisible(false);
      container
        .enableFilters()
        .setFiltersFocusContext(false)
        .focusFiltersOverride(0, 0, r.width, r.height);
      container.filters!.internal.addMask(key);
      this.regions.set(r.id, { ...r, container, texture: key });
    }
    scene.events.once("shutdown", this.destroy, this);
    scene.events.once("destroy", this.destroy, this);
  }
  draw(winds: Iterable<SwordWind>, now: number) {
    if (this.disposed) return;
    const desired: {
      key: string;
      region: string;
      x: number;
      y: number;
      angle: number;
      width: number;
      height: number;
      alpha: number;
      texture: string;
    }[] = [];
    this.samples = [];
    for (const w of winds)
      for (const s of waterTrailSamples(w, now)) {
        this.samples.push({
          wind: w.id,
          x: s.x,
          y: s.y,
          region: s.region,
          age: s.age,
        });
        const angle = Math.atan2(w.direction.y, w.direction.x),
          key = `${w.id}:${s.index}:${s.region}`;
        if (s.age < WIND_WATER.wake)
          desired.push({
            key: key + ":wake",
            region: s.region,
            x: s.x,
            y: s.y,
            angle,
            width: s.length * 1.65,
            height: s.width * 0.8,
            alpha: 0.42 * (1 - s.age / WIND_WATER.wake),
            texture: "water-ripple",
          });
        if (s.age < WIND_WATER.splash)
          for (const side of [-1, 1])
            desired.push({
              key: key + ":splash:" + side,
              region: s.region,
              x: s.x - w.direction.y * s.width * 0.42 * side,
              y: s.y + w.direction.x * s.width * 0.42 * side - 3,
              angle: 0,
              width: 14 + s.width * 0.15,
              height: 12 + s.width * 0.12,
              alpha: 0.78 * (1 - s.age / WIND_WATER.splash),
              texture: "water-splash",
            });
        const t = s.age / WIND_WATER.ripple;
        desired.push({
          key: key + ":ripple",
          region: s.region,
          x: s.x,
          y: s.y,
          angle: 0,
          width: s.width * (0.9 + t * 0.55),
          height: s.width * (0.34 + t * 0.18),
          alpha: 0.2 * (1 - t),
          texture: "water-ripple",
        });
      }
    const selected = desired.slice(-WIND_WATER.capacity),
      selectedKeys = new Set(selected.map((s) => s.key)),
      byKey = new Map(this.slots.filter((s) => s.key).map((s) => [s.key, s])),
      available = this.slots.filter((s) => !s.key || !selectedKeys.has(s.key)),
      used = new Set<string>(),
      liveRegions = new Set<string>();
    const view = this.scene.cameras.main.worldView;
    for (const sample of selected) {
      const r = this.regions.get(sample.region)!;
      if (
        sample.x < view.x - 100 ||
        sample.x > view.right + 100 ||
        sample.y < view.y - 100 ||
        sample.y > view.bottom + 100
      )
        continue;
      let slot = byKey.get(sample.key);
      if (!slot) {
        slot = available.pop();
        if (!slot && this.slots.length < WIND_WATER.capacity) {
          slot = {
            image: this.scene.add.image(0, 0, sample.texture).setVisible(false),
            key: "",
          };
          this.slots.push(slot);
        }
        if (!slot) continue;
        slot.key = sample.key;
      }
      if (slot.image.parentContainer !== r.container) {
        slot.image.parentContainer?.remove(slot.image);
        r.container.add(slot.image);
      }
      slot.image
        .setTexture(sample.texture)
        .setPosition(sample.x - r.x, sample.y - r.y)
        .setRotation(sample.angle)
        .setDisplaySize(sample.width, sample.height)
        .setAlpha(sample.alpha)
        .setVisible(true);
      used.add(slot.key);
      liveRegions.add(sample.region);
    }
    for (const slot of this.slots)
      if (!used.has(slot.key)) {
        slot.image.setVisible(false);
        slot.key = "";
      }
    for (const [id, r] of this.regions)
      r.container.setVisible(liveRegions.has(id));
  }
  clear() {
    for (const s of this.slots) {
      s.key = "";
      s.image.setVisible(false);
    }
    for (const r of this.regions.values()) r.container.setVisible(false);
    this.samples = [];
  }
  snapshot() {
    return {
      active: this.slots.filter((s) => s.key).length,
      allocated: this.slots.length,
      capacity: WIND_WATER.capacity,
      samples: this.samples,
      disposed: this.disposed,
    };
  }
  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.events.off("shutdown", this.destroy, this);
    this.scene.events.off("destroy", this.destroy, this);
    for (const s of this.slots) s.image.destroy();
    this.slots = [];
    for (const r of this.regions.values()) {
      r.container.destroy();
      this.scene.textures.remove(r.texture);
    }
    this.regions.clear();
    this.samples = [];
  }
}
