import {waterSurfaceAt} from '../systems/swordWindWater';
import {SwordWindWaterView} from './swordWindWaterView';
import Phaser from "phaser";
import {
  swordWindGroundSegments,
  type SwordWind,
  type SwordWindSystem,
} from "../systems/swordWind";
import { facingVector } from "../systems/combat";
export class SwordWindView {
  water:SwordWindWaterView;
  hits:{image:Phaser.GameObjects.Image;born:number;duration:number}[]=[];
  images = new Map<number, Phaser.GameObjects.Image>();
  ground = new Map<
    number,
    { wind: SwordWind; images: Map<number, Phaser.GameObjects.Image> }
  >();
  constructor(
    private scene: Phaser.Scene,
    private system: SwordWindSystem,
  ) {this.water=new SwordWindWaterView(scene);}
  snapshot() {
    return [...this.ground].flatMap(([id, trail]) =>
      [...trail.images].map(([index, image]) => ({
        id,
        index,
        x: image.x,
        y: image.y,
        alpha: image.alpha,
        frame: image.frame.name,
        depth: image.depth,
        crop: image.getData("pathWidth"),
      })),
    );
  }
  hit(point:{x:number;y:number},at:number,wind:SwordWind){
    const image=this.scene.add.image(point.x,point.y-wind.config.art.bodyHeight,"sword-wind-hit",0).setDisplaySize(wind.config.art.hitSize,wind.config.art.hitSize).setRotation(Math.atan2(wind.direction.y,wind.direction.x)).setDepth(point.y+3);
    this.hits.push({image,born:at,duration:wind.config.art.hit});
    if(this.hits.length>64)this.hits.shift()!.image.destroy();
  }
  clear() {
    this.water.clear();for(const hit of this.hits)hit.image.destroy();this.hits=[];
    for (const image of this.images.values()) image.destroy();
    this.images.clear();
    for (const trail of this.ground.values())
      for (const image of trail.images.values()) image.destroy();
    this.ground.clear();
  }
  draw(now: number) {
    for(const hit of this.hits)hit.image.setFrame(Math.min(7,Math.max(0,Math.floor((now-hit.born)/hit.duration*8))));
    this.hits=this.hits.filter(hit=>{if(now-hit.born>=hit.duration){hit.image.destroy();return false;}return true;});
    for (const wind of this.system.winds)
      if (wind.initialChecked && !this.ground.has(wind.id))
        this.ground.set(wind.id, { wind, images: new Map() });
    for (const [id, trail] of this.ground) {
      const samples = swordWindGroundSegments(trail.wind, now),
        live = new Set(samples.map((s) => s.index));
      for (const [index, image] of trail.images)
        if (!live.has(index)) {
          image.destroy();
          trail.images.delete(index);
        }
      const {x:dx,y:dy}=trail.wind.direction;
      for (const s of samples) {
        const half=trail.wind.config.art.groundHeight*(trail.wind.config.width/28)/2;
        if([-trail.wind.config.art.groundStep/2,0,trail.wind.config.art.groundStep/2].some(along=>[-half,-half/2,0,half/2,half].some(offset=>waterSurfaceAt(s.x+dx*along-dy*offset,s.y+dy*along+dx*offset)))){trail.images.get(s.index)?.destroy();trail.images.delete(s.index);continue;}
        let image = trail.images.get(s.index);
        if (!image) {
          image = this.scene.add.image(0, 0, "sword-wind-ground", s.frame);
          trail.images.set(s.index, image);
        }
        image
          .setTexture("sword-wind-ground", s.frame)
          .setDisplaySize(
            trail.wind.config.art.groundStep,
            trail.wind.config.art.groundHeight*(trail.wind.config.width/28),
          )
          .setCrop(0, 0, s.crop, 128)
          .setData("pathWidth", s.crop)
          .setPosition(s.x, s.y)
          .setRotation(Math.atan2(dy, dx))
          .setAlpha(s.alpha)
          .setDepth(-1);
      }
      // 弹体消失后只保留短暂地面残痕，模拟时间到期即释放对象。
      if (trail.wind.terminated && !samples.length) this.ground.delete(id);
    }
    this.water.draw([...this.ground.values()].map(t=>t.wind),now);
    const ids = new Set(this.system.winds.map((w) => w.id));
    for (const [id, image] of this.images)
      if (!ids.has(id)) {
        image.destroy();
        this.images.delete(id);
      }
    for (const w of this.system.winds) {
      const m = w.config,
        age = now - w.born,
        endAge = now - (w.ended ?? now),
        hit = w.terminated && w.reason === "target";
      const key = w.terminated
        ? hit
          ? "sword-wind-hit"
          : "sword-wind-dissolve"
        : age < m.art.release
          ? "sword-wind-release"
          : "sword-wind-flight";
      const frame = w.terminated
        ? hit
          ? Math.min(7, Math.floor(endAge / (m.art.hit / 8)))
          : Math.min(3, Math.floor(endAge / (m.art.dissolve / 4)))
        : age < m.art.release
          ? Math.min(3, Math.floor(age / (m.art.release / 4)))
          : Math.floor((age - m.art.release) / (m.art.flight / 6)) % 6;
      let image = this.images.get(w.id);
      if (!image) {
        image = this.scene.add.image(0, 0, key, frame);
        this.images.set(w.id, image);
      } else image.setTexture(key, frame);
      const point = hit
          ? { x: w.contact!.x, y: w.contact!.y - m.art.bodyHeight }
          : {
              x: w.position.x + w.visualOffset.x,
              y: w.position.y + w.visualOffset.y,
            },
        {x,y} = w.direction;
      image
        .setDisplaySize(
          hit ? m.art.hitSize : m.art.flightSize,
          hit ? m.art.hitSize : m.art.flightSize*(m.width/28),
        )
        .setPosition(point.x, point.y)
        .setRotation(Math.atan2(y, x))
        .setDepth(w.position.y + 3);
    }
  }
}
