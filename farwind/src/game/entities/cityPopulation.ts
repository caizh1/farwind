import {MERCHANT_PATH,ROAD_GENERAL,merchantDefinition} from '../../data/merchantRoad';
import {groundShadows} from '../rendering/groundShadows';
import Phaser from 'phaser';
import {CITY_BUILDINGS,CITY_CITIZENS,CITY_LAMPS,cityBuilding,cityFurniture,isCitySpace} from '../../data/cityLayout';
import type {World} from '../scenes/World';
import {Actor} from './actor';
import {NpcMotion} from '../systems/npcAnimation';
import {lifeNavigation,moveLife,spaceBlocked,type LifeNav} from '../systems/npcNavigation';
import {nearestStanding,type NavigationBudget} from '../systems/enemy';
import {syncCityQuests} from '../systems/cityTransactions';
import {motionBlocked,clearMotionLine} from '../systems/obstacles';
import {sweepMove} from '../systems/combat';
import type {CityResident} from '../systems/cityProgress';
import type {Place} from '../../data/npcLife';
const lodging=(i:number):Place=>({space:'city:inn',x:580+i%7*50,y:720+Math.floor(i/7)*34});
const visitorRoute=[{x:10620,y:1740},{x:11000,y:1740},{x:10620,y:1600},{x:11000,y:1740},{x:11790,y:1630},{x:11000,y:1600},{x:10620,y:1740},{x:10800,y:1700}];
export class CityPopulation {
 private repaired=new WeakSet<CityResident>();
 private routes=new Map<string,LifeNav>();private hubs=new Set<string>();private cursor=0;private waiting=new Map<string,number>();
 private people=new Map<string,{sprite:Phaser.GameObjects.Sprite;label:Phaser.GameObjects.Text;motion:NpcMotion}>();
 private roomObjects:Phaser.GameObjects.GameObject[]=[];private space='';private alarmUntil=0;
 private performanceAt=0;private deliveries:Phaser.GameObjects.Image[]=[];
 private lights:Phaser.GameObjects.Graphics;private escort?:Phaser.GameObjects.Sprite;private escortMotion=new NpcMotion();private carried?:Phaser.GameObjects.Image;private celebration?:Phaser.GameObjects.Image;
 constructor(private w:World){this.lights=w.add.graphics().setDepth(8990);}
 private nav(id:string){if(!this.routes.has(id))this.routes.set(id,lifeNavigation());return this.routes.get(id)!;}
 step(ms:number,now:number,budget:NavigationBudget){
  const w=this.w,s=w.state,p=s.city.progress,all=p.residents,player=s.life.playerSpace==='village'?s.player:s.life.outside;
  const threat=p.boss.stage==='battle'||w.enemies.some(e=>e.hp>0&&!e.disabled&&e.x>9650&&e.x<13800&&e.y>-350&&e.y<2800);
  const attention=w.enemies.some(e=>e.hp>0&&!e.disabled&&e.x>9050&&e.x<9650&&e.y>1000&&e.y<2200);
  if(threat){p.alarm='battle';this.alarmUntil=now+6000;}else{if((p.alarm==='battle'||p.alarm==='recover')&&!this.alarmUntil)this.alarmUntil=now+6000;p.alarm=now<this.alarmUntil?'recover':attention?'attention':'daily';}
  // 同一帧只推进有界人数；远处不做全量路径搜索，沿用全局寻路预算。
  const near=all.filter(r=>r.space===s.life.playerSpace&&Math.hypot(r.x-s.player.x,r.y-s.player.y)<900);
  const selected=[...Array.from({length:Math.min(8,near.length)},(_,i)=>near[(this.cursor+i)%near.length]),all[this.cursor%all.length],all[(this.cursor+17)%all.length]];
  for(const r of all)r.elapsed=Math.min(1e9,r.elapsed+ms);
  for(const r of new Set(selected)){
   const elapsed=Math.min(400,r.elapsed);r.elapsed-=elapsed;
   if(!this.repaired.has(r)){this.repaired.add(r);if(r.space==='village'&&motionBlocked(r.x,r.y)){
    const safe=nearestStanding(r,[{x:9690,y:1660},{x:9840,y:1450},...CITY_BUILDINGS.map(b=>b.door)],q=>Math.hypot(q.x-r.x,q.y-r.y)<500);
    if(safe){Object.assign(r,safe);this.routes.delete(r.id);w.snapshotPending=true;}
   }}
   if(merchantDefinition(r.id))continue;
   const c=CITY_CITIZENS.find(c=>c.id===r.id),night=s.time%1440>=1200||s.time%1440<420;
   let target:Place;
   if(c?.id==='captain'){r.activity='work';let point: {x:number;y:number}=ROAD_GENERAL;if(r.space==='village'&&Math.hypot(r.x-ROAD_GENERAL.x,r.y-ROAD_GENERAL.y)>110){if(r.x>12000)point={x:11790,y:1600};else{const next=[...MERCHANT_PATH].reverse().find(p=>p.x<r.x-8&&p.x>ROAD_GENERAL.x);if(next)point=next;}}target={space:'village',...point};}
   else if(threat){r.activity='shelter';target=lodging(all.indexOf(r));}
   else if(p.main===7&&s.time%1440>=1080&&s.time%1440<1260){r.activity='visit';target={space:'village',x:11600+(all.indexOf(r)%8)*55,y:1480+Math.floor(all.indexOf(r)/8)*48};}
   else if(c){const home=CITY_BUILDINGS.find(b=>b.space===c.home)!;
    if(night&&c.id!=='innkeeper'&&c.id!=='tea'){r.activity='sleep';target=home.private?{space:c.home,x:470,y:630}:lodging(all.indexOf(r));}
    else if((s.time%1440+all.indexOf(r)%5*18)%1440>=720&&(s.time%1440+all.indexOf(r)%5*18)%1440<780){r.activity='shop';target={space:'village',x:11000+(all.indexOf(r)%5)*52,y:1660+Math.floor(all.indexOf(r)/5)*32};}
    else if((s.time%1440+all.indexOf(r)%5*18)%1440>=780&&(s.time%1440+all.indexOf(r)%5*18)%1440<840){r.activity='eat';target={space:'city:tea',x:580+(all.indexOf(r)%6)*55,y:730+Math.floor(all.indexOf(r)/6)*38};}
    else{r.activity='work';const shifts:Record<string,Place>={storyteller:{space:'village',x:11480,y:1510},smith:{space:'city:forge',x:810,y:735},innkeeper:{space:'city:inn',x:810,y:660},tea:{space:'city:tea',x:810,y:660},herbalist:{space:'city:clinic',x:810,y:660},fruit:{space:'village',x:10680,y:1855},cloth:{space:'village',x:11230,y:1875},cook:{space:'city:inn',x:590,y:700},'apprentice-a':{space:p.evidence.includes('tools-return')?'city:forge':c.home,x:650,y:700}};target=shifts[c.id]??(home.private?{space:'village',x:home.door.x+75,y:home.door.y+25}:{space:home.space,x:650+(all.indexOf(r)%3)*38,y:700});}
   }else{r.activity='visit';if(r.journey===0&&s.time<480+Number(r.id.split('-')[1])*3)continue;const index=Number(r.id.split('-')[1]);target=night?lodging(index):{space:'village',...visitorRoute[r.journey%visitorRoute.length],y:visitorRoute[r.journey%visitorRoute.length].y+(r.route%3)*18};}
   // 城市横跨四千余单位。远距离跨街区先走登记广场，避免旧村庄寻路半径截断城市行程。
   const destination=target.space==='village'?target:cityBuilding(target.space)!.door;
   if(r.space!=='village'||Math.hypot(r.x-11790,r.y-1600)<6)this.hubs.delete(r.id);if(r.space==='village'&&!this.hubs.has(r.id)&&Math.hypot(r.x-destination.x,r.y-destination.y)>2200)this.hubs.add(r.id);const throughPlaza=this.hubs.has(r.id);
   const waypoint:Place=throughPlaza?{space:'village',x:11790,y:1600}:target;
   if(moveLife(r,waypoint,elapsed,now,budget,this.nav(r.id),()=>true,all.filter(a=>a!==r&&a.space===r.space))&&!throughPlaza&&!night&&!threat){
    const wait=(this.waiting.get(r.id)??0)+elapsed;this.waiting.set(r.id,wait);if(wait>(c?16000:8000)){r.journey++;this.waiting.delete(r.id);}
   }
  }
  this.cursor++;
  const escort=p.escort;
  if(escort.following&&!escort.arrived&&s.life.playerSpace==='village'){
   const gap=Math.hypot(escort.x-s.player.x,escort.y-s.player.y);
   if(gap>55&&gap<340)sweepMove(escort,(s.player.x-escort.x)/gap*95*ms/1000,(s.player.y-escort.y)/gap*95*ms/1000,motionBlocked,clearMotionLine);
   if(escort.x>=9820&&Math.hypot(s.player.x-escort.x,s.player.y-escort.y)<200){escort.arrived=true;escort.following=false;syncCityQuests(s);w.snapshotPending=true;w.ui.message('行商已经通过西门检查，护送完成；到行会领取谢礼。');}
  }
 }
 render(now:number){
  const w=this.w,s=w.state,space=s.life.playerSpace,view=w.cameras.main.worldView;
  this.room(space);
  for(const r of s.city.progress.residents){
   const visible=r.space===space&&r.x>view.x-160&&r.x<view.right+160&&r.y>view.y-160&&r.y<view.bottom+160;
   let v=this.people.get(r.id);
   if(!visible){if(v){v.sprite.setVisible(false);v.label.setVisible(false);v.motion.reset();}continue;}
   const c=CITY_CITIZENS.find(c=>c.id===r.id),merchant=merchantDefinition(r.id),art=merchant?.art??c?.art??(Number(r.id.split('-')[1])%2?'traveler':'citizen');
   if(!v){v={sprite:w.add.sprite(r.x,r.y,`city-complete-${art}-walk`,0).setOrigin(.5,.94),label:w.add.text(0,0,'',{fontSize:'11px',color:'#fff0d0',stroke:'#233c41',strokeThickness:3}).setOrigin(.5,1),motion:new NpcMotion()};this.people.set(r.id,v);groundShadows(w).add(v.sprite,undefined,{label:merchant?.name??c?.name??'来访旅客',width:32,height:11,person:true,visible:()=>!v!.sprite.getData('卧床')});}
   v.motion.sample(r,now,r.activity!=='sleep');const m=v.motion,row=m.direction===1?1:m.direction>=2?2:0,walk=m.speed>1?Math.floor(m.distance/26)%4:0,depth=(space==='village'?0:7500)+r.y;
   const action=c?.art==='artisan'&&r.activity==='work'&&m.speed<1?'citizen-actions-v2':c?.id==='innkeeper'&&r.activity==='work'&&m.speed<1?'citizen-actions-v2':null;
   v.sprite.setTexture(`city-complete-${action??art+'-walk'}`,action?(c?.id==='innkeeper'?4:0)+Math.floor(now/420)%4:row*4+walk).setDisplaySize(96,96).setPosition(r.x,r.y).setDepth(depth).setVisible(true).setAlpha(1).setRotation(0).setOrigin(.5,.94);const bed=cityFurniture(space).find(f=>f.id==='bed');const sleeping=!!(r.activity==='sleep'&&bed&&Math.hypot(r.x-bed.x,r.y-bed.y-40)<10);v.sprite.setData('卧床',sleeping);if(sleeping&&bed){v.sprite.setOrigin(.5).setRotation(Math.PI/2).setDisplaySize(65,65).setPosition(bed.x,bed.y-60).setDepth(depth);}Actor.mirror(v.sprite,m.direction===2);
   if(c?.id==='storyteller'&&r.activity==='work'&&m.speed<1&&now-this.performanceAt>=2400){this.performanceAt=now;w.soundFx.chime(Math.floor(now/2400)%3,Math.hypot(r.x-s.player.x,r.y-s.player.y),now);}
   const ledger=merchant?s.merchantRoad.merchants.find(m=>m.id===r.id):undefined;
   if(ledger?.hp===0)v.sprite.setOrigin(.5).setRotation(Math.PI/2).setDisplaySize(75,75).setAlpha(.7).setData('卧床',true);
   const close=Math.hypot(r.x-s.player.x,r.y-s.player.y)<220;v.label.setText(`${c?.id==='captain'?'守城将军 · 岚铎':merchant?merchant.name+' · '+merchant.specialty:c?.name??'来访旅客'} · ${ledger?.hp===0?'倒地待救':ledger&&ledger.hp<180?'受伤 '+Math.ceil(ledger.hp)+'/180':r.activity==='work'?(c?.id==='storyteller'?'广场说书':'工作'):r.activity==='eat'?'用餐':r.activity==='sleep'?'休息':r.activity==='shelter'?'避难':'街市'}`).setPosition(r.x,r.y-86).setDepth((space==='village'?0:7500)+r.y+140).setVisible(close);
  }
  if(!this.escort){this.escort=w.add.sprite(0,0,'city-complete-traveler-walk',0).setOrigin(.5,.94).setDisplaySize(96,96);groundShadows(w).add(this.escort,undefined,{label:'护送行商',width:32,height:11,person:true});}
  const e=s.city.progress.escort;this.escortMotion.sample(e,now,true);const m=this.escortMotion;this.escort.setFrame((m.direction===1?4:m.direction>=2?8:0)+(m.speed>1?Math.floor(m.distance/26)%4:0));Actor.mirror(this.escort,m.direction===2);this.escort.setPosition(e.x,e.y).setDepth(e.y).setVisible(space==='village'&&s.city.progress.quests.find(q=>q.id==='escort')?.status==='active'&&!e.arrived);
  const carried=s.city.progress.evidence.includes('crate')&&!s.city.progress.evidence.includes('stall'),supplies=s.city.progress.evidence.includes('supply')&&(!s.city.progress.evidence.includes('post-west')||!s.city.progress.evidence.includes('post-hall'));w.propImages.get('city-cargo')?.setVisible(space==='village'&&!carried&&!s.city.progress.evidence.includes('stall'));const stall=w.propImages.get('city-stall-fruit');stall?.setTexture(s.city.progress.evidence.includes('stall')?'city-complete-fruit-stall':'city-complete-market-counter');
  if(!this.carried)this.carried=w.add.image(0,0,'city-complete-cargo-crates').setDisplaySize(42,44);this.carried.setTexture(carried?'city-complete-cargo-crates':'city-complete-supply-bag').setPosition(s.player.x+14,s.player.y-26).setDepth((space==='village'?0:7500)+s.player.y+1).setVisible(carried||supplies);
  for(const [i,post] of [{id:'post-west',x:9920,y:1650},{id:'post-hall',x:12800,y:635}].entries()){if(!this.deliveries[i]){this.deliveries[i]=w.add.image(post.x+30,post.y,'city-complete-supply-bag').setOrigin(.5,1).setDisplaySize(38,42).setDepth(post.y);groundShadows(w).add(this.deliveries[i],undefined,{label:'已交接的岗位补给',width:24,height:8,projection:false,footprint:true});}this.deliveries[i].setVisible(space==='village'&&s.city.progress.evidence.includes(post.id));}
  if(!this.celebration)this.celebration=w.add.image(11790,1330,'city-complete-celebration-sparks').setDisplaySize(300,230).setDepth(8991);const celebrating=s.city.progress.main===7&&space==='village'&&s.time%1440>=1080&&s.time%1440<1260;this.celebration.setVisible(celebrating).setAlpha(.45+.25*Math.sin(now/400)).setDisplaySize(300+30*Math.sin(now/700),230+22*Math.sin(now/700));
  this.lights.clear();if(space==='village'&&(s.time%1440>=1080||s.time%1440<420))for(const l of CITY_LAMPS){const repaired=s.city.progress.evidence.includes(l.id);this.lights.fillStyle(0xffd58b,repaired?.18:.07).fillEllipse(l.x,l.y-28,repaired?180:100,repaired?95:50).fillStyle(0xffd98c,repaired?.6:.25).fillCircle(l.x,l.y-111,6);}
 }
 private room(space:string){
  if(space===this.space)return;this.space=space;this.roomObjects.forEach(o=>o.destroy());this.roomObjects=[];
  if(!isCitySpace(space))return;const w=this.w,b=cityBuilding(space)!;
  const add=<T extends Phaser.GameObjects.GameObject>(o:T)=>{this.roomObjects.push(o);return o;};
  add(w.add.rectangle(700,690,4000,4000,0x142c32).setDepth(7000));
  add(w.add.tileSprite(700,690,640,540,`city-complete-${b.id==='underground'?'underground-tile':b.id==='wall'?'plaza-tile':['hall','archive','tower','barracks','guild'].includes(b.id)?'plaza-tile':'wood-floor'}`).setTileScale(.3).setDepth(7001));
  const wall=add(w.add.image(700,515,`city-complete-${b.id==='underground'?'underground-wall':b.id==='wall'?'wall-horizontal':'room-wall-back'}`).setOrigin(.5,1).setDisplaySize(640,170).setDepth(7030));
  groundShadows(w).add(wall,undefined,{label:'室内后墙石基',projection:false,footprint:true,surfaceDepth:()=>7029});
  add(w.add.text(700,365,`${b.name} · ${b.id==='wall'?'梯道':'南门'} E 返回`,{fontSize:'18px',color:'#f3deb0',stroke:'#19383e',strokeThickness:3}).setOrigin(.5).setDepth(8800));
  const exit=add(w.add.image(700,960,`city-complete-${b.id==='wall'?'wall-stairs':'room-open-door'}`).setOrigin(.5,1).setDisplaySize(110,130).setDepth(b.id==='wall'?7499:8455));
  groundShadows(w).add(exit,undefined,{label:'室内出口落地门柱／梯脚',projection:false,footprint:true});
  for(const f of cityFurniture(space)){const repaired=f.id.startsWith('valve-')&&w.state.city.progress.evidence.includes(f.id);const image=add(w.add.image(f.x,f.y,`city-complete-${repaired?'repaired-valve':f.art}`).setOrigin(.5,1).setDisplaySize(f.w,f.h).setDepth(f.mounted?7031:7500+f.y));image.setData('city-furniture',f.id);if(!f.mounted)groundShadows(w).add(image,undefined,{label:f.text,width:f.w*.55,height:14,projection:false,footprint:true});}
 }
 invalidateRoom(){this.space='';}
 reset(){this.performanceAt=0;this.alarmUntil=0;this.routes.clear();this.hubs.clear();this.waiting.clear();for(const v of this.people.values())v.motion.reset();this.invalidateRoom();}
}
