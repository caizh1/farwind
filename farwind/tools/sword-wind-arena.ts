// 明确隔离的固定共线夹具；复用正式连段、剑风、伤害、击退和渲染，不改冒险地图。
import Phaser from "phaser";
import { World } from "../src/game/scenes/World";
import { initialState } from "../src/game/systems/state";
import { enemyNavigation } from "../src/game/systems/enemy";
import { clearMotionLine } from "../src/game/systems/obstacles";
import { sweepMove } from "../src/game/systems/combat";
import "../src/style.css";
if (!import.meta.env.DEV) throw Error("固定夹具只供开发验收");
class WindArena extends World {
  override async start() {
    this.loaded = initialState();
    this.loaded.player.x = 600;
    this.loaded.player.y = 740;
    await super.start(true);
    this.ui.message("固定共线夹具：面向右，前三刀挥空，主动接第四击。");
  }
  override async persist() {
    /* 独立夹具不写正式存档。 */
  }
  override spawnEnemies() {
    for (const e of this.enemies) {
      e.sprite.destroy();
      e.shadow.destroy();
    }
    this.enemies = [900, 960].map((x, i) => ({
      id: `wind-arena-${i ? "B" : "A"}`,
      type: "slime",
      kind: "enemy" as const,
      x,
      y: 740,
      homeX: x,
      homeY: 740,
      hp: 48,
      cool: 0,
      windup: 0,
      staggerUntil: 0,
      flashUntil: 0,
      nav: enemyNavigation(),
      ai: "固定共线碰撞夹具",
      disabled: false,
      recovered: false,
      sprite: this.add
        .sprite(x, 740, "slime", 0)
        .setOrigin(0.5, 1)
        .setDisplaySize(75, 75),
      shadow: this.add.ellipse(x, 737, 45, 15, 0x233c34, 0.22),
    }));
  }
  override advanceBattle(prev: number, now: number) {
    this.sim = now;
    const p = this.state.player,
      a = this.battleAxis,
      dt = (now - prev) / 1000,
      len = Math.hypot(a.x, a.y),
      speed = this.combat.attack ? 55 : 180;
    if (len)
      sweepMove(
        p,
        (a.x / len) * speed * dt,
        (a.y / len) * speed * dt,
        (x, y) => this.blocked(x, y),
        clearMotionLine,
      );
    this.tickAttack(prev, now);
    this.resolveSwordWind(
      this.swordWind.advance(
        prev,
        now,
        this.combatTargets().map((target) => ({
          target,
          previous: { x: target.x, y: target.y },
          current: { x: target.x, y: target.y },
        })),
      ),
    );
  }
  override resolveBattle(now: number) {
    this.sim = now;
    for (const action of this.combat.flushActions(now, this.state.player))
      this.soundFx.play(action === "parry" ? "guard" : "dash");
    this.tickAttack(now, now);
    this.resolveSwordWind(
      this.swordWind.advance(
        now,
        now,
        this.combatTargets().map((target) => ({
          target,
          previous: { x: target.x, y: target.y },
          current: { x: target.x, y: target.y },
        })),
      ),
    );
  }
}
new Phaser.Game({
  type: Phaser.WEBGL,
  parent: "game",
  width: 1280,
  height: 720,
  backgroundColor: "#90ac6f",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [WindArena],
  audio: { noAudio: true },
});
