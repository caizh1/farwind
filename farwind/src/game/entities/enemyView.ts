import {FUNGAL,fungalShieldActive} from '../systems/fungalCombat';
import type {EnemyBody} from '../systems/enemy';
import {CampBossView} from './campBossView';
import Phaser from 'phaser';
import {creatureMaxHP} from '../../data/maps/windbell/elites';
import {ENEMIES,enemyProfile,enemyKind,enemyArt} from '../../data/enemies';
import {BOSS_PROJECTILES} from '../../data/maps/windbell/campBosses';
import {EnemyAnimation,type AnimatedEnemy,type EnemyPose} from '../systems/enemyAnimation';
import {sampleEnemyAttack,type EnemyAttack,SPORE,ENEMY_ATTACK,sporeDirections} from '../systems/enemyAttack';
import type {EnemyProjectiles} from '../systems/enemyProjectiles';
import {Actor} from './actor';
type Entry={motion:EnemyAnimation;pose?:EnemyPose;hp:number;trail:number;trailStart:number;hitAt:number;eliteLabel?:Phaser.GameObjects.Text;mechanicLabel?:Phaser.GameObjects.Text};
export class EnemyView {
  boss:CampBossView;
  entries=new WeakMap<Phaser.GameObjects.Sprite,Entry>();
  bars:Phaser.GameObjects.Graphics;
  shotTrails:Phaser.GameObjects.Graphics;
  shots=new Map<string,Phaser.GameObjects.Image>();
  danger=new Map<string,Phaser.GameObjects.Graphics>();
  dangerUsed=new Set<string>();
  eliteLabels=new Set<Phaser.GameObjects.Text>();
  static preload(scene:Phaser.Scene){
    CampBossView.preload(scene);
    for(const kind of Object.keys(ENEMIES)){const art=enemyArt(kind);scene.load.spritesheet(`enemy-${kind}`,art.path,{frameWidth:art.frameWidth,frameHeight:art.frameHeight});}
    scene.load.image('fungal-root','/assets/enemies-v1/fungal-root.png');
    scene.load.image('spore-projectile','/assets/enemies-v1/spore-projectile.png');scene.load.image('spore-burst','/assets/enemies-v1/spore-burst.png');
  }
  constructor(public scene:Phaser.Scene){this.boss=new CampBossView(scene);this.bars=scene.add.graphics().setDepth(8997);this.shotTrails=scene.add.graphics().setDepth(8995);
    // 纹理每场景只生成一次；拖尾共用画布，不在每帧新建粒子或图形对象。
    for(const [kind,s] of Object.entries(BOSS_PROJECTILES)){const key='boss-projectile-'+kind;if(scene.textures.exists(key))continue;
      const ink=scene.add.graphics(),c=s.size/2;ink.fillStyle(s.color,.23).fillCircle(c,c,c);
      if(kind==='spore-heart')ink.fillStyle(s.outline,1).fillCircle(c,c,SPORE.radius).fillStyle(s.color,1).fillCircle(c,c,11.5).lineStyle(1,s.core,.9).strokeCircle(c,c,10).fillStyle(s.core,1).fillCircle(c+2,c-2,5);
      else ink.fillStyle(s.outline,1).fillTriangle(c+14,c,c-13,c-9,c-13,c+9).fillStyle(s.color,1).fillTriangle(c+11,c,c-10,c-6,c-10,c+6).lineStyle(2,s.core,1).lineBetween(c-8,c,c+9,c);
      ink.generateTexture(key,s.size,s.size);ink.destroy();
    }
  }
  reset(){this.boss.reset();this.entries=new WeakMap();this.bars.clear();this.shotTrails.clear();for(const im of this.shots.values())im.destroy();this.shots.clear();for(const ink of this.danger.values())ink.destroy();this.danger.clear();for(const label of this.eliteLabels)label.destroy();this.eliteLabels.clear();}
  begin(){this.boss.begin();this.bars.clear();this.dangerUsed.clear();for(const label of this.eliteLabels)label.setVisible(false);for(const ink of this.danger.values())ink.clear();}
  warn(root:{x:number;y:number},attack:EnemyAttack,now:number){
    if(attack.type==='bomber'&&!attack.cancelled&&attack.bombAt!==undefined&&now>=attack.activeUntil&&now<attack.recoveryUntil){
      const id=attack.attackerId;this.dangerUsed.add(id);let ink=this.danger.get(id);if(!ink){ink=this.scene.add.graphics();this.danger.set(id,ink);}
      const progress=Math.min(1,(now-attack.activeUntil)/(attack.bombAt-attack.activeUntil)),exploded=now>=attack.bombAt;
      ink.setDepth(8995).fillStyle(0xc47d49,exploded?.28:.09).fillCircle(root.x,root.y,FUNGAL.blastRadius)
        .lineStyle(3,exploded?0xffe9bb:0xe9ab69,.9).strokeCircle(root.x,root.y,FUNGAL.blastRadius)
        .lineStyle(2,0xffe9bb,.8).strokeCircle(root.x,root.y,FUNGAL.blastRadius*(1-progress));return;
    }
    if(attack.emitted||attack.cancelled||now>=attack.contactAt)return;
    const id=attack.attackerId;this.dangerUsed.add(id);let ink=this.danger.get(id);if(!ink){ink=this.scene.add.graphics();this.danger.set(id,ink);}
    // 潜地预兆属于必要的环境信号；树冠淡出层也不能盖住它。
    ink.setDepth(attack.type==='burrow'?8995:root.y-.6);const d=attack.direction,length=attack.type==='spore'?SPORE.speed*SPORE.life/1000:(attack.step??ENEMY_ATTACK[attack.type].step);
    ink.lineStyle(attack.type==='spore'?8:attack.type==='boar'?40:24,0xc18c62,.14).lineBetween(root.x,root.y,root.x+d.x*length,root.y+d.y*length);
    ink.lineStyle(1,0xffdbc0,.6).lineBetween(root.x,root.y,root.x+d.x*length,root.y+d.y*length);
    if(attack.elite==='brood'||attack.shotAngles)for(const v of sporeDirections(attack)){ink.lineStyle(12,0xc18c62,.18).lineBetween(root.x,root.y,root.x+v.x*length,root.y+v.y*length);ink.lineStyle(2,0xffdbc0,.75).lineBetween(root.x,root.y,root.x+v.x*length,root.y+v.y*length);}
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
    if(body.boss){const pose=this.boss.draw(body,attack,sprite,now,showBar);body.hurtboxFacing=pose.facing;return pose;}
    const kind=enemyKind(body.type),profile=enemyProfile(kind),maxHP=body.maxHP??creatureMaxHP(kind,body.elite);
    let entry=this.entries.get(sprite);if(!entry){entry={motion:new EnemyAnimation(),hp:body.hp??maxHP,trail:body.hp??maxHP,trailStart:body.hp??maxHP,hitAt:-Infinity};this.entries.set(sprite,entry);}
    if(kind==='bomber'&&attack)this.warn(body,attack,now);
    const pose=entry.motion.sample(body,attack,now);entry.pose=pose;body.hurtboxFacing=pose.facing;
    const lift=attack&&!attack.cancelled&&pose.action==='attack'?sampleEnemyAttack(attack,now,body).offset.y:0;
    const alpha=pose.action==='death'?Math.max(0,1-Math.max(0,pose.elapsed-2000)/400):1;
    const art=enemyArt(kind),scale=profile.height/art.nativeHeight;
    sprite.setTexture(`enemy-${kind}`,pose.frame).setOrigin(.5,art.originY).setDisplaySize(art.frameWidth*scale,art.frameHeight*scale)
      .setPosition(body.x,body.y+lift).setDepth(body.y).setRotation(0).setAlpha(alpha).setVisible(alpha>0).clearTint();
    Actor.mirror(sprite,pose.facing===2);
    if(body.passiveRoot)sprite.setTexture('fungal-root').setDisplaySize(160,160).setAlpha((body.hp??0)>0?1:0);
    if(kind==='priest'||kind==='bomber'){
      if(!entry.mechanicLabel){const label=this.scene.add.text(0,0,'',{fontFamily:'sans-serif',fontSize:'12px',color:'#f4e8bf',stroke:'#253e2d',strokeThickness:3}).setOrigin(.5,1);entry.mechanicLabel=label;this.eliteLabels.add(label);sprite.once('destroy',()=>{this.eliteLabels.delete(label);label.destroy();});}
      const label=body.passiveRoot?'菌根 · 可攻击':kind==='priest'?'菌铃祭司 · 可打断':attack?.bombAt!==undefined&&now>=attack.activeUntil&&now<attack.bombAt?'囊袋膨胀 · 重击打断':'爆囊滚兽';
      entry.mechanicLabel.setText(label).setPosition(body.x,body.y-profile.height*1.45-28).setDepth(8998).setVisible(showBar&&(body.hp??0)>0);
    }
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
    this.shotTrails.clear();
    const ids=new Set(system.shots.map(s=>s.id));for(const [id,im] of this.shots)if(!ids.has(id)){im.destroy();this.shots.delete(id);}
    for(const s of system.shots){let im=this.shots.get(s.id);if(!im){im=this.scene.add.image(s.x,s.y-28,'spore-projectile');this.shots.set(s.id,im);}
      const burst=s.state==='burst',u=burst?Math.min(1,(now-(s.burstAt??now))/SPORE.burst):0;
      const style=BOSS_PROJECTILES[s.attack.boss as keyof typeof BOSS_PROJECTILES],size=style?style.size+u*30:burst?28+u*30:20;
      im.setTexture(style?'boss-projectile-'+s.attack.boss:burst?'spore-burst':'spore-projectile').setPosition(s.x,s.y-28).setDepth(style?8995:s.y+1).setDisplaySize(size,size)
        .setRotation(burst?0:Math.atan2(s.attack.direction.y,s.attack.direction.x)).setAlpha(1-u).setVisible(visible);
      if(s.deflected)im.setTint(0xc8fff2);else im.clearTint();
      if(style&&visible&&!burst){const d=s.attack.direction,p={x:s.x-d.x*27,y:s.y-28-d.y*27},color=s.deflected?0xc8fff2:style.color;
        this.shotTrails.lineStyle(8,style.outline,.7).lineBetween(p.x,p.y,s.x,s.y-28).lineStyle(4,color,.9).lineBetween(p.x,p.y,s.x,s.y-28).lineStyle(1.5,style.core,.9).lineBetween(p.x,p.y,s.x,s.y-28);
      }
    }
  }
  mechanics(peers:readonly EnemyBody[],now:number){
    for(const e of peers){if(e.hp<=0||e.disabled)continue;
      const a=e.attack,ally=a?.supportTarget?peers.find(p=>p.id===a.supportTarget&&p.hp>0):undefined;
      if(ally&&a&&!a.cancelled&&now<a.activeUntil)this.bars.lineStyle(now<a.contactAt?1.5:3,0xb4db94,now<a.contactAt?.35:.85).lineBetween(e.x,e.y-35,ally.x,ally.y-30);
      if(fungalShieldActive(e,now))this.bars.lineStyle(3,0xc5e5ad,.9).strokeEllipse(e.x,e.y-25,70,82);
      if(e.passiveRoot&&!e.passiveRoot.owner.startsWith('event:')){const owner=peers.find(p=>p.id===e.passiveRoot!.owner&&p.hp>0);if(owner)this.bars.lineStyle(3,0xb4cf85,.85).lineBetween(e.x,e.y-32,owner.x,owner.y-42);}
    }
  }
  debug(sprite:Phaser.GameObjects.Sprite){const boss=this.boss.debug(sprite);if(boss)return {pose:boss,parryReaction:this.boss.debugReaction(sprite),root:[sprite.x,sprite.y],rotation:sprite.rotation,frame:sprite.frame.name,origin:[sprite.originX,sprite.originY],scale:[sprite.scaleX,sprite.scaleY],flip:sprite.flipX,provisional:boss.provisional};const e=this.entries.get(sprite);return e?{pose:e.pose,root:[e.motion.motion.last?.x,e.motion.motion.last?.y],frame:sprite.frame.name,origin:[sprite.originX,sprite.originY],scale:[sprite.scaleX,sprite.scaleY],flip:sprite.flipX,provisional:true}:null;}
}
