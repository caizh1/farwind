import {describe,it,expect} from 'vitest';
import {CITY_FORTRESS,FORTRESS_ARCHERS,fortressHeight,fortressGuardDepth,fortressFrontY,fortressParapetY} from '../src/data/cityFortress';
import {makeCityFortress} from '../src/game/rendering/cityFortress';
describe('城墙步道遮挡',()=>{
 it('六个岗位整个身体宽度位于后步道与前垛口之间，地面不抬层',()=>{
  for(const g of FORTRESS_ARCHERS){const z=fortressGuardDepth(g.x,g.y,fortressHeight(g.x));
   for(let dx=-32;dx<=32;dx+=4){const x=g.x-CITY_FORTRESS.x+dx;expect(fortressParapetY(x)).toBeDefined();expect(z).toBeGreaterThan(fortressFrontY(x));expect(z).toBeLessThan(fortressFrontY(x)+150);}
   expect(fortressGuardDepth(g.x,g.y,0)).toBe(g.y+2);
  }
 });
 it('实际建筑帧无遗漏地覆盖原图，前后层共边且缓存复用',()=>{
  const textures=new Map<string,Map<string,number[]>>(),images:any[]=[];
  const scene:any={textures:{get:(name:string)=>{if(!textures.has(name))textures.set(name,new Map());const frames=textures.get(name)!;return{has:(key:string)=>frames.has(key),add:(key:string,_source:number,...rect:number[])=>frames.set(key,rect)};}},add:{image:(x:number,y:number,texture:string,key:string)=>{const im:any={x,y,texture,key,setOrigin:()=>im,setDepth:(z:number)=>{im.z=z;return im;},setFlipX:()=>im};images.push(im);return im;}}};
  makeCityFortress(scene);const frames=textures.get('city-fortress-v5')!;
  for(let x=0;x<CITY_FORTRESS.width;x+=4){const parts=[...frames.values()].filter(r=>r[0]===x).sort((a,b)=>a[1]-b[1]);expect(parts[0][1]).toBe(0);expect(parts.reduce((sum,r)=>sum+r[3],0)).toBe(CITY_FORTRESS.height);for(let i=1;i<parts.length;i++)expect(parts[i-1][1]+parts[i-1][3]).toBe(parts[i][1]);}
  const size=frames.size;makeCityFortress(scene);expect(frames.size).toBe(size);
 });
});
