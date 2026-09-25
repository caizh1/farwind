import Phaser from "phaser";
export class Actor {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  direction = 0;
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    public cat = false,
  ) {
    this.shadow = scene.add.ellipse(
      x,
      y - 3,
      cat ? 27 : 34,
      12,
      0x233c34,
      0.22,
    );
    this.sprite = scene.add
      .sprite(x, y, cat ? "cat" : "hero", 0)
      .setOrigin(0.5, 124 / 128);
    this.sprite.setDisplaySize(cat ? 55 : 86, cat ? 54 : 92);
  }
  move(
    x: number,
    y: number,
    dx: number,
    dy: number,
    time: number,
    attack = false,
  ) {
    this.sprite.setPosition(x, y).setDepth(y);
    this.shadow.setPosition(x, y - 3).setDepth(y - 0.5);
    if (!this.cat) {
      if (Math.abs(dx) > Math.abs(dy)) this.direction = dx < 0 ? 2 : 3;
      else if (dy) this.direction = dy < 0 ? 1 : 0;
      this.sprite.setFrame(
        this.direction * 6 +
          (attack ? 5 : dx || dy ? 1 + (Math.floor(time / 130) % 4) : 0),
      );
    } else {
      this.sprite.setFlipX(dx < 0);
      this.sprite.setFrame(dx || dy ? Math.floor(time / 140) % 6 : 0);
    }
  }
}
