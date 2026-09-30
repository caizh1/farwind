// 只切分已生成的独立姿态；不重绘、不复制姿态凑帧。方向和动作行分别保存。
import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root='docs/camp-bosses',out='public/assets/camp-bosses';
const counts={
 'spore-heart':[[9,9,9,9,9,9,9],[9,8,8,8,8,8,8],[6,8,8,8,8,8,8]],
 'thorn-crown':[[8,8,8,8,8,8,8],[8,8,8,8,8,8,8],[8,7,8,7,7,8,8]],
 'crag-tusk':[[9,9,9,9,9,9,8],[8,8,8,8,8,8,8],[8,8,8,8,8,8,8]],
 'bound-branch':[[8,8,8,8,8,8,8],[8,8,8,8,8,8,8],[9,9,8,8,9,8,8]],
};
const dirs=['down','up','right'],records=[],art={};
function cuts(data,w,h,axis,count){const n=axis?w:h,project=Array(n).fill(0);for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]>65)project[axis?x:y]++;
 if(axis){
  // 动作占宽不一致，先以透明间隙分开主体，避免等分线切断跃扑、枝镰或倒地。
  const spans=[];let start=-1;for(let x=0;x<=n;x++){if(project[x]>0&&start<0)start=x;else if(!project[x]&&start>=0){if(x-start>12)spans.push({start,end:x,parts:1});start=-1;}}
  if(spans.length<=count&&spans.length){
   for(let left=count-spans.length;left>0;left--){const widest=spans.reduce((a,b)=>(b.end-b.start)/(b.parts+1)>(a.end-a.start)/(a.parts+1)?b:a);widest.parts++;}
   const result=[0];for(const [i,s] of spans.entries()){
    for(let part=1;part<s.parts;part++){const ideal=s.start+(s.end-s.start)*part/s.parts,r=(s.end-s.start)/s.parts*.23;let best=Math.round(ideal);for(let p=Math.ceil(ideal-r);p<=Math.floor(ideal+r);p++)if(project[p]<project[best]||project[p]===project[best]&&Math.abs(p-ideal)<Math.abs(best-ideal))best=p;result.push(best);}
    if(i<spans.length-1)result.push(Math.round((s.end+spans[i+1].start)/2));
   }result.push(n);return result;
  }
 }
 return [0,...Array.from({length:count-1},(_,i)=>{const ideal=n*(i+1)/count,r=n/count*.25;let best=Math.round(ideal);for(let p=Math.max(0,Math.floor(ideal-r));p<=Math.min(n-1,Math.ceil(ideal+r));p++)if(project[p]<project[best]||project[p]===project[best]&&Math.abs(p-ideal)<Math.abs(best-ideal))best=p;return best;}),n];}
function trim(data,w,h){let l=w,t=h,r=-1,b=-1;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]>25){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}if(r<l)throw Error('动作表出现空姿态');return {left:l,top:t,width:r-l+1,height:b-t+1};}
await mkdir(out,{recursive:true});await mkdir(root+'/previews',{recursive:true});
for(const [key,rows] of Object.entries(counts)){
 const frames=[],previews=[];let scale;art[key]={rows,frameSize:160,foot:[80,137.5],nativeHeight:64,directions:dirs,anchors:{}};
 for(const [di,dir] of dirs.entries()){
  const source=`${root}/source/${key}-${dir}.png`,{data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let transparent=0;for(let p=3;p<data.length;p+=4)if(data[p]===0)transparent++;if(transparent/info.width/info.height<.2)throw Error('动作表缺少真实透明背景');
  const ys=cuts(data,info.width,info.height,0,7);
  for(let row=0;row<7;row++){
   const strip=await sharp(source).extract({left:0,top:ys[row],width:info.width,height:ys[row+1]-ys[row]}).ensureAlpha().raw().toBuffer(),xs=cuts(strip,info.width,ys[row+1]-ys[row],1,rows[di][row]);
   for(let col=0;col<rows[di][row];col++){
    const box={left:xs[col],top:ys[row],width:xs[col+1]-xs[col],height:ys[row+1]-ys[row]},raw=await sharp(source).extract(box).ensureAlpha().raw().toBuffer(),tight=trim(raw,box.width,box.height);
    scale??=64/tight.height;
    const width=Math.round(tight.width*scale),height=Math.round(tight.height*scale);if(width>=156||height>130)throw Error(`${key} ${dir} ${row} ${col} 的姿态超出画布`);
    const input=await sharp(source).extract({left:box.left+tight.left,top:box.top+tight.top,width:tight.width,height:tight.height}).resize(width,height).png().toBuffer();
    const footRaw=await sharp(input).ensureAlpha().raw().toBuffer();let leftFoot=width,rightFoot=0;for(let y=Math.floor(height*.88);y<height;y++)for(let x=0;x<width;x++)if(footRaw[(y*width+x)*4+3]>65){leftFoot=Math.min(leftFoot,x);rightFoot=Math.max(rightFoot,x);}
    const left=Math.max(1,Math.min(159-width,Math.round(80-(leftFoot+rightFoot)/2))),top=Math.round(137.5-height);
    const frame=await sharp({create:{width:160,height:160,channels:4,background:'#00000000'}}).composite([{input,left,top}]).png().toBuffer(),index=di*63+row*9+col,hash=createHash('sha256').update(frame).digest('hex');
    art[key].anchors[index]=[(left+(leftFoot+rightFoot)/2)/160,137.5/160];
    frames.push({input:frame,left:index%12*160,top:Math.floor(index/12)*160});previews.push({input:frame,left:col*160,top:di*1200+row*160+64});
    records.push({角色:key,方向:dir,动作行:row,列:col,图集帧:index,源图:source,源格:box,裁切:tight,缩放:scale,脚底根:[left+(leftFoot+rightFoot)/2,137.5],摘要:hash,状态:'已打包，运行审阅待验证'});
   }
  }
 }
 await sharp({create:{width:1920,height:2560,channels:4,background:'#00000000'}}).composite(frames).png().toFile(`${out}/${key}.png`);
 await sharp({create:{width:1440,height:3600,channels:3,background:'#eee8d8'}}).composite(previews).resize({width:1152}).png().toFile(`${root}/previews/${key}.png`);
}
if(new Set(records.map(r=>r.摘要)).size!==records.length)throw Error('动作表存在重复姿态');
await writeFile(root+'/manifest.json',JSON.stringify({说明:'四个独立首领的生成姿态机械打包；每行保留实际独立姿态数，不补复制帧；左向运行时镜像。',角色:art,帧:records},null,2));
await writeFile('src/data/campBossArt.ts',`// 由透明动作表打包工具生成：实际独立姿态数量与脚底根。\nexport const CAMP_BOSS_ART=${JSON.stringify(art)} as const;\n`);
console.log(`已打包四位首领的 ${records.length} 个独立姿态。`);
