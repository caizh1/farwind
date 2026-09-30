import {RUNES,RUNE_BALANCE as B,runeById,duoById,resolveDuos,type RuneDefinition} from '../../data/runes';
import type {State} from './state';
import type {Point} from './obstacles';
import type {SwordWindConfig} from '../../data/swordWind';
import {sweptTargetContact} from './swordWindGeometry';
export type RuneTarget=Point&{id:string;hp:number;boss?:unknown;disabled?:boolean;kind?:string;radius?:number};
export type RuneEvent={eventId:string;rootEventId:string;parentEventId:string|null;attackInstanceId:string;sourceKind:'native'|'rune'|'duo'|'status'|'phantom'|'reflection';sourceRuneId?:string;sourceDuoId?:string;targetId:string;tags:string[];procDepth:number;amount:number;actual?:number;critical?:boolean;A:number;point:Point};
export type RuneFx={id:number;visual:string;rune:string;duo?:string;point:Point;end?:Point;born:number;life:number;radius:number;direction?:Point;lead?:number;stacks?:number;critical?:boolean};
export type RuneStatus={chill?:{stacks:number;until:number};poison?:{stacks:number;until:number;next:number;damage:number;A:number;parent:RuneEvent};weak?:{until:number};doom?:{at:number;amount:number;stacks:number;parent:RuneEvent};jolt?:{until:number;next:number;parent:RuneEvent};iceUntil?:number};
export type RuneProjectile={id:string;kind:'seeking'|'wave'|'vortex'|'phantom';rune:string;duo?:string;parent:RuneEvent;point:Point;previous:Point;direction:Point;born:number;until:number;radius:number;speed:number;damage:number;hit:Map<string,number>;target?:string;distance:number;maxDistance:number;canCrit:boolean;maxTargets:number;reflection?:boolean;finish?:boolean;returning?:boolean;returnOrigin?:Point};
export type RuneField={id:string;kind:'mist'|'void'|'cloud'|'crystal';rune:string;parent:RuneEvent;point:Point;born:number;until:number;radius:number;next:number;duoNext:Record<string,number>;round:number};
export type RuneContext={state:()=>State;targets:()=>RuneTarget[];A:()=>number;clear:(a:Point,b:Point)=>boolean;blocker:(a:Point,b:Point,radius:number)=>{t:number}|null;visible:(e:RuneTarget)=>boolean;damage:(e:RuneTarget,event:RuneEvent)=>{applied:boolean;damage:number;killed:boolean};push:(e:RuneTarget,direction:Point,amount:number)=>'wall'|'immune'|'moved';sound:(family:string,phase:'release'|'hit'|'finish',now:number)=>void;checkpoint:()=>void};
const dist=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
const direction=(a:Point,b:Point)=>{const d=dist(a,b)||1;return {x:(b.x-a.x)/d,y:(b.y-a.y)/d};};
export class RuneCombat {
 statuses=new Map<string,RuneStatus>();projectiles:RuneProjectile[]=[];fields:RuneField[]=[];effects:RuneFx[]=[];events:RuneEvent[]=[];
 jobs:{at:number;serial:number;run:()=>void}[]=[];serial=0;seen=new Map<string,number>();intervals=new Map<string,number>();
 domainUntil=0;time?:{until:number;point:Point;A:number;records:{target:string;damage:number;point:Point}[];parent:RuneEvent};
 phoenixUntil=0;feathers=0;featherGrace=0;bossGuardUntil=0;speedUntil=0;dash?:{until:number;parent:RuneEvent;previous:Point;hit:Set<string>};
 equipped='';activeDuos=new Set<string>();metrics={native:0,rune:0,duo:0,status:0,damage:0,critical:0,phoenix:0,prevented:0};
 constructor(public ctx:RuneContext){this.rebind();}
 get state(){return this.ctx.state();}get now(){return this.state.runes.clock;}get player(){return this.state.player;}
 has(id:string){return this.state.runes.slots.includes(id);}cfg(id:string){return runeById(id)!.config;}duo(id:string){return this.activeDuos.has(id);}
 rebind(){const key=this.state.runes.slots.join('|')+':'+this.state.skills.swordWindStage;if(key!==this.equipped){this.clear();this.equipped=key;this.activeDuos=new Set(resolveDuos(this.state.runes.slots,this.state.skills.swordWindStage>0).filter(d=>d.active).map(d=>d.id));}}
 // 临时效果无存档恢复入口；冷却、蓄积与收藏属于符文本身，清理绝不返还冷却。
 clear(){this.statuses.clear();this.projectiles=[];this.fields=[];this.jobs=[];this.effects=[];this.seen.clear();this.intervals.clear();this.domainUntil=this.phoenixUntil=this.bossGuardUntil=this.speedUntil=this.featherGrace=0;this.feathers=0;this.time=undefined;this.dash=undefined;}
 cooldown(id:string){return this.state.runes.cooldowns[id]??0;}
 startCooldown(id:string,duration:number){this.state.runes.cooldowns[id]=duration;this.state.runes.counts[id]=0;this.ctx.checkpoint();}
 gate(key:string,ms:number){if((this.intervals.get(key)??-Infinity)>this.now)return false;this.intervals.set(key,this.now+ms);return true;}
 legal(e:RuneTarget){return e.hp>0&&!e.disabled&&this.ctx.visible(e);}
 targets(point:Point,radius:number){return this.ctx.targets().filter(e=>this.legal(e)&&dist(e,point)<=radius&&(dist(e,point)<1||this.ctx.clear(point,e))).sort((a,b)=>dist(a,point)-dist(b,point)||a.id.localeCompare(b.id));}
 status(e:RuneTarget){let s=this.statuses.get(e.id);if(!s){s={};this.statuses.set(e.id,s);}return s;}
 weak(id:string){return (this.statuses.get(id)?.weak?.until??0)>this.now;}
 poisonCap(id:string){return (this.has('r25')?this.cfg('r25').max:5)+(this.duo('d08')&&this.weak(id)?duoById('d08').config.extra:0);}
 critRate(e:RuneTarget){const base=this.state.runes.slots.reduce((n,id)=>n+(id?this.cfg(id).crit??0:0),0),poison=this.statuses.get(e.id)?.poison?.stacks??0;return Math.min(B.critCap,base+(this.duo('d10')?Math.min(B.poisonCritCap,poison*B.poisonCritPerLayer):0));}
 critMultiplier(e:RuneTarget){return this.duo('d09')&&this.weak(e.id)?B.weakCritMultiplier:B.critMultiplier;}
 random(){return Math.random();}
 speedBonus(){return (this.has('r18')?this.cfg('r18').speed:0)+(this.has('r09')&&this.now<this.speedUntil?this.cfg('r09').speed:0);}
 dashCost(){return this.has('r09')?this.cfg('r09').cost:1;}
 nativeBonus(e:RuneTarget){return (this.has('r18')?Math.min(this.cfg('r18').cap,this.speedBonus()*this.cfg('r18').convert):0)+(this.now<this.domainUntil?this.cfg('r26').bonus:0)+(this.has('r23')&&this.weak(e.id)?this.cfg('r23').bonus:0);}
 native(instance:string,e:RuneTarget,base:number,stage:number,wind=false):RuneEvent {
 const eventId=`native:${instance}:${e.id}`,critical=this.random()<this.critRate(e),amount=base*(1+this.nativeBonus(e))*(critical?this.critMultiplier(e):1);
 return {eventId,rootEventId:eventId,parentEventId:null,attackInstanceId:instance,sourceKind:'native',targetId:e.id,tags:['native',wind?'wind_hit':'melee_hit',stage===3?'finisher':'strike'],procDepth:0,amount,critical,A:this.ctx.A(),point:{x:e.x,y:e.y}};
 }
 parent(rune:string,tag:string,point:Point):RuneEvent{const id=`action:${++this.serial}`;return {eventId:id,rootEventId:id,parentEventId:null,attackInstanceId:id,sourceKind:'rune',sourceRuneId:rune,targetId:'',tags:[tag],procDepth:0,amount:0,A:this.ctx.A(),point:{x:point.x,y:point.y}};}
 child(parent:RuneEvent,e:RuneTarget,amount:number,tags:string[],rune?:string,duo?:string,kind:RuneEvent['sourceKind']=duo?'duo':'rune'):RuneEvent {
 return {eventId:`rune:${++this.serial}`,rootEventId:parent.rootEventId,parentEventId:parent.eventId,attackInstanceId:parent.attackInstanceId,sourceKind:kind,sourceRuneId:rune,sourceDuoId:duo,targetId:e.id,tags,procDepth:parent.procDepth+1,amount,A:parent.A,point:{x:e.x,y:e.y}};
 }
 log(ev:RuneEvent){this.events.push(ev);if(this.events.length>512)this.events.shift();this.metrics[ev.sourceKind==='native'?'native':ev.sourceKind==='duo'?'duo':ev.sourceKind==='status'?'status':'rune']++;this.metrics.damage+=ev.actual??0;if(ev.critical)this.metrics.critical++;}
 fx(visual:string,point:Point,radius=48,rune='r01',life=450,extra:Partial<RuneFx>={}){this.effects.push({id:++this.serial,visual,rune,point:{x:point.x,y:point.y},radius,born:this.now,life,...extra,end:extra.end?{x:extra.end.x,y:extra.end.y}:undefined,direction:extra.direction?{x:extra.direction.x,y:extra.direction.y}:undefined});if(this.effects.length>256)this.effects.splice(0,this.effects.length-256);}
 schedule(ms:number,run:()=>void){this.jobs.push({at:this.now+ms,serial:++this.serial,run});}
 apply(e:RuneTarget,ev:RuneEvent,visual?:string,canCrit=false){
 if(!this.legal(e)||this.player.hp<=0)return false;
 if(canCrit&&this.random()<this.critRate(e)){ev.critical=true;ev.amount*=this.critMultiplier(e);}
 if(ev.sourceKind!=='native'&&!ev.tags.includes('replay_hit')&&this.has('r23')&&this.weak(e.id))ev.amount*=1+this.cfg('r23').bonus;
 const hit=this.ctx.damage(e,ev);if(!hit.applied)return false;ev.actual=hit.damage;this.log(ev);
 if(visual)this.fx(visual,e,30,ev.sourceRuneId??'r01',420,{duo:ev.sourceDuoId,critical:ev.critical});
 if(ev.critical)this.fx(this.duo('d09')&&this.weak(e.id)?'heart-star':this.duo('d10')?'brew-stars':'hunter-star',e,32,'r06');
 this.ctx.sound(ev.sourceDuoId?duoById(ev.sourceDuoId).visual:runeById(ev.sourceRuneId??'r01')?.sound??'wind','hit',this.now);
 if(hit.killed){this.statuses.delete(e.id);return true;}
 this.chain(e,ev);return true;
 }
 // 允许的连锁逐项列明；追加攻击永远不会进入 nativeLanded。
 chain(e:RuneTarget,ev:RuneEvent){
 // 潮浪自身的击退／归墟牵引先完成，再标记实际落脚点；下一模拟边界启动可见落雷预兆。
 if(ev.tags.includes('tide_hit')&&this.duo('d01')&&this.gate(`d01:${e.id}`,duoById('d01').config.interval))this.schedule(0,()=>this.lightning(e,ev,duoById('d01').config.damage,undefined,'d01','storm-wave'));
 if(ev.tags.includes('lightning_hit')&&this.has('r11')){this.status(e).jolt={until:this.now+B.joltDuration,next:this.status(e).jolt?.next??0,parent:ev};this.fx(this.duo('d06')?'frozen-jolt':'jolt',e,32,'r11');}
 if(ev.tags.includes('mirror_hit')&&this.duo('d02')&&this.status(e).doom)this.detonate(e,duoById('d02').config.damage,'d02',ev);
 if(ev.tags.includes('vortex_hit')&&this.duo('d12'))this.chill(e,ev);
 if(ev.tags.includes('seeking_projectile_hit')&&this.duo('d14')&&this.gate(`d14:${e.id}`,duoById('d14').config.interval)){
  this.lightning(e,ev,duoById('d14').config.damage,ev.sourceRuneId,'d14','thunder-arrow',duoById('d14').config.delay);
 }
 }
 lightning(e:RuneTarget,parent:RuneEvent,ratio:number,rune?:string,duo?:string,visual='fork',lead=B.lightningLead){
 if(!this.legal(e))return;const point={x:e.x,y:e.y};this.fx(visual,point,duo==='d01'?46:32,rune??'r11',Math.max(480,lead+320),{duo,lead});this.ctx.sound('thunder','release',this.now);
 this.schedule(lead,()=>{if(this.legal(e)&&dist(e,point)<=40&&this.ctx.clear(point,e))this.apply(e,this.child(parent,e,parent.A*ratio,['lightning_hit'],rune,duo));});
 }
 damageArea(point:Point,radius:number,parent:RuneEvent,ratio:number,tags:string[],rune?:string,duo?:string,visual?:string){for(const e of this.targets(point,radius))this.apply(e,this.child(parent,e,parent.A*ratio,tags,rune,duo),visual);}
 count(id:string,parent:RuneEvent,on:()=>void){if(this.cooldown(id)>0)return;const c=this.cfg(id),r=this.state.runes;r.counts[id]=Math.min(c.count,(r.counts[id]??0)+1);if(r.counts[id]>=c.count){r.counts[id]=0;if(c.cooldown)this.startCooldown(id,c.cooldown);on();}}
 nativeLanded(e:RuneTarget,ev:RuneEvent,actual:number){
 const key=ev.eventId;if(this.seen.has(key))return;this.seen.set(key,this.now);ev.actual=actual;this.log(ev);this.state.runes.peace=0;
 if(this.time&&this.now<this.time.until)this.time.records.push({target:e.id,damage:actual,point:{x:e.x,y:e.y}});
 const first=!this.seen.has(ev.attackInstanceId);this.seen.set(ev.attackInstanceId,this.now);
 if(first){
  if(this.has('r11'))this.count('r11',ev,()=>this.lightning(e,ev,this.cfg('r11').damage,'r11'));
  if(this.has('r19'))this.count('r19',ev,()=>this.field('cloud',e,ev,'r19'));
  if(this.has('r26'))this.count('r26',ev,()=>this.swordDomain(e,ev));
  if(this.has('r27'))this.count('r27',ev,()=>this.thunderEdict(e,ev));
  if(ev.tags.includes('finisher'))this.finisher(e,ev);
 }
 if(!this.legal(e))return;
 if(this.has('r07')||this.has('r23')){this.status(e).weak={until:this.now+B.weakDuration};this.fx(this.has('r23')?'rose':'ribbon',e,32,this.has('r23')?'r23':'r07');}
 if(this.has('r01')&&this.gate(`r01:${e.id}`,this.cfg('r01').interval))this.lightning(e,ev,this.cfg('r01').damage,'r01');
 if(this.has('r27')&&this.gate(`r27:${e.id}`,this.cfg('r27').interval))this.lightning(e,ev,this.cfg('r27').passive,'r27',undefined,'thunder-edict');
 if(this.has('r02')&&ev.tags.includes('melee_hit')&&this.gate(`r02:${e.id}`,this.cfg('r02').interval))this.tide(e,ev,this.cfg('r02').damage,'r02',this.cfg('r02').push);
 if(this.has('r03'))this.chill(e,ev);
 if(this.has('r04'))this.doom(e,ev,'r04');
 else if(this.has('r14')&&ev.tags.includes('finisher'))this.doom(e,ev,'r14');
 if(this.has('r14')&&this.status(e).doom){const d=this.status(e).doom!;if(d.parent.rootEventId!==ev.rootEventId&&d.stacks<this.cfg('r14').max){d.stacks++;d.amount+=ev.A*this.cfg('r14').add;this.fx('needles',e,30,'r14',500,{stacks:d.stacks});}}
 if(this.has('r05')||this.has('r25')&&ev.tags.includes('finisher'))this.poison(e,ev);
 if(this.has('r13')&&ev.tags.includes('finisher'))this.chill(e,ev);
 if(ev.critical){
  this.fx(this.duo('d09')&&this.weak(e.id)?'heart-star':this.duo('d10')?'brew-stars':'hunter-star',e,40,'r06');
  if(this.has('r15')&&this.gate('r15',this.cfg('r15').interval))this.seeking(e,ev,'r15',1);
  if(this.has('r24')&&this.gate('r24',this.cfg('r24').interval))this.seeking(e,ev,'r24',2);
 }
 }
 finisher(e:RuneTarget,ev:RuneEvent){
 if(this.has('r12'))this.wave(this.player,direction(this.player,e),ev,'r12',this.cfg('r12').damage,this.cfg('r12').distance,this.cfg('r12').width);
 if(this.has('r16')&&!this.cooldown('r16')){this.startCooldown('r16',this.cfg('r16').cooldown);this.field('mist',e,ev,'r16');}
 if(this.has('r22')&&!this.cooldown('r22')){this.startCooldown('r22',this.cfg('r22').cooldown);this.vortex(ev,direction(this.player,e));}
 if(this.has('r28')){this.fx('void-wave',this.player,110,'r28',550);this.damageArea(this.player,110,ev,this.cfg('r28').passive,['tide_hit'],'r28');this.count('r28',ev,()=>this.field('void',e,ev,'r28'));}
 }
 chill(e:RuneTarget,parent:RuneEvent){if(!this.legal(e))return;const s=this.status(e);s.chill={stacks:Math.min(B.chillCap,(s.chill?.stacks??0)+1),until:this.now+B.chillDuration};
 this.fx('seed',e,28,'r03',300,{stacks:s.chill.stacks});
 if(this.has('r13')&&s.chill.stacks===5&&(s.iceUntil??0)<=this.now){s.chill=undefined;s.iceUntil=this.now+this.cfg('r13').cooldown;this.fx('ice-bloom',e,this.cfg('r13').radius,'r13',650);this.damageArea(e,this.cfg('r13').radius,parent,this.cfg('r13').damage,['ice_hit'],'r13');}}
 poison(e:RuneTarget,parent:RuneEvent){if(!this.legal(e))return;const s=this.status(e),interval=this.duo('d07')?B.fastPoisonInterval:B.poisonInterval;
 s.poison={stacks:Math.min(this.poisonCap(e.id),(s.poison?.stacks??0)+1),until:this.now+B.poisonDuration,next:s.poison?.next??this.now+interval,damage:parent.A*(this.has('r25')?this.cfg('r25').damage:B.poisonDamage),A:parent.A,parent};
 this.fx(this.duo('d08')&&this.weak(e.id)?'rose-brew':this.duo('d07')?'doom-brew':'brew',e,28,this.has('r25')?'r25':'r05',450,{stacks:s.poison.stacks,duo:this.duo('d08')?'d08':this.duo('d07')?'d07':undefined});}
 doom(e:RuneTarget,parent:RuneEvent,rune:string){if(!this.legal(e)||this.status(e).doom)return;this.status(e).doom={at:this.now+this.cfg(rune).delay,amount:parent.A*this.cfg(rune).damage,stacks:0,parent};this.fx('seal',e,32,rune,900);this.ctx.sound('doom','release',this.now);}
 detonate(e:RuneTarget,bonus=0,duo?:string,parent?:RuneEvent){const s=this.statuses.get(e.id),d=s?.doom;if(!d)return false;s!.doom=undefined;return this.apply(e,this.child(parent??d.parent,e,d.amount+d.parent.A*bonus,['doom_hit'],'r04',duo),duo?'mirror-doom':'doom-blade');}
 tide(e:RuneTarget,parent:RuneEvent,ratio:number,rune:string,push:number,duo?:string){const applied=this.apply(e,this.child(parent,e,parent.A*ratio,['tide_hit'],rune,duo),duo?'mirror-sea':this.duo('d01')?'storm-wave':runeById(rune)?.visual??'wave');if(!applied||!this.legal(e))return;
 const moved=this.ctx.push(e,direction(this.player,e),push);
 if(moved==='immune'&&this.has('r12'))this.apply(e,this.child(parent,e,parent.A*this.cfg('r12').immune,['compensation_hit'],'r12'),'breaker');
 if(moved==='wall')this.apply(e,this.child(parent,e,parent.A*(this.has('r12')?this.cfg('r12').wall:this.cfg('r02').wall),['wall_hit'],rune),'wall-wave');}
 field(kind:RuneField['kind'],point:Point,parent:RuneEvent,rune:string){const c=this.cfg(rune),duration=kind==='cloud'?c.rounds*c.interval+B.lightningLead:c.duration;const f:RuneField={id:`field:${++this.serial}`,kind,rune,parent,point:{x:point.x,y:point.y},born:this.now,until:this.now+duration,radius:c.radius,next:this.now+(kind==='cloud'?0:c.interval),duoNext:Object.fromEntries(['d04','d05'].map(id=>[id,this.now+duoById(id).config.interval])),round:0};this.fields.push(f);this.fx(runeById(rune)!.visual,point,c.radius,rune,duration);this.ctx.sound(runeById(rune)!.sound,'release',this.now);}
 wave(point:Point,d:Point,parent:RuneEvent,rune:string,ratio:number,distance:number,width:number,duo?:string,returning=false){const c=this.cfg(rune),p:RuneProjectile={id:`wave:${++this.serial}`,kind:'wave',rune,duo,parent,point:{x:point.x,y:point.y},previous:{x:point.x,y:point.y},direction:{...d},born:this.now,until:this.now+distance/(c.speed??500)*1000+300,radius:width/2,speed:c.speed??500,damage:parent.A*ratio,hit:new Map(),distance:0,maxDistance:distance,canCrit:false,maxTargets:Infinity,returning,returnOrigin:{x:point.x,y:point.y}};this.projectiles.push(p);this.ctx.sound('tide','release',this.now);}
 vortex(parent:RuneEvent,d:Point){const c=this.cfg('r22');this.projectiles.push({id:`vortex:${++this.serial}`,kind:'vortex',rune:'r22',parent,point:{...this.player},previous:{...this.player},direction:{...d},born:this.now,until:this.now+c.duration,radius:c.radius*(this.duo('d12')?duoById('d12').config.radius:1),speed:c.speed,damage:parent.A*c.damage,hit:new Map(),distance:0,maxDistance:c.speed*c.duration/1000,canCrit:this.duo('d03'),maxTargets:Infinity});}
 seeking(e:RuneTarget,parent:RuneEvent,rune:string,n:number,offset=0,finish=false,origin?:Point){const c=this.cfg(rune);for(let i=0;i<n;i++){const side=n===1?0:i%2?1:-1,point=origin?{...origin}:{x:this.player.x+side*(40+offset),y:this.player.y-32-offset};this.projectiles.push({id:`seeking:${++this.serial}`,kind:'seeking',rune,parent,point,previous:{x:point.x,y:point.y},direction:direction(point,e),born:this.now,until:this.now+2500,radius:12,speed:c.speed,damage:parent.A*c.damage,hit:new Map(),target:e.id,distance:0,maxDistance:1000,canCrit:rune==='r26',maxTargets:1,finish});}this.ctx.sound(runeById(rune)!.sound,'release',this.now);}
 windRelease(instance:string,root:Point,d:Point,config:SwordWindConfig){if(!this.state.skills.swordWindStage||config.trialLesson)return;const ev=this.parent('r20','wind_release',root);ev.attackInstanceId=instance;
 if(this.has('r20'))this.wave(root,d,ev,'r20',this.cfg('r20').damage,config.distance,this.cfg('r20').width,undefined,true);
 if(this.has('r21')&&!this.cooldown('r21')){this.startCooldown('r21',this.cfg('r21').cooldown);this.field('crystal',root,ev,'r21');}
 if(this.duo('d11')){const copy=structuredClone(config);this.schedule(duoById('d11').config.delay,()=>{const hits=new Map<string,number>();for(const angle of copy.angles){const v={x:d.x*Math.cos(angle)-d.y*Math.sin(angle),y:d.x*Math.sin(angle)+d.y*Math.cos(angle)},p:RuneProjectile={id:`phantom:${++this.serial}`,kind:'phantom',rune:'r20',duo:'d11',parent:ev,point:{...root},previous:{...root},direction:v,born:this.now,until:this.now+copy.lifetime,radius:copy.width/2,speed:copy.speed,damage:copy.damage*duoById('d11').config.damage,hit:hits,distance:0,maxDistance:copy.distance,canCrit:false,maxTargets:copy.maxTargets==='all'?Infinity:copy.maxTargets};this.projectiles.push(p);}});}}
 swordDomain(e:RuneTarget,parent:RuneEvent){const c=this.cfg('r26'),root={...this.player};this.domainUntil=this.now+c.duration;this.fx('sword-domain',this.player,150,'r26',c.duration);this.ctx.sound('swords','release',this.now);for(let i=0;i<c.swords;i++)this.schedule(250+i*440,()=>{const target=this.legal(e)?e:this.targets(this.player,700)[0];if(target){const a=-Math.PI+(i%6)/5*Math.PI,z=i<6?72:112;this.seeking(target,parent,'r26',1,0,i===c.swords-1,{x:root.x+Math.cos(a)*z,y:root.y-26+Math.sin(a)*z});}});}
 thunderEdict(e:RuneTarget,parent:RuneEvent){const targets=this.targets(this.player,650).slice(0,5);if(!targets.length)return;this.fx('thunder-wheel',this.player,140,'r27',1900);for(let round=0;round<3;round++)for(const t of targets)this.schedule(150+round*420,()=>this.lightning(t,parent,this.cfg('r27').damage,'r27',undefined,'thunder-edict'));
 const point={x:e.x,y:e.y};this.schedule(1550,()=>{this.fx('thunder-pillar',point,this.cfg('r27').radius,'r27',600,{lead:160});this.schedule(160,()=>{this.damageArea(point,this.cfg('r27').radius,parent,this.cfg('r27').final,['lightning_hit'],'r27');this.ctx.sound('thunder','finish',this.now);});});}
 block(perfect:boolean,instance:string,origin:Point){if(this.seen.has('block:'+instance))return;this.seen.set('block:'+instance,this.now);const ev=this.parent('r29','block',this.player);this.state.runes.peace=0;
 const arc=(rune:string,ratio:number,radius:number)=>{const visual=rune==='r29'?'mirror-arc':runeById(rune)!.visual;this.fx(visual,this.player,radius,rune,500,{end:origin});this.damageArea(this.player,radius,ev,ratio,['mirror_hit'],rune,undefined,visual);};
 if(this.has('r29'))arc('r29',this.cfg('r29').passive,120);
 if(perfect&&this.has('r10'))arc('r10',this.cfg('r10').damage,this.cfg('r10').radius);
 if(perfect&&this.has('r17')){arc('r17',this.cfg('r17').damage,this.cfg('r17').radius);this.player.stamina=Math.min(100,this.player.stamina+this.cfg('r17').stamina);}
 if(this.duo('d13')){const d=duoById('d13').config;this.bossGuardUntil=this.now+d.duration;this.fx('mirror-sea',this.player,d.radius,'r20',550,{duo:'d13'});for(const e of this.targets(this.player,d.radius))this.tide(e,ev,d.damage,'r20',0,'d13');}
 if(perfect&&this.has('r29')&&!this.cooldown('r29')){this.startCooldown('r29',this.cfg('r29').cooldown);this.time={until:this.now+this.cfg('r29').duration,point:{...this.player},A:ev.A,records:[],parent:ev};this.fx('time',this.player,this.cfg('r29').radius,'r29',this.cfg('r29').duration);this.ctx.sound('time','release',this.now);}
 }
 dashStart(instance:string){const ev=this.parent('r08','dash',this.player);ev.attackInstanceId=instance;if(this.has('r08'))this.dash={until:this.now+this.cfg('r08').window,parent:ev,previous:{...this.player},hit:new Set()};if(this.has('r09')){this.speedUntil=this.now+this.cfg('r09').duration;this.fx('feather',this.player,30,'r09',1200);}this.fx(this.has('r08')?'mirror-step':'wind-band',this.player,36,this.has('r08')?'r08':'r09',300);}
 reflect(e:RuneTarget,instance:string){if(!this.dash||this.now>this.dash.until||!this.legal(e))return false;const point={...this.player};this.projectiles.push({id:`reflection:${++this.serial}`,kind:'seeking',rune:'r08',parent:this.dash.parent,point,previous:{x:point.x,y:point.y},direction:direction(point,e),born:this.now,until:this.now+2500,radius:12,speed:540,damage:this.dash.parent.A*.4,hit:new Map(),target:e.id,distance:0,maxDistance:1000,canCrit:false,maxTargets:1,reflection:true});return true;}
 enemyAttempt(e:RuneTarget,attackId:string){if(!this.legal(e)||this.seen.has('enemy:'+attackId))return;this.seen.set('enemy:'+attackId,this.now);const s=this.statuses.get(e.id),j=s?.jolt;if(!j||this.now>=j.until||this.now<j.next)return;j.next=this.now+B.joltInterval;if(!this.duo('d06'))s!.jolt=undefined;this.apply(e,this.child(j.parent,e,j.parent.A*B.joltDamage,['jolt_hit'],'r11',this.duo('d06')?'d06':undefined,'status'),this.duo('d06')?'frozen-jolt':'jolt');}
 incomingScale(sourceId:string,boss=false){return (this.weak(sourceId)?.8:1)*(this.has('r10')?1-this.cfg('r10').reduction:1)*(boss&&this.now<this.bossGuardUntil?1-duoById('d13').config.reduction:1);}
 enemyScale(sourceId:string){return this.weak(sourceId)?.8:1;}
 immune(){return this.now<this.phoenixUntil||this.now<this.featherGrace;}
 protectHit(source:RuneTarget|undefined,hitId:string){if(this.immune())return true;if(!this.feathers)return false;this.feathers--;this.featherGrace=this.now+duoById('d15').config.grace;this.metrics.prevented++;const ev=this.parent('r30','feather_block',this.player);this.fx('mirror-phoenix',this.player,75,'r30',650,{duo:'d15',stacks:this.feathers});if(source&&this.legal(source)){const point={...this.player};this.projectiles.push({id:`feather:${++this.serial}`,kind:'seeking',rune:'r30',duo:'d15',parent:ev,point,previous:{x:point.x,y:point.y},direction:direction(point,source),born:this.now,until:this.now+2000,radius:12,speed:540,damage:ev.A*duoById('d15').config.damage,hit:new Map(),target:source.id,distance:0,maxDistance:900,canCrit:false,maxTargets:1,reflection:true});}return true;}
 damaged(source:RuneTarget|undefined,hpAfter:number,actual:number){if(actual<=0)return hpAfter;if(this.has('r10'))this.fx('armor',this.player,38,'r10',350);this.state.runes.peace=0;
 if(hpAfter<=0&&this.has('r30')&&!this.cooldown('r30')){const c=this.cfg('r30'),ev=this.parent('r30','rebirth',this.player);this.startCooldown('r30',c.cooldown);this.player.hp=100*c.heal;this.phoenixUntil=this.now+c.immune;this.feathers=this.duo('d15')?duoById('d15').config.feathers:0;this.metrics.phoenix++;
 this.fx(this.duo('d15')?'mirror-phoenix':'phoenix',this.player,c.radius,'r30',2000,{lead:360,duo:this.duo('d15')?'d15':undefined});const point={...this.player};this.schedule(360,()=>this.damageArea(point,c.radius,ev,c.damage,['phoenix_hit'],'r30'));for(let i=1;i<=6;i++)this.schedule(i*1000,()=>{if(this.player.hp>0)this.player.hp=Math.min(100,this.player.hp+100*c.regen);});this.ctx.sound('phoenix','finish',this.now);this.ctx.checkpoint();return 100*c.heal;
 }
 if(hpAfter>0&&this.has('r30')&&this.gate('phoenix-passive',this.cfg('r30').interval)){const ev=this.parent('r30','hurt',this.player);this.fx('phoenix-counter',this.player,95,'r30',600);const point={...this.player};this.schedule(180,()=>this.damageArea(point,95,ev,this.cfg('r30').passive,['phoenix_hit'],'r30',undefined,'phoenix-counter'));}
 return hpAfter;
 }
 movementSlow(e:RuneTarget){const chill=this.statuses.get(e.id)?.chill,ice=chill&&chill.until>this.now?chill.stacks*B.chillSlow:0;return Math.min(e.boss?.2:.6,Math.max(ice,this.timeSlow(e)));}
 timeSlow(e:Point&{boss?:unknown}){return this.time&&this.now<this.time.until&&dist(e,this.time.point)<this.cfg('r29').radius?(e.boss?this.cfg('r29').bossSlow:this.cfg('r29').slow):0;}
 advance(delta:number){this.rebind();if(delta<0||!Number.isFinite(delta))return;const r=this.state.runes;r.clock+=delta;r.peace=Math.min(8000,r.peace+delta);for(const id of Object.keys(r.cooldowns))r.cooldowns[id]=Math.max(0,r.cooldowns[id]-delta);
 if(this.player.hp<=0){this.clear();return;}
 for(const [id,s] of this.statuses){const e=this.ctx.targets().find(t=>t.id===id);if(!e||e.hp<=0||e.disabled){this.statuses.delete(id);continue;}
  if(s.weak&&s.weak.until<=this.now)s.weak=undefined;if(s.chill&&s.chill.until<=this.now)s.chill=undefined;if(s.jolt&&s.jolt.until<=this.now)s.jolt=undefined;
  if(s.doom&&s.doom.at<=this.now)this.detonate(e);
  if(s.poison){const p=s.poison;p.stacks=Math.min(p.stacks,this.poisonCap(id));const interval=this.duo('d07')?duoById('d07').config.interval:B.poisonInterval;while(p.next<=this.now&&p.next<=p.until&&e.hp>0){p.next+=interval;this.apply(e,this.child(p.parent,e,p.damage*p.stacks,['poison_tick'],this.has('r25')?'r25':'r05',this.duo('d07')?'d07':undefined,'status'),this.duo('d08')&&this.weak(id)?'rose-brew':this.duo('d07')?'doom-brew':'brew');}if(p.until<=this.now)s.poison=undefined;}
 }
 for(const f of [...this.fields])this.advanceField(f);
 this.fields=this.fields.filter(f=>this.now<f.until);
 this.advanceProjectiles(delta);
 if(this.dash){const dash=this.dash;for(const e of this.ctx.targets())if(this.legal(e)&&!dash.hit.has(e.id)&&sweptTargetContact(dash.previous,this.player,e,e,36+(e.radius??14))!==null&&this.ctx.clear(this.player,e)){dash.hit.add(e.id);this.apply(e,this.child(dash.parent,e,dash.parent.A*this.cfg('r08').damage,['mirror_hit'],'r08'),'mirror-step');}dash.previous={...this.player};if(this.now>=dash.until)this.dash=undefined;}
 const ready=this.jobs.filter(j=>j.at<=this.now).sort((a,b)=>a.at-b.at||a.serial-b.serial);this.jobs=this.jobs.filter(j=>j.at>this.now);for(const job of ready)job.run();
 if(this.time&&this.now>=this.time.until){const t=this.time;this.time=undefined;const sum=t.records.reduce((n,r)=>n+r.damage,0),scale=sum?Math.min(t.A*this.cfg('r29').cap,sum*this.cfg('r29').replay)/sum:0;for(const rec of t.records){const e=this.ctx.targets().find(e=>e.id===rec.target);this.fx('time-replay',rec.point,32,'r29',550,{end:t.point});if(e&&this.legal(e))this.apply(e,this.child(t.parent,e,rec.damage*scale,['replay_hit'],'r29'),'time-replay');}this.ctx.sound('time','finish',this.now);}
 this.effects=this.effects.filter(f=>this.now<f.born+f.life);for(const [key,at] of this.seen)if(this.now-at>15000)this.seen.delete(key);for(const [key,until] of this.intervals)if(this.now-until>10000)this.intervals.delete(key);
 }
 advanceField(f:RuneField){const c=this.cfg(f.rune),until=Math.min(this.now,f.until);while(f.next<=until){f.next+=c.interval;f.round++;
  const targets=this.targets(f.point,f.radius);
  if(f.kind==='mist')for(const e of targets){if(this.apply(e,this.child(f.parent,e,f.parent.A*c.damage,['mist_tick'],'r16'),'mist'))this.poison(e,f.parent);}
  if(f.kind==='void'){for(const e of targets){this.tide(e,f.parent,c.damage,'r28',0);if(e.hp>0&&!e.boss)this.ctx.push(e,direction(e,f.point),c.pull);}if(f.round===6){this.fx('void-collapse',f.point,f.radius,'r28',750);this.damageArea(f.point,f.radius,f.parent,c.final,['collapse_hit'],'r28');this.ctx.sound('void','finish',this.now);}}
  if(f.kind==='cloud'&&f.round<=c.rounds)for(const e of targets)this.lightning(e,f.parent,c.damage,'r19',undefined,'cloud-crown');
  if(f.kind==='crystal'){const e=targets[0];if(e){const point={x:e.x,y:e.y};this.fx('winter-beam',f.point,28,'r21',280,{end:point,lead:100});this.schedule(100,()=>{if(this.legal(e)&&dist(e,point)<40){this.apply(e,this.child(f.parent,e,f.parent.A*c.damage,['ice_hit'],'r21'));this.chill(e,f.parent);}});}}
 }
 if(f.kind==='mist')for(const id of ['d04','d05'])while(f.duoNext[id]<=until){f.duoNext[id]+=duoById(id).config.interval;if(!this.duo(id))continue;const targets=this.targets(f.point,f.radius);if(id==='d04'){this.fx('ice-mist',f.point,f.radius,'r16',850,{duo:id});for(const e of targets)this.chill(e,f.parent);}else{this.fx('storm-mist',f.point,f.radius,'r16',700,{duo:id});for(const e of targets.slice(0,duoById(id).config.max))this.lightning(e,f.parent,duoById(id).config.damage,'r16',id,'storm-mist');}}
 }
 advanceProjectiles(delta:number){const live:RuneProjectile[]=[];for(const p of this.projectiles){if(this.now<p.born){live.push(p);continue;}if(this.now>p.until)continue;const old={...p.point};p.previous=old;
 if(p.kind==='seeking'||p.kind==='vortex'&&this.duo('d03')){const target=this.ctx.targets().find(e=>e.id===p.target&&this.legal(e)&&this.ctx.clear(p.point,e))??this.targets(p.point,p.kind==='vortex'?480:700)[0];if(target){p.target=target.id;const desired=direction(p.point,target),mix=p.kind==='vortex'?Math.min(1,delta/120):Math.min(1,delta/70),v={x:p.direction.x*(1-mix)+desired.x*mix,y:p.direction.y*(1-mix)+desired.y*mix},len=Math.hypot(v.x,v.y)||1;p.direction={x:v.x/len,y:v.y/len};}}
 const travel=Math.min(p.speed*delta/1000,p.maxDistance-p.distance),end={x:old.x+p.direction.x*travel,y:old.y+p.direction.y*travel},wall=this.ctx.blocker(old,end,p.radius),stop=wall?.t??1;p.point={x:old.x+(end.x-old.x)*stop,y:old.y+(end.y-old.y)*stop};p.distance+=travel*stop;
 const hits=this.ctx.targets().filter(e=>this.legal(e)&&(!p.target||p.kind!=='seeking'||p.target===e.id)&&(p.kind==='vortex'?(p.hit.get(e.id)??-Infinity)<=this.now:!p.hit.has(e.id))).map(e=>({e,t:sweptTargetContact(old,p.point,e,e,p.radius+(e.radius??14))})).filter(h=>h.t!==null).sort((a,b)=>a.t!-b.t!||a.e.id.localeCompare(b.e.id));
 for(const {e} of hits){if(p.kind!=='vortex'&&p.hit.size>=p.maxTargets)break;p.hit.set(e.id,p.kind==='vortex'?this.now+250:Infinity);
  const tags=p.reflection?['mirror_hit']:p.kind==='seeking'?['seeking_projectile_hit']:p.kind==='vortex'?['vortex_hit']:p.kind==='phantom'?['phantom_hit']:['tide_hit'],ev=this.child(p.parent,e,p.damage,tags,p.rune,p.duo,p.reflection?'reflection':p.kind==='phantom'?'phantom':'rune');
  if(p.finish){this.fx('sword-calligraphy',e,115,'r26',700,{direction:p.direction});this.ctx.sound('swords','finish',this.now);}
  this.apply(e,ev,p.kind==='vortex'?this.duo('d12')?'ice-vortex':this.duo('d03')?'hunter-vortex':'vortex':p.kind==='seeking'?'sword-hit':p.kind==='phantom'?'phantom-wave':this.duo('d01')?'storm-wave':'wave',p.canCrit);
  if(p.kind==='wave'&&e.hp>0){const pushed=this.ctx.push(e,p.direction,this.cfg(p.rune).push??0);if(pushed==='immune'&&this.has('r12'))this.apply(e,this.child(p.parent,e,p.parent.A*this.cfg('r12').immune,['compensation_hit'],'r12'),'breaker');else if(pushed==='wall')this.apply(e,this.child(p.parent,e,p.parent.A*(this.has('r12')?this.cfg('r12').wall:this.cfg('r02').wall),['wall_hit'],p.rune),'wall-wave');}
 }
 const done=!!wall||p.distance>=p.maxDistance||p.kind==='seeking'&&p.hit.size>0;
 if(done&&p.returning){const point={...p.point},d={x:-p.direction.x,y:-p.direction.y};p.returning=false;p.direction=d;p.hit=new Map();p.distance=0;p.born=this.now;p.until=this.now+p.maxDistance/p.speed*1000+300;p.point=point;live.push(p);}
 else if(!done)live.push(p);
 }
 this.projectiles=live;
 }
 snapshot(){return {clock:this.now,duos:[...this.activeDuos],cooldowns:{...this.state.runes.cooldowns},counts:{...this.state.runes.counts},statuses:Object.fromEntries(this.statuses),fields:this.fields,projectiles:this.projectiles.map(p=>({...p,hit:[...p.hit]})),effects:this.effects,events:this.events,metrics:{...this.metrics},temporary:{feathers:this.feathers,immune:this.immune(),domain:this.domainUntil,time:this.time,bossGuard:this.bossGuardUntil},pending:this.jobs.length};}
}
