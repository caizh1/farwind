import {WindGiftCombat} from './windGiftCombat';
import {CHAIN_LIGHTNING} from '../entities/chainLightning';
import {SwordWindView} from '../entities/swordWindView';
import {staggerEnemy} from './enemy';
import {BlackHoleSlash} from './blackHoleSlash';
import {BlackHoleView} from '../entities/blackHoleView';
import type {SwordWind,WindMotion} from './swordWind';
import {enemyLeashRadius} from './enemy';
import {catStage} from './catBond';
import {giftLevel,giftValue,advanceGiftCooldowns} from './windGifts';
import {unitState,campBossLocksAt} from './encounterState';
import type {World} from '../scenes/World';
import {RuneCombat,type RuneEvent,type RuneTarget} from './runeCombat';
import {RuneView} from '../entities/runeView';
import {runeLock,runeSnapshot,acquisitionReady,type RuneRequest} from './runeState';
import {RUNES,RETURN_RUNE,runeById} from '../../data/runes';
import {STRIKES,attackConfig,sweepMove,isWindAttack,isMeleeFinisher,type Attack} from './combat';
import {outgoingDamage} from './economy';
import {resolveDamage,type DamageEvent} from './damage';
import {reactToEnemyHit} from './enemyReaction';
import {RUNE_GROWTH} from '../../data/runeGrowth';
import {enemyProtection} from './enemyTraits';
import {firstSwordWindBlocker} from './swordWindGeometry';
import {clearMotionLine,clearMeleeLine,motionBlocked} from './obstacles';
import {delayEnemyAttack} from './enemyAttack';
import {props} from '../../data/world';
import {RETURN_WIND_ORB} from '../../data/economy';
import {save} from './save';
import {leaveRoom} from '../ui/npcLife';
export class RuneWorld {
 static preload(scene:import('phaser').Scene){RuneView.preload(scene);BlackHoleView.preload(scene);}
 gifts:WindGiftCombat;giftView:SwordWindView;
 blackHole=new BlackHoleSlash();blackHoleView:BlackHoleView;
 engine:RuneCombat;view:RuneView;eligible=new Set<string>();space='';
 attacks=new Map<number,{base:number;A:number}>();returning?:{point:{x:number;y:number};start:number;committed:boolean;origin:{x:number;y:number};node:string};lastReturnNotice=0;
 constructor(public world:World){const w=world;this.engine=new RuneCombat({state:()=>w.state,targets:()=>w.combatTargets(),A:()=>outgoingDamage(w.state,STRIKES[0].damage),visible:e=>{const v=w.cameras.main.worldView;return e.x>=v.x-100&&e.x<=v.right+100&&e.y>=v.y-100&&e.y<=v.bottom+100;},clear:(a,b)=>clearMeleeLine(a,b),blocker:firstSwordWindBlocker,damage:(e,ev)=>this.damage(e,ev),push:(e,d,amount)=>{if(e.kind==='trainingDummy'||e.boss)return 'immune';const before={x:e.x,y:e.y};sweepMove(e,d.x*amount,d.y*amount,(x,y)=>w.blocked(x,y),clearMotionLine);return Math.hypot(e.x-before.x,e.y-before.y)<amount*.75?'wall':'moved';},sound:(family,phase,now)=>w.soundFx.rune(family,phase,now),checkpoint:()=>{void w.persist().catch(()=>{});}});w.enemyProjectiles.speedScale=shot=>1-this.engine.timeSlow({...shot,boss:shot.attack.boss});this.view=new RuneView(w,this.engine);this.blackHoleView=new BlackHoleView(w,this.blackHole);this.gifts=new WindGiftCombat(this.engine,{active:()=>w.state.player.hp>0&&w.state.life.playerSpace==='village'&&w.practice.mode==='off'&&!w.lessons?.trial,now:()=>w.sim,following:()=>!!w.xiaobao?.controller.available&&w.state.xiaobao.task==='follow'&&Math.hypot(w.xiaobao.controller.x-w.state.player.x,w.xiaobao.controller.y-w.state.player.y)<=320||w.catCompanion.aura&&catStage(w.state.catBond.score)>=2,companion:()=>{const c=w.xiaobao?.controller;return c?.available&&w.state.xiaobao.task==='follow'?{hp:c.data.hp,maxHp:640,point:{x:c.x,y:c.y},heal:amount=>{c.data.hp=Math.min(640,c.data.hp+amount);}}:undefined;},move:(target,dx,dy)=>{const e=target as typeof w.enemies[number];if(e.boss||e.passiveRoot)return 0;const before={x:e.x,y:e.y};sweepMove(e,dx,dy,(x,y)=>w.blocked(x,y)||Math.hypot(x-e.homeX,y-e.homeY)>enemyLeashRadius(e),clearMotionLine,[...w.combatTargets().filter(t=>t.id!==e.id&&t.hp>0),{id:'player',...w.state.player}]);return Math.hypot(e.x-before.x,e.y-before.y);},stagger:(target,amount)=>{const e=target as typeof w.enemies[number];if(e.boss||e.passiveRoot||e.hp<=0)return;e.staggerUntil=Math.max(e.staggerUntil,w.sim)+amount;staggerEnemy(e,w.sim,e.staggerUntil-w.sim);}});this.giftView=new SwordWindView(w,this.gifts.echoes);this.reset();}
 reset(){this.gifts.clear();this.giftView.clear();this.blackHole.clear();this.blackHoleView.clear();this.engine.clear();this.engine.equipped='';this.engine.rebind();this.view.clear();this.attacks.clear();this.returning=undefined;this.space=this.world.state.life.playerSpace;this.eligible=new Set(RUNES.filter(r=>acquisitionReady(this.world.state,r)).map(r=>r.id));}
 clear(){this.gifts.clear();this.giftView.clear();this.blackHole.clear();this.blackHoleView.clear();this.engine.clear();this.view.clear();this.returning=undefined;this.attacks.clear();for(const e of [...this.world.enemies,...this.world.defense.enemies]){e.runeSlow=0;}}
 safety(){const w=this.world,p=w.state.player;return {combat:w.state.runes.peace<8000||[...w.enemies,...w.defense.enemies].some(e=>e.hp>0&&!e.disabled&&Math.hypot(e.x-p.x,e.y-p.y)<380&&clearMeleeLine(p,e)),boss:w.state.life.playerSpace==='village'&&campBossLocksAt(w.combatEncounters,p),defense:!!w.state.defense.raid,trial:!!w.lessons?.trial,story:w.ui.mode==='dialog',action:this.gifts.busy||this.blackHole.rifts.length>0||this.blackHole.blades.winds.some(x=>!x.terminated)||w.swordWind.winds.some(x=>!x.terminated)||this.engine.projectiles.length>0||this.engine.fields.length>0||this.engine.jobs.length>0||this.engine.traces.length>0||this.engine.bands.length>0||!!w.combat.attack||!!w.combat.parry||w.sim<w.combat.dashUntil};}
 lock(){return runeLock(this.safety());}
 async change(request:RuneRequest){const w=this.world;const atGeneral=w.state.life.playerSpace==='village'?w.target?.id==='service-general':w.state.life.playerSpace==='general-shop'&&w.target?.id==='interior:general-shop:counter';if(request.kind==='claim'&&request.shop&&!atGeneral)throw Error('请到风铃杂货铺购买符文。');let saving=false;try{await w.economy.run(()=>w.state,s=>runeSnapshot(s,request,this.safety()),s=>{saving=true;return save(s);},next=>{w.publishState(next);w.ui.saved(next);this.engine.rebind();this.view.clear();});}catch(error){if(saving)w.ui.saveFailed(error);throw error;}}
 capture(attack:Attack){this.gifts.capture(attack,this.world.combat.maxStage);this.engine.captureGiftAttack(`attack:${attack.id}`,isWindAttack(attack));if(this.engine.has('r01')||this.engine.has('r27'))this.engine.fx('thunder-charge',this.world.state.player,28,this.engine.has('r27')?'r27':'r01',attackConfig(attack).windup+90);if(this.engine.has('r06'))this.engine.fx('moon',this.world.state.player,38,'r06',280);if(this.engine.has('r18'))this.engine.fx('wind-band',this.world.state.player,42,'r18',260);this.attacks.set(attack.id,{base:outgoingDamage(this.world.state,attackConfig(attack).damage),A:outgoingDamage(this.world.state,STRIKES[0].damage)});if(this.attacks.size>64)this.attacks.delete(this.attacks.keys().next().value!);}
 prepare(attack:Attack,target:RuneTarget,base?:number){const snapshot=this.attacks.get(attack.id),ev=this.engine.native(`attack:${attack.id}`,target,base??snapshot?.base??outgoingDamage(this.world.state,attackConfig(attack).damage),attack.stage,isWindAttack(attack),isMeleeFinisher(attack,this.world.combat.maxStage),attack.windLeg??'out',giftValue(this.world.state.windGifts,isWindAttack(attack)?'gale':'blade')+this.gifts.bonus(attack,target));if(snapshot)ev.A=snapshot.A;ev.direction={...(attack.aim??{x:attack.facing===2?-1:attack.facing===3?1:0,y:attack.facing===1?-1:attack.facing===0?1:0})};return ev;}
 damage(e:RuneTarget,ev:RuneEvent){const w=this.world;
 if(e.kind==='trainingDummy'){w.float(e.x,e.y,`${ev.critical?'✧ ':''}${Math.round(ev.amount)}`);return {applied:true,damage:ev.amount,killed:false};}
 if(e.kind==='trainingProjection')return {applied:false,damage:0,killed:false};
 const target=e as typeof w.enemies[number],battle=target.bossBattle,controlProtected=!!target.boss&&!!battle&&(w.sim<battle.entryUntil||w.sim<battle.transformUntil||w.sim<battle.controlImmuneUntil),breaking=ev.tags.includes('breaking_tide')&&!controlProtected,origin=controlProtected&&ev.sourceRuneId==='r12'?undefined:ev.origin??ev.point;const event:DamageEvent={sourceId:'player',targetId:e.id,attackId:ev.eventId,amount:ev.amount,sourceType:ev.tags.includes('replay_hit')?'player-replay':ev.sourceKind==='phantom'?'player-phantom':'player-rune',eventId:'eventId' in target?target.eventId as string:null,origin:origin?{...origin}:undefined,breaksGuard:breaking};
 if(e.kind==='defense-enemy'){let result={applied:false,damage:0,killed:false};w.defense.damageEnemy(e as typeof w.defense.enemies[number],event,w.state.player.hp,hit=>result={applied:true,...hit});if(result.applied&&result.damage>0&&breaking)reactToEnemyHit(target,w.sim,{...STRIKES[3],stagger:RUNE_GROWTH.r12.branches.break.stagger,knock:0},ev.direction??{x:0,y:0},false,true,target.type==='guardian'&&(target.guardOpenUntil??0)>w.sim);return result;}
 const hit=resolveDamage(event,{id:'player',faction:'village',hp:w.state.player.hp,armor:0},{id:e.id,hp:e.hp,faction:'hostile',armor:0,...enemyProtection(target,origin,w.sim,breaking),...(ev.tags.includes('replay_hit')?{reduction:0}: {})});
 if(!hit.applied)return hit;if(hit.damage>0&&breaking){const c=RUNE_GROWTH.r12.branches.break;reactToEnemyHit(target,w.sim,{...STRIKES[3],stagger:c.stagger,knock:0},{x:ev.direction?.x??0,y:ev.direction?.y??0},false,true,target.type==='guardian'&&(target.guardOpenUntil??0)>w.sim);}
 if(hit.damage>0){const member=unitState(w.combatEncounters,e.id);if(member)member.participated=true;}e.hp=hit.hp;target.flashUntil=w.sim+110;target.playerAggroUntil=w.sim+2500;w.float(e.x,e.y,`${ev.critical?'✧ ':''}${Math.round(hit.damage)}`);
 if(hit.killed){w.recordEnemyDefeat(target,'player');void w.persist().catch(()=>{});}return hit;
 }
 releaseBlackHole(wind:SwordWind){const w=this.world;if(w.practice.mode!=='off'||w.lessons?.trial)return;
  const A=this.attacks.get(wind.attack.id)?.A??outgoingDamage(w.state,STRIKES[0].damage);
  this.blackHole.release(wind,giftLevel(w.state.windGifts,'blackHole'),A,wind.config.damage*(1+giftValue(w.state.windGifts,'gale')));
 }
 advanceBlackHole(prev:number,now:number,motions:WindMotion[]){const w=this.world;
  if(w.state.player.hp<=0||w.state.life.playerSpace!=='village'||w.practice.mode!=='off'){this.blackHole.clear();this.blackHoleView.clear();return;}
  this.blackHole.advance(prev,now,motions,{clear:clearMeleeLine,
   move:(target,dx,dy)=>{const e=target as typeof w.enemies[number];
    sweepMove(e,dx,dy,(x,y)=>w.blocked(x,y)||Math.hypot(x-e.homeX,y-e.homeY)>enemyLeashRadius(e),clearMotionLine,
     [...w.combatTargets().filter(t=>t.id!==e.id&&t.hp>0&&(!('disabled' in t)||!t.disabled)),{id:'player',...w.state.player}]);
   },
   damage:(target,amount,rift,phase)=>{const parent=this.engine.parent('','wind_gift',rift);parent.A=rift.A;parent.attackInstanceId=`black-hole:${rift.wind.releaseId}`;
    const ev=this.engine.child(parent,target,amount,['wind_gift',phase==='dot'?'black_hole_dot':'black_hole_slash']);
    ev.origin=phase==='dot'?{x:rift.x,y:rift.y}:{...rift.wind.origin};
    const hit=this.damage(target,ev);if(hit.applied){ev.actual=hit.damage;this.engine.log(ev);w.state.runes.peace=0;}return hit.applied?hit.damage:0;
   }});
 }
 drawBlackHole(now:number){const settings=this.world.state.runes.settings;this.blackHoleView.draw(now,settings.simple,settings.lowFlash);this.giftView.draw(now);}
 giftLanded(target:RuneTarget,parent:RuneEvent,finisher:boolean,attack?:Attack){
  if(attack)this.gifts.landed(attack,target,parent);
  if(parent.sourceKind!=='native')return;const s=this.world.state.windGifts,engine=this.engine;
  const emit=(kind:'shock'|'chain',radius:number,max:number)=>{const level=giftValue(s,kind);if(!level||s.cooldowns[kind]>0)return;s.cooldowns[kind]=kind==='shock'?1000:1500;
    const targets=engine.targets(target,radius).filter(e=>kind==='shock'||e.id!==target.id).slice(0,max);
    let shown=false,jump=0;for(const e of targets){const ev=engine.child(parent,e,parent.A*level,['wind_gift']);ev.origin={x:target.x,y:target.y};const hit=this.damage(e,ev);if(hit.applied&&hit.damage>0){if(kind==='chain'){const lead=jump++*CHAIN_LIGHTNING.jumpDelay;this.gifts.visual(kind,e,{end:target,lead,life:CHAIN_LIGHTNING.life+lead});}else if(!shown){this.gifts.visual(kind,target,{radius});shown=true;}}}
  };
  if(finisher)emit('shock',90,5);emit('chain',180,2);
 }
 advance(delta:number){const w=this.world;if(this.space!==w.state.life.playerSpace){this.clear();this.space=w.state.life.playerSpace;}this.engine.advance(delta);advanceGiftCooldowns(w.state.windGifts,delta);
 for(const e of [...w.enemies,...w.defense.enemies]){e.runeSlow=Math.max(this.engine.movementSlow(e),this.gifts.slow(e));const slow=this.engine.timeSlow(e),delay=delta*slow;if(delay&&e.attack&&!e.attack.cancelled)delayEnemyAttack(e.attack,delay);if(delay&&e.cool>w.sim)e.cool+=delay;if(delay&&e.bossBattle&&e.bossBattle.nextAt>w.sim)e.bossBattle.nextAt+=delay;}
 }
 milestone(){const s=this.world.state;const eligible=RUNES.filter(r=>r.acquisition.kind!=='shop'&&!this.eligible.has(r.id)&&acquisitionReady(s,r));const earned=eligible.filter(r=>!s.runes.owned.includes(r.id));for(const r of eligible)this.eligible.add(r.id);for(const r of earned)s.runes.owned.push(r.id);if(earned.length){this.world.ui.message(`获得符文：${earned.map(r=>r.name).join('、')}（R 查看）`);void this.world.persist().catch(()=>{});}return earned;}
 destination(){const w=this.world,s=w.state;const candidates=s.runes.nodes.map(id=>{const p=props.find(p=>p.id===id);return p?{id,point:{x:p.x,y:p.y+65}}:null;}).filter((p):p is NonNullable<typeof p>=>!!p&&this.validNode(p.id,p.point)).sort((a,b)=>Math.hypot(a.point.x-s.player.x,a.point.y-s.player.y)-Math.hypot(b.point.x-s.player.x,b.point.y-s.player.y));return candidates[0]??{id:'initial',point:{...RETURN_WIND_ORB.respawn}};}
 validNode(id:string,p:{x:number;y:number}){const w=this.world;return !motionBlocked(p.x,p.y)&&(id==='initial'||id==='waymark'&&w.state.shortcut&&w.state.runes.nodes.includes(id))&&![...w.enemies,...w.defense.enemies].some(e=>e.hp>0&&!e.disabled&&Math.hypot(e.x-p.x,e.y-p.y)<380);}
 cancelReturn(){this.returning=undefined;this.engine.effects=this.engine.effects.filter(f=>f.rune!==RETURN_RUNE.id);}
 update(){const w=this.world,engine=this.engine,s=w.state;
 this.milestone();
 if(w.keys.take('g')){const lock=this.lock();if(lock&&engine.now-this.lastReturnNotice>1000){this.lastReturnNotice=engine.now;w.ui.message(`归风不可用：${lock}`);}}
 if(!this.returning&&w.keys.held.has('g')&&!this.lock()&&!engine.cooldown(RETURN_RUNE.id)){
 const d=this.destination();if(this.validNode(d.id,d.point)){this.returning={point:d.point,node:d.id,start:engine.now,committed:false,origin:{x:s.player.x,y:s.player.y}};engine.fx('return-wind',s.player,70,RETURN_RUNE.id,1800);engine.ctx.sound('wind','release',engine.now);}}
 const r=this.returning;if(r){const age=engine.now-r.start;
 if(!r.committed&&(!w.keys.held.has('g')||this.lock()||w.keys.axis().x||w.keys.axis().y||Math.hypot(s.player.x-r.origin.x,s.player.y-r.origin.y)>1||w.combat.pending)){this.cancelReturn();return;}
 if(!r.committed&&age>=1200){if(!this.validNode(r.node,r.point)){this.cancelReturn();w.ui.message('路标当前不安全，归风中断。');return;}if(age>=1440){if(s.life.playerSpace!=='village'){s.life.outside={...r.point};leaveRoom(w);this.space='village';this.returning=r;}s.player.x=r.point.x;s.player.y=r.point.y;r.committed=true;engine.startCooldown(RETURN_RUNE.id,60000);engine.fx('return-wind',r.point,85,RETURN_RUNE.id,650);w.hero.place(s.player.x,s.player.y);w.catCompanion.transition();w.catView?.clear();w.follower.reset(s.player);w.cat.place(s.player.x-35,s.player.y+25);w.xiaobao?.controller.transitioned(s.player);engine.ctx.sound('wind','finish',engine.now);void w.persist().catch(()=>{});}}
 if(r.committed&&age>=2000)this.returning=undefined;
 }
 if(s.shortcut&&w.target?.id==='waymark'&&Math.hypot(s.player.x-w.target.x,s.player.y-w.target.y)<95&&!s.runes.nodes.includes('waymark')){s.runes.nodes.push('waymark');w.ui.message('安全风之路标已激活，长按 G 归风。');void w.persist().catch(()=>{});}
 this.view.draw();this.view.drawGiftStatus(this.gifts);this.view.drawGiftWinds(w.swordWind.winds,w.sim);this.view.drawGiftWinds(this.gifts.echoes.winds,w.sim,true);
 }
 alpha(){const r=this.returning;if(!r)return 1;const age=this.engine.now-r.start;if(r.committed)return Math.min(1,(age-1440)/480);return age<1200?1:Math.max(.08,1-(age-1200)/240);}
 snapshot(){return {...this.engine.snapshot(),blackHole:this.blackHole.snapshot(),windGifts:this.gifts.snapshot(),visual:this.view.snapshot(),lock:this.lock(),returning:this.returning,destination:this.destination()};}
 destroy(){this.clear();this.view.destroy();this.giftView.clear();}
}
