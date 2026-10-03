import {describe,it,expect} from 'vitest';
import {enemyShadowSize,bakedShadowProp,dynamicShadowProp,projectShadowPoint,shadowStrength} from '../src/game/rendering/shadowGeometry';
import {ENEMIES} from '../src/data/enemies';
import {props,mapGeometryRevision} from '../src/data/world';

describe('实体阴影的几何与覆盖边界',()=>{
  it('十四种小怪均露出原45像素占地，四足怪占地更宽，首领保持有界比例',()=>{
    for(const kind of Object.keys(ENEMIES)){const [w,h]=enemyShadowSize(kind);expect(w).toBeGreaterThan(45);expect(h).toBeGreaterThan(15);expect(w).toBeLessThanOrEqual(160);}
    expect(enemyShadowSize('wolf')[0]).toBeGreaterThan(enemyShadowSize('shade')[0]);
    for(const h of [210,220,240,250]){const [w,depth]=enemyShadowSize('boar',h);expect(w).toBeLessThan(h);expect(depth).toBeLessThan(50);}
  });
  it('采集物、宝箱、可移除障碍、据点有动态影；静态投影互斥，不污染碰撞数据',()=>{
    const before=JSON.stringify(props),revision=mapGeometryRevision;
    for(const p of props){expect(bakedShadowProp(p)&&dynamicShadowProp(p)).toBe(false);if(['resource','chest','stone','shortcut'].includes(p.kind??''))expect(dynamicShadowProp(p)).toBe(true);if(p.kind==='npc'||p.id.includes('seedbed'))expect(dynamicShadowProp(p)).toBe(false);}
    for(const id of ['west-gate-barrier','south-camp-root','legacy-wind-seal','echo-stone-west','echo-stone-east','echo-stone-south'])expect(dynamicShadowProp(props.find(p=>p.id===id)!)).toBe(true);
    expect(JSON.stringify(props)).toBe(before);expect(mapGeometryRevision).toBe(revision);
  });
  it('镜像不改变光照方向，四方向共用同一脚根；倒地旋转仍按同一投影矩阵',()=>{
    for(const flip of [false,true]){const root=projectShadowPoint(0,0,flip);expect(root.x).toBeCloseTo(0);expect(root.y).toBeCloseTo(0);const top=projectShadowPoint(0,-100,flip);expect(top).toEqual({x:48,y:27});}
    expect(projectShadowPoint(20,-100,true).x).toBe(28);
    const fallen=projectShadowPoint(0,-100,false,Math.PI/2);expect(fallen.x).toBeCloseTo(100);expect(fallen.y).toBeCloseTo(0);
  });
  it('夜间弱化长投影并保留接地感，跨午夜连续，室内不随世界时间变化',()=>{
    expect(shadowStrength(480).contact).toBeGreaterThan(shadowStrength(1260).contact);
    expect(shadowStrength(480).cast).toBeGreaterThan(shadowStrength(1260).cast);
    expect(shadowStrength(1260).contact).toBeGreaterThanOrEqual(.5);
    expect(shadowStrength(1439.99)).toEqual(shadowStrength(1440.01));
    expect(shadowStrength(480,true)).toEqual(shadowStrength(1260,true));
  });
});
