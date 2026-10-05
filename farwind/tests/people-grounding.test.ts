import {describe,it,expect,vi} from 'vitest';
import sharp from 'sharp';
import {readdir} from 'node:fs/promises';
import type Phaser from 'phaser';
vi.mock('phaser',()=>({default:{TintModes:{FILL:1}}}));
import {GroundShadows} from '../src/game/rendering/groundShadows';
import {citySoleContact} from '../src/game/rendering/shadowGeometry';

// 直接调用正式阴影绘制器；测试对象只模拟 Phaser 的链式属性写入，不另写一套绘制算法。
function object(x=0,y=0,width=52,height=17){
 const o:any={x,y,width,height,scaleX:1,scaleY:1,visible:true,alpha:1,depth:200,rotation:0,
  on:vi.fn(),once:vi.fn(),off:vi.fn(),destroy:vi.fn(),setFillStyle:vi.fn(),buildOrderedIndices:vi.fn()};
 for(const [method,fields]of Object.entries({setPosition:['x','y'],setDisplaySize:['displayWidth','displayHeight'],setDepth:['depth'],setRotation:['rotation'],setAlpha:['alpha'],setVisible:['visible'],setOrigin:['originX','originY'],setTexture:['textureKey']}))o[method]=(...args:any[])=>{fields.forEach((f,i)=>o[f]=args[i]);return o;};
 return o;
}
function setup(person=true,sourceY=200,visible=true,surfaceDepth?:()=>number,projection=true){
 const settings={time:480,indoor:false,floor:2};
 const scene:any={textures:{exists:()=>true},events:{on:vi.fn(),once:vi.fn()},data:{set:vi.fn(),get:()=>()=>settings},
  cameras:{main:{worldView:{x:-1000,y:-1000,right:2000,bottom:2000}}},children:{depthSort:vi.fn()},
  add:{image:vi.fn(()=>object()),mesh2d:vi.fn((_x,_y,_key,vertices,indices)=>Object.assign(object(),{vertices,indices}))}};
 const source=Object.assign(object(100,sourceY),{frame:{x:0,y:0,cutWidth:128,cutHeight:128,u0:0,v0:0,u1:1,v1:1,sourceIndex:0},texture:{key:'人物'},displayOriginX:64,displayOriginY:124,flipX:false});
 const contact=object(100,200);contact.alpha=.22;
 const view=new GroundShadows(scene as Phaser.Scene);view.add(source,contact,{person,visible:()=>visible,surfaceDepth,projection});view.draw();
 return {view,source,contact,scene,entry:view.entries.get(source)!};
}
describe('全部人物接地表现',()=>{
 it('接触影与投影从真实脚根出发，消除向下六像素的断层',()=>{
  const {entry,source,contact}=setup();expect([entry.soft.x,entry.soft.y,entry.cast!.x,entry.cast!.y]).toEqual([100,200,100,200]);
  expect([entry.soft.displayWidth,entry.soft.displayHeight,entry.soft.rotation]).toEqual([34,8,0]);
  expect([source.x,source.y,contact.depth]).toEqual([100,200,200]);expect(contact.setFillStyle).toHaveBeenCalledWith();
 });
 it('非人物柔影收在脚根附近，不再形成向下偏离的宽云团',()=>{
  const {entry}=setup(false);expect(entry.soft.y).toBe(203);expect(entry.soft.displayWidth).toBeCloseTo(52*1.15);expect(entry.soft.displayHeight).toBeCloseTo(17*.8);expect(entry.soft.rotation).toBe(0);expect(entry.cast!.y).toBe(203);
 });
 it('默认及显式禁用立面投影仍保留接触影，不分配剪影网格',()=>{
  const {view,source,entry,scene}=setup(false,200,true,undefined,false);
  for(let i=0;i<100;i++)view.draw();
  expect(entry.soft.visible).toBe(true);expect(entry.soft.alpha).toBeGreaterThan(0);
  expect(entry.cast).toBeUndefined();expect(scene.add.mesh2d).not.toHaveBeenCalled();
  expect([source.x,source.y]).toEqual([100,200]);
  const another=Object.assign(object(300,200),{texture:{key:'人物'},frame:source.frame});
  view.add(another,object(300,200),{person:true});view.draw();
  expect(view.entries.get(another)!.cast).toBeUndefined();expect(scene.add.mesh2d).not.toHaveBeenCalled();
  view.entries.get(another)!.cleanup();
  entry.cleanup();expect(view.entries.size).toBe(0);expect(entry.soft.destroy).toHaveBeenCalledTimes(1);
 });
 it('飞行人物保持地面影和空中身体分离，投影随真实高度偏移',()=>{
  const normal=setup(),flying=setup(true,120);flying.contact.scaleX=flying.contact.scaleY=.4;flying.view.draw();
  expect(flying.source.y).toBe(120);expect(flying.entry.soft.y).toBe(200);expect(flying.entry.soft.displayHeight).toBeCloseTo(3.2);
  expect(flying.entry.cast!.vertices[0]-normal.entry.cast!.vertices[0]).toBeCloseTo(38.4);
  expect(flying.entry.cast!.vertices[1]-normal.entry.cast!.vertices[1]).toBeCloseTo(21.6);
 });
 it('卧床不留地面残影，墙顶影使用所在踏面深度',()=>{
  const sleeping=setup(true,140,false);expect(sleeping.entry.soft.visible).toBe(false);expect(sleeping.entry.cast!.visible).toBe(false);
  const tower=setup(true,120,true,()=>199);expect(tower.entry.soft.depth).toBeCloseTo(199.01);expect(tower.entry.cast!.depth).toBe(199);
 });
 it('换帧复用同一组阴影对象，不逐帧增加画布或透明图形',()=>{
  const {view,source,scene,entry}=setup();for(let i=0;i<100;i++){source.frame.sourceIndex=i%2;source.flipX=!!(i%2);view.draw();}
  expect(scene.add.image).toHaveBeenCalledTimes(1);expect(scene.add.mesh2d).toHaveBeenCalledTimes(1);expect(entry.cast!.indices[3]).toBe(1);expect(view.entries.size).toBe(1);
  entry.cleanup();expect(view.entries.size).toBe(0);expect(entry.soft.destroy).toHaveBeenCalledTimes(1);
 });
 it('侧身和攻击帧接触影跟随实际鞋底，镜像只反转横向偏移',()=>{
  const {view,source,entry}=setup();source.texture.key='city-complete-guard-actions-v2';source.frame.name=7;source.displayWidth=source.displayHeight=100;
  view.draw();const sole=citySoleContact(source.texture.key,7,100,100)!;expect(sole.x).toBeLessThan(-15);expect(entry.soft.x).toBeCloseTo(100+sole.x);
  source.flipX=true;view.draw();expect(entry.soft.x).toBeCloseTo(100-sole.x);expect(entry.soft.y).toBeCloseTo(200+sole.y);expect(source.x).toBe(100);
 });
 it('风语城所有职业和工作／守卫动作共160帧鞋底紧贴既有脚根',async()=>{
  const folder='public/assets/windwhisper-city/completion';let count=0;
  for(const name of (await readdir(folder)).filter(n=>n.endsWith('-walk.webp')||['guard-actions-v2.webp','citizen-actions-v2.webp'].includes(n))){
   const {data,info}=await sharp(`${folder}/${name}`).ensureAlpha().raw().toBuffer({resolveWithObject:true});const columns=info.width/256;
   for(let f=0;f<columns*info.height/256;f++){let bottom=0;const alpha=(x:number,y:number)=>data[((Math.floor(f/columns)*256+y)*info.width+f%columns*256+x)*4+3];
    for(let y=200;y<256;y++)for(let x=0;x<256;x++)if(alpha(x,y)>=200)bottom=y+1;
    expect(Math.abs(bottom-256*.94)*100/256,`${name} 第${f+1}帧鞋底离地`).toBeLessThan(.5);
    let left=256,right=-1;for(let y=bottom-3;y<bottom;y++)for(let x=0;x<256;x++)if(alpha(x,y)>=200){left=Math.min(left,x);right=Math.max(right,x);}
    const sole=citySoleContact(`city-complete-${name.slice(0,-5)}`,f,100,100)!;
    expect(sole.x,`${name} 第${f+1}帧鞋底横向错位`).toBeCloseTo(((left+right+1)/512-.5)*100);
    expect(sole.width).toBeCloseTo((right+1-left)*100/256+8);count++;}
  }
  expect(count).toBe(160);
 });
 it('旧村庄站立与职业动作按124脚底对齐，排除透明边距',async()=>{
  for(const id of ['elder','healer','carpenter'])for(const file of [`public/assets/${id}.png`,`public/assets/npc-life/${id}-work.png`]){
   const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   for(let f=0;f<info.width/128;f++){let bottom=0;for(let y=0;y<128;y++)for(let x=32;x<96;x++)if(data[(y*info.width+f*128+x)*4+3]>=200)bottom=y+1;
    expect(Math.abs(bottom-124)*92/128,`${file} 第${f+1}帧脚底`).toBeLessThanOrEqual(1);}
  }
 });
});
