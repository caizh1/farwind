import Phaser from "phaser";
import { Locomotion, type MotionSample } from "../systems/locomotion";
import { clipFor } from "../../data/animation";
export class Actor {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  motion: Locomotion;
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    public cat = false,
  ) {
    this.motion = new Locomotion(cat);
    this.shadow = scene.add.ellipse(
      x,
      y - 3,
      cat ? 27 : 34,
      12,
      0x233c34,
      0.22,
    );
    this.sprite = scene.add
      .sprite(x, y, cat ? "cat-motion" : "hero", 0)
      .setOrigin(0.5, 124 / 128);
    this.sprite.setDisplaySize(cat ? 55 : 86, cat ? 54 : 92);
    this.place(x, y);
  }
  get direction() {
    return this.motion.direction;
  }
  place(x: number, y: number) {
    this.motion.reset();
    this.draw(x, y);
  }
  move(
    x: number,
    y: number,
    dx: number,
    dy: number,
    _time: number,
    attack = false,
    dt = 0,
    intentX = 0,
    intentY = 0,
  ) {
    this.motion.update({ dx, dy, dt, intentX, intentY, attack });
    this.draw(x, y);
  }
  animate(sample: MotionSample) {
    this.motion.update(sample);
    this.draw(this.sprite.x, this.sprite.y);
  }
  draw(x: number, y: number) {
    const clip = clipFor(this.cat, this.motion.direction, this.motion.action);
    const index =
        Math.floor(this.motion.phase * clip.frames.length) % clip.frames.length,
      frame = clip.frames[index];
    if (this.sprite.texture.key !== clip.texture)
      this.sprite.setTexture(clip.texture, frame);
    else if (String(this.sprite.frame.name) !== String(frame))
      this.sprite.setFrame(frame);
    this.sprite.setFlipX(clip.flip).setPosition(x, y).setDepth(y);
    this.shadow.setPosition(x, y - 3).setDepth(y - 0.5);
  }
  debug() {
    const c = clipFor(this.cat, this.motion.direction, this.motion.action);
    return {
      action: this.motion.action,
      key: c.name,
      frame: this.sprite.frame.name,
      frameIndex:
        Math.floor(this.motion.phase * c.frames.length) % c.frames.length,
      direction: this.direction,
      phase: this.motion.phase,
      speed: this.motion.speed,
      flip: this.sprite.flipX,
      root: [this.sprite.x, this.sprite.y],
      anchor: [64, 124],
      scale: [this.sprite.scaleX, this.sprite.scaleY],
      provisional: !!c.provisional,
    };
  }
}
