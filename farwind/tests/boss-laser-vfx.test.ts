import {describe,it,expect} from 'vitest';
import {BossLaserVfx} from '../src/game/entities/bossLaserVfx';
import {BOSS_LASER} from '../src/game/systems/bossLaser';
import {shiftBossHazard,type BossHazard} from '../src/game/systems/campBossState';

function renderer(){
 const images:any[]=[],frames=new Set<string>();
 const scene={textures:{exists:()=>true,get:()=>({source:[{width:1448,height:1086}],has:(key:string)=>frames.has(key),add:(key:string)=>frames.add(key)})},add:{image:()=>{const values:any={};let image:any;image=new Proxy({}, {get:(_,key)=>(...args:any[])=>{values[String(key)]=args;return image;}});images.push(values);return image;}}};
 let ink:any;const commands:any[]=[];ink=new Proxy({}, {get:(_,key)=>key==='depth'?1:(...args:any[])=>{commands.push([key,...args]);return ink;}});
 const vfx=new BossLaserVfx(scene as any),h:BossHazard={id:'激光分镜',owner:'boss-bound-branch',attempt:0,kind:'ring',point:{x:300,y:400},born:0,activeAt:1200,expires:6350,radius:230,speed:0,damage:22,used:[],laser:{count:BOSS_LASER.count,angle:.5}};
 const draw=(hazard:BossHazard,now:number)=>{vfx.begin();commands.length=0;vfx.ground(hazard,now,ink);vfx.core({x:300,y:240},now-hazard.born,1,1,400);return structuredClone({素材:images.filter(v=>v.setVisible?.[0]),地面:commands});};
 return {vfx,h,draw,images};
}
describe('赤环美术素材生命周期',()=>{
 it('完整招式反复播放复用素材对象；停止绘制立即隐藏所有旧素材',()=>{
  const r=renderer();for(let loop=0;loop<3;loop++)for(let now=0;now<6350;now+=16)r.draw(r.h,now);
  expect(r.images.length).toBeLessThanOrEqual(64);expect(r.images.length).toBeGreaterThan(20);const count=r.images.length;r.vfx.begin();expect(r.images.every(v=>v.setVisible[0]===false)).toBe(true);expect(r.vfx.snapshot().visible).toBe(0);r.draw(r.h,1400);expect(r.images.length).toBe(count);
 });
 it('暂停和相对时钟读档恢复一致，不随机改写图案或战斗数据',()=>{
  const r=renderer(),before=structuredClone(r.h);
  for(const now of [1400,2650,3850,4600,6000]){const frame=r.draw(r.h,now);expect(r.draw(r.h,now)).toEqual(frame);const reloadAt=300000,restored=shiftBossHazard(shiftBossHazard(r.h,-now),reloadAt);expect(r.draw(restored,reloadAt)).toEqual(frame);}
  expect(r.h).toEqual(before);
 });
 it('只在第二段使用升起爆裂素材，提前结束不会残留上一阶段光束',()=>{
  const r=renderer(),frames=(now:number)=>r.draw(r.h,now).素材.map((v:any)=>v.setTexture[1]);expect(frames(1400)).toContain('beam');expect(frames(1400).some(v=>v.startsWith('burst-'))).toBe(false);expect(frames(2650)).toContain('scar');expect(frames(4600).some(v=>v.startsWith('burst-'))).toBe(true);expect(frames(6000).some(v=>v.startsWith('burst-'))).toBe(false);
 });
 it('同一地面落点经历十二个不同火焰形态，不随光头转圈移动',()=>{
  const r=renderer(),poses=[];for(const age of [0,15,25,37,50,65,90,110,145,190,240,290]){r.draw(r.h,4000+age);poses.push(r.vfx.snapshot().bursts.find(v=>v.site===0)!);}
  expect(poses.map(v=>v.frame)).toEqual(Array.from({length:12},(_,i)=>i));expect(poses.every(v=>v.point.x===poses[0].point.x&&v.point.y===poses[0].point.y)).toBe(true);expect(new Set(poses.map(v=>v.phase))).toEqual(new Set(['起爆','升腾','消散']));
  const frame=r.draw(r.h,4200),flames=frame.素材.filter(v=>v.setTexture[1].startsWith('burst-'));expect(flames.every(v=>v.setRotation[0]===0)).toBe(true);expect(new Set(flames.map(v=>v.setTexture[1])).size).toBeGreaterThan(2);expect(frame.地面.some(v=>v[0]==='fillEllipse')).toBe(true);
 });
});
