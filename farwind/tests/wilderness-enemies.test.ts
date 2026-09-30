import {describe,it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {ENEMIES} from '../src/data/enemies';
import {ENCOUNTERS} from '../src/data/maps/windbell/encounters';
import {enemyNavigation,updateEnemy,type EnemyBody} from '../src/game/systems/enemy';
import {createEnemyAttack,advanceEnemyAttack,ENEMY_ATTACK} from '../src/game/systems/enemyAttack';
import {enemyProtection,turnToward,wolfFlank} from '../src/game/systems/enemyTraits';
import {EnemyAnimation} from '../src/game/systems/enemyAnimation';
import {resolveDamage} from '../src/game/systems/damage';
import {initialState,validate} from '../src/game/systems/state';
import {synthCreature} from '../src/game/systems/creatureAudio';
import {settleEncounterDeath} from '../src/game/systems/encounterState';
const open={blocked:()=>false,clear:()=>true,melee:()=>true};
const body=(type:string):EnemyBody=>({id:`wild-${type}`,type,hp:84,x:1130,y:-400,homeX:1130,homeY:-400,face:{x:0,y:1},cool:0,windup:0,staggerUntil:0,nav:enemyNavigation(),ai:'家园',disabled:false,recovered:false});
describe('新增荒野敌人真实差异',()=>{
 it('潜地虫在原地预警、提前锁向，正常横移可避开且不会穿墙扑击',()=>{
  const e={x:0,y:0},p={x:100,y:0},a=createEnemyAttack('worm',1,'burrow',0,e,p);
  expect(a.contactAt-a.startedAt).toBeGreaterThanOrEqual(1000);expect(a.contactAt-a.lockAt).toBeGreaterThanOrEqual(600);
  expect(advanceEnemyAttack(a,e,p,a.lockAt,open)).toBeNull();expect(e).toEqual({x:0,y:0});
  const original={...a.direction};const away={x:100,y:140};expect(advanceEnemyAttack(a,e,away,a.activeUntil,open)).toBeNull();expect(a.direction).toEqual(original);
  const blocked={x:0,y:0},b=createEnemyAttack('worm',2,'burrow',0,blocked,p);advanceEnemyAttack(b,blocked,p,b.activeUntil,{blocked:x=>x>40,clear:(_a,b)=>b.x<=40,melee:()=>false});expect(blocked.x).toBeLessThanOrEqual(40);
 });
 it('潜地虫不主动追逐范围外目标，狼群两侧选点不会改写其他单位仇恨',()=>{
  const e=body('burrow');updateEnemy(e,{x:1350,y:-400},20,20,{queries:3});expect(e.x).toBe(1130);expect(e.attack).toBeUndefined();
  const left=wolfFlank({id:'wolf-a',x:0,y:0},{x:200,y:0}),right=wolfFlank({id:'wolf-b',x:0,y:0},{x:200,y:0});expect(left.y).toBe(-right.y);expect(Math.abs(left.y)).toBe(100);
  const far=body('wolf');updateEnemy(far,{x:-500,y:1000},40,20,{queries:3});expect(far.attack).toBeUndefined();expect(far.nav.mode).not.toBe('chase');
 });
 it('守卫缓慢转身，背后攻击保持正常伤害，正面轻击减伤，重击破防窗口明确',()=>{
  const e=body('guardian'),turn=turnToward({x:0,y:1},{x:0,y:-1},.1);expect(Math.acos(turn.y)).toBeCloseTo(.12);
  const event={sourceId:'player',targetId:e.id,attackId:'hit:1',amount:20,sourceType:'player-melee' as const,eventId:null},source={id:'player',faction:'village' as const,hp:100,armor:0};
  const hit=(point:{x:number;y:number},now:number,breaks=false)=>resolveDamage(event,source,{id:e.id,faction:'hostile',hp:e.hp,armor:0,...enemyProtection(e,point,now,breaks)});
  expect(hit({x:1130,y:-350},10).damage).toBe(7);expect(hit({x:1130,y:-450},10).damage).toBe(20);
  expect(hit({x:1130,y:-350},20,true).damage).toBe(20);expect(e.guardOpenUntil).toBe(1220);expect(hit({x:1130,y:-350},1219).damage).toBe(20);expect(hit({x:1130,y:-350},1221).damage).toBe(7);
  e.attack=createEnemyAttack(e.id,1,'guardian',1500,e,{x:1130,y:-350});expect(hit({x:1130,y:-350},e.attack.activeUntil+1).damage).toBe(20);
 });
 it('守卫攻击朝向与石甲朝向一致，蓄力开始后不能瞬间转向背后玩家',()=>{
  const e=body('guardian');updateEnemy(e,{x:1130,y:-350},20,20,{queries:3});expect(e.attack?.locked).toBe(true);expect(e.attack?.direction).toEqual(e.face);
  const dir={...e.attack!.direction};updateEnemy(e,{x:1130,y:-450},200,180,{queries:3});expect(e.attack!.direction).toEqual(dir);
 });
 it('三个方向、左右镜像与全部动作只读取各自24帧块，不读入其他方向',()=>{
  for(const type of ['wolf','burrow','guardian'] as const)for(const d of [{x:0,y:1},{x:0,y:-1},{x:1,y:0},{x:-1,y:0}]){
   const e={x:0,y:0,hp:ENEMIES[type].hp,type},a=createEnemyAttack('pose',1,type,0,e,d),anim=new EnemyAnimation(),block=(d.y>0?0:d.y<0?1:2)*24;
   for(let now=0;now<a.recoveryUntil;now+=5){const p=anim.sample(e,a,now);expect(p.frame).toBeGreaterThanOrEqual(block+8);expect(p.frame).toBeLessThan(block+16);}
   for(const perfect of [true,false])for(let now=0;now<800;now+=10){const p=anim.sample({...e,parried:{at:0,until:800,direction:d,perfect}},null,now);expect(p.frame).toBeGreaterThanOrEqual(block+16);expect(p.frame).toBeLessThan(block+20);}
  }
 });
 it('M3开发存档补槽位且幂等，原有清剿、伤势、奖励和伤亡保留',()=>{
  const s:any=initialState();s.schema_version=11;for(const id of Object.keys(s.encounters.groups))if(!['south-reed-patrol','south-herb-patrol','south-spore-camp'].includes(id))delete s.encounters.groups[id];
  s.encounters.groups['south-reed-patrol'].activated=true;settleEncounterDeath(s.encounters,'wild-reed-slime',false);s.coins=144;s.defense.guards[0].hp=0;s.defense.guards[0].dead=true;s.defense.guards[0].mode='dead';for(const g of Object.values(s.encounters.groups) as any[])for(const u of g.members){delete u.face;delete u.guardOpen;}
  const v=validate(s);expect(v.schema_version).toBe(14);expect(Object.keys(v.encounters.groups)).toHaveLength(ENCOUNTERS.length);expect(v.encounters.groups['south-reed-patrol'].cleared).toBe(true);expect(v.coins).toBe(144);expect(v.defense.guards[0].dead).toBe(true);expect(validate(v)).toEqual(v);
 });
 for(const type of ['wolf','burrow','guardian'])it(`${type}声音有限长度、无直流偏置和超幅，不能以合成检查代替设备听感`,()=>{
  for(const phase of ['charge','strike','hurt','death'] as const){const s=synthCreature(type,phase,48000);expect(s.length).toBeLessThan(25000);expect(Math.max(...s.map(Math.abs))).toBeLessThan(1);expect(Math.abs(s.reduce((a,b)=>a+b,0)/s.length)).toBeLessThan(.05);expect(s.some(x=>Math.abs(x)>.01)).toBe(true);}
 });
 it('216个生成姿态可追溯且独立，三张运行图集有真实透明通道',async()=>{
  const manifest=JSON.parse(await readFile('docs/first-map/enemies/manifest.json','utf8'));expect(manifest.帧).toHaveLength(216);expect(new Set(manifest.帧.map((r:any)=>r.摘要)).size).toBe(216);
  for(const name of ['thorn-wolf','burrow-worm','moss-guardian']){const m=await sharp(`public/assets/enemies-v1/${name}.png`).metadata();expect([m.width,m.height,m.hasAlpha]).toEqual([1920,960,true]);}
 });
});
