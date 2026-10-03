import {GIFT_RESONANCES,giftCappedValue,resonanceLevel,type WindGiftId,type WindGiftState} from './windGifts';
import type {ResonanceId} from './windGiftCatalog';
import {attackConfig,attackVector,isMeleeFinisher,inStrike,STRIKES,type Attack} from './combat';
import {SwordWindSystem,type SwordWind,type WindMotion} from './swordWind';
import {playerVitals} from './journeyTraining';
import type {RuneCombat,RuneTarget,RuneEvent} from './runeCombat';
import type {Point} from './obstacles';
import {playGiftFx} from '../entities/windGiftVfx';
import {WIND_GIFT_ART,type GiftVisualId} from '../entities/windGiftArt';

export type GiftTarget=RuneTarget&{type?:string;passiveRoot?:unknown;targetId?:string|null;attack?:{cancelled?:boolean;activeUntil?:number}|null};
type Mark={until:number;value:number;attack:number};
type Cast={levels:WindGiftState;A:number;wind:boolean;finisher:boolean;bonus:number;still:boolean;borrowed:boolean;perfectBorrow:boolean;dodged:boolean;step:boolean;targets:Set<string>;outTargets:Set<string>;lastOut?:GiftTarget;finished:boolean;events:Set<string>;protecting:Set<string>;visuals:Map<string,GiftVisualId[]>};
type History={kind:'I'|'J';at:number;attack:number;finisher:boolean};
export type GiftCombatPort={active:()=>boolean;now:()=>number;following:()=>boolean;companion:()=>({hp:number;maxHp:number;point:Point;heal:(amount:number)=>void}|undefined);move:(e:GiftTarget,dx:number,dy:number)=>number;stagger:(e:GiftTarget,amount:number)=>void};
const enemy=(e:GiftTarget)=>!e.disabled&&(e.kind==='enemy'||e.kind==='defense-enemy');
const live=(e:GiftTarget)=>enemy(e)&&e.hp>0;

// 临时战斗状态只归属本场景；派生事件只调用伤害裁决，不进入原生命中链。
export class WindGiftCombat {
 readonly echoes=new SwordWindSystem();
 private casts=new Map<number,Cast>();
 private marks=new Map<string,Map<string,Mark>>();
 private history=new Map<string,History[]>();
 private focus=new Map<string,{count:number;at:number;attack:number}>();
 private comboHits=new Map<number,Set<number>>();
 private cooldowns=new Map<string,number>();
 private buffs=new Map<string,Mark>();
 private jobs:{at:number;run:()=>void}[]=[];
 private zones:{point:Point;until:number;slow:number}[]=[];
 private slows=new Map<string,{until:number;amount:number}>();
 private echoData=new Map<number,{parent:RuneEvent;ratio:number;resonance:number}>();
 private released=new Set<number>();
 private healing:{at:number;amount:number}[]=[];
 private hot?:{from:number;until:number;rate:number};
 private dash?:{end:number;previous:Point;hit:Set<string>;A:number;levels:WindGiftState;escape:number};
 private shield={amount:0,until:0,veil:false};
 private companionShield={amount:0,until:0};
 private releasedOrdinal=0;private rhythm=0;private lastI=-Infinity;private hitCount=0;
 private visualPrevious?:{x:number;y:number;stamina:number};private recovered=0;
 
 metrics={companionHits:0,derived:0,healed:0,shielded:0,pulled:0,echoes:0,resonances:0};
 constructor(readonly engine:RuneCombat,readonly port:GiftCombatPort){}
 get state(){return this.engine.state;}
 get now(){return this.port.now();}
 get player(){return this.state.player;}
 visual(id:GiftVisualId,point:Point=this.player,extra:Partial<import('./runeCombat').RuneFx>={}){const companion=this.port.companion();let end=extra.end;if(!end&&['sharedHeart','relayEdge','sideBySide','relayTogether','returningBreath'].includes(id))end=point===this.player?companion?.point:this.player;playGiftFx(this.engine,id,point,{giftAnchor:point===this.player?'player':undefined,...extra,end});}
 value(id:WindGiftId,s=this.state.windGifts){return giftCappedValue(s,id);}
 combo(id:ResonanceId,s=this.state.windGifts){return resonanceLevel(s,id);}
 gate(id:string,ms:number){if((this.cooldowns.get(id)??-Infinity)>this.now)return false;this.cooldowns.set(id,this.now+ms);return true;}
 buff(id:string,value:number,ms:number,attack=-1){if(value>0)this.buffs.set(id,{until:this.now+ms,value,attack});}
 take(id:string){const b=this.buffs.get(id);this.buffs.delete(id);return b&&b.until>this.now?b.value:0;}
 mark(e:GiftTarget,id:string,value:number,ms:number,attack:number){if(value<=0)return;let m=this.marks.get(e.id);if(!m){m=new Map();this.marks.set(e.id,m);}m.set(id,{until:this.now+ms,value,attack});const visual=({gap:'openGap',guide:'guidingEdge',relay:'relayEdge',side:'sideBySide',quiet:'quietSky',relayTogether:'relayTogether'} as const)[id as 'gap'];if(visual)this.visual(visual,e);}
 peek(e:GiftTarget,id:string,attack=-1){const m=this.marks.get(e.id)?.get(id);return m&&m.until>this.now&&m.attack!==attack?m.value:0;}
 consume(e:GiftTarget,id:string){this.marks.get(e.id)?.delete(id);}
 schedule(delay:number,run:()=>void){this.jobs.push({at:this.now+delay,run});if(this.jobs.length>128)this.jobs.shift();}
 capture(a:Attack,maxStage=3){
  if(!this.port.active()||a.counter||a.kind==='counter'||a.swordWind?.trialLesson)return;
  const levels=structuredClone(this.state.windGifts),wind=a.kind==='swordWind';
  const finisher=isMeleeFinisher(a,maxStage),v=(id:WindGiftId)=>this.value(id,levels);
  const [dx,dy]=attackVector(a),charge=wind?'stillWind':'blade';if(v(charge))this.visual(charge,this.player,{direction:{x:dx,y:dy},giftPhase:'charge',life:Math.max(60,attackConfig(a).windup),radius:24});
  let bonus=0,still=false,borrowed=false,perfectBorrow=false,step=false,dodged=false;
  if(wind){
   this.rhythm=this.now-this.lastI>1000?1:this.rhythm+1;
   still=this.now-this.lastI>=1200;
   if(still)bonus+=v('stillWind');
   if(this.rhythm%3===0&&v('windRhythm')){a.config={...attackConfig(a),recovery:Math.max(0,attackConfig(a).recovery-v('windRhythm'))};this.visual('windRhythm');}
   const borrow=this.take('borrow');borrowed=borrow>0;perfectBorrow=borrowed&&this.take('perfectBorrow')>0;bonus+=borrow+this.take('stored')+this.take('unbroken');
   this.lastI=this.now;
  }else{const b=this.take('step');step=b>0;bonus+=b;}
  const dodge=this.take('dodge');dodged=dodge>0;bonus+=dodge;
  this.casts.set(a.id,{levels,A:this.engine.ctx.A(),wind,finisher,bonus,still,borrowed,perfectBorrow,dodged,step,targets:new Set(),outTargets:new Set(),finished:false,events:new Set(),protecting:new Set(),visuals:new Map()});
  if(this.casts.size>128)this.casts.delete(this.casts.keys().next().value!);
 }
 bonus(a:Attack,e:GiftTarget){
  const c=this.casts.get(a.id);if(!c||!enemy(e)||!this.port.active())return 0;
  if(e.targetId==='xiaobao'&&e.attack&&!e.attack.cancelled&&(e.attack.activeUntil??Infinity)>this.now)c.protecting.add(e.id);else c.protecting.delete(e.id);
  const v=(id:WindGiftId)=>this.value(id,c.levels),prior=this.history.get(e.id)?.at(-1),kind=c.wind?'I':'J';
  let n=c.bonus+(this.player.hp>=playerVitals(this.state).maxHp*.8?v('fullWind'):0)+(this.port.following()?v('sharedHeart'):0);
  n+=this.slow(e)>0?v('delayedEdge'):0;
  n+=this.peek(e,'gap',a.id)+this.peek(e,'side',a.id);
  if(c.wind){
   if(this.state.skills.swordWindStage>=2&&a.windLeg!=='back'&&c.outTargets.size>=1&&!c.outTargets.has(e.id))n+=v('pierceCurtain');
   if(['archer','bell','priest','spore'].includes(e.type??''))n+=v('clearPath');
   const focus=this.focus.get(e.id);
   if(focus&&focus.count===2&&focus.attack!==a.id&&this.now-focus.at<=2000)n+=v('focusWind');
  }else{if(a.stage>=2)n+=v('chainedEdge');if(c.finisher)n+=v('heavyEdge');if(a.stage===1)n+=this.peek(e,'guide',a.id);}
  if(prior&&prior.attack!==a.id&&prior.kind!==kind&&this.now-prior.at<=2000)n+=v('duet');
  const visuals:GiftVisualId[]=[],show=(id:WindGiftId,on:boolean)=>{if(on&&v(id))visuals.push(id);};
  if(c.wind){show('pierceCurtain',this.state.skills.swordWindStage>=2&&a.windLeg!=='back'&&c.outTargets.size>=1&&!c.outTargets.has(e.id));show('clearPath',['archer','bell','priest','spore'].includes(e.type??''));const focus=this.focus.get(e.id);show('focusWind',!!focus&&focus.count===2&&focus.attack!==a.id&&this.now-focus.at<=2000);show('stillWind',c.still);show('borrowWind',c.borrowed);}
  else{show('chainedEdge',a.stage>=2);show('catchEdge',a.stage>=2);show('guardStance',a.stage>=2);show('heavyEdge',c.finisher);show('stepEdge',c.step);show('guidingEdge',a.stage===1&&this.peek(e,'guide',a.id)>0);}
  show('duet',!!prior&&prior.attack!==a.id&&prior.kind!==kind&&this.now-prior.at<=2000);show('delayedEdge',this.slow(e)>0);show('openGap',this.peek(e,'gap',a.id)>0);show('sideBySide',this.peek(e,'side',a.id)>0);show('skimShadow',c.dodged);show('fullWind',this.player.hp>=playerVitals(this.state).maxHp*.8);show('sharedHeart',this.port.following());
  c.visuals.set(e.id,visuals);
  return n;
 }
 landed(a:Attack,e:GiftTarget,parent:RuneEvent){
  const c=this.casts.get(a.id);if(!c||!enemy(e)||!this.port.active()||parent.sourceKind!=='native')return;
  const key=e.id;if(c.events.has(key))return;c.events.add(key);
  const firstTarget=!c.targets.has(e.id),firstHit=c.targets.size===0;c.targets.add(e.id);if(c.wind&&a.windLeg!=='back'){c.outTargets.add(e.id);c.lastOut=e;}
  const v=(id:WindGiftId)=>this.value(id,c.levels),combo=(id:ResonanceId)=>this.combo(id,c.levels),kind=c.wind?'I':'J';
  for(const id of c.visuals.get(e.id)??[])this.visual(id,e,{direction:parent.direction});c.visuals.delete(e.id);
  if(firstHit&&v(c.wind?'gale':'blade'))this.visual(c.wind?'gale':'blade',e,{direction:parent.direction});
  if(this.peek(e,'quiet',a.id)){this.emit(e,parent,this.peek(e,'quiet',a.id),'quietSky');this.consume(e,'quiet');}
  if(this.peek(e,'relayTogether',a.id)){this.emit(e,parent,this.peek(e,'relayTogether',a.id),'relayTogether');this.consume(e,'relayTogether');}
  this.consume(e,'gap');this.consume(e,'side');if(!c.wind&&a.stage===1)this.consume(e,'guide');
  if(v('drinkDew')&&this.gate('dew',600)){const enhanced=!!this.hot&&this.hot.until>this.now&&combo('dewSpring')>0;if(this.heal(playerVitals(this.state).maxHp*v('drinkDew')*(enhanced?1+.5*combo('dewSpring'):1),'drinkDew',e)>0&&enhanced)this.visual('dewSpring',this.player,{end:e});}
  const companion=this.port.companion();
  if(companion&&c.protecting.has(e.id)&&v('protectCompanion')&&this.gate('protectCompanion',6000)){
   this.grantCompanion(companion.maxHp*v('protectCompanion'),4000);this.visual('protectCompanion',companion.point,{end:this.player});
  }
  this.mark(e,'relay',v('relayEdge'),3000,a.id);
  if(c.wind){
   if(v('roamEdge')){this.buff('roam',v('roamEdge'),1000);this.visual('roamEdge');}
   if(v('holdWind'))this.setSlow(e,v('holdWind'),1500);
   if(firstTarget){
    const focus=this.focus.get(e.id);this.focus.set(e.id,{count:focus&&this.now-focus.at<=2000?(focus.count+1)%3:1,at:this.now,attack:a.id});
    this.hitCount++;
    if(this.hitCount%3===0&&v('curledWind')&&this.gate('curl',2000)){
     for(const t of this.targets(e,90))if(!t.boss&&!t.passiveRoot){const d=Math.hypot(t.x-e.x,t.y-e.y);if(d>1){const moved=this.port.move(t,(e.x-t.x)/d*Math.min(d,v('curledWind')),(e.y-t.y)/d*Math.min(d,v('curledWind')));this.metrics.pulled+=moved;if(moved>0&&this.slow(t)>0&&combo('windHunt'))this.emit(t,parent,.3*combo('windHunt'),'windHunt');}}
     this.visual('curledWind',e);
    }
   }
   if((c.still||firstTarget&&this.focus.get(e.id)?.count===0)&&combo('quietSky'))this.mark(e,'quiet',.4*combo('quietSky'),3000,a.id);
   this.mark(e,'guide',v('guidingEdge'),3000,a.id);
  }else{
   const comboId=a.comboId??a.id;let hits=this.comboHits.get(comboId);if(!hits){hits=new Set();this.comboHits.set(comboId,hits);if(this.comboHits.size>64)this.comboHits.delete(this.comboHits.keys().next().value!);}hits.add(a.stage);
   if(c.finisher){
    this.mark(e,'gap',v('openGap'),2000,a.id);this.buff('stored',v('storedTurn'),3000);
    if(v('aftershock')&&this.gate('aftershock',2000)){const point={x:e.x,y:e.y},mountain=combo('mountainEcho');this.schedule(300,()=>{this.area(point,mountain?120:90,parent,v('aftershock')+.25*mountain,'aftershock');if(mountain)this.visual('mountainEcho',point);});this.visual('aftershock',point,{radius:mountain?120:90});}
    if(v('finalBreath')&&this.gate('finalBreath',1000)){this.stamina(v('finalBreath'),'finalBreath');this.buff('regen',.15*combo('breathCycle'),2000);if(combo('breathCycle'))this.visual('breathCycle');}
    if(v('suppressField')&&this.gate('suppress',2000)&&!e.boss&&!e.passiveRoot){this.port.stagger(e,v('suppressField'));this.visual('suppressField',e);}
    if(firstHit&&hits.has(1)&&hits.has(2)&&combo('hundredCuts'))this.emit(e,parent,.4*combo('hundredCuts'),'hundredCuts');
   }
   if(firstHit&&c.dodged&&c.step&&combo('shadowChase'))this.fan(a,parent,.3*combo('shadowChase'),'shadowChase');
  }
  if(firstTarget){
   const h=this.history.get(e.id)??[],prior=h.at(-1);
   if(prior&&prior.attack!==a.id&&prior.kind!==kind&&this.now-prior.at<=2000&&v('cyclicBreath')&&this.gate('cycle',1000))this.stamina(v('cyclicBreath'),'cyclicBreath');
   h.push({kind,at:this.now,attack:a.id,finisher:c.finisher});while(h.length>3)h.shift();this.history.set(e.id,h);
   if(h.length===3&&this.now-h[0]!.at<=3000&&h[0]!.kind===h[2]!.kind&&h[1]!.kind!==kind&&v('duality')&&this.gate('duality',3000)){
    const actual=this.area(e,90,parent,v('duality'),'duality');if(actual>0&&combo('dualityFlow')){this.stamina(3*combo('dualityFlow'));this.grantShield(playerVitals(this.state).maxHp*.03*combo('dualityFlow'),3000);this.visual('dualityFlow');}
   }
   if(h.length===3&&h[0]!.finisher&&h[1]!.kind==='I'&&kind==='J'&&this.now-h[0]!.at<=3000&&combo('bladeDance')&&this.gate('bladeDance',3000))this.fan(a,parent,.5*combo('bladeDance'),'bladeDance');
  }
 }
 release(wind:SwordWind){
  const c=this.casts.get(wind.attack.id);if(!c||!this.port.active()||this.released.has(wind.releaseId)||wind.leg!=='out')return;
  this.released.add(wind.releaseId);if(this.released.size>128)this.released.delete(this.released.values().next().value!);
  this.releasedOrdinal++;let ratio=this.releasedOrdinal%4===0?this.value('echoWind',c.levels):0;
  for(const id of ['longEdge','broadWind'] as const)if(this.value(id,c.levels))this.visual(id,wind.origin,{direction:wind.direction,giftPhase:'release'});
  if(c.perfectBorrow&&this.combo('borrowedBlade',c.levels))ratio+=.4*this.combo('borrowedBlade',c.levels);
  if(!ratio)return;
  const a={...wind.attack,returnMode:undefined,swordWind:structuredClone(wind.config)},origin={...wind.origin},A=c.A,parent=this.engine.parent('','wind_gift',origin);parent.A=A;
  const resonance=this.combo('unbrokenWind',c.levels);
  this.schedule(160,()=>{const echo=this.echoes.launch(a,origin,this.now,A*ratio);if(echo){for(const blade of this.echoes.winds.filter(w=>w.releaseId===echo.releaseId))this.echoData.set(blade.id,{parent,ratio,resonance});this.metrics.echoes++;this.visual(c.perfectBorrow&&this.combo('borrowedBlade',c.levels)?'borrowedBlade':'echoWind',origin,{direction:wind.direction});this.engine.ctx.sound('wind','release',this.engine.now);}});
 }
 releaseMelee(a:Attack){if(!this.casts.has(a.id)||!this.port.active()||a.kind==='swordWind'||a.counter)return;const [x,y]=attackVector(a);if(this.value('blade'))this.visual('blade',this.player,{direction:{x,y},giftPhase:'release',radius:attackConfig(a).range*.65,life:Math.min(450,attackConfig(a).active+attackConfig(a).recovery+100)});}
 finish(wind:SwordWind){const c=this.casts.get(wind.attack.id);if(!c||c.finished||wind.leg!=='out')return;
  // 多束与回返共享一次施放；最后一束出程结束才结算贯穿共鸣。
  c.finished=true;if(c.outTargets.size>=2&&c.lastOut&&this.combo('oneLineArmy',c.levels)){const parent=this.engine.parent('','wind_gift',c.lastOut);parent.A=c.A;this.emit(c.lastOut,parent,.5*this.combo('oneLineArmy',c.levels),'oneLineArmy');}
 }
 targets(point:Point,radius:number){return (this.engine.ctx.targets() as GiftTarget[]).filter(t=>live(t)&&Math.hypot(t.x-point.x,t.y-point.y)<=radius&&this.engine.ctx.clear(point,t)).sort((a,b)=>Math.hypot(a.x-point.x,a.y-point.y)-Math.hypot(b.x-point.x,b.y-point.y)||a.id.localeCompare(b.id)).slice(0,5);}
 emit(e:GiftTarget,parent:RuneEvent,ratio:number,tag:string,show=true){if(!live(e)||ratio<=0)return 0;const ev=this.engine.child(parent,e,parent.A*ratio,['wind_gift',tag]);ev.origin={...parent.point};const hit=this.engine.ctx.damage(e,ev);if(hit.applied){ev.actual=hit.damage;this.engine.log(ev);this.state.runes.peace=0;if(hit.damage>0){this.metrics.derived++;if(Object.hasOwn(GIFT_RESONANCES,tag))this.metrics.resonances++;if(show&&Object.hasOwn(WIND_GIFT_ART,tag))this.visual(tag as GiftVisualId,e,{direction:parent.direction});}}return hit.applied?hit.damage:0;}
 area(point:Point,radius:number,parent:RuneEvent,ratio:number,tag:string){if(Object.hasOwn(WIND_GIFT_ART,tag))this.visual(tag as GiftVisualId,point,{radius});return this.targets(point,radius).reduce((n,e)=>n+this.emit(e,parent,ratio,tag,false),0);}
 fan(a:Attack,parent:RuneEvent,ratio:number,id:GiftVisualId='riposte'){const [x,y]=attackVector(a),origin={...this.player},attack={...a,hit:new Set<string>(),config:{...STRIKES[0],range:180,angle:Math.PI/3}};this.visual(id,origin,{radius:110,direction:{x,y}});for(const e of this.targets(origin,180))if(inStrike(origin,e,attack,()=>this.engine.ctx.clear(origin,e)))this.emit(e,{...parent,point:origin},ratio,'gift_fan');}
 stamina(amount:number,id:GiftVisualId='breath',origin?:Point){if(this.player.hp>0){const before=this.player.stamina;this.player.stamina=Math.min(playerVitals(this.state).maxStamina,this.player.stamina+amount);if(this.player.stamina>before)this.visual(id,this.player,{end:origin,giftPhase:'return'});}}
 heal(amount:number,id:GiftVisualId='stopBleeding',origin?:Point){if(this.player.hp<=0||amount<=0)return 0;this.healing=this.healing.filter(h=>h.at>this.now-1000);const maximum=playerVitals(this.state).maxHp,actual=Math.max(0,Math.min(amount,maximum-this.player.hp,maximum*.05-this.healing.reduce((n,h)=>n+h.amount,0)));if(actual){this.player.hp+=actual;this.healing.push({at:this.now,amount:actual});this.metrics.healed+=actual;if(this.gate('healFx',250))this.visual(id,this.player,{end:origin,giftPhase:'return'});}return actual;}
 grantShield(amount:number,ms:number,veil=false){if(!this.port.active()||amount<=0)return;const value=Math.min(playerVitals(this.state).maxHp*.2,amount);if(this.shield.until<=this.now||value>=this.shield.amount)this.shield={amount:value,until:this.now+ms,veil};this.metrics.shielded+=value;this.visual(veil?'firstVeil':'lingeringGrace');}
 incoming(amount:number,a?:Attack){if(!this.port.active())return 1;const maximum=playerVitals(this.state).maxHp;let reduction=0;
  if(a&&!a.counter&&a.kind!=='swordWind'&&a.stage>=2){reduction+=this.value('guardStance');if(this.value('guardStance'))this.visual('guardStance');}
  if(this.player.stamina>=playerVitals(this.state).maxStamina*.5){reduction+=this.value('guardedBreath');if(this.value('guardedBreath'))this.visual('guardedBreath');}
  if(this.player.hp<=maximum*.3){reduction+=this.value('unyielding');if(this.value('unyielding'))this.visual('unyielding');}
  if(amount>=maximum*.2&&this.value('softenWound')&&this.gate('soften',8000)){reduction+=this.value('softenWound');this.visual('softenWound');}
  if(this.value('firstVeil')&&this.gate('veil',20000))this.grantShield(maximum*this.value('firstVeil'),10000,true);
  if(this.value('armor'))this.visual('armor');return 1-Math.min(.6,reduction);
 }
 absorb(amount:number){if(!this.port.active()||this.shield.until<=this.now||amount<=0)return amount;const removed=Math.min(amount,this.shield.amount);this.shield.amount-=removed;
  if(this.shield.amount<=0&&this.shield.veil){this.shield.veil=false;const combo=this.combo('armoredVeil');if(combo&&this.gate('armoredVeil',10000)){const parent=this.engine.parent('','wind_gift',this.player);this.area(this.player,90,parent,.3*combo,'armoredVeil');}}
  return amount-removed;
 }
 hurt(actual:number){if(!this.port.active()||actual<=0||this.player.hp<=0)return;const value=this.value('stopBleeding');if(value&&this.gate('stopBleeding',10000))this.hot={from:this.now,until:this.now+4000,rate:playerVitals(this.state).maxHp*value/4};}
 potionOverflow(amount:number){if(amount>0&&this.value('lingeringGrace'))this.grantShield(amount*this.value('lingeringGrace'),20000);}
 encounterHeal(amount:number){const before=this.player.hp,overflow=Math.max(0,this.player.hp+amount-playerVitals(this.state).maxHp);this.player.hp=Math.min(playerVitals(this.state).maxHp,this.player.hp+amount);if(this.player.hp>before)this.visual('spring');if(overflow&&this.combo('springGrace')){this.grantShield(overflow*.5*this.combo('springGrace'),40000);this.visual('springGrace');}}
 parry(perfect:boolean,e?:GiftTarget){if(!this.port.active())return;this.buff('borrow',this.value('borrowWind'),3000);if(this.value('borrowWind'))this.visual('borrowWind');if(this.value('poise'))this.visual('poise');this.buffs.delete('perfectBorrow');if(perfect){this.buff('perfectBorrow',1,3000);if(this.value('clearMirror'))this.visual('clearMirror');if(e&&!e.boss&&!e.passiveRoot&&this.value('breakStance')){this.port.stagger(e,this.value('breakStance'));this.visual('breakStance',e);}}}
 dodged(){if(this.port.active()&&this.value('skimShadow')&&this.gate('dodge',1000)){this.buff('dodge',this.value('skimShadow'),3000);this.visual('skimShadow');}}
 startDash(end:number){if(!this.port.active())return;this.buff('step',this.value('stepEdge'),3000);if(this.value('thrift'))this.visual('thrift');const escape=this.targets(this.player,150).length>=3&&this.value('escapeCircle')&&this.gate('escape',3000)?this.value('escapeCircle'):0;this.dash={end,previous:{...this.player},hit:new Set(),A:this.engine.ctx.A(),levels:structuredClone(this.state.windGifts),escape};}
 slow(e:GiftTarget){const slow=this.slows.get(e.id);return slow&&slow.until>this.now?slow.amount:0;}
 setSlow(e:GiftTarget,amount:number,ms:number){if(!live(e))return;amount=Math.min(e.boss?.2:.4,amount);const old=this.slows.get(e.id);this.slows.set(e.id,{until:Math.max(old?.until??0,this.now+ms),amount:Math.max(old&&old.until>this.now?old.amount:0,amount)});if(!old||old.until<=this.now)this.visual('holdWind',e);}
 speed(){return Math.min(.4,['roam','escape'].reduce((n,id)=>n+((this.buffs.get(id)?.until??0)>this.now?this.buffs.get(id)!.value:0),0));}
 regen(){return (this.buffs.get('regen')?.until??0)>this.now?this.buffs.get('regen')!.value:0;}
 grantCompanion(amount:number,ms:number){const c=this.port.companion();if(!c)return;const value=Math.min(c.maxHp*.2,amount);if(this.companionShield.until<=this.now||value>=this.companionShield.amount)this.companionShield={amount:value,until:this.now+ms};}
 absorbCompanion(amount:number){if(!this.port.active()||this.companionShield.until<=this.now)return amount;const removed=Math.min(amount,this.companionShield.amount);this.companionShield.amount-=removed;return amount-removed;}
 companionBonus(e:GiftTarget){return this.port.active()?this.peek(e,'relay'):0;}
 companionLanded(e:GiftTarget){if(!this.port.active()||!enemy(e))return;this.metrics.companionHits++;const relay=this.peek(e,'relay');if(relay){this.consume(e,'relay');this.mark(e,'relayTogether',.3*this.combo('relayTogether'),3000,-1);}this.mark(e,'side',this.value('sideBySide'),3000,-1);if(this.value('returningBreath')&&this.gate('companionStamina',1000))this.stamina(this.value('returningBreath'),'returningBreath',e);const c=this.port.companion();if(c&&this.companionShield.amount>0&&this.companionShield.until>this.now&&this.combo('guardedReturn')&&this.gate('companionHeal',2000)){const before=c.hp;c.heal(c.maxHp*.01*this.combo('guardedReturn'));if(c.hp<c.maxHp&&before<c.maxHp)this.visual('guardedReturn',c.point,{end:this.player});}}
 advance(prev:number,now:number,motions:WindMotion[]){
  if(!this.port.active()){this.clear();return;}
  if(now>prev){
   const before=this.visualPrevious,p=this.player;if(before){if(Math.hypot(p.x-before.x,p.y-before.y)>1&&this.value('stride')&&this.gate('visualStride',1400))this.visual('stride',p,{direction:{x:p.x-before.x,y:p.y-before.y}});this.recovered+=Math.max(0,p.stamina-before.stamina);if(this.recovered>=3&&this.value('breath')&&this.gate('visualBreath',1600)){this.visual('breath');this.recovered=0;}}this.visualPrevious={x:p.x,y:p.y,stamina:p.stamina};
   if(this.hot){const dt=Math.max(0,Math.min(now,this.hot.until)-Math.max(prev,this.hot.from));if(dt)this.heal(this.hot.rate*dt/1000);if(now>=this.hot.until)this.hot=undefined;}
   const due=this.jobs.filter(j=>j.at<=now);this.jobs=this.jobs.filter(j=>j.at>now);for(const j of due)j.run();
   for(const z of this.zones)if(z.until>prev)for(const e of this.targets(z.point,60))this.setSlow(e,z.slow,Math.max(0,z.until-now));this.zones=this.zones.filter(z=>z.until>now);
  }
  if(this.dash){const d=this.dash,point={...this.player},dx=point.x-d.previous.x,dy=point.y-d.previous.y,l2=dx*dx+dy*dy;
   if(l2>0&&prev<d.end&&this.value('residualWind',d.levels)){for(const e of this.engine.ctx.targets() as GiftTarget[]){if(!live(e)||d.hit.has(e.id)||d.hit.size>=5)continue;const t=Math.max(0,Math.min(1,((e.x-d.previous.x)*dx+(e.y-d.previous.y)*dy)/l2)),nearest={x:d.previous.x+dx*t,y:d.previous.y+dy*t};if(Math.hypot(e.x-nearest.x,e.y-nearest.y)>(e.radius??18)+18||!this.engine.ctx.clear(nearest,e))continue;d.hit.add(e.id);const parent=this.engine.parent('','wind_gift',nearest);parent.A=d.A;this.emit(e,parent,this.value('residualWind',d.levels),'residualWind');}}
   if(l2>1&&prev<d.end&&this.value('residualWind',d.levels))this.visual('residualWind',point,{direction:{x:dx,y:dy}});d.previous=point;
   if(now>=d.end){if(d.escape){this.buff('escape',d.escape,2000);this.visual('escapeCircle',point);}const slow=this.value('returningTide',d.levels);if(slow&&this.gate('returningTide',3000)){this.zones.push({point,until:now+2000,slow});if(this.zones.length>8)this.zones.shift();this.visual('returningTide',point);const resonance=this.combo('residualTide',d.levels);if(resonance){const parent=this.engine.parent('','wind_gift',point);parent.A=d.A;this.schedule(300,()=>this.area(point,60,parent,.25*resonance,'residualTide'));}}this.dash=undefined;}
  }
  for(const event of this.echoes.advance(prev,now,motions.filter(m=>live(m.target as GiftTarget)),(a,b,r)=>{const wall=this.engine.ctx.blocker(a,b,r);return wall?{...wall,id:'风赐障碍'}:null;})){
   const data=this.echoData.get(event.wind.id);if(event.target&&data){const hit=this.emit(event.target as GiftTarget,data.parent,data.ratio,'echoWind');if(hit>0&&data.resonance){this.buff('unbroken',.25*data.resonance,2000);this.visual('unbrokenWind',event.target);}}if(event.terminal)this.echoData.delete(event.wind.id);
  }
  // 标记的容量由实际活跃敌人限制；离场与死亡不保留战斗记忆。
  const liveIds=new Set((this.engine.ctx.targets() as GiftTarget[]).filter(live).map(t=>t.id));
  for(const [id,m] of this.marks){for(const [key,value] of m)if(value.until<=now)m.delete(key);if(!m.size||!liveIds.has(id))this.marks.delete(id);}
  for(const [id,h] of this.history)if(!liveIds.has(id)||now-(h.at(-1)?.at??0)>3000)this.history.delete(id);
  for(const [id,h] of this.focus)if(!liveIds.has(id)||now-h.at>2000)this.focus.delete(id);
  for(const [id,s] of this.slows)if(!liveIds.has(id)||s.until<=now)this.slows.delete(id);
 }
 get busy(){return !!this.jobs.length||!!this.zones.length||!!this.dash||this.echoes.winds.some(w=>!w.terminated);}
 statusVisuals(){const result:{id:GiftVisualId;point:Point;until:number;ratio:number}[]=[];if(!this.port.active())return result;
  if(this.shield.amount>0&&this.shield.until>this.now)result.push({id:this.shield.veil?'firstVeil':'lingeringGrace',point:this.player,until:this.shield.until,ratio:this.shield.amount/(playerVitals(this.state).maxHp*.2)});
  const c=this.port.companion();if(c&&this.companionShield.amount>0&&this.companionShield.until>this.now)result.push({id:'protectCompanion',point:c.point,until:this.companionShield.until,ratio:this.companionShield.amount/(c.maxHp*.2)});
  for(const e of this.engine.ctx.targets() as GiftTarget[]){if(!live(e))continue;const s=this.slows.get(e.id);if(s&&s.until>this.now)result.push({id:'holdWind',point:e,until:s.until,ratio:1});const m=this.marks.get(e.id),types={gap:'openGap',guide:'guidingEdge',relay:'relayEdge',side:'sideBySide',quiet:'quietSky'} as const;for(const [key,id] of Object.entries(types)){const mark=m?.get(key);if(mark&&mark.until>this.now){result.push({id,point:e,until:mark.until,ratio:1});break;}}}
  return result.slice(0,16);
 }
 snapshot(){return {metrics:{...this.metrics},shield:this.shield.until>this.now?this.shield.amount:0,companionShield:this.companionShield.until>this.now?this.companionShield.amount:0,slow:[...this.slows],jobs:this.jobs.length,zones:this.zones.length,echoes:this.echoes.snapshot(),resonances:Object.entries(GIFT_RESONANCES).flatMap(([id,r])=>{const level=this.combo(id as ResonanceId);return level?[{id,name:r.name,level}]:[];})};}
 clear(){this.casts.clear();this.marks.clear();this.history.clear();this.focus.clear();this.comboHits.clear();this.cooldowns.clear();this.buffs.clear();this.jobs=[];this.zones=[];this.slows.clear();this.echoData.clear();this.released.clear();this.echoes.clear();this.healing=[];this.hot=undefined;this.dash=undefined;this.shield={amount:0,until:0,veil:false};this.companionShield={amount:0,until:0};this.visualPrevious=undefined;this.recovered=0;this.releasedOrdinal=0;this.rhythm=0;this.lastI=-Infinity;this.hitCount=0;}
}
