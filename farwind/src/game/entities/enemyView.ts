import type {BossAtlas} from './bossArtCache';
import {FUNGAL,fungalShieldActive} from '../systems/fungalCombat';
import {enemyAttackSpace,type EnemyBody} from '../systems/enemy';
import {CampBossView} from './campBossView';
import Phaser from 'phaser';
import {creatureMaxHP} from '../../data/maps/windbell/elites';
import {ENEMIES,enemyProfile,enemyKind,enemyArt} from '../../data/enemies';
import {BOSS_PROJECTILES} from '../../data/maps/windbell/campBosses';
import {EnemyAnimation,type AnimatedEnemy,type EnemyPose} from '../systems/enemyAnimation';
import {sampleEnemyAttack,type EnemyAttack,SPORE,sporeDirections,sporeOrigin} from '../systems/enemyAttack';
import type {EnemyProjectiles} from '../systems/enemyProjectiles';
import {Actor} from './actor';
import {WARNING,drawDanger,previewWarning,projectileWarning,warningProgress} from './attackWarningView';
import {drawSpawnCues} from './enemySpawnView';
import type {SpawnCue} from '../systems/encounterRuntime';
import {groundShadows} from '../rendering/groundShadows';
type Entry={motion:EnemyAnimation;pose?:EnemyPose;hp:number;trail:number;trailStart:number;hitAt:number;eliteLabel?:Phaser.GameObjects.Text;mechanicLabel?:Phaser.GameObjects.Text};
export class EnemyView {
  boss:CampBossView;
  entries=new WeakMap<Phaser.GameObjects.Sprite,Entry>();
  bars:Phaser.GameObjects.Graphics;
  shotTrails:Phaser.GameObjects.Graphics;
  warningFill:Phaser.GameObjects.Graphics;
  spawnInk:Phaser.GameObjects.Graphics;
  shots=new Map<string,Phaser.GameObjects.Image>();
  danger=new Map<string,Phaser.GameObjects.Graphics>();
  dangerUsed=new Set<string>();
  eliteLabels=new Set<Phaser.GameObjects.Text>();
  static preload(scene:Phaser.Scene){
    CampBossView.preload(scene);
    for(const kind of Object.keys(ENEMIES)){
      if(['archer','bell','shade','geomancer'].includes(kind)){scene.load.json(`enemy-hd-index-${kind}`,`/assets/enemies-combat-v2/${kind}/index.json`);scene.load.multiatlas(`enemy-hd-${kind}`,`/assets/enemies-combat-v2/${kind}/atlas.json`,`/assets/enemies-combat-v2/${kind}/`);continue;}
      const art=enemyArt(kind),loadType=scene.load.imageLoadType;
      // 大图直接交给浏览器解码，避免内置浏览器的 XHR→blob 路径加载失败；素材和帧尺寸保持原值。
      if(art.frameWidth>160)scene.load.imageLoadType='HTMLImageElement';
      scene.load.spritesheet(`enemy-${kind}`,art.path,{frameWidth:art.frameWidth,frameHeight:art.frameHeight});
      scene.load.imageLoadType=loadType;
    }
    scene.load.json('combat-mechanism-index','/assets/combat-mechanisms/index.json');scene.load.multiatlas('combat-mechanisms','/assets/combat-mechanisms/atlas.json','/assets/combat-mechanisms/');
    scene.load.image('fungal-root','/assets/enemies-v1/fungal-root.png');
    scene.load.image('spore-projectile','/assets/enemies-v1/spore-projectile.png');scene.load.image('spore-burst','/assets/enemies-v1/spore-burst.png');
  }
  constructor(public scene:Phaser.Scene){this.spawnInk=scene.add.graphics().setDepth(WARNING.floor+2);this.warningFill=scene.add.graphics().setDepth(WARNING.floor);this.boss=new CampBossView(scene);this.bars=scene.add.graphics().setDepth(8997);this.shotTrails=scene.add.graphics().setDepth(8995);
    // 纹理每场景只生成一次；拖尾共用画布，不在每帧新建粒子或图形对象。
    if(!scene.textures.exists('archer-projectile')){const ink=scene.add.graphics();ink.lineStyle(7,0x293b2c,1).lineBetween(8,24,40,24).lineStyle(3,0xede2ae,1).lineBetween(8,24,40,24).fillStyle(0xdaf5d4,1).fillTriangle(44,24,32,18,32,30).lineStyle(2,0x759466,1).lineBetween(7,18,16,24).lineBetween(7,30,16,24);ink.generateTexture('archer-projectile',48,48);ink.destroy();}
    for(const [kind,s] of Object.entries(BOSS_PROJECTILES)){const key='boss-projectile-'+kind;if(scene.textures.exists(key))continue;
      const ink=scene.add.graphics(),c=s.size/2;ink.fillStyle(s.color,.23).fillCircle(c,c,c);
      if(kind==='spore-heart')ink.fillStyle(s.outline,1).fillCircle(c,c,SPORE.radius).fillStyle(s.color,1).fillCircle(c,c,11.5).lineStyle(1,s.core,.9).strokeCircle(c,c,10).fillStyle(s.core,1).fillCircle(c+2,c-2,5);
      else ink.fillStyle(s.outline,1).fillTriangle(c+14,c,c-13,c-9,c-13,c+9).fillStyle(s.color,1).fillTriangle(c+11,c,c-10,c-6,c-10,c+6).lineStyle(2,s.core,1).lineBetween(c-8,c,c+9,c);
      ink.generateTexture(key,s.size,s.size);ink.destroy();
    }
  }
  reset(){this.spawnInk.clear();this.boss.reset();this.entries=new WeakMap();this.warningFill.clear();this.bars.clear();this.shotTrails.clear();for(const im of this.shots.values())im.destroy();this.shots.clear();for(const ink of this.danger.values())ink.destroy();this.danger.clear();for(const label of this.eliteLabels)label.destroy();this.eliteLabels.clear();}
  spawn(cues:Iterable<SpawnCue>,now:number,visible:boolean){drawSpawnCues(this.spawnInk,cues,now);this.spawnInk.setVisible(visible);}
  begin(){this.boss.begin();this.warningFill.clear();this.bars.clear();this.dangerUsed.clear();for(const label of this.eliteLabels)label.setVisible(false);for(const ink of this.danger.values())ink.clear();}
  warn(root:{x:number;y:number},attack:EnemyAttack,now:number){
    if(attack.type==='geomancer'||attack.cancelled||attack.damage<=0)return;
    const bomb=attack.type==='bomber'&&attack.bombAt!==undefined&&now>=attack.activeUntil&&now<attack.bombAt;
    if(!bomb&&(attack.emitted||now>=attack.contactAt))return;
    const id=attack.attackerId;this.dangerUsed.add(id);let ink=this.danger.get(id);if(!ink){ink=this.scene.add.graphics().setDepth(WARNING.floor+1);this.danger.set(id,ink);}
    if(bomb){drawDanger(ink,this.warningFill,{kind:'circle',a:root,b:root,radius:FUNGAL.blastRadius},warningProgress(attack.activeUntil,attack.bombAt!,now),true);return;}
    const progress=warningProgress(attack.startedAt,attack.contactAt,now);
    if(['spore','archer'].includes(attack.type)){
      for(const d of sporeDirections(attack))drawDanger(ink,this.warningFill,projectileWarning(sporeOrigin(root,d),d,SPORE.speed*SPORE.life/1000),progress);
      return;
    }
    const space='homeX' in root?enemyAttackSpace(root as EnemyBody):undefined;
    const geometry=previewWarning(attack,root,space);
    drawDanger(ink,this.warningFill,geometry,progress);
    if(attack.type==='burrow')drawDanger(ink,this.warningFill,{kind:'circle',a:geometry.b,b:geometry.b,radius:geometry.radius},progress,true);
  }
  finishWarnings(){for(const [id,ink] of this.danger)if(!this.dangerUsed.has(id)){ink.destroy();this.danger.delete(id);}}
  draw(body:AnimatedEnemy,attack:EnemyAttack|null|undefined,sprite:Phaser.GameObjects.Sprite,now:number,showBar=false){
    if(body.boss){const pose=this.boss.draw(body,attack,sprite,now,showBar);body.hurtboxFacing=pose.facing;return pose;}
    const kind=enemyKind(body.type),profile=enemyProfile(kind),maxHP=body.maxHP??creatureMaxHP(kind,body.elite);
    let entry=this.entries.get(sprite);if(!entry){entry={motion:new EnemyAnimation(),hp:body.hp??maxHP,trail:body.hp??maxHP,trailStart:body.hp??maxHP,hitAt:-Infinity};this.entries.set(sprite,entry);}
    const pose=entry.motion.sample(body,attack,now);entry.pose=pose;body.hurtboxFacing=pose.facing;
    const lift=attack&&!attack.cancelled&&pose.action==='attack'?sampleEnemyAttack(attack,now,body).offset.y:0;
    const alpha=pose.action==='death'?Math.max(0,1-Math.max(0,pose.elapsed-2000)/400):1;
    const art=enemyArt(kind),scale=profile.height/art.nativeHeight;
    sprite.setTexture(['archer','bell','shade','geomancer'].includes(kind)?`enemy-hd-${kind}`:`enemy-${kind}`,['archer','bell','shade','geomancer'].includes(kind)?'down/idle':pose.frame).setOrigin(.5,art.originY).setDisplaySize(art.frameWidth*scale,art.frameHeight*scale)
      .setPosition(body.x,body.y+lift).setDepth(body.y).setRotation(0).setAlpha(alpha).setVisible(alpha>0).clearTint();
    if(['archer','bell','shade','geomancer'].includes(kind)){
      const dir=pose.facing===0?'down':pose.facing===1?'up':'right',action=pose.action==='walk'?`walk/${pose.index%2}`:pose.action==='attack'?pose.phase==='active'?'strike':pose.phase==='recovery'?'recover':'charge':'idle',name=`${dir}/${action}`,atlas=this.scene.cache.json.get(`enemy-hd-index-${kind}`) as BossAtlas,frame=atlas?.frames[name];
      if(frame&&this.scene.textures.exists(`enemy-hd-${kind}`)){
        const k=profile.height/frame.nativeHeight;sprite.setTexture(`enemy-hd-${kind}`,name).setOrigin(frame.foot[0]/frame.width,frame.foot[1]/frame.height).setDisplaySize(frame.width*k,frame.height*k);
        if(pose.action==='death'){
          // 高清图集没有阵亡格：沿正式死亡时钟连续倒地，脚根仍由战斗身体持有；倒地后沿共享时窗淡出。
          const t=Math.min(1,pose.elapsed/650),fall=t*t*(3-2*t),side=pose.facing===2?-1:1;
          sprite.setDisplaySize(frame.width*k*(1-.45*fall),frame.height*k*(1-.1*fall)).setRotation(side*1.35*fall).setPosition(body.x,body.y-profile.height*.2*fall);
        }
      }else sprite.setVisible(false);
    }
    Actor.mirror(sprite,pose.facing===2);
    if(body.passiveRoot){const kind=body.passiveRoot.kind,atlas=this.scene.cache.json.get('combat-mechanism-index') as BossAtlas,frame=kind&&atlas?.frames[kind];if(frame){const h={root:90,sac:72,rock:115,sigil:108}[kind!],k=h/frame.nativeHeight;sprite.setTexture('combat-mechanisms',kind!).setOrigin(frame.foot[0]/frame.width,frame.foot[1]/frame.height).setDisplaySize(frame.width*k,frame.height*k);Actor.mirror(sprite,false);}else sprite.setTexture('fungal-root').setDisplaySize(160,160);sprite.setAlpha((body.hp??0)>0?1:0);}
    if(kind==='priest'||kind==='bomber'){
      if(!entry.mechanicLabel){const label=this.scene.add.text(0,0,'',{fontFamily:'sans-serif',fontSize:'12px',color:'#f4e8bf',stroke:'#253e2d',strokeThickness:3}).setOrigin(.5,1);entry.mechanicLabel=label;this.eliteLabels.add(label);sprite.once('destroy',()=>{this.eliteLabels.delete(label);label.destroy();});}
      const label=body.passiveRoot?({root:'祭根 · 拆除护心',sac:'孢囊 · 提前击破',rock:'岩柱 · 诱导冲撞',sigil:'祭印 · 中止仪式'}[body.passiveRoot.kind??'root']):kind==='priest'?'菌铃祭司 · 可打断':attack?.bombAt!==undefined&&now>=attack.activeUntil&&now<attack.bombAt?'囊袋膨胀 · 重击打断':'爆囊滚兽';
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
    for(const s of system.shots){let im=this.shots.get(s.id);if(!im){im=this.scene.add.image(s.x,s.y-28,'spore-projectile');this.shots.set(s.id,im);const source=im;groundShadows(this.scene).add(source,undefined,{label:'飞行弹体',width:18,height:7,projection:false,root:()=>({x:source.x,y:source.y+28,depth:source.y+27.5}),visible:()=>source.visible&&source.texture.key!=='spore-burst'});}
      const burst=s.state==='burst',u=burst?Math.min(1,(now-(s.burstAt??now))/SPORE.burst):0;
      const needle=s.attack.type==='archer',style=BOSS_PROJECTILES[s.attack.boss as keyof typeof BOSS_PROJECTILES],size=style?style.size+u*30:burst?28+u*30:needle?36:20;
      im.setTexture(style?'boss-projectile-'+s.attack.boss:!burst&&needle?'archer-projectile':burst?'spore-burst':'spore-projectile').setPosition(s.x,s.y-28).setDepth(style?8995:s.y+1).setDisplaySize(size,size)
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
      if(e.passiveRoot&&(!e.passiveRoot.kind||['root','sigil'].includes(e.passiveRoot.kind))&&!e.passiveRoot.owner.startsWith('event:')){const owner=peers.find(p=>p.id===e.passiveRoot!.owner&&p.hp>0);if(owner)this.bars.lineStyle(3,0xb4cf85,.85).lineBetween(e.x,e.y-32,owner.x,owner.y-42);}
    }
  }
  debug(sprite:Phaser.GameObjects.Sprite){const boss=this.boss.debug(sprite);if(boss)return {pose:boss,continuous:this.boss.debugMotion(sprite),parryReaction:this.boss.debugReaction(sprite),root:[sprite.x,sprite.y],rotation:sprite.rotation,frame:sprite.frame.name,origin:[sprite.originX,sprite.originY],scale:[sprite.scaleX,sprite.scaleY],flip:sprite.flipX,provisional:boss.provisional};const e=this.entries.get(sprite);return e?{pose:e.pose,root:[e.motion.motion.last?.x,e.motion.motion.last?.y],rotation:sprite.rotation,alpha:sprite.alpha,visible:sprite.visible,frame:sprite.frame.name,origin:[sprite.originX,sprite.originY],scale:[sprite.scaleX,sprite.scaleY],flip:sprite.flipX,provisional:true}:null;}
}
