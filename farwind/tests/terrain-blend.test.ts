import {describe,it,expect} from 'vitest';
import {featherCoverage,terrainJitter,terrainSegments,strokeCoverage,ellipseDistance,polygonDistance} from '../src/game/systems/terrainBlend';
import {ROAD_DEFINITIONS} from '../src/data/maps/windbell/roads';
import {WILD_WATERS} from '../src/data/maps/windbell/wilderness';

describe('全图地形过渡',()=>{
  it('边缘连续渐变，主体材质完全覆盖，外侧保留底图',()=>{
    expect([-20,-10,0,10,20].map(d=>featherCoverage(d,20))).toEqual([0,.15625,.5,.84375,1]);
    for(let d=-20;d<20;d+=.5)expect(featherCoverage(d+.5,20)-featherCoverage(d,20)).toBeLessThan(.02);
  });
  it('所有正式路段中心与最窄道路均保持可辨认路面',()=>{
    for(const road of ROAD_DEFINITIONS){
      const segments=terrainSegments(road.points,road.width);
      for(const s of segments)expect(strokeCoverage(s.x+s.dx/2,s.y+s.dy/2,segments,14),road.id).toBe(1);
    }
  });
  it('交叉路口取并集，圆角与端点不会出现透明缝',()=>{
    const s=[...terrainSegments([[-100,0],[100,0]],65),...terrainSegments([[0,-100],[0,100]],65)];
    for(let y=-12;y<=12;y+=4)for(let x=-12;x<=12;x+=4)expect(strokeCoverage(x,y,s,14)).toBe(1);
    for(let y=-40;y<=40;y+=8)for(let x=-40;x<=40;x+=8)expect(strokeCoverage(x,y,s,14)).toBe(Math.max(strokeCoverage(x,y,s.slice(0,1),14),strokeCoverage(x,y,s.slice(1),14)));
    expect(strokeCoverage(0,100,s,14)).toBe(1);
    expect(strokeCoverage(0,160,s,14)).toBe(0);
  });
  it('零长度路段与负世界坐标不会产生非数值',()=>{
    const s=terrainSegments([[-2110,-1380],[-2110,-1380]],65);
    expect(strokeCoverage(-2110,-1380,s,14)).toBe(1);
    expect(strokeCoverage(-2200,-1380,s,14)).toBe(0);
    expect(terrainJitter(-2110,-1380)).toBe(terrainJitter(-2110,-1380));
  });
  it('四处水塘的实际边界与浅水过渡保持同一中心',()=>{
    for(const p of WILD_WATERS){
      expect(ellipseDistance(p.x,p.y,p)).toBeGreaterThan(0);
      expect(ellipseDistance(p.x+p.rx,p.y,p)).toBeCloseTo(0,8);
      expect(ellipseDistance(p.x,p.y+p.ry,p)).toBeCloseTo(0,8);
      expect(ellipseDistance(p.x+p.rx+40,p.y,p)).toBeCloseTo(-40,8);
    }
  });
  it('土地区内外及角落的符号距离正确',()=>{
    const edges=terrainSegments([[0,0],[100,0],[100,100],[0,100],[0,0]],0);
    expect(polygonDistance(50,50,edges)).toBe(50);
    expect(polygonDistance(-10,50,edges)).toBe(-10);
    expect(polygonDistance(0,50,edges)).toBe(0);
    expect(polygonDistance(-10,-10,edges)).toBeCloseTo(-Math.sqrt(200));
  });
});
