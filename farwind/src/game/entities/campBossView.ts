import {BossArtCache} from './bossArtCache';
import Phaser from 'phaser';
import {CAMP_BOSSES,BOSS_RULES,type CampBossKind} from '../../data/maps/windbell/campBosses';
import {Actor} from './actor';
import {slimeFacing,SlimeAnimation} from '../systems/slimeAnimation';
import {sampleEnemyAttack,sporeDirections,sporeOrigin,SPORE,type EnemyAttack,type AttackGeometry} from '../systems/enemyAttack';
import {bossHazardGeometry,bossAttackSpace} from '../systems/campBossCombat';
import type {BossHazard} from '../systems/campBossState';
import type {EnemyBody} from '../systems/enemy';
import type {AnimatedEnemy,EnemyPose} from '../systems/enemyAnimation';
import type {State} from '../systems/state';
import {ENCOUNTERS} from '../../data/maps/windbell/encounters';
import {CampBossEffects} from './campBossEffects';
import {WARNING,drawDanger,previewWarning,projectileWarning,warningProgress} from './attackWarningView';
import {sampleBossParry,type BossParryPose} from '../systems/bossParry';
import {BossMotion} from '../systems/bossMotion';
import {BossRig} from './bossRig';
import {isWolfClaw,wolfClawView} from '../systems/wolfClaw';

export class CampBossView{
  entries=new WeakMap<Phaser.GameObjects.Sprite,{motion:SlimeAnimation;continuous:BossMotion;rig?:BossRig;pose?:EnemyPose;parry:BossParryPose|null}>();
  rigs=new Set<BossRig>();
  ink:Phaser.GameObjects.Graphics;
  warningFill:Phaser.GameObjects.Graphics;
  warningEdge:Phaser.GameObjects.Graphics;
  reaction:Phaser.GameObjects.Text;
  effects:CampBossEffects;
  assets:BossArtCache;
  static preload(_scene:Phaser.Scene){}
  constructor(public scene:Phaser.Scene){this.warningFill=scene.add.graphics().setDepth(WARNING.floor);this.warningEdge=scene.add.graphics().setDepth(WARNING.floor+1);this.assets=new BossArtCache(scene);this.effects=new CampBossEffects(scene);this.ink=scene.add.graphics().setDepth(8994);this.reaction=scene.add.text(0,0,'',{fontFamily:'sans-serif',fontSize:'14px',color:'#fff0cc',backgroundColor:'#233c34e8',padding:{x:8,y:5}}).setOrigin(.5,1).setDepth(8996).setVisible(false);}
  reset(){for(const rig of this.rigs)rig.destroy();this.rigs.clear();this.entries=new WeakMap();this.ink.clear();this.warningFill.clear();this.warningEdge.clear();this.effects.begin();this.reaction.setVisible(false);}
  begin(){for(const rig of this.rigs)rig.setVisible(false);this.ink.clear();this.warningFill.clear();this.warningEdge.clear();this.effects.begin();this.reaction.setVisible(false);}
  draw(body:AnimatedEnemy&Pick<EnemyBody,'boss'|'bossBattle'>,attack:EnemyAttack|null|undefined,sprite:Phaser.GameObjects.Sprite,now:number,showBar:boolean):EnemyPose{
    const kind=body.boss!,d=CAMP_BOSSES[kind];
    let entry=this.entries.get(sprite);if(!entry){entry={motion:new SlimeAnimation(),continuous:new BossMotion(),parry:null};this.entries.set(sprite,entry);}
    const base=entry.motion.sample(body,attack,now);if(base.action==='idle'&&body.face)base.facing=entry.motion.facing=slimeFacing(body.face.x,body.face.y,base.facing);if(isWolfClaw(attack)&&!attack!.cancelled){const view=wolfClawView(attack!);base.facing=entry.motion.facing=view==='down'?0:view==='up'?1:attack!.direction.x<0?2:3;}const direction=base.facing===0?0:base.facing===1?1:2;
    const arriving=(body.hp??0)>0&&!!body.bossBattle&&now<body.bossBattle.entryUntil,u=arriving?Math.max(0,Math.min(1,1-(body.bossBattle!.entryUntil-now)/BOSS_RULES.appearance)):1;
    const parry=sampleBossParry(body,now);entry.parry=parry;
    let phase=base.phase,action:EnemyPose['action']=base.action;
    const dir=direction===0?'down':direction===1?'up':'right',frameName=`${dir}/idle`;
    if(arriving){phase='首领现身';action='idle';this.arrivalEffect(kind,body,u);}
    else if(body.bossBattle&&now<body.bossBattle.transformUntil){phase='阶段转换';action='idle';}
    else if(parry){phase=parry.phase;action=parry.quality==='perfect'?'perfect':'parry';}
    else if(attack&&!attack.cancelled&&now<attack.recoveryUntil){const sample=sampleEnemyAttack(attack,now,body);phase=sample.phase;action='attack';}
    else if(body.bossBattle&&body.bossBattle.exposedUntil>now&&body.bossBattle.lastSkill!==undefined&&body.bossBattle.lastSkill>=0){phase='弱点暴露';action='idle';}
    const pose:EnemyPose={...base,action,phase,index:0,frame:0,provisional:!this.assets.ready(kind)};entry.pose=pose;
    const art=this.assets.manifest?.frames[frameName],alpha=arriving?Math.min(1,u/.55):base.action==='death'?Math.max(0,1-Math.max(0,base.elapsed-1200)/500):1;
    if(art&&this.assets.ready(kind)){const scale=d.height/art.nativeHeight*(arriving?.85+.15*u:1);
      sprite.setTexture(this.assets.key(kind),frameName).setOrigin(art.foot[0]/art.width,art.foot[1]/art.height).setDisplaySize(art.width*scale*(parry?.scaleX??1),art.height*scale*(parry?.scaleY??1)).setPosition(body.x+(parry?.x??0),body.y+(parry?.y??0)).setDepth(body.y).setRotation(parry?.rotation??0).setAlpha(alpha).setVisible(alpha>0).clearTint();Actor.mirror(sprite,base.facing===2);
      if(!entry.rig){const owner=entry;entry.rig=new BossRig(this.scene,this.assets.key(kind),sprite,()=>{if(owner.rig)this.rigs.delete(owner.rig);owner.rig=undefined;});this.rigs.add(entry.rig);}
      const motion=entry.continuous.sample(kind,arriving||parry||phase==='阶段转换'?null:attack,now,entry.motion.distance,action==='walk');
      entry.rig.draw(kind,sprite,art,motion,arriving||parry||phase==='阶段转换'?null:attack,now);
    }else sprite.setVisible(false);
    this.effects.draw(body,attack,now,parry,dir);
    if(body.bossBattle?.phase===2&&(body.hp??0)>0)this.ink.lineStyle(2,d.color,.25+Math.sin(now/260)*.1).strokeEllipse(body.x,body.y-3,64,23);
    if(showBar&&(body.hp??0)>0&&!arriving){const x=body.x-35,y=body.y-d.height-14;this.ink.fillStyle(0x18372d,.95).fillRoundedRect(x-2,y-2,74,10,2).fillStyle(0xdbb47c).fillRect(x,y,70*(body.hp??0)/d.hp,6);}
    return pose;
  }
  // 显形直接读取战斗时钟；暂停、保存、撤离和读档无需另一套动画计时器。
  arrivalEffect(kind:CampBossKind,p:{x:number;y:number},u:number,strength=1){
    const ink=this.ink,color=CAMP_BOSSES[kind].color,alpha=(1-u)*strength,r=28+u*64;
    ink.fillStyle(color,alpha*.12).fillEllipse(p.x,p.y-3,r*2,r*.85).lineStyle(2,color,alpha*.8).strokeEllipse(p.x,p.y-3,r*2,r*.85);
    for(let i=0;i<12;i++){
      const angle=i*Math.PI/6+(kind==='bound-branch'?u*3:0),radius=22+u*(35+i%3*12),x=p.x+Math.cos(angle)*radius,y=p.y-8+Math.sin(angle)*radius*.42;
      if(kind==='spore-heart')ink.fillStyle(color,alpha*.75).fillCircle(x,y-u*(45+i%3*15),2+i%3).lineStyle(1,0xf3e1b2,alpha*.5).strokeCircle(x,y-u*(45+i%3*15),4+i%3);
      else if(kind==='thorn-crown'){ink.lineStyle(3,0x334631,alpha*.7).lineBetween(x,y,x+Math.cos(angle)*16,y-18-u*12);ink.lineStyle(1,color,alpha).lineBetween(x,y,x+Math.cos(angle)*16,y-18-u*12);}
      else if(kind==='crag-tusk'){ink.lineStyle(2,0x49392d,alpha*.8).lineBetween(p.x+Math.cos(angle)*12,p.y+Math.sin(angle)*5,x,y);ink.fillStyle(color,alpha).fillTriangle(x-4,y-u*24,x+5,y-u*24-3,x+1,y-u*24-9);}
      else{ink.fillStyle(color,alpha*.85).fillTriangle(x,y-u*42,x+Math.cos(angle+.5)*14,y-u*42+Math.sin(angle+.5)*7,x+Math.cos(angle-.5)*14,y-u*42+Math.sin(angle-.5)*7);ink.lineStyle(1,0xe2f6c8,alpha*.65).lineBetween(x,y-u*42,x+Math.cos(angle)*14,y-u*42+Math.sin(angle)*7);}
    }
  }
  geometry(g:AttackGeometry,progress:number|null,spikes=false){drawDanger(this.warningEdge,this.warningFill,g,progress,spikes);}
  warning(root:EnemyBody,a:EnemyAttack,now:number){
    if(a.cancelled||a.emitted||a.damage<=0||now>=a.contactAt)return;
    const progress=warningProgress(a.startedAt,a.contactAt,now);
    // 地面预警只读取已创建的正式危险区，不能画预算或地形拒绝的落点。
    if(a.bossArea)return;
    if(a.bossShotAngles){for(const d of sporeDirections(a))drawDanger(this.warningEdge,this.warningFill,projectileWarning(sporeOrigin(root,d,true),d,SPORE.speed*SPORE.life/1000),progress);}
    else if(a.bossCocoon)this.warningEdge.lineStyle(3,0x9ed5b6,.9).strokeEllipse(root.x,root.y,86,36);
    else drawDanger(this.warningEdge,this.warningFill,previewWarning(a,root,bossAttackSpace(root)),progress);
  }
  ground(hazards:readonly BossHazard[],s:State,now:number){
    if(s.life.playerSpace!=='village')return;
    s=s.windMemory.active?{...s,encounters:s.windMemory.active.encounters}:s;
    for(const h of hazards){this.effects.ground(h,now);this.geometry(bossHazardGeometry(h,now),now<h.activeAt?warningProgress(h.born,h.activeAt,now):null,true);}
    for(const d of ENCOUNTERS){const b=s.encounters.groups[d.id].boss;if(!b||Math.hypot(s.player.x-d.x,s.player.y-d.y)>d.radius+80)continue;
      const kind=d.members.find(m=>m.boss)?.boss;if(!kind)continue;
      if(b.stage==='battle'||b.stage==='warning')this.ink.lineStyle(3,CAMP_BOSSES[kind].color,.5).strokeCircle(d.x,d.y,d.radius+80);
      if(b.stage==='defeated'||b.stage==='legacy'){this.reaction.setText('E · 风忆远征').setPosition(d.x,d.y-70).setAlpha(1).setVisible(true);}
      if(b.stage==='warning'){const u=1-b.warning/BOSS_RULES.entry;this.arrivalEffect(kind,d,u*.4,.65);this.ink.lineStyle(3,0xf0d7a1,.5+u*.4).strokeEllipse(d.x,d.y,100+u*45,45+u*18);}
      const remaining=b.combat?.battle.entryUntil??0;
      if(b.stage==='battle'&&remaining>0){const lines:Record<CampBossKind,string>={'spore-heart':'孢子在聚集……小心！','thorn-crown':'荆棘里有动静……来了！','crag-tusk':'地面在震……准备迎敌！','bound-branch':'风被缠住了……小心！'};this.reaction.setText('旅人：'+lines[kind]).setPosition(s.player.x,s.player.y-112).setAlpha(Math.min(1,remaining/250)).setVisible(true);}
    }
  }
  debug(sprite:Phaser.GameObjects.Sprite){return this.entries.get(sprite)?.pose;}
  debugReaction(sprite:Phaser.GameObjects.Sprite){return this.entries.get(sprite)?.parry??null;}
  syncImpact(sprite:Phaser.GameObjects.Sprite){this.entries.get(sprite)?.rig?.syncImpact(sprite);}
  visible(sprite:Phaser.GameObjects.Sprite){return this.entries.get(sprite)?.rig?.mesh.visible??sprite.visible;}
  debugMotion(sprite:Phaser.GameObjects.Sprite){const e=this.entries.get(sprite),rig=e?.rig;if(!rig)return null;const v=rig.mesh.vertices;return {mode:'连续关节网格',vertices:v.length/4,visible:rig.mesh.visible,pose:{...e!.continuous.current},clawTip:rig.clawTip?{...rig.clawTip}:null,points:[50,150,250,350,430].map(i=>[v[i*4],v[i*4+1]])};}
}
