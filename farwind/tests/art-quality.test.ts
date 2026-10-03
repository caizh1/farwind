import {describe,it,expect} from 'vitest';
import {appearanceFor,appearanceSeed,buildingDecorations} from '../src/data/worldAppearance';
import {props,BRIDGES,WATERS,roads,mapGeometryRevision} from '../src/data/world';
import {motionBlocked} from '../src/game/systems/obstacles';

describe('材质表现与正式地图隔离',()=>{
  it('查询所有外观与景观后，地图、入口、占地与几何版本完全不变',()=>{
    const before=JSON.stringify({props,BRIDGES,WATERS,roads}),revision=mapGeometryRevision;
    const blocked=props.filter(p=>p.solid).map(p=>motionBlocked(p.x,p.y-3));
    for(const p of props){appearanceFor(p,{width:259,height:392});buildingDecorations(p);}
    expect(JSON.stringify({props,BRIDGES,WATERS,roads})).toBe(before);
    expect(mapGeometryRevision).toBe(revision);
    expect(props.filter(p=>p.solid).map(p=>motionBlocked(p.x,p.y-3))).toEqual(blocked);
  });
  it('塔楼恢复素材比例，绘制尺寸不回写到碰撞数据',()=>{
    const tower=props.find(p=>p.id==='tower')!,a=appearanceFor(tower,{width:259,height:392});
    expect(a.width).toBe(tower.w);expect(a.height/a.width).toBeCloseTo(392/259);
    expect(tower.h).toBe(240);expect(tower.solid).toEqual([160,90]);
  });
  it('重绘喷泉保留原位置和占地，并增加独立低矮景观',()=>{
    const p=props.find(p=>p.id==='plaza-fountain')!,a=appearanceFor(p),decor=buildingDecorations(p);
    // 正式地图在初始化末尾统一把地面交互点的占地设为35×28。
    expect(a.height).toBeGreaterThan(p.h);expect(p.solid).toEqual([35,28]);
    expect([p.x,p.y]).toEqual([680,890]);expect(decor).toHaveLength(8);
    expect(props.some(p=>p.id.startsWith('quality-'))).toBe(false);
    for(const d of decor)expect(Math.hypot(d.x-p.x,d.y-(p.y-12))).toBeLessThanOrEqual(81);
  });
  it('变体由身份稳定决定，横梁与墙体切帧维持原尺寸',()=>{
    for(const p of props.filter(p=>p.art==='bush'))expect(appearanceFor(p)).toEqual(appearanceFor({...p}));
    expect(appearanceSeed('负坐标-花簇')).toBe(appearanceSeed('负坐标-花簇'));
    for(const p of props.filter(p=>p.frame)){const a=appearanceFor(p,{width:100,height:700});expect([a.width,a.height]).toEqual([p.w,p.h]);}
  });
  it('带独立展示点的建筑，装饰跟随画面脚点而不是入口',()=>{
    const p=props.find(p=>p.displayAt)!;
    for(const d of buildingDecorations(p))expect(d.y).toBeLessThan(p.displayAt!.y);
  });
});
