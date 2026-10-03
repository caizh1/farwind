import sharp from "sharp";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
const root="public/assets/water-effects";await mkdir(root,{recursive:true});
const fountain="public/assets/village-polish/plaza-fountain.png", pond="public/assets/village-polish/pond-water.png";
const records=[];
async function save(id,buffer,purpose,source,extra={}) {
  const file=`${root}/${id}.png`;await writeFile(file,buffer);const m=await sharp(buffer).metadata();
  const rgba=await sharp(buffer).ensureAlpha().raw().toBuffer();let zero=0,semi=0,l=m.width,t=m.height,r=-1,b=-1;
  for(let y=0;y<m.height;y++)for(let x=0;x<m.width;x++){const a=rgba[(y*m.width+x)*4+3];if(!a)zero++;else{if(a<255)semi++;l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}}
  records.push({ID:id,文件:`water-effects/${id}.png`,源文件:source,尺寸:[m.width,m.height],透明通道:m.hasAlpha,透明像素:zero,半透明像素:semi,有效内容边界:{left:l,top:t,width:r-l+1,height:b-t+1},用途:purpose,来源:"正式手绘素材的可复现局部裁切及透明分离；荷叶/荷花使用内置imagegen",是否临时:false,摘要:createHash("sha256").update(buffer).digest("hex"),验证状态:"待真实动画验收",锚点:id.includes("mask")||id==="water-flow"?[0,0]:[0.5,0.5],碰撞占地:"无，纯环境显示；喷泉与桥沿用现有地图数据",...extra});
}
const {data:f,info:fi}=await sharp(fountain).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const wet=(r,g,b)=>g>r+5&&b>r-5 || r>185&&g>r-5&&b>r-10;
const flow=Buffer.alloc(f.length),pool=Buffer.alloc(f.length);
for(let y=0;y<fi.height;y++)for(let x=0;x<fi.width;x++) {
  const i=(y*fi.width+x)*4,r=f[i],g=f[i+1],b=f[i+2];
  const jet=((x-195)/8)**2+((y-55)/35)**2<1;
  const streams=[[128,132,244],[195,142,270],[262,128,244]].some(([center,top,bottom])=>y>=top&&y<=bottom&&Math.abs(x-center-Math.sin(y*.14)*.5)<(y>bottom-10?5:1.8));
  if(f[i+3]>100&&(jet||streams)) {flow[i]=flow[i+1]=flow[i+2]=255;flow[i+3]=f[i+3];}
  // 新重绘喷泉按真实青蓝水域排除石柱和池沿，与材质打包脚本一致。
  if(y>166&&g-r>9&&b-r>12&&f[i+3]>100) {pool[i]=pool[i+1]=pool[i+2]=255;pool[i+3]=Math.min(f[i+3],Math.max(0,Math.min(g-r,b-r)-8)*16);}
}
await save("water-flow-mask",await sharp(flow,{raw:{width:fi.width,height:fi.height,channels:4}}).png().toBuffer(),"与原喷泉三个细水流及顶部出水重合的alpha遮罩",fountain);
await save("water-basin-mask",await sharp(pool,{raw:{width:fi.width,height:fi.height,channels:4}}).png().toBuffer(),"按原图真实水色和alpha裁切内池，排除石柱及前池沿，不叠画主体或阴影",fountain);
async function extract(rect,fn,width,height) {
  const {data,info}=await sharp(fountain).extract(rect).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(let i=0;i<data.length;i+=4)data[i+3]=Math.round(data[i+3]*fn(data[i],data[i+1],data[i+2]));
  return sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).resize(width,height).png().toBuffer();
}
let pattern=await extract({left:184,top:175,width:17,height:70},(r,g,b)=>wet(r,g,b)?1:0,32,128);
const {data:strip}=await sharp(pattern).raw().toBuffer({resolveWithObject:true});
// 只延拓首尾8行，保留中间手绘笔触；端点逐通道相同，垂直重复不产生接缝。
for(let x=0;x<32;x++)for(let k=0;k<4;k++) {
  const avg=(strip[x*4+k]+strip[(127*32+x)*4+k])/2;
  for(let y=0;y<8;y++)for(const row of [y,127-y]) {const i=(row*32+x)*4+k;strip[i]=Math.round(avg*(1-y/8)+strip[i]*(y/8));}
}
await save("water-flow",await sharp(strip,{raw:{width:32,height:128,channels:4}}).png().toBuffer(),"原喷泉笔触提取的连续落水纹，垂直纹理坐标移动",fountain,{显示方式:"低透明度叠加，遮罩与原静态流重合，不另造悬空水流"});
const flowBuffer=await readFile(`${root}/water-flow.png`);
await sharp({create:{width:96,height:384,channels:4,background:"#00000000"}}).composite(Array.from({length:9},(_,i)=>({input:flowBuffer,left:i%3*32,top:Math.floor(i/3)*128}))).resize(192,768,{kernel:"nearest"}).png().toFile("docs/water-effects/flow-repeat-diagnostic.png");
let vertical=0,horizontal=0;
for(let x=0;x<32;x++)for(let c=0;c<4;c++)vertical=Math.max(vertical,Math.abs(strip[x*4+c]-strip[(127*32+x)*4+c]));
for(let y=0;y<128;y++)for(let c=0;c<4;c++)horizontal=Math.max(horizontal,Math.abs(strip[y*32*4+c]-strip[(y*32+31)*4+c]));
await writeFile("docs/water-effects/flow-edge-check.json",JSON.stringify({说明:"流水只沿垂直方向移动；横向不宣称无缝平铺，且由原流水形状遮罩限定。池塘的三种局部贴片不平铺。",垂直首尾最大通道差:vertical,水平首尾最大通道差:horizontal},null,2));
const foam=(r,g,b)=>Math.max(0,Math.min(1,(Math.min(r,g,b)-165)/65));
await save("water-ripple",await extract({left:96,top:236,width:52,height:25},foam,104,50),"原落水涟漪的手绘白色弧线，扩散渐隐复用",fountain);
await save("water-splash",await extract({left:109,top:219,width:28,height:29},foam,56,58),"原喷泉落水泡沫及飞溅的透明贴片",fountain);
await save("water-drop",await extract({left:184,top:93,width:10,height:15},foam,20,30),"原顶部喷口局部水滴笔触，按高光分离自然透明边缘",fountain);
const patches=[];
for(const [left,top] of [[70,310],[370,330],[630,570]]) {
  const {data,info}=await sharp(pond).extract({left,top,width:256,height:160}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(let y=0;y<160;y++)for(let x=0;x<256;x++) {
    const i=(y*256+x)*4,feather=Math.min(1,x/16,(255-x)/16,y/12,(159-y)/12);
    data[i+3]=Math.round(Math.max(0,Math.min(180,(data[i+1]-158)*3+(data[i]-120)*1.2))*feather);
  }
  patches.push(await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer());
}
const atlas=await sharp({create:{width:768,height:160,channels:4,background:"#00000000"}}).composite(patches.map((input,i)=>({input,left:i*256,top:0}))).png().toBuffer();
await save("water-waves",atlas,"三处不同原池水笔触提取的局部反光，非平铺；池水主体使用原纹理局部采样起伏",pond,{帧尺寸:[256,160],帧数:3,处理:"仅贴片边缘alpha渐变，未模糊整片水面或镜像拼贴"});
for(const [id,w,h] of [["water-lily",80,48],["water-flower",32,24]]) {
  const source=`${root}/${id}-source.png`;
  try{await access(source);}catch{continue;}
  const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});let l=info.width,t=info.height,r=-1,b=-1,zero=0;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const a=data[(y*info.width+x)*4+3];if(!a)zero++;if(a>2){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}}
  if(!zero||r<0)throw Error("生成素材缺少真实透明背景");
  l=Math.max(0,l-3);t=Math.max(0,t-3);r=Math.min(info.width-1,r+3);b=Math.min(info.height-1,b+3);
  const crop={left:l,top:t,width:r-l+1,height:b-t+1};
  await save(id,await sharp(source).extract(crop).resize(w,h,{fit:"contain",background:"#00000000"}).png().toBuffer(),id==="water-lily"?"围绕原18个固定锚点微浮动的手绘荷叶":"随所属荷叶同步运动的手绘小荷花",`water-effects/${id}-source.png`,{源尺寸:[info.width,info.height],源有效裁切:crop,显示尺寸:id==="water-lily"?[20,12]:[8,6]});
}
const path="public/assets/manifest.json",m=JSON.parse(await readFile(path,"utf8"));
const display={"water-flow-mask":[140,168],"water-basin-mask":[140,168],"water-flow":[140,168],"water-ripple":"喷泉基础21×10.08、池塘64×26，再乘0.45至1.5的扩散比例","water-splash":[9.1,10.92],"water-drop":[1.96,3.528],"water-waves":"反光42×18，共4处，错相渐隐；原12张漂移水纹已移除"};
for(const record of records)if(display[record.ID])record.显示尺寸=display[record.ID];
for(const record of records){const previous=m.资源.find(r=>r.ID===record.ID);if(previous?.摘要===record.摘要){record.验证状态=previous.验证状态;}}
m.资源=[...m.资源.filter(r=>!records.some(n=>n.ID===r.ID)),...records];await writeFile(path,JSON.stringify(m,null,2));
await writeFile("docs/water-effects/asset-processing.json",JSON.stringify({说明:"不重画石质主体。水纹贴片来自原手绘图片，荷叶/荷花由内置imagegen生成；运行纹理不在每帧重建。",资源:records},null,2));
console.log(`已处理${records.length}项水效素材`);
