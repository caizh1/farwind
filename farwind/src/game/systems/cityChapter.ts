import type {World} from '../scenes/World';
import type {EnemyContact,EnemyAttack,AttackGeometry} from './enemyAttack';
import {aim,geometryTouches} from './enemyAttack';
import {attackConfig,type Attack} from './combat';
import {outgoingDamage} from './economy';
import {resolveDamage,type DamageEvent} from './damage';
import type {CityBossState} from './cityProgress';
import type {NavigationBudget} from './enemy';
import {spaceClear} from './npcNavigation';
import type Phaser from 'phaser';
export const CITY_BOSS_ID='city-wind-guardian';
export const cityBossAttackDuration=(b:CityBossState)=>b.hp<=550?2400:3000;
export function cityBossGeometry(b:CityBossState):AttackGeometry[]{
 const root={x:700,y:720},direction=aim(root,b.target);
 if(b.attack==='sweep')return [{a:root,b:root,radius:190,kind:'sector',direction,halfAngle:1.08}];
 if(b.attack==='charge')return [{a:root,b:root,radius:215,kind:'circle'}];
 return [-1,0,1].map(i=>{const point={x:Math.max(420,Math.min(980,b.target.x+i*100)),y:Math.max(465,Math.min(920,b.target.y+i%2*70))};return {a:point,b:point,radius:58,kind:'circle' as const};});
}
export class CityChapter {
 body:ReturnType<World['makeEnemy']>|null=null;private ink:Phaser.GameObjects.Graphics;private label:Phaser.GameObjects.Text;
 private effects:Phaser.GameObjects.Image[]=[];
 constructor(private w:World){this.ink=w.add.graphics();this.label=w.add.text(700,405,'',{fontSize:'14px',color:'#fae7b8',stroke:'#213e45',strokeThickness:3}).setOrigin(.5).setDepth(8999);}
 active(){return this.w.state.life.playerSpace==='city:tower'&&this.w.state.city.progress.boss.stage==='battle';}
 boundary(now:number){
  if(!this.active())return Infinity;if(this.body&&this.body.staggerUntil>now)return this.body.staggerUntil;
  const b=this.w.state.city.progress.boss,next=[650,1050,1350,1450,1650,1750,cityBossAttackDuration(b)].filter(age=>age>b.age+1e-7);
  return next.length?now+Math.min(...next)-b.age:Infinity;
 }
 blocks(from:{x:number;y:number},to:{x:number;y:number}){return this.active()&&Math.hypot(to.x-700,to.y-720)<56&&Math.hypot(to.x-700,to.y-720)<Math.hypot(from.x-700,from.y-720);}
 reset(){this.body?.sprite.destroy();this.body?.shadow.destroy();this.body=null;this.ink.clear();this.label.setVisible(false);this.effects.forEach(image=>image.setVisible(false));}
 private ensure(){const w=this.w,b=w.state.city.progress.boss;if(!this.body){this.body=w.makeEnemy({id:CITY_BOSS_ID,type:'guardian',x:700,y:720});this.body.maxHP=1100;}this.body.hp=b.hp;this.body.disabled=!this.active();return this.body;}
 step(ms:number,now:number,contacts:EnemyContact[],_budget:NavigationBudget){
  if(!this.active()){if(this.body){this.body.disabled=true;this.body.sprite.setVisible(false);this.body.shadow.setVisible(false);}return;}
  const w=this.w,b=w.state.city.progress.boss,e=this.ensure();e.disabled=false;
  if(e.staggerUntil>now)return;
  const previous=b.age;b.age=Math.min(5000,b.age+ms);
  if(previous<650)b.target={x:w.state.player.x,y:w.state.player.y};
  if(!e.attack||e.attack.attackId!==`${CITY_BOSS_ID}:${b.attempt}:${b.serial}`){const direction=aim(e,b.target),start=now-b.age;
   e.attack={attackId:`${CITY_BOSS_ID}:${b.attempt}:${b.serial}`,attackerId:CITY_BOSS_ID,type:'guardian',startedAt:start,lockAt:start+650,contactAt:start+1050,activeUntil:start+1750,recoveryUntil:start+cityBossAttackDuration(b),direction,locked:false,shape:'sweep',range:190,halfAngle:1.08,parryable:b.attack==='sweep',damage:b.attack==='charge'?28:b.attack==='pressure'?18:22,cancelled:false,resolved:b.hit,emitted:b.hit,motionAt:0,scanAt:now};}
  const a=e.attack;a.locked=b.age>=650;a.direction=aim(e,b.target);
  const moments=b.attack==='pressure'?[1050,1350,1650]:[b.attack==='charge'?1450:1050];
  if(!b.hit&&!a.cancelled&&moments.some(at=>previous<at&&b.age>=at)){
   const geometries=cityBossGeometry(b).filter((_,i)=>b.attack!=='pressure'||previous<moments[i]&&b.age>=moments[i]);
   const hit=geometries.find(g=>geometryTouches(g,w.state.player)&&spaceClear('city:tower',e,w.state.player));
   if(hit){b.hit=true;a.emitted=true;contacts.push({at:now,attack:a,origin:{x:e.x,y:e.y},geometry:hit,normal:{x:-a.direction.x,y:-a.direction.y}});}
  }
  if(b.age>=cityBossAttackDuration(b)){b.age=0;b.serial++;b.hit=false;b.attack=(['sweep','pressure','charge'] as const)[b.serial%3];b.target={x:w.state.player.x,y:w.state.player.y};e.attack=null;}
 }
 valid(contact:EnemyContact){return this.active()&&!!this.body&&this.body.hp>0&&this.body.attack===contact.attack&&!contact.attack.cancelled;}
 hit(attack:Attack,damage?:number){
  return this.damage({sourceId:'player',targetId:CITY_BOSS_ID,attackId:`player:${attack.id}:${attack.windLeg??'blade'}`,amount:damage??outgoingDamage(this.w.state,attackConfig(attack).damage),sourceType:attack.kind==='swordWind'?'player-wind':'player-melee',eventId:null});
 }
 damage(event:DamageEvent){
  const w=this.w,b=w.state.city.progress.boss;
  if(!this.active())return {applied:false,damage:0,hp:b.hp,killed:false};
  const e=this.ensure(),exposed=b.attack==='charge'&&b.age>=1700||e.staggerUntil>w.sim;
  const hit=resolveDamage({...event,amount:event.amount*(exposed?1.6:1)},{id:'player',faction:'village',hp:w.state.player.hp,armor:0},{id:CITY_BOSS_ID,faction:'hostile',hp:b.hp,armor:exposed?0:3});
  if(!hit.applied)return hit;b.hp=hit.hp;e.hp=hit.hp;w.float(e.x,e.y,String(Math.round(hit.damage)));w.snapshotPending=true;
  if(hit.killed){b.stage='defeated';b.age=0;w.state.city.progress.main=6;e.attack=null;w.combat.reset(w.combat.dashCooldown);w.keys.clear();w.ui.dialog('风塔重新平稳','守护装置的核心已经校正。到控制台领取首胜奖励；背包满时奖励会保留，刷新后仍可领取。');void w.persist(true).catch(error=>w.ui.message((error as Error).message));}
  return hit;
 }
 render(){
  const w=this.w,b=w.state.city.progress.boss,active=this.active();this.ink.clear().setDepth(7505);this.label.setVisible(active);this.effects.forEach(image=>image.setVisible(false));
  if(!active){this.body?.sprite.setVisible(false);this.body?.shadow.setVisible(false);return;}
  const e=this.ensure(),frame=b.age<650?0:b.age<1050?1:b.age<1700?2:3;
  const breath=Math.sin(b.age/180)*1.5;
  e.sprite.setTexture('city-complete-guardian-actions-v2',frame).setOrigin(.5,.94).setDisplaySize(310,310).setPosition(e.x,e.y+breath).setDepth(7500+e.y).setVisible(true);e.shadow.setPosition(e.x,e.y-3).setDepth(7500+e.y-.5).setVisible(true);
  let used=0;const effect=(art:string,x:number,y:number,width:number,height:number,alpha:number,rotation=0)=>{let image=this.effects[used++];if(!image){image=w.add.image(x,y,`city-complete-${art}`);this.effects.push(image);}image.setTexture(`city-complete-${art}`).setPosition(x,y).setDisplaySize(width,height).setAlpha(alpha).setRotation(rotation).setDepth(7500+y+1).setVisible(true);};
  effect('core-charge',e.x,e.y-85,72+Math.sin(b.age/130)*6,72+Math.sin(b.age/130)*6,b.attack==='charge'?.7:.3);
  if(b.attack==='sweep'&&b.age>=650&&b.age<1550){const direction=aim(e,b.target),angle=Math.atan2(direction.y,direction.x),u=Math.min(1,(b.age-650)/500),radius=65+u*115;
   for(const offset of [-.7,0,.7]){const a=angle+offset*(1-u*.3);effect(b.hp<=550?'wind-blade-gold':'wind-blade-blue',e.x+Math.cos(a)*radius,e.y+Math.sin(a)*radius-25,115+u*35,60+u*20,Math.sin(Math.PI*Math.min(1,(b.age-650)/900))*.8,a);}
  }else if(b.attack==='pressure'){for(const [i,g]of cityBossGeometry(b).entries()){const age=b.age-(1050+i*300);if(age>=0&&age<420)effect('wind-pressure',g.a.x,g.a.y-18,85+age*.13,65+age*.13,1-age/420);}}
  else if(b.attack==='charge'&&b.age>=650&&b.age<1750){const u=(b.age-650)/1100;effect('crystal-sparks',e.x,e.y-95,120+u*90,160+u*40,Math.sin(u*Math.PI)*.75);if(b.age>=1450)effect('wind-pressure',e.x,e.y,240+(b.age-1450)*.6,150+(b.age-1450)*.4,1-(b.age-1450)/300);}
  this.label.setText(`失控守护装置 · ${Math.ceil(b.hp)}/1100 · ${b.hp<=550?'强风阶段':'守护阶段'} · ${b.attack==='charge'&&b.age>=1700?'核心暴露':b.age<1050?'预警':'躲避后反击'}`);
  this.ink.fillStyle(0x1d3843,.9).fillRect(510,420,380,9).fillStyle(0x66d9df).fillRect(510,420,380*b.hp/1100,9);
  const geometries=cityBossGeometry(b);
  if(b.age<1750)for(const g of geometries){const alpha=b.age<1050?.12:.35;this.ink.fillStyle(b.age<1050?0xe0b35c:0x70e5ed,alpha).lineStyle(2,b.age<1050?0xffd685:0xbcffff,.8);
   if(g.kind==='sector'){const direction=g.direction!,a=Math.atan2(direction.y,direction.x);this.ink.beginPath().moveTo(g.a.x,g.a.y).arc(g.a.x,g.a.y,g.radius,a-g.halfAngle!,a+g.halfAngle!,false).closePath().fillPath().strokePath();}
   else this.ink.fillCircle(g.a.x,g.a.y,g.radius).strokeCircle(g.a.x,g.a.y,g.radius);
  }
 }
 failed(){const p=this.w.state.city.progress;if(p.boss.stage==='battle'){p.boss.stage='idle';p.boss.hp=1100;p.boss.age=0;p.boss.hit=false;this.reset();}}
}
