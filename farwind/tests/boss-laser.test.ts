import {describe,it,expect,vi} from 'vitest';
import {CAMP_BOSSES} from '../src/data/maps/windbell/campBosses';
import {BossHazards,createBossAttack,updateCampBoss,selectBossMove,captureBossCombat,restoreBossCombat} from '../src/game/systems/campBossCombat';
import {initialBossBattle,validateCampBoss} from '../src/game/systems/campBossState';
import {BOSS_LASER,LASER_ETCH,LASER_ECHO,LASER_DURATION,laserSample,laserGeometries,clipLaserRays} from '../src/game/systems/bossLaser';
import {geometryTouches,advanceEnemyAttack,delayEnemyAttack} from '../src/game/systems/enemyAttack';
import {enemyNavigation,type EnemyBody} from '../src/game/systems/enemy';
import {EnemyProjectiles} from '../src/game/systems/enemyProjectiles';
import {hazardWarningAt} from '../src/game/entities/attackWarningView';
import {sampleBossFlex} from '../src/game/systems/bossFlex';

let clear=true;
vi.mock('../src/game/systems/obstacles',async original=>({...await original<object>(),motionBlocked:()=>false,clearMotionLine:()=>true,clearMeleeLine:()=>clear}));
function setup(){
 const e={id:'boss-bound-branch',type:'leaf',boss:'bound-branch',bossAttempt:0,bossBattle:{...initialBossBattle(0),move:6,nextAt:0},hp:2500,x:3700,y:1100,homeX:3700,homeY:1100,leashRadius:1000,staggerUntil:0,nav:enemyNavigation(),face:{x:1,y:0}} as EnemyBody;
 e.attack=createBossAttack(e,0,{x:e.x+200,y:e.y},e.bossBattle!);e.attack.locked=true;
 const hazards=new BossHazards();hazards.launch(e,0);clear=true;return {e,a:e.attack,hazards,h:hazards.hazards[0]};
}
const at=(e:EnemyBody,r:number,angle=0,id='player')=>({id,x:e.x+Math.cos(angle)*r,y:e.y+Math.sin(angle)*r,previous:{x:e.x+Math.cos(angle)*r,y:e.y+Math.sin(angle)*r}});
describe('东门赤环灭光正式连招',()=>{
 it('锁向后射线在障碍前截断且不重复扫描；保存副本与运行状态不共享缓存',()=>{
  const {e,a,h,hazards}=setup(),wall=vi.fn((_a:unknown,b:{x:number;y:number})=>b.x<=e.x+100);clipLaserRays(h,wall);const rays=laserGeometries(h,a.contactAt);
  expect(rays[0].b.x).toBeLessThanOrEqual(e.x+100);expect(rays[0].b.x).toBeGreaterThan(e.x+99);const calls=wall.mock.calls.length;clipLaserRays(h,wall);expect(wall.mock.calls).toHaveLength(calls);
  const saved=captureBossCombat(e,1000,hazards,new EnemyProjectiles());h.laser!.reaches![0]=50;h.laser!.angle=.5;expect(saved.hazards[0].laser!.reaches![0]).toBeGreaterThan(99);expect(saved.hazards[0].laser!.angle).toBe(0);
 });
 it('自然技能选择可以进入第七招，旧六槽冷却升级后仍可用',()=>{
  const {e}=setup();Object.assign(e.bossBattle!,{move:-1,next:2,major:false,lastSkill:1,cooldowns:Array(6).fill(0)});
  expect(selectBossMove(e,{x:e.x+250,y:e.y},2000)).toBe(6);
  e.attack=null;updateCampBoss(e,{x:e.x+250,y:e.y},2000,20,'player',true);expect(e.attack?.bossLaser).toBe(true);expect(e.bossBattle!.cooldowns).toHaveLength(7);
 });
 it('三段时序互不重叠，二段保留五百毫秒延迟',()=>{
  const {h}=setup();const start=h.activeAt;
  for(const [offset,stage] of [[-1,'charge'],[0,'rays'],[600,'pause'],[LASER_ETCH,'etch'],[LASER_ETCH+1450,'delay'],[LASER_ECHO,'echo'],[LASER_DURATION,'recover']] as const)expect(laserSample(h,start+offset).stage).toBe(stage);
  expect(laserGeometries(h,start+600)).toEqual([]);expect(laserGeometries(h,start+LASER_ECHO-1)).toEqual([]);
 });
 it('八向射线有真实空隙与安全内圈，不发射孢子或额外近战伤害',()=>{
  const {e,a,h}=setup();const rays=laserGeometries(h,a.contactAt);expect(rays).toHaveLength(8);
  expect(rays.some(g=>geometryTouches(g,at(e,200)))).toBe(true);expect(rays.some(g=>geometryTouches(g,at(e,200,Math.PI/8)))).toBe(false);expect(rays.some(g=>geometryTouches(g,e))).toBe(false);
  expect(advanceEnemyAttack(a,e,at(e,200),a.activeUntil)).toBeNull();const shots=new EnemyProjectiles();shots.launch(a,e,a.contactAt);expect(shots.shots).toHaveLength(0);
 });
 it('圆激光固定半径顺时针扫过，二段走同一轨迹；圈内不受圆盘伤害',()=>{
  const {e,a,h}=setup();for(const offset of [LASER_ETCH,LASER_ECHO]){
   const duration=offset===LASER_ETCH?BOSS_LASER.etch:BOSS_LASER.echo,t=a.contactAt+offset+duration/4,g=laserGeometries(h,t)[0];
   expect(geometryTouches(g,at(e,230,Math.PI/2-.05))).toBe(true);expect(geometryTouches(g,at(e,230,Math.PI))).toBe(false);expect(geometryTouches(g,at(e,60,Math.PI/2))).toBe(false);
  }
 });
 it('每段对每个目标各命中一次，重复采样不重放，伙伴独立结算',()=>{
  const {e,a,hazards}=setup(),target=at(e,230,-.05),peer=at(e,230,-.05,'xiaobao'),events=[];
  for(let t=a.contactAt;t<=a.activeUntil;t+=10)events.push(...hazards.update(t-10,t,[e],[target,peer]));
  expect(events.filter(e=>e.targetId==='player').map(e=>e.attack.bossPart)).toEqual([1,2]);expect(events.filter(e=>e.targetId==='xiaobao')).toHaveLength(2);
  expect(new Set(events.map(e=>e.attack.attackId)).size).toBe(4);expect(events.map(e=>e.attack.damage)).toEqual([22,22,30,30]);
 });
 it('一次跨越换段的更新不会吞掉圆扫和二段接触',()=>{
  const {e,a,hazards}=setup(),p=at(e,230,Math.PI/2-.05),events=hazards.update(a.contactAt+600,a.activeUntil-1,[e],[p]);
  expect(events.map(e=>e.attack.bossPart)).toEqual([1,2]);
 });
 it('快速横穿射线按前后位置插值检测，端点均安全仍能命中',()=>{
  const {e,a,hazards}=setup(),p={id:'player',x:e.x+200,y:e.y+25,previous:{x:e.x+200,y:e.y-25}};
  expect(hazards.update(a.contactAt+20,a.contactAt+70,[e],[p])).toHaveLength(1);
  expect(hazards.update(a.contactAt+70,a.contactAt+90,[e],[p])).toHaveLength(0);
 });
 it('地形遮挡阻止伤害，取消、死亡、战斗轮次变化清理全连招',()=>{
  for(const condition of ['cancel','dead','attempt','blocked']){
   const {e,a,hazards}=setup();if(condition==='cancel')a.cancelled=true;if(condition==='dead')e.hp=0;if(condition==='attempt')e.bossAttempt=1;if(condition==='blocked')clear=false;
   expect(hazards.update(a.contactAt-1,a.contactAt+10,[e],[at(e,200)])).toHaveLength(0);if(condition!=='blocked')expect(hazards.hazards).toHaveLength(0);
  }clear=true;
 });
 it('失衡延迟整套连招，暂停重复更新稳定',()=>{
  const {e,a,h,hazards}=setup();delayEnemyAttack(a,400);hazards.update(0,400,[e],[]);expect(h.activeAt).toBe(1600);expect(laserSample(h,1200).stage).toBe('charge');
  const before=structuredClone(h);hazards.update(400,400,[e],[]);expect(h).toEqual(before);
 });
 it('三段中途保存恢复保留剩余时钟和已命中集合，旧六招存档兼容',()=>{
  for(const offset of [200,LASER_ETCH+700,LASER_ECHO+700]){
   const {e,a,hazards}=setup(),now=a.contactAt+offset;hazards.update(a.contactAt-1,now,[e],[at(e,200)]);
   const shots=new EnemyProjectiles(),saved=captureBossCombat(e,now,hazards,shots),state=validateCampBoss({stage:'battle',warning:0,attempt:0,away:0,combat:saved},e.id),copy=setup().e,restored=new BossHazards();
   restoreBossCombat(copy,state.combat,50000,restored,shots);expect(captureBossCombat(copy,50000,restored,shots)).toEqual(saved);
   expect(laserSample(restored.hazards[0],50000)).toEqual(laserSample(hazards.hazards[0],now));
  }
  const {e}=setup();e.bossBattle!.move=1;e.attack=createBossAttack(e,0,at(e,200),e.bossBattle!);const saved=captureBossCombat(e,120,new BossHazards(),new EnemyProjectiles());expect(()=>validateCampBoss({stage:'battle',warning:0,attempt:0,away:0,combat:saved},e.id)).not.toThrow();
 });
 it('无效道数、其他首领第七招和异常重复命中存档会被拒绝',()=>{
  const {e,hazards}=setup(),saved=captureBossCombat(e,120,hazards,new EnemyProjectiles());for(const n of [0,100,NaN]){const bad=structuredClone(saved);bad.hazards[0].laser!.count=n;expect(()=>validateCampBoss({stage:'battle',warning:0,attempt:0,away:0,combat:bad},e.id)).toThrow();}
  for(const geometry of [undefined,{...saved.attack!.bossGeometry!,kind:'circle'}]){const bad=structuredClone(saved);bad.attack!.bossGeometry=geometry as any;expect(()=>validateCampBoss({stage:'battle',warning:0,attempt:0,away:0,combat:bad},e.id)).toThrow();}
  const bad=structuredClone(saved);bad.hazards[0].used=['rays:player','rays:player'];expect(()=>validateCampBoss({stage:'battle',warning:0,attempt:0,away:0,combat:bad},e.id)).toThrow();
 });
 it('已命中射线不报警，未命中二段依然给出真实未来预警',()=>{
  const {e,a,h}=setup(),p=at(e,230,Math.PI/2-.05);h.used.push('rays:player');expect(hazardWarningAt(h,at(e,200),a.contactAt+20)).toBeNull();
  expect(hazardWarningAt(h,p,a.contactAt+LASER_ECHO)).not.toBeNull();expect(hazardWarningAt(h,e,a.contactAt+LASER_ECHO)).toBeNull();
 });
 it('双臂上举保持到扫圆完成，二段连续收势且不修改攻击状态',()=>{
  const {a}=setup(),before=structuredClone(a);expect(sampleBossFlex(a,0,0)).toEqual({shoulder:0,elbow:0});expect(sampleBossFlex(a,a.contactAt,0).shoulder).toBeGreaterThan(.5);expect(sampleBossFlex(a,a.contactAt,1).shoulder).toBeLessThan(-.5);
  expect(sampleBossFlex(a,a.contactAt+LASER_ECHO,0)).toEqual(sampleBossFlex(a,a.contactAt,0));expect(sampleBossFlex(a,a.recoveryUntil,0)).toEqual({shoulder:0,elbow:0});expect(a).toEqual(before);
  let previous=sampleBossFlex(a,0,0);for(let t=1;t<=a.recoveryUntil;t++){const p=sampleBossFlex(a,t,0);expect(Math.abs(p.elbow-previous.elbow)).toBeLessThan(.01);previous=p;}
 });
});
