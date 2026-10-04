import {afterEach,describe,expect,it,vi} from 'vitest';
import {FOOT,props,propBounds,nearbySolidProps,solidPropAt,syncMapGeometry,type Prop} from '../src/data/world';
import {SHORTCUTS} from '../src/data/maps/windbell/shortcuts';
import {ARENA_STONES} from '../src/data/maps/windbell/elites';
import {propLineBlocker} from '../src/game/systems/obstacles';
import {firstSwordWindBlocker} from '../src/game/systems/swordWindGeometry';
import {advanceEnemyAttack,createEnemyAttack,delayEnemyAttack,predictEnemyContact,type EnemyAttack} from '../src/game/systems/enemyAttack';

afterEach(()=>syncMapGeometry(false));
const rawPoint=(x:number,y:number,ignore?:string)=>props.some(p=>p.id!==ignore&&p.solid&&Math.abs(x-p.x)<p.solid[0]/2+FOOT.halfWidth&&y>p.y-p.solid[1]-FOOT.halfHeight&&y<p.y+FOOT.halfHeight);
const openSpace={blocked:()=>false,clear:()=>true,melee:()=>true};

describe('共享碰撞的空间筛选保持原判定',()=>{
 it('项目物件周围的点、线、剑风与全扫描一致，含窄线和忽略目标',()=>{
  let seed=71;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  for(let i=0;i<2500;i++){
   const p=props[Math.floor(random()*props.length)],a={x:p.x+(random()-.5)*200,y:p.y+(random()-.5)*200},b={x:a.x+(random()-.5)*500,y:a.y+(random()-.5)*500},ignore=i%3===0?p.id:undefined,radius=[0,14,32][i%3];
   expect(solidPropAt(a.x,a.y,ignore)).toBe(rawPoint(a.x,a.y,ignore));
   for(const query of ['motion','melee'] as const)expect(propLineBlocker(a,b,query,ignore)).toBe(propLineBlocker(a,b,query,ignore,props));
   expect(firstSwordWindBlocker(a,b,radius)).toEqual(firstSwordWindBlocker(a,b,radius,props));
  }
 });
 it('开门、捷径、石障和传承封锁改变后即时更新，不缓存旧占地',()=>{
  for(const open of [true,false,true,false]){
   syncMapGeometry(open,open?SHORTCUTS.map(s=>s.id):[],open?ARENA_STONES.map(s=>s.id):[],{wind:open?4:0,blade:open?4:0});
   for(const p of props.filter(p=>p.id==='west-gate-barrier'||p.id.startsWith('barrier-')||p.id.startsWith('legacy-')||ARENA_STONES.some(s=>s.id===p.id))){
    const a={x:p.x-5,y:p.y-5},b={x:p.x+5,y:p.y-5};
    expect(solidPropAt(a.x,a.y),p.id).toBe(rawPoint(a.x,a.y));
    expect(propLineBlocker(a,b,'motion'),p.id).toBe(propLineBlocker(a,b,'motion',undefined,props));
    expect(firstSwordWindBlocker(a,b,14),p.id).toEqual(firstSwordWindBlocker(a,b,14,props));
   }
  }
 });
 it('跨格的脚底与剑风宽度、擦边容差、物件顺序及自定义数组都有效',()=>{
  const fixtures:Prop[]=[{id:'spatial-first',art:'rock',x:3073,y:2050,w:2,h:2,solid:[2,2]},{id:'spatial-second',art:'rock',x:3073,y:2050,w:2,h:2,solid:[2,2]}];
  // 先建立旧索引，再追加物件，验证测试夹具与运行时列表长度变化。
  nearbySolidProps({x:3072,y:2049});props.push(...fixtures);
  try{
   const p=fixtures[0],r=propBounds(p),a={x:r.left-5e-9,y:r.top+1},b={...a};
   expect(nearbySolidProps(a)).toContain(p);
   expect(firstSwordWindBlocker(a,b,0)).toEqual(firstSwordWindBlocker(a,b,0,props));
   // 线段参数容差随长度放大，终点在格界前也不能遗漏相邻格的擦边物件。
   const longStart={x:r.left-128,y:r.top+1},longEnd={x:r.left-5e-7,y:r.top+1};
   expect(nearbySolidProps(longStart,longEnd)).toContain(p);
   expect(firstSwordWindBlocker(longStart,longEnd,0,fixtures)).not.toBeNull();
   expect(firstSwordWindBlocker(longStart,longEnd,0)).toEqual(firstSwordWindBlocker(longStart,longEnd,0,props));
   expect(solidPropAt(r.left-11,r.top+1)).toBe(rawPoint(r.left-11,r.top+1));
   expect(firstSwordWindBlocker({x:r.left-30,y:r.top+1},{x:r.left-30,y:r.top+1},32)).toEqual(firstSwordWindBlocker({x:r.left-30,y:r.top+1},{x:r.left-30,y:r.top+1},32,props));
   expect(propLineBlocker({x:r.left-1,y:r.top+1},{x:r.right+1,y:r.top+1},'melee',undefined,fixtures)).toBe(p.id);
   expect(propLineBlocker(a,b,'melee',undefined,[])).toBeUndefined();
   expect(nearbySolidProps(a).filter(v=>fixtures.includes(v))).toEqual(fixtures);
  }finally{props.splice(props.length-fixtures.length,fixtures.length);}
  expect(nearbySolidProps({x:3073,y:2049})).not.toContain(fixtures[0]);
 });
 it('大跨度、非有限与非安全格坐标回退，不产生无界循环',()=>{
  for(const [a,b] of [[{x:-10000,y:-10000},{x:11000,y:6000}],[{x:Infinity,y:0},{x:0,y:0}],[{x:1e20,y:1e20},{x:1e20,y:1e20}]])expect(nearbySolidProps(a,b)).toBe(props);
 });
});

describe('风步拉开后的近战预测',()=>{
 it('范围外直接返回，边缘冲刺接触仍使用原精确裁决',()=>{
  const root={x:0,y:0},a=createEnemyAttack('范围测试',1,'slime',0,root,{x:100,y:0}),blocked=vi.fn(()=>false),space={...openSpace,blocked};
  a.locked=true;expect(predictEnemyContact(a,root,{x:74.001,y:0},100,space)).toBeNull();expect(blocked).not.toHaveBeenCalled();
  expect(predictEnemyContact(a,root,{x:74,y:0},100,space)).not.toBeNull();expect(blocked).toHaveBeenCalled();
 });
 it('八类近战、精英步长、锁向、中途移动和受击延迟与完整扫描一致',()=>{
  for(const type of ['slime','leaf','wolf','boar','raven','burrow','guardian','shade'])for(const elite of [undefined,'alpha','ram'] as const)for(const distance of [0,40,74,74.0001,160,260,360])for(const angle of [0,.7,Math.PI])for(const locked of [true,false]){
   const root={x:0,y:0},target={x:Math.cos(angle)*distance,y:Math.sin(angle)*distance},a=createEnemyAttack('精确对照',1,type,0,root,target,undefined,elite);a.direction={x:1,y:0};a.locked=locked;
   const now=locked?a.contactAt+30:100;
   if(locked){const moved={...a,direction:{...a.direction},emitted:true};advanceEnemyAttack(moved,root,target,now,openSpace);a.motionAt=moved.motionAt;a.scanAt=moved.scanAt;}
   const before=structuredClone(a),copy=structuredClone(a);delayEnemyAttack(copy,50);
   const full=advanceEnemyAttack(copy,{...root},target,copy.activeUntil,openSpace)?.at??null;
   expect(predictEnemyContact(a,root,target,now,openSpace,50)).toBe(full);expect(a).toEqual(before);
  }
 });
 it('首领特殊几何不使用普通近战排除',()=>{
  const a=createEnemyAttack('首领',1,'wolf',0,{x:0,y:0},{x:500,y:0});Object.assign(a,{boss:'thorn-crown',bossGeometry:{kind:'sector',point:{x:500,y:0},radius:600,halfAngle:Math.PI}} as Partial<EnemyAttack>);
  const copy=structuredClone(a),target={x:500,y:0};expect(predictEnemyContact(a,{x:0,y:0},target,100,openSpace)).toBe(advanceEnemyAttack(copy,{x:0,y:0},target,copy.activeUntil,openSpace)?.at??null);
 });
 it('预测沿用未锁向时的新瞄准，并保守处理非单位锁向',()=>{
  for(const locked of [true,false])for(const scale of [0,.1,1.001,2])for(const distance of [40,74,74.04,120]){
   const root={x:0,y:0},target={x:distance,y:0},a=createEnemyAttack('方向边界',1,'slime',0,root,target);a.direction={x:scale,y:0};a.locked=locked;
   const copy=structuredClone(a);expect(predictEnemyContact(a,root,target,100,openSpace)).toBe(advanceEnemyAttack(copy,{...root},target,copy.activeUntil,openSpace)?.at??null);
  }
 });
});
