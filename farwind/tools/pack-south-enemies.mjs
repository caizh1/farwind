import sharp from 'sharp';
import {mkdir,writeFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const source='docs/combat-expansion/source',output='public/assets/enemies-v1',root=[80,137.5];
await mkdir(output,{recursive:true});
const manifest={说明:'南线手绘候选素材；格子提取、脚底对齐及透明通道已记录。固定预览与正式战斗需分别验收。',素材:[]};
async function frame(file,columns,rows,row,col){
 const {width,height}=await sharp(file).metadata();
 // 生成源稿的留白分隔并不完全等宽，以前景密度最低的分隔处提取，禁止压缩角色比例凑格。
 const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const density=[];for(let y=0;y<height;y++){let n=0;for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>65)n++;density.push(n);}
 const rowCuts=[0];for(let r=1;r<rows;r++){const c=height*r/rows,margin=height/rows*.45;let best=Math.round(c),score=Infinity;
  for(let y=Math.max(rowCuts.at(-1)+20,Math.floor(c-margin));y<Math.min(height,c+margin);y++){const v=density[y]+Math.abs(y-c)*.025;if(v<score){best=y;score=v;}}rowCuts.push(best);}rowCuts.push(height);
 const top=rowCuts[row],bottom=rowCuts[row+1],counts=[];
 for(let x=0;x<width;x++){let count=0;for(let y=top;y<bottom;y++)if(data[(y*width+x)*4+3]>65)count++;counts.push(count);}
 let runs=[],start=null;for(let x=0;x<width;x++){if(counts[x]>3&&start===null)start=x;if(counts[x]<=3&&start!==null){runs.push([start,x]);start=null;}}if(start!==null)runs.push([start,width]);
 runs=runs.filter(([a,b])=>b-a>=10);
 while(runs.length>columns){let best=0,gap=Infinity;for(let i=0;i<runs.length-1;i++){const d=runs[i+1][0]-runs[i][1];if(d<gap){gap=d;best=i;}}runs.splice(best,2,[runs[best][0],runs[best+1][1]]);}
 if(runs.length!==columns)throw Error(`素材列数异常：${file} 第${row+1}行，需要${columns}列，识别${runs.length}列`);
 const cuts=[0,...runs.slice(1).map((r,i)=>Math.round((r[0]+runs[i][1])/2)),width];
 let left=cuts[col],right=cuts[col+1],minX=right,minY=bottom,maxX=left,maxY=top;
 for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)if(data[(y*width+x)*4+3]>65){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
 if(maxX<=minX||maxY<=minY)throw Error(`素材格为空：${file} 第${row+1}行第${col+1}格`);
 const box={left:minX,top:minY,width:maxX-minX+1,height:maxY-minY+1};
 return {file,box,buffer:await sharp(file).extract(box).toBuffer()};
}
for(const [kind,columns] of [['fungal-priest',13],['sac-roller',12]]){
 const sheet=`${source}/${kind}-sheet.png`,cells=[];
 for(let direction=0;direction<3;direction++){
  if(kind==='fungal-priest'&&direction===1){for(let i=0;i<24;i++)cells.push(await frame(`${source}/fungal-priest-back.png`,4,6,Math.floor(i/4),i%4));continue;}
  // 祭司源稿多出一列；逐段取关键姿态，明确保留举铃末帧与四帧死亡。
  const first=columns===13?[0,1,2,3,4,5,6,7,8,9,11,12]:Array.from({length:12},(_,i)=>i);
  const second=columns===13?[0,1,2,3,4,5,7,8,9,10,11,12]:Array.from({length:12},(_,i)=>i);
  for(const col of first)cells.push(await frame(sheet,columns,6,direction*2,col));
  for(const col of second)cells.push(await frame(sheet,columns,6,direction*2+1,col));
 }
 const scales=Array.from({length:3},(_,d)=>60/Math.max(...cells.slice(d*24,d*24+8).map(c=>c.box.height))),layers=[],records=[];
 for(const [i,c] of cells.entries()){
  const scale=scales[Math.floor(i/24)],w=Math.max(1,Math.round(c.box.width*scale)),h=Math.max(1,Math.round(c.box.height*scale));
  if(w>150||h>130)throw Error(`角色超出格子：${kind} 第${i+1}帧`);
  const pixels=await sharp(c.buffer).resize(w,h).toBuffer(),left=Math.round(root[0]-w/2),top=Math.round(root[1]-h);
  const cell=await sharp({create:{width:160,height:160,channels:4,background:'#00000000'}}).composite([{input:pixels,left,top}]).png().toBuffer();
  layers.push({input:cell,left:i%12*160,top:Math.floor(i/12)*160});records.push({帧:i,来源:c.file,提取:c.box,落地根:root,摘要:createHash('sha256').update(cell).digest('hex')});
 }
 await sharp({create:{width:1920,height:960,channels:4,background:'#00000000'}}).composite(layers).png().toFile(`${output}/${kind}.png`);
 manifest.素材.push({名称:kind==='fungal-priest'?'菌铃祭司':'爆囊滚兽',文件:`${output}/${kind}.png`,帧数:72,方向:['朝下','朝上','朝右'],缩放:scales,姿态:records});
}
try{await access(`${source}/fungal-root.png`);
 const file=`${source}/fungal-root.png`,m=await sharp(file).trim().metadata(),{data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let l=info.width,t=info.height,r=0,b=0;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>65){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}
 const pixels=await sharp(file).extract({left:l,top:t,width:r-l+1,height:b-t+1}).resize({height:65}).toBuffer(),size=await sharp(pixels).metadata();
 await sharp({create:{width:160,height:160,channels:4,background:'#00000000'}}).composite([{input:pixels,left:Math.round(80-size.width/2),top:Math.round(137.5-size.height)}]).png().toFile(`${output}/fungal-root.png`);
 manifest.素材.push({名称:'孢根祭根',文件:`${output}/fungal-root.png`,落地根:root});
}catch(e){if(e.code!=='ENOENT')throw e;}
await writeFile('docs/combat-expansion/manifest.json',JSON.stringify(manifest,null,2));
console.log('南线图集打包完成，动作与透明通道验收记录已写入。');
