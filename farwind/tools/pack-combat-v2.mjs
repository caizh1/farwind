import {pathToFileURL} from 'node:url';
import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(),source=path.join(root,'docs/combat-v2/source');
const skills={
 'spore-heart':['spore-rain','root-stabs','crown-sweep','spore-ring','root-resonance','sac-seeding'],
 'thorn-crown':['pounce','claw','tail','counter-leap','wolf-call','moon-hunt'],
 'crag-tusk':['charge','horn','stomp','quake','rock-array','rock-throw'],
 'bound-branch':['cross','needles','root-road','cocoon','shift','ritual'],
};
// 最大连通主体与全部透明边界分别测量：孢子、尾端和颗粒不能冒充主体像素高度。
function bounds(data,width,height){
 const mask=new Uint8Array(width*height),stack=new Uint32Array(width*height);let full={l:width,t:height,r:0,b:0},largest={count:0,l:width,t:height,r:0,b:0};
 for(let i=0;i<mask.length;i++)if(data[i*4+3]>=32){mask[i]=1;const x=i%width,y=Math.floor(i/width);full.l=Math.min(full.l,x);full.r=Math.max(full.r,x);full.t=Math.min(full.t,y);full.b=Math.max(full.b,y);}
 for(let start=0;start<mask.length;start++){if(!mask[start])continue;let size=1,count=0,l=width,t=height,r=0,b=0;stack[0]=start;mask[start]=0;
  while(size){const i=stack[--size],x=i%width,y=Math.floor(i/width);count++;l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);
   for(const n of [x>0?i-1:-1,x+1<width?i+1:-1,y>0?i-width:-1,y+1<height?i+width:-1])if(n>=0&&mask[n]){mask[n]=0;stack[size++]=n;}
  }
  if(count>largest.count)largest={count,l,t,r,b};
 }
 return {full,subject:largest};
}
export async function cut(file,rect,name,minimum=480){
 const {data,info}=await sharp(file).extract(rect).ensureAlpha().raw().toBuffer({resolveWithObject:true}),box=bounds(data,info.width,info.height),height=box.subject.b-box.subject.t+1;
 if(height<minimum)throw Error(`${path.basename(file)} 的 ${name} 主体仅 ${height} 像素，低于${minimum}；必须重新生成，不能放大冒充高清。`);
 // 收招格应只留下完整主体，排除设计板上一格越过分界的悬浮手爪；蓄力和出手保留独立特效。
 const frameBox=name.endsWith('/recover')?{l:Math.max(0,box.subject.l-8),t:Math.max(0,box.subject.t-8),r:Math.min(info.width-1,box.subject.r+8),b:Math.min(info.height-1,box.subject.b+8)}:box.full;
 const crop={left:frameBox.l,top:frameBox.t,width:frameBox.r-frameBox.l+1,height:frameBox.b-frameBox.t+1},nativeHeight=Math.min(480,height),scale=nativeHeight/height,w=Math.ceil(crop.width*scale),h=Math.ceil(crop.height*scale),gutter=8;
 const buffer=await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).extract(crop).resize(w,h,{kernel:'lanczos3'}).extend({top:gutter,bottom:gutter,left:gutter,right:gutter,background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
 return {name,buffer,w:w+gutter*2,h:h+gutter*2,nativeHeight,sourceHeight:height,foot:[gutter+((box.subject.l+box.subject.r)/2-crop.left)*scale,gutter+(box.subject.b-crop.top+1)*scale]};
}
async function frames(kind,partial=false){const result=[];
 for(const direction of ['down','up','right']){
  for(const action of ['idle','walk',...skills[kind]]){const file=path.join(source,`${kind}-${direction}-${action}.png`);let meta;try{meta=await sharp(file).metadata();}catch(e){if(partial)continue;throw Error(`缺少动作源图：${path.basename(file)}`);}
   if(!meta.hasAlpha)throw Error(`素材没有透明通道：${path.basename(file)}`);
   const cols=action==='idle'?1:2,rows=cols,sizeW=Math.floor(meta.width/cols),sizeH=Math.floor(meta.height/rows),names=action==='idle'?['idle']:action==='walk'?['0','1','2','3']:['charge','strike','recover'];
   for(const [i,pose] of names.entries()){const name=action==='idle'?`${direction}/idle`:action==='walk'?`${direction}/walk/${pose}`:`${direction}/skill-${skills[kind].indexOf(action)}/${pose}`;try{const individual=path.join(source,action==='walk'?`${kind}-${direction}-walk-${pose}.png`:`${kind}-${direction}-skill-${skills[kind].indexOf(action)}-${pose}.png`);let individualMeta;try{if(action!=='idle')individualMeta=await sharp(individual).metadata();}catch{}result.push(await cut(individualMeta?individual:file,individualMeta?{left:0,top:0,width:individualMeta.width,height:individualMeta.height}:{left:(i%cols)*sizeW,top:Math.floor(i/cols)*sizeH,width:sizeW,height:sizeH},name));}catch(error){if(!partial)throw error;console.error(error.message);process.exitCode=1;}}
  }
 }
 return result;
}
async function pack(kind){await packEntries(kind,await frames(kind),path.join(root,'public/assets/camp-bosses-v2',kind));}
export async function packEntries(kind,entries,out){await mkdir(out,{recursive:true});
 const pages=[];let page={frames:[],x:0,y:0,row:0,width:0,height:0};pages.push(page);
 for(const f of entries.sort((a,b)=>b.h-a.h||b.w-a.w)){
  if(f.w>2048||f.h>2048)throw Error('单帧超过图集边界。');if(page.x+f.w>2048){page.x=0;page.y+=page.row;page.row=0;}if(page.y+f.h>2048){page={frames:[],x:0,y:0,row:0,width:0,height:0};pages.push(page);}
  f.x=page.x;f.y=page.y;page.frames.push(f);page.x+=f.w;page.row=Math.max(page.row,f.h);page.width=Math.max(page.width,page.x);page.height=Math.max(page.height,page.y+page.row);
 }
 const bytes=pages.reduce((n,p)=>n+p.width*p.height*4,0);if(bytes>192*1024*1024)throw Error(`解码纹理超过一百九十二MiB：${bytes}`);
 const textures=[],metadata={};for(const [i,p] of pages.entries()){const image=`page-${i}.png`;await sharp({create:{width:p.width,height:p.height,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(p.frames.map(f=>({input:f.buffer,left:f.x,top:f.y}))).png().toFile(path.join(out,image));
  textures.push({image,format:'RGBA8888',size:{w:p.width,h:p.height},scale:1,frames:p.frames.map(f=>({filename:f.name,frame:{x:f.x,y:f.y,w:f.w,h:f.h},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w:f.w,h:f.h},sourceSize:{w:f.w,h:f.h}}))});
  for(const f of p.frames)metadata[f.name]={width:f.w,height:f.h,nativeHeight:f.nativeHeight,foot:f.foot,sourceHeight:f.sourceHeight};
 }
 await writeFile(path.join(out,'atlas.json'),JSON.stringify({textures,meta:{说明:'高清主体裁切图集，每帧脚底锚点独立，边缘八像素留白。'}},null,2));
 await writeFile(path.join(out,'index.json'),JSON.stringify({version:2,kind,decodedBytes:bytes,pages:pages.map(p=>({width:p.width,height:p.height})),minimumSourceHeight:Math.min(...entries.map(f=>f.sourceHeight)),frames:metadata,说明:Object.hasOwn(skills,kind)?'首领原图主体高度至少四百八十，裁切后仅一次缩至主体四百八十，不经过六十四像素中间图。':'小型敌人原图主体至少为世界高度四倍，按逐帧脚底锚点裁切，不经六十四像素中间图。'},null,2));
 console.log(`${kind}：${entries.length}帧、${pages.length}页、解码${(bytes/1048576).toFixed(1)}MiB`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
const kinds=process.argv.slice(2).filter(v=>Object.hasOwn(skills,v));
if(process.argv.includes('--inspect')){for(const kind of kinds.length?kinds:Object.keys(skills)){try{const result=await frames(kind,true);console.log(`${kind}：已测量 ${result.length}帧，主体最小${Math.min(...result.map(f=>f.sourceHeight))}像素`);}catch(e){console.error(e.message);process.exitCode=1;}}}
else for(const kind of kinds.length?kinds:Object.keys(skills))await pack(kind);

}
