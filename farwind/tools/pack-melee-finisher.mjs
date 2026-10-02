import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
// 原创六姿态、三视向图集；脚底与握点一起归一化，左向只由角色镜像。
const source='docs/wind-legacy/art/finisher-source.png';
const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const frame=160,scale=.42,cells=[],weapons=[];
const points=[[[116,229,27,279],[99,115,15,70],[179,188,289,198],[175,191,290,198],[157,234,277,280],[150,240,180,270]],[[75,218,14,219],[101,113,23,58],[90,155,10,120],[166,180,285,161],[160,235,275,278],[160,202,280,154]],[[157,220,245,240],[112,112,40,56],[175,174,290,147],[182,170,290,156],[175,218,286,282],[175,220,286,251]]];
const seen=new Uint8Array(info.width*info.height),groups=[];
for(let seed=0;seed<seen.length;seed++){
 if(seen[seed]||data[seed*4+3]<16)continue;
 const pixels=[seed];seen[seed]=1;
 for(let i=0;i<pixels.length;i++){const at=pixels[i],x=at%info.width,y=Math.floor(at/info.width);for(const next of [at-1,at+1,at-info.width,at+info.width]){if(next<0||next>=seen.length||Math.abs(next%info.width-x)+Math.abs(Math.floor(next/info.width)-y)!==1||seen[next]||data[next*4+3]<16)continue;seen[next]=1;pixels.push(next);}}
 if(pixels.length>1000)groups.push({pixels,x:pixels.reduce((n,p)=>n+p%info.width,0)/pixels.length,y:pixels.reduce((n,p)=>n+Math.floor(p/info.width),0)/pixels.length});
}
if(groups.length!==18)throw Error('终结图集必须恰有十八个独立姿态。');
for(let view=0;view<3;view++){
 const figures=groups.filter(g=>Math.floor(g.y/(info.height/3))===view).sort((a,b)=>a.x-b.x),row=[];
 if(figures.length!==6)throw Error('每个方向必须恰有六个姿态。');
 for(let pose=0;pose<6;pose++){
  const pixels=figures[pose].pixels;
  let minX=info.width,minY=info.height,maxX=0,maxY=0,foot=0;
  for(const at of pixels){const x=at%info.width,y=Math.floor(at/info.width);minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);if(data[at*4]>data[at*4+2]*1.15)foot=Math.max(foot,y);}
  const boots=pixels.filter(at=>Math.floor(at/info.width)>=foot-8&&data[at*4+3]>100&&data[at*4]>data[at*4+2]*1.15),rootX=boots.reduce((n,p)=>n+p%info.width,0)/boots.length;
  const width=maxX-minX+1,height=maxY-minY+1,canvas=Buffer.alloc(width*height*4);
  for(const at of pixels)data.copy(canvas,((Math.floor(at/info.width)-minY)*width+at%info.width-minX)*4,at*4,at*4+4);
  const w=Math.round(width*scale),h=Math.round(height*scale),dx=Math.round(80+(minX-rootX)*scale),dy=Math.round(154+(minY-foot)*scale);
  if(dx<0||dy<0||dx+w>160||dy+h>160)throw Error(`角色动作超过单帧范围：方向${view}，姿态${pose}，位置${dx},${dy}，尺寸${w},${h}，脚点${rootX},${foot}，边界${minX},${minY},${maxX},${maxY}`);
  const input=await sharp(canvas,{raw:{width,height,channels:4}}).resize(w,h).png().toBuffer();cells.push({input,left:pose*frame+dx,top:view*frame+dy});
  const [gx,gy,tx,ty]=points[view][pose],left=Math.floor(pose*info.width/6),top=Math.floor(view*info.height/3),point=(x,y)=>({x:(x+left-rootX)*scale*145/160,y:(y+top-foot)*scale*145/160});row.push({grip:point(gx,gy),tip:point(tx,ty)});
 }
 weapons.push(row);
}
await sharp({create:{width:frame*6,height:frame*3,channels:4,background:'#00000000'}}).composite(cells).png().toFile('public/assets/animation/hero-melee-finisher.png');
await writeFile('src/data/meleeFinisherArt.ts',`// 原创回身终结斩，六姿态三视向；美术与握点仍待实机验收。\nexport const FINISHER_PROVISIONAL=true;\nexport const FINISHER_WEAPONS=${JSON.stringify(weapons,null,2)} as const;\n`);
