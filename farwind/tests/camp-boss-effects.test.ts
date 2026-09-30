import {describe,expect,it} from 'vitest';
import {CampBossEffects} from '../src/game/entities/campBossEffects';
import {CAMP_BOSSES,type CampBossKind} from '../src/data/maps/windbell/campBosses';
import {BossHazards,createBossAttack,bossHazardGeometry} from '../src/game/systems/campBossCombat';
import {initialBossBattle,shiftBossAttack,shiftBossBattle,shiftBossHazard} from '../src/game/systems/campBossState';
import {enemyNavigation,type EnemyBody} from '../src/game/systems/enemy';

function renderer(){
 const streams:any[][]=[];const graphics=()=>{const commands:any[]=[];streams.push(commands);let ink:any,width=1,path:number[]=[];ink=new Proxy({}, {get:(_,key)=> (...args:any[])=>{if(key==='clear'){commands.length=0;path=[];}else{commands.push([key,...args]);if(key==='lineStyle')width=args[0];if(key==='beginPath')path=[];if(key==='moveTo'||key==='lineTo')path.push(width);if(key==='strokePath')commands.push(['path-widths',width,...path]);}return ink;}});return ink;};
 return {view:new CampBossEffects({add:{graphics}} as any),streams};
}
function enemy(kind:CampBossKind):EnemyBody{return {id:'boss-'+kind,type:CAMP_BOSSES[kind].type,boss:kind,bossAttempt:0,bossBattle:initialBossBattle(0),hp:CAMP_BOSSES[kind].hp,x:70,y:110,homeX:70,homeY:110,cool:0,windup:0,staggerUntil:0,nav:enemyNavigation(),ai:'首领',disabled:false,recovered:false,face:{x:1,y:0}};}
const samples=Object.keys(CAMP_BOSSES).flatMap(kind=>[0,1,2,3].map(skill=>[kind,skill] as [CampBossKind,number]));
describe('攻击分镜读取正式技能时钟与危险区',()=>{
 it.each(Object.keys(CAMP_BOSSES) as CampBossKind[])('%s 弹反碎屑与撑地尘读取同一时钟，取消的招式不续画',(kind)=>{
  const e=enemy(kind),r=renderer();e.parried={at:2000,until:2800,direction:{x:1,y:0},perfect:true};e.attack=createBossAttack(e,1000,{x:170,y:110},{...e.bossBattle!,move:0});e.attack.cancelled=true;const before=structuredClone(e);
  const draw=(now:number)=>{r.view.begin();r.view.draw(e,e.attack,now);return structuredClone({效果:r.view.snapshot(),命令:r.streams});};
  const frame=draw(2200);expect(frame.效果.effects.some(v=>v.id==='弹反:2000')).toBe(true);expect(frame.效果.effects.every(v=>v.phase==='消散')).toBe(true);expect(draw(2200)).toEqual(frame);expect(e).toEqual(before);expect(r.streams).toHaveLength(2);
  e.hp=0;expect(draw(2210).效果.effects).toEqual([]);e.hp=100;expect(draw(2800).效果.effects).toEqual([]);
 });
 it.each(samples)('%s 技能%d只在出手后显示攻击效果，渲染不改战斗状态',(kind,move)=>{
  const e=enemy(kind),r=renderer(),hazards=new BossHazards();e.attack=createBossAttack(e,1000,{x:250,y:100},{...e.bossBattle!,move});hazards.launch(e,1000);const before=structuredClone({e,hazards:hazards.hazards});
  const draw=(now:number)=>{r.view.begin();r.view.draw(e,e.attack,now);for(const h of hazards.hazards)r.view.ground(h,now);return r.view.snapshot();};
  expect(draw(e.attack.contactAt-1).effects.every(v=>v.phase==='蓄力')).toBe(true);
  const striking=draw(e.attack.contactAt+50);expect(striking.effects.length).toBeGreaterThan(0);expect(striking.effects.every(v=>v.phase==='出手')).toBe(true);expect(r.streams.flat().length).toBeGreaterThan(10);
  expect(draw(e.attack.recoveryUntil).effects).toEqual([]);expect({e,hazards:hazards.hazards}).toEqual(before);
 });
 it('环形主边沿与正式扩散几何相同，内侧安全区不被填满',()=>{
  const e=enemy('crag-tusk'),r=renderer(),hazards=new BossHazards();e.attack=createBossAttack(e,1000,{x:250,y:110},{...e.bossBattle!,move:3});hazards.launch(e,1000);const h=hazards.hazards[0];
  for(const t of [0,200,800,1600]){const now=h.activeAt+t;r.view.begin();r.view.ground(h,now);const record=r.view.snapshot().effects[0],g=bossHazardGeometry(h,now);expect(record).toMatchObject({radius:g.radius,inner:g.inner});expect(r.streams[0].some(([name])=>name==='fillCircle')).toBe(false);expect(record.radius).toBeLessThanOrEqual(250);}
 });
 it('喷口快照只保留坐标，实际敌人的精灵和回调不能进入诊断或存档',()=>{
  const e=Object.assign(enemy('spore-heart'),{sprite:{scene:{update(){}}}}),r=renderer();const a=createBossAttack(e,1000,{x:250,y:110},{...e.bossBattle!,move:0});r.view.draw(e,a,a.contactAt+50);expect(structuredClone(r.view.snapshot()).effects[0].point).toEqual({x:70,y:110});
 });
 it('建路径前设置线宽，刃痕细描边不能继承柔光宽度',()=>{
  for(const kind of Object.keys(CAMP_BOSSES) as CampBossKind[]){const e=enemy(kind),r=renderer(),a=createBossAttack(e,1000,{x:180,y:110},{...e.bossBattle!,move:kind==='spore-heart'?2:kind==='crag-tusk'?1:0});r.view.draw(e,a,a.contactAt+70);const paths=r.streams.flat().filter(v=>v[0]==='path-widths');expect(paths.length).toBeGreaterThan(0);for(const [,declared,...vertices] of paths)expect(vertices.every((width:number)=>width===declared)).toBe(true);}
 });
 it('甩尾读取背后几何，锁向和偏移不由素材镜像重新计算',()=>{
  const e=enemy('thorn-crown'),r=renderer();const a=createBossAttack(e,1000,{x:100,y:110},{...e.bossBattle!,move:2});e.face={x:-1,y:0};r.view.draw(e,a,a.contactAt+50);expect(r.view.snapshot().effects[0].direction!.x).toBeCloseTo(-1);expect(a.direction).toEqual({x:1,y:0});
 });
 it('三处根枝共用已锁定的位置，而不追踪离开的玩家',()=>{
  const e=enemy('bound-branch'),r=renderer(),hazards=new BossHazards();e.attack=createBossAttack(e,1000,{x:250,y:110},{...e.bossBattle!,move:2});hazards.launch(e,1000);for(const h of hazards.hazards)r.view.ground(h,h.activeAt+160);
  expect(r.view.snapshot().effects.map(v=>v.point)).toEqual(hazards.hazards.map(h=>h.point));expect(new Set(r.view.snapshot().effects.map(v=>v.id)).size).toBe(3);
 });
 it('暂停重复采样完全相同，保存相对时钟后恢复同一攻击帧',()=>{
  const e=enemy('spore-heart'),r=renderer(),hazards=new BossHazards();e.attack=createBossAttack(e,1000,{x:250,y:110},{...e.bossBattle!,move:1});hazards.launch(e,1000);const now=e.attack.contactAt+120;
  const draw=()=>{r.view.begin();r.view.draw(e,e.attack,now);for(const h of hazards.hazards)r.view.ground(h,now);return structuredClone({records:r.view.snapshot(),commands:r.streams});};
  const frame=draw();expect(draw()).toEqual(frame);
  const reloadAt=300000,restored={...e,bossBattle:shiftBossBattle(shiftBossBattle(e.bossBattle!,-now),reloadAt)},attack=shiftBossAttack(shiftBossAttack(e.attack,-now),reloadAt);r.view.begin();r.view.draw(restored,attack,reloadAt);for(const h of hazards.hazards)r.view.ground(shiftBossHazard(shiftBossHazard(h,-now),reloadAt),reloadAt);
  expect({records:r.view.snapshot(),commands:r.streams}).toEqual(frame);
 });
 it('取消、死亡和重新开始不续播旧攻击，不产生新的图形对象',()=>{
  const e=enemy('thorn-crown'),r=renderer(),a=createBossAttack(e,1000,{x:170,y:110},{...e.bossBattle!,move:1});for(let i=0;i<200;i++){r.view.begin();r.view.draw(e,a,a.contactAt+i%100);}expect(r.streams).toHaveLength(2);
  a.cancelled=true;r.view.begin();r.view.draw(e,a,a.contactAt+50);expect(r.view.snapshot().effects).toEqual([]);
  a.cancelled=false;e.hp=0;r.view.draw(e,a,a.contactAt+60);expect(r.view.snapshot().effects).toEqual([]);
  r.view.begin();expect(r.streams.every(s=>s.length===0)).toBe(true);
 });
 it('护心结茧只有护壳，破防时显示露核，不增加伤害或地面危险区',()=>{
  const e=enemy('bound-branch'),r=renderer(),hazards=new BossHazards();e.attack=createBossAttack(e,1000,{x:170,y:110},{...e.bossBattle!,move:3});hazards.launch(e,1000);r.view.draw(e,e.attack,e.attack.contactAt+100);expect(r.view.snapshot().effects.map(v=>v.kind)).toEqual(['护心枝壳']);expect(hazards.hazards).toEqual([]);
  e.attack.cancelled=true;e.bossBattle!.exposedUntil=e.attack.contactAt+1500;r.view.begin();r.view.draw(e,e.attack,e.attack.contactAt+200);expect(r.view.snapshot().effects.map(v=>v.kind)).toEqual(['风核暴露']);
 });
});
