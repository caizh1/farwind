import {describe,it,expect,vi} from 'vitest';
vi.mock('phaser',()=>({default:{Math:{Vector2:class{constructor(public x:number,public y:number){}}}}}));
import {CAMP_BOSSES,type CampBossKind} from '../src/data/maps/windbell/campBosses';
import {CampBossView} from '../src/game/entities/campBossView';
import {sampleBossParry} from '../src/game/systems/bossParry';
import {initialBossBattle} from '../src/game/systems/campBossState';
import {captureBossCombat,restoreBossCombat,BossHazards} from '../src/game/systems/campBossCombat';
import {EnemyProjectiles} from '../src/game/systems/enemyProjectiles';
import {enemyNavigation,type EnemyBody} from '../src/game/systems/enemy';

const kinds=Object.keys(CAMP_BOSSES) as CampBossKind[];
function body(kind:CampBossKind,perfect=false,direction={x:1,y:0}):EnemyBody{return {id:'boss-'+kind,boss:kind,type:CAMP_BOSSES[kind].type,hp:CAMP_BOSSES[kind].hp,x:100,y:150,homeX:100,homeY:150,cool:0,windup:0,ai:'首领失衡',nav:enemyNavigation(),bossBattle:initialBossBattle(0),staggerSince:2000,staggerUntil:perfect?2800:2600,parried:{at:2000,until:perfect?2800:2600,direction,perfect}};}
function surface(){let ink:any;ink=new Proxy({}, {get:()=>()=>ink});return ink;}
function sprite(){const s:any={x:0,y:0,rotation:0,frame:{name:0,u0:0,u1:1,v0:0,v1:1,sourceIndex:0},alpha:1,visible:true,once(){return s;},off(){return s;}};for(const method of ['setTexture','setOrigin','setDisplaySize','setPosition','setDepth','setRotation','setAlpha','setVisible','setFlipX','clearTint','setScale','buildOrderedIndices','destroy'])s[method]=(...a:any[])=>{if(method==='setTexture'){s.frame.name=a[1];s.texture={key:a[0]};}if(method==='setPosition'){s.x=a[0];s.y=a[1];}if(method==='setRotation')s.rotation=a[0];if(method==='setDisplaySize'){s.width=a[0];s.height=a[1];}if(method==='setVisible')s.visible=a[0];return s;};return s;}
function view(){const v=new CampBossView({add:{graphics:surface,text:sprite,mesh2d:sprite}} as any);v.assets={ready:()=>true,key:kind=>`首领图集:${kind}`,manifest:{frames:Object.fromEntries(['down','up','right'].map(d=>[`${d}/idle`,{width:500,height:500,nativeHeight:480,foot:[250,480],sourceHeight:600}]))}} as any;return v;}
const samples=kinds.flatMap(kind=>[false,true].map(perfect=>[kind,perfect] as const));
describe('所有首领的正式弹反表现',()=>{
 it.each(samples)('%s 精准=%s，最大失衡有实际姿态变化，收势在真实硬直结束前完整出现',(kind,perfect)=>{
  const e=body(kind,perfect),v=view(),s=sprite(),before=structuredClone(e);
  v.draw(e,null,s,2180,false);expect(Math.abs(s.rotation)).toBeGreaterThan(.08);expect(Math.hypot(s.x-e.x,s.y-e.y)).toBeGreaterThan(1);
  const pose=v.draw(e,null,s,e.parried!.until-1,false),phase=pose.phase;expect(phase).toBe('recover');expect(Math.abs(s.rotation)).toBeLessThan(.002);expect(e).toEqual(before);
  v.draw(e,null,s,e.parried!.until,false);expect(s.rotation).toBe(0);expect([s.x,s.y]).toEqual([e.x,e.y]);
 });
 it.each(kinds)('%s 四阶段、精准幅度和暂停重复采样不改变战斗数据',kind=>{
  const e=body(kind),before=structuredClone(e),frames=[0,80,200,550].map(t=>sampleBossParry(e,2000+t)!);
  expect(frames.map(p=>p.phase)).toEqual(['impact','recoil','brace','recover']);expect(sampleBossParry(e,2200)).toEqual(sampleBossParry(e,2200));expect(e).toEqual(before);
  expect(Math.abs(sampleBossParry(body(kind,true),2200)!.rotation)).toBeGreaterThan(Math.abs(frames[2].rotation)*1.3);
  for(const direction of [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1},{x:.71,y:.71}]){const p=sampleBossParry(body(kind,false,direction),2200)!;expect([p.x,p.y,p.rotation,p.scaleX,p.scaleY].every(Number.isFinite)).toBe(true);expect(p.x*direction.x+p.y*direction.y).toBeLessThan(0);if(direction.x)expect(p.rotation*direction.x).toBeLessThan(0);}
 });
 it.each(kinds)('%s 保存失衡中段后，换时钟恢复同一动作和碎屑时刻',kind=>{
  const e=body(kind,true),hazards=new BossHazards(),shots=new EnemyProjectiles(),at=2290,expected=sampleBossParry(e,at),saved=captureBossCombat(e,at,hazards,shots),restored=body(kind,true);restoreBossCombat(restored,saved,300000,new BossHazards(),new EnemyProjectiles());
  const actual=sampleBossParry(restored,300000)!;expect({...actual,braceAt:expected!.braceAt}).toEqual(expected);expect(sampleBossParry(restored,300510)).toBeNull();
 });
 it('破护心茧的斩击方向与弹反来袭方向相反，但素材都向远离玩家的一侧失衡',()=>{
  const e=body('bound-branch');e.attack={bossCocoon:true} as any;const p=sampleBossParry(e,2200)!;expect(p.x).toBeGreaterThan(0);expect(p.rotation).toBeGreaterThan(0);
 });
 it('远处只弹开弹丸、无效时刻、死亡、入场和阶段转换不产生失衡提示',()=>{
  const e=body('spore-heart');e.parried=undefined;expect(sampleBossParry(e,2200)).toBeNull();e.parried=body('spore-heart').parried;
  for(const at of [1999,2600])expect(sampleBossParry(e,at)).toBeNull();e.hp=0;expect(sampleBossParry(e,2200)).toBeNull();e.hp=100;e.bossBattle!.entryUntil=2300;expect(sampleBossParry(e,2200)).toBeNull();e.bossBattle!.entryUntil=0;e.bossBattle!.transformUntil=2300;expect(sampleBossParry(e,2200)).toBeNull();
 });
});
