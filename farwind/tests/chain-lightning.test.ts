import {describe,it,expect,vi} from 'vitest';
vi.mock('phaser',()=>({default:{Math:{Vector2:class{constructor(public x:number,public y:number){}}}}}));
import {initialState} from '../src/game/systems/state';
import {RuneCombat,type RuneFx,type RuneEvent} from '../src/game/systems/runeCombat';
import {RuneWorld} from '../src/game/systems/runeWorld';
import {playGiftFx,paintWindGiftFx} from '../src/game/entities/windGiftVfx';
import {CHAIN_LIGHTNING} from '../src/game/entities/chainLightning';
import type {RuneInk} from '../src/game/entities/runeView';

describe('闪链独立电弧与命中边界',()=>{
 it('近邻两目标各有电弧，第二束只延迟演出，伤害仍立即结算且不能递归',()=>{
  const state=initialState();state.windGifts.held=[{id:'chain',level:4}];
  const origin={id:'原受击者',x:100,y:100,hp:1000},targets=[origin,
   {id:'近邻甲',x:150,y:100,hp:1000},{id:'近邻乙',x:150,y:125,hp:1000},
   {id:'第三候选',x:190,y:100,hp:1000},{id:'范围外',x:290,y:100,hp:1000}];
  const hits:RuneEvent[]=[],engine=new RuneCombat({state:()=>state,targets:()=>targets,A:()=>100,
   clear:()=>true,visible:()=>true,blocker:()=>null,push:()=> 'immune',sound:()=>{},checkpoint:()=>{},
   damage:(e,event)=>{hits.push(event);e.hp-=event.amount;return {applied:true,damage:event.amount,killed:false};}});
  // 使用正式命中入口，替换画布端口，不创建场景或改写命中判定。
  const world=Object.assign(Object.create(RuneWorld.prototype),{world:{state},engine,
   damage:engine.ctx.damage,gifts:{visual:(id:'chain',point:{x:number;y:number},extra:Partial<RuneFx>)=>playGiftFx(engine,id,point,extra)}}) as RuneWorld;
  world.giftLanded(origin,engine.native('固定剑风',origin,100,1,true),false);
  expect(hits.map(e=>[e.targetId,e.amount])).toEqual([['近邻甲',80],['近邻乙',80]]);
  expect(state.windGifts.cooldowns.chain).toBe(1500);
  const effects=engine.effects.filter(f=>f.visual==='gift:chain');
  expect(effects.map(f=>f.lead)).toEqual([0,70]);
  expect(effects.map(f=>f.life)).toEqual([320,390]);
  expect(effects.every(f=>f.end?.x===origin.x&&f.end?.y===origin.y)).toBe(true);
  expect(engine.jobs).toHaveLength(0);
  world.giftLanded(targets[1],hits[0],false);
  world.giftLanded(origin,engine.native('冷却内攻击',origin,100,1,false),false);
  expect(hits).toHaveLength(2);
  playGiftFx(engine,'chain',effects[0].point,{end:origin});expect(engine.effects).toHaveLength(2);
 });
 it('沿实际端点前进，出现尖锐分叉，延迟前及到期后不画；暂停稳定，降闪简化有效',()=>{
  const paths:{points:number[][];alpha:number}[]=[],alphas:number[]=[],glows:number[]=[];
  const ink:RuneInk={glow:(_x,_y,_r,a)=>{glows.push(a);alphas.push(a);},path:(points,_color,alpha)=>{paths.push({points,alpha});alphas.push(alpha);},
   line:(_x,_y,_xx,_yy,_c,a)=>alphas.push(a),ellipse:(_x,_y,_rx,_ry,_c,a)=>alphas.push(a),solid:(_p,_c,a)=>alphas.push(a)};
  const effect:RuneFx={id:4,visual:'gift:chain',rune:'',point:{x:270,y:90},end:{x:100,y:140},radius:68,born:0,lead:70,life:390};
  const draw=(age:number,simple=false,low=false)=>{paths.length=alphas.length=glows.length=0;paintWindGiftFx(ink,effect,age,simple,low);return structuredClone(paths);};
  expect(draw(69)).toHaveLength(0);
  const leader=draw(80)[0].points;expect(leader[0]).toEqual([100,140]);expect(leader.at(-1)![0]).toBeLessThan(270);
  const live=draw(120);expect(glows.length).toBeGreaterThan(0);expect(live[0].points.at(-1)).toEqual([270,90]);
  expect(live[0].points.slice(1,-1).some(([x,y])=>Math.abs((y-140)*170+(x-100)*50)>200)).toBe(true);
  expect(live.length).toBeGreaterThan(20);expect(draw(120)).toEqual(live);
  const simplified=draw(120,true,true);expect(simplified.length).toBeLessThan(live.length);
  expect(alphas.every(a=>a>=0&&a<=.46)).toBe(true);expect(glows).toHaveLength(0);
  for(const point of [{x:270,y:90},{x:100,y:140},{x:100,y:310}]){effect.point=point;for(let t=70;t<390;t+=7){draw(t);expect(paths.every(p=>p.points.flat().every(Number.isFinite))).toBe(true);}}
  expect(draw(effect.lead!+CHAIN_LIGHTNING.life)).toHaveLength(0);
 });
});
