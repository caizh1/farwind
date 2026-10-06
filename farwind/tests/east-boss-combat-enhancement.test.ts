import {describe,it,expect,vi} from 'vitest';
import {initialBossBattle,shiftBossHazard,validateCampBoss} from '../src/game/systems/campBossState';
import {createBossAttack,BossHazards,captureBossCombat,restoreBossCombat} from '../src/game/systems/campBossCombat';
import {BOSS_LASER,LASER_ETCH,LASER_ECHO,LASER_DURATION,laserGeometries,laserRays,laserSample,clipLaserRays} from '../src/game/systems/bossLaser';
import {geometryTouches,sampleEnemyAttack,type EnemyAttack} from '../src/game/systems/enemyAttack';
import {enemyNavigation,companionControl,type EnemyBody} from '../src/game/systems/enemy';
import {EnemyProjectiles} from '../src/game/systems/enemyProjectiles';
import {enemyProtection} from '../src/game/systems/enemyTraits';
import {reactToEnemyHit} from '../src/game/systems/enemyReaction';
import {STRIKES,sweepMove} from '../src/game/systems/combat';
import {BlackHoleSlash,BLACK_HOLE,type DimensionalRift,type BlackHoleTarget,type BlackHolePort} from '../src/game/systems/blackHoleSlash';
import {SlimeAnimation} from '../src/game/systems/slimeAnimation';
import {EastBossAnimation} from '../src/game/systems/eastBossAnimation';
import {hazardWarningAt} from '../src/game/entities/attackWarningView';

vi.mock('../src/game/systems/obstacles',async original=>({...await original<object>(),motionBlocked:()=>false,clearMotionLine:()=>true,clearMeleeLine:()=>true}));
const point=(x:number,y:number,id='player')=>({x,y,id,previous:{x,y}});
function setup(phase:1|2=1,move=6){
 const e={id:'boss-bound-branch',kind:'enemy',type:'leaf',boss:'bound-branch',bossAttempt:0,bossBattle:{...initialBossBattle(0),move,phase},hp:2500,x:3710,y:1100,homeX:3710,homeY:1100,leashRadius:340,staggerUntil:0,nav:enemyNavigation(),face:{x:1,y:0}} as EnemyBody;
 e.attack=createBossAttack(e,0,{x:e.x+200,y:e.y},e.bossBattle!);e.attack.locked=true;
 const hazards=new BossHazards();hazards.launch(e,0);return {e,a:e.attack,hazards,h:hazards.hazards[0]};
}
function pull(){const system=new BlackHoleSlash(),target={id:'东侧首领',kind:'enemy',boss:'bound-branch',hp:2500,x:100,y:0,bossBattle:{entryUntil:0,transformUntil:0}} as BlackHoleTarget;
 system.rifts=[{id:1,x:0,y:0,born:0,radius:180,pullRadius:180,hold:1440,A:0} as DimensionalRift];const port:BlackHolePort={clear:()=>true,move:(t,dx,dy)=>{t.x+=dx;t.y+=dy;},damage:()=>0};return {system,target,port};}

describe('东侧首领增强正式战斗链路',()=>{
 for(const phase of [1,2] as const)it(`阶段 ${phase} 扇形扩大但连招时序与步进不变`,()=>{
  const {e,a}=setup(phase,0);expect(a.bossGeometry!.radius).toBe(190);expect(a.bossGeometry!.halfAngle).toBeCloseTo(Math.PI/3);expect(a.contactAt).toBe(phase===1?750:700);expect(a.step).toBe(24);
  e.bossBattle!.part=1;const second=createBossAttack(e,a.recoveryUntil,e,e.bossBattle!);expect(second.contactAt-a.contactAt).toBe(phase===1?680:610);expect(second.step).toBe(18);
 });
 it('正式扇形的半径与角度边界一致，外沿与侧面没有隐形伤害',()=>{const {e,a}=setup(1,0),g=sampleEnemyAttack(a,a.contactAt,e).geometry,angle=Math.atan2(g.direction!.y,g.direction!.x);const p=(r:number,offset:number)=>({x:e.x+Math.cos(angle+offset)*r,y:e.y+Math.sin(angle+offset)*r});expect(geometryTouches(g,p(190,Math.PI/3))).toBe(true);expect(geometryTouches(g,p(190.01,0))).toBe(false);expect(geometryTouches(g,p(180,Math.PI/3+.001))).toBe(false);});
 it('八束增粗，连续旋转五秒，保留内圈与束间空隙',()=>{
  const {e,a,h}=setup(),start=laserRays(h,a.contactAt)[0],turned=laserRays(h,a.contactAt+1000)[0];expect(start.radius).toBe(14);expect(Math.atan2(turned.b.y-e.y,turned.b.x-e.x)).toBeCloseTo(Math.PI/5);
  expect(laserSample(h,a.contactAt+4999).stage).toBe('rays');expect(laserSample(h,a.contactAt+5000).stage).toBe('pause');
  expect(laserRays(h,a.contactAt).some(g=>geometryTouches(g,e))).toBe(false);expect(laserRays(h,a.contactAt).some(g=>geometryTouches(g,{x:e.x+200*Math.cos(Math.PI/8),y:e.y+200*Math.sin(Math.PI/8)}))).toBe(false);
 });
 it('旋转与原点变化重新裁切，禁止复用初始障碍长度',()=>{
  const {e,a,h}=setup(),wall=vi.fn((_a:unknown,b:{x:number;y:number})=>b.x<=e.x+100);clipLaserRays(h,wall,a.contactAt);const old=h.laser!.reaches![0],calls=wall.mock.calls.length;clipLaserRays(h,wall,a.contactAt);expect(wall.mock.calls.length).toBe(calls);
  clipLaserRays(h,wall,a.contactAt+1000);expect(h.laser!.reaches![0]).toBeGreaterThan(old);h.point.x-=20;clipLaserRays(h,wall,a.contactAt+1000);expect(wall.mock.calls.length).toBeGreaterThan(calls);
 });
 it('同目标八束共享一秒冷却，伙伴独立，暂停不重复伤害',()=>{
  const {e,a,h,hazards}=setup(),targets=[point(e.x+80,e.y),point(e.x+80,e.y,'xiaobao')],events=[];
  for(let t=a.contactAt;t<a.contactAt+5000;t+=5)events.push(...hazards.update(t-5,t,[e],targets));
  const hits=events.filter(c=>c.targetId==='player');expect(hits.length).toBeGreaterThan(1);expect(hits.length).toBeLessThanOrEqual(5);for(let i=1;i<hits.length;i++)expect(hits[i].at-hits[i-1].at).toBeGreaterThanOrEqual(1000);
  expect(events.filter(c=>c.targetId==='xiaobao').length).toBe(hits.length);expect(new Set(events.map(c=>c.attack.attackId)).size).toBe(events.length);expect(hazards.update(a.contactAt+4995,a.contactAt+4995,[e],targets)).toEqual([]);expect(h.laser!.rayHits!.player).toBeDefined();
 });
 it('三圈都使用真实环带，圈内和圈间空隙无伤害',()=>{
  const {e,a,h}=setup();for(const start of [LASER_ETCH,LASER_ECHO]){const geometries=laserGeometries(h,a.contactAt+start+362.5);expect(geometries).toHaveLength(3);
   for(const radius of [140,250,360])expect(geometries.some(g=>geometryTouches(g,{x:e.x,y:e.y+radius}))).toBe(true);
   for(const radius of [0,70,195,305,410])expect(geometries.some(g=>geometryTouches(g,{x:e.x,y:e.y+radius}))).toBe(false);
  }
 });
 it('三个圈每目标各命中一次刻线与追爆，重复跨帧扫描不重放',()=>{
  const {e,a,hazards}=setup();
  // 每次用新战斗单独验收一条圈，目标标识保持正式支持范围。
  for(const r of [140,250,360]){const s=setup(),p=point(e.x,e.y+r),events=s.hazards.update(a.contactAt+LASER_ETCH,a.activeUntil-1,[s.e],[p]);expect(events.map(c=>c.attack.bossPart)).toEqual([1,2]);expect(s.hazards.update(a.activeUntil-1,a.activeUntil-1,[s.e],[p])).toEqual([]);}
  expect(hazards.hazards).toHaveLength(1);
 });
 it('光柱跟随实际牵引轨迹，三环开始时锁定落地圆心',()=>{
  const {e,a,h,hazards}=setup();e.combatPrevious={x:e.x,y:e.y};e.x+=30;hazards.update(a.contactAt,a.contactAt+100,[e],[]);expect(h.point.x).toBe(e.x);
  const etch=a.contactAt+LASER_ETCH;e.combatPrevious={x:e.x,y:e.y};e.x+=10;hazards.update(etch-5,etch,[e],[]);const center={...h.point};expect(h.laser!.centerLocked).toBe(true);e.x+=50;hazards.update(etch,etch+100,[e],[]);expect(h.point).toEqual(center);expect(a.bossGeometry!.point).toEqual(center);
 });
 it('破茧与伤害不会取消招式、硬直或改写时钟',()=>{
  const {e,a}=setup(1,3),times=[a.startedAt,a.contactAt,a.activeUntil,a.recoveryUntil];const back={x:e.x-100,y:e.y};expect(enemyProtection(e,back,a.contactAt+1).reduction).toBe(0);expect(reactToEnemyHit(e,a.contactAt+1,STRIKES[3],{x:1,y:0},false,true).interrupted).toBe(false);expect(a.cancelled).toBe(false);expect(e.staggerUntil).toBe(0);expect([a.startedAt,a.contactAt,a.activeUntil,a.recoveryUntil]).toEqual(times);
 });
 it('伤害附带的同伴控制不会暂停正在释放的招式',()=>{const {e,a}=setup();companionControl(e,a.contactAt,400);expect(e.staggerUntil).toBe(0);expect(e.bossBattle!.controlImmuneUntil).toBe(0);});
 it('正在施法时受击表现保留原片段',()=>{
  const {e,a}=setup();const base={action:'hurt',elapsed:40,facing:0,index:0,frame:0,phase:'hurt',provisional:true} as const;expect(new EastBossAnimation().sample(e,a,1400,base,0).clip).toBe('laser-hold');
 });
 it('新版保存恢复三环、冷却和固定圆心，副本不共享数组',()=>{
  const {e,a,h,hazards}=setup(),now=a.contactAt+100;hazards.update(a.contactAt-1,now,[e],[point(e.x+80,e.y)]);const shots=new EnemyProjectiles(),saved=captureBossCombat(e,now,hazards,shots);validateCampBoss({stage:'battle',warning:0,attempt:0,away:0,combat:saved},e.id);
  const copy=setup().e,restored=new BossHazards();restoreBossCombat(copy,saved,50000,restored,shots);expect(captureBossCombat(copy,50000,restored,shots)).toEqual(saved);expect(hazardWarningAt(restored.hazards[0],point(e.x+80,e.y),50000)).toBeNull();
  h.laser!.radii![0]=1;h.laser!.rayHits!.player=1;expect(saved.hazards[0].laser!.radii).toEqual([140,250,360]);expect(saved.hazards[0].laser!.rayHits!.player).toBeLessThanOrEqual(0);
 });
 it('无版本旧存档保持六百毫秒射线和单个二百三十圆环',()=>{
  const {e,a,h,hazards}=setup();delete a.bossLaserVersion;a.bossGeometry!.radius=230;a.activeUntil=a.contactAt+4250;a.recoveryUntil=a.activeUntil+900;h.radius=230;h.expires=a.activeUntil;h.laser={count:8,angle:0};
  expect(laserSample(h,a.contactAt+600).stage).toBe('pause');expect(laserGeometries(h,a.contactAt+850+362.5)).toHaveLength(1);const saved=captureBossCombat(e,100,hazards,new EnemyProjectiles());expect(()=>validateCampBoss({stage:'battle',warning:0,attempt:0,away:0,combat:saved},e.id)).not.toThrow();
 });
 it('拒绝恶意半径、未知冷却目标、未来命中时间及版本冲突',()=>{
  const {e,hazards}=setup(),saved=captureBossCombat(e,100,hazards,new EnemyProjectiles());for(const change of [(s:typeof saved)=>s.hazards[0].laser!.radii![2]=999,(s:typeof saved)=>s.hazards[0].laser!.rayHits={player:1},(s:typeof saved)=>s.hazards[0].laser!.rayHits={unknown:-20},(s:typeof saved)=>delete s.attack!.bossLaserVersion,(s:typeof saved)=>s.hazards[0].laser!.count=4,(s:typeof saved)=>s.hazards[0].radius=140,(s:typeof saved)=>(s.hazards[0].laser as any).radii={length:3}]){const bad=structuredClone(saved);change(bad);expect(()=>validateCampBoss({stage:'battle',warning:0,attempt:0,away:0,combat:bad},e.id)).toThrow();}
 });
 it('半强度牵引施法首领，入场／转换与其他首领不移动',()=>{
  const {system,target,port}=pull();system.pullEastBoss(240,340,[target],port);expect(target.x).toBeCloseTo(87);for(const field of ['entryUntil','transformUntil'] as const){target.x=100;target.bossBattle![field]=1000;system.pullEastBoss(240,340,[target],port);expect(target.x).toBe(100);target.bossBattle![field]=0;}
  target.boss='spore-heart';system.pullEastBoss(240,340,[target],port);expect(target.x).toBe(100);
 });
 it('重叠黑洞只牵引一次，扫掠阻挡和核心距离限制有效',()=>{
  const {system,target,port}=pull();system.rifts.push({...system.rifts[0],id:2});system.pullEastBoss(240,340,[target],port);expect(target.x).toBeCloseTo(87);
  port.move=(t,dx,dy)=>sweepMove(t,dx,dy,x=>x<75,()=>true);system.pullEastBoss(340,540,[target],port);expect(target.x).toBeGreaterThanOrEqual(75);target.x=20;port.move=(t,dx,dy)=>{t.x+=dx;t.y+=dy;};system.pullEastBoss(540,740,[target],port);expect(target.x).toBe(BLACK_HOLE.core);
 });
 it('受牵引的位移不计入自主步态，正常自主步进仍计入',()=>{
  const sample=new SlimeAnimation(),e={x:0,y:0,hp:100,externalMotion:{x:0,y:0}};sample.sample(e,null,0);e.x=13;e.externalMotion.x=13;expect(sample.sample(e,null,100).action).toBe('idle');expect(sample.distance).toBe(0);e.x+=5;expect(sample.sample(e,null,200).action).toBe('walk');expect(sample.distance).toBe(5);
 });
});
