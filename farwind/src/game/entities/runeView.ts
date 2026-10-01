import {WORLD} from '../../data/world';
import Phaser from 'phaser';
import {runeById} from '../../data/runes';
import type {RuneCombat,RuneFx} from '../systems/runeCombat';
import {RUNE_ART,runeArtUrl,runeArtImage,type RuneArt} from './runeArt';
import {paintElementFx,paintElectricArc,paintWaveCrest} from './runeElements';
import {isLightningFx,sampleLightning} from './runeLightning';
export type RuneInk={line:(x:number,y:number,xx:number,yy:number,color:string,alpha:number,width?:number)=>void;path:(points:number[][],color:string,alpha:number,width?:number,fill?:boolean)=>void;ellipse:(x:number,y:number,rx:number,ry:number,color:string,alpha:number,width?:number,fill?:boolean)=>void;solid:(points:number[][],color:string,alpha:number)=>void;stamp?:(art:RuneArt,x:number,y:number,width:number,height:number,alpha:number,rotation?:number)=>void};
const point=(x:number,y:number,r:number,a:number)=>[x+Math.cos(a)*r,y+Math.sin(a)*r];
function star(g:RuneInk,x:number,y:number,r:number,c:string,a:number,rotation=0,n=4){const pts=Array.from({length:n*2},(_,i)=>point(x,y,i%2?r*.24:r,rotation+i*Math.PI/n));g.solid(pts,c,a*.85);g.path(pts,c,a,1.1);}
function feather(g:RuneInk,x:number,y:number,r:number,c:string,alpha:number,angle:number){const d=[Math.cos(angle),Math.sin(angle)],n=[-d[1],d[0]];const pts=[[x,y],[x+d[0]*r+n[0]*r*.22,y+d[1]*r+n[1]*r*.22],[x+d[0]*r*1.5,y+d[1]*r*1.5],[x+d[0]*r-n[0]*r*.17,y+d[1]*r-n[1]*r*.17],[x,y]];g.solid(pts,c,alpha*.65);g.path(pts,c,alpha,1.1);g.line(x,y,x+d[0]*r*1.3,y+d[1]*r*1.3,c,alpha*.7,1);}
function lightning(g:RuneInk,x:number,y:number,r:number,_c:string,alpha:number,seed:number){paintElectricArc(g,x,y,r,alpha,seed);}
// 世界、详情预览、试验场共用形体绘制；绘制函数不参与判定。
export function paintRuneFx(g:RuneInk,f:RuneFx,now:number,simple=false,lowFlash=false){
 if(paintElementFx(g,f,now,simple,lowFlash))return;
 const age=now-f.born;if(age<0||age>=f.life)return;const u=age/f.life,alpha=Math.min(1,age/50)*(1-u)*(lowFlash&&/fork|jolt|thunder|storm|phoenix/.test(f.visual)?.62:1),c=runeById(f.rune)?.color??'#a5e1d1',gold='#ead7a3',white='#e8f3de',r=f.radius,x=f.point.x,y=f.point.y,v=f.visual,count=simple?5:9;
 if(v==='wind-turbulence'){
  g.ellipse(x,y,r*(.3+u*.7),r*(.3+u*.7)*.55,c,alpha,2.5);
  for(let i=0;i<3;i++){const points=Array.from({length:12},(_,j)=>point(x,y,r*(.1+j/15)*(1-u*.6),i*2.094+j*.35+u*3));g.path(points,white,alpha,2);}
  return;
 }
 const tide=/wave|breaker|mirror-sea|return-wave/.test(v),ice=/seed|ice|winter|frozen/.test(v),brew=/brew|mist|banquet/.test(v),mirror=/mirror|armor|return-light|time/.test(v),doom=/seal|needles|doom/.test(v),hunter=/hunter|star|arrow|sword|moon/.test(v);
 // 共鸣各自融合形体：同一条浪脊、镜锁、酿泡或刃缘承担两种能力的演出。
 if(v==='mirror-doom'){
  const z=30*(1-u*.55);g.path([[x-z,y-34],[x,y-58],[x+z,y-34],[x,y-10],[x-z,y-34]],gold,alpha,2);g.path([[x-10,y-48],[x+10,y-48],[x-5,y-35],[x+9,y-22],[x-10,y-22]],'#dd8b8b',alpha,2.5);
  g.line(x-r,y-55,x+r,y-5,white,alpha,3);g.line(x-r,y-5,x+r,y-55,'#efac91',alpha,2);return;
 }
 if(v==='hunter-vortex'||v==='ice-vortex'){
  for(let j=0;j<3;j++){const pts=Array.from({length:20},(_,i)=>point(x,y,r*(.2+i/25),age/165+j*2.094+i*.18));g.path(pts,'#ca8e95',alpha*.65,1.6);const tip=pts.at(-1)!;feather(g,tip[0],tip[1],18,v==='ice-vortex'?'#c6eef6':white,alpha,age/165+j*2.094+4.9);if(v==='ice-vortex')star(g,tip[0],tip[1],8,'#e1f6ec',alpha,0,6);}
  if(v==='hunter-vortex')star(g,x+r*.8,y-r*.45,11,'#b9d4a2',alpha);return;
 }
 if(v==='ice-mist'){
  for(let i=0;i<count;i++){const a=i*2.399,z=r*(.25+(i%4)*.19),p=point(x,y,z,a);g.ellipse(p[0],y+(p[1]-y)*.55,22,9,'#9075aa',alpha*.28,1,true);if(v==='ice-mist'){star(g,p[0],y+(p[1]-y)*.55-8,7,'#bcecf0',alpha*.85,age/1400,6);g.line(p[0]-8,p[1],p[0]+8,p[1],gold,alpha*.65,1);}}
  return;
 }
 if(v==='doom-brew'||v==='rose-brew'||v==='brew-stars'){
  const n=Math.min(11,f.stacks??5);for(let i=0;i<n;i++){const a=i*2.399,z=v==='brew-stars'?26*(1-u):23,p=point(x,y-20,z,a);if(v==='brew-stars')star(g,p[0],p[1],5,gold,alpha,a);else{g.ellipse(p[0],p[1],4,4,'#c3a0d8',alpha,1.5);if(v==='doom-brew')g.line(p[0]-3,p[1]-10,p[0]+2,p[1]+4,'#ef8d84',alpha,1.5);else feather(g,p[0],p[1],8,'#e9acbd',alpha,a+1.2);}}return;
 }
 if(v==='heart-star'){
  g.path([[x-15,y-26],[x-20,y-40],[x-9,y-45],[x,y-33],[x+9,y-45],[x+20,y-40],[x+15,y-26],[x,y-15],[x-15,y-26]],'#e5a2b6',alpha,1.7);star(g,x,y-29,26,white,alpha,.15);for(let i=0;i<4;i++)feather(g,x,y-29,25+u*15,gold,alpha,i*1.57+.4);return;
 }
 if(v==='void'||v==='void-collapse'||v==='void-wave'){
  const collapse=v==='void-collapse',rr=collapse?r*Math.sin(Math.PI*u):r*(.88+Math.sin(age/240)*.05);
  g.ellipse(x,y,rr,rr*.58,'#576677',.12*(1-u),1,true);g.ellipse(x,y,rr,rr*.58,gold,alpha*.8,1.7);
  for(let i=0;i<count;i++){const a=i*Math.PI*2/count+age/600,z=rr*(1-((u+i/count)%1)),p=point(x,y,z,a);g.line(p[0],y+(p[1]-y)*.6,p[0]+Math.sin(a)*14,y+(p[1]-y)*.6-Math.cos(a)*8,white,alpha*.7,1.3);}if(collapse)star(g,x,y,30*(1-u),gold,alpha,0,6);
 }
 if(tide){const d=f.direction??{x:1,y:0},a=Math.atan2(d.y,d.x);for(let band=0;band<3;band++){const pts=Array.from({length:13},(_,i)=>{const t=a-Math.PI*.45+i/12*Math.PI*.9;return [x+Math.cos(t)*(r*(.45+u*.55)+band*6),y+Math.sin(t)*(r*(.45+u*.55)+band*6)*.65];});g.path(pts,band===1?white:'#83d1d3',alpha*(band===1?.8:.6),band===1?2.4:1.4);}for(let i=0;i<count;i++)feather(g,x+Math.cos(i)*r*.4,y+Math.sin(i)*r*.3,9,white,alpha*.5,i*1.1);}
 if(ice){if(v==='seed'){for(let i=0;i<(f.stacks??1);i++)feather(g,x,y,22,c,alpha,i*Math.PI*2/5-Math.PI/2);}else{const rr=v==='ice-bloom'?r*(.2+u*.8):Math.min(r,55);for(let i=0;i<6;i++){const a=i*Math.PI/3+u*.3,p=point(x,y,rr,a);g.line(x,y,p[0],p[1],c,alpha,2);feather(g,p[0],p[1],12,white,alpha,a+Math.PI);}g.path(Array.from({length:6},(_,i)=>point(x,y,rr*.45,i*Math.PI/3+u*.3)),white,alpha*.9,1.5);}if(v==='winter-beam'&&f.end)g.line(x,y-45,f.end.x,f.end.y-20,c,alpha,2);}
 if(brew){const ground=/mist/.test(v);for(let i=0;i<(ground?count:Math.min(11,f.stacks??3));i++){const a=i*2.399+u,z=ground?r*(.25+(i%4)*.2):24,p=point(x,y,z,a),py=ground?y+(p[1]-y)*.55:p[1]-u*20;g.ellipse(p[0],py,ground?22:3+(i%3),ground?10:4,'#9075aa',alpha*(ground?.3:.7),1.3,ground);g.ellipse(p[0]+1,py-1,ground?4:2,ground?4:2,gold,alpha*.8,1);}if(ground)for(let j=0;j<3;j++){const pts=Array.from({length:18},(_,i)=>[x-r*.8+i*r*.095,y+(j-1)*18+Math.sin(i*.5+age/420+j)*10]);g.path(pts,j===1?gold:'#a48aba',alpha*.55,1.4);}if(v==='banquet')g.path(Array.from({length:8},(_,i)=>point(x,y,30,i*Math.PI/4)),gold,alpha,1.5);}
 if(doom){const symbol=[[x-12,y-50],[x+10,y-50],[x+3,y-40],[x+12,y-32],[x-10,y-29],[x-3,y-40],[x-12,y-50]];g.path(symbol,'#d7777b',alpha,2.5);g.line(x-16,y-20,x+16,y-20,gold,alpha*.5,1.2);
  if(v==='doom-blade'||v==='mirror-doom')g.path([[x-3,y-85+u*60],[x+5,y-76+u*60],[x+2,y+10],[x-3,y-85+u*60]],white,alpha,2,true);
  for(let i=0;i<(f.stacks??3);i++){const a=i*Math.PI*2/5,p=point(x,y-38,28*(1-u*.7),a);g.line(p[0],p[1],x,y-38,'#e99d88',alpha*.7,1.6);}if(v==='mirror-doom'){g.line(x-r,y-40,x+r,y+5,gold,alpha,3);g.line(x+r,y-40,x-r,y+5,'#e99090',alpha,2);}
 }
 if(mirror){if(v==='time'){g.ellipse(x,y,r,r*.6,gold,alpha*.7,1.5);for(let i=0;i<12;i++){const a=i*Math.PI/6,p=point(x,y,r,a),q=point(x,y,r-10,a);g.line(p[0],y+(p[1]-y)*.6,q[0],y+(q[1]-y)*.6,white,alpha*.8,1.4);}for(let i=0;i<3;i++)g.path([[x-i*15,y-55],[x-8-i*15,y-34],[x-3-i*15,y],[x+8-i*15,y-33]],c,alpha*.4,1);}
  else {const rr=r*(.3+u*.7);g.path([[x-rr,y-12],[x-rr*.45,y-rr*.75],[x+rr*.35,y-rr*.65],[x+rr,y-6]],gold,alpha,2.4);for(let i=0;i<5;i++){const a=i*Math.PI*.4+u,p=point(x,y,rr,a);g.path([[p[0],p[1]-12],[p[0]+6,p[1]-4],[p[0],p[1]+4],[p[0]-4,p[1]-4],[p[0],p[1]-12]],white,alpha*.6,1.2);}if(f.end)g.line(x,y-32,f.end.x,f.end.y-28,white,alpha*.6,1.5);}
 }
 if(hunter){if(v==='sword-domain'){g.ellipse(x,y,r,r*.55,gold,alpha*.6,1.2);for(let i=0;i<12;i++){if(age>=250+i*440)continue;const a=-Math.PI+(i%6)/5*Math.PI,z=i<6?72:112,p=point(x,y-26,z,a);const blade=[[p[0]-3,p[1]],[p[0],p[1]-44],[p[0]+3,p[1]],[p[0]-3,p[1]]];g.solid(blade,i<6?white:gold,alpha*.9);g.path(blade,'#355849',alpha*.9,1.7);g.line(p[0],p[1]-42,p[0],p[1]-2,white,alpha,1);g.line(p[0]-8,p[1]+3,p[0]+8,p[1]+3,gold,alpha,2);}for(let i=0;i<6;i++){const p=point(x,y,r*.65,i*Math.PI/3);star(g,p[0],y+(p[1]-y)*.6,5,gold,alpha,0,4);}}
  else {star(g,x,y-18,Math.min(r,36)*(1-u*.3),white,alpha,u*.15,v==='moon'?6:4);g.line(x-r*.8,y+5,x+r*.7,y-38,gold,alpha,2.2);if(v==='heart-star')for(let i=0;i<4;i++)feather(g,x,y-12,25,'#e9a6b2',alpha,i*1.57);}
 }
 if(v==='sword-calligraphy'){const d=f.direction??{x:1,y:0},n={x:-d.y,y:d.x};for(let i=0;i<5;i++){const pts=Array.from({length:16},(_,j)=>{const t=j/15;return [x+d.x*(t-.5)*r*2+n.x*Math.sin(t*Math.PI)*i*5,y+d.y*(t-.5)*r*2+n.y*Math.sin(t*Math.PI)*i*5];});g.path(pts,i%2?white:gold,alpha*(1-i*.12),Math.max(1,5-i));}}
 if(/vortex/.test(v)){for(let j=0;j<3;j++){const pts=Array.from({length:18},(_,i)=>{const t=i/17,a=age/170+j*2.094+t*3;return point(x,y,r*(.25+t*.7),a);});g.path(pts,j%2?white:'#d18b92',alpha,2.3);}for(let i=0;i<4;i++){const a=age/170+i*1.57,p=point(x,y,r,a);feather(g,p[0],p[1],16,white,alpha,a+1.57);}if(/hunter/.test(v))star(g,x+r*.7,y-r*.5,10,'#c2d7a9',alpha);}
 if(/rose|ribbon/.test(v)){for(let i=0;i<5;i++){const a=i*Math.PI*2/5,p=point(x,y-24,18,a);feather(g,p[0],p[1],14,'#e1a1af',alpha,a+1.3);}g.path([[x-20,y-32],[x+15,y-25],[x-12,y-15],[x+24,y-8]],gold,alpha*.6,1.5);}
 if(/feather|wind-band|return-wind/.test(v)){for(let i=0;i<3;i++){const rr=20+i*13;g.ellipse(x,y,rr,rr*.55,'#8ed8ca',alpha*(age>i*150?1:.2),1.5);}for(let i=0;i<count;i++)feather(g,x+Math.sin(i*2+u)*r*.6,y-30+Math.cos(i)*18,10+u*12,c,alpha,i*2+u*4);g.path([[x-25,y-36],[x+12,y-53],[x+30,y-35],[x-8,y-19]],white,alpha*.6,1.6);}
}
export function graphicsInk(g:Phaser.GameObjects.Graphics):RuneInk{return {solid:(pts,c,a)=>{if(!pts.length)return;g.fillStyle(parseInt(c.slice(1),16),a).beginPath().moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)g.lineTo(pts[i][0],pts[i][1]);g.closePath().fillPath();},line:(x,y,xx,yy,c,a,w=1)=>{g.lineStyle(w,parseInt(c.slice(1),16),a).lineBetween(x,y,xx,yy);},path:(pts,c,a,w=1,fill=false)=>{if(!pts.length)return;g.lineStyle(w,parseInt(c.slice(1),16),a).fillStyle(parseInt(c.slice(1),16),fill?a*.2:0).beginPath().moveTo(pts[0][0],pts[0][1]);for(const p of pts.slice(1))g.lineTo(p[0],p[1]);if(fill)g.closePath().fillPath();g.strokePath();},ellipse:(x,y,rx,ry,c,a,w=1,fill=false)=>{g.lineStyle(w,parseInt(c.slice(1),16),a).fillStyle(parseInt(c.slice(1),16),a);if(fill)g.fillEllipse(x,y,rx*2,ry*2);else g.strokeEllipse(x,y,rx*2,ry*2);}};}
export function canvasInk(g:CanvasRenderingContext2D):RuneInk{return {solid:(pts,c,a)=>{if(!pts.length)return;g.globalAlpha=a;g.fillStyle=c;g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath();g.fill();},stamp:(id,x,y,w,h,a,rotation=0)=>{const image=runeArtImage(id);if(!image?.complete||!image.naturalWidth)return;g.save();g.globalAlpha=a;g.translate(x,y);g.rotate(rotation);g.drawImage(image,-w/2,-h/2,w,h);g.restore();},line:(x,y,xx,yy,c,a,w=1)=>{g.globalAlpha=a;g.strokeStyle=c;g.lineWidth=w;g.beginPath();g.moveTo(x,y);g.lineTo(xx,yy);g.stroke();},path:(pts,c,a,w=1,fill=false)=>{g.globalAlpha=a;g.strokeStyle=c;g.fillStyle=c;g.lineWidth=w;g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));if(fill){g.closePath();g.globalAlpha=a*.2;g.fill();g.globalAlpha=a;}g.stroke();},ellipse:(x,y,rx,ry,c,a,w=1,fill=false)=>{g.globalAlpha=a;g.strokeStyle=c;g.fillStyle=c;g.lineWidth=w;g.beginPath();g.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),0,0,Math.PI*2);fill?g.fill():g.stroke();}};}
export function paintRuneProjectile(g:RuneInk,p:import('../systems/runeCombat').RuneProjectile,engine:RuneCombat){const now=engine.now,settings=engine.state.runes.settings;const a=Math.atan2(p.direction.y,p.direction.x),x=p.point.x,y=p.point.y;
 if(p.kind==='vortex'){paintRuneFx(g,{id:0,visual:engine.duo('d12')?'ice-vortex':engine.duo('d03')?'hunter-vortex':'vortex',rune:p.rune,point:{x,y},radius:p.radius,born:p.born,life:p.until-p.born},now,settings.simple,settings.lowFlash);if(engine.duo('d03'))star(g,x+p.direction.x*p.radius,y+p.direction.y*p.radius,10,'#c1d9b1',.75);}
 else if(p.kind==='seeking'&&p.rune==='r30'){paintRuneFx(g,{id:0,visual:'phoenix-flight',rune:'r30',point:{x,y:y-25},radius:25,born:now-100,life:600,direction:p.direction},now,settings.simple,settings.lowFlash);if(engine.duo('d03'))star(g,x+p.direction.x*p.radius,y+p.direction.y*p.radius,10,'#c1d9b1',.75);}
 else if(p.kind==='seeking'){const d=p.direction,n={x:-d.y,y:d.x};g.line(p.previous.x,p.previous.y-25,x,y-25,'#c3d9ae',.65,1.6);g.path([[x-d.x*28-n.x*3,y-25-d.y*28-n.y*3],[x+d.x*12,y-25+d.y*12],[x-d.x*28+n.x*3,y-25-d.y*28+n.y*3],[x-d.x*28-n.x*3,y-25-d.y*28-n.y*3]],'#e1eacb',.9,1.7,true);g.line(x-d.x*20-n.x*9,y-25-d.y*20-n.y*9,x-d.x*20+n.x*9,y-25-d.y*20+n.y*9,'#e9d6a5',.8,2);}
 else paintWaveCrest(g,x,y,p.radius,a,(now-p.born)/400,p.kind==='phantom'?.55:.9,engine.duo('d01')&&p.kind==='wave',settings.simple);
}
export class RuneView {
 ground:Phaser.GameObjects.Graphics;body:Phaser.GameObjects.Graphics;marks:Phaser.GameObjects.Graphics;
 private art:Phaser.GameObjects.Image[]=[];private used=0;
 static preload(scene:Phaser.Scene){for(const id of Object.keys(RUNE_ART) as RuneArt[])scene.load.image('rune-art-'+id,runeArtUrl(id));}
 private stamp=(id:RuneArt,x:number,y:number,w:number,h:number,a:number,rotation=0)=>{if(a<=0)return;let sprite=this.art[this.used++];if(!sprite){sprite=this.body.scene.add.image(x,y,'rune-art-'+id).setDepth(8990);this.art.push(sprite);}sprite.setTexture('rune-art-'+id).setPosition(x,y).setDisplaySize(w,h).setAlpha(a).setRotation(rotation).setVisible(true);};
 snapshot(){return {materials:this.art.length,visible:this.used,lightning:this.engine.effects.filter(isLightningFx).map(f=>{const frame=sampleLightning(f,this.engine.now);return {id:f.id,visual:f.visual,age:this.engine.now-f.born,lead:f.lead??0,phase:frame.phase,tip:frame.tip,strokes:frame.strokes.length};}).filter(f=>f.phase!=='ended')};}
 constructor(scene:Phaser.Scene,public engine:RuneCombat){this.ground=scene.add.graphics().setDepth(WORLD.top-900);this.body=scene.add.graphics().setDepth(8989);this.marks=scene.add.graphics().setDepth(8991);}
 draw(){const engine=this.engine,now=engine.now,settings=engine.state.runes.settings;this.ground.clear();this.body.clear();this.marks.clear();this.used=0;const g=graphicsInk(this.body),ground=graphicsInk(this.ground),marks=graphicsInk(this.marks);g.stamp=this.stamp;
 for(const f of engine.effects){const floor=/mist|void|time/.test(f.visual)&&f.lead===undefined;const feet=/fork|thunder|jolt|phoenix|cloud|storm|wave|breaker|mirror-sea|mist|void|seed|time|domain|wind/.test(f.visual);paintRuneFx(floor?ground:g,{...f,point:{x:f.point.x,y:f.point.y-(feet?0:22)}},now,settings.simple,settings.lowFlash);}
 for(const t of engine.traces){
  const alpha=Math.max(.15,Math.min(.85,(t.until-now)/1000));
  ground.ellipse(t.point.x,t.point.y,26,14,'#d3e9a1',alpha,2);
  ground.path([[t.point.x-17,t.point.y+2],[t.point.x-5,t.point.y-6],[t.point.x+15,t.point.y-3]],'#eff4ce',alpha,2.4);
 }
 for(const p of engine.projectiles)paintRuneProjectile(g,p,engine);
 for(const e of engine.ctx.targets()){const s=engine.statuses.get(e.id);if(!s||e.hp<=0)continue;if(s.chill)for(let i=0;i<s.chill.stacks;i++)feather(marks,e.x,e.y,21,'#bce9f3',.85,i*1.256-1.57);
 if(s.poison)for(let i=0;i<s.poison.stacks;i++){const a=i*Math.PI*2/Math.max(8,s.poison.stacks),x=e.x+Math.cos(a)*25,y=e.y-20+Math.sin(a)*15;marks.ellipse(x,y,3,3,i>=8?'#e9b0c2':'#c4a0d9',.9,1);if(i>=8){feather(marks,x,y,8,'#e9b0c2',.85,-1.8);feather(marks,x,y,8,'#e9b0c2',.85,-1.3);}}
 if(s.weak)paintRuneFx(marks,{id:0,visual:'rose',rune:'r23',point:{x:e.x,y:e.y-28},radius:26,born:now-150,life:1000},now,true,true);
 if(s.doom){const left=Math.max(0,s.doom.at-now);marks.path([[e.x-12,e.y-72],[e.x+10,e.y-72],[e.x-6,e.y-57],[e.x+12,e.y-57]],'#db8b88',.9,2.3);marks.ellipse(e.x,e.y-64,18+left/100,18+left/100,'#dfc391',.7,1);for(let i=0;i<s.doom.stacks;i++)marks.line(e.x-20+i*9,e.y-84,e.x-16+i*9,e.y-76,'#ef8c86',1,1.8);}
 if(s.jolt){marks.path([[e.x-16,e.y-55],[e.x-10,e.y-38],[e.x-18,e.y-20],[e.x-12,e.y-8]],'#b7dfff',.7,1.6);}
 }
 for(let i=this.used;i<this.art.length;i++)this.art[i].setVisible(false);
 if(engine.feathers)for(let i=0;i<engine.feathers;i++)feather(marks,engine.player.x,engine.player.y-30,36,'#fff0c6',.7,-2.3+i*.8);
 }
 clear(){this.used=0;this.ground.clear();this.body.clear();this.marks.clear();for(const image of this.art)image.setVisible(false);}destroy(){this.clear();for(const image of this.art)image.destroy();this.art=[];this.ground.destroy();this.body.destroy();this.marks.destroy();}
}
