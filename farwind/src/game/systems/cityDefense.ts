import {CITY,CITY_GUARD_POSTS,CITY_FIRING_PORTS,CITY_PATROL_ROUTES,cityGuardId} from '../../data/maps/windwhisper';
import type {CityState,CityGuardState} from './tradeRoadState';
import {lifeNavigation,moveLife,type LifeNav} from './npcNavigation';
import type {NavigationBudget} from './enemy';
import type {EnemyBody} from './enemy';
import {enemyProtection} from './enemyTraits';
import {clearMeleeLine,clearMotionLine,motionBlocked,propLineBlocker,type Point} from './obstacles';
import {props} from '../../data/world';
import {sweepMove} from './combat';
import {resolveDamage,resolveReleasedDamage,type ReleasedAttack,type DamageEvent} from './damage';
import {sporeContactAt,type EnemyContact} from './enemyAttack';
const dist=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
export type CityArrow=Point&{id:string;vx:number;vy:number;life:number;released:ReleasedAttack};
export class CityDefense {
  private shiftHour:number|undefined;private guardCursor=0;private hubs=new Set<string>();
  patrol=new Map<string,number>();navigation=new Map<string,LifeNav>();budget:NavigationBudget={queries:0};now=0;
  arrows:CityArrow[]=[];knock=new Map<string,number>();serial=0;hit=new Set<string>();
  constructor(private read:()=>CityState,private killed:(e:EnemyBody)=>void,private changed:()=>void=()=>{}){}
  post(g:CityGuardState){return CITY_GUARD_POSTS.find(p=>p.slot===g.slot)!;}
  id(g:CityGuardState){return cityGuardId(g.slot,g.serial);}
  targets(){return this.read().guards.filter(g=>g.hp>0&&g.mode!=='replacement').map(g=>({...g,id:this.id(g)}));}
  victim(e:EnemyBody){
    if(e.attack){const locked=this.targets().find(g=>g.id===e.targetId);if(locked)return locked;}
    return this.targets().filter(g=>this.post(g).role==='melee'&&!['retreat','recover'].includes(g.mode)&&dist(g,e)<250&&clearMeleeLine(e,g)).sort((a,b)=>dist(a,e)-dist(b,e))[0];
  }
  receive(c:EnemyContact,source:EnemyBody,released?:ReleasedAttack){
    const g=this.read().guards.find(g=>this.id(g)===c.targetId);if(!g||g.hp<=0||c.attack.cancelled)return;
    const key=`${c.attack.attackId}:${this.id(g)}`;if(this.hit.has(key))return;this.hit.add(key);if(this.hit.size>1000)this.hit=new Set([key]);
    const event:DamageEvent={sourceId:source.id,targetId:this.id(g),attackId:c.attack.attackId,amount:c.attack.damage,sourceType:released?'enemy-shot':'enemy-melee',eventId:null};
    const target={id:this.id(g),faction:'village' as const,hp:g.hp,armor:this.post(g).armor};
    const hit=released?resolveReleasedDamage(event,released,target):resolveDamage(event,{id:source.id,faction:'hostile',hp:source.hp,armor:0},target);
    if(!hit.applied)return;g.hp=hit.hp;c.attack.resolved=true;this.changed();
    if(g.hp===0){g.mode='down';g.replacement=20000;}else if(g.hp<this.post(g).maxHP*.35)g.mode='retreat';
  }
  private walk(g:CityGuardState,target:Point,delta:number,elevated=false){const d=dist(g,target),speed=140,step=Math.min(d,speed*delta/1000);if(d<1)return true;
    if(elevated){g.x+=(target.x-g.x)/d*step;g.y+=(target.y-g.y)/d*step;}
    else if(g.slot.startsWith('patrol-')||g.slot.startsWith('post-')||!clearMotionLine(g,target)){if(!this.navigation.has(g.slot))this.navigation.set(g.slot,lifeNavigation());const body={...g,space:'village' as const};if(this.hubs.has(g.slot)&&dist(g,CITY.plaza)<6)this.hubs.delete(g.slot);if(!this.hubs.has(g.slot)&&dist(g,target)>2200)this.hubs.add(g.slot);const waypoint=this.hubs.has(g.slot)?CITY.plaza:target;moveLife(body,{...waypoint,space:'village'},delta,this.now,this.budget,this.navigation.get(g.slot)!);g.x=body.x;g.y=body.y;}
    else sweepMove(g,(target.x-g.x)/d*step,(target.y-g.y)/d*step,motionBlocked,clearMotionLine);
    return dist(g,target)<6;
  }
  update(delta:number,now:number,player:Point,enemies:readonly EnemyBody[],budget:NavigationBudget={queries:12,remainingMs:2},time?:number){
    this.budget=budget;this.now=now;
    if(player.x<CITY.left-1400||player.x>CITY.right+1000||player.y<CITY.top-1000||player.y>CITY.bottom+1000){this.arrows=[];return;}
    const live=enemies.filter(e=>e.hp>0&&!e.disabled),s=this.read();
    // 每个游戏小时一岗实际退回交接点再归岗；首次加载只记录时段，不重放漏掉的换岗。
    if(time!==undefined){const hour=Math.floor(time/60);if(this.shiftHour!==undefined&&hour!==this.shiftHour&&s.progress.alarm==='daily'){
      const g=s.guards[hour%s.guards.length],post=this.post(g);if(g.mode==='post'&&g.hp===post.maxHP){g.mode='retreat';this.changed();}
    }this.shiftHour=hour;}

    for(let turn=0;turn<s.guards.length;turn++){const index=(this.guardCursor+turn)%s.guards.length,g=s.guards[index];
      const p=this.post(g);g.cooldown=Math.max(0,g.cooldown-delta);
      if(g.mode==='down'){g.replacement=Math.max(0,g.replacement-delta);if(g.replacement===0){g.serial++;g.hp=p.maxHP;g.x=g.slot.startsWith('melee-')||g.slot.startsWith('archer-')?10160:13300;g.y=g.slot.startsWith('melee-')||g.slot.startsWith('archer-')?1600:850;g.mode='replacement';g.peace=0;this.changed();}continue;}
      if(g.mode==='replacement'){
        // 后备军先步行穿过城内街道，再从城墙内侧楼梯登上各自射击口。
        const approach=p.role==='archer'?{x:9900,y:p.y}:g.slot.startsWith('melee-')?{x:9780,y:1600}:p;
        if(g.peace===0){if(this.walk(g,approach,delta))g.peace=1;}
        else if(this.walk(g,p,delta,p.role==='archer')){g.mode='post';g.peace=0;g.cooldown=(index%10)*140;}continue;
      }
      if(g.hp<p.maxHP*.35&&g.mode!=='recover')g.mode='retreat';
      if(g.mode==='retreat'){const safe=g.slot.startsWith('melee-')||g.slot.startsWith('archer-')?{x:10020,y:1600}:{x:13300,y:850};if(p.role==='archer'&&g.x<9898){this.walk(g,{x:9900,y:p.y},delta,true);continue;}if(this.walk(g,safe,delta))g.mode='recover';continue;}
      if(g.mode==='recover'){g.hp=Math.min(p.maxHP,g.hp+60*delta/1000);if(g.hp===p.maxHP){g.mode='replacement';g.peace=0;this.changed();}continue;}
      const target=live.filter(e=>dist(e,g.slot.startsWith('melee-')||p.role==='archer'?CITY.gate:p)<(p.role==='melee'?450:1000)&&dist(e,g)<(p.role==='melee'?520:850)).sort((a,b)=>dist(g,a)-dist(g,b))[0];
      if(!target){g.peace=Math.min(8000,g.peace+delta);if(g.peace>1500){g.mode='post';if(g.slot.startsWith('patrol-')){const route=CITY_PATROL_ROUTES[Math.floor(Number(g.slot.split('-')[1])/2)],at=this.patrol.get(g.slot)??0,point={x:route[at%route.length][0]+Number(g.slot.split('-')[1])%2*48,y:route[at%route.length][1]+Number(g.slot.split('-')[1])%2*40};if(this.walk(g,point,delta))this.patrol.set(g.slot,at+1);}else this.walk(g,p,delta,p.role==='archer');}continue;}
      g.peace=0;g.mode='intercept';
      if(p.role==='melee'){
        if(dist(g,target)>78){const d=dist(g,target),t={x:target.x+(g.x-target.x)/d*58,y:target.y+(g.y-target.y)/d*58};if(dist(t,g.slot.startsWith('melee-')?CITY.gate:p)<520)this.walk(g,t,delta);continue;}
        if(g.cooldown>0||!clearMeleeLine(g,target))continue;g.cooldown=900;
        const hit=resolveDamage({sourceId:this.id(g),targetId:target.id,attackId:`${this.id(g)}:${++this.serial}`,amount:42,sourceType:'guard-melee',eventId:null},{id:this.id(g),faction:'village',hp:g.hp,armor:p.armor},{id:target.id,faction:'hostile',hp:target.hp,armor:0,...enemyProtection(target,g,now)});
        if(!hit.applied)continue;target.hp=hit.hp;
        if(now-(this.knock.get(target.id)??-Infinity)>=800){const d=dist(g,target)||1;sweepMove(target,(target.x-g.x)/d*38,(target.y-g.y)/d*38,motionBlocked,clearMotionLine);this.knock.set(target.id,now);}
        if(hit.killed)this.killed(target);
      }else{
        if(g.cooldown>0)continue;
        const port=CITY_FIRING_PORTS.find(port=>port.slot===g.slot)!;
        // 只豁免本岗位的狭小射击口。离口后，每一段箭矢仍查询所有墙、树和岩石。
        if(!port.structureIds.length||propLineBlocker(g,port,'melee',undefined,props.filter(w=>!port.structureIds.includes(w.id)))||!clearMeleeLine(port,target))continue;
        g.cooldown=1400+index%3*20;const d=dist(port,target)||1,id=`${this.id(g)}:arrow:${++this.serial}`;
        this.arrows.push({...port,id,vx:(target.x-port.x)/d*650,vy:(target.y-port.y)/d*650,life:1400,released:Object.freeze({sourceId:this.id(g),faction:'village',attackId:id,amount:34,sourceType:'tower-arrow',eventId:null})});
      }
    }
    this.guardCursor=(this.guardCursor+1)%s.guards.length;
    for(const a of this.arrows){const old={x:a.x,y:a.y},dt=Math.min(delta,a.life),next={x:a.x+a.vx*dt/1000,y:a.y+a.vy*dt/1000},direction={x:a.vx/650,y:a.vy/650};
      const hit=live.filter(e=>e.hp>0).map(e=>({e,at:sporeContactAt(old,direction,e,0,dt,clearMeleeLine,650)})).filter(c=>c.at!==null).sort((a,b)=>a.at!-b.at!)[0];
      if(hit){const e=hit.e,result=resolveReleasedDamage({sourceId:a.released.sourceId,targetId:e.id,attackId:a.id,amount:34,sourceType:'tower-arrow',eventId:null},a.released,{id:e.id,faction:'hostile',hp:e.hp,armor:0,...enemyProtection(e,old,now)});e.hp=result.hp;if(result.killed)this.killed(e);a.life=0;}
      else if(!clearMeleeLine(old,next))a.life=0;else Object.assign(a,next);a.life-=dt;
    }
    this.arrows=this.arrows.filter(a=>a.life>0);for(const id of this.knock.keys())if(!live.some(e=>e.id===id))this.knock.delete(id);
  }
}
