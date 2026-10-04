import type {RuneInk} from './runeView';
import type {RuneFx} from '../systems/runeCombat';
import {GIFT_MATERIALS,WIND_GIFT_ART,giftVisualId} from './windGiftArt';
import type {GiftVisualId} from './windGiftArt';
import type {Point} from '../systems/obstacles';
import {GIFT_CHOREOGRAPHY,giftEnvelope,smooth,clamp,type GiftRecipe} from './windGiftChoreography';
import {paintChainLightning} from './chainLightning';
const polar=(x:number,y:number,r:number,a:number,flat=1)=>[x+Math.cos(a)*r,y+Math.sin(a)*r*flat];
const curve=(fn:(t:number)=>number[],simple:boolean)=>Array.from({length:simple?13:25},(_,i)=>fn(i/(simple?12:24)));
// 透光曲面的边、脊与反光共享连续曲线；没有整图换帧和随机跳变。
function ribbon(g:RuneInk,p:number[][],width:number,color:string,alpha:number,simple:boolean){
 if(alpha<=0)return;
 for(const [layer,factor] of (simple?[1]:[1,.55,.2]).entries()){
  const left:number[][]=[],right:number[][]=[];
  for(let i=0;i<p.length;i++){const a=p[Math.max(0,i-1)],b=p[Math.min(p.length-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1,t=i/(p.length-1),w=width*factor*Math.pow(Math.max(0,Math.sin(Math.PI*t)),.7);left.push([p[i][0]-dy/l*w,p[i][1]+dx/l*w]);right.push([p[i][0]+dy/l*w,p[i][1]-dx/l*w]);}
  g.solid([...left,...right.reverse()],layer===2?'#f1fbff':color,alpha*(layer===0?.14:layer===1?.23:.46));
  if(layer===0)g.path(left,color,alpha*.68,1.1);
 }
 g.path(p,'#eefcff',alpha*.78,simple?1:1.25);
}
function shard(g:RuneInk,x:number,y:number,size:number,angle:number,color:string,alpha:number){
 const d=[Math.cos(angle),Math.sin(angle)],n=[-d[1],d[0]],p=[[x-d[0]*size,y-d[1]*size],[x+n[0]*size*.25,y+n[1]*size*.25],[x+d[0]*size*.7,y+d[1]*size*.7],[x-n[0]*size*.16,y-n[1]*size*.16]];
 g.solid(p,color,alpha*.34);g.solid([p[0],p[1],[x,y]],'#f5fcff',alpha*.62);g.path([p[0],p[1],p[2]],'#dff7ff',alpha,1);
}
// 伙伴标记使用局部刃结；风赐不能靠端点距离拉成贯穿战场的线。
function bladeKnot(g:RuneInk,x:number,y:number,size:number,angle:number,color:string,alpha:number,simple:boolean){
 const d=[Math.cos(angle),Math.sin(angle)],n=[-d[1],d[0]],p=[[x-d[0]*size,y-d[1]*size],[x+n[0]*size*.32,y+n[1]*size*.32],[x+d[0]*size,y+d[1]*size],[x-n[0]*size*.32,y-n[1]*size*.32]];
 g.solid(p,color,alpha*.25);g.solid([p[0],p[1],p[2]],'#fff7e0',alpha*.45);g.path([...p,p[0]],color,alpha,1.2);
 if(!simple)g.path([p[0],[x,y],p[2]],'#fffdf0',alpha*.85,1.3);
}
export function paintWindGiftFx(g:RuneInk,f:RuneFx,now:number,simple=false,lowFlash=false){
 const id=giftVisualId(f.visual);if(!id)return false;if(id==='blackHole')return true;
 if(id==='chain'){paintChainLightning(g,f,now,simple,lowFlash);return true;}
 const age=now-f.born;if(age<0||age>=f.life)return true;
 const art=WIND_GIFT_ART[id],recipe:GiftRecipe=GIFT_CHOREOGRAPHY[id],u=age/f.life,x=f.point.x,y=f.point.y,r=Math.min(130,f.radius)*recipe.reach;
 const angle=Math.atan2(f.direction?.y??0,f.direction?.x??1),c=GIFT_MATERIALS[art.motion].color,accent=recipe.material===4?'#fff0ad':recipe.material===2||recipe.material===3?'#ffe0a3':'#c5fbff';
 const intensity=lowFlash?.46:.9,base=giftEnvelope(u)*intensity,flat=art.ground?.48:.72;
 const map=(a:number,b:number)=>[x+Math.cos(angle)*a-Math.sin(angle)*b,y+Math.sin(angle)*a+Math.cos(angle)*b];
 const stamp=(material:number,p:number[],w:number,h:number,a:number,rot=0)=>{if(!simple&&a>0)g.giftMaterial?.(material,p[0],p[1],w,h,Math.min(intensity,a),rot,art.ground);};
 const flow=(p:number[][],w:number,a=base,color:string=c)=>ribbon(g,p,w,color,a,simple);
 if(f.giftPhase==='charge'){for(let k=0;k<(simple?1:3);k++)flow(curve(v=>map((v-.5)*r*(1-smooth(u)*.65),(k-1)*r*.3*Math.sin(v*Math.PI)*(1-smooth(u))),simple),1.8,base*.55);return true;}
 const dust=(count=recipe.count*2)=>{for(let i=0;i<(simple?2:Math.min(count,12));i++){const t=clamp((u-i*.022)/(.88-i*.022)),a=i*2.399+angle,z=r*(.28+t*.65),p=polar(x,y,z,a,flat);shard(g,p[0],p[1],2+(i%3)*1.4,a+t*.8,c,giftEnvelope(t)*intensity*.7);}};
 const blade=(k:number,t:number)=>{
  const a=giftEnvelope(u,k*recipe.delay)*intensity,span=recipe.spread*1.65,head=angle-span*.7+t*span*1.55+recipe.turn*k*.32;
  const radius=r*(.55+smooth(t)*.3)*(1-k*.075),p=curve(v=>polar(x,y,radius,head-span+v*span,flat),simple);
  flow(p,11*recipe.width,a,k%2?accent:c);stamp(recipe.shape==='combo'&&k%2?0:recipe.material,polar(x,y,radius*.85,head-span*.35,flat),r*1.35*recipe.width,r*1.35,a*.94,head-span*.32);
  if(!simple){flow(curve(v=>polar(x,y,radius*.91,head-span*.9+v*span*.9,flat),false),2.4,a*.52,accent);const tip=p.at(-1)!;shard(g,tip[0],tip[1],5*recipe.width,head+Math.PI/2,c,a);}
 };
 switch(recipe.shape){
  case 'crescent':case 'wing':case 'combo':case 'echo':
   for(let k=0;k<(simple?1:recipe.count);k++)blade(k,clamp((u-k*recipe.delay)/(1-k*recipe.delay)));
   if(recipe.shape==='echo')for(let k=0;k<recipe.count;k++){const t=smooth(clamp((u-k*recipe.delay)*1.3)),p=map(r*(t-.35),0);stamp(recipe.material,p,r*.8,r*.65,giftEnvelope(u,k*recipe.delay)*intensity*.65,angle);}
   break;
  case 'spear':case 'charge':
   for(let k=0;k<(simple?1:recipe.count);k++){
    const off=(k-(recipe.count-1)/2)*r*.16*recipe.spread,t=smooth(u/.65),length=r*(recipe.shape==='charge'?smooth((u-.08)/.4):.45+t*.65);
    flow(curve(v=>map((v-.5)*length*2,off*Math.sin(v*Math.PI)*(recipe.inward?1-t:1)+Math.sin(v*5-u*6+k)*r*.018),simple),r*.065*recipe.width,base*(1-k*.08));
   }
   stamp(recipe.material,map(r*(smooth(u/.65)-.2),0),r*1.5,r*.38,base*.8,angle);dust(6);break;
  case 'curtain':case 'brackets':
   for(let k=0;k<(simple?2:recipe.count);k++){
    const a=k*Math.PI*2/recipe.count+angle,z=r*(recipe.inward?1-smooth(u)*.5:.45+smooth(u)*.5),p=polar(x,y,z,a,flat),w=r*.18*recipe.width,h=r*.65;
    const shear=Math.sin(u*Math.PI)*w*.4,pts=[[p[0]-w,p[1]-h*.4],[p[0]+w+shear,p[1]-h*.55],[p[0]+w,p[1]+h*.45],[p[0]-w-shear,p[1]+h*.3]];
    g.solid(pts,c,base*.12);g.path(pts,c,base*.75,1.2);stamp(recipe.material,p,w*3,h,base*.55,a*.12);g.line(pts[0][0],pts[0][1],pts[2][0],pts[2][1],accent,base*.35,1);
   }break;
  case 'focus':
   for(let k=0;k<(simple?2:recipe.count);k++){const phase=k*Math.PI*2/recipe.count,contract=1-smooth(u/.7);flow(curve(v=>polar(x,y,r*(1-v)*(.45+contract*.55),phase+v*recipe.turn+u*.8,flat),simple),5*recipe.width,base);}
   stamp(recipe.material,[x,y],r*.34,r*.46,base*.8,angle+u);dust();break;
  case 'pressure':
   for(let k=0;k<(simple?1:recipe.count);k++){const t=clamp((u-k*recipe.delay)/(1-k*recipe.delay)),a=giftEnvelope(u,k*recipe.delay)*intensity,z=r*(.2+smooth(t/.7)*.8);flow(curve(v=>polar(x,y,z,-Math.PI+v*Math.PI*2,.42),simple),5*recipe.width,a,c);
    if(!simple)for(let j=0;j<3;j++){const q=polar(x,y,z*.65,j*2.094,.42);flow([[q[0]-12,q[1]+4],[q[0]-5,q[1]-8*recipe.width*(1-t)],[q[0]+9,q[1]+2]],3,a*.55,accent);}}
   stamp(7,[x,y-8],r*.55,r*.7,base*.5,-u*.5);dust();break;
  case 'plates':case 'cushion':
   for(let k=0;k<(simple?2:recipe.count);k++){
    const t=clamp((u-k*recipe.delay)/(1-k*recipe.delay)),a=giftEnvelope(u,k*recipe.delay)*intensity,phase=angle+k*Math.PI*2/recipe.count+recipe.turn*smooth(t)*.35;
    const dent=recipe.shape==='cushion'?Math.sin(t*Math.PI*2)*r*.1:0,p=polar(x,y,r*(.55+smooth(t/.25)*.16)-dent,phase,.64),h=r*.8,w=r*.38*recipe.width;
    stamp(recipe.material,p,w*2,h,a*.82,phase*.18);
    flow(curve(v=>[p[0]+Math.sin(v*Math.PI)*w*.6*Math.cos(phase),p[1]+(v-.5)*h],simple),3,a*.75,accent);
   }if(recipe.material===10)for(let i=0;i<2;i++)stamp(12,polar(x,y,r*.5,i*Math.PI+u,.6),13,22,base*.6,u);break;
  case 'mirror':
   for(let k=0;k<(simple?2:recipe.count);k++){const t=smooth(u/.7),a=angle+(k-(recipe.count-1)/2)*.38*recipe.spread,p=polar(x,y,r*(.15+t*.8),a,flat);stamp(recipe.material,p,r*.44*recipe.width,r*.8*recipe.width,base*.82,a+Math.PI*.28);shard(g,p[0],p[1],r*.15,a,c,base);flow(curve(v=>polar(x,y,r*(.1+v*t*.8),a+(1-v)*.18,flat),simple),2.5,base*.6);}
   dust();break;
  case 'water':case 'spring':case 'repair':
   if(f.end&&recipe.shape==='water'){const end=f.end,dx=end.x-x,dy=end.y-y,travel=1-smooth(u/.8);flow(curve(v=>[x+dx*v,y+dy*v+Math.sin(v*Math.PI)*12],simple),3,base*.65,'#b4f7b0');for(let k=0;k<(simple?1:recipe.count);k++){const t=clamp(travel+k*.07*(1-travel));stamp(recipe.material,[x+dx*t,y+dy*t+Math.sin(t*Math.PI)*12],14,25,base*.9,Math.atan2(dy,dx)-Math.PI/2);}break;}
   if(recipe.shape==='spring')stamp(15,[x,y+6],r*1.6,r*.72,base*.8,0);
   for(let k=0;k<(simple?2:recipe.count);k++){
    const a=k*2.399,z=r*(recipe.inward?1-smooth(u/.8):.3+smooth(u)*.45),lift=recipe.shape==='spring'?Math.sin(u*Math.PI)*r*.8:recipe.shape==='repair'?u*r*.5:Math.sin(u*Math.PI)*r*.38;
    const p=polar(x,y-lift,z,a+u*recipe.turn,.55);stamp(recipe.shape==='repair'?14:recipe.shape==='spring'?12:recipe.material,p,12+recipe.width*7,23+recipe.width*8,base*.86,u*recipe.turn*.5);
    flow(curve(v=>polar(x,y-lift*v,z*(1-v*.45),a+u*recipe.turn-v*.8,.55),simple),2.5*recipe.width,base*.55,'#b4f7b0');
   }break;
  case 'breath':case 'spiral':case 'duality':
   for(let k=0;k<(simple?1:recipe.count);k++){
    const a=k*Math.PI*2/recipe.count+u*recipe.turn*2,contract=recipe.inward?1-smooth(u)*.65:.5+smooth(u)*.5;
    const p=curve(v=>polar(x,y,r*(.18+v*.75)*contract,a+v*Math.PI*1.35,flat),simple),color=recipe.shape==='duality'&&k%2?'#ffe8ac':c;flow(p,(recipe.shape==='breath'?3:7)*recipe.width,base,color);
    stamp(recipe.shape==='duality'&&k%2?2:recipe.material,p[Math.floor(p.length*.7)],r*.65,r*.45,base*.65,a+2);
   }if(recipe.shape!=='breath')dust();break;
  case 'trail':
   for(let k=0;k<(simple?1:recipe.count);k++){const off=(k-(recipe.count-1)/2)*r*.12*recipe.spread,travel=recipe.inward?1-smooth(u):smooth(u),p=curve(v=>map(-r*(1-v)*(.55+travel*.5),off*Math.sin(v*Math.PI)+Math.sin(v*4+u*4+k)*r*.03),simple);flow(p,4*recipe.width,base);stamp(recipe.material,p[Math.floor(p.length*.5)],r,r*.4,base*.65,angle);}
   break;
  case 'link':{
   if(id==='returningBreath'){
    const source=f.end??{x:x-30,y},dx=x-source.x,dy=y-source.y,travel=smooth(u/.82),distance=Math.hypot(dx,dy),length=Math.min(28,distance),ux=distance?dx/distance:1,uy=distance?dy/distance:0,px=source.x+dx*travel,py=source.y+dy*travel;
    // 只绘制风团后方的短尾迹，不描出完整返还路线。
    for(let k=0;k<(simple?1:2);k++)flow(curve(v=>[px-ux*length*(1-v)-uy*Math.sin(v*Math.PI)*(k?3:-3),py-uy*length*(1-v)+ux*Math.sin(v*Math.PI)*(k?3:-3)],simple),2.5,base*.65,'#ffe2a3');
    bladeKnot(g,px,py,5,Math.atan2(dy,dx),'#ffe2a3',base,simple);break;
   }
   const gold=id==='sideBySide'?'#ffc5a6':'#ffdf94',silver='#f2f9ff';
   if(f.giftPhase==='mark'){
    const shift=id==='sideBySide'?-23:23,size=11+smooth(u/.4)*3;
    bladeKnot(g,x+shift,y, size,-Math.PI/2,gold,base,simple);
    if(id==='relayTogether')bladeKnot(g,x+shift+7,y+2, size*.75,-Math.PI/2+.25,silver,base*.75,simple);
    break;
   }
   const reach=Math.min(42,r),closing=smooth(u/.48),spread=1-closing*.55,rotation=id==='sharedHeart'?Math.PI/2:angle;
   for(let k=0;k<(simple?1:2);k++){
    const sign=k?1:-1,pts=curve(v=>{
     const a=sign*reach*(1-v)*spread,b=sign*Math.sin(v*Math.PI)*reach*.42;
     return [x+Math.cos(rotation)*a-Math.sin(rotation)*b,y+Math.sin(rotation)*a+Math.cos(rotation)*b];
    },simple);
    flow(pts,id==='relayTogether'?6:4,base,k?gold:silver);
   }
   bladeKnot(g,x,y,(id==='relayTogether'?8:5)*(1-closing*.25),rotation+Math.PI/2,gold,base,simple);
   for(let k=0;k<(simple?1:4);k++){const a=angle+k*2.399,z=8+smooth(u)*24;shard(g,x+Math.cos(a)*z,y+Math.sin(a)*z*.7,2.5,a,gold,base*.75);}
   break;}
  case 'growth':
   for(let k=0;k<(simple?2:recipe.count);k++){const sign=k%2?-1:1,t=smooth(u/.65),p=curve(v=>[x+sign*(r*.22+Math.sin(v*Math.PI)*r*.22),y+r*.3-v*r*t],simple);flow(p,3*recipe.width,base,accent);stamp(recipe.material,p.at(-1)!,18,35,base*.7,u*sign);}
   break;
 }
 return true;
}
// 常驻状态按真实剩余时间与护盾量显示，位置跟随主体，纹理与边线连续呼吸。
export function paintWindGiftStatus(body:RuneInk,ground:RuneInk,id:GiftVisualId,p:Point,now:number,ratio:number,fade:number,simple=false,lowFlash=false){
 if(id==='blackHole')return;
 const recipe=GIFT_CHOREOGRAPHY[id],c=GIFT_MATERIALS[WIND_GIFT_ART[id].motion].color,a=clamp(fade)*(lowFlash?.24:.42),phase=now/900;
 if(id==='relayEdge'||id==='sideBySide'||id==='relayTogether'){
  const x=p.x+(id==='sideBySide'?-23:23),y=p.y-20,size=12+Math.sin(phase)*.7,color=id==='sideBySide'?'#ffc5a6':'#ffdf94';
  bladeKnot(body,x,y,size,-Math.PI/2,color,a,simple);
  if(id==='relayTogether')bladeKnot(body,x+7,y+2,size*.75,-Math.PI/2+.25,'#f2f9ff',a*.75,simple);
  return;
 }
 if(recipe.shape==='plates'||recipe.shape==='cushion'){
  for(const sign of [-1,1]){const x=p.x+sign*(24+Math.sin(phase)*1.5),y=p.y-18+Math.cos(phase+sign)*2;body.giftMaterial?.(recipe.material,x,y,24,43,a*(.45+clamp(ratio)*.55),sign*.12,false);ribbon(body,curve(t=>[x+sign*Math.sin(t*Math.PI)*4,y+(t-.5)*39],simple),1.7,c,a,simple);}
 }else{
  if(!simple)for(const sign of [-1,1])ground.giftMaterial?.(recipe.material,p.x+sign*22,p.y-8+Math.sin(phase+sign)*2,id==='holdWind'?14:12,id==='holdWind'?23:18,a*.9,sign*.25,true);
  for(let k=0;k<2;k++){const pts=curve(t=>polar(p.x,p.y,22+Math.sin(phase+k)*1.5,k*Math.PI+t*Math.PI*.65,.5),simple);ribbon(ground,pts,1.6,c,a,simple);const tip=pts.at(-1)!;shard(ground,tip[0],tip[1],3,k*Math.PI+phase*.2,c,a);}
 }
}
