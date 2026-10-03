import type Phaser from 'phaser';
import {WORLD} from '../../data/world';
import {BOSS_RULES} from '../../data/maps/windbell/campBosses';
import {advanceEnemyAttack,sampleEnemyAttack,geometryTouches,SPORE,type EnemyAttack,type AttackGeometry} from '../systems/enemyAttack';
import {bossHazardGeometry} from '../systems/campBossCombat';
import type {BossHazard} from '../systems/campBossState';
import {clearMeleeLine,type Point} from '../systems/obstacles';

export const WARNING={red:0xff343c,outline:0x2b1724,light:0xfff4ee,floor:WORLD.top-900} as const;
type Shape=AttackGeometry&{outline?:Point[]};
const unit=(n:number)=>Math.max(0,Math.min(1,n));
export const warningProgress=(start:number,contact:number,now:number)=>unit((now-start)/Math.max(1,contact-start));

export function projectileWarning(root:Point,d:Point,length:number):Shape{
  const end=(u:number)=>({x:root.x+d.x*length*u,y:root.y+d.y*length*u});
  let reach=1;
  if(!clearMeleeLine(root,end(1))){let lo=0,hi=1;for(let i=0;i<18;i++){const mid=(lo+hi)/2;if(clearMeleeLine(root,end(mid)))lo=mid;else hi=mid;}reach=lo;}
  return {a:{...root},b:end(reach),radius:SPORE.radius};
}

// 只推进副本，沿用正式冲撞的地形、家园边界与岩柱约束，不改攻击或敌人位置。
export function previewWarning(a:EnemyAttack,root:Point,space?:Parameters<typeof advanceEnemyAttack>[4]):Shape{
  const first=sampleEnemyAttack(a,a.contactAt,root).geometry;
  if(a.boss==='thorn-crown'&&a.bossSkill===1)return {...first,radius:a.bossGeometry!.radius};
  if(a.type==='leaf'&&!a.boss)return {kind:'sector',a:{...root},b:{...root},radius:72,direction:a.direction,halfAngle:.85};
  if((a.step??0)===0&&a.boss||['spore','archer','priest','bell','geomancer'].includes(a.type))return first;
  const copy={...a,direction:{...a.direction},locked:true,emitted:true},end={...root};
  advanceEnemyAttack(copy,end,{x:root.x+a.direction.x,y:root.y+a.direction.y},a.activeUntil,space);
  const last=sampleEnemyAttack(a,a.activeUntil,end).geometry;
  if(!first.kind)return {...first,b:last.b};
  // 窄扇区的直线冲锋：凸包就是沿运动方向扫过的攻击轮廓。
  if(first.kind==='sector'&&(first.halfAngle??Math.PI)<=Math.PI/2&&!a.bossSideStep){
    const points=[...boundary(first),...boundary(last)].sort((a,b)=>a.x-b.x||a.y-b.y);
    const cross=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
    const half=(p:Point[])=>{const hull:Point[]=[];for(const v of p){while(hull.length>1&&cross(hull.at(-2)!,hull.at(-1)!,v)<=0)hull.pop();hull.push(v);}return hull.slice(0,-1);};
    return {...first,b:last.a,outline:[...half(points),...half([...points].reverse())]};
  }
  return first;
}

function boundary(g:AttackGeometry):Point[]{
  if(g.kind==='sector'){
    const angle=Math.atan2(g.direction!.y,g.direction!.x),half=g.halfAngle??Math.PI;
    return [{...g.a},...Array.from({length:33},(_,i)=>({x:g.a.x+Math.cos(angle-half+2*half*i/32)*g.radius,y:g.a.y+Math.sin(angle-half+2*half*i/32)*g.radius}))];
  }
  const angle=Math.atan2(g.b.y-g.a.y,g.b.x-g.a.x),points:Point[]=[];
  for(const [p,base] of [[g.b,angle-Math.PI/2],[g.a,angle+Math.PI/2]] as const)
    for(let i=0;i<=20;i++){const a=base+Math.PI*i/20;points.push({x:p.x+Math.cos(a)*g.radius,y:p.y+Math.sin(a)*g.radius});}
  return points;
}
function path(ink:Phaser.GameObjects.Graphics,points:Point[],close=true){ink.beginPath().moveTo(points[0].x,points[0].y);for(const p of points.slice(1))ink.lineTo(p.x,p.y);if(close)ink.closePath();}
function edge(ink:Phaser.GameObjects.Graphics,draw:()=>void,progress:number){
  const urgent=progress>.75;
  for(const [width,color,alpha] of [[13,WARNING.red,urgent?.25:.16],[8,WARNING.outline,.9],[5.5,WARNING.red,1],[urgent?2:1.5,WARNING.light,1]]){ink.lineStyle(width,color,alpha);draw();}
}

export function drawDanger(ink:Phaser.GameObjects.Graphics,floor:Phaser.GameObjects.Graphics,g:Shape,progress:number|null,spikes=false){
  if(g.radius<=0)return;
  const u=progress??1,points=g.outline??boundary(g),ring=g.kind==='ring';
  floor.fillStyle(WARNING.red,progress===null?.44:.38);
  if(ring){
    const inner=g.inner??0;
    for(let i=0;i<64;i++){const a=i*Math.PI/32,b=(i+1)*Math.PI/32,p=(angle:number,r:number)=>({x:g.a.x+Math.cos(angle)*r,y:g.a.y+Math.sin(angle)*r}),v=[p(a,inner),p(a,g.radius),p(b,g.radius),p(b,inner)];path(floor,v);floor.fillPath();}
    edge(ink,()=>{ink.strokeCircle(g.a.x,g.a.y,g.radius);if(inner>0)ink.strokeCircle(g.a.x,g.a.y,inner);},u);
  }else if(g.kind==='circle'){
    floor.fillCircle(g.a.x,g.a.y,g.radius);edge(ink,()=>ink.strokeCircle(g.a.x,g.a.y,g.radius),u);
  }else{
    path(floor,points);floor.fillPath();edge(ink,()=>{path(ink,points);ink.strokePath();},u);
  }
  if(spikes){
    const r=ring?((g.inner??0)+g.radius)/2:g.radius*.68;
    for(let i=0;i<6;i++){const angle=i*Math.PI/3,p={x:g.a.x+Math.cos(angle)*r,y:g.a.y+Math.sin(angle)*r},s=Math.min(9,g.radius*.14);floor.fillStyle(WARNING.outline,.7).fillTriangle(p.x-s,p.y+s*.6,p.x+s,p.y+s*.6,p.x,p.y-s*1.4).lineStyle(1,WARNING.red,1).strokeTriangle(p.x-s,p.y+s*.6,p.x+s,p.y+s*.6,p.x,p.y-s*1.4);}
  }
  if(progress!==null&&(g.kind==='circle'||ring)){
    // 计时线在危险区内部收拢；安全内圈与外边界都不随计时缩小。
    const inner=ring?g.inner??0:0,r=inner+(g.radius-inner)*(.88-.7*u);
    ink.lineStyle(4,WARNING.red,.8).strokeCircle(g.a.x,g.a.y,r).lineStyle(2,WARNING.light,1).strokeCircle(g.a.x,g.a.y,r);
  }
  const length=Math.hypot(g.b.x-g.a.x,g.b.y-g.a.y);
  if(length>45){const d={x:(g.b.x-g.a.x)/length,y:(g.b.y-g.a.y)/length},n=Math.min(5,Math.max(1,Math.floor(length/70)));
    // 带箭身的大箭头在真实带宽内绘制；填充留在角色下方，避免覆盖主角。
    for(let i=1;i<=n;i++){const p={x:g.a.x+d.x*length*i/(n+1),y:g.a.y+d.y*length*i/(n+1)},s=Math.min(1,g.radius/18),arrow=[[18,0],[-3,-12],[-1,-4],[-17,-4],[-17,4],[-1,4],[-3,12]].map(([x,y])=>({x:p.x+(d.x*x-d.y*y)*s,y:p.y+(d.y*x+d.x*y)*s}));floor.fillStyle(WARNING.light,1);path(floor,arrow);floor.fillPath();}
  }
}

// 地面提示只来自仍有效的正式危险区，已经命中过玩家的区域不再贴身报警。
export function hazardWarningAt(h:BossHazard,p:Point,now:number):number|null{
  if(h.used.includes('player')||h.damage<=0||now>=h.expires||!clearMeleeLine(h.point,p))return null;
  const d=Math.hypot(p.x-h.point.x,p.y-h.point.y);
  const at=h.kind==='ring'?Math.max(now,h.activeAt+Math.max(0,d-BOSS_RULES.ringInner-BOSS_RULES.ringWidth)/Math.max(1,h.speed)*1000):Math.max(now,h.activeAt);
  return at<h.expires&&geometryTouches(bossHazardGeometry(h,at),p)?at:null;
}

export function drawHeroDanger(ink:Phaser.GameObjects.Graphics,floor:Phaser.GameObjects.Graphics,p:Point,origin:Point,lead:number){
  const angle=Math.atan2(origin.y-p.y,origin.x-p.x),arc=Array.from({length:21},(_,i)=>({x:p.x+Math.cos(angle-.9+i*.09)*31,y:p.y+4+Math.sin(angle-.9+i*.09)*21}));
  edge(floor,()=>{path(floor,arc,false);floor.strokePath();},1-lead/700);
  const x=p.x+Math.cos(angle)*44,y=p.y+4+Math.sin(angle)*32,d={x:Math.cos(angle),y:Math.sin(angle)};
  const triangle=[{x:x+d.x*9,y:y+d.y*9},{x:x-d.x*6-d.y*8,y:y-d.y*6+d.x*8},{x:x-d.x*6+d.y*8,y:y-d.y*6-d.x*8}];
  floor.fillStyle(WARNING.red,1);path(floor,triangle);floor.fillPath();floor.lineStyle(2,WARNING.light,1);path(floor,triangle);floor.strokePath();
  // 小面积感叹号留在头侧，脚边指向危险来源，身体区域不铺红色填充。
  const bx=p.x+35,by=p.y-70;
  ink.fillStyle(WARNING.outline,.8).fillCircle(bx,by,17);
  ink.fillStyle(WARNING.red,1).lineStyle(2,WARNING.light,1).fillTriangle(bx-9,by+7,bx-11,by+23,bx+4,by+12).strokeTriangle(bx-9,by+7,bx-11,by+23,bx+4,by+12).fillCircle(bx,by,14).strokeCircle(bx,by,14);
  ink.lineStyle(4,WARNING.light,1).lineBetween(bx+1,by-8,bx-1,by+2).fillStyle(WARNING.light,1).fillCircle(bx-2,by+8,2);
}
