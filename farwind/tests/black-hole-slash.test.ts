import {describe,it,expect} from 'vitest';
import {BlackHoleSlash,BLACK_HOLE,blackHoleChance,blackHoleDps,blackHoleConfig,type BlackHolePort,type BlackHoleTarget} from '../src/game/systems/blackHoleSlash';
import {SwordWindSystem,type WindMotion} from '../src/game/systems/swordWind';
import {resolveSwordWindConfig,SWORD_WIND} from '../src/data/swordWind';
import {type Attack,sweepMove} from '../src/game/systems/combat';
import {initialWindGifts,giftValue,offerWindGift,chooseWindGift,giftEffect,validateWindGifts} from '../src/game/systems/windGifts';
import {initialState,parseSave} from '../src/game/systems/state';
const noWall=()=>null;
function wind(id=1,stage:1|5=1){const a:Attack={id,stage:1,kind:'swordWind',delivery:'wind',start:0,facing:3,hit:new Set(),config:{...SWORD_WIND.strike},swordWind:resolveSwordWindConfig(stage)};return new SwordWindSystem().launch(a,{x:0,y:0},0,36)!;}
function arena(){const system=new BlackHoleSlash(),hits:{id:string;amount:number;phase:string}[]=[];system.random=()=>0;const enemies:BlackHoleTarget[]=[];
 const port:BlackHolePort={clear:()=>true,move:(t,dx,dy)=>{t.x+=dx;t.y+=dy;},damage:(t,amount,_r,phase)=>{hits.push({id:t.id,amount,phase});t.hp=Math.max(0,t.hp-amount);return amount;}};
 const motions=():WindMotion[]=>enemies.map(target=>({target,previous:{x:target.x,y:target.y},current:{x:target.x,y:target.y}}));
 return {system,hits,enemies,port,motions};
}
describe('黑洞斩与次元持续伤害',()=>{
 it('每次升级跳伤加3，显示2、5、8、10；大步长也逐跳封顶，升级不修改已发射裂缝',()=>{
  expect(blackHoleDps(18,0)).toBe(0);
  expect([1,2,3,4,6,100].map(level=>Math.round(blackHoleDps(18,level)/4))).toEqual([2,5,8,10,10,10]);
  for(const level of [1,2,3,4,6])for(const step of [10,100,333]){
   const a=arena();a.system.release(wind(),level,18);a.system.advance(0,400,[],a.port,noWall);const r=a.system.rifts[0],expected=blackHoleDps(18,level);
   expect(r.dps).toBe(expected);expect(a.system.snapshot().rifts[0].dps).toBe(expected);
   a.enemies.push({id:'升级跳伤目标',kind:'enemy',boss:'首领',x:r.x+50,y:r.y,hp:1000});
   let prev=400;for(let now=400+step;now<=2600;now+=step){a.system.advance(prev,now,a.motions(),a.port,noWall);prev=now;}a.system.advance(prev,2800,a.motions(),a.port,noWall);
   const dots=a.hits.filter(h=>h.phase==='dot');expect(dots.reduce((sum,h)=>sum+h.amount,0)).toBeCloseTo(expected*1.44,8);
   expect(dots.every(h=>h.amount<=10+1e-9)).toBe(true);
  }
  const a=arena(),gifts=initialWindGifts();gifts.held=[{id:'blackHole',level:1}];a.system.release(wind(),gifts.held[0].level,18);
  gifts.held[0].level=4;a.system.advance(0,400,[],a.port,noWall);expect(a.system.rifts[0].dps).toBe(7.2);
  expect(parseSave(JSON.stringify({...initialState(),windGifts:gifts})).windGifts.held[0].level).toBe(4);
  expect(giftEffect('blackHole',4)).toContain('单跳10点封顶');
 });
 it('三项强化需要已学习I且持有黑洞，正式抽取、升级与存档往返保留',()=>{
  const ids=['riftRadius','riftSuction','riftDuration'] as const,seen=new Set<string>();
  for(const unlocked of [false,true])for(let seed=0;seed<100;seed++){
   const g=initialWindGifts();if(!unlocked)g.held=[{id:'blackHole',level:1}];offerWindGift(g,String(seed),seed,unlocked);
   expect(g.pending[0].candidates.some(id=>ids.includes(id as typeof ids[number]))).toBe(false);
  }
  const state=initialState();state.windGifts.held=[{id:'blackHole',level:1}];
  for(let seed=0;seed<1000&&seen.size<3;seed++){
   const receipt=`黑洞强化:${seed}`;offerWindGift(state.windGifts,receipt,seed,true);
   const id=state.windGifts.pending[0].candidates.find(id=>ids.includes(id as typeof ids[number]));
   if(id){chooseWindGift(state.windGifts,receipt,id);seen.add(id);}else chooseWindGift(state.windGifts,receipt,state.windGifts.pending[0].candidates[0]);
  }
  expect(seen.size).toBe(3);expect(parseSave(JSON.stringify(state)).windGifts).toEqual(state.windGifts);
  const old=initialState();old.windGifts.held=[{id:'blackHole',level:1}];expect(blackHoleConfig(parseSave(JSON.stringify(old)).windGifts)).toEqual({radius:180,pullRadius:180,hold:1440});
 });
 it('扩界扩大伤害与裂缝并延时，吞星只增加外围吸收，长夜可叠加延时；高等级有明确上限',()=>{
  const gifts=initialWindGifts();gifts.held=[{id:'riftRadius',level:1}];expect(blackHoleConfig(gifts)).toEqual({radius:216,pullRadius:216,hold:2040});
  gifts.held=[{id:'riftRadius',level:3},{id:'riftDuration',level:3}];expect(blackHoleConfig(gifts).hold).toBe(5040);
  expect(blackHoleConfig(parseSave(JSON.stringify({...initialState(),windGifts:gifts})).windGifts).hold).toBe(5040);
  gifts.held=[{id:'riftSuction',level:1}];expect(blackHoleConfig(gifts)).toEqual({radius:180,pullRadius:234,hold:1440});
  gifts.held=[{id:'riftDuration',level:1}];expect(blackHoleConfig(gifts)).toEqual({radius:180,pullRadius:180,hold:2040});
  gifts.held=(['riftRadius','riftSuction','riftDuration'] as const).map(id=>({id,level:Number.MAX_SAFE_INTEGER}));
  expect(blackHoleConfig(gifts)).toEqual({radius:360,pullRadius:720,hold:7440});
  for(const id of ['riftRadius','riftSuction','riftDuration'] as const)expect(giftEffect(id,100)).toContain('上限');
 });
 it('扩大伤害范围确实命中旧半径之外；外围吸收先牵引且不提前造成伤害，墙后与首领仍受保护',()=>{
  const a=arena(),config=blackHoleConfig({held:[{id:'riftRadius',level:3},{id:'riftSuction',level:3}]});
  a.system.release(wind(),6,100,36,config);a.system.advance(0,400,[],a.port,noWall);const r=a.system.rifts[0];
  a.enemies.push({id:'扩界目标',kind:'enemy',boss:'首领',x:r.x+240,y:r.y,hp:1000},{id:'外围目标',kind:'enemy',x:r.x+400,y:r.y,hp:1000},{id:'墙后',kind:'enemy',x:r.x+400,y:r.y+5,hp:1000},{id:'外围首领',kind:'enemy',boss:'首领',x:r.x-400,y:r.y,hp:1000});
  a.port.clear=t=>(t as BlackHoleTarget).id!=='墙后';a.system.advance(600,850,a.motions(),a.port,noWall);
  expect(a.enemies[0].hp).toBe(990);expect(a.enemies[0].x).toBe(r.x+240);
  expect(a.enemies[1].hp).toBe(1000);expect(a.enemies[1].x).toBeCloseTo(r.x+335);
  expect(a.enemies[2].x).toBe(r.x+400);expect(a.enemies[2].hp).toBe(1000);
  expect(a.enemies[3].x).toBe(r.x-400);expect(a.enemies[3].hp).toBe(1000);
  a.system.advance(850,1100,a.motions(),a.port,noWall);a.system.advance(1100,1350,a.motions(),a.port,noWall);
  expect(a.enemies[1].hp).toBeLessThan(1000);
 });
 it('扩界延时按发射时参数保存，跨越基础到期仍结算；分帧DPS一致、到期与清场无残留',()=>{
  const run=(step:number)=>{const a=arena(),config=blackHoleConfig({held:[{id:'riftRadius',level:3}]});
   a.system.release(wind(),6,100,36,config);config.hold=1440;a.system.advance(0,400,[],a.port,noWall);const r=a.system.rifts[0];
   expect(r.hold).toBe(3240);expect(a.system.snapshot().rifts[0].hold).toBe(3240);
   a.enemies.push({id:'长夜目标',kind:'enemy',boss:'首领',x:r.x+50,y:r.y,hp:1000});
   let prev=400;for(let now=400+step;now<=4000;now+=step){a.system.advance(prev,now,a.motions(),a.port,noWall);prev=now;}a.system.advance(prev,4200,a.motions(),a.port,noWall);
   const total=a.hits.reduce((n,h)=>n+h.amount,0);expect(a.system.rifts).toHaveLength(0);a.system.advance(4200,6000,a.motions(),a.port,noWall);expect(a.hits.reduce((n,h)=>n+h.amount,0)).toBe(total);
   return total;};expect(run(10)).toBeCloseTo(100*.4*3.24,8);expect(run(100)).toBeCloseTo(run(10),8);
 });
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
  expect(before-a.enemies[0].x).toBeCloseTo(BLACK_HOLE.pullSpeed*.3);expect(a.hits.reduce((n,h)=>n+h.amount,0)).toBeCloseTo(10*2);
  a.enemies[0].x=r.x+500;a.system.advance(900,901,a.motions(),a.port,noWall);
  expect(a.hits.reduce((n,h)=>n+h.amount,0)).toBeCloseTo(100*.4*.3*2);
 });
 it('牵引遵守正式扫掠碰撞、不穿墙；最多四裂缝；清场无残留伤害',()=>{
  const a=arena();a.system.release(wind(),6,100);a.system.advance(0,400,[],a.port,noWall);const r=a.system.rifts[0];
  a.enemies.push({id:'碰撞目标',kind:'defense-enemy',x:r.x+100,y:r.y,hp:1000});a.port.move=(t,dx,dy)=>sweepMove(t,dx,dy,(x)=>x<r.x+70,()=>true);
  a.system.advance(400,1400,a.motions(),a.port,noWall);expect(a.enemies[0].x).toBeGreaterThanOrEqual(r.x+70);
  for(let id=2;id<=7;id++){a.system.release(wind(id),6,100);a.system.advance(0,400,[],a.port,noWall);}expect(a.system.rifts.length).toBe(BLACK_HOLE.maxRifts);
  a.system.clear();const hp=a.enemies[0].hp;a.system.advance(1400,10000,a.motions(),a.port,noWall);expect(a.enemies[0].hp).toBe(hp);expect(a.system.blades.winds).toHaveLength(0);
 });
});
