import {describe,it,expect} from 'vitest';
import sharp from 'sharp';
import contacts from '../src/data/enemyFootContacts.json';
import {enemyArt,enemyFootOrigin,enemyFrameBottom} from '../src/data/enemies';

describe('商路怪物脚根与串格',()=>{
 it('站立脚根使用鞋底而非图格底缘，斧尖不能决定原点',()=>{
  expect(enemyFootOrigin('cragAxeman',0)).toBe(127/160);
  expect(enemyFootOrigin('cliffLancer',0)).toBe(151/160);
  expect(enemyFootOrigin('cragAxeman',8)).toBe(121/160);
  for(const kind of ['slime','raven','archer'])expect(enemyFootOrigin(kind,0)).toBe(enemyArt(kind).originY);
  expect(enemyFrameBottom('raven',0)).toBeUndefined();
 });
 it('144帧原点和裁切范围均合法，挥斧时仍保留腾起而非强制落地',()=>{
  for(const kind of ['cragAxeman','cliffLancer','canyonHunter'] as const){expect(contacts[kind]).toHaveLength(48);
   for(let f=0;f<48;f++){expect(enemyFootOrigin(kind,f)).toBeGreaterThan(.5);expect(enemyFootOrigin(kind,f)).toBeLessThanOrEqual(1);expect(enemyFrameBottom(kind,f)).toBeGreaterThan(80);expect(enemyFrameBottom(kind,f)).toBeLessThanOrEqual(160);}
  }
  for(let f=24;f<32;f++)expect(enemyFootOrigin('cragAxeman',f)).toBe(127/160);
 });
 it('原图侧身格确实串入下一行，正式裁切保留主体并排除串格',async()=>{
  const {data,info}=await sharp('public/assets/windwhisper-city/cragAxeman.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const alpha=(x:number,y:number)=>data[((160+y)*info.width+x)*4+3];
  expect(alpha(90,159)).toBeGreaterThanOrEqual(200);
  expect(enemyFrameBottom('cragAxeman',8)).toBe(123);
  let sole=0;for(let y=80;y<123;y++)for(let x=65;x<150;x++)if(alpha(x,y)>=200)sole=Math.max(sole,y+1);
  expect(sole).toBe(121);expect(enemyFootOrigin('cragAxeman',8)*160).toBe(sole);
 });
});
