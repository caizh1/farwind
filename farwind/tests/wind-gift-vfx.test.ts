import {describe,it,expect} from 'vitest';
import sharp from 'sharp';
import {WIND_GIFTS,GIFT_RESONANCES} from '../src/game/systems/windGifts';
import {WIND_GIFT_ART,GIFT_MATERIALS,giftGlyphSvg,giftFrame,type GiftVisualId} from '../src/game/entities/windGiftArt';
import {paintWindGiftFx,playGiftFx} from '../src/game/entities/windGiftVfx';
import type {RuneFx,RuneCombat} from '../src/game/systems/runeCombat';
import type {RuneInk} from '../src/game/entities/runeView';
import {GIFT_CHOREOGRAPHY,giftEnvelope} from '../src/game/entities/windGiftChoreography';

describe('完整风赐视觉与运行边界',()=>{
 it('重做目录覆盖全部七十八项；旧六帧轮播不能进入演出，相邻时刻连续且重复渲染稳定',()=>{
  expect(Object.keys(GIFT_CHOREOGRAPHY).sort()).toEqual([...Object.keys(WIND_GIFTS).filter(id=>id!=='blackHole'),...Object.keys(GIFT_RESONANCES)].sort());
  for(const id of Object.keys(GIFT_CHOREOGRAPHY) as Exclude<GiftVisualId,'blackHole'>[]){
   const art=WIND_GIFT_ART[id],f:RuneFx={id:1,visual:'gift:'+id,rune:'',point:{x:300,y:140},radius:art.size,born:0,life:art.life,direction:{x:1,y:0},end:{x:420,y:140}};
   const render=(time:number)=>{const result:number[][]=[];const add=(c:number[],a:number)=>result.push([...c,a]);const ink:RuneInk={line:(x,y,xx,yy,_c,a)=>add([x,y,xx,yy],a),ellipse:(x,y,rx,ry,_c,a)=>add([x,y,rx,ry],a),path:(p,_c,a)=>add(p.flat(),a),solid:(p,_c,a)=>add(p.flat(),a),giftStamp:()=>{throw Error('旧动画轮播不得进入新演出');},giftMaterial:(m,x,y,w,h,a,rot)=>{expect(m).toBeGreaterThanOrEqual(0);expect(m).toBeLessThan(24);add([m,x,y,w,h,rot],a);}};paintWindGiftFx(ink,f,time);return result;};
   for(const fraction of [1/6,2/6,3/6,4/6,5/6]){const before=render(art.life*fraction-.001),after=render(art.life*fraction+.001);expect(render(art.life*fraction-.001)).toEqual(before);expect(before.length).toBe(after.length);for(let i=0;i<before.length;i++)for(let j=0;j<before[i].length;j++)expect(Math.abs(before[i][j]-after[i][j])).toBeLessThan(.08);}
  }
  expect(giftEnvelope(0)).toBe(0);expect(giftEnvelope(1)).toBe(0);
 });
 it('六十一种风赐和十八组共鸣各有独立且可解析的纹样',()=>{
  expect(Object.keys(WIND_GIFT_ART).sort()).toEqual([...Object.keys(WIND_GIFTS),...Object.keys(GIFT_RESONANCES)].sort());
  expect(new Set(Object.keys(WIND_GIFT_ART).map(id=>giftGlyphSvg(id as GiftVisualId))).size).toBe(79);
  for(const art of Object.values(WIND_GIFT_ART)){expect(art.description).toMatch(/[\u4e00-\u9fff]/);expect(art.life).toBeGreaterThan(0);expect(GIFT_MATERIALS[art.motion]).toBeDefined();}
 });
 it('各动作从起势至消散都有有限坐标，降闪与简化模式有效，结束不残留',()=>{
  for(const [id,art] of Object.entries(WIND_GIFT_ART).filter(([id])=>id!=='blackHole')){
   const calls:{alpha:number;coords:number[];stamp?:boolean}[]=[],add=(coords:number[],alpha:number,stamp=false)=>calls.push({coords,alpha,stamp});
   const ink:RuneInk={line:(x,y,xx,yy,_c,a)=>add([x,y,xx,yy],a),ellipse:(x,y,rx,ry,_c,a)=>add([x,y,rx,ry],a),path:(p,_c,a)=>add(p.flat(),a),solid:(p,_c,a)=>add(p.flat(),a),giftMaterial:(_m,x,y,w,h,a)=>add([x,y,w,h],a,true)};
   const f:RuneFx={id:1,visual:'gift:'+id,rune:'',point:{x:300,y:140},radius:art.size,born:0,life:art.life,direction:{x:0,y:-1},end:{x:390,y:140}};
   for(const fraction of [.05,.3,.55,.8,.99]){calls.length=0;paintWindGiftFx(ink,f,fraction*art.life);expect(calls.length).toBeGreaterThan(0);expect(calls.every(c=>c.coords.every(Number.isFinite)&&c.alpha>=0&&c.alpha<=1)).toBe(true);}
   calls.length=0;paintWindGiftFx(ink,f,art.life*.5,true,true);expect(calls.some(c=>c.stamp)).toBe(false);expect(calls.every(c=>c.alpha<=.48)).toBe(true);
   calls.length=0;paintWindGiftFx(ink,f,art.life);paintWindGiftFx(ink,f,-1);expect(calls).toHaveLength(0);
  }
  expect([0,100,200,300,400,500,600].map(t=>giftFrame(t,600))).toEqual([0,1,2,3,4,5,5]);
 });
 it('同刻至多四个演出、共鸣优先；保留其他符文效果，重复不会追加',()=>{
  const engine={now:0,serial:0,effects:[{id:0,visual:'既有符文',born:0,life:1000}],fx(visual:string,point:unknown,radius:number,rune:string,life:number){this.effects.push({id:++this.serial,visual,born:this.now,life,point});}} as unknown as RuneCombat;
  for(const id of ['fullWind','blade','gale','sharedHeart','holdWind','aftershock'] as const)playGiftFx(engine,id,{x:0,y:0});
  expect(engine.effects).toHaveLength(5);playGiftFx(engine,'oneLineArmy',{x:0,y:0});expect(engine.effects.some(f=>f.visual==='gift:oneLineArmy')).toBe(true);expect(engine.effects.some(f=>f.visual==='既有符文')).toBe(true);playGiftFx(engine,'oneLineArmy',{x:10,y:10});expect(engine.effects).toHaveLength(5);
  for(let n=1;n<=50;n++){Object.assign(engine,{now:n*110});playGiftFx(engine,Object.keys(WIND_GIFT_ART)[n%79] as GiftVisualId,{x:0,y:0});}
  expect(engine.effects.filter(f=>f.visual.startsWith('gift:')&&f.born+f.life>engine.now).length).toBeLessThanOrEqual(18);
 });
 for(const sheet of ['materials'])it(`${sheet}图集含二十四组件、每格透明安全边，主体有真实透明度`,async()=>{
  const {data,info}=await sharp(`public/assets/animation/wind-gifts/${sheet}.webp`).ensureAlpha().raw().toBuffer({resolveWithObject:true});expect([info.width,info.height]).toEqual([1536,1024]);
  for(let row=0;row<4;row++)for(let col=0;col<6;col++){let max=0,border=true;for(let y=0;y<256;y++)for(let x=0;x<256;x++){const a=data[((row*256+y)*info.width+col*256+x)*4+3];if(x<16||x>=240||y<16||y>=240)border=border&&a===0;max=Math.max(max,a);}expect(border).toBe(true);expect(max).toBeGreaterThan(100);}
 });
});
