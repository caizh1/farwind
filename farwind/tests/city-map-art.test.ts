import {describe,it,expect,vi} from 'vitest';
import sharp from 'sharp';
import {CITY_BUILDINGS,CITY_BUILDING_PROPS} from '../src/data/cityLayout';
import {createMapTerrain} from '../src/game/ui/mapTerrain';
describe('城市地图楼址与素材',()=>{
 it('二十三栋建筑与游戏实体一致；所有可见资产均以非零尺寸进入地图',async()=>{
  expect(CITY_BUILDING_PROPS.map(p=>p.id)).toEqual(CITY_BUILDINGS.map(b=>`city-building-${b.id}`));
  const assets:Record<string,any>={};for(const b of CITY_BUILDINGS){const m=await sharp(`public/assets/windwhisper-city/completion/${b.art}.webp`).metadata();assets[b.art]={image:{id:b.art},width:m.width,height:m.height};}
  const draws:any[]=[];let context:any;context=new Proxy({}, {get:(_,key)=>key==='drawImage'?(image:any,...args:number[])=>{if(image.id)draws.push({id:image.id,args});}:key==='createPattern'?()=>({setTransform(){}}):key==='createRadialGradient'||key==='createLinearGradient'?()=>({addColorStop(){}}):()=>context});
  vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>context})});vi.stubGlobal('DOMMatrix',class {scale(){return this;}});
  try{const map=createMapTerrain({naturalWidth:1024,naturalHeight:768} as HTMLImageElement,{} as HTMLCanvasElement,96,{} as HTMLImageElement,assets);map.draw(context,{x:11690,y:1100,scale:.169},{width:1280,height:600});expect(new Set(draws.map(d=>d.id))).toEqual(new Set(CITY_BUILDINGS.map(b=>b.art)));expect(draws.every(d=>d.args.every(Number.isFinite)&&d.args.at(-1)>0)).toBe(true);}finally{vi.unstubAllGlobals();}
 });
});
