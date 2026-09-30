import {CAMP_BOSSES,BOSS_RULES} from '../../data/maps/windbell/campBosses';
import type {EnemyAttack} from './enemyAttack';
import type {SporeShot} from './enemyProjectiles';
import {SPORE} from './enemyAttack';
import type {Point} from './obstacles';

export type BossBattle={phase:1|2;next:number;move:number;part:number;nextAt:number;entryUntil:number;exposedUntil:number;transformUntil:number;controlImmuneUntil:number;startedAt:number};
export type BossHazard={id:string;owner:string;attempt:number;kind:'circle'|'ring';point:Point;born:number;activeAt:number;expires:number;radius:number;speed:number;damage:number;used:string[]};
export type SavedBossCombat={battle:BossBattle;attack:EnemyAttack|null;hazards:BossHazard[];shots:SporeShot[];stagger:number;parried:{at:number;until:number;direction:Point;perfect:boolean}|null};
export type CampBossState={stage:'guards'|'warning'|'battle'|'defeated'|'legacy';warning:number;attempt:number;away:number;combat:SavedBossCombat|null};
export const initialCampBoss=():CampBossState=>({stage:'guards',warning:0,attempt:0,away:0,combat:null});
export const initialBossBattle=(now:number,arriving=false):BossBattle=>({phase:1,next:0,move:-1,part:0,nextAt:now+(arriving?BOSS_RULES.appearance:0)+650,entryUntil:arriving?now+BOSS_RULES.appearance:0,exposedUntil:0,transformUntil:0,controlImmuneUntil:0,startedAt:now});
export const ATTACK_TIMES=['startedAt','lockAt','contactAt','activeUntil','recoveryUntil','scanAt','actualContactAt','wallAt'] as const;
export function shiftBossAttack(attack:EnemyAttack,delta:number){
  const a=structuredClone(attack);for(const key of ATTACK_TIMES)if(a[key]!==undefined)a[key]!+=delta;return a;
}
export const BATTLE_TIMES=['nextAt','entryUntil','exposedUntil','transformUntil','controlImmuneUntil','startedAt'] as const;
export function shiftBossBattle(battle:BossBattle,delta:number){const b={...battle};for(const key of BATTLE_TIMES)b[key]+=delta;return b;}
export function shiftBossHazard(h:BossHazard,delta:number):BossHazard{return {...h,point:{...h.point},used:[...h.used],born:h.born+delta,activeAt:h.activeAt+delta,expires:h.expires+delta};}
export function shiftBossShot(s:SporeShot,delta:number):SporeShot{return {...structuredClone(s),born:s.born+delta,now:s.now+delta,...s.burstAt===undefined?{}:{burstAt:s.burstAt+delta},attack:shiftBossAttack(s.attack,delta)};}

// 校验相对时钟，避免导入无界效果、无效阶段或旧战斗的攻击。
export function validateCampBoss(raw:unknown,owner:string):CampBossState{
  const s=structuredClone(raw) as CampBossState;
  const num=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
  const integer=(v:unknown,min:number,max:number)=>num(v,min,max)&&Number.isSafeInteger(v);
  const point=(v:Point)=>v&&num(v.x,-10000,10000)&&num(v.y,-10000,10000);
  const fail=()=>{throw Error('据点首领存档无效，上一份有效存档仍保留。');};
  if(!s||!['guards','warning','battle','defeated','legacy'].includes(s.stage)||!num(s.warning,0,BOSS_RULES.entry)||!integer(s.attempt,0,1e9)||!num(s.away,0,BOSS_RULES.retreat)||s.combat===undefined)fail();
  if(s.stage!=='warning'&&s.warning!==0||s.stage!=='battle'&&s.combat!==null)fail();
  if(s.combat){const c=s.combat,b=c.battle;
    // 早期第14版存档没有显形时钟，恢复既有战斗时不补演入场。
    if(b&&b.entryUntil===undefined)b.entryUntil=0;
    if(!b||![1,2].includes(b.phase)||!integer(b.next,0,1e9)||!integer(b.move,-1,3)||!integer(b.part,0,6)||!BATTLE_TIMES.every(k=>num(b[k],-1e12,20000))||!num(c.stagger,0,1200)||!Array.isArray(c.hazards)||c.hazards.length>BOSS_RULES.maxHazards||!Array.isArray(c.shots)||c.shots.length>16)fail();
    const boss=Object.entries(CAMP_BOSSES).find(([kind])=>owner==='boss-'+kind);if(!boss)fail();
    const attack=(a:EnemyAttack)=>{
      if(!a||a.boss!==boss![0]||a.attackerId!==owner||typeof a.attackId!=='string'||a.attackId.length>160||!point(a.direction)||Math.abs(Math.hypot(a.direction.x,a.direction.y)-1)>.001||!ATTACK_TIMES.every(k=>a[k]===undefined||num(a[k],-30000,20000))||!['startedAt','lockAt','contactAt','activeUntil','recoveryUntil','scanAt'].every(k=>num(a[k as keyof EnemyAttack],-30000,20000))||typeof a.locked!=='boolean'||typeof a.parryable!=='boolean'||!num(a.range,0,450)||!num(a.halfAngle,0,Math.PI)||!integer(a.bossSkill,0,3)||!num(a.damage,0,60)||!num(a.motionAt,0,600)||typeof a.cancelled!=='boolean'||typeof a.resolved!=='boolean'||typeof a.emitted!=='boolean'||a.bossAttempt!==s.attempt)fail();
      if(a.startedAt>a.lockAt||a.lockAt>a.contactAt||a.contactAt>a.activeUntil||a.activeUntil>a.recoveryUntil)fail();
      if(a.bossShotAngles&&(!Array.isArray(a.bossShotAngles)||a.bossShotAngles.length>8||a.bossShotAngles.some(n=>!num(n,-Math.PI,Math.PI))))fail();
      if(a.bossGeometry&&(!['sector','circle','ring'].includes(a.bossGeometry.kind)||!point(a.bossGeometry.point)||!num(a.bossGeometry.radius,0,450)||!num(a.bossGeometry.halfAngle,0,Math.PI)||a.bossGeometry.offset!==undefined&&!num(a.bossGeometry.offset,-Math.PI,Math.PI)))fail();
    };
    if(c.attack)attack(c.attack);
    for(const h of c.hazards)if(!h||h.owner!==owner||h.attempt!==s.attempt||!['circle','ring'].includes(h.kind)||!point(h.point)||!num(h.radius,0,300)||!num(h.speed,0,300)||!num(h.damage,0,60)||!num(h.born,-30000,10000)||!num(h.activeAt,-30000,10000)||!num(h.expires,0,10000)||h.born>h.activeAt||h.activeAt>h.expires||!Array.isArray(h.used)||h.used.length>2||h.used.some(id=>!['player','xiaobao'].includes(id))||typeof h.id!=='string'||h.id.length>160)fail();
    for(const shot of c.shots){if(!shot||!shot.attack||shot.id!==shot.attack.attackId||shot.attack.attackerId!==owner||!point(shot)||!['flying','contact','burst'].includes(shot.state)||!num(shot.born,-SPORE.life-SPORE.burst,0)||!num(shot.now,shot.born,shot.born+SPORE.life)||shot.state==='burst'&&!num(shot.burstAt,-SPORE.burst,0)||shot.state!=='burst'&&shot.attack.resolved||!shot.released||shot.released.sourceId!==owner||shot.released.faction!=='hostile'||shot.released.sourceType!=='enemy-shot'||shot.released.eventId!==null||shot.released.attackId!==shot.attack.attackId||shot.released.amount!==shot.attack.damage)fail();attack(shot.attack);}
    if(c.parried&&(!num(c.parried.at,-1200,0)||!num(c.parried.until,0,1200)||!point(c.parried.direction)||typeof c.parried.perfect!=='boolean'))fail();
    if(new Set(c.hazards.map(h=>h.id)).size!==c.hazards.length||new Set(c.shots.map(h=>h.id)).size!==c.shots.length)fail();
  }
  return s;
}
