import {enemyProfile} from '../../data/enemies';
import type {Prop} from '../../data/world';
import {ARENA_STONES} from '../../data/maps/windbell/elites';
import cityFeet from '../../data/cityFootContacts.json';

// 高分辨率城民帧按整个身体居中，鞋底在侧身／持盾／拉弓时会偏离中心；只校准接触影。
export function citySoleContact(texture:string,frame:string|number,width:number,height:number,flip=false) {
  const feet=(cityFeet as Record<string,number[][]>)[texture]?.[Number(frame)];
  if(!feet)return undefined;
  const [left,right,bottom]=feet;
  return {x:((left+right)/512-.5)*width*(flip?-1:1),y:(bottom/256-.94)*height,width:(right-left)/256*width+8};
}

// 脚底影必须露出身体边缘；四足和滚兽的横向占地更宽。
export function enemyShadowSize(type:string,height:number=enemyProfile(type).height):[number,number] {
  const wide=['boar','wolf','bomber'].includes(type);
  const width=Math.max(50,height*(height>150?.7:wide?1.5:1.05));
  return [width,Math.max(17,width*.25)];
}

export function bakedShadowProp(p:Prop) {
  if(p.id.startsWith('city-fortress-foot-'))return false;
  if(p.id.startsWith('city-west-wall-')||p.id.startsWith('city-east-wall-')||p.id.startsWith('city-edge-')||p.id.startsWith('city-gate-')||p.id.startsWith('city-corner-')||p.id.startsWith('city-guard-stairs-'))return false;
  if(p.id.startsWith('city-bridge-'))return false;
  if(p.id==='city-cargo'||p.id==='city-stall-fruit')return false;
  // 封闭门等固定城市物件可没有碰撞体；任务可变物件由上面的分支单独管理。
  if(p.art.startsWith('city-complete-')&&p.kind!=='npc'&&p.ground!==true)return true;
  return !['npc','stone','resource','chest','shortcut'].includes(p.kind??'')&&
    !!(p.solid||p.art==='fountain')&&!ARENA_STONES.some(stone=>stone.id===p.id)&&!['barrier','seal','seedbed'].some(word=>p.id.includes(word));
}

export function dynamicShadowProp(p:Prop) {
  if(p.id.startsWith('city-fortress-foot-'))return false;
  if(p.id.startsWith('city-west-wall-')||p.id.startsWith('city-east-wall-')||p.id.startsWith('city-edge-')||p.id.startsWith('city-gate-')||p.id.startsWith('city-corner-')||p.id.startsWith('city-guard-stairs-'))return false;
  return p.kind!=='npc'&&p.ground!==true&&!p.id.includes('seedbed')&&!bakedShadowProp(p);
}

// 统一东南方向；脚根不动，人物镜像只改变轮廓，不反转光源。
export function projectShadowPoint(x:number,y:number,flip=false,rotation=0) {
  x*=flip?-1:1;
  const cos=Math.cos(rotation),sin=Math.sin(rotation),rx=x*cos-y*sin,ry=x*sin+y*cos;
  return {x:rx-ry*.48,y:-ry*.27};
}

export function shadowStrength(time:number,indoor=false) {
  if(indoor)return {contact:.54,cast:.20};
  const minute=((time%1440)+1440)%1440;
  const daylight=Math.max(0,Math.min(1,(minute-330)/150,(1200-minute)/180));
  return {contact:.50+daylight*.16,cast:.12+daylight*.22};
}
