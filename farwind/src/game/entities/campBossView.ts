import Phaser from 'phaser';
import {CAMP_BOSSES,BOSS_RULES,BOSS_PROJECTILES,type CampBossKind} from '../../data/maps/windbell/campBosses';
import {CAMP_BOSS_ART} from '../../data/campBossArt';
import {Actor} from './actor';
import {slimeFacing,SlimeAnimation} from '../systems/slimeAnimation';
import {sampleEnemyAttack,sporeDirections,sporeOrigin,SPORE,type EnemyAttack,type AttackGeometry} from '../systems/enemyAttack';
import {bossHazardGeometry} from '../systems/campBossCombat';
import type {BossHazard} from '../systems/campBossState';
import type {EnemyBody} from '../systems/enemy';
import type {AnimatedEnemy,EnemyPose} from '../systems/enemyAnimation';
import type {State} from '../systems/state';
import {ENCOUNTERS} from '../../data/maps/windbell/encounters';
import {CampBossEffects} from './campBossEffects';
import {sampleBossParry,type BossParryPose} from '../systems/bossParry';

export class CampBossView{
  entries=new WeakMap<Phaser.GameObjects.Sprite,{motion:SlimeAnimation;pose?:EnemyPose;parry:BossParryPose|null}>();
  ink:Phaser.GameObjects.Graphics;
  reaction:Phaser.GameObjects.Text;
  effects:CampBossEffects;
  static preload(scene:Phaser.Scene){for(const key of Object.keys(CAMP_BOSSES))scene.load.spritesheet(`camp-boss-${key}`,`/assets/camp-bosses/${key}.png`,{frameWidth:160,frameHeight:160});}
  constructor(public scene:Phaser.Scene){this.effects=new CampBossEffects(scene);this.ink=scene.add.graphics().setDepth(8994);this.reaction=scene.add.text(0,0,'',{fontFamily:'sans-serif',fontSize:'14px',color:'#fff0cc',backgroundColor:'#233c34e8',padding:{x:8,y:5}}).setOrigin(.5,1).setDepth(8996).setVisible(false);}
  reset(){this.entries=new WeakMap();this.ink.clear();this.effects.begin();this.reaction.setVisible(false);}
  begin(){this.ink.clear();this.effects.begin();this.reaction.setVisible(false);}
  draw(body:AnimatedEnemy&Pick<EnemyBody,'boss'|'bossBattle'>,attack:EnemyAttack|null|undefined,sprite:Phaser.GameObjects.Sprite,now:number,showBar:boolean):EnemyPose{
    const kind=body.boss!,d=CAMP_BOSSES[kind],art=CAMP_BOSS_ART[kind];
    let entry=this.entries.get(sprite);if(!entry){entry={motion:new SlimeAnimation(),parry:null};this.entries.set(sprite,entry);}
    const base=entry.motion.sample(body,attack,now);if(base.action==='idle'&&body.face)base.facing=entry.motion.facing=slimeFacing(body.face.x,body.face.y,base.facing);const direction=base.facing===0?0:base.facing===1?1:2;
    const arriving=(body.hp??0)>0&&!!body.bossBattle&&now<body.bossBattle.entryUntil,u=arriving?Math.max(0,Math.min(1,1-(body.bossBattle!.entryUntil-now)/BOSS_RULES.appearance)):1;
    const parry=sampleBossParry(body,now);entry.parry=parry;
    let row=0,index=0,phase=base.phase,action:EnemyPose['action']=base.action;
    const count=(r:number)=>art.rows[direction][r],part=(start:number,length:number,u:number)=>start+Math.min(length-1,Math.max(0,Math.floor(u*length)));
    if(base.action==='death'){row=6;const first=Math.min(4,count(6)-3);index=part(first,count(6)-first,base.elapsed/1400);}
    else if(arriving){row=6;index=part(0,4,u);phase='首领现身';action='idle';this.arrivalEffect(kind,body,u);}
    else if(body.bossBattle&&now<body.bossBattle.transformUntil){row=6;index=part(0,4,1-(body.bossBattle.transformUntil-now)/1200);phase='阶段转换';action='idle';}
    else if(parry){row=5;const first=Math.min(4,count(5)-3);index=part(first,count(5)-first,parry.progress);phase=parry.phase;action=parry.quality==='perfect'?'perfect':'parry';}
    else if((body.staggerUntil??0)>now){row=5;const first=Math.min(4,count(5)-3);index=part(first,count(5)-first,base.elapsed/800);}
    else if(attack&&!attack.cancelled&&now<attack.recoveryUntil){row=1+(attack.bossSkill??0);const sample=sampleEnemyAttack(attack,now,body),n=count(row);phase=sample.phase;action='attack';
      index=sample.phase==='charge'?part(0,2,sample.progress):sample.phase==='commit'?2:sample.phase==='active'?part(3,Math.max(1,n-5),sample.progress):part(n-2,2,sample.progress);
    }else if(base.action==='hurt'){row=5;index=part(0,4,base.elapsed/320);}
    else if(base.action==='walk'){const first=Math.min(4,count(0)-2);index=part(first,count(0)-first,(entry.motion.distance%54)/54);}
    else if(body.bossBattle?.phase===2){row=6;index=Math.floor(now/360)%Math.min(4,count(6));phase='第二阶段';}
    else index=Math.floor(now/280)%Math.min(4,count(0));
    const frame=direction*63+row*9+index,pose:EnemyPose={...base,action,phase,index,frame,provisional:false};entry.pose=pose;
    const alpha=arriving?Math.min(1,u/.55):base.action==='death'?Math.max(0,1-Math.max(0,base.elapsed-2200)/500):1,size=art.frameSize*d.height/art.nativeHeight*(arriving?.85+.15*u:1);
    // 后仰围绕已校准的脚底锚点；姿态偏移不进入导航、判定、阴影或存档。
    sprite.setTexture(`camp-boss-${kind}`,frame).setOrigin(...(art.anchors as Record<number,readonly [number,number]>)[frame]).setDisplaySize(size*(parry?.scaleX??1),size*(parry?.scaleY??1)).setPosition(body.x+(parry?.x??0),body.y+(parry?.y??0)).setDepth(body.y).setRotation(parry?.rotation??0).setAlpha(alpha).setVisible(alpha>0).clearTint();Actor.mirror(sprite,base.facing===2);
    this.effects.draw(body,attack,now,parry);
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
  geometry(g:AttackGeometry,alpha:number){const ink=this.ink;
    if(g.kind==='sector'){const angle=Math.atan2(g.direction!.y,g.direction!.x),half=g.halfAngle!,points=[new Phaser.Math.Vector2(g.a.x,g.a.y),...Array.from({length:20},(_,i)=>new Phaser.Math.Vector2(g.a.x+Math.cos(angle-half+2*half*i/19)*g.radius,g.a.y+Math.sin(angle-half+2*half*i/19)*g.radius))];ink.fillStyle(0xc98767,alpha*.16).fillPoints(points,true).lineStyle(2,0xf4d2a1,alpha).strokePoints(points,true);}
    else{ink.lineStyle(3,g.kind==='ring'?0xf0b972:0xf0d2ad,alpha).strokeCircle(g.a.x,g.a.y,g.radius);if(g.kind==='ring')ink.lineStyle(2,0xbc6f53,alpha*.7).strokeCircle(g.a.x,g.a.y,g.inner??0);else{ink.fillStyle(0xac6a4b,alpha*.2).fillCircle(g.a.x,g.a.y,g.radius);for(let i=0;i<4;i++){const a=i*Math.PI/2;ink.lineStyle(2,0xf2dabc,alpha).lineBetween(g.a.x+Math.cos(a)*g.radius*.4,g.a.y+Math.sin(a)*g.radius*.4,g.a.x+Math.cos(a)*g.radius*.8,g.a.y+Math.sin(a)*g.radius*.8);}}}
  }
  warning(root:EnemyBody,a:EnemyAttack,now:number){
    if(a.cancelled||now>=a.contactAt)return;
    const alpha=a.locked?.9:.55;
    if(a.bossArea){const p=a.bossGeometry!.point;if(a.bossArea==='circle')this.geometry({kind:'circle',a:p,b:p,radius:a.bossGeometry!.radius},alpha);else this.geometry({kind:'ring',a:p,b:p,radius:a.bossGeometry!.radius,inner:BOSS_RULES.ringInner},alpha);}
    else if(a.bossShotAngles){const style=BOSS_PROJECTILES[a.boss as keyof typeof BOSS_PROJECTILES];for(const d of sporeDirections(a)){const p=sporeOrigin(root,d,true),x=p.x+d.x*SPORE.speed*SPORE.life/1000,y=p.y+d.y*SPORE.speed*SPORE.life/1000;this.ink.lineStyle(7,style.outline,alpha*.65).lineBetween(p.x,p.y,x,y).lineStyle(3,style.color,alpha*.85).lineBetween(p.x,p.y,x,y);}}
    else if(a.bossCocoon)this.ink.lineStyle(3,0x9ed5b6,alpha).strokeEllipse(root.x,root.y,86,36);
    else{this.geometry(sampleEnemyAttack(a,now,root).geometry,alpha);if((a.step??0)>30){const d=a.direction;this.ink.lineStyle(2,0xffdaa2,alpha).lineBetween(root.x,root.y,root.x+d.x*a.step!,root.y+d.y*a.step!);}}
  }
  ground(hazards:readonly BossHazard[],s:State,now:number){
    if(s.life.playerSpace!=='village')return;
    for(const h of hazards){this.effects.ground(h,now);this.geometry(bossHazardGeometry(h,now),now<h.activeAt?.5:.95);}
    for(const d of ENCOUNTERS){const b=s.encounters.groups[d.id].boss;if(!b||Math.hypot(s.player.x-d.x,s.player.y-d.y)>d.radius+80)continue;
      const kind=d.members.find(m=>m.boss)?.boss;if(!kind)continue;
      if(b.stage==='warning'){const u=1-b.warning/BOSS_RULES.entry;this.arrivalEffect(kind,d,u*.4,.65);this.ink.lineStyle(3,0xf0d7a1,.5+u*.4).strokeEllipse(d.x,d.y,100+u*45,45+u*18);}
      const remaining=b.combat?.battle.entryUntil??0;
      if(b.stage==='battle'&&remaining>0){const lines:Record<CampBossKind,string>={'spore-heart':'孢子在聚集……小心！','thorn-crown':'荆棘里有动静……来了！','crag-tusk':'地面在震……准备迎敌！','bound-branch':'风被缠住了……小心！'};this.reaction.setText('旅人：'+lines[kind]).setPosition(s.player.x,s.player.y-112).setAlpha(Math.min(1,remaining/250)).setVisible(true);}
    }
  }
  debug(sprite:Phaser.GameObjects.Sprite){return this.entries.get(sprite)?.pose;}
  debugReaction(sprite:Phaser.GameObjects.Sprite){return this.entries.get(sprite)?.parry??null;}
}
