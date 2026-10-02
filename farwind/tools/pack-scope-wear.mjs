import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';

// 离线采样头发连通区域；运行时只读校验过的逐帧坐标，不扫描像素。
const files={
 'hero-motion':['public/assets/animation/round-three/hero-motion.png',128],
 'hero':['public/assets/hero.png',128],
 'hero-combat-action':['public/assets/animation/hero-combat-action.png',160],
 'hero-combat-back':['public/assets/animation/hero-combat-back.png',160],
 'hero-combat-side':['public/assets/animation/hero-combat-side.png',160],
 'hero-sword-wind':['public/assets/animation/sword-wind/hero-sword-wind.png',160],
 'hero-parry-v2':['public/assets/animation/hero-parry-v2.png',160],
 'hero-counter-v3':['public/assets/animation/hero-counter-v3.png',160],
 'hero-hurt':['public/assets/animation/hero-hurt.png',160],
};
const samples={},preview=[];
for(const [texture,[file,size]] of Object.entries(files)){
 const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const columns=info.width/size,frames=columns*info.height/size; samples[texture]=[];
 for(let frame=0;frame<frames;frame++){
  const left=frame%columns*size,top=Math.floor(frame/columns)*size;
  const mask=new Uint8Array(size*size),seen=new Uint8Array(size*size),groups=[];
  const redRows=Array(size).fill(0);
  for(let y=0;y<size;y++)for(let x=Math.floor(size*.2);x<size*.8;x++){const p=((top+y)*info.width+left+x)*4,[r,g,b,a]=data.subarray(p,p+4);if(a>120&&r>85&&g<r*.55&&b<r*.55)redRows[y]++;}
  const peak=Math.max(...redRows),scarf=peak>4?redRows.findIndex(n=>n>=peak*.5):Math.floor(size*.8);
  for(let y=0;y<Math.min(size*.86,scarf+2);y++)for(let x=0;x<size;x++){
   const p=((top+y)*info.width+left+x)*4,[r,g,b,a]=data.subarray(p,p+4);
   if(a>120&&r>30&&r<130&&g/r>.48&&g/r<.9&&b/g<.92)mask[y*size+x]=1;
  }
  for(let p=0;p<mask.length;p++)if(mask[p]&&!seen[p]){
   const queue=[p];seen[p]=1;let minX=size,minY=size,maxX=0,maxY=0;
   for(let j=0;j<queue.length;j++){
    const q=queue[j],x=q%size,y=Math.floor(q/size);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=ny*size+nx;if(nx>=0&&nx<size&&ny>=0&&ny<size&&mask[k]&&!seen[k]){seen[k]=1;queue.push(k);}}
   }
   if(queue.length>30&&maxX-minX>8)groups.push({minX,minY,maxX,maxY,area:queue.length});
  }
  groups.sort((a,b)=>b.area/(b.minY+12)**1.5-a.area/(a.minY+12)**1.5);const h=groups[0];
  if(!h){let visible=0;for(let y=0;y<size;y++)for(let x=0;x<size;x++)visible+=data[((top+y)*info.width+left+x)*4+3]>120?1:0;if(visible>20)throw Error(`${texture}第${frame}帧没有可验证的头部`);samples[texture].push([size/2,0,0]);continue;}
  const width=h.maxX-h.minX+1,headHeight=h.maxY-h.minY+1;
  const sample=[Math.round((h.minX+h.maxX)/2),Math.round(h.minY+headHeight*.58),width];
  samples[texture].push(sample);
  // 全帧固定预览保留原角色像素，网格只用于离线校验，不作为游戏素材。
  const image=await sharp(file).extract({left,top,width:size,height:size}).resize(160,160).png().toBuffer();
  preview.push({texture,frame,sample,input:image});
 }
}
await writeFile('src/data/scopeWear.ts',`// 佩戴锚点来自既有素材逐帧采样；[横坐标、额带纵坐标、头部宽度]，均为源帧像素。\nexport const SCOPE_HEADS:Record<string,readonly (readonly number[])[]> = ${JSON.stringify(samples)};\n`);
await writeFile('docs/aiming-scope/wear/anchors.json',JSON.stringify({说明:'既有角色素材逐帧头部采样，需固定预览人工校验；不修改角色源图。',采样:samples},null,2));
console.log(`已采样${preview.length}个既有动画帧`);
for(const texture of Object.keys(files)){
 const poses=preview.filter(p=>p.texture===texture),layers=[],columns=6;
 for(let i=0;i<poses.length;i++){
  const p=poses[i],n=p.frame,size=files[texture][1],scale=160/size;
  const view=texture==='hero-motion'?(n<9||n>=27&&n<35?'side':n>=18&&n<27||n>=43?'back':'front'):texture==='hero'?(Math.floor(n/6)===1?'back':Math.floor(n/6)>=2?'side':'front'):texture==='hero-combat-back'?'back':texture==='hero-combat-side'?'side':texture==='hero-combat-action'?(n<18?'front':n<36?'back':'side'):texture==='hero-hurt'?(n<3?'front':n<6?'back':'side'):texture==='hero-sword-wind'?(n<8?'front':n<16?'back':'side'):(n<6?'front':n<12?'back':'side');
  const width=Math.round(p.sample[2]*.83*scale),wear=await sharp(`public/assets/equipment/scope-wear-${view}.webp`).resize({width}).png().toBuffer();
  layers.push({input:p.input,left:i%columns*180,top:Math.floor(i/columns)*180});
  layers.push({input:wear,left:i%columns*180+Math.round(p.sample[0]*scale-width/2),top:Math.floor(i/columns)*180+Math.round(p.sample[1]*scale)});
 }
 await sharp({create:{width:columns*180,height:Math.ceil(poses.length/columns)*180,channels:4,background:'#e7dfc6'}}).composite(layers).png().toFile(`docs/aiming-scope/wear/${texture}-fixed.png`);
}
