import type {WildernessDirection} from './maps/windbell/encounters';

// 独立地标只改变展示；交互锚点、碰撞、遭遇位置和存档仍取正式地图。
export const CAMP_NESTS = {
  south: {texture:'nest-south',width:360,height:287,lift:55,name:'菌盖腐木巢'},
  west: {texture:'nest-west',width:390,height:253,lift:55,name:'荆棘岩洞'},
  north: {texture:'nest-north',width:380,height:231,lift:55,name:'獠牙土堡'},
  east: {texture:'nest-east',width:370,height:299,lift:55,name:'盘根遗迹'},
} as const satisfies Record<WildernessDirection,{texture:string;width:number;height:number;lift:number;name:string}>;

// 菌土、碎岩、翻掘红土、枯根林土分别从巢口向外过渡；不参与通行几何。
export const CAMP_NEST_GROUND = {
  south:{texture:'nest-ground-south',rx:275,ry:170,feather:70,opacity:.94},
  west:{texture:'nest-ground-west',rx:295,ry:175,feather:65,opacity:.94},
  north:{texture:'nest-ground-north',rx:290,ry:190,feather:75,opacity:.94},
  east:{texture:'nest-ground-east',rx:280,ry:180,feather:70,opacity:.94},
} as const;

export function campNestPresentation(direction: WildernessDirection,cleared:boolean,battle:boolean,covered:boolean) {
  const nest=CAMP_NESTS[direction];
  return {...nest,alpha:battle?.28:covered?.38:cleared?.68:1,tint:cleared?0x929a8b:0xffffff};
}
