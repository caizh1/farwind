import { COMBAT } from "../systems/combat";
import Phaser from "phaser";
import { Locomotion, type MotionSample } from "../systems/locomotion";
import {
  clipFor,
  COMBAT_ACTION_ART,
  type CombatVisual,
  weaponSample,
} from "../../data/animation";
import type { Facing } from "../systems/locomotion";
import {scopePlacement,scopeViews} from './scopeWear';
export class Actor {
  // 镜像集中在角色表现层，其他视图只提交方向决定。
  static mirror(sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image, flip: boolean) {
    sprite.setFlipX(flip);
  }
  static preloadScope(scene:Phaser.Scene){for(const view of scopeViews)scene.load.image(`scope-wear-${view}`,`/assets/equipment/scope-wear-${view}.webp`);}
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  carrySword: Phaser.GameObjects.Image;
  motion: Locomotion;
  scopeEquipped=false;
  scopeImage?:Phaser.GameObjects.Image;
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
    this.carrySword = scene.add
      .image(x, y, "hero-carry-sword")
      .setVisible(false);
    if(!cat&&scene.textures.exists("scope-wear-front"))this.scopeImage=scene.add.image(x,y,"scope-wear-front").setOrigin(.5,0).setVisible(false);
    this.place(x, y);
  }
  get direction() {
    return this.motion.direction;
  }
  setAlpha(alpha:number){this.sprite.setAlpha(alpha);this.scopeImage?.setAlpha(alpha);}
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
    carryRemaining = 0,
    armedDash = false,
  ) {
    this.motion.update({ dx, dy, dt, intentX, intentY, attack });
    this.draw(x, y, combat, dashFacing, carryRemaining, armedDash);
  }
  animate(sample: MotionSample) {
    this.motion.update(sample);
    this.draw(this.sprite.x, this.sprite.y);
  }
  draw(
    x: number,
    y: number,
    combat?: CombatVisual,
    dashFacing?: Facing,
    carryRemaining = 0,
    armedDash = false,
  ) {
    if (!this.cat && armedDash && dashFacing !== undefined && dashFacing >= 1)
      combat = {
        texture: dashFacing === 1 ? "hero-combat-back" : "hero-combat-side",
        frame: 0,
        clip: `hero/dash/${dashFacing}`,
        frameIndex: 0,
        facing: dashFacing,
        phase: "dash",
        phaseProgress: 0,
        provisional: false,
      };
    const carrying =
      !this.cat &&
      !combat &&
      dashFacing === undefined &&
      carryRemaining > 0 &&
      this.motion.direction >= 2;
    this.carrySword.setVisible(carrying);
    if (carrying) {
      const sign = this.motion.direction === 2 ? -1 : 1,
        progress = 1 - carryRemaining / COMBAT.settle;
      Actor.mirror(this.carrySword, sign < 0);
      this.carrySword
        .setOrigin(sign < 0 ? 1 : 0, 0.25)
        .setScale(145 / 348)
        .setPosition(x + sign * (12 - 8 * progress), y - 33 + 6 * progress)
        .setRotation(sign * progress * 0.9)
        .setDepth(y + 1);
    }
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
    Actor.mirror(this.sprite,
        combat
          ? combat.facing === 2
          : dashFacing !== undefined
            ? false
            : clip.flip,
      );
    this.sprite.setPosition(x, y)
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
    if(this.scopeImage){const pose=scopePlacement(texture,Number(frame),this.presentation.facing,this.sprite.flipX);
      this.scopeImage.setVisible(this.scopeEquipped&&!!pose).setAlpha(this.sprite.alpha);
      if(pose){this.scopeImage.setTexture(`scope-wear-${pose.view}`);
        const width=pose.width*this.sprite.scaleX,source=this.scopeImage.frame;
        this.scopeImage.setDisplaySize(width,width*source.realHeight/source.realWidth).setPosition(x+pose.x*this.sprite.scaleX,y+(pose.y-this.sprite.originY*this.sprite.frame.realHeight)*this.sprite.scaleY).setDepth(y+.1);
        Actor.mirror(this.scopeImage,pose.flip);
      }
    }
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
      alpha: this.sprite.alpha,
      scope:{equipped:this.scopeEquipped,visible:!!this.scopeImage?.visible,texture:this.scopeImage?.texture.key,position:this.scopeImage?[this.scopeImage.x,this.scopeImage.y]:null,alpha:this.scopeImage?.alpha,provisional:true},
      provisional: this.presentation.provisional,
    };
  }
}
