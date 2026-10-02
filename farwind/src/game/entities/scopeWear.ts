import {SCOPE_HEADS} from '../../data/scopeWear';
import type {Facing} from '../systems/locomotion';
export const scopeViews=['front','side','back'] as const;
// 源帧坐标与角色使用同一个缩放、原点和镜像，绝不另加与步态无关的抖动。
export function scopePlacement(texture:string,frame:number,facing:Facing,flip:boolean){
 const sample=SCOPE_HEADS[texture]?.[frame];if(!sample||!sample[2])return null;
 const size=texture==='hero'||texture==='hero-motion'?128:160;
 return {x:(sample[0]-size/2)*(flip?-1:1),y:sample[1],width:sample[2]*.83,view:facing===1?'back':facing>=2?'side':'front',flip:facing===2} as const;
}
