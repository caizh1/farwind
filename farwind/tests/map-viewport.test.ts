import {describe,it,expect} from 'vitest';
import {CONTINENT,currentMapArea,minimumScale,maximumScale,fitMap,fitCurrentArea,clampCamera,mapToScreen,screenToMap,zoomMap,panMap} from '../src/game/ui/mapViewport';

describe('连续地图视口',()=>{
 const size={width:1000,height:700};
 it('按真实边界判定原野、商路、城市',()=>{
  expect(currentMapArea({x:4289,y:1600})).toBe('plains');expect(currentMapArea({x:4290,y:1600})).toBe('road');expect(currentMapArea({x:9690,y:1600})).toBe('city');
 });
 it.each([{width:1280,height:720},{width:280,height:270},{width:800,height:450}])('最远倍率容纳整个大陆：%o',size=>{
  const c=fitMap(CONTINENT,size,1),a=mapToScreen({x:CONTINENT.left,y:CONTINENT.top},c,size),b=mapToScreen({x:CONTINENT.left+CONTINENT.width,y:CONTINENT.top+CONTINENT.height},c,size);
  expect(a.x).toBeGreaterThanOrEqual(-1e-8);expect(a.y).toBeGreaterThanOrEqual(-1e-8);expect(b.x).toBeLessThanOrEqual(size.width+1e-8);expect(b.y).toBeLessThanOrEqual(size.height+1e-8);
 });
 it('缩放锚点保持不动，并可逆回原坐标',()=>{
  const c=fitCurrentArea({x:670,y:720},size),anchor={x:320,y:480},before=screenToMap(anchor,c,size),next=zoomMap(c,2,anchor,size),after=screenToMap(anchor,next,size);
  expect(after.x).toBeCloseTo(before.x,8);expect(after.y).toBeCloseTo(before.y,8);expect(mapToScreen(before,next,size)).toEqual(anchor);
 });
 it('极端缩放被限制；最近视野约1000单位宽',()=>{
  const c=fitCurrentArea({x:10000,y:1600},size),anchor={x:500,y:350};
  expect(zoomMap(c,1e8,anchor,size).scale).toBe(maximumScale(size));expect(zoomMap(c,1e-8,anchor,size).scale).toBe(minimumScale(size));expect(size.width/maximumScale(size)).toBe(1000);
 });
 it('默认区域包括在城市外缘的玩家，且不使用室内局部坐标',()=>{
  const player={x:13800,y:3300},c=fitCurrentArea(player,size),p=mapToScreen(player,c,size);
  expect(p.x).toBeGreaterThan(0);expect(p.x).toBeLessThan(size.width);expect(p.y).toBeGreaterThan(0);expect(p.y).toBeLessThan(size.height);
 });
 it('拖动受大陆边界限制，最远层级保持全貌中心',()=>{
  const world=fitMap(CONTINENT,size,1);expect(panMap(world,1e7,-1e7,size)).toEqual(world);
  const c=clampCamera({x:1e8,y:-1e8,scale:1},size);expect(c.x+size.width/2).toBe(CONTINENT.left+CONTINENT.width);expect(c.y-size.height/2).toBe(CONTINENT.top);
 });
});
