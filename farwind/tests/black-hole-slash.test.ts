import {describe,it,expect} from 'vitest';
import {BlackHoleSlash,BLACK_HOLE,blackHoleChance,type BlackHolePort,type BlackHoleTarget} from '../src/game/systems/blackHoleSlash';
import {SwordWindSystem,type WindMotion} from '../src/game/systems/swordWind';
import {resolveSwordWindConfig,SWORD_WIND} from '../src/data/swordWind';
import {type Attack,sweepMove} from '../src/game/systems/combat';
import {initialWindGifts,giftValue,offerWindGift,validateWindGifts} from '../src/game/systems/windGifts';
import {initialState,parseSave} from '../src/game/systems/state';
const noWall=()=>null;
function wind(id=1,stage:1|5=1){const a:Attack={id,stage:1,kind:'swordWind',delivery:'wind',start:0,facing:3,hit:new Set(),config:{...SWORD_WIND.strike},swordWind:resolveSwordWindConfig(stage)};return new SwordWindSystem().launch(a,{x:0,y:0},0,36)!;}
function arena(){const system=new BlackHoleSlash(),hits:{id:string;amount:number;phase:string}[]=[];system.random=()=>0;const enemies:BlackHoleTarget[]=[];
 const port:BlackHolePort={clear:()=>true,move:(t,dx,dy)=>{t.x+=dx;t.y+=dy;},damage:(t,amount,_r,phase)=>{hits.push({id:t.id,amount,phase});t.hp=Math.max(0,t.hp-amount);return amount;}};
 const motions=():WindMotion[]=>enemies.map(target=>({target,previous:{x:target.x,y:target.y},current:{x:target.x,y:target.y}}));
 return {system,hits,enemies,port,motions};
}
describe('黑洞斩与次元持续伤害',()=>{
 it('一级5%，每级一个百分点，六级及以上封顶10%，真实存档往返保留',()=>{
  expect(Array.from({length:8},(_,i)=>blackHoleChance(i))).toEqual([0,.05,.06,.07,.08,.09,.1,.1]);
  const s=initialState();s.windGifts.held=[{id:'blackHole',level:6}];expect(giftValue(s.windGifts,'blackHole')).toBe(.1);
  expect(parseSave(JSON.stringify(s)).windGifts.held).toEqual(s.windGifts.held);expect(validateWindGifts(s.windGifts)).toEqual(s.windGifts);
  for(let n=0;n<100;n++){const g=initialWindGifts();offerWindGift(g,String(n),n,false);expect(g.pending[0].candidates).not.toContain('blackHole');}
 });
 it('每次原生I只抽一次；多向、回程、反击、教学不重复或越权抽取',()=>{
  const s=new BlackHoleSlash();let rolls=0;s.random=()=>{rolls++;return .05;};const w=wind(1,5);
  expect(s.release(w,1,18)).toBe(false);expect(s.release(w,6,18)).toBe(false);expect(rolls).toBe(1);
  expect(s.release(wind(2),2,18)).toBe(true);expect(s.blades.winds).toHaveLength(1);
  const back={...wind(3),leg:'back' as const};expect(s.release(back,6,18)).toBe(false);
  const counter=wind(4);counter.attack.counter='perfect';expect(s.release(counter,6,18)).toBe(false);
  const lesson=wind(5);lesson.config.trialLesson='教学';expect(s.release(lesson,6,18)).toBe(false);expect(rolls).toBe(2);
 });
 it('风刃命中后在实际接触处开裂，持续吸入且不继续飞行',()=>{
  const a=arena();a.enemies.push({id:'敌人',kind:'enemy',x:160,y:0,hp:1000});a.system.release(wind(),6,100);
  a.system.advance(0,300,a.motions(),a.port,noWall);expect(a.hits.filter(h=>h.phase==='slash')).toHaveLength(1);
  const r=a.system.rifts[0];expect(r.x).toBeLessThan(160);expect(a.system.blades.winds.some(w=>!w.terminated)).toBe(false);
  const before=a.enemies[0].x;a.system.advance(300,600,a.motions(),a.port,noWall);expect(a.enemies[0].x).toBeLessThan(before);
 });
 it('按实际秒数累计DPS，不受帧长影响；到期不再造成伤害',()=>{
  const run=(step:number)=>{const a=arena();a.system.release(wind(),6,100);a.system.advance(0,400,[],a.port,noWall);
   const r=a.system.rifts[0];a.enemies.push({id:'持续目标',kind:'enemy',x:r.x+50,y:r.y,hp:1000,boss:'首领'});
   let prev=400;for(let now=400+step;now<=2600;now+=step){a.system.advance(prev,now,a.motions(),a.port,noWall);prev=now;}a.system.advance(prev,2800,a.motions(),a.port,noWall);
   const sum=a.hits.filter(h=>h.phase==='dot').reduce((n,h)=>n+h.amount,0);expect(a.system.rifts).toHaveLength(0);
   a.system.advance(2800,5000,a.motions(),a.port,noWall);expect(a.hits.reduce((n,h)=>n+h.amount,0)).toBe(sum);return sum;};
  expect(run(10)).toBeCloseTo(100*.4*1.44,8);expect(run(100)).toBeCloseTo(run(10),8);
 });
 it('离开范围只结清已在场部分，墙后不吸不掉血；首领机关持续掉血但不移动',()=>{
  const a=arena();a.system.release(wind(),6,100);a.system.advance(0,400,[],a.port,noWall);const r=a.system.rifts[0];
  a.enemies.push({id:'离场',kind:'enemy',x:r.x+40,y:r.y,hp:1000},{id:'墙后',kind:'enemy',x:r.x+80,y:r.y,hp:1000},{id:'首领',kind:'enemy',boss:'首领',x:r.x+100,y:r.y,hp:1000},{id:'机关',kind:'enemy',passiveRoot:true,x:r.x+120,y:r.y,hp:1000},{id:'木桩',kind:'trainingDummy',x:r.x,y:r.y,hp:1000});
  a.port.clear=t=>(t as BlackHoleTarget).id!=='墙后';a.system.advance(400,700,a.motions(),a.port,noWall);
  a.enemies[0].x=r.x+500;a.system.advance(700,701,a.motions(),a.port,noWall);const total=a.hits.filter(h=>h.id==='离场').reduce((n,h)=>n+h.amount,0);a.system.advance(701,1700,a.motions(),a.port,noWall);
  expect(a.hits.filter(h=>h.id==='离场').reduce((n,h)=>n+h.amount,0)).toBe(total);
  expect(a.enemies[1].hp).toBe(1000);expect(a.enemies[2].x).toBe(r.x+100);expect(a.enemies[2].hp).toBeLessThan(1000);expect(a.enemies[3].x).toBe(r.x+120);expect(a.enemies[4].hp).toBe(1000);
 });
 it('正式时间轴的同刻碰撞检查不提前结清DPS，不产生逐步长小额飘字',()=>{
  const a=arena();a.system.release(wind(),6,100);a.system.advance(0,400,[],a.port,noWall);const r=a.system.rifts[0];
  a.enemies.push({id:'同刻检查目标',kind:'enemy',boss:'首领',x:r.x+50,y:r.y,hp:1000});
  for(let now=405;now<=2600;now+=5){a.system.advance(now-5,now,a.motions(),a.port,noWall);a.system.advance(now,now,a.motions(),a.port,noWall);}
  const dots=a.hits.filter(h=>h.phase==='dot');expect(dots.length).toBeLessThanOrEqual(6);expect(dots.reduce((n,h)=>n+h.amount,0)).toBeCloseTo(100*.4*1.44,8);
 });
 it('重叠裂缝持续伤害可叠加，单次推进的牵引不会重复翻倍',()=>{
  const a=arena();a.system.release(wind(1),6,100);a.system.release(wind(2),6,100);a.system.advance(0,400,[],a.port,noWall);
  const r=a.system.rifts[0];a.enemies.push({id:'重叠目标',kind:'enemy',x:r.x+150,y:r.y,hp:1000});
  const before=a.enemies[0].x;a.system.advance(600,900,a.motions(),a.port,noWall);
  expect(before-a.enemies[0].x).toBeCloseTo(BLACK_HOLE.pullSpeed*.3);expect(a.hits.reduce((n,h)=>n+h.amount,0)).toBeCloseTo(100*.4*.3*2);
 });
 it('牵引遵守正式扫掠碰撞、不穿墙；最多四裂缝；清场无残留伤害',()=>{
  const a=arena();a.system.release(wind(),6,100);a.system.advance(0,400,[],a.port,noWall);const r=a.system.rifts[0];
  a.enemies.push({id:'碰撞目标',kind:'defense-enemy',x:r.x+100,y:r.y,hp:1000});a.port.move=(t,dx,dy)=>sweepMove(t,dx,dy,(x)=>x<r.x+70,()=>true);
  a.system.advance(400,1400,a.motions(),a.port,noWall);expect(a.enemies[0].x).toBeGreaterThanOrEqual(r.x+70);
  for(let id=2;id<=7;id++){a.system.release(wind(id),6,100);a.system.advance(0,400,[],a.port,noWall);}expect(a.system.rifts.length).toBe(BLACK_HOLE.maxRifts);
  a.system.clear();const hp=a.enemies[0].hp;a.system.advance(1400,10000,a.motions(),a.port,noWall);expect(a.enemies[0].hp).toBe(hp);expect(a.system.blades.winds).toHaveLength(0);
 });
});
