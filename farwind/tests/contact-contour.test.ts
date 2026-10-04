import {describe,it,expect} from 'vitest';
import {contactContours} from '../src/game/rendering/contactContour';
import {bakedShadowProp,dynamicShadowProp} from '../src/game/rendering/shadowGeometry';
import {CITY_BUILDINGS,cityFurniture} from '../src/data/cityLayout';
import {spaceBlocked} from '../src/game/systems/npcNavigation';
import {props} from '../src/data/world';
import sharp from 'sharp';

describe('物件接地轮廓',()=>{
 it('两个桌脚之间保持空隙，不在悬空桌板下画接触影',()=>{
  const alpha=new Uint8Array(20*100);
  for(let x=2;x<=17;x++)alpha[60*20+x]=255;
  for(const start of [2,15])for(let y=60;y<100;y++)for(let x=start;x<start+3;x++)alpha[y*20+x]=255;
  const paths=contactContours(alpha,20,100).paths;
  expect(paths).toHaveLength(2);expect(paths.map(p=>p.length)).toEqual([3,3]);
  expect(paths.every(p=>p.every(([,y])=>y>.98))).toBe(true);
 });
 it('淡烘焙投影不拉低真实基座落地点',()=>{
  const alpha=new Uint8Array(12*100);
  for(let x=2;x<10;x++){alpha[87*12+x]=255;for(let y=88;y<100;y++)alpha[y*12+x]=100;}
  const paths=contactContours(alpha,12,100).paths;
  expect(paths).toHaveLength(1);expect(paths[0].every(([,y])=>y===.875)).toBe(true);
 });
 it('透明素材和高处悬挂部分不生成地面暗边',()=>{
  const alpha=new Uint8Array(12*100);for(let x=2;x<10;x++)alpha[50*12+x]=255;
  expect(contactContours(alpha,12,100).paths).toEqual([]);
 });
 it('静态落地物可无碰撞体，任务可变货箱与摊位不能留下烘焙残影',()=>{
  const p={id:'city-closed-north',art:'city-complete-room-door',x:1,y:1,w:85,h:90};
  expect(bakedShadowProp(p)).toBe(true);expect(dynamicShadowProp(p)).toBe(false);
  expect(bakedShadowProp({...p,kind:'npc'})).toBe(false);
  expect(bakedShadowProp({...p,ground:true})).toBe(false);
  for(const id of ['city-cargo','city-stall-fruit']){expect(bakedShadowProp({...p,id})).toBe(false);expect(dynamicShadowProp({...p,id})).toBe(true);}
 });
 it('墙灯和城徽挂在后墙，不产生脚下碰撞，仍能靠近查看',()=>{
  for(const b of CITY_BUILDINGS)for(const f of cityFurniture(b.space).filter(f=>f.mounted)){
   expect(f.y).toBeLessThanOrEqual(515);expect(f.solid).toBeUndefined();
   expect(spaceBlocked(b.space,f.x,f.y+25)).toBe(false);
  }
 });
 it('正式在用落地素材都能辨认实体接触轮廓',async()=>{
  const ids=new Set(props.filter(p=>p.art.startsWith('city-complete-')).map(p=>p.art.slice(14)));
  for(const b of CITY_BUILDINGS)for(const f of cityFurniture(b.space))if(!f.mounted)ids.add(f.art);
  for(const id of ['repaired-valve','room-wall-back','underground-wall','room-open-door'])ids.add(id);
  for(const id of ids){
   const input=`public/assets/windwhisper-city/completion/${id}.webp`,m=await sharp(input).metadata();
   const height=Math.max(32,Math.min(192,Math.round(128*m.height!/m.width!)));
   const {data}=await sharp(input).resize(128,height,{fit:'fill'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   const alpha=new Uint8Array(128*height);for(let i=0;i<alpha.length;i++)alpha[i]=data[i*4+3];
   expect(contactContours(alpha,128,height).paths.length,`${id} 缺少实体落地边缘`).toBeGreaterThan(0);
  }
 });
});
