import {memoryHealth,memoryStrength} from '../../data/windMemoryDifficulty';
import {activeHostileCount} from './combatUnitBudget';
import type {World} from '../scenes/World';
import {clearMotionLine,motionBlocked} from './obstacles';
import {ENCOUNTER_LIMITS} from '../../data/maps/windbell/encounters';
import type {BossBattle} from './campBossState';
import type {EnemyBody} from './enemy';
import {eastTierFive,eastCloneId,EAST_TIER_FIVE} from './eastBossTierFive';
import {initialBossBattle} from './campBossState';
import {restoreBossCombat} from './campBossCombat';
import {enemyLeashRadius} from '../../data/enemyPursuit';
type Node=NonNullable<BossBattle['roots']>[number];
function updateEastClone(w:World,boss:EnemyBody){
 const b=boss.bossBattle!;if(!eastTierFive(boss)||boss.bossClone)return;
 const clearPoint=(p:{x:number;y:number})=>!motionBlocked(p.x,p.y)&&Math.hypot(p.x-boss.homeX,p.y-boss.homeY)<=enemyLeashRadius(boss)&&Math.hypot(p.x-w.state.player.x,p.y-w.state.player.y)>=90&&w.enemies.every(e=>e===boss||e.hp<=0||Math.hypot(e.x-p.x,e.y-p.y)>=80);
 if(boss.eastCloneRestore){const saved=boss.eastCloneRestore;delete boss.eastCloneRestore;
  const e=w.makeEnemy({id:saved.id,type:'leaf',boss:'bound-branch',x:saved.x,y:saved.y});Object.assign(e,{hp:saved.hp,maxHP:boss.maxHP,memoryDifficulty:boss.memoryDifficulty,bossAttempt:boss.bossAttempt,bossClone:{owner:boss.id,attempt:boss.bossAttempt??0},homeX:boss.homeX,homeY:boss.homeY,leashRadius:boss.leashRadius,attackSerial:saved.serial,face:{...saved.face}});restoreBossCombat(e,saved.combat,w.sim,w.bossHazards,w.enemyProjectiles);boss.eastClone=e;
  if(saved.hp>0)w.enemies.push(e);else{e.sprite.destroy();e.shadow.destroy();}
 }
 if(b.cloneUsed)return;
 if(b.cloneSpawnAt!==undefined){
  if(!b.clonePoint||!clearPoint(b.clonePoint)||activeHostileCount(w)>ENCOUNTER_LIMITS.active){if(boss.attack?.bossSkill===7)boss.attack.cancelled=true;delete b.cloneSpawnAt;delete b.clonePoint;b.cloneRetryAt=w.sim+EAST_TIER_FIVE.retry;return;}
  if(w.sim>=b.cloneSpawnAt){const p=b.clonePoint,id=eastCloneId(boss.id,boss.bossAttempt??0),e=w.makeEnemy({id,type:'leaf',boss:'bound-branch',...p});Object.assign(e,{hp:boss.maxHP,maxHP:boss.maxHP,memoryDifficulty:boss.memoryDifficulty,bossAttempt:boss.bossAttempt,bossClone:{owner:boss.id,attempt:boss.bossAttempt??0},homeX:boss.homeX,homeY:boss.homeY,leashRadius:boss.leashRadius,bossBattle:initialBossBattle(w.sim),face:{...boss.face??{x:0,y:1}}});boss.eastClone=e;w.enemies.push(e);b.cloneUsed=true;b.clonePending=false;delete b.cloneSpawnAt;delete b.clonePoint;}
  return;
 }
 if(!b.clonePending||w.sim<(b.cloneRetryAt??0)||activeHostileCount(w)>=ENCOUNTER_LIMITS.active)return;
 if(b.clonePoint&&clearPoint(b.clonePoint))return;
 b.clonePoint=Array.from({length:48},(_,i)=>{const a=i*Math.PI/12,r=220+Math.floor(i/24)*80;return {x:boss.x+Math.cos(a)*r,y:boss.y+Math.sin(a)*r};}).find(p=>clearPoint(p)&&clearMotionLine(boss,p));
 if(!b.clonePoint)b.cloneRetryAt=w.sim+EAST_TIER_FIVE.retry;
}
export function defeatBossSummon(owner:EnemyBody|undefined,id:string,now:number){
 const b=owner?.bossBattle,s=b?.summons?.find(s=>s.id===id);if(!b||!s||s.hp<=0)return false;s.hp=0;
 const defeated=Math.max(b.summoned??0,b.summons!.length)-b.summons!.filter(s=>s.hp>0).length;
 if(defeated<2||defeated%2!==0)return false;
 b.exposedUntil=now+2000;b.nextAt=Math.max(b.nextAt,b.exposedUntil);if(owner!.attack)owner!.attack.cancelled=true;owner!.staggerUntil=now+2000;return true;
}
// 机关和召唤物只创建正式 EnemyBody；伤害、弹反、死亡继续走 World 的统一入口。
export function updateBossEnvironment(w:World){
 for(const e of w.enemies){
  if(e.bossClone){const owner=w.enemies.find(b=>b.id===e.bossClone!.owner&&b.hp>0&&b.bossAttempt===e.bossClone!.attempt);if(!owner){w.clearBossEffects(e.id);e.sprite.destroy();e.shadow.destroy();w.enemies=w.enemies.filter(b=>b!==e);continue;}owner.eastClone=e;}
  if(e.bossSummon){const owner=w.enemies.find(b=>b.id===e.bossSummon!.owner&&b.bossAttempt===e.bossSummon!.attempt);const saved=owner?.bossBattle?.summons?.find(s=>s.id===e.id);if(saved)Object.assign(saved,{x:e.x,y:e.y,hp:e.hp});}
 }
 for(const boss of [...w.enemies]){
  const b=boss.bossBattle;if(!boss.boss||boss.hp<=0||!b)continue;
  updateEastClone(w,boss);
  const addNodes=(kind:NonNullable<Node['kind']>,count:number,radius:number)=>{
   b.roots??=[];const live=b.roots.filter(r=>r.hp>0&&r.kind===kind).length;
   const available=Array.from({length:32},(_,i)=>({x:boss.x+Math.cos(i*Math.PI/16)*radius,y:boss.y+Math.sin(i*Math.PI/16)*radius})).filter(p=>!motionBlocked(p.x,p.y)&&clearMotionLine(boss,p)&&Math.hypot(p.x-w.state.player.x,p.y-w.state.player.y)>=65&&w.enemies.every(e=>e.hp<=0||Math.hypot(e.x-p.x,e.y-p.y)>=60));
   for(const p of available){const waiting=b.roots.filter((r,i)=>r.hp>0&&!w.enemies.some(e=>e.passiveRoot?.owner===boss.id&&e.passiveRoot.index===i)).length;if(activeHostileCount(w)+waiting>=ENCOUNTER_LIMITS.active)break;if(b.roots.filter(r=>r.hp>0&&r.kind===kind).length>=count)break;if(b.roots.some(r=>r.hp>0&&Math.hypot(r.x-p.x,r.y-p.y)<110))continue;
    let index=b.roots.findIndex(r=>r.hp<=0&&r.kind!=='root');if(index<0){if(b.roots.length>=4)break;index=b.roots.length;}
    const previous=w.enemies.find(e=>e.passiveRoot?.owner===boss.id&&e.passiveRoot.index===index);if(previous){previous.sprite.destroy();previous.shadow.destroy();w.enemies=w.enemies.filter(e=>e!==previous);}
    b.roots[index]={...p,hp:96,kind,...kind==='sac'?{until:w.sim+2500,serial:b.castSerial??0}:{}};
   }
   return live;
  };
  if(boss.boss==='spore-heart'&&b.phase===2&&!b.rootsInitialized){addNodes('root',2,160);b.rootsInitialized=(b.roots?.filter(r=>r.kind==='root').length??0)===2;}
  const a=boss.attack;
  if(a&&!a.cancelled&&w.sim>=a.contactAt&&b.castSerial!==(boss.attackSerial??0)){
   b.castSerial=boss.attackSerial??0;
   if(boss.boss==='spore-heart'&&a.bossSkill===5){addNodes('sac',2,190);}
   if(boss.boss==='crag-tusk'&&a.bossSkill===4){addNodes('rock',3,210);}
   if(boss.boss==='bound-branch'&&b.phase===2&&a.bossSkill===5){addNodes('sigil',2,175);}
   if(boss.boss==='thorn-crown'&&a.bossSkill===4){
    b.summons=(b.summons??[]).filter(s=>s.hp>0);b.summoned??=0;
    const points=Array.from({length:24},(_,i)=>({x:boss.x+Math.cos(i*Math.PI/12)*200,y:boss.y+Math.sin(i*Math.PI/12)*200}));
    for(const p of points){if(b.summons.length>=2||b.summoned>=4)break;if(motionBlocked(p.x,p.y)||!clearMotionLine(boss,p)||Math.hypot(p.x-w.state.player.x,p.y-w.state.player.y)<220||w.enemies.some(e=>e.hp>0&&Math.hypot(e.x-p.x,e.y-p.y)<65)||b.summons.some(e=>Math.hypot(e.x-p.x,e.y-p.y)<90))continue;
      b.summons.push({id:`${boss.id}:护猎:${boss.bossAttempt??0}:${b.summoned++}`,...p,hp:memoryHealth(58,boss.memoryDifficulty)});
    }
   }
  }
  for(const [index,r] of (b.roots??[]).entries())if(r.kind==='sac'&&r.hp>0&&r.until!==undefined){
   const id=`${boss.id}:孢囊:${boss.bossAttempt??0}:${index}:${r.serial??0}`;
   if(!w.bossHazards.hazards.some(h=>h.id===id)&&w.bossHazards.hazards.length<3)w.bossHazards.hazards.push({id,owner:boss.id,attempt:boss.bossAttempt??0,kind:'circle',point:{x:r.x,y:r.y},born:r.until-2500,activeAt:r.until,expires:r.until+250,radius:65,speed:0,damage:22*memoryStrength(boss.memoryDifficulty,true).damage,used:[],independent:true});
   if(w.sim>=r.until){r.hp=0;const body=w.enemies.find(e=>e.passiveRoot?.owner===boss.id&&e.passiveRoot.index===index);if(body){body.hp=0;body.sprite.setVisible(false);body.shadow.setVisible(false);}}
  }
  for(const saved of b.summons??[]){if(saved.hp<=0||w.enemies.some(e=>e.id===saved.id)||activeHostileCount(w)>=ENCOUNTER_LIMITS.active||w.enemies.filter(e=>e.hp>0&&(e.bossSummon||e.id.includes(':唤巢:'))).length>=2)continue;const e=w.makeEnemy({id:saved.id,type:'wolf',x:saved.x,y:saved.y});e.hp=saved.hp;e.bossSummon={owner:boss.id,attempt:boss.bossAttempt??0};w.enemies.push(e);}
 }
}
