// 仅机械裁切、统一缩放与脚底对齐；不绘制姿态，不插帧。
import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const root='docs/enemy-art-v2',out='public/assets/enemies-v2';
const names={'branch-reaper':'裂枝镰灵','ashen-spore':'灰冠孢卫'};
const directions={down:'朝下',up:'朝上',right:'朝右'};
const widthSize=384,heightSize=256,nativeHeight=160,rootY=heightSize*110/128,columns=10;
const records=[];
function components(data,w,h){
 const labels=new Int32Array(w*h),queue=new Int32Array(w*h),parts=[];let serial=0;
 for(let i=0;i<w*h;i++)if(!labels[i]&&data[i*4+3]>25){
  const id=++serial;let head=0,tail=1;queue[0]=i;labels[i]=id;let x0=w,y0=h,x1=0,y1=0;
  while(head<tail){const p=queue[head++],x=p%w,y=Math.floor(p/w);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
   for(const j of [x?p-1:-1,x<w-1?p+1:-1,y?p-w:-1,y<h-1?p+w:-1])if(j>=0&&!labels[j]&&data[j*4+3]>25){labels[j]=id;queue[tail++]=j;}
  }
  if(tail>2000)parts.push({id,left:x0,top:y0,width:x1-x0+1,height:y1-y0+1});
 }
 if(parts.length!==24)throw Error(`源图必须有二十四个完整角色，实际为 ${parts.length}`);
 const cells=[];
 for(let row=0;row<6;row++){
  const items=parts.filter(p=>Math.floor((p.top+p.height/2)/h*6)===row).sort((a,b)=>a.left+a.width/2-b.left-b.width/2);
  if(items.length!==4)throw Error(`第 ${row+1} 行必须为四格，实际为 ${items.length}`);
  cells.push(...items);
 }
 return {cells,labels};
}
await mkdir(out,{recursive:true});await mkdir(`${root}/boards`,{recursive:true});
for(const [id,label] of Object.entries(names)){
 const frames=[],boards=[];
 for(const [directionIndex,dir] of Object.keys(directions).entries()){
  let directionHeight;
  for(const group of ['motion','reaction']){
   const fixed=group==='motion'&&(id==='ashen-spore'&&dir==='down'||id==='branch-reaper'&&dir==='up');
   const source=`${root}/source/${id}-${dir}-${group}${fixed?'-fixed':''}.png`;
   const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   let zeros=0;for(let a=3;a<data.length;a+=4)zeros+=data[a]===0?1:0;
   if(zeros/info.width/info.height<.2)throw Error(`${source} 缺少透明背景`);
   const {cells,labels}=components(data,info.width,info.height);
   if(group==='motion')directionHeight=cells[0].height;
   // 每张源图只使用一个比例；反应图以首个站立姿态校准，不逐帧拉伸。
   const scale=nativeHeight/(group==='motion'?directionHeight:cells[0].height);
   for(const [i,part] of cells.entries()){
    const box={left:Math.max(0,part.left-2),top:Math.max(0,part.top-2),width:Math.min(info.width,part.left+part.width+2)-Math.max(0,part.left-2),height:Math.min(info.height,part.top+part.height+2)-Math.max(0,part.top-2)};
    const tight={left:0,top:0,width:box.width,height:box.height},pixels=Buffer.alloc(box.width*box.height*4);
    for(let y=0;y<box.height;y++)for(let x=0;x<box.width;x++){
     const sx=box.left+x,sy=box.top+y,p=sy*info.width+sx;
     let belongs=labels[p]===part.id;
     if(!labels[p]&&data[p*4+3]>=8)for(let dy=-2;dy<=2&&!belongs;dy++)for(let dx=-2;dx<=2;dx++){const nx=sx+dx,ny=sy+dy;if(nx>=0&&nx<info.width&&ny>=0&&ny<info.height&&labels[ny*info.width+nx]===part.id){belongs=true;break;}}
     if(belongs)data.copy(pixels,(y*box.width+x)*4,p*4,p*4+4);
    }
    const width=Math.round(tight.width*scale),height=Math.round(tight.height*scale);
    const {data:raw,info:rawInfo}=await sharp(pixels,{raw:{width:box.width,height:box.height,channels:4}}).resize(width,height).raw().toBuffer({resolveWithObject:true});
    for(let a=3;a<raw.length;a+=4)if(raw[a]<8)raw[a]=0;
    let l=width,r=-1;
    for(let y=Math.floor(height*.86);y<height;y++)for(let x=0;x<width;x++)if(raw[(y*width+x)*4+3]>65){l=Math.min(l,x);r=Math.max(r,x);}
    if(r<l)throw Error('脚底锚点为空');
    const left=Math.round(widthSize/2-(l+r)/2),top=Math.round(rootY-height);
    if(left<3||left+width>widthSize-3||top<3||top+height>heightSize-3)throw Error(`${source} 第 ${i+1} 格越界：${JSON.stringify({left,top,width,height})}`);
    const input=await sharp(raw,{raw:rawInfo}).png().toBuffer();
    const frame=await sharp({create:{width:widthSize,height:heightSize,channels:4,background:'#00000000'}}).composite([{input,left,top}]).png().toBuffer();
    const local=(group==='motion'?0:24)+i,n=directionIndex*48+local;
    frames.push({input:frame,left:n%columns*widthSize,top:Math.floor(n/columns)*heightSize});
    const preview=await sharp(frame).resize(144,96).png().toBuffer();
    boards.push({input:preview,left:local%8*144,top:50+directionIndex*650+Math.floor(local/8)*96});
    records.push({角色:label,方向:directions[dir],动作:local<4?'待机':local<12?'移动':local<24?'攻击':local<28?'受击':local<36?'死亡':'弹反',图集帧:n,源图:source,源格:box,裁切:tight,缩放:scale,锚点:[widthSize/2,rootY],摘要:createHash('sha256').update(frame).digest('hex'),状态:'运行样片，主观美术待验收'});
   }
  }
 }
 await sharp({create:{width:widthSize*columns,height:heightSize*Math.ceil(144/columns),channels:4,background:'#00000000'}}).composite(frames).png().toFile(`${out}/${id}.png`);
 const caption=Buffer.from(`<svg width="1152" height="1950"><style>text{font:22px sans-serif;fill:#233f34}</style>${Object.values(directions).map((dir,i)=>`<text x="12" y="${32+i*650}">${label} · ${dir} · 待机／移动／攻击／受击／死亡／弹反</text>`).join('')}</svg>`);
 await sharp({create:{width:1152,height:1950,channels:3,background:'#eee8d8'}}).composite([...boards,{input:caption}]).png().toFile(`${root}/boards/${id}.png`);
}
if(new Set(records.map(r=>r.摘要)).size!==288)throw Error('存在完全重复的帧');
await writeFile(`${root}/manifest.json`,JSON.stringify({说明:'两种怪物，三实际方向，左向仅由 Actor 镜像；每方向四十八独立姿态；透明通道去除低于八的背景残留；显示高度与战斗参数不变',单格:[widthSize,heightSize],基准身体高度:nativeHeight,帧:records},null,2)+'\n');
console.log('已打包两种森林怪物、二百八十八个独立姿态。');
