import Phaser from "phaser";
import { Locomotion, type MotionSample } from "../systems/locomotion";
import {
  clipFor,
  COMBAT_ACTION_ART,
  type CombatVisual,
  weaponSample,
} from "../../data/animation";
import type { Facing } from "../systems/locomotion";
export class Actor {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  motion: Locomotion;
  weapon: ReturnType<typeof weaponSample> | null = null;
  presentation = {
    key: "",
    frameIndex: 0,
    provisional: false,
    phase: "idle",
    phaseProgress: 0,
    facing: 0 as Facing,
    anchor: [64, 124] as [number, number],
  };
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
    combat?: CombatVisual,
    dashFacing?: Facing,
  ) {
    this.motion.update({ dx, dy, dt, intentX, intentY, attack });
    this.draw(x, y, combat, dashFacing);
  }
  animate(sample: MotionSample) {
    this.motion.update(sample);
    this.draw(this.sprite.x, this.sprite.y);
  }
  draw(x: number, y: number, combat?: CombatVisual, dashFacing?: Facing) {
    const clip = clipFor(this.cat, this.motion.direction, this.motion.action);
    const index =
        Math.floor(this.motion.phase * clip.frames.length) % clip.frames.length,
      frame = combat
        ? combat.frame
        : dashFacing !== undefined
          ? dashFacing * 6 + 2
          : clip.frames[index],
      texture =
        combat?.texture ?? (dashFacing !== undefined ? "hero" : clip.texture),
      art = combat ? COMBAT_ACTION_ART : null;
    if (this.sprite.texture.key !== texture)
      this.sprite.setTexture(texture, frame);
    else if (String(this.sprite.frame.name) !== String(frame))
      this.sprite.setFrame(frame);
    this.sprite
      .setFlipX(
        combat
          ? combat.facing === 2
          : dashFacing !== undefined
            ? false
            : clip.flip,
      )
      .setPosition(x, y)
      .setDepth(y);
    this.sprite
      .setOrigin(0.5, art ? art.footY / art.frameSize : 124 / 128)
      .setDisplaySize(
        art ? art.displaySize : this.cat ? 55 : 86,
        art ? art.displaySize : this.cat ? 54 : 92,
      );
    this.weapon = combat?.weapon ?? null;
    this.presentation = {
      key:
        combat?.clip ??
        (dashFacing !== undefined ? `hero/dash/${dashFacing}` : clip.name),
      frameIndex: combat?.frameIndex ?? (dashFacing !== undefined ? 2 : index),
      provisional: combat?.provisional ?? !!clip.provisional,
      phase:
        combat?.phase ??
        (dashFacing !== undefined ? "dash" : this.motion.action),
      phaseProgress: combat?.phaseProgress ?? this.motion.phase,
      facing: combat?.facing ?? dashFacing ?? this.motion.direction,
      anchor: art ? [art.frameSize / 2, art.footY] : [64, 124],
    };
    this.shadow.setPosition(x, y - 3).setDepth(y - 0.5);
  }
  debug() {
    return {
      action: this.motion.action,
      presentationState: this.presentation.phase,
      weapon: this.weapon,
      key: this.presentation.key,
      texture: this.sprite.texture.key,
      frame: this.sprite.frame.name,
      frameIndex: this.presentation.frameIndex,
      direction: this.presentation.facing,
      phase: this.presentation.phase,
      phaseProgress: this.presentation.phaseProgress,
      speed: this.motion.speed,
      flip: this.sprite.flipX,
      root: [this.sprite.x, this.sprite.y],
      anchor: this.presentation.anchor,
      origin: [this.sprite.originX, this.sprite.originY],
      scale: [this.sprite.scaleX, this.sprite.scaleY],
      provisional: this.presentation.provisional,
    };
  }
}
