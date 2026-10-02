import {CAMP_BOSSES,BOSS_RULES,type CampBossKind} from '../../data/maps/windbell/campBosses';
import {createEnemyAttack,advanceEnemyAttack,delayEnemyAttack,aim,geometryTouches,type EnemyAttack,type EnemyContact,type AttackGeometry} from './enemyAttack';
import {sweepMove} from './combat';
import {motionBlocked,clearMotionLine,clearMeleeLine,type Point} from './obstacles';
import type {EnemyBody} from './enemy';
import type {EnemyProjectiles} from './enemyProjectiles';
import {enemyLeashRadius} from '../../data/enemyPursuit';
import {initialBossBattle,shiftBossBattle,shiftBossAttack,shiftBossHazard,shiftBossShot,type BossBattle,type BossHazard,type SavedBossCombat} from './campBossState';

const range=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
// 预警与实际危险区共用落点，真实障碍处不显示无法生效的攻击。
export function bossHazardPoints(a:EnemyAttack){const p=a.bossGeometry!.point,d=a.direction;return (a.boss==='bound-branch'||a.type==='geomancer'?[-110,110].map(n=>({x:p.x-d.y*n,y:p.y+d.x*n})):[{...p}]).filter(p=>!motionBlocked(p.x,p.y));}
const space=(e:EnemyBody)=>({blocked:(x:number,y:number)=>motionBlocked(x,y)||(e.bossBattle?.roots?.some(r=>r.kind==='rock'&&r.hp>0&&Math.hypot(x-r.x,y-r.y)<34)??false)||range({x,y},{x:e.homeX,y:e.homeY})>enemyLeashRadius(e),clear:clearMotionLine,melee:clearMeleeLine,wall:(a:Point,b:Point)=>motionBlocked(b.x,b.y)||!clearMotionLine(a,b)||(e.bossBattle?.roots?.some(r=>r.kind==='rock'&&r.hp>0&&Math.hypot(b.x-r.x,b.y-r.y)<34)??false)});
export const bossMajor=(kind:CampBossKind,move:number)=>kind==='thorn-crown'?move>=4:kind==='bound-branch'?move===2||move===5:move===3||move===4||move===5;
export function selectBossMove(e:EnemyBody,target:Point,now:number){const b=e.bossBattle!,distance=range(e,target),kind=e.boss!;b.cooldowns??=Array(6).fill(0);
 const nodes=b.roots??[],wolves=b.summons??[];
 const usable=(i:number)=>!(kind==='thorn-crown'&&i===4&&((b.summoned??0)>=4||wolves.filter(w=>w.hp>0).length>=2))&&!(kind==='crag-tusk'&&i===4&&nodes.filter(r=>r.kind==='rock'&&r.hp>0).length>=3)&&!(kind==='spore-heart'&&i===5&&nodes.filter(r=>r.kind==='sac'&&r.hp>0).length>=2);
 const candidates=Array.from({length:6},(_,i)=>i).filter(i=>i!==b.lastSkill&&b.cooldowns![i]<=now&&(!b.major||!bossMajor(kind,i))&&usable(i));
 const facing=e.face??{x:0,y:1},behind=distance>0&&((target.x-e.x)*facing.x+(target.y-e.y)*facing.y)/distance<-.25;
 const score=(i:number)=>(i===(distance>190?0:distance<105?2:1)?4:0)+(i>=4&&b.next%3===2?5:0)+(kind==='thorn-crown'&&behind&&i===2?5:0)+(kind==='crag-tusk'&&nodes.some(r=>r.kind==='rock'&&r.hp>0)&&i===0?2:0)+(kind==='spore-heart'&&nodes.some(r=>r.kind==='root'&&r.hp>0)&&i===4?2:0)+(kind==='bound-branch'&&i===3&&!behind&&e.hp<CAMP_BOSSES[kind].hp*.7?2:0)+(kind==='bound-branch'&&b.phase===2&&i===5&&nodes.filter(r=>r.kind==='sigil'&&r.hp>0).length<2?2:0)+(5-(i+b.next)%6)*.1;
 return candidates.sort((a,c)=>score(c)-score(a)||a-c)[0]??-1;
}
export function bossParts(kind:CampBossKind,move:number,phase:1|2){
  if(kind==='spore-heart')return move===1?3:move===0&&phase===2?2:1;
  if(kind==='thorn-crown')return move===5&&phase===2?2:move===0?(phase===2?3:2):move===1?2:1;
  if(kind==='crag-tusk')return move===0&&phase===2?2:move===2?3:1;
  return move===0?2:move===1&&phase===2?2:1;
}
function bossMove(kind:CampBossKind,b:BossBattle){
  const move=b.move,part=b.part,phase=b.phase;
  let windup=750,active=180,recovery=220,step=0,reach=140,heavy=false,angles:number[]|undefined,area:'circle'|'ring'|undefined,cocoon=false,radius=115,halfAngle=Math.PI*.4,offset=0,rear=false;
  if(kind==='spore-heart'){
    if(move===0){windup=900;reach=340;angles=part?[-.82,-.18,.48]:[-.65,0,.65];}
    if(move===1){windup=900;reach=340;active=350;area='circle';radius=44;heavy=true;}
    if(move===2){step=12;active=200;}
    if(move===3){windup=1100;active=1600;reach=300;area='ring';radius=240;heavy=true;}
  }else if(kind==='thorn-crown'){
    if(move===0){windup=850;step=170;active=260;reach=300;radius=36;halfAngle=.8;heavy=part===2;}
    if(move===1){active=200;offset=part?.55:-.55;halfAngle=.7;}
    if(move===2){windup=750;radius=150;reach=170;rear=true;}
    if(move===3){windup=850;step=180;active=280;reach=300;radius=38;heavy=true;}
  }else if(kind==='crag-tusk'){
    if(move===0){windup=850;step=300;active=400;reach=340;radius=40;halfAngle=.65;heavy=true;}
    if(move===1){radius=140;halfAngle=Math.PI*.45;active=220;}
    if(move===2){windup=850;active=350;area='circle';radius=50;reach=340;heavy=true;}
    if(move===3){windup=1100;active=1700;area='ring';radius=250;reach=300;heavy=true;}
  }else{
    if(move===0){offset=part?.65:-.65;radius=135;halfAngle=.72;active=200;}
    if(move===1){windup=900;reach=340;angles=part?[-.9,-.45,0,.45,.9]:[-.75,-.35,0,.75];}
    if(move===2){windup=1100;active=2200;reach=340;area='circle';radius=38;heavy=true;}
    if(move===3){windup=900;active=2400;reach=260;cocoon=true;}
  }
  if(move===4){windup=1100;active=300;reach=340;if(kind==='spore-heart'){area='ring';radius=230;heavy=true;}else if(kind==='bound-branch'){step=100;windup=850;reach=260;radius=90;}else{radius=0;}}
  if(move===5){windup=1100;active=kind==='bound-branch'?2100:kind==='thorn-crown'?1100:300;reach=340;heavy=true;
    if(kind==='thorn-crown'||kind==='bound-branch'){area='circle';radius=kind==='thorn-crown'?62:44;}else if(kind==='crag-tusk')angles=phase===2?[-.7,.7]:[-.45,.45];else radius=0;}
  if(bossMajor(kind,move))windup=Math.max(1000,windup);else windup=Math.min(900,Math.max(700,windup));
  return {windup,active,recovery,step,reach,heavy,angles,area,cocoon,radius,halfAngle,offset,rear,sideStep:kind==='thorn-crown'&&move===3?64:0};
}
export function bossEngagementRange(kind:CampBossKind,b:BossBattle){
  const m=bossMove(kind,b);
  if(m.angles||m.area==='circle'||m.cocoon||m.radius===0)return Math.min(330,m.reach);
  // 起手与实际伤害共用规格；侧跃要留出横移距离，避免在打不到的位置空放。
  const reach=m.area==='ring'?m.radius:Math.sqrt(Math.max(0,(m.radius+m.step)**2-m.sideStep**2));
  return Math.max(0,reach-8);
}
export function createBossAttack(e:EnemyBody,now:number,target:Point,b:BossBattle):EnemyAttack{
  const kind=e.boss!,move=b.move,part=b.part;
  const {windup,active,recovery,step,reach,heavy,angles,area,cocoon,radius,halfAngle,offset,rear,sideStep}=bossMove(kind,b);
  const a=createEnemyAttack(e.id,e.attackSerial=(e.attackSerial??0)+1,e.type,now,e,target,windup);
  a.attackId=`${e.id}:战斗${e.bossAttempt??0}:${e.attackSerial}`;
  Object.assign(a,{boss:kind,bossSkill:move,bossPart:part,bossAttempt:e.bossAttempt??0,step,lockAt:now+windup-350,activeUntil:now+windup+active,recoveryUntil:now+windup+active+recovery,damage:((move===4&&(kind==='thorn-crown'||kind==='crag-tusk'))||(move===5&&kind==='spore-heart'))?0:heavy?BOSS_RULES.heavyDamage:BOSS_RULES.damage,range:reach,parryable:!area&&!cocoon&&radius>0,bossShotAngles:angles,bossArea:area,bossCocoon:cocoon,
    bossGeometry:{kind:area??'sector',point:area==='circle'?{x:target.x,y:target.y}:{x:e.x,y:e.y},radius,halfAngle,offset,rear},
    ...sideStep?{bossSideStep:sideStep,bossSideMotion:0}:{}});
  if(rear){a.direction={...e.face??a.direction};a.locked=true;a.lockAt=now;}
  return a;
}

// 返回 undefined 时由原有有界导航靠近；技能、连招与收招只由本状态机推进。
export function updateCampBoss(e:EnemyBody,target:Point,now:number,dtMs:number,targetId:string,permitted:boolean):EnemyContact|null|undefined{
  const b=e.bossBattle??=initialBossBattle(now),kind=e.boss!;
  if(e.hp<=0||e.disabled)return null;
  if(now<b.entryUntil){e.ai='首领现身';e.windup=0;return null;}
  if(e.attack&&!e.attack.cancelled){const frozen=Math.max(0,Math.min(now,e.staggerUntil)-Math.max(now-dtMs,e.staggerSince??now-dtMs));if(frozen)delayEnemyAttack(e.attack,frozen);}
  if(now<e.staggerUntil){e.ai='首领失衡';return null;}
  if(e.attack){const a=e.attack;
    // 侧跃有真实扫掠和独立蓄力，不瞬移、穿树或在锁向后追踪。
    if(a.bossSideStep&&now<a.lockAt){const u=Math.min(1,(now-a.startedAt)/260),wanted=a.bossSideStep*u,delta=wanted-(a.bossSideMotion??0);if(delta>0){const p=space(e);sweepMove(e,-a.direction.y*delta,a.direction.x*delta,p.blocked,p.clear);a.bossSideMotion=wanted;}}
    if(!a.locked&&a.bossArea==='circle')a.bossGeometry!.point={x:target.x,y:target.y};
    const event=advanceEnemyAttack(a,e,target,now,space(e));e.windup=Math.max(0,a.contactAt-now);e.face={...a.direction};
    e.ai=a.bossCocoon?'护心结茧':now<a.contactAt?'首领蓄力':now<a.activeUntil?'首领出手':'首领收招';
    if(a.wallAt!==undefined&&!a.bossStunned){a.bossStunned=true;e.wallHit={at:a.wallAt,until:a.wallAt+1800,direction:{...a.direction}};e.staggerSince=now;e.staggerUntil=now+1800;b.exposedUntil=Math.max(b.exposedUntil,now+1800);b.part=bossParts(kind,b.move,b.phase)-1;}
    if(now>=a.recoveryUntil||a.cancelled){
      e.attack=null;e.windup=0;
      if(b.part+1<bossParts(kind,b.move,b.phase)){b.part++;b.nextAt=Math.max(now+180,e.staggerUntil,b.exposedUntil);}
      else if(!a.cancelled&&b.phase===2&&(kind==='bound-branch'||(b.cooldowns?.[3]??0)<=now)&&(kind==='thorn-crown'&&b.move===1||kind==='crag-tusk'&&b.move===2||kind==='bound-branch'&&b.move===2||kind==='spore-heart'&&b.move===1)){b.move=kind==='bound-branch'?1:3;b.part=0;b.nextAt=Math.max(now+200,e.staggerUntil,b.exposedUntil);}
      else{
        // 撞墙、拆机关或弹反已经设置窗口；取消的攻击不能在失衡结束后再次延长。
        if(!a.cancelled||!b.exposedUntil)b.exposedUntil=Math.max(b.exposedUntil,now+1800);
        b.move=-1;b.part=0;b.nextAt=Math.max(now,b.exposedUntil,e.staggerUntil);
      }
    }
    return event;
  }
  if(b.move===-1&&b.phase===1&&e.hp<=CAMP_BOSSES[kind].hp*.55){
    // 完整连招结束即转换；转换免伤期间不消耗刚获得的反击窗口。
    const remaining=Math.max(0,b.exposedUntil-now);b.phase=2;b.transformUntil=now+BOSS_RULES.transform;
    if(remaining)b.exposedUntil=b.transformUntil+remaining;
    b.nextAt=Math.max(b.transformUntil,b.exposedUntil);e.ai='首领第二阶段变化';return null;
  }
  if(now<b.nextAt||now<b.transformUntil){e.ai=now<b.transformUntil?'首领第二阶段变化':'首领破防窗口';return null;}
  if(b.move===-1){b.move=selectBossMove(e,target,now);if(b.move<0){b.nextAt=now+200;return null;}b.part=0;}
  if(range(e,target)>bossEngagementRange(kind,b))return undefined;
  if(!permitted||!clearMeleeLine(e,target))return undefined;
  b.lastSkill=b.move;b.major=bossMajor(kind,b.move);b.cooldowns![b.move]=now+(b.major?12000:3500);b.next++;
  e.targetId=targetId;e.attack=createBossAttack(e,now,target,b);e.cool=e.attack.recoveryUntil;e.windup=e.attack.contactAt-now;e.nav.path=[];
  e.nav.mode='chase';e.nav.returning=false;e.nav.lastSeen={...target};e.nav.lostAt=undefined;e.ai='首领前摇';return null;
}

export function bossHazardGeometry(h:BossHazard,now:number):AttackGeometry{const active=now>=h.activeAt,radius=h.kind==='ring'&&active?Math.min(h.radius,BOSS_RULES.ringInner+BOSS_RULES.ringWidth+(now-h.activeAt)/1000*h.speed):h.radius;return {kind:h.kind,a:h.point,b:h.point,radius,inner:h.kind==='ring'?active?Math.max(BOSS_RULES.ringInner,radius-BOSS_RULES.ringWidth):BOSS_RULES.ringInner:undefined};}

// 转换清理尚未命中的弹丸与尚未生效的预警；其他来源和已生效地面区域继续结算。
export function clearBossPendingAttacks(e:EnemyBody,prev:number,hazards:BossHazards,shots:EnemyProjectiles){
  hazards.hazards=hazards.hazards.filter(h=>h.owner!==e.id||h.activeAt<=prev);
  shots.shots=shots.shots.filter(s=>s.attack.attackerId!==e.id||s.state==='burst');
  if(e.attack&&!e.attack.launched)e.attack.cancelled=true;
}

export class BossHazards{
  hazards:BossHazard[]=[];
  clear(owner?:string){this.hazards=owner?this.hazards.filter(h=>h.owner!==owner):[];}
  launch(e:EnemyBody,now:number){const a=e.attack;if(!e.boss&&e.type!=='geomancer'||!a?.bossArea||a.launched||a.cancelled)return;
    const owned=this.hazards.filter(h=>h.owner===e.id);if(owned.length>=3||this.hazards.length>=3)return;
    a.launched=true;
    const geometry=a.bossGeometry!;
    const points=bossHazardPoints(a);
    for(const p of points)if(this.hazards.length<3&&this.hazards.filter(h=>h.owner===e.id).length<3){
      const split=e.boss==='bound-branch'||e.type==='geomancer',i=split&&((p.x-geometry.point.x)*-a.direction.y+(p.y-geometry.point.y)*a.direction.x)>0?1:0;
      this.hazards.push({id:`${a.attackId}:地面${i}`,owner:e.id,attempt:e.bossAttempt??0,kind:a.bossArea,point:p,born:a.startedAt,activeAt:a.contactAt,expires:a.activeUntil,radius:geometry.radius,speed:a.bossArea==='ring'?165:0,damage:a.damage,used:[]});
    }
  }
  update(prev:number,now:number,bodies:readonly EnemyBody[],targets:readonly (Point&{id:string;previous:Point})[]):EnemyContact[]{
    const contacts:EnemyContact[]=[];
    this.hazards=this.hazards.filter(h=>h.expires>prev&&bodies.some(e=>e.id===h.owner&&e.hp>0&&(e.bossAttempt??0)===h.attempt));
    for(const h of this.hazards){const e=bodies.find(e=>e.id===h.owner)!;
      if(!h.independent&&prev<h.activeAt&&(!e.attack||e.attack.cancelled||!h.id.startsWith(e.attack.attackId+':'))){h.expires=now;continue;}
      if(!h.independent&&prev<h.activeAt&&e.attack&&!e.attack.cancelled&&h.id.startsWith(e.attack.attackId+':')){const a=e.attack;h.born=a.startedAt;h.activeAt=a.contactAt;h.expires=a.activeUntil;if(a.bossGeometry){const i=Number(h.id.split('地面').at(-1)),side=e.boss==='bound-branch'||e.type==='geomancer'?(i===0?-110:110):0;h.point={x:a.bossGeometry.point.x-a.direction.y*side,y:a.bossGeometry.point.y+a.direction.x*side};}}
      for(const target of targets){if(h.used.includes(target.id))continue;
        let at:number|null=null,p:Point|undefined,g:AttackGeometry|undefined;
        const end=Math.min(now,h.expires),start=Math.max(prev,h.activeAt);
        for(let t=start;t<=end&&t>=h.activeAt;t=Math.min(end,t+5)){
          const u=now>prev?(t-prev)/(now-prev):1,point={x:target.previous.x+(target.x-target.previous.x)*u,y:target.previous.y+(target.y-target.previous.y)*u};
          const geometry=bossHazardGeometry(h,t);
          if(geometryTouches(geometry,point)&&clearMeleeLine(h.point,point)){at=t;p=point;g=geometry;break;}if(t>=end)break;
        }
        if(at===null)continue;
        h.used.push(target.id);
        const a=createEnemyAttack(e.id,0,e.type,h.born,h.point,p!,h.activeAt-h.born);
        Object.assign(a,{attackId:`${h.id}:${target.id}`,boss:e.boss,bossAttempt:h.attempt,bossSkill:e.bossBattle?.move,locked:true,parryable:false,damage:h.damage,activeUntil:h.expires,recoveryUntil:h.expires,geometry:g,emitted:true});
        contacts.push({at,attack:a,origin:h.point,geometry:g,bossHazardId:h.id,targetId:target.id,sampledPoint:p});
      }
    }
    this.hazards=this.hazards.filter(h=>h.expires>now);return contacts;
  }
}

export function captureBossCombat(e:EnemyBody,now:number,hazards:BossHazards,shots:EnemyProjectiles):SavedBossCombat{
  return {battle:shiftBossBattle(e.bossBattle!, -now),attack:e.attack?shiftBossAttack(e.attack,-now):null,
    hazards:hazards.hazards.filter(h=>h.owner===e.id&&h.expires>now).map(h=>shiftBossHazard(h,-now)),
    shots:shots.shots.filter(s=>s.attack.attackerId===e.id).map(s=>shiftBossShot(s,-now)),
    stagger:Math.min(2000,Math.max(0,e.staggerUntil-now)),parried:e.parried&&e.parried.until>now?{...e.parried,at:e.parried.at-now,until:e.parried.until-now}:null};
}
export function restoreBossCombat(e:EnemyBody,s:SavedBossCombat|null,now:number,hazards:BossHazards,shots:EnemyProjectiles){
  e.bossBattle=s?shiftBossBattle(s.battle,now):initialBossBattle(now,true);
  if(!s)return;
  e.attack=s.attack?shiftBossAttack(s.attack,now):null;e.staggerUntil=now+s.stagger;e.staggerSince=now;
  e.parried=s.parried?{...s.parried,at:s.parried.at+now,until:s.parried.until+now}:undefined;
  hazards.hazards.push(...s.hazards.map(h=>shiftBossHazard(h,now)));shots.shots.push(...s.shots.map(shot=>{const restored=shiftBossShot(shot,now);if(restored.state==='contact'){restored.state='flying';restored.attack.emitted=false;}return restored;}));
}
