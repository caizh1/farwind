import {inProtected} from "../../data/defenseZones";
import { enemyDefs, mapGeometryRevision } from "../../data/world";
import { createEnemyAttack, advanceEnemyAttack, ENEMY_ATTACK, delayEnemyAttack, sampleEnemyAttack, creatureCooldown, type EnemyAttack, type EnemyContact } from "./enemyAttack";
import { enemyKind, enemyProfile } from '../../data/enemies';
import {creatureReach,type EliteKind} from '../../data/maps/windbell/elites';
import {turnToward,wolfFlank} from './enemyTraits';
import {advanceEnemyRecoil,type EnemyRecoil} from './enemyReaction';
import {CAMP_BOSSES,BOSS_RULES,type CampBossKind} from '../../data/maps/windbell/campBosses';
import type {BossBattle} from './campBossState';
import {updateCampBoss} from './campBossCombat';
import {updateFungalPriest} from './fungalCombat';
import {ENEMY_PURSUIT,BOSS_PURSUIT,enemyLeashRadius} from '../../data/enemyPursuit';
export {ENEMY_PURSUIT,enemyLeashRadius} from '../../data/enemyPursuit';
import {
  clearMotionLine,
  clearMeleeLine,
  motionBlocked,
  meleeBlocker,
  type Point,
} from "./obstacles";
export const NAV = {
  cell: 20,
  radius: 480,
  nodes: 1536,
  interval: 600,
  repairRadius: 160,
  repairCandidates: 512,
  repairPaths: 8,
  queriesPerFrame: 2,
  nodesPerBatch: 64,
  frameMs: 2,
} as const;
// 正式画面帧显式携带时间预算；旧模拟调用仍保留每批节点数与查询数的确定性约束。
export type NavigationBudget = {queries:number;remainingMs?:number};
export const navigationBudget = ():NavigationBudget => ({queries:NAV.queriesPerFrame,remainingMs:NAV.frameMs});
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
type Space = {
  blocked: (x: number, y: number) => boolean;
  clear: (a: Point, b: Point) => boolean;
};
const space: Space = { blocked: motionBlocked, clear: clearMotionLine };

// 小地图的有界局部A*；每条边连续检查脚底扫掠，不穿角、不跨水。
export function* pathSearch(
  start: Point,
  goal: (p: Point) => boolean,
  target: Point,
  allowed: (p: Point) => boolean,
  query: Space = space,
  limits: {radius:number;nodes:number} = NAV,
): Generator<void, { path: Point[] | null; visited: number }> {
  // 分帧期间实体可以移动；搜索网格始终以开始时的位置为基准。
  start={...start};target={...target};
  const nodes = [
    { p: { ...start }, g: 0, f: distance(start, target), parent: -1 },
  ];
  const open = [0],
    seen = new Map<string, number>([["0,0", 0]]),
    closed = new Set<number>();
  let visited = 0;
  while (open.length && visited < limits.nodes) {
    let best = 0;
    for (let i = 1; i < open.length; i++)
      if (nodes[open[i]].f < nodes[open[best]].f) best = i;
    const index = open.splice(best, 1)[0],
      node = nodes[index];
    if (closed.has(index)) continue;
    closed.add(index);
    visited++;
    if (goal(node.p)) {
      const path: Point[] = [];
      for (let i = index; nodes[i].parent >= 0; i = nodes[i].parent)
        path.unshift(nodes[i].p);
      return { path, visited };
    }
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
      [1, 1],
      [-1, 1],
      [-1, -1],
      [1, -1],
    ]) {
      const p = { x: node.p.x + dx * NAV.cell, y: node.p.y + dy * NAV.cell };
      const key = `${Math.round((p.x - start.x) / NAV.cell)},${Math.round((p.y - start.y) / NAV.cell)}`;
      if (
        distance(p, start) > limits.radius ||
        !allowed(p) ||
        query.blocked(p.x, p.y) ||
        !query.clear(node.p, p)
      )
        continue;
      const g = node.g + Math.hypot(dx, dy) * NAV.cell,
        existing = seen.get(key);
      if (existing !== undefined) {
        if (closed.has(existing) || nodes[existing].g <= g) continue;
        Object.assign(nodes[existing], {
          g,
          f: g + Math.max(0, distance(p, target) - 70),
          parent: index,
        });
      } else {
        // 生成数与展开数都有硬上限，避免不可达目标耗尽全图。
        if (nodes.length >= limits.nodes) continue;
        seen.set(key, nodes.length);
        nodes.push({
          p,
          g,
          f: g + Math.max(0, distance(p, target) - 70),
          parent: index,
        });
        open.push(nodes.length - 1);
      }
    }
    // 每次暂停已完成一个节点的所有边检查；恢复时保留原有优先级与父节点。
    yield;
  }
  return { path: null, visited };
}
export function localPath(...args: Parameters<typeof pathSearch>) {
  const search = pathSearch(...args);
  let result = search.next();
  while (!result.done) result = search.next();
  return result.value;
}
type PathResult=ReturnType<typeof localPath>;
type PathJob={search:ReturnType<typeof pathSearch>;target:Point;context:string;revision:number};
// 生成器不进入实体、诊断快照或存档；重建导航对象时自然释放旧任务。
const pathJobs=new WeakMap<EnemyBody['nav'],PathJob>();
export const pathPending=(nav:EnemyBody['nav'])=>pathJobs.has(nav);
export const cancelPath=(nav:EnemyBody['nav'])=>{pathJobs.delete(nav);};
export function advancePathSearch(search:ReturnType<typeof pathSearch>,budget:NavigationBudget,limit:number=NAV.nodesPerBatch):{expanded:number;result?:PathResult}{
  if(budget.queries<=0||(budget.remainingMs??Infinity)<=0)return {expanded:0};
  budget.queries--;
  const start=performance.now(),allowance=budget.remainingMs??Infinity;
  let expanded=0;
  try{
    while(expanded<limit){
      const next=search.next();expanded++;
      if(next.done)return {expanded,result:next.value};
      if(performance.now()-start>=allowance)break;
    }
    return {expanded};
  }finally{
    // 时间预算在完整节点之后检查，最多超出一个节点；节点数量另有硬上限。
    if(budget.remainingMs!==undefined)budget.remainingMs=Math.max(0,budget.remainingMs-(performance.now()-start));
  }
}
export function planPath(nav:EnemyBody['nav'],target:Point,context:string,build:(target:Point)=>ReturnType<typeof pathSearch>,budget:NavigationBudget): (PathResult&{target:Point})|undefined{
  let job=pathJobs.get(nav);
  // 小幅移动继续完成已有规划，避免追击目标每帧移动导致搜索永远重头开始。
  if(job&&(job.context!==context||job.revision!==mapGeometryRevision||distance(job.target,target)>NAV.radius/2)){
    cancelPath(nav);nav.path=[];job=undefined;
  }
  if(!job){
    if(budget.queries<=0||(budget.remainingMs??Infinity)<=0)return;
    const frozen={...target};job={search:build(frozen),target:frozen,context,revision:mapGeometryRevision};
    pathJobs.set(nav,job);nav.queries++;nav.target={...frozen};nav.failed=false;
  }
  const batch=advancePathSearch(job.search,budget);
  if(!batch.result)return;
  cancelPath(nav);return {...batch.result,target:job.target};
}
export function nearestStanding(
  origin: Point,
  anchors: Point[],
  allowed: (p: Point) => boolean,
  query: Space = space,
) {
  if (allowed(origin) && !query.blocked(origin.x, origin.y))
    return { ...origin };
  const candidates: Point[] = [];
  for (let x = -NAV.repairRadius; x <= NAV.repairRadius; x += 8)
    for (let y = -NAV.repairRadius; y <= NAV.repairRadius; y += 8)
      if (Math.hypot(x, y) <= NAV.repairRadius)
        candidates.push({ x: origin.x + x, y: origin.y + y });
  candidates.sort((a, b) => distance(a, origin) - distance(b, origin));
  let paths = 0;
  const safeAnchors = anchors.filter(
    (p) => allowed(p) && !query.blocked(p.x, p.y),
  );
  for (const p of candidates.slice(0, NAV.repairCandidates)) {
    if (!allowed(p) || query.blocked(p.x, p.y)) continue;
    if (safeAnchors.some((a) => query.clear(p, a))) return p;
    if (paths >= NAV.repairPaths) break;
    for (const anchor of safeAnchors) {
      if (++paths > NAV.repairPaths) break;
      if (
        localPath(
          p,
          (q) => distance(q, anchor) < 30 && query.clear(q, anchor),
          anchor,
          allowed,
          query,
        ).path
      )
        return p;
    }
  }
  return null;
}
export function repairEnemyPoint(origin: Point, home: Point, radius = 420) {
  // 掉落沿用原范围；实体位置修复使用自身实际活动边界。
  const allowed = (p: Point) =>
    distance(p, home) <= radius;
  const anchors = [
    home,
    ...enemyDefs.map((d) => ({ x: d.x, y: d.y })),
    { x: home.x, y: 1100 },
  ];
  return nearestStanding(origin, anchors, allowed);
}
export type EnemyBody = Point & {
  fungalShield?:EnemyBody;
  bossSummon?:{owner:string;attempt:number};
  passiveRoot?:{owner:string;index:number;attempt:number;kind?:'root'|'sac'|'rock'|'sigil'};
  runeSlow?:number;
  eliteLevel?:number;
  maxHP?:number;
  id: string;
  type: string;
  elite?: EliteKind;
  boss?:CampBossKind;
  bossBattle?:BossBattle;
  bossAttempt?:number;
  hp: number;
  homeX: number;
  homeY: number;
  patrolTarget?:Point;
  leashRadius?:number;
  face?:Point;
  guardOpenUntil?:number;
  cool: number;
  windup: number;
  staggerUntil: number;
  staggerSince?: number;
  attack?: EnemyAttack | null;
  attackSerial?: number;
  targetId?: string | null;
  playerAggroUntil?: number;
  companionAggroUntil?: number;
  companionControlGrace?: number;
  companionControlLimit?: number;
  parried?: {at:number;until:number;direction:Point;perfect:boolean};
  wallHit?: {at:number;until:number;direction?:Point};
  recoil?:EnemyRecoil;
  nav: {
    path: Point[];
    target?: Point;
    mode?: "chase" | "return";
    next: number;
    failed: boolean;
    returning: boolean;
    lastSeen?: Point;
    lostAt?: number;
    queries: number;
    visited: number;
  };
  ai: string;
  rejection?: string;
  disabled: boolean;
  recovered: boolean;
};
export const enemyNavigation = (): EnemyBody["nav"] => ({
  path: [],
  next: 0,
  failed: false,
  returning: false,
  queries: 0,
  visited: 0,
});
export function enemyAttackSpace(e:Pick<EnemyBody,"homeX"|"homeY"|"leashRadius"|"boss">) {
  return {blocked:(x:number,y:number)=>motionBlocked(x,y)||distance({x,y},{x:e.homeX,y:e.homeY})>enemyLeashRadius(e),clear:clearMotionLine,melee:clearMeleeLine,
    // 家园边界只停止追击；只有真正的地形或障碍接触才播放撞墙失衡。
    wall:(a:Point,b:Point)=>motionBlocked(b.x,b.y)||!clearMotionLine(a,b)};
}
export const enemyAttackPermitted=(e:Pick<EnemyBody,"homeX"|"homeY"|"leashRadius"|"boss">,player:Point)=>distance(player,{x:e.homeX,y:e.homeY})<=enemyLeashRadius(e)+100;
export function staggerEnemy(e:Pick<EnemyBody,"staggerUntil"|"staggerSince">,now:number,duration:number) {
  e.staggerUntil=Math.max(e.staggerUntil,now+duration);
  e.staggerSince=now;
}
export function companionControl(e: EnemyBody, now:number, duration:number) {
  if(e.boss&&e.bossBattle){
    if(now<e.bossBattle.entryUntil||now<e.bossBattle.controlImmuneUntil)return;
    const ms=Math.min(BOSS_RULES.control,duration);
    staggerEnemy(e,now,ms);e.bossBattle.controlImmuneUntil=now+ms+BOSS_RULES.controlImmunity;
    return;
  }
  const continuing=now<e.staggerUntil;
  const grace=!continuing&&now<(e.companionControlGrace??0);
  if(!continuing||e.companionControlLimit===undefined)e.companionControlLimit=now+800;
  const until=Math.min(e.companionControlLimit,now+Math.min(800,duration)*(grace?.5:1));
  if(until>now){staggerEnemy(e,now,until-now);if(e.attack)e.attack.cancelled=true;}
  e.companionControlGrace=e.staggerUntil+1000;
}
export function validateEnemyPosition(e: EnemyBody) {
  if (e.hp <= 0 || e.disabled) return;
  if (!motionBlocked(e.x, e.y) && !motionBlocked(e.homeX, e.homeY)) return;
  const point = repairEnemyPoint(e, { x: e.homeX, y: e.homeY }, enemyLeashRadius(e));
  e.recovered = true;
  e.windup = 0;
  if(e.attack)e.attack.cancelled=true;
  e.attack=null;
  e.nav = enemyNavigation();
  if (!point) {
    e.disabled = true;
    e.ai = "无合法位置";
    return;
  }
  Object.assign(e, point, { homeX: point.x, homeY: point.y });
}
export function updateEnemy(
  e: EnemyBody,
  player: Point,
  now: number,
  dtMs: number,
  budget?: NavigationBudget,
  targetId = "player",
  permission: (enemy:EnemyBody,targetId:string)=>boolean = ()=>true,
  peers:readonly EnemyBody[] = [],
): EnemyContact | null {
  const dt = dtMs/1000*(1-(e.runeSlow??0)), prev=now-dtMs;
  advanceEnemyRecoil(e,now);
  if (e.hp <= 0 || e.disabled) {
    cancelPath(e.nav);
    e.ai = e.hp <= 0 ? "死亡" : "无合法位置";
    return null;
  }
  validateEnemyPosition(e);
  if (e.disabled) return null;
  if(e.passiveRoot){e.ai='祭根护心';return null;}
  if(e.type==='priest')return updateFungalPriest(e,peers,player,now,dtMs,targetId,permission);
  const d = distance(e, player),
    home = { x: e.homeX, y: e.homeY };
  const safe = enemyAttackPermitted(e,player);
  if(e.boss){const event=updateCampBoss(e,player,now,dtMs*(1-(e.runeSlow??0)),targetId,safe&&permission(e,targetId));if(event!==undefined)return event;}
  e.rejection = !safe
    ? "家园追击边界"
    : d >= creatureReach(e.type,e.elite)
      ? "距离"
      : meleeBlocker(e, player);
  if(e.attack&&!e.attack.cancelled) {
    const frozen=Math.max(0,Math.min(now,e.staggerUntil)-Math.max(prev,e.staggerSince??prev));
    delayEnemyAttack(e.attack,frozen);
    e.windup=Math.max(0,e.attack.contactAt-now);
  }
  if (now < e.staggerUntil) {
    e.ai = "硬直";
    return null;
  }
  if(e.type==='guardian'&&!e.attack&&d<380)e.face=turnToward(e.face??{x:0,y:1},{x:player.x-e.x,y:player.y-e.y},dt);
  // 从局部驻防交还给野怪AI时，不把未释放的守卫攻击转嫁给玩家。
  if(e.attack&&e.targetId&&e.targetId!==targetId){e.attack.cancelled=true;e.attack=null;e.cool=now+250;}
  if (e.attack) {
    const attack=e.attack;
    const contact=advanceEnemyAttack(attack,e,player,now,enemyAttackSpace(e));
    e.windup=attack.cancelled?0:Math.max(0,attack.contactAt-now);
    e.ai=attack.cancelled?"攻击取消":({charge:"蓄力",commit:"锁向承诺",active:"真正出手",recovery:"收招"}[sampleEnemyAttack(attack,now,e).phase]);
    if(contact)e.cool=Math.max(e.cool,creatureCooldown(attack));
    if(attack.wallAt!==undefined){e.wallHit={at:attack.wallAt,until:attack.wallAt+850,direction:{...attack.direction}};staggerEnemy(e,attack.wallAt,850);e.cool=attack.wallAt+1400;e.ai='撞墙失衡';}
    if(now>=attack.recoveryUntil||attack.cancelled)e.attack=null;
    return contact;
  }
  const profile=enemyProfile(e.type);
  const aligned=e.type!=='guardian'||d<1||((player.x-e.x)*(e.face?.x??0)+(player.y-e.y)*(e.face?.y??1))/d>.94;
  const permitted=permission(e,targetId);
  if (!e.boss && d < creatureReach(e.type,e.elite) && now > e.cool && safe && aligned && clearMeleeLine(e, player)&&permitted) {
    e.targetId=targetId;
    e.attack=createEnemyAttack(e.id,e.attackSerial=(e.attackSerial??0)+1,e.type,now,e,player,undefined,e.elite);
    if(e.type==='guardian'){e.attack.direction={...e.face!};e.attack.locked=true;}
    e.cool=creatureCooldown(e.attack);
    e.windup = e.attack.contactAt-now;
    e.ai = "前摇";
    e.nav.path = [];
    cancelPath(e.nav);
    e.nav.mode = "chase";
    e.nav.returning = false;
    e.nav.lastSeen = {...player};
    e.nav.lostAt = undefined;
    return null;
  }
  const radius=enemyLeashRadius(e),homeDistance=distance(e,home),targetHomeDistance=distance(player,home);
  const pursuit=e.boss?BOSS_PURSUIT:ENEMY_PURSUIT;
  const provoked=(e.playerAggroUntil??0)>now||(e.companionAggroUntil??0)>now;
  if(e.nav.returning&&homeDistance<=8)e.nav.returning=false;
  // 回撤可以被重新接近或挑衅打断；边界内留出余量，避免在同一条边缘来回切换。
  const reentry=homeDistance<radius-ENEMY_PURSUIT.returnInset&&targetHomeDistance<radius-ENEMY_PURSUIT.returnInset;
  const noticed=d<ENEMY_PURSUIT.alertDistance&&(!inProtected(player)||provoked)&&
    (e.type==='wolf'?clearMeleeLine(e,player)||provoked:e.type!=='burrow'||provoked);
  if(e.nav.returning&&reentry&&(noticed||(provoked||e.boss)&&d<pursuit.chaseDistance))e.nav.returning=false;
  // 首领只在正式入场后有身体，入场即交战；普通怪仍需近距离感知或挑衅。
  const engaged=(!!e.boss||e.nav.mode==="chase")&&!e.nav.returning||provoked;
  const senses=e.type==='wolf'?engaged||clearMeleeLine(e,player):e.type==='burrow'?engaged:false;
  const canChase = d < (engaged?pursuit.chaseDistance:ENEMY_PURSUIT.alertDistance) && safe &&
    homeDistance<=radius&&targetHomeDistance<=radius &&
    (!inProtected(player)||engaged) && (!['wolf','burrow'].includes(e.type)||senses);
  let chase=canChase&&!e.nav.returning,tracking=chase;
  let target=player;
  if(chase){e.nav.lastSeen={...player};e.nav.lostAt=undefined;}
  else if(engaged&&!e.nav.returning&&homeDistance<=radius&&e.nav.lastSeen&&distance(e.nav.lastSeen,home)<=radius){
    // 丢失目标后只前往最后看到的位置，不读取范围外目标的新位置。
    e.nav.lostAt??=now;
    if(now-e.nav.lostAt<pursuit.lostDelay){chase=true;target=e.nav.lastSeen;}
  }
  if(!chase){
    if((!e.patrolTarget||e.nav.mode==="chase"||e.nav.returning)&&homeDistance>8)e.nav.returning=true;
    e.nav.lastSeen=undefined;e.nav.lostAt=undefined;
    target=e.nav.returning?home:e.patrolTarget??home;
  }
  if(tracking&&!permitted&&e.type!=='spore'&&d<150){const side=[...e.id].reduce((n,c)=>n+c.charCodeAt(0),0)%2?1:-1,dx=(e.x-player.x)/(d||1),dy=(e.y-player.y)/(d||1),flank={x:player.x-dy*92*side,y:player.y+dx*92*side};if(!motionBlocked(flank.x,flank.y)&&allowedFlank(flank))target=flank;}
  function allowedFlank(p:Point){return distance(p,home)<radius&&clearMotionLine(e,p);}
  // 镰灵远处侧向接近；近身仍走向真实目标，不改攻击方向与碰撞。
  if(tracking&&!e.boss&&e.type==='leaf'&&d>145){const sign=e.id.endsWith('2')?-1:1,dx=(e.x-player.x)/d,dy=(e.y-player.y)/d;
    const flank={x:player.x-dy*75*sign,y:player.y+dx*75*sign};if(!motionBlocked(flank.x,flank.y)&&distance(flank,home)<radius)target=flank;}
  if(tracking&&!e.boss&&['wolf','shade'].includes(e.type)&&d>165){const flank=wolfFlank(e,player);if(!motionBlocked(flank.x,flank.y)&&distance(flank,home)<radius)target=flank;}
  // 孢卫进入中距离后等待喷射冷却，玩家过近时只在合法空间后撤。
  if(tracking&&!e.boss&&e.type==='spore'&&d<155){const retreat={x:e.x+(e.x-player.x)/(d||1)*65,y:e.y+(e.y-player.y)/(d||1)*65};
    if(distance(retreat,home)<radius&&!motionBlocked(retreat.x,retreat.y)&&clearMotionLine(e,retreat))target=retreat;}
  const
    mode = chase ? "chase" : "return";
  const reached = (p: Point,aim=player,destination=target) =>
    tracking
      ? (e.boss?distance(p,aim)<100:!permitted&&e.type!=='spore'?distance(p,destination)<12:e.type==='spore'?distance(p,aim)>=155&&distance(p,aim)<270:distance(p,aim) < Math.max(70,creatureReach(e.type,e.elite)-10)) && clearMeleeLine(p,aim)
      : distance(p,destination) <= 8;
  if (reached(e)) {
    e.ai = chase ? tracking?"等待冷却":"搜索目标" : "家园";
    e.nav.mode=mode;
    e.nav.target={...target};
    e.nav.path = [];
    cancelPath(e.nav);
    return null;
  }
  const allowed = (p: Point) =>
    distance(p, home) <= (chase ? radius : Math.max(radius, homeDistance + 1));
  const changed =
    e.nav.mode !== mode ||
    !e.nav.target ||
    distance(e.nav.target, target) >= 32;
  e.nav.mode=mode;
  let waypoint: Point | undefined;
  if (allowed(target) && clearMotionLine(e, target)) {
    cancelPath(e.nav);
    waypoint = target;
    e.nav.path = [];
    e.nav.failed = false;
    e.nav.target = { ...target };
    e.nav.mode = mode;
  } else {
    if (
      pathPending(e.nav)||now >= e.nav.next &&
      (changed || (!e.nav.failed && !e.nav.path.length))
    ) {
      // 大范围追击和返家分段推进，仍保留每次查询的半径、节点与帧预算。
      const result=planPath(e.nav,target,`${mode}:${targetId}`,frozen=>{
        const origin={x:e.x,y:e.y},aim={...player},targetDistance=distance(origin,frozen),distant=targetDistance>NAV.radius-NAV.cell*2;
        const goal=(q:Point)=>chase?reached(q,aim,frozen):distance(q,frozen)<30&&clearMotionLine(q,frozen);
        return pathSearch(origin,q=>goal(q)||distant&&distance(q,frozen)<=targetDistance-NAV.radius/2,frozen,allowed);
      },budget??navigationBudget());
      if(result){
        const last=result.path?.at(-1);
        if(!chase&&last&&distance(last,result.target)<30&&clearMotionLine(last,result.target))result.path!.push(result.target);
        e.nav.path=result.path??[];e.nav.target={...result.target};e.nav.next=now+NAV.interval;
        e.nav.failed=result.path===null;e.nav.visited=result.visited;
        if(e.nav.path[0]&&!clearMotionLine(e,e.nav.path[0])){e.nav.path=[];e.nav.next=now;e.nav.failed=false;}
      }
    }
    while (e.nav.path.length && distance(e, e.nav.path[0]) < 0.01)
      e.nav.path.shift();
    waypoint = e.nav.path[0];
  }
  if (!waypoint) {
    e.ai = e.nav.failed ? "无路径等待" : pathPending(e.nav)?"分帧规划路线":"等待查询";
    return null;
  }
  const length = distance(e, waypoint),
    step = Math.min(length, (e.boss?CAMP_BOSSES[e.boss].speed:profile.speed) * dt);
  const next = {
    x: e.x + ((waypoint.x - e.x) / length) * step,
    y: e.y + ((waypoint.y - e.y) / length) * step,
  };
  if (
    length > 0 &&
    allowed(next) &&
    !motionBlocked(next.x, next.y) &&
    clearMotionLine(e, next)
  ) {
    Object.assign(e, next);
    e.ai = chase ? tracking?(e.nav.path.length ? "绕障" : "追击"):"搜索目标" : "回家";
  } else {
    e.nav.path = [];
    e.ai = "受阻等待";
  }
  return null;
}
