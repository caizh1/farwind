import Phaser from 'phaser';
import type { Actor } from './actor';
import type { State } from '../systems/state';
import { catBenefits } from '../systems/catBond';
import type { CatCompanion, CatEvent, CatTarget } from '../systems/catCompanion';

// 复用现有小黑素材与地面根；支援特效不修改精灵位置或碰撞。
export class CatCompanionView {
  private catInk: Phaser.GameObjects.Graphics;
  private heroInk: Phaser.GameObjects.Graphics;
  private markInk: Phaser.GameObjects.Graphics;
  private flashes: { event: CatEvent; at: number }[] = [];
  constructor(scene: Phaser.Scene) {
    this.catInk = scene.add.graphics(); this.heroInk = scene.add.graphics(); this.markInk = scene.add.graphics();
  }
  clear() { this.catInk.clear(); this.heroInk.clear(); this.markInk.clear(); this.flashes = []; }
  event(event: CatEvent, now: number) {
    this.flashes.push({ event, at: now });
    if (this.flashes.length > 16) this.flashes.shift();
  }
  draw(s: State, controller: CatCompanion, cat: Actor, now: number, targets: readonly CatTarget[]) {
    const p = s.player, c = cat.sprite, ink = this.catInk.clear().setDepth(c.y + .2);
    const hero = this.heroInk.clear().setDepth(p.y + .2), mark = this.markInk.clear();
    if (controller.aura) {
      const alpha = .13 + .05 * Math.sin(now / 700);
      ink.lineStyle(1.2, 0xc5e8b2, alpha).strokeEllipse(c.x, c.y - 2, 34, 11);
    }
    if (controller.hint && !controller.pounce) {
      const h = controller.hint, dx = h.x - c.x, dy = h.y - c.y, length = Math.hypot(dx, dy) || 1;
      for (let i = 0; i < 3; i++) {
        const step = 20 + i * 11;
        ink.fillStyle(0xe9d892, .65 - i * .14).fillCircle(c.x + dx / length * step, c.y - 7 + dy / length * step, 2);
      }
    }
    if (controller.pounce) ink.lineStyle(2, 0xe3dcf1, .6).strokeEllipse(c.x, c.y - 4, 39, 15);
    if (controller.mark && s.life.playerSpace === 'village') {
      const target = targets.find(t => t.id === controller.mark!.id && t.hp > 0 && !t.disabled);
      if (target) {
        mark.setDepth(target.y + 2).lineStyle(2, 0xe4bff5, .85);
        for (let i = -1; i <= 1; i++) mark.lineBetween(target.x + i * 6 - 3, target.y - 42, target.x + i * 6 + 3, target.y - 54);
      }
    }
    if (s.catBond.shield > 0 && s.catBond.shieldTime > 0 && s.life.playerSpace === 'village') {
      hero.lineStyle(2, 0xc4e7dd, .65).strokeEllipse(p.x, p.y - 27, 61, 76);
      hero.lineStyle(1, 0xe0f5cb, .32).strokeEllipse(p.x, p.y - 27, 67, 82);
    }
    this.flashes = this.flashes.filter(f => now - f.at < 1000);
    for (const { event, at } of this.flashes) {
      const u = Math.max(0, (now - at) / 1000), x = event.point.x, y = event.point.y - 22;
      const targetInk = ['guard', 'unlock', 'care'].includes(event.kind) ? hero : ink;
      if (event.kind === 'care' || event.kind === 'unlock') {
        const color = event.kind === 'unlock' ? 0xf4dea2 : 0xf3b7b1;
        targetInk.lineStyle(1.5, color, 1 - u).strokeCircle(x, y - u * 22, 4 + u * 7);
        for (let i = -1; i <= 1; i++) targetInk.fillStyle(color, 1 - u).fillCircle(x + i * (10 + u * 12), y - 8 - u * 30, 2);
      } else if (event.kind === 'boost' || event.kind === 'mark') {
        targetInk.lineStyle(2, 0xe4bff5, 1 - u);
        for (let i = -1; i <= 1; i++) targetInk.lineBetween(x + i * 7 - 6, y - 6, x + i * 7 + 6 + u * 9, y - 22 - u * 10);
      }
    }
    c.setTint(catBenefits(s.catBond.score).stage === 4 && controller.pounce ? 0xe7d4ff : 0xffffff);
  }
}
