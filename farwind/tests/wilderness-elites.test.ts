import {describe,it,expect,afterEach} from 'vitest';
import {createEnemyAttack,advanceEnemyAttack,creatureCooldown,sporeDirections} from '../src/game/systems/enemyAttack';
import {EnemyProjectiles} from '../src/game/systems/enemyProjectiles';
import {enemyNavigation,updateEnemy,type EnemyBody} from '../src/game/systems/enemy';
import {arenaImpact,canChargeThroughStone} from '../src/game/systems/eliteArena';
import {syncMapGeometry,solidPropAt} from '../src/data/world';
import {ARENA_STONES} from '../src/data/maps/windbell/elites';
const open={blocked:()=>false,clear:()=>true,melee:()=>true};
afterEach(()=>syncMapGeometry(false));
describe('精英招式与场地碰撞',()=>{
 it('头狼两次扑击身份独立且均有650毫秒前摇，第二段收招1100毫秒',()=>{
  const first=createEnemyAttack('alpha',1,'wolf',0,{x:0,y:0},{x:190,y:0},undefined,'alpha');
  const second=createEnemyAttack('alpha',2,'wolf',creatureCooldown(first)+1,{x:150,y:0},{x:240,y:0},undefined,'alpha');
  expect(first.attackId).not.toBe(second.attackId);expect(first.combo).toBe(1);expect(second.combo).toBe(2);
  for(const a of [first,second]){expect(a.contactAt-a.startedAt).toBe(650);expect(a.contactAt-a.lockAt).toBe(280);}
  expect(first.recoveryUntil-first.activeUntil).toBe(140);expect(second.recoveryUntil-second.activeUntil).toBe(1100);expect(creatureCooldown(second)-second.recoveryUntil).toBe(900);
  const root={x:150,y:0};advanceEnemyAttack(second,root,{x:240,y:0},second.lockAt,open);const dir={...second.direction};
  expect(advanceEnemyAttack(second,root,{x:240,y:150},second.activeUntil,open)).toBeNull();expect(second.direction).toEqual(dir);
 });
 it('母孢每次只释放三颗独立弹丸，扇区交替、命中不会错误合并',()=>{
  const a=createEnemyAttack('brood',1,'spore',0,{x:0,y:0},{x:200,y:0},undefined,'brood'),b=createEnemyAttack('brood',2,'spore',3000,{x:0,y:0},{x:200,y:0},undefined,'brood');
  expect(sporeDirections(a)[1]).toEqual(a.direction);expect(sporeDirections(b)[1]).toEqual(b.direction);
  expect(sporeDirections(a)[0].y).toBeGreaterThan(sporeDirections(b)[0].y);expect(sporeDirections(a)[2].y).toBeGreaterThan(sporeDirections(b)[2].y);
  const shots=new EnemyProjectiles();shots.launch(a,{x:0,y:0},a.contactAt);shots.launch(a,{x:0,y:0},a.contactAt+20);expect(shots.shots).toHaveLength(3);expect(new Set(shots.shots.map(s=>s.id)).size).toBe(3);
  const d=sporeDirections(a),targets=d.map((p,i)=>({id:`target-${i}`,x:p.x*200,y:p.y*200}));
  const hit=shots.update(a.contactAt+900,targets[0],()=>true,targets.slice(1));expect(hit).toHaveLength(3);expect(new Set(hit.map(h=>h.projectileId)).size).toBe(3);
  for(const h of hit)shots.settle(h.projectileId!,h.at,false);expect(shots.update(a.contactAt+1000,targets[0],()=>true,targets.slice(1))).toHaveLength(0);
 });
 it('林豕只有真实冲锋撞到指定石障才破坏，普通林豕或单纯靠近均不能拆除',()=>{
  syncMapGeometry(false);const e:EnemyBody={id:'elite-rock-ram',type:'boar',elite:'ram',hp:180,x:1080,y:-990,homeX:1080,homeY:-990,leashRadius:360,cool:0,windup:0,staggerUntil:0,nav:enemyNavigation(),ai:'家园',disabled:false,recovered:false};
  expect(arenaImpact(e,[],0)).toBeUndefined();
  const target={x:1080,y:-710};expect(canChargeThroughStone(e,target)).toBe(true);expect(canChargeThroughStone({...e,elite:undefined},target)).toBe(false);let hit:string|undefined;
  for(let now=16;now<1800&&!hit;now+=16){updateEnemy(e,target,now,16,{queries:2});hit=arenaImpact(e,[],now);}
  expect(hit).toBe('echo-stone-south');expect(e.wallHit).toBeDefined();expect(e.staggerUntil).toBeGreaterThan(e.wallHit!.at);
  expect(arenaImpact({...e,elite:undefined},[],e.wallHit!.at+1)).toBeUndefined();expect(arenaImpact(e,['echo-stone-south'],e.wallHit!.at+1)).toBeUndefined();
  const stone=ARENA_STONES.find(s=>s.id===hit)!;expect(solidPropAt(stone.x,stone.y-20)).toBe(true);syncMapGeometry(false,[],['echo-stone-south']);expect(solidPropAt(stone.x,stone.y-20)).toBe(false);
 });
});
