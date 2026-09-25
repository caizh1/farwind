import Phaser from "phaser";
import { Actor } from "./game/entities/actor";
import type { Facing, MotionAction } from "./game/systems/locomotion";
if (!import.meta.env.DEV) throw Error("动作预览只允许开发环境使用");
const params = new URLSearchParams(location.search),
  baseline = params.has("baseline");
class Preview extends Phaser.Scene {
  actors: Actor[] = [];
  old!: Phaser.GameObjects.Sprite;
  elapsed = 0;
  frozen = false;
  preload() {
    for (const id of ["hero", "cat"]) {
      this.load.spritesheet(
        id,
        baseline ? `/docs/animation/before/${id}.png` : `/assets/${id}.png`,
        { frameWidth: 128, frameHeight: 128 },
      );
      this.load.spritesheet(
        `${id}-motion`,
        `/assets/animation/round-three/${id}-motion.png`,
        { frameWidth: 128, frameHeight: 128 },
      );
    }
  }
  create() {
    (document.querySelector("#actor") as HTMLSelectElement).value =
      params.get("actor") ?? "hero";
    this.actors = [new Actor(this, 640, 500), new Actor(this, 640, 500, true)];
    this.old = this.add.sprite(640, 500, "hero", 0).setOrigin(0.5, 124 / 128);
    const g = this.add.graphics().setDepth(1000);
    g.lineStyle(1, 0x8f8072).lineBetween(0, 500, 1280, 500);
    g.lineStyle(2, 0xc06c5a)
      .lineBetween(628, 500, 652, 500)
      .lineBetween(640, 488, 640, 512);
    g.lineStyle(1, 0x227966).strokeRect(604, 470, 72, 60);
    document.querySelector<HTMLButtonElement>("#pause")!.onclick = () =>
      (this.frozen = !this.frozen);
  }
  update(_time: number, delta: number) {
    if (this.frozen) return;
    const dt = Math.min(delta, 50) / 1000;
    this.elapsed += dt * 1000;
    const who = (document.querySelector("#actor") as HTMLSelectElement).value,
      d = Number(
        (document.querySelector("#direction") as HTMLSelectElement).value,
      ) as Facing,
      action = (document.querySelector("#action") as HTMLSelectElement)
        .value as MotionAction;
    const cat = who === "cat",
      actor = this.actors[cat ? 1 : 0],
      moving = action !== "idle",
      speed = moving ? (action === "run" ? 235 : 150) : 0;
    for (const a of this.actors) {
      a.sprite.setVisible(!baseline && a === actor);
      a.shadow.setVisible(!baseline && a === actor);
    }
    this.old.setVisible(baseline);
    if (baseline) {
      const frame = cat
        ? moving
          ? Math.floor(this.elapsed / 140) % 6
          : 0
        : d * 6 + (moving ? 1 + (Math.floor(this.elapsed / 130) % 4) : 0);
      this.old
        .setTexture(who, frame)
        .setFlipX(cat && moving && d === 2)
        .setDisplaySize(cat ? 165 : 258, cat ? 162 : 276);
      document.querySelector("#info")!.textContent =
        `修复前 · ${who}/${action}/${frame} · 地面根640,500 · 3倍显示`;
      return;
    }
    const vx = d === 2 ? -1 : d === 3 ? 1 : 0,
      vy = d === 1 ? -1 : d === 0 ? 1 : 0;
    actor.animate({
      dx: vx * speed * dt,
      dy: vy * speed * dt,
      dt,
      intentX: vx,
      intentY: vy,
    });
    actor.sprite.setDisplaySize(cat ? 165 : 258, cat ? 162 : 276);
    const s = actor.debug();
    document.querySelector("#info")!.textContent =
      `${s.key} 帧${s.frame} 速度${s.speed.toFixed(0)} 翻转${s.flip} 锚点64,124 根640,500 ${s.provisional ? "素材待补" : ""}`;
  }
}
new Phaser.Game({
  type: Phaser.WEBGL,
  parent: "preview",
  width: 1280,
  height: 600,
  backgroundColor: "#eae6d8",
  scene: [Preview],
  audio: { noAudio: true },
  render: { antialias: true },
});
