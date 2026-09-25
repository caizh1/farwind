import Phaser from "phaser";
import { Locomotion, type MotionSample } from "../systems/locomotion";
import { clipFor, COMBAT_ART } from "../../data/animation";
import { STRIKES } from "../systems/combat";
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
    this.sprite
      .setOrigin(0.5, 124 / 128)
      .setDisplaySize(this.cat ? 55 : 86, this.cat ? 54 : 92);
    this.shadow.setPosition(x, y - 3).setDepth(y - 0.5);
  }
  combatPose(stage: number, phase: string, facing: number) {
    const base = facing * 6;
    const pose = STRIKES[stage - 1].pose;
    const frame = base + (phase === "windup" ? pose.windup : pose.recovery);
    this.motion.direction = facing as 0 | 1 | 2 | 3;
    if (phase === "active")
      this.sprite
        .setTexture(
          "hero-combat",
          (facing === 0 ? 0 : facing === 1 ? 1 : 2) * 3 + stage - 1,
        )
        .setFlipX(facing === 2)
        .setOrigin(0.5, COMBAT_ART.footY / COMBAT_ART.frameSize)
        .setDisplaySize(COMBAT_ART.displaySize, COMBAT_ART.displaySize);
    else this.sprite.setTexture("hero", frame).setFlipX(false);
  }
  dashPose(facing: number) {
    this.motion.direction = facing as 0 | 1 | 2 | 3;
    this.sprite.setTexture("hero", facing * 6 + 2).setFlipX(false);
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
