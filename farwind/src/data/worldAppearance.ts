import type {Prop} from './world';
import {VILLAGE_HOUSE_ART} from './villageHouseArt';
import {CAMP_NESTS} from './campNests';

// 只描述表现，不写入占地、入口、寻路或存档。随机变化始终由世界身份决定。
export const ART_QUALITY = {
  version: 1,
  groundScale: {grass: .5, forest: .5, road: .21},
  shadow: {x: .48, y: .27, building: .26, tree: .28, contact: .32},
  decorations: ['flowers-white','flowers-gold','flowers-pink','shrub-one','shrub-two','shrub-three'],
} as const;
export function appearanceSeed(value: string) {
  let seed=2166136261;
  for(const letter of value)seed=Math.imul(seed^letter.charCodeAt(0),16777619)>>>0;
  return seed;
}
export function appearanceFor(p: Prop, natural?: {width:number;height:number}) {
  const seed=appearanceSeed(p.id),building=!!VILLAGE_HOUSE_ART[p.id]||['house','shop','tower','smith-building','inn-building'].includes(p.art);
  let width=p.w,height=p.h,texture=VILLAGE_HOUSE_ART[p.id]??p.art;
  if(building&&natural?.width&&natural.height)
    height=Math.max(p.h*.88,Math.min(p.h*1.28,p.w*natural.height/natural.width));
  if(p.art==='bush'){
    texture=`quality-shrub-${['one','two','three'][seed%3]}`;
    width=p.w*(.92+(seed%9)*.02);height=p.h*(.9+(seed%7)*.035);
  }
  if(p.id==='plaza-fountain'){width=140;height=168;}
  const nest=Object.values(CAMP_NESTS).find(n=>n.texture===p.art);
  if(nest){width=nest.width;height=nest.height;}
  return {texture,width,height,building,seed};
}

export type GroundDecoration={x:number;y:number;width:number;height:number;texture:string;flip:boolean};
// 装饰是独立的低矮表现数据；不能加入逻辑props，否则会影响几何版本和存档。
export function buildingDecorations(p: Prop): GroundDecoration[] {
  if(!VILLAGE_HOUSE_ART[p.id]&&!['tower','well','fountain'].includes(p.art))return [];
  const seed=appearanceSeed(p.id),foot=p.solid?.[0]??p.w*.65,point=p.displayAt??p;
  if(p.art==='fountain')return [.15,.65,1.1,1.85,2.45,2.9,3.7,5.6].map((angle,i)=>({
    x:point.x+Math.cos(angle)*80,y:point.y-12+Math.sin(angle)*29,
    width:39+(seed+i)%10,height:24+(seed+i)%7,
    texture:`quality-${ART_QUALITY.decorations[(seed+i)%3]}`,flip:!!(i%2),
  }));
  return [-1,1].flatMap((side,index)=>[0,1].map(n=>({
    x:point.x+side*(foot*.48+13+n*18),y:point.y-7-n*15,
    width:35+(seed+index+n)%16,height:22+(seed+index+n)%9,
    texture:`quality-${ART_QUALITY.decorations[(seed+index+n)%3]}`,flip:side<0,
  })));
}
