import { add } from "./state";
import type { World } from "../scenes/World";

export function attack(this: World) {
  if (this.sim < this.cooldown) return;
  this.cooldown = this.sim + 430;
  this.attackSerial++;
  this.attackUntil = this.sim + 220;
  this.soundFx.play("attack");
  const p = this.state.player;
  const dir = [
    [0, 1],
    [0, -1],
    [-1, 0],
    [1, 0],
  ][this.hero.direction];
  const g = this.add.graphics().setDepth(p.y + 1);
  g.lineStyle(4, 0xffefbc, 0.85);
  g.beginPath();
  const angle = Math.atan2(dir[1], dir[0]);
  g.arc(p.x, p.y - 30, 65, angle - 0.9, angle + 0.9);
  g.strokePath();
  this.tweens.add({
    targets: g,
    alpha: 0,
    duration: 180,
    onComplete: () => g.destroy(),
  });
  for (const e of this.enemies) {
    const dx = e.x - p.x,
      dy = e.y - p.y,
      dist = Math.hypot(dx, dy);
    if (
      e.hp > 0 &&
      dist < 105 &&
      (dist < 40 || dx * dir[0] + dy * dir[1] > 0) &&
      this.clearLine(p.x, p.y, e.x, e.y)
    ) {
      e.hp -= 24;
      e.sprite.setTint(0xffaaaa);
      this.float(e.x, e.y, "24");
      if (e.hp <= 0) {
        if (!add(this.state, e.type === "leaf" ? "crystal" : "berry", 1)) {
          e.hp = 1;
          this.ui.message("背包已满，无法收取掉落；整理后再战。");
          continue;
        }
        this.float(
          e.x,
          e.y - 30,
          e.type === "leaf" ? "风之结晶 +1" : "浆果 +1",
        );
        this.state.killed.push(e.id);
        e.sprite.setVisible(false);
        e.shadow.setVisible(false);
        if (e.type === "leaf" && this.state.quest === 3) this.state.quest = 4;
        this.soundFx.play("pick");
      }
    }
  }
}
