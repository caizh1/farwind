import {describe,it,expect} from 'vitest';
import {WORLD_MAP_EXTENT,WORLD_PLAN_REGIONS,WORLD_PLAN_CONNECTIONS} from '../src/data/worldPlan';
import {WORLD_BOUNDS,WIND_BELL_BOUNDS,CURRENT_MAP_VERSION} from '../src/data/maps/windbell/bounds';
import {CONTINENT,MAP_AREAS,fitMap,mapToScreen} from '../src/game/ui/mapViewport';

describe('初始世界蓝图与已有旅途的对应关系',()=>{
 const region=(id:string)=>WORLD_PLAN_REGIONS.find(r=>r.id===id)!;
 it('翡翠森林独立保留，不用原野的开放状态冒充完整森林',()=>{
  expect(region('emerald').name).toBe('翡翠森林');expect(region('emerald').status).toBe('暂未开放');
  expect(region('forest').status).toBe('已开放');expect(region('forest').bounds).toEqual(WIND_BELL_BOUNDS);
  expect(region('road').bounds).toEqual(MAP_AREAS.road.bounds);expect(region('city').bounds).toEqual(MAP_AREAS.city.bounds);
 });
 it('恢复中央城市、西部森林和东南悬浮群岛，全部标记在展示范围内',()=>{
  expect(CONTINENT).toBe(WORLD_MAP_EXTENT);
  const p=mapToScreen(region('city').point,fitMap(CONTINENT,{width:1400,height:1000},1),{width:1400,height:1000});
  expect(Math.abs(p.x-700)).toBeLessThan(25);expect(Math.abs(p.y-500)).toBeLessThan(45);
  expect(region('emerald').point.x).toBeLessThan(region('forest').point.x);
  expect(region('mountains').point.y).toBeLessThan(region('city').point.y);
  expect(region('lake').point.x).toBeGreaterThan(region('city').point.x);
  expect(region('islands').biome).toBe('悬浮岛与云海');
  for(const r of WORLD_PLAN_REGIONS){
   expect(r.bounds.left).toBeGreaterThanOrEqual(CONTINENT.left);expect(r.bounds.top).toBeGreaterThanOrEqual(CONTINENT.top);
   expect(r.bounds.left+r.bounds.width).toBeLessThanOrEqual(CONTINENT.left+CONTINENT.width);
   expect(r.bounds.top+r.bounds.height).toBeLessThanOrEqual(CONTINENT.top+CONTINENT.height);
  }
 });
 it('连接蓝图引用真实区域，已有步行链保持原野到商路再到城市',()=>{
  const ids=WORLD_PLAN_REGIONS.map(r=>r.id);expect(new Set(ids).size).toBe(ids.length);
  for(const [a,b] of WORLD_PLAN_CONNECTIONS){expect(ids).toContain(a);expect(ids).toContain(b);}
  expect(WORLD_PLAN_CONNECTIONS).toContainEqual(['forest','road']);expect(WORLD_PLAN_CONNECTIONS).toContainEqual(['road','city']);
 });
 it('地图展示扩展不改变移动边界或地图存档版本',()=>{
  expect(WORLD_BOUNDS).toEqual({left:-2110,top:-1380,right:13890,bottom:3420,width:16000,height:4800});expect(CURRENT_MAP_VERSION).toBe(9);
  expect(WORLD_PLAN_REGIONS.filter(r=>r.status==='已开放').map(r=>r.id)).toEqual(['forest','road','city']);
  expect(WORLD_PLAN_REGIONS.filter(r=>r.status==='部分开放').map(r=>r.id)).toEqual([]);
 });
});
