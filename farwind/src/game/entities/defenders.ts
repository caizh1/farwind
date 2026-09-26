import Phaser from "phaser";
import {Actor} from "./actor";
import art from "../../data/defense-art.json";
import { GUARD_DEFS, TOWERS } from "../../data/defense";
import type { EastDefense, DefenseEnemy } from "../systems/defense";
type View = { sprite: Phaser.GameObjects.Sprite; shadow: Phaser.GameObjects.Ellipse; name?: Phaser.GameObjects.Text };
export class DefendersView {
  guards = new Map<string, View>();
  enemies = new Map<string, View>();
  arrows: Phaser.GameObjects.Graphics;
  constructor(private scene: Phaser.Scene) {
    for (const [key, data] of Object.entries(art)) {
      const texture = scene.textures.get(`defender-${key}`);
      data.frames.forEach((f, i) => texture.add(i, 0, f.x, f.y, f.w, f.h));
    }
    this.arrows = scene.add.graphics().setDepth(8996);
  }
  update(defense: EastDefense, now: number, drawEnemy: (e: DefenseEnemy, sprite: Phaser.GameObjects.Sprite) => void) {
    for (const g of defense.state.guards) {
      const d = GUARD_DEFS.find(d => d.id === g.id)!;
      const tower = TOWERS.find(t => t.occupantGuardId === g.id);
      const key = d.role === "melee" ? "guard" : tower!.gateId !== "east-gate" && !g.dead ? "vertical" : "archer";
      const r = defense.runtime.get(g.id)!;
      let view = this.guards.get(g.id);
      if (!view) {
        view = { sprite: this.scene.add.sprite(g.x, g.y, `defender-${key}`, 0),
          shadow: this.scene.add.ellipse(g.x, g.y - 3, 30, 10, 0x173b30, 0.22),
          name: this.scene.add.text(g.x, g.y + 14, "", {fontSize:"13px",color:"#fff4d5",stroke:"#355443",strokeThickness:3}).setOrigin(.5,0) };
        this.guards.set(g.id, view);
      }
      let pose = 0;
      if (g.dead) pose = key === "archer" ? 7 : 5;
      else if (now < r.flashUntil) pose = key === "archer" ? 6 : 5;
      else if (r.attack) pose = key !== "guard" ? now < r.attack.contact - 180 ? 1 : now < r.attack.contact ? 2 : 3
        : now < r.attack.contact ? 3 : 4;
      else if (r.moved > .001 && key === "guard") pose = 1 + Math.floor(r.distance / 32) % 2;
      const row = r.facing === 1 ? 1 : r.facing >= 2 ? 2 : 0;
      const frame = key === "guard" ? row * 6 + pose : key === "vertical" ?
        (tower!.gateId === "south-gate" ? 4 : 0) + Math.min(pose,3) : pose;
      const data = art[key], f = data.frames[frame];
      const point = d.role === "archer" ? tower!.perch : g;
      Actor.mirror(view.sprite,key === "guard" && r.facing === 2);
      view.sprite.setTexture(`defender-${key}`,frame).setOrigin(f.footX/f.w,f.footY/f.h).setScale(87/(key === "vertical" ? data.frames[frame].bodyHeight : data.frames[0].bodyHeight))
        .setPosition(point.x,point.y).setDepth(d.role === "archer" ? tower!.y+1 : g.y)
        .setAlpha(g.dead ? .65 : 1).setRotation(g.dead && key === "guard" ? Math.PI/2 : 0);
      if (now < r.flashUntil) view.sprite.setTint(0xffaaaa); else view.sprite.clearTint();
      view.shadow.setPosition(point.x,point.y-3).setDepth(d.role === "archer" ? tower!.y+.5 : g.y-.5).setVisible(!g.dead);
      view.name!.setPosition(point.x,point.y+14).setDepth(d.role === "archer" ? tower!.y+2 : g.y+2)
        .setText(`${d.name}${g.dead ? " · 已阵亡" : ""}`);
    }
    for (const [id, v] of this.enemies) if (!defense.enemies.some(e => e.id === id && e.hp > 0)) {
      v.sprite.destroy(); v.shadow.destroy(); this.enemies.delete(id);
    }
    for (const e of defense.enemies.filter(e => e.hp > 0)) {
      let v = this.enemies.get(e.id);
      if (!v) {
        v = { sprite:this.scene.add.sprite(e.x,e.y,e.type,0).setOrigin(.5,1),
          shadow:this.scene.add.ellipse(e.x,e.y-3,40,12,0x173b30,.2) }; this.enemies.set(e.id,v);
      }
      drawEnemy(e,v.sprite);
      v.shadow.setPosition(e.x,e.y-3).setDepth(e.y-.5);
      if (now < e.flashUntil) v.sprite.setTint(0xffaaaa); else v.sprite.clearTint();
    }
    this.arrows.clear();
    for (const a of defense.arrows) {
      const n=Math.hypot(a.vx,a.vy),dx=a.vx/n,dy=a.vy/n;
      this.arrows.lineStyle(2,0x694b2e).lineBetween(a.x-dx*18,a.y-dy*18,a.x,a.y);
      this.arrows.lineStyle(1.5,0xe4dfce).lineBetween(a.x-dx*18-dy*3,a.y-dy*18+dx*3,a.x-dx*13,a.y-dy*13)
        .lineBetween(a.x-dx*18+dy*3,a.y-dy*18-dx*3,a.x-dx*13,a.y-dy*13);
      this.arrows.fillStyle(0xb4c5c1).fillTriangle(a.x+dx*3,a.y+dy*3,a.x-dx*4-dy*2,a.y-dy*4+dx*2,a.x-dx*4+dy*2,a.y-dy*4-dx*2);
    }
  }
}
