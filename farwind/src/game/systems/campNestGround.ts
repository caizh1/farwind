import {CAMP_NESTS,CAMP_NEST_GROUND} from '../../data/campNests';
import {ENCOUNTERS} from '../../data/maps/windbell/encounters';
import {ellipseDistance,featherCoverage,terrainJitter} from './terrainBlend';
import type {State} from './state';

export const campNestGroundAreas=ENCOUNTERS.filter(d=>d.kind==='camp').map(d=>{
  const material=CAMP_NEST_GROUND[d.direction],x=d.x,y=d.y-CAMP_NESTS[d.direction].lift-10;
  // 轮廓最大起伏约24，包围盒包含整条羽化带，跨块采样不裁掉外侧过渡。
  const pad=material.feather+26;
  return {...material,id:d.id,direction:d.direction,x,y,bounds:{left:x-material.rx-pad,right:x+material.rx+pad,top:y-material.ry-pad,bottom:y+material.ry+pad}};
});

export function campNestGroundCleared(area:typeof campNestGroundAreas[number],state:Pick<State,'encounters'|'windMemory'>) {
  const memory=state.windMemory.active;
  const encounters=memory?.direction===area.direction?memory.encounters:state.encounters;
  return encounters.groups[area.id].cleared;
}

export function campNestGroundCoverage(x:number,y:number,area:typeof campNestGroundAreas[number]) {
  const dx=x-area.x,dy=y-area.y;
  const edge=terrainJitter(x,y)*2+Math.sin(dx/47+dy/61)*10+Math.sin(dx/23-dy/37)*5;
  return featherCoverage(ellipseDistance(x,y,area)+edge,area.feather);
}
