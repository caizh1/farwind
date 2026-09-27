import Phaser from "phaser";
import { BRIDGES, POND } from "../../data/world";
import { WATER, EnvironmentClock, fountainPoint, lilyAnchors, clearOfBridges, ripplePhase, fitWaterPatch } from "./waterMotion";
import { createPondSurface } from "./pondSurface";

type Patch = { image: Phaser.GameObjects.Image; x: number; y: number; phase: number; w: number; h: number };
// 原生Phaser 4内部纹理Mask；没有DOM画布、全局Tween、战斗时钟或每帧纹理上传。
export class WaterEffects {
  readonly clock = new EnvironmentClock();
  private owned: Phaser.GameObjects.GameObject[] = [];
  private textureKeys = ["water-runtime-shore"];
  private bridgeFrame = "water-runtime-bridge";
  private pond: Phaser.GameObjects.Container;
  private surface: Phaser.GameObjects.Shader;
  private basin: Phaser.GameObjects.Container;
  private flow: Phaser.GameObjects.TileSprite;
  private glints: Patch[] = [];
  private pondRipples: Patch[] = [];
  private fountainRipples: Patch[] = [];
  private splashes: Patch[] = [];
  private drops: Patch[] = [];
  private lilies: { image: Phaser.GameObjects.Container; x: number; y: number; phase: number; visible: boolean }[] = [];
  private destroyed = false;
  private pondUpdates = 0;
  private fountainUpdates = 0;

  static preload(scene: Phaser.Scene) {
    for (const name of ["flow-mask", "basin-mask", "flow", "ripple", "splash", "drop", "lily", "flower"])
      scene.load.image(`water-${name}`, `/assets/water-effects/water-${name}.png`);
    scene.load.spritesheet("water-waves", "/assets/water-effects/water-waves.png", { frameWidth: 256, frameHeight: 160 });
  }

  constructor(private scene: Phaser.Scene, private fountain: Phaser.GameObjects.Image) {
    this.surface = this.keep(createPondSurface(scene, () => this.clock.time));
    this.pond = this.keep(scene.add.container(POND.x - POND.rx, POND.y - POND.ry).setDepth(WATER.depth.pond + 0.1));
    for (let i = 0; i < WATER.pond.glints + WATER.pond.ripples; i++) {
      const a = i * 2.39996, radius = 0.25 + (i % 5) * 0.135;
      let x = POND.rx + Math.cos(a) * POND.rx * radius, y = POND.ry + Math.sin(a) * POND.ry * radius;
      const glint = i < WATER.pond.glints;
      const [w,h] = glint ? WATER.pond.glintSize : WATER.pond.rippleSize;
      const maxScale = glint ? 1.3 : 1.5;
      const fitted = fitWaterPatch(x + POND.x - POND.rx, y + POND.y - POND.ry, w * maxScale / 2, h * maxScale / 2);
      x = fitted.x - POND.x + POND.rx; y = fitted.y - POND.y + POND.ry;
      const image = scene.add.image(x, y, glint ? "water-waves" : "water-ripple", glint ? i % 3 : 0).setDisplaySize(w, h);
      this.pond.add(image);
      const patch = { image, x, y, phase: i * 0.381966, w, h };
      (glint ? this.glints : this.pondRipples).push(patch);
    }
    this.createShore();
    for (const anchor of lilyAnchors()) {
      const leaf = scene.add.image(0, 0, "water-lily").setDisplaySize(20, 12);
      const image = this.keep(scene.add.container(anchor.x, anchor.y, [leaf]).setDepth(WATER.depth.lily));
      if (anchor.flower) image.add(scene.add.image(-1, -3, "water-flower").setDisplaySize(8, 6));
      const visible = clearOfBridges(anchor.x, anchor.y);
      image.setVisible(visible);
      this.lilies.push({ image, ...anchor, visible });
    }
    // 裁切、角度、尺寸与旧地面中的桥完全相同；逻辑通道仍由BRIDGES独立提供。
    scene.textures.get("bridge").add(this.bridgeFrame, 0, 0, 92, 1983, 601);
    for (const b of BRIDGES) this.keep(scene.add.image(b.x + b.w / 2, b.y + b.h / 2, "bridge", this.bridgeFrame)
      .setDisplaySize(b.h, b.w + 8).setRotation(Math.PI / 2).setDepth(WATER.depth.bridge));

    const corner = fountainPoint(fountain, 0, 0), w = fountain.displayWidth, h = fountain.displayHeight;
    this.flow = this.keep(scene.add.tileSprite(corner.x, corner.y, w, h, "water-flow").setOrigin(0).setAlpha(WATER.fountain.flowAlpha).setDepth(fountain.depth + WATER.fountain.layers.flow));
    this.flow.tileScaleX = w / WATER.fountain.sourceSize; this.flow.tileScaleY = h / WATER.fountain.sourceSize;
    this.mask(this.flow, "water-flow-mask", w, h);
    this.basin = this.keep(scene.add.container(corner.x, corner.y).setDepth(fountain.depth + WATER.fountain.layers.basin));
    this.mask(this.basin, "water-basin-mask", w, h);
    for (const [i, [u, v]] of WATER.fountain.impacts.entries()) {
      const x = u * w / WATER.fountain.sourceSize, y = v * h / WATER.fountain.sourceSize;
      const add = (key: string, pw: number, ph: number, phase: number): Patch => {
        const image = scene.add.image(x, y, key).setDisplaySize(pw, ph); this.basin.add(image);
        return { image, x, y, w: pw, h: ph, phase };
      };
      this.fountainRipples.push(add("water-ripple", w * WATER.fountain.sizes.ripple[0], h * WATER.fountain.sizes.ripple[1], i / 3));
      this.splashes.push(add("water-splash", w * WATER.fountain.sizes.splash[0], h * WATER.fountain.sizes.splash[1], i * 0.43));
      for (let j = 0; j < WATER.fountain.dropsPerImpact; j++) this.drops.push(add("water-drop", w * WATER.fountain.sizes.drop[0], h * WATER.fountain.sizes.drop[1], i * 0.27 + j / WATER.fountain.dropsPerImpact));
    }
    // 内池遮罩来自原图真实水域，排除前池沿和石柱；不叠画半透明石面或阴影。
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    scene.events.once(Phaser.Scenes.Events.DESTROY, this.destroy, this);
    this.draw(0);
  }

  private keep<T extends Phaser.GameObjects.GameObject>(object: T): T { this.owned.push(object); return object; }
  private mask(object: Phaser.GameObjects.Container | Phaser.GameObjects.TileSprite, key: string, w: number, h: number) {
    // Container没有自身宽高，enableFilters会选择整相机。显式关闭该模式后再限定局部滤镜。
    object.enableFilters().setFiltersFocusContext(false).focusFiltersOverride(0, 0, w, h);
    object.filters!.internal.addMask(key);
  }
  private createShore() {
    const pad = 17, w = POND.rx * 2 + pad * 2, h = POND.ry * 2 + pad * 2;
    const texture = this.scene.textures.createCanvas(this.textureKeys[0], w, h)!;
    const c = texture.context; c.translate(pad - POND.x + POND.rx, pad - POND.y + POND.ry);
    c.save(); c.beginPath(); c.ellipse(POND.x, POND.y, POND.rx, POND.ry, 0, 0, Math.PI * 2); c.clip();
    for (const [inset, alpha] of [[2, 0.22], [5, 0.12], [8, 0.06]]) {
      c.beginPath(); c.ellipse(POND.x, POND.y, POND.rx - inset, POND.ry - inset, 0, 0, Math.PI * 2);
      c.strokeStyle = `rgba(176,204,163,${alpha})`; c.lineWidth = 5; c.stroke();
    }
    c.restore();
    for (const [i, a] of [0.1, 0.5, 0.9, 1.5, 2.1, 2.6, 3.6, 4.2, 4.65, 5.3, 5.85].entries()) {
      const x = POND.x + Math.cos(a) * (POND.rx + 7), y = POND.y + Math.sin(a) * (POND.ry + 7);
      if (!clearOfBridges(x, y, 12)) continue;
      c.drawImage(this.scene.textures.get(i % 2 ? "herb" : "rock").getSourceImage() as HTMLImageElement, x - 8, y - 10, 16, 15);
    }
    texture.refresh();
    this.keep(this.scene.add.image(POND.x - POND.rx - pad, POND.y - POND.ry - pad, this.textureKeys[0]).setOrigin(0).setDepth(WATER.depth.shore));
  }

  update(delta: number, playing: boolean) {
    if (this.destroyed) return;
    const step = this.clock.advance(delta, playing);
    if (playing && step) this.draw(this.clock.time);
  }
  pause() { this.clock.advance(0, false); }
  reset() { this.clock.reset(); if (!this.destroyed) this.draw(0); }
  private draw(time: number) {
    const view = this.scene.cameras.main.worldView;
    const pondVisible = Phaser.Geom.Intersects.RectangleToRectangle(view, new Phaser.Geom.Rectangle(POND.x - POND.rx - 20, POND.y - POND.ry - 20, POND.rx * 2 + 40, POND.ry * 2 + 40));
    this.pond.setVisible(pondVisible); this.surface.setVisible(pondVisible);
    for (const leaf of this.lilies) {
      leaf.image.setVisible(pondVisible && leaf.visible);
      if (pondVisible) leaf.image.y = leaf.y + Math.sin(time / WATER.pond.lilyPeriod * Math.PI * 2 + leaf.phase) * WATER.pond.lilyAmplitude;
    }
    if (pondVisible) {
      this.pondUpdates++;
      for (const p of this.glints) {
        const r = ripplePhase(time, WATER.pond.glintPeriod, p.phase);
        p.image.setAlpha(WATER.pond.glintAlpha * r.alpha).setDisplaySize(p.w * (0.9 + r.progress * 0.4), p.h);
      }
      for (const p of this.pondRipples) {
        const r = ripplePhase(time, WATER.pond.ripplePeriod, p.phase);
        p.image.setAlpha(r.alpha * WATER.pond.rippleAlpha).setDisplaySize(p.w * r.scale, p.h * r.scale);
      }
    }
    const f = this.fountain, corner = fountainPoint(f, 0, 0);
    const visible = f.visible && Phaser.Geom.Intersects.RectangleToRectangle(view, new Phaser.Geom.Rectangle(corner.x, corner.y, f.displayWidth, f.displayHeight));
    this.flow.setVisible(visible); this.basin.setVisible(visible);
    if (!visible) return;
    this.fountainUpdates++;
    this.flow.tilePositionY = -time / 1000 * WATER.fountain.flowSpeed;
    for (const p of this.fountainRipples) {
      const r = ripplePhase(time, WATER.fountain.ripplePeriod, p.phase);
      p.image.setAlpha(r.alpha * WATER.fountain.rippleAlpha).setDisplaySize(p.w * r.scale, p.h * r.scale);
    }
    for (const p of this.splashes) p.image.setAlpha(WATER.fountain.splashAlpha + WATER.fountain.splashVariation * Math.sin(time / WATER.fountain.splashPeriod * Math.PI * 2 + p.phase));
    for (const p of this.drops) {
      const t = ripplePhase(time, WATER.fountain.dropPeriod, p.phase).progress;
      p.image.setPosition(p.x + Math.sin(p.phase * 9) * t * WATER.fountain.dropSpread, p.y - Math.sin(t * Math.PI) * WATER.fountain.dropHeight * f.displayHeight / WATER.fountain.sourceSize);
      p.image.setAlpha(Math.sin(t * Math.PI) * WATER.fountain.dropAlpha);
    }
  }
  snapshot() {
    return { time: this.clock.time, running: this.clock.running, destroyed: this.destroyed,
      pondVisible: this.pond.visible, fountainVisible: this.flow.visible, pondUpdates: this.pondUpdates, fountainUpdates: this.fountainUpdates,
      counts: { surfaces: 1, waves: 0, glints: this.glints.length, pondRipples: this.pondRipples.length, fountainRipples: this.fountainRipples.length, drops: this.drops.length, lilies: this.lilies.length, bridges: BRIDGES.length },
      surface: { x: this.surface.x, y: this.surface.y, width: this.surface.width, height: this.surface.height, time: this.clock.time/1000, amplitude: WATER.pond.surface.amplitude },
      lilies: this.lilies.map(l => ({ x: l.image.x, y: l.image.y, anchorX: l.x, anchorY: l.y, visible: l.image.visible })),
      depths: WATER.depth, flowOffset: this.flow.tilePositionY, ownedTextures: this.textureKeys.slice() };
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.scene.events.off(Phaser.Scenes.Events.DESTROY, this.destroy, this);
    for (const object of this.owned) if (object.scene) object.destroy();
    this.owned.length = 0;
    for (const key of this.textureKeys) if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    this.scene.textures.get("bridge").remove(this.bridgeFrame);
  }
}
