import Phaser from 'phaser';
import {creatureMaxHP} from '../../data/maps/windbell/elites';
import {ENEMIES,enemyProfile,enemyKind} from '../../data/enemies';
import {EnemyAnimation,type AnimatedEnemy,type EnemyPose} from '../systems/enemyAnimation';
import {sampleEnemyAttack,type EnemyAttack,SPORE,ENEMY_ATTACK,sporeDirections} from '../systems/enemyAttack';
import type {EnemyProjectiles} from '../systems/enemyProjectiles';
import {Actor} from './actor';
type Entry={motion:EnemyAnimation;pose?:EnemyPose;hp:number;trail:number;trailStart:number;hitAt:number;eliteLabel?:Phaser.GameObjects.Text};
export class EnemyView {
  entries=new WeakMap<Phaser.GameObjects.Sprite,Entry>();
  bars:Phaser.GameObjects.Graphics;
  shots=new Map<string,Phaser.GameObjects.Image>();
  danger=new Map<string,Phaser.GameObjects.Graphics>();
  dangerUsed=new Set<string>();
  eliteLabels=new Set<Phaser.GameObjects.Text>();
  static preload(scene:Phaser.Scene){
    for(const [kind,profile] of Object.entries(ENEMIES))scene.load.spritesheet(`enemy-${kind}`,`/assets/enemies-v1/${profile.art}.png`,{frameWidth:160,frameHeight:160});
    scene.load.image('spore-projectile','/assets/enemies-v1/spore-projectile.png');scene.load.image('spore-burst','/assets/enemies-v1/spore-burst.png');
  }
  constructor(public scene:Phaser.Scene){this.bars=scene.add.graphics().setDepth(8997);}
  reset(){this.entries=new WeakMap();this.bars.clear();for(const im of this.shots.values())im.destroy();this.shots.clear();for(const ink of this.danger.values())ink.destroy();this.danger.clear();for(const label of this.eliteLabels)label.destroy();this.eliteLabels.clear();}
  begin(){this.bars.clear();this.dangerUsed.clear();for(const label of this.eliteLabels)label.setVisible(false);for(const ink of this.danger.values())ink.clear();}
  warn(root:{x:number;y:number},attack:EnemyAttack,now:number){
    if(attack.emitted||attack.cancelled||now>=attack.contactAt)return;
    const id=attack.attackerId;this.dangerUsed.add(id);let ink=this.danger.get(id);if(!ink){ink=this.scene.add.graphics();this.danger.set(id,ink);}
    // 潜地预兆属于必要的环境信号；树冠淡出层也不能盖住它。
    ink.setDepth(attack.type==='burrow'?8995:root.y-.6);const d=attack.direction,length=attack.type==='spore'?SPORE.speed*SPORE.life/1000:(attack.step??ENEMY_ATTACK[attack.type].step);
    ink.lineStyle(attack.type==='spore'?8:attack.type==='boar'?40:24,0xc18c62,.14).lineBetween(root.x,root.y,root.x+d.x*length,root.y+d.y*length);
    ink.lineStyle(1,0xffdbc0,.6).lineBetween(root.x,root.y,root.x+d.x*length,root.y+d.y*length);
    if(attack.elite==='brood')for(const v of sporeDirections(attack)){ink.lineStyle(12,0xc18c62,.18).lineBetween(root.x,root.y,root.x+v.x*length,root.y+v.y*length);ink.lineStyle(2,0xffdbc0,.75).lineBetween(root.x,root.y,root.x+v.x*length,root.y+v.y*length);}
    if(attack.type==='burrow'){
      const u=Math.max(0,Math.min(1,(now-attack.startedAt)/(attack.contactAt-attack.startedAt))),x=root.x+d.x*length,y=root.y+d.y*length;
      ink.lineStyle(5,0x3f3024,.7).strokeCircle(x,y,28+(1-u)*18);
      ink.lineStyle(2.5,0xf1ca8a,.65+u*.3).strokeCircle(x,y,28+(1-u)*18);
      for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ink.lineStyle(2,0x79543e,.7).lineBetween(root.x+Math.cos(a)*12,root.y+Math.sin(a)*12,root.x+Math.cos(a)*(25+u*15),root.y+Math.sin(a)*(25+u*15));}
    }
    if(attack.type==='leaf'){const angle=Math.atan2(d.y,d.x),points=[{x:root.x,y:root.y},...Array.from({length:12},(_,i)=>({x:root.x+Math.cos(angle-.85+i/11*1.7)*72,y:root.y+Math.sin(angle-.85+i/11*1.7)*72}))];ink.fillStyle(0xc18c62,.12).fillPoints(points.map(p=>new Phaser.Math.Vector2(p.x,p.y)),true);}
  }
  finishWarnings(){for(const [id,ink] of this.danger)if(!this.dangerUsed.has(id)){ink.destroy();this.danger.delete(id);}}
  draw(body:AnimatedEnemy,attack:EnemyAttack|null|undefined,sprite:Phaser.GameObjects.Sprite,now:number,showBar=false){
    const kind=enemyKind(body.type),profile=enemyProfile(kind),maxHP=body.maxHP??creatureMaxHP(kind,body.elite);
    let entry=this.entries.get(sprite);if(!entry){entry={motion:new EnemyAnimation(),hp:body.hp??maxHP,trail:body.hp??maxHP,trailStart:body.hp??maxHP,hitAt:-Infinity};this.entries.set(sprite,entry);}
    const pose=entry.motion.sample(body,attack,now);entry.pose=pose;
    const lift=attack&&!attack.cancelled&&pose.action==='attack'?sampleEnemyAttack(attack,now,body).offset.y:0;
    const alpha=pose.action==='death'?Math.max(0,1-Math.max(0,pose.elapsed-2000)/400):1;
    sprite.setTexture(`enemy-${kind}`,pose.frame).setOrigin(.5,110/128).setDisplaySize(160*profile.height/60,160*profile.height/60)
      .setPosition(body.x,body.y+lift).setDepth(body.y).setRotation(0).setAlpha(alpha).setVisible(alpha>0).clearTint();
    Actor.mirror(sprite,pose.facing===2);
    if((body.eliteLevel??0)>0){
      sprite.setTint(0xeac3ed);
      if(!entry.eliteLabel){const label=this.scene.add.text(0,0,'',{fontFamily:'sans-serif',fontSize:'13px',color:'#f5d5ff',stroke:'#291d36',strokeThickness:3}).setOrigin(.5,1);entry.eliteLabel=label;this.eliteLabels.add(label);sprite.once('destroy',()=>{this.eliteLabels.delete(label);label.destroy();});}
      entry.eliteLabel.setText(`精英${body.eliteLevel}阶`).setPosition(body.x,body.y-profile.height*1.45-19).setDepth(8998).setVisible(showBar&&(body.hp??0)>0&&alpha>0);
    }else entry.eliteLabel?.setVisible(false);
    if(body.elite&&(body.hp??1)>0)this.bars.lineStyle(2,0xe9c77b,.8).strokeEllipse(body.x,body.y,62,22);
    if(showBar&&(body.hp??1)>0){
      const hp=body.hp??maxHP;if(hp<entry.hp){entry.trailStart=Math.max(entry.hp,entry.trail);entry.hitAt=now;}entry.hp=hp;
      const trail=now-entry.hitAt<250?entry.trailStart:Math.max(hp,entry.trailStart-(now-entry.hitAt-250)/500*maxHP);entry.trail=trail;
      const x=body.x-23,y=body.y-profile.height*1.45-15;
      this.bars.fillStyle(0x15372d,.95).fillRoundedRect(x-2,y-2,50,9,2).lineStyle(1,0xe9e4cd,.85).strokeRoundedRect(x-2,y-2,50,9,2);
      this.bars.fillStyle(0xd6bc7c,1).fillRect(x,y,46*Math.min(1,trail/maxHP),5).fillStyle(0xc26a58,1).fillRect(x,y,46*Math.min(1,hp/maxHP),5);
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
