import type {World} from '../scenes/World';
import {MERCHANTS,MERCHANT_PATH,ROAD_POSTS,ROAD_BRANCHES,ROAD_NEST,merchantDefinition,roadGuardStanding,merchantStall,merchantLocalPlace} from '../../data/merchantRoad';
import {CITY_STOCK} from '../../data/maps/windwhisper';
import {lifeNavigation,moveLife,type LifeNav} from './npcNavigation';
import type {NavigationBudget,EnemyBody} from './enemy';
import {merchantResident,roadRouteStatus,type RoadGuard} from './merchantRoadState';
import {clearMeleeLine} from './obstacles';
import {resolveDamage,resolveReleasedDamage,type ReleasedAttack} from './damage';
import {enemyProtection} from './enemyTraits';
import type {EnemyContact} from './enemyAttack';
import {NpcMotion} from './npcAnimation';
import {Actor} from '../entities/actor';
import {groundShadows} from '../rendering/groundShadows';
import type Phaser from 'phaser';
const roadDistance=(p:{x:number;y:number})=>Math.min(...MERCHANT_PATH.slice(1).map((b,i)=>{const a=MERCHANT_PATH[i],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);}));
const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
export class MerchantRoad {
 private navs=new Map<string,LifeNav>();private hits=new Map<string,number>();
 private cargoViews=new Map<string,Phaser.GameObjects.Image>();
 private views=new Map<string,{sprite:Phaser.GameObjects.Sprite;label:Phaser.GameObjects.Text;motion:NpcMotion}>();
 constructor(private w:World){this.keepLocal();}
 private keepLocal(){const s=this.w.state;if(s.merchantRoad.opened)return;for(const [i,m]of s.merchantRoad.merchants.entries()){const p=merchantResident(s,m.id);if(merchantLocalPlace(m.endpoint,p))continue;Object.assign(p,{space:'village',...merchantStall(i,m.endpoint),activity:'shop'});this.navs.delete(m.id);this.w.snapshotPending=true;}}
 private nav(id:string){if(!this.navs.has(id))this.navs.set(id,lifeNavigation());return this.navs.get(id)!;}
 reset(){this.navs.clear();this.hits.clear();for(const v of this.views.values()){v.sprite.destroy();v.label.destroy();}this.views.clear();for(const image of this.cargoViews.values())image.destroy();this.cargoViews.clear();this.keepLocal();}
 targets(){const s=this.w.state;if(s.life.playerSpace!=='village')return [];return [
  ...s.merchantRoad.guards.filter(g=>g.hp>0).map(g=>({id:`${g.id}:${g.serial}`,x:g.x,y:g.y,hp:g.hp})),
  ...s.merchantRoad.merchants.filter(m=>m.hp>0&&merchantResident(s,m.id).space==='village').map(m=>({...merchantResident(s,m.id),id:`road-merchant:${m.id}`,hp:m.hp})),
 ];}
 victim(e:EnemyBody){const all=this.targets();if(e.attack){const locked=all.find(g=>g.id===e.targetId);if(locked)return locked;}return all.filter(g=>dist(e,g)<(g.id.startsWith('road-guard:')?250:190)&&clearMeleeLine(e,g)).sort((a,b)=>Number(b.id.startsWith('road-guard:'))-Number(a.id.startsWith('road-guard:'))||dist(e,a)-dist(e,b))[0];}
 receive(c:EnemyContact,source:EnemyBody,released?:ReleasedAttack){
  const w=this.w,r=w.state.merchantRoad,id=c.targetId;if(!id||c.attack.cancelled)return;
  const guard=r.guards.find(g=>`${g.id}:${g.serial}`===id),m=r.merchants.find(m=>`road-merchant:${m.id}`===id),body=guard??m;if(!body||body.hp<=0)return;
  const key=`${c.attack.attackId}:${id}`;if(this.hits.has(key)||m&&m.hurt>0)return;this.hits.set(key,w.sim);if(this.hits.size>1000)this.hits=new Map([[key,w.sim]]);
  const event={sourceId:source.id,targetId:id,attackId:c.attack.attackId,amount:c.attack.damage,sourceType:released?'enemy-shot' as const:'enemy-melee' as const,eventId:released?.eventId??c.attack.eventId??null};
  const target={id,hp:body.hp,faction:'village' as const,armor:guard?12:3},hit=released?resolveReleasedDamage(event,released,target):resolveDamage(event,{id:source.id,hp:source.hp,faction:'hostile',armor:0},target);
  if(!hit.applied)return;body.hp=hit.hp;if(guard){if(guard.hp===0){guard.mode='down';guard.replacement=20000;}else if(guard.hp<210)guard.mode='retreat';}
  if(m){m.hurt=800;m.rescue=0;m.cargo=Math.max(0,m.cargo-10);if(r.escort?.merchant===m.id&&m.cargo===0)r.escort.status='failed';}w.snapshotPending=true;
 }
 private walkGuard(g:RoadGuard,target:{x:number;y:number},ms:number,now:number,budget:NavigationBudget){const b={space:'village' as const,x:g.x,y:g.y},done=moveLife(b,{space:'village',...target},ms,now,budget,this.nav(g.id),p=>roadGuardStanding(p,['deploy','retreat'].includes(g.mode)));g.x=b.x;g.y=b.y;return done;}
 step(ms:number,now:number,budget:NavigationBudget){
  this.keepLocal();
  const w=this.w,s=w.state,r=s.merchantRoad,live=w.enemies.filter(e=>e.hp>0&&!e.disabled);
  for(const g of r.guards){g.cooldown=Math.max(0,g.cooldown-ms);
   const index=Number(g.id.split(':')[1]),post=g.post===3&&['retreat','recover'].includes(g.mode)?ROAD_POSTS.reduce((a,b)=>dist(g,a)<dist(g,b)?a:b):ROAD_POSTS[Math.min(g.post,2)],position={x:post.x+(index%2?35:-35),y:post.y};
   if(g.mode==='down'){g.replacement=Math.max(0,g.replacement-ms);if(!g.replacement){g.hp=600;g.serial++;g.arrived=false;g.x=13300;g.y=850;g.mode='deploy';g.waypoint=MERCHANT_PATH.length-1;w.snapshotPending=true;}continue;}
   if(g.mode==='recover'){g.hp=Math.min(600,g.hp+60*ms/1000);if(g.hp===600)g.mode='post';continue;}
   if(g.mode==='retreat'){let target=position;if(dist(g,position)>900){if(g.x>12000)target={x:11790,y:1600};else{target=position.x>g.x?MERCHANT_PATH.find(p=>p.x>g.x+8)??position:[...MERCHANT_PATH].reverse().find(p=>p.x<g.x-8)??position;}}if(this.walkGuard(g,target,ms,now,budget)&&target===position)g.mode='recover';continue;}
   if(g.mode==='deploy'){
    const waypoint=MERCHANT_PATH[g.waypoint];const target=g.x>12000?{x:11790,y:1600}:waypoint.x<post.x||g.waypoint===0?position:waypoint;
    if(this.walkGuard(g,target,ms,now,budget)){if(target===position){g.mode='post';g.arrived=true;if(g.post===3)g.waypoint=19;w.snapshotPending=true;w.ui.message(`${post.name}守备已经抵达。`);}else g.waypoint=Math.max(0,g.waypoint-1);}continue;
   }
   const target=live.filter(e=>(g.post!==3||e.x<=9780&&e.x>=4210&&roadDistance(e)<300)&&dist(e,g)<450&&dist(e,g.post===3?g:position)<520&&clearMeleeLine(g,e)).sort((a,b)=>dist(g,a)-dist(g,b))[0];
   if(target){g.mode='intercept';if(dist(g,target)>78){this.walkGuard(g,target,ms,now,budget);continue;}if(g.cooldown>0)continue;g.cooldown=900;
    const hit=resolveDamage({sourceId:`${g.id}:${g.serial}`,targetId:target.id,attackId:`${g.id}:${g.serial}:${now}`,amount:42,sourceType:'guard-melee',eventId:null},{id:g.id,hp:g.hp,faction:'village',armor:12},{id:target.id,hp:target.hp,faction:'hostile',armor:0,...enemyProtection(target,g,now)});if(hit.applied){target.hp=hit.hp;if(hit.killed)w.recordEnemyDefeat(target as World['enemies'][number],'guard');}continue;
   }
   g.mode='post';if(g.post===3){const path=MERCHANT_PATH[g.waypoint],direction=g.patrolDirection;if(this.walkGuard(g,path,ms,now,budget)){g.waypoint+=direction;if(g.waypoint>19){g.waypoint=18;g.patrolDirection=-1;}if(g.waypoint<10){g.waypoint=11;g.patrolDirection=1;}}}
   else this.walkGuard(g,position,ms,now,budget);
  }
  for(const [index,m]of r.merchants.entries()){
   const person=merchantResident(s,m.id),d=MERCHANTS[index],e=r.escort?.merchant===m.id?r.escort:null;m.hurt=Math.max(0,m.hurt-ms);
   if(m.rescue>0){const safe=s.life.playerSpace===person.space&&dist(s.player,person)<95&&!live.some(a=>dist(a,person)<180)&&s.player.hp>0;if(!safe)m.rescue=0;else{m.rescue=Math.min(10001,m.rescue+ms);if(m.rescue>=10001){m.hp=60;m.rescue=0;w.ui.message(`${d.name}已包扎，恢复六十生命。`);w.snapshotPending=true;}}}
   if(m.hp===0)continue;
   if(e){if(['wait','paused','pending','failed'].includes(e.status))continue;
    if(s.life.playerSpace!==person.space||dist(s.player,person)>340)continue;
    if(!e.picked&&dist(person,ROAD_BRANCHES[e.branch])<100&&dist(s.player,ROAD_BRANCHES[e.branch])<100){e.picked=true;w.snapshotPending=true;w.ui.message('旧货已取回，请返回对应哨岗交接。');}
    if(e.picked&&dist(person,ROAD_POSTS[e.branch])<160&&dist(s.player,ROAD_POSTS[e.branch])<200&&!live.some(a=>dist(a,person)<300)){e.status='pending';w.snapshotPending=true;w.ui.message('已安全返回哨岗，与同行行商领取报酬。');continue;}
    if(dist(s.player,person)>90)moveLife(person,{space:s.life.playerSpace,...s.player},ms,now,budget,this.nav(m.id));continue;
   }
   const refill=()=>{const day=Math.floor(s.time/1440);if(day>m.stockDay){m.stockDay=day;m.stock=Object.fromEntries(Object.entries(d.goods).map(([id,g])=>[id,g.stock]));m.sold={};m.discount=m.relation>=2?2:0;w.snapshotPending=true;}};
   const stall=merchantStall(index,m.endpoint);
   const approach=()=>dist(person,stall)>1200?(m.endpoint?MERCHANT_PATH.find(p=>p.x>person.x+8)??stall:[...MERCHANT_PATH].reverse().find(p=>p.x<person.x-8)??stall):stall;
   if(!r.opened){const local=(p:Parameters<typeof merchantLocalPlace>[1])=>merchantLocalPlace(m.endpoint,p);if(s.time%1440<420||s.time%1440>=1200){person.activity='sleep';moveLife(person,{space:m.endpoint?'city:inn':'inn',x:580+index*50,y:750},ms,now,budget,this.nav(m.id),local);continue;}if(person.space==='village'&&dist(person,stall)<8)refill();person.activity='shop';moveLife(person,{space:'village',...stall},ms,now,budget,this.nav(m.id),local);continue;}
   const atEndpoint=dist(person,stall)<8,minute=s.time%1440;
   if(m.waitUntil>0&&dist(person,stall)>1200){person.activity='walk';moveLife(person,{space:'village',...approach()},ms,now,budget,this.nav(m.id));continue;}
   if(m.waitUntil>0&&(minute<420||minute>=1200)){person.activity='sleep';moveLife(person,{space:m.endpoint?'city:inn':'inn',x:580+index*50,y:750},ms,now,budget,this.nav(m.id));continue;}
   if(atEndpoint&&m.waitUntil>0){refill();person.activity=minute<420||minute>=1200?'sleep':'shop';m.hp=Math.min(180,m.hp+20*ms/1000);if(s.time<m.waitUntil||minute<420||minute>=960)continue;
    m.trip++;m.stopMask=0;m.stopPost=3;m.stopRemaining=0;m.escorted=0;m.parcelDone=false;m.cargo=100;m.waypoint=m.direction===1?0:MERCHANT_PATH.length-1;m.waitUntil=0;w.snapshotPending=true;
   }
   if(m.waitUntil>0){person.activity='shop';moveLife(person,{space:'village',...stall},ms,now,budget,this.nav(m.id));continue;}
   if((minute<420||minute>=1200)&&dist(person,ROAD_POSTS.reduce((a,b)=>dist(person,a)<dist(person,b)?a:b))<160){person.activity='sleep';continue;}
   if(m.stopRemaining>0&&m.stopPost<3){person.activity='visit';if(moveLife(person,{space:'village',...ROAD_POSTS[m.stopPost]},ms,now,budget,this.nav(m.id))){m.stopRemaining=Math.max(0,m.stopRemaining-ms);if(!m.stopRemaining)m.stopPost=3;}continue;}
   person.activity='walk';const point=MERCHANT_PATH[m.waypoint];
   if(moveLife(person,{space:'village',...point},ms,now,budget,this.nav(m.id))){const next=m.waypoint+m.direction;if(next>=0&&next<MERCHANT_PATH.length){const post=[10,13,18].indexOf(m.waypoint);if(post>=0&&!(m.stopMask&(1<<post))){m.stopMask|=1<<post;m.stopPost=post;m.stopRemaining=1500;w.snapshotPending=true;}m.waypoint=next;}else{
     m.endpoint=m.direction===1?1:0;m.direction=m.direction===1?-1:1;m.waitUntil=s.time+60+index*10;
     const goods:Record<string,number>={};if(m.endpoint===1){for(const item of d.supply){const n=Math.min(Math.floor(6*m.cargo/100),CITY_STOCK[item]-s.city.stock[item]);s.city.stock[item]+=n;goods[item]=n;}if(!r.arrivals.some(a=>a.merchant===m.id&&a.trip===m.trip)){r.arrivals.push({merchant:m.id,trip:m.trip,time:s.time,goods});r.arrivals=r.arrivals.slice(-12);w.ui.message(`${d.name}抵达风语城，货物已交接。`);}}
     refill();w.snapshotPending=true;
   }}
  }
  if(r.opened&&!r.homeNews&&s.life.playerSpace==='village'&&s.player.x<1900){r.homeNews=true;w.snapshotPending=true;w.ui.message('城里的商车终于又来了。听说是你清掉了桥前的巢穴。');}
 }
 render(now:number){
  const w=this.w,s=w.state,r=s.merchantRoad,view=w.cameras.main.worldView,outside=s.life.playerSpace==='village';
  for(const g of r.guards){let v=this.views.get(g.id);const visible=outside&&g.x>view.x-160&&g.x<view.right+160&&g.y>view.y-160&&g.y<view.bottom+160;if(!visible){v?.sprite.setVisible(false);v?.label.setVisible(false);continue;}
   if(!v){v={sprite:w.add.sprite(g.x,g.y,'city-complete-guard-walk',0).setOrigin(.5,.94),label:w.add.text(0,0,'',{fontSize:'11px',color:'#f3e6be',stroke:'#233c41',strokeThickness:3}).setOrigin(.5,1),motion:new NpcMotion()};this.views.set(g.id,v);groundShadows(w).add(v.sprite,undefined,{label:'商路守备',width:34,height:11,person:true});}
   v.motion.sample({...g,space:'village'},now,g.hp>0);const m=v.motion,row=m.direction===1?1:m.direction>=2?2:0;v.sprite.setTexture('city-complete-guard-walk',row*4+(m.speed>1?Math.floor(m.distance/26)%4:0)).setPosition(g.x,g.y).setDisplaySize(100,100).setDepth(g.y).setVisible(true).setAlpha(g.hp===0?.4:1);Actor.mirror(v.sprite,m.direction===2);v.label.setText(`商路${g.post===3?'巡逻卫':'近卫'} · ${g.mode==='deploy'?'接岗途中':g.mode==='down'?'等待补员':g.mode==='recover'?'疗伤':g.mode==='retreat'?'撤回哨岗':g.mode==='intercept'?'拦截':'驻守'}`).setPosition(g.x,g.y-98).setDepth(g.y+140).setVisible(true);
  }
  for(const [id,image]of w.propImages){if(id.startsWith('road-post-'))image.setVisible(outside&&r.opened);if(id==='road-nest-ruin')image.setAngle(r.nest.wave===3?18:0).setAlpha(r.nest.wave===3?.6:1);if(id==='road-nest-den')image.setTint(r.nest.wave===3?0x839d86:0xffffff).setAlpha(r.nest.wave===3?.6:1);}
  for(const m of r.merchants){const person=merchantResident(s,m.id);if(m.hp===0)person.activity='shelter';let cargo=this.cargoViews.get(m.id);const arrival=r.arrivals.filter(a=>a.merchant===m.id).at(-1),unloading=!!arrival&&s.time-arrival.time<3,visible=outside&&person.space==='village'&&r.opened&&m.hp>0&&(m.waitUntil===0||unloading)&&person.x>view.x-160&&person.x<view.right+160&&person.y>view.y-160&&person.y<view.bottom+160;if(!visible){cargo?.setVisible(false);continue;}if(!cargo){cargo=w.add.image(0,0,'city-complete-cargo-crates').setOrigin(.5,1).setDisplaySize(38,38);this.cargoViews.set(m.id,cargo);}cargo.setPosition(person.x+25,person.y-8).setDepth(person.y-.5).setAlpha(.6+m.cargo/250).setVisible(true);}
 }
}
