// 只裁切生成姿态并打包图集，不绘制新姿态，不复制帧凑数。
import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root='docs/first-map/enemies',out='public/assets/enemies-v1';
const names={'thorn-wolf':'荆棘狼','burrow-worm':'潜地虫','moss-guardian':'苔甲守卫'};
const dirs={down:'朝下',up:'朝上',right:'朝右'};
const records=[];
function bounds(data,w,h,axis,count){
 const n=axis===0?w:h,counts=Array(n).fill(0);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]>65)counts[axis===0?x:y]++;
 return [0,...Array.from({length:count-1},(_,i)=>{const ideal=n*(i+1)/count,r=n/count*.18;let best=Math.round(ideal);for(let p=Math.floor(ideal-r);p<=ideal+r;p++)if(counts[p]<counts[best]||counts[p]===counts[best]&&Math.abs(p-ideal)<Math.abs(best-ideal))best=p;return best;}),n];
}
function trim(data,w,h){let x0=w,y0=h,x1=-1,y1=-1;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]>25){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}if(x1<0)throw Error('出现空帧');return {left:x0,top:y0,width:x1-x0+1,height:y1-y0+1};}
await mkdir(out,{recursive:true});await mkdir(`${root}/boards`,{recursive:true});
for(const [name,label] of Object.entries(names)){
 const composite=[],board=[];let referenceHeight;
 for(const [di,dir] of Object.keys(dirs).entries()){
  const source=`${root}/source/${name}-${dir}${name==='burrow-worm'&&dir==='up'?'-fix':''}.png`,{data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let zeros=0;for(let a=3;a<data.length;a+=4)zeros+=data[a]===0?1:0;if(zeros/info.width/info.height<.2)throw Error(`${source}缺少透明背景`);
  const ys=bounds(data,info.width,info.height,1,6);const cells=[];
  for(let row=0;row<6;row++){
   const strip=await sharp(source).extract({left:0,top:ys[row],width:info.width,height:ys[row+1]-ys[row]}).ensureAlpha().raw().toBuffer();
   const xs=bounds(strip,info.width,ys[row+1]-ys[row],0,4);
   for(let col=0;col<4;col++){
    const box={left:xs[col],top:ys[row],width:xs[col+1]-xs[col],height:ys[row+1]-ys[row]},raw=await sharp(source).extract(box).ensureAlpha().raw().toBuffer(),tight=trim(raw,box.width,box.height);
    cells.push({box,tight});
   }
  }
  referenceHeight??=cells[0].tight.height;
  const scale=60/referenceHeight;
  for(const [i,{box,tight}] of cells.entries()){
   const w=Math.round(tight.width*scale),h=Math.round(tight.height*scale);if(w>=156||h>=134)throw Error(`${source}第${i+1}帧超出画布`);
   const input=await sharp(source).extract({left:box.left+tight.left,top:box.top+tight.top,width:tight.width,height:tight.height}).resize(w,h).png().toBuffer();
   const raw=await sharp(input).ensureAlpha().raw().toBuffer();let l=w,r=0;
   for(let y=Math.floor(h*.82);y<h;y++)for(let x=0;x<w;x++)if(raw[(y*w+x)*4+3]>65){l=Math.min(l,x);r=Math.max(r,x);}
   const left=Math.round(80-(l+r)/2),top=Math.round(137.5-h);if(left<1||left+w>159)throw Error(`${source}第${i+1}帧越界`);
   const frame=await sharp({create:{width:160,height:160,channels:4,background:'#00000000'}}).composite([{input,left,top}]).png().toBuffer();
   const n=di*24+i,hash=createHash('sha256').update(frame).digest('hex');
   composite.push({input:frame,left:n%12*160,top:Math.floor(n/12)*160});
   board.push({input:frame,left:i%6*160,top:60+di*700+Math.floor(i/6)*160});
   records.push({角色:label,方向:dirs[dir],动作:i<4?'待机':i<8?'移动':i<12?'攻击前摇':i<16?'攻击与收招':i<20?'受击':'死亡',图集帧:n,源图:source,源格:box,裁切:tight,缩放:scale,锚点:[80,137.5],摘要:hash,状态:'候选待运行审阅'});
  }
 }
 await sharp({create:{width:1920,height:960,channels:4,background:'#00000000'}}).composite(composite).png().toFile(`${out}/${name}.png`);
 const caption=Buffer.from(`<svg width="960" height="2160"><style>text{font:24px sans-serif;fill:#233f34}</style>${Object.values(dirs).map((dir,i)=>`<text x="16" y="${36+i*700}">${label} · ${dir} · 候选待审阅</text>`).join('')}</svg>`);
 await sharp({create:{width:960,height:2160,channels:3,background:'#eee8d8'}}).composite([...board,{input:caption}]).png().toFile(`${root}/boards/${name}.png`);
}
if(new Set(records.map(r=>r.摘要)).size!==216)throw Error('姿态重复');
await writeFile(`${root}/manifest.json`,JSON.stringify({说明:'内置imagegen生成的216个候选独立姿态；机械裁切打包；左右仅运行时镜像；不代表正式验收通过',帧:records},null,2));
console.log('已打包三种敌人、九个方向动作表、216个独立姿态与联系图。');
