import type {RuneInk} from './runeView';
import type {RuneFx} from '../systems/runeCombat';
import {clamp,smooth} from './windGiftChoreography';

export const CHAIN_LIGHTNING={life:320,jumpDelay:70} as const;

// 放电只消费真实命中快照；几何、粒子位置由同一时钟确定，不调度伤害。
export function paintChainLightning(g:RuneInk,f:RuneFx,now:number,simple=false,lowFlash=false){
 const age=now-f.born-(f.lead??0);
 if(age<0||age>=CHAIN_LIGHTNING.life)return;
 const end=f.point,start=f.end??{x:end.x-115,y:end.y+24};
 const dx=end.x-start.x,dy=end.y-start.y,length=Math.hypot(dx,dy)||1;
 const nx=-dy/length,ny=dx/length,seed=f.id*1.73;
 const noise=(k:number)=>{const n=Math.sin(seed+k*127.1)*43758.5453;return n-Math.floor(n);};
 const flash=lowFlash?.46:1,head=smooth(age/24);
 const power=smooth(age/9)*(1-smooth((age-105)/130))*flash*(lowFlash?1:.94+.06*Math.cos(age/16));
 const count=simple?6:9,bend=Math.min(25,length*.2);
 // 不等间距的大折角与细小回折混合，避免等节距的锯齿。
 const nodes=Array.from({length:count+1},(_,i)=>{
  const t=i===0?0:i===count?1:(i+(noise(i+40)-.5)*.55)/count;
  const off=i===0||i===count?0:((noise(i)*2-1)+.1*Math.sin(age/19+i*3.7))*bend*Math.sin(t*Math.PI);
  return {t,p:[start.x+dx*t+nx*off,start.y+dy*t+ny*off]};
 });
 const at=(t:number)=>{const i=Math.max(0,nodes.findIndex(n=>n.t>=t)-1),a=nodes[i],b=nodes[Math.min(count,i+1)],u=clamp((t-a.t)/(b.t-a.t||1));return [a.p[0]+(b.p[0]-a.p[0])*u,a.p[1]+(b.p[1]-a.p[1])*u];};
 const main=nodes.filter(n=>n.t<head).map(n=>n.p);main.push(at(head));
 const stroke=(points:number[][],alpha:number,width:number,glow=true)=>{
  if(alpha<=0)return;
  if(!simple&&glow){g.path(points,'#247dff',alpha*.08,width*9);g.path(points,'#36aaff',alpha*.16,width*5);g.path(points,'#63daff',alpha*.32,width*2.5);}
  g.path(points,'#83e7ff',alpha,width);g.path(points,'#ffffff',alpha,Math.max(.65,width*.48));
 };
 stroke(main,power,simple?3:4.4);
 if(!simple){
  // 各段宽度不同的发光电芯，亮核既有尖锋，也有短促收窄。
  for(let i=1;i<main.length;i++){
   const a=main[i-1],b=main[i],l=Math.hypot(b[0]-a[0],b[1]-a[1])||1,px=-(b[1]-a[1])/l,py=(b[0]-a[0])/l;
   const w=1.4+noise(i+80)*2.6,tip=.4+noise(i+90)*1.1;
   g.solid([[a[0]+px*w,a[1]+py*w],[b[0]+px*tip,b[1]+py*tip],[b[0]-px*tip,b[1]-py*tip],[a[0]-px*w,a[1]-py*w]],'#f4fdff',power);
   if(i%2)g.glow?.(a[0],a[1],23,power*.42);
  }
  for(let j=0;j<6;j++){
   const t=.13+j*.135,p=at(t),side=noise(j+14)>.5?1:-1,reach=(14+noise(j+20)*24)*smooth((head-t)*7);
   const points=Array.from({length:5},(_,k)=>{const v=k/4,zig=k===0||k===4?0:(noise(j*5+k+110)-.5)*12;return [p[0]+nx*side*reach*v+dx/length*(reach*.32*v+zig),p[1]+ny*side*reach*v+dy/length*(reach*.32*v+zig)];});
   stroke(points,power*.78,1.1,j<2);
  }
 }
 // 两端都有局部放电，飞散的尖碎片与弯折电丝使用不同速度。
 for(const [anchor,scale,delay] of [[end,1,18],[start,.65,0]] as const){
  const contact=smooth((age-delay)/12)*(1-smooth((age-75-delay)/120))*flash;
  const travel=clamp((age-delay)/190),radius=8+Math.sqrt(travel)*42*scale;
  if(!simple)g.glow?.(anchor.x,anchor.y,48*scale,contact*.8);
  for(let j=0;j<(simple?4:16);j++){
   const angle=seed+j*2.399+noise(j+160)*.7,cx=Math.cos(angle),cy=Math.sin(angle),r=radius*(.55+noise(j+170)*.65);
   const inner=3+travel*r*.3,outer=r+noise(j+180)*12*scale;
   const points=[[anchor.x+cx*inner,anchor.y+cy*inner],[anchor.x+cx*r*.65-cy*4,anchor.y+cy*r*.65+cx*4],[anchor.x+cx*outer,anchor.y+cy*outer]];
   if(j%3===0&&!simple){const p=points[1],tip=points[2];g.solid([[p[0]-cy*1.6,p[1]+cx*1.6],tip,[p[0]+cy*1.6,p[1]-cx*1.6]],'#eefcff',contact);}
   else stroke(points,contact*(.55+noise(j+190)*.4),j%4===0?1.7:.8,j<3);
  }
  const star=(simple?7:13)*contact*scale;
  for(let j=0;j<3;j++){
   const angle=seed+j*Math.PI/3,cx=Math.cos(angle),cy=Math.sin(angle),r=star*(j===0?1.5:1);
   g.solid([[anchor.x-cx*r,anchor.y-cy*r],[anchor.x-cy*2,anchor.y+cx*2],[anchor.x+cx*r,anchor.y+cy*r],[anchor.x+cy*2,anchor.y-cx*2]],'#ffffff',contact);
  }
  g.ellipse(anchor.x,anchor.y,3.5*scale,3.5*scale,'#ffffff',contact,1,true);
 }
 // 主通道消退后，留下互不相连的细弧和继续散开的微粒。
 if(!simple)for(let j=0;j<6;j++){
  const t=clamp((age-145-j*9)/125),alpha=smooth((age-140)/30)*(1-t)*flash*.62;
  const points=Array.from({length:4},(_,k)=>{const p=at(.04+j*.15+k/3*.09*(1-t));return [p[0]+nx*t*(j%2?8:-8),p[1]+ny*t*(j%2?8:-8)-t*6];});
  stroke(points,alpha,1,false);const p=points[1];g.ellipse(p[0]+nx*t*12,p[1]+ny*t*12,1.1,1.1,'#a3eaff',alpha,1,true);
 }
}
