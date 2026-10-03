import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {CAMP_NESTS,campNestPresentation} from '../src/data/campNests';
import {props} from '../src/data/world';
import {appearanceFor} from '../src/data/worldAppearance';
import {ENCOUNTERS} from '../src/data/maps/windbell/encounters';
import {motionBlocked} from '../src/game/systems/obstacles';

it('四处独立巢穴保留正式交互点与无碰撞占地，素材已经落盘',()=>{
  expect(new Set(Object.values(CAMP_NESTS).map(n=>n.texture)).size).toBe(4);
  for(const d of ENCOUNTERS.filter(d=>d.kind==='camp')){
    const p=props.find(p=>p.id===(d.direction==='south'?'south-camp-root':`camp-root-${d.id}`))!,nest=CAMP_NESTS[d.direction];
    expect([p.x,p.y,p.w,p.h,p.kind,p.ground,p.solid]).toEqual([d.x,d.y,180,135,'sign',false,undefined]);
    expect(p.displayAt).toEqual({x:d.x,y:d.y-nest.lift});
    expect(appearanceFor(p)).toMatchObject({texture:nest.texture,width:nest.width,height:nest.height});
    const path=`public/assets/camp-nests/${nest.texture}.webp`;
    expect(readFileSync(path).length).toBeGreaterThan(1000);
  }
});

it('清剿不丢失地标身份，人物遮挡与风忆开战都正确淡化',()=>{
  for(const direction of Object.keys(CAMP_NESTS) as (keyof typeof CAMP_NESTS)[]){
    const original=campNestPresentation(direction,false,false,false),cleared=campNestPresentation(direction,true,false,false),memory=campNestPresentation(direction,false,true,true);
    expect(cleared.texture).toBe(original.texture);expect(cleared.tint).not.toBe(original.tint);
    expect(memory.texture).toBe(original.texture);expect(memory.alpha).toBeLessThan(.35);
    expect(campNestPresentation(direction,false,false,true).alpha).toBeLessThan(.4);
  }
});

it('西侧绕行站位避开树干完整碰撞体',()=>{
  for(const [x,y] of [[-1820,850],[-1880,1700],[-1700,1680]])
    for(const dx of [-6,0,6])for(const dy of [-6,0,6])expect(motionBlocked(x+dx,y+dy)).toBe(false);
});
