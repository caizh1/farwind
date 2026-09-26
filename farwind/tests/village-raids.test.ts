import {describe,it,expect} from 'vitest';
import {writeFileSync,mkdirSync} from 'node:fs';
import {GUARD_DEFS,TOWERS,RAID_GATES,RAID_TIMING} from '../src/data/defense';
import {initialState,validate} from '../src/game/systems/state';
import {initialDefense,validateDefense} from '../src/game/systems/defenseState';
import {EastDefense,prepareRaid,spawnLegal} from '../src/game/systems/defense';
import {enemyNavigation,enemyAttackPermitted} from '../src/game/systems/enemy';
import {enemyDefs} from '../src/data/world';
import {motionBlocked,clearMotionLine,shotLineBlocker} from '../src/game/systems/obstacles';
const player={x:670,y:720,hp:100};
const step=(d:EastDefense,ms:number,dt=20)=>{for(let i=0;i<ms;i+=dt)d.update(d.now+dt,dt,player,{queries:2});};
describe('三门常态防御',()=>{
 it('九人三塔、真实场外点和门洞连通，不新增世界尺寸',()=>{
  expect(GUARD_DEFS).toHaveLength(9);expect(TOWERS).toHaveLength(3);
  const errors:any[]=[];
  for(const g of GUARD_DEFS.filter(g=>g.role==='melee')){
   expect(motionBlocked(g.post.x,g.post.y),`${g.id}岗位`).toBe(false);
   if(motionBlocked(g.cover.x,g.cover.y))errors.push({id:g.id,位置:g.cover});
   for(const point of g.patrol)if(motionBlocked(point.x,point.y))errors.push({id:g.id,巡逻点:point});
  }
  expect(errors).toEqual([]);
  for(const g of RAID_GATES){expect(spawnLegal(g.id,g.spawns,player),g.id).toBe(true);expect(clearMotionLine(g.entry,g.inside),g.id).toBe(true);}
 });
 it('保护与间隔只按有效时钟推进，预警未提交不出生',()=>{
  const s=initialDefense(),d=new EastDefense(s,0);s.protectionMs=100;s.cooldownMs=100;
  step(d,100);expect(s.protectionMs).toBe(0);expect(s.cooldownMs).toBe(100);expect(s.raid).toBeNull();
  step(d,100);expect(s.raid?.phase).toBe('warning');expect(d.enemies).toEqual([]);
  step(d,4000);expect(s.raid?.ageMs).toBe(0);expect(d.enemies).toEqual([]);
  d.acknowledged(s.sequence);step(d,RAID_TIMING.warning);expect(d.enemies.length).toBeGreaterThanOrEqual(2);
  expect(s.raid?.phase).not.toBe('warning');
 });
 it('视口、近身、实体和人口上限禁止硬刷，合法点延迟重选',()=>{
  const s=initialDefense();s.protectionMs=s.cooldownMs=0;const d=new EastDefense(s,0);
  const view={left:0,right:4200,top:0,bottom:2200};d.update(20,20,player,{queries:2},view);
  expect(s.raid).toBeNull();expect(s.retryMs).toBe(RAID_TIMING.retry);
  s.retryMs=0;d.update(40,20,player,{queries:2},undefined,Array(12).fill(player));expect(s.raid).toBeNull();
  expect(()=>prepareRaid(s,RAID_GATES[1].spawns[0],'north-gate')).toThrow();
  s.retryMs=0;d.update(60,20,player,{queries:2});expect(s.raid?.phase).toBe('warning');
 });
 it('预警期间玩家靠近生成点则取消并延迟，不补刷',()=>{
  const s=prepareRaid(initialDefense(),player,'north-gate',3,true),d=new EastDefense(s,0);
  d.update(3000,3000,{...RAID_GATES[1].spawns[0],hp:100},{queries:2});
  expect(s.raid).toBeNull();expect(s.completedSequence).toBe(1);expect(s.cooldownMs).toBe(0);expect(s.retryMs).toBe(RAID_TIMING.retry);expect(d.enemies).toEqual([]);
 });
 it('结构3迁移保留伤亡和东门活跃事件，结构4缺岗位拒绝',()=>{
  const old:any=initialState();old.schema_version=3;old.map_version=5;
  old.defense=prepareRaid(initialDefense(),player,'east-gate');old.defense.guards=old.defense.guards.slice(0,3);
  Object.assign(old.defense.guards[0],{hp:0,dead:true,mode:'dead'});old.defense.guards[1].hp=57;
  for(const k of ['protectionMs','cooldownMs','retryMs','seed'])delete old.defense[k];
  delete old.defense.raid.gateId;delete old.defense.raid.spawns;
  const migrated=validate(old);expect(migrated.schema_version).toBe(4);expect(migrated.map_version).toBe(6);
  expect(migrated.defense.guards).toHaveLength(9);expect(migrated.defense.guards[0].dead).toBe(true);expect(migrated.defense.guards[1].hp).toBe(57);
  expect(migrated.defense.raid?.members).toEqual(old.defense.raid.members);expect(validate(migrated)).toEqual(migrated);
  migrated.defense.guards.pop();expect(()=>validate(migrated)).toThrow();
 });
 it('射界只朝对应门外，死者停火，重载不补飞箭',()=>{
  for(const gate of RAID_GATES){const s=prepareRaid(initialDefense(),player,gate.id),d=new EastDefense(s,0);
   const tower=TOWERS.find(t=>t.gateId===gate.id)!,guard=s.guards.find(g=>g.id===tower.occupantGuardId)!;
   expect(d.inFiringArc(guard.id,gate.spawns[0]),gate.id).toBe(true);
   expect(d.inFiringArc(guard.id,{x:tower.muzzle.x-tower.outward.x*200,y:tower.muzzle.y-tower.outward.y*200+30})).toBe(false);
   d.fire(guard,d.enemies[0],`test-${gate.id}`);expect(d.arrows.length,`${gate.id}:${shotLineBlocker(tower.muzzle,{x:gate.spawns[0].x,y:gate.spawns[0].y-30},d.portFor(guard.id))}`).toBe(1);
   expect(new EastDefense(validateDefense(s),0).arrows).toEqual([]);
   d.damageGuard({sourceId:'hostile',targetId:guard.id,attackId:'fatal',amount:1000,sourceType:'enemy-melee',eventId:s.raid!.id},{id:'hostile',hp:100});
   expect(d.arrows).toEqual([]);d.fire(guard,d.enemies[0],'again');expect(d.arrows).toEqual([]);
  }
 });
 it('常驻野怪在真实门内仍可攻击，选择守卫并被拦截，不为叶灵任务自动结算',()=>{
  const s=initialDefense(),d=new EastDefense(s,0);
  const e={id:'slime-1',type:'slime',x:2140,y:1080,hp:48,homeX:2450,homeY:1060,cool:0,windup:0,staggerUntil:0,flashUntil:0,render:()=>{},nav:enemyNavigation(),ai:'家园',disabled:false,recovered:false};
  d.external=[e];expect(enemyAttackPermitted(e,{x:2050,y:1080})).toBe(true);expect(d.manages(e)).toBe(true);
  step(d,12000);expect(()=>structuredClone(d.snapshot())).not.toThrow();expect(e.hp).toBe(0);expect(d.history.some(h=>h.kind==='hit'&&s.guards.some(g=>g.id===h.id))).toBe(true);
  // 正式叶灵的家园半径420与岗位侦察300没有交集，箭塔不会遥杀主线怪。
  for(const leaf of enemyDefs.filter(e=>e.type==='leaf'))for(const g of GUARD_DEFS)
    expect(Math.hypot(leaf.x-g.post.x,leaf.y-g.post.y)-420).toBeGreaterThan(300);
 });
 it('连续30波普通骚扰，玩家离屏不参与，无守卫死亡或主线污染',()=>{
  const s=initialState(),before=structuredClone(s),d=new EastDefense(s.defense,0),records:any[]=[];
  for(let n=0;n<30;n++){
   const gate=RAID_GATES[n%3],next=prepareRaid(s.defense,player,gate.id,2+Math.floor(n/3)%3,true);
   Object.assign(s.defense,next);d.restore(d.now);step(d,RAID_TIMING.warning);
   const start=d.now;while(s.defense.raid&&d.now-start<60000)step(d,100,20);
   expect(s.defense.raid,`第${n+1}波${gate.name}`).toBeNull();expect(s.defense.guards.every(g=>!g.dead),`第${n+1}波`).toBe(true);
   records.push({波次:n+1,出口:gate.name,数量:2+Math.floor(n/3)%3,用时:d.now-start,守卫:s.defense.guards.map(g=>({id:g.id,hp:g.hp}))});
   mkdirSync("docs/village-defense/m4",{recursive:true});writeFileSync("docs/village-defense/m4/wave-progress.json",JSON.stringify({说明:"进行中的固定基准，尚非最终结论。",记录:records},null,2));
   // 按真实有效时间走完随机冷却；这段不启动下一波，末尾保留一个步长。
   step(d,Math.max(0,s.defense.cooldownMs-1000),1000);
  }
  expect([s.quest,s.killed,s.coins,s.bag,s.pendingDrops]).toEqual([before.quest,before.killed,before.coins,before.bag,before.pendingDrops]);
  expect(()=>validate(s)).not.toThrow();mkdirSync('docs/village-defense/m4',{recursive:true});writeFileSync('docs/village-defense/m4/thirty-waves.json',JSON.stringify({说明:'正式运行时系统与碰撞；战斗20毫秒步长，间隔1000毫秒步长，无玩家攻击。每门10波，2/3/4只轮换，不是浏览器长期性能测量。',记录:records},null,2));
 },600000);
});
