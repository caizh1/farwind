import {it,expect} from 'vitest';
import {campNestGroundAreas,campNestGroundCoverage,campNestGroundCleared} from '../src/game/systems/campNestGround';
import {initialState,parseSave} from '../src/game/systems/state';
import {settleEncounterDeath} from '../src/game/systems/encounterState';
import {startWindMemory,endWindMemory} from '../src/game/systems/windMemory';
import {readFileSync} from 'node:fs';
import {CAMP_NESTS} from '../src/data/campNests';
import {props,WATERS,BRIDGES,roads,mapGeometryRevision} from '../src/data/world';

it('四套地表覆盖巢穴脚点，完整过渡带在包围盒内且外侧恢复底图',()=>{
  expect(new Set(campNestGroundAreas.map(a=>a.texture)).size).toBe(4);
  for(const a of campNestGroundAreas){
    expect(campNestGroundCoverage(a.x,a.y,a)).toBe(1);
    const root=props.find(p=>p.art===CAMP_NESTS[a.direction].texture)!;
    expect(campNestGroundCoverage(root.displayAt!.x,root.displayAt!.y,a)).toBe(1);
    const b=a.bounds;
    for(let t=0;t<=1;t+=.05)for(const [x,y]of [[b.left,b.top+t*(b.bottom-b.top)],[b.right,b.top+t*(b.bottom-b.top)],[b.left+t*(b.right-b.left),b.top],[b.left+t*(b.right-b.left),b.bottom]])
      expect(campNestGroundCoverage(x,y,a)).toBe(0);
  }
});

it('边缘逐步淡化而非硬切，过渡带包含至少75个不同强度采样',()=>{
  for(const a of campNestGroundAreas){
    let previous=campNestGroundCoverage(a.x,a.y,a),partial=0;
    for(let dx=0;dx<=a.rx+a.feather+26;dx++){
      const value=campNestGroundCoverage(a.x+dx,a.y,a);
      expect(Math.abs(value-previous)).toBeLessThan(.04);
      if(value>0&&value<1)partial++;previous=value;
    }
    expect(partial).toBeGreaterThan(75);
  }
});

it('地表采样不回写物件、道路、水域、桥面和几何版本',()=>{
  const before=JSON.stringify({props,WATERS,BRIDGES,roads}),revision=mapGeometryRevision;
  for(const a of campNestGroundAreas)for(let dx=-350;dx<=350;dx+=20)for(let dy=-300;dy<=300;dy+=20)campNestGroundCoverage(a.x+dx,a.y+dy,a);
  expect(JSON.stringify({props,WATERS,BRIDGES,roads})).toBe(before);
  expect(mapGeometryRevision).toBe(revision);
});

it('四方向只在正式清剿后净化，驻守清除及首领预警仍保留地表',()=>{
  const state=initialState();
  for(const a of campNestGroundAreas){
    const group=state.encounters.groups[a.id];
    expect(campNestGroundCleared(a,state)).toBe(false);
    for(const m of group.members.slice(0,-1))settleEncounterDeath(state.encounters,m.id,false);
    expect(group.boss!.stage).toBe('warning');
    expect(campNestGroundCleared(a,state)).toBe(false);
    group.boss!.stage='battle';
    expect(settleEncounterDeath(state.encounters,group.members.at(-1)!.id,true)).toBe(true);
    expect(campNestGroundCleared(a,state)).toBe(true);
  }
});

it('真实清剿存档保持净化，风忆只切换当前方向，退出恢复原进度且不写入地表字段',()=>{
  const state=parseSave(readFileSync('docs/combat-v2/evidence/four-camps-exported-save.json','utf8'));
  const original=JSON.stringify(state.encounters);
  for(const a of campNestGroundAreas){
    expect(campNestGroundCleared(a,state)).toBe(true);
    const near={...state,player:{...state.player,x:a.x,y:a.y}};
    const memory=startWindMemory(near,a.direction,17);
    for(const other of campNestGroundAreas)expect(campNestGroundCleared(other,memory)).toBe(other.direction!==a.direction);
    const ended=endWindMemory(memory);
    for(const other of campNestGroundAreas)expect(campNestGroundCleared(other,ended)).toBe(true);
    expect(JSON.stringify(ended.encounters)).toBe(original);
    expect(parseSave(JSON.stringify(ended)).windMemory.active).toBeNull();
  }
});
