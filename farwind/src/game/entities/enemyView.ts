import Phaser from 'phaser';
import {ENEMIES,enemyProfile,enemyKind} from '../../data/enemies';
import {EnemyAnimation,type AnimatedEnemy,type EnemyPose} from '../systems/enemyAnimation';
import {sampleEnemyAttack,type EnemyAttack,SPORE} from '../systems/enemyAttack';
import type {EnemyProjectiles} from '../systems/enemyProjectiles';
import {Actor} from './actor';
type Entry={motion:EnemyAnimation;pose?:EnemyPose;hp:number;trail:number;trailStart:number;hitAt:number};
export class EnemyView {
  entries=new WeakMap<Phaser.GameObjects.Sprite,Entry>();
  bars:Phaser.GameObjects.Graphics;
  shots=new Map<string,Phaser.GameObjects.Image>();
  danger=new Map<string,Phaser.GameObjects.Graphics>();
  dangerUsed=new Set<string>();
  static preload(scene:Phaser.Scene){
    for(const [kind,profile] of Object.entries(ENEMIES))scene.load.spritesheet(`enemy-${kind}`,`/assets/enemies-v1/${profile.art}.png`,{frameWidth:160,frameHeight:160});
    scene.load.image('spore-projectile','/assets/enemies-v1/spore-projectile.png');scene.load.image('spore-burst','/assets/enemies-v1/spore-burst.png');
  }
  constructor(public scene:Phaser.Scene){this.bars=scene.add.graphics().setDepth(8997);}
  reset(){this.entries=new WeakMap();this.bars.clear();for(const im of this.shots.values())im.destroy();this.shots.clear();for(const ink of this.danger.values())ink.destroy();this.danger.clear();}
  begin(){this.bars.clear();this.dangerUsed.clear();for(const ink of this.danger.values())ink.clear();}
  warn(root:{x:number;y:number},attack:EnemyAttack,now:number){
    if(attack.emitted||attack.cancelled||now>=attack.contactAt)return;
    const id=attack.attackerId;this.dangerUsed.add(id);let ink=this.danger.get(id);if(!ink){ink=this.scene.add.graphics();this.danger.set(id,ink);}
    ink.setDepth(root.y-.6);const d=attack.direction,length=attack.type==='boar'?210:attack.type==='raven'?95:attack.type==='spore'?SPORE.speed*SPORE.life/1000:34;
    ink.lineStyle(attack.type==='spore'?8:attack.type==='boar'?40:24,0xc18c62,.14).lineBetween(root.x,root.y,root.x+d.x*length,root.y+d.y*length);
    ink.lineStyle(1,0xffdbc0,.6).lineBetween(root.x,root.y,root.x+d.x*length,root.y+d.y*length);
    if(attack.type==='leaf'){const angle=Math.atan2(d.y,d.x),points=[{x:root.x,y:root.y},...Array.from({length:12},(_,i)=>({x:root.x+Math.cos(angle-.85+i/11*1.7)*72,y:root.y+Math.sin(angle-.85+i/11*1.7)*72}))];ink.fillStyle(0xc18c62,.12).fillPoints(points.map(p=>new Phaser.Math.Vector2(p.x,p.y)),true);}
  }
  finishWarnings(){for(const [id,ink] of this.danger)if(!this.dangerUsed.has(id)){ink.destroy();this.danger.delete(id);}}
  draw(body:AnimatedEnemy,attack:EnemyAttack|null|undefined,sprite:Phaser.GameObjects.Sprite,now:number,showBar=false){
    const kind=enemyKind(body.type),profile=enemyProfile(kind);
    let entry=this.entries.get(sprite);if(!entry){entry={motion:new EnemyAnimation(),hp:body.hp??profile.hp,trail:body.hp??profile.hp,trailStart:body.hp??profile.hp,hitAt:-Infinity};this.entries.set(sprite,entry);}
    const pose=entry.motion.sample(body,attack,now);entry.pose=pose;
    const lift=attack&&!attack.cancelled&&pose.action==='attack'?sampleEnemyAttack(attack,now,body).offset.y:0;
    const alpha=pose.action==='death'?Math.max(0,1-Math.max(0,pose.elapsed-2000)/400):1;
    sprite.setTexture(`enemy-${kind}`,pose.frame).setOrigin(.5,110/128).setDisplaySize(160*profile.height/60,160*profile.height/60)
      .setPosition(body.x,body.y+lift).setDepth(body.y).setRotation(0).setAlpha(alpha).setVisible(alpha>0).clearTint();
    Actor.mirror(sprite,pose.facing===2);
    if(showBar&&(body.hp??1)>0){
      const hp=body.hp??profile.hp;if(hp<entry.hp){entry.trailStart=Math.max(entry.hp,entry.trail);entry.hitAt=now;}entry.hp=hp;
      const trail=now-entry.hitAt<250?entry.trailStart:Math.max(hp,entry.trailStart-(now-entry.hitAt-250)/500*profile.hp);entry.trail=trail;
      const x=body.x-23,y=body.y-profile.height*1.45-15;
      this.bars.fillStyle(0x15372d,.95).fillRoundedRect(x-2,y-2,50,9,2).lineStyle(1,0xe9e4cd,.85).strokeRoundedRect(x-2,y-2,50,9,2);
      this.bars.fillStyle(0xd6bc7c,1).fillRect(x,y,46*trail/profile.hp,5).fillStyle(0xc26a58,1).fillRect(x,y,46*hp/profile.hp,5);
    }
    return pose;
  }
  projectile(system:EnemyProjectiles,now:number,visible:boolean){
    const ids=new Set(system.shots.map(s=>s.id));for(const [id,im] of this.shots)if(!ids.has(id)){im.destroy();this.shots.delete(id);}
    for(const s of system.shots){let im=this.shots.get(s.id);if(!im){im=this.scene.add.image(s.x,s.y-28,'spore-projectile');this.shots.set(s.id,im);}
      const burst=s.state==='burst',u=burst?Math.min(1,(now-(s.burstAt??now))/SPORE.burst):0;
      im.setTexture(burst?'spore-burst':'spore-projectile').setPosition(s.x,s.y-28).setDepth(s.y+1).setDisplaySize(burst?28+u*30:20,burst?28+u*30:20)
        .setRotation(burst?0:Math.atan2(s.attack.direction.y,s.attack.direction.x)).setAlpha(1-u).setVisible(visible);
      if(s.deflected)im.setTint(0xc8fff2);else im.clearTint();
    }
  }
  debug(sprite:Phaser.GameObjects.Sprite){const e=this.entries.get(sprite);return e?{pose:e.pose,root:[e.motion.motion.last?.x,e.motion.motion.last?.y],frame:sprite.frame.name,origin:[sprite.originX,sprite.originY],scale:[sprite.scaleX,sprite.scaleY],flip:sprite.flipX,provisional:true}:null;}
}
