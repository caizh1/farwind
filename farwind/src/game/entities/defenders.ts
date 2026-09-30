import Phaser from "phaser";
import {Actor} from "./actor";
import art from "../../data/defense-art.json";
import { GUARD_DEFS, TOWERS } from "../../data/defense";
import type { EastDefense, DefenseEnemy } from "../systems/defense";
import type { NpcLife } from "../systems/npcLife";
import { NPC_WALK, NpcMotion, npcWalkPose } from "../systems/npcAnimation";
type View = { sprite: Phaser.GameObjects.Sprite; shadow: Phaser.GameObjects.Ellipse; name?: Phaser.GameObjects.Text; body?:DefenseEnemy; deathAt?:number; motion?: NpcMotion };
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
  update(defense: EastDefense, now: number, drawEnemy: (e: DefenseEnemy, sprite: Phaser.GameObjects.Sprite) => void, life?: NpcLife) {
    for (const g of defense.state.guards) {
      const d = GUARD_DEFS.find(d => d.id === g.id)!;
      const tower = TOWERS.find(t => t.occupantGuardId === g.id);
      const key = d.role === "melee" ? "guard" : tower!.outward.x === 0 && !g.dead ? "vertical" : "archer";
      const r = defense.runtime.get(g.id)!;
      const action=life?.data.people.find(n=>n.id===g.id)?.action,
        sleeping=g.offDuty&&action?.kind==="sleep"&&action.phase==="perform";
      let view = this.guards.get(g.id);
      if (!view) {
        view = { sprite: this.scene.add.sprite(g.x, g.y, `defender-${key}`, 0),
          motion: new NpcMotion(),
          shadow: this.scene.add.ellipse(g.x, g.y - 3, 30, 10, 0x173b30, 0.22),
          name: this.scene.add.text(g.x, g.y + 14, "", {fontSize:"13px",color:"#fff4d5",stroke:"#355443",strokeThickness:3}).setOrigin(.5,0) };
        this.guards.set(g.id, view);
        view.motion!.direction = r.facing;
      }
      const motion = view.motion!;
      motion.sample({ ...g, space: `${g.space ?? "village"}:${g.offDuty ? "ground" : d.role}` }, now,
        !g.dead && !r.attack && now >= r.flashUntil && !(g.towerTransitMs! > 0) && (d.role === "melee" || g.offDuty));
      const groundArcher = d.role === "archer" && g.offDuty && !g.dead && !r.attack && now >= r.flashUntil,
        facing = motion.speed > 0 ? motion.direction : r.facing;
      let pose = 0;
      if (g.dead) pose = key === "archer" ? 7 : 5;
      else if (now < r.flashUntil) pose = key === "archer" ? 6 : 5;
      else if (r.attack) pose = key !== "guard" ? now < r.attack.contact - 180 ? 1 : now < r.attack.contact ? 2 : 3
        : now < r.attack.contact ? 3 : 4;
      else if (motion.speed > 0 && key === "guard") pose = 1 + Math.floor(motion.distance / 32) % 2;
      const row = facing === 1 ? 1 : facing >= 2 ? 2 : 0;
      const frame = key === "guard" ? row * 6 + pose : key === "vertical" ?
        (tower!.gateId === "south-gate" ? 4 : 0) + Math.min(pose,3) : pose;
      const data = art[key], f = data.frames[frame];
      const point = d.role === "archer" && !g.offDuty ? tower!.perch : g;
      const walking = groundArcher ? npcWalkPose("archer", motion) : null;
      Actor.mirror(view.sprite,walking ? motion.direction === 2 : key === "guard" && facing === 2 || key === "archer" && tower?.outward.x === -1);
      view.sprite.setTexture(walking?.texture ?? `defender-${key}`,walking?.frame ?? frame)
        .setOrigin(walking ? .5 : f.footX/f.w,walking ? NPC_WALK.footY/NPC_WALK.frameSize : f.footY/f.h)
        .setScale(87/(walking ? NPC_WALK.bodyHeight : key === "vertical" ? data.frames[frame].bodyHeight : data.frames[0].bodyHeight))
        .setPosition(point.x,point.y).setDepth(d.role === "archer" && !g.offDuty ? tower!.y+1 : g.y)
        .setAlpha(g.dead ? .65 : 1).setRotation(g.dead && key === "guard" ? Math.PI/2 : sleeping ? .5 : 0);
      if (now < r.flashUntil) view.sprite.setTint(0xffaaaa); else view.sprite.clearTint();
      view.shadow.setPosition(point.x,point.y-3).setDepth(d.role === "archer" && !g.offDuty ? tower!.y+.5 : g.y-.5).setVisible(!g.dead);
      view.name!.setPosition(point.x,point.y+14).setDepth(d.role === "archer" && !g.offDuty ? tower!.y+2 : g.y+2)
        .setText(`${d.name}${g.dead ? " · 已阵亡" : sleeping ? " · 睡眠" : g.offDuty ? " · 轮休途中" : ""}`);
    }
    const activeSpace=(defense as EastDefense & {observerSpace?:string}).observerSpace??"village";
    for(const g of defense.state.guards){const v=this.guards.get(g.id)!,visible=(g.space??"village")===activeSpace,base=activeSpace==="village"?0:7500;
      v.sprite.setVisible(visible);v.shadow.setVisible(visible&&!g.dead);v.name?.setVisible(visible);
      if(base){v.sprite.setDepth(base+g.y);v.shadow.setDepth(base+g.y-.5);v.name?.setDepth(base+g.y+1);}
    }
    this.arrows.setVisible(activeSpace==="village");
    for(const [id,v] of this.enemies){
      const e=defense.enemies.find(e=>e.id===id)??v.body;
      if(!e||(!defense.enemies.includes(e)&&e.hp>0)){v.sprite.destroy();v.shadow.destroy();this.enemies.delete(id);continue;}
      if(e.hp<=0){v.deathAt??=now;if(now-v.deathAt>=2400){v.sprite.destroy();v.shadow.destroy();this.enemies.delete(id);continue;}}
    }
    for(const e of defense.enemies){
      let v=this.enemies.get(e.id);
      if(!v&&e.hp<=0)continue;
      if(!v){v={sprite:this.scene.add.sprite(e.x,e.y,`enemy-${e.type}`,0).setOrigin(.5,1),shadow:this.scene.add.ellipse(e.x,e.y-3,40,12,0x173b30,.2)};this.enemies.set(e.id,v);}
      v.body=e;
    }
    for(const v of this.enemies.values())if(v.body){
      drawEnemy(v.body,v.sprite);v.sprite.setVisible(activeSpace==="village"&&v.sprite.alpha>0);
      v.shadow.setVisible(v.sprite.visible).setAlpha(.2*v.sprite.alpha).setPosition(v.body.x,v.body.y-3).setDepth(v.body.y-.5);
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
  snapshot() {
    return [...this.guards].map(([id, v]) => ({ id, texture: v.sprite.texture.key, frame: v.sprite.frame.name,
      x: v.sprite.x, y: v.sprite.y, visible: v.sprite.visible, flip: v.sprite.flipX,
      origin: [v.sprite.originX, v.sprite.originY],
      motion: { action: v.motion!.action, speed: v.motion!.speed, distance: v.motion!.distance, direction: v.motion!.direction } }));
  }
}
