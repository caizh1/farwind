import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {CAMP_BOSSES,type CampBossKind} from '../src/data/maps/windbell/campBosses';
import {BossMotion,sampleBossMotion,deformBossPoint} from '../src/game/systems/bossMotion';
import {createBossAttack,updateCampBoss,bossMajor} from '../src/game/systems/campBossCombat';
import {initialBossBattle,shiftBossAttack} from '../src/game/systems/campBossState';
import {enemyNavigation,type EnemyBody} from '../src/game/systems/enemy';
import {ENCOUNTERS} from '../src/data/maps/windbell/encounters';
const kinds=Object.keys(CAMP_BOSSES) as CampBossKind[];
function body(kind:CampBossKind,phase:1|2=1){const d=CAMP_BOSSES[kind],home=ENCOUNTERS.find(c=>c.id===d.camp)!;return {id:'boss-'+kind,type:d.type,boss:kind,hp:d.hp,x:home.x,y:home.y,homeX:home.x,homeY:home.y,staggerUntil:0,attackSerial:0,nav:enemyNavigation(),bossBattle:{...initialBossBattle(0),phase,nextAt:0}} as EnemyBody;}
describe('首领连续动作与战斗节奏',()=>{
 it.each(kinds)('%s 六招的相邻毫秒关节连续，暂停稳定，战斗实例不被表现层修改',kind=>{
  for(let move=0;move<6;move++){
   const e=body(kind);e.bossBattle!.move=move;const a=createBossAttack(e,1000,{x:e.x+100,y:e.y},e.bossBattle!),before=structuredClone(a),motion=new BossMotion();
   let max=0,previous=sampleBossMotion(kind,a,1000,0,false);const poses=new Set<string>();
   for(let now=1001;now<a.recoveryUntil;now++){
    const p=sampleBossMotion(kind,a,now,0,false);for(const k of Object.keys(p) as (keyof typeof p)[])max=Math.max(max,Math.abs(p[k]-previous[k]));previous=p;
    if(now%16===0)poses.add(JSON.stringify(p));
   }
   expect(max).toBeLessThan(.01);expect(poses.size).toBeGreaterThan(60);expect(a).toEqual(before);
   const first={...motion.sample(kind,a,a.contactAt,0,false)};expect(motion.sample(kind,a,a.contactAt,0,false)).toEqual(first);
   expect(sampleBossMotion(kind,shiftBossAttack(a,50000),a.contactAt+50000,0,false)).toEqual(sampleBossMotion(kind,a,a.contactAt,0,false));
  }
 });
 it.each(kinds)('%s 实际高清主体网格在六招和三个方向下不翻面、不撕裂',kind=>{
  const atlas=JSON.parse(readFileSync(`public/assets/camp-bosses-v2/${kind}/index.json`,'utf8'));
  for(const dir of ['down','up','right'])for(let move=0;move<6;move++){
   const art=atlas.frames[`${dir}/idle`],e=body(kind);e.bossBattle!.move=move;const a=createBossAttack(e,0,{x:e.x+100,y:e.y},e.bossBattle!);
   for(let now=0;now<=a.recoveryUntil;now+=35){const p=sampleBossMotion(kind,a,now,0,false),points:number[][]=[];
    for(let r=0;r<=20;r++)for(let c=0;c<=20;c++)points.push(deformBossPoint(kind,dir==='right',(art.width*c/20-art.foot[0])/art.nativeHeight,(art.height*r/20-art.foot[1])/art.nativeHeight,art.width/art.nativeHeight,p));
    const area=(a:number[],b:number[],c:number[])=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    for(let r=0;r<20;r++)for(let c=0;c<20;c++){const i=r*21+c,where=`${dir} 技能${move} 时间${now} 网格${r},${c}`;expect(area(points[i],points[i+1],points[i+21]),where).toBeGreaterThan(0);expect(area(points[i+21],points[i+1],points[i+22]),where).toBeGreaterThan(0);}
   }
  }
 });
 it.each(kinds)('%s 二阶段压缩普通前摇，大招预警与锁向躲避时间保持完整',kind=>{
  for(let move=0;move<6;move++){const e=body(kind);e.bossBattle!.move=move;const target={x:e.x+100,y:e.y},a=createBossAttack(e,0,target,e.bossBattle!),b=createBossAttack(e,0,target,{...e.bossBattle!,phase:2});
   expect(b.contactAt-b.startedAt).toBeGreaterThanOrEqual(bossMajor(kind,move)?1000:700);
   if(!b.bossGeometry?.rear)expect(b.contactAt-b.lockAt).toBe(350);
   expect(bossMajor(kind,move)?b.contactAt===a.contactAt:b.contactAt<a.contactAt).toBe(true);
  }
 });
 it.each(kinds)('%s 机关与弹反已给出的长窗口不会被普通收招缩短',kind=>{
  const e=body(kind,2);e.bossBattle!.move=3;e.attack=createBossAttack(e,0,{x:e.x+80,y:e.y},e.bossBattle!);const end=e.attack.recoveryUntil;e.bossBattle!.exposedUntil=end+2000;
  updateCampBoss(e,{x:e.x+80,y:e.y},end,0,'player',true);expect(e.bossBattle!.exposedUntil).toBe(end+2000);expect(e.bossBattle!.nextAt).toBe(end+2000);
 });
 it('移动步态由路程驱动，取消、时间回退和停止都连续收势',()=>{
  const m=new BossMotion();m.sample('thorn-crown',null,1000,30,true);const moving={...m.current};m.sample('thorn-crown',null,1016,30,false);expect(Math.abs(m.current.stride-moving.stride)).toBeLessThan(.35);
  expect(m.sample('thorn-crown',null,0,0,false)).toEqual(sampleBossMotion('thorn-crown',null,0,0,false));
 });
});
