import Phaser from "phaser";
import { TrainingDummy, TRAINING } from "../systems/training";
import { facingVector } from "../systems/combat";
export class TrainingDummyView {
  body: Phaser.GameObjects.Image;
  straw: Phaser.GameObjects.Graphics;
  numbers: { at: number; text: Phaser.GameObjects.Text }[] = [];
  constructor(
    private scene: Phaser.Scene,
    private target: TrainingDummy,
  ) {
    this.body = scene.add
      .image(target.x, target.y - 20, "training-body")
      .setOrigin(0.5, 1)
      .setDepth(target.y);
    this.straw = scene.add.graphics().setDepth(target.y + 1);
    scene.add
      .text(target.x, target.y + 20, "训练稻草人", {
        fontFamily: "serif",
        fontSize: "13px",
        color: "#fff2cc",
        stroke: "#375a3c",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(target.y + 1);
  }
  hit(now: number, damage: number) {
    const text = this.scene.add
      .text(this.target.x, this.target.y - 70, String(damage), {
        fontFamily: "serif",
        fontSize: "22px",
        color: "#fff2b8",
        stroke: "#63452c",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(this.target.y + 5);
    this.numbers.push({ at: now, text });
    if (this.numbers.length > 6) this.numbers.shift()!.text.destroy();
  }
  reset() {
    this.numbers.forEach((n) => n.text.destroy());
    this.numbers = [];
    this.straw.clear();
    this.body.setRotation(0).setScale(1).setAlpha(1).clearTint();
  }
  update(now: number, player: { x: number; y: number }) {
    const t = this.target,
      age = now - t.lastHit,
      u = Math.max(0, Math.min(1, age / TRAINING.recoil));
    const [vx, vy] = facingVector(t.facing as 0 | 1 | 2 | 3),
      strength = t.lastStage === 3 ? 1 : 0.6;
    const wave = Math.sin(u * Math.PI * 2.5) * (1 - u) * strength;
    // 从北侧贴靶时让主角可辨认；只淡化身体，不改变木桩、逻辑根和命中点。
    this.body.setAlpha(
      player.y < t.y && player.y > t.y - 110 && Math.abs(player.x - t.x) < 40
        ? 0.45
        : 1,
    );
    this.body
      .setRotation(vx * wave * 0.17)
      .setScale(1 + Math.abs(vy) * wave * 0.035, 1 - vy * wave * 0.09);
    if (age < 90) this.body.setTint(0xffe8ae);
    else this.body.clearTint();
    this.straw.clear();
    if (age >= 0 && age < 450) {
      const p = age / 450;
      this.straw.lineStyle(1.5, 0xe5c16c, 1 - p);
      for (let i = 0; i < (t.lastStage === 3 ? 10 : 6); i++) {
        const a = i * 2.4,
          x = t.x + vx * p * 20 + Math.cos(a) * p * 23,
          y = t.y - 48 + vy * p * 10 + Math.sin(a) * p * 16 + p * p * 18;
        this.straw.lineBetween(x, y, x + Math.cos(a) * 4, y + Math.sin(a) * 4);
      }
    }
    this.numbers = this.numbers.filter((n) => {
      const age = now - n.at;
      if (age >= 850) {
        n.text.destroy();
        return false;
      }
      n.text.setY(t.y - 70 - age * 0.035).setAlpha(1 - age / 850);
      return true;
    });
  }
}
