import sharp from 'sharp';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const records=[];
for(const id of ['grass','road','forest']){
  const source=`docs/art-quality/${id}-source.png`,target=`public/assets/${id}.png`;
  await sharp(source).resize(768,768,{fit:'fill'}).png().toFile(target);
  records.push({标识:id,源文件:source,运行文件:target,尺寸:[768,768],用途:'手绘地面底纹，运行时只羽化24像素对边，不镜像整块纹样',状态:'等待真实运行画面验收'});
}
await sharp('public/assets/village-polish/pond-water.png').resize(768,768).png().toFile('public/assets/water.png');
records.push({标识:'water',源文件:'public/assets/village-polish/pond-water.png',运行文件:'public/assets/water.png',尺寸:[768,768],用途:'野外池塘和溪流复用村湖的手绘水纹，统一水景笔触',状态:'等待真实运行画面验收'});
const fountain='public/assets/village-polish/plaza-fountain.png';
await sharp('docs/art-quality/fountain-source.png').resize(390,390).png().toFile(fountain);
const {data}=await sharp(fountain).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const basin=Buffer.alloc(390*390*4),flow=Buffer.alloc(390*390*4);
for(let y=0;y<390;y++)for(let x=0;x<390;x++){
  const i=(y*390+x)*4,r=data[i],g=data[i+1],b=data[i+2],alpha=data[i+3];
  // 从新原图提取真实青蓝水域，排除池沿、石柱和上池。
  const water=y>166&&g-r>9&&b-r>12&&alpha>100;
  basin[i]=basin[i+1]=basin[i+2]=255;basin[i+3]=water?Math.min(alpha,Math.max(0,Math.min(g-r,b-r)-8)*16):0;
  const jet=((x-195)/8)**2+((y-55)/35)**2<1;
  const streams=[[128,132,244],[195,142,270],[262,128,244]].some(([center,top,bottom])=>y>=top&&y<=bottom&&Math.abs(x-center-Math.sin(y*.14)*.5)<(y>bottom-10?5:1.8));
  flow[i]=flow[i+1]=flow[i+2]=255;flow[i+3]=alpha>100&&(jet||streams)?alpha:0;
}
await sharp(basin,{raw:{width:390,height:390,channels:4}}).png().toFile('public/assets/water-effects/water-basin-mask.png');
await sharp(flow,{raw:{width:390,height:390,channels:4}}).png().toFile('public/assets/water-effects/water-flow-mask.png');
records.push({标识:'fountain',源文件:'docs/art-quality/fountain-source.png',运行文件:fountain,尺寸:[390,390],用途:'重绘喷泉主体，水域和流水遮罩按新原图重建',状态:'等待真实运行画面验收'});
const names=['flowers-white','flowers-gold','flowers-pink','shrub-one','shrub-two','shrub-three'];
for(const [i,name]of names.entries()){
  const row=i<3?0:1,target=`public/assets/art-quality/${name}.webp`,width=row?192:160,height=row?160:96;
  // 分两步确保trim只定位本格透明边缘，不提前裁掉整张图集再应用原坐标。
  const cell=await sharp('docs/art-quality/decor-source.png').extract({left:(i%3)*512,top:row?480:0,width:512,height:row?544:480}).png().toBuffer();
  await sharp(cell).trim({threshold:10}).resize(width,height,{fit:'contain',position:'bottom',background:'#00000000'}).webp({lossless:true}).toFile(target);
  const {data,info}=await sharp(target).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let zero=0;for(let j=3;j<data.length;j+=4)if(data[j]===0)zero++;
  if(zero<info.width*info.height*.08)throw Error(`${name}透明边缘不合格`);
  records.push({标识:name,源文件:'docs/art-quality/decor-source.png',运行文件:target,尺寸:[width,height],用途:row?'不规则树篱外观变体':'墙脚、岸边与喷泉低矮花簇',状态:'等待真实运行画面验收'});
}
const bridge='public/assets/level-rework/bridge-candidate.png';
await sharp('docs/art-quality/bridge-source.png').trim({threshold:12}).resize(1152,360,{fit:'fill'}).png().toFile(bridge);
records.push({标识:'bridge',源文件:'docs/art-quality/bridge-source.png',运行文件:bridge,尺寸:[1152,360],用途:'手绘木纹、磨损、钉头与边梁；桥位及通行尺寸保持原值',状态:'等待真实运行画面验收'});
for(const [id,left,width,w,h] of [['plaque',0,860,224,72],['training-book',860,676,144,128]]){
  const cell=await sharp('docs/art-quality/props-source.png').extract({left,top:0,width,height:1024}).png().toBuffer();
  const target=`public/assets/art-quality/${id}.webp`;
  await sharp(cell).trim({threshold:10}).resize(w,h,{fit:'fill'}).webp({lossless:true}).toFile(target);
  records.push({标识:id,源文件:'docs/art-quality/props-source.png',运行文件:target,尺寸:[w,h],用途:id==='plaque'?'手绘空白店招，中文店名仍由程序叠加':'手绘羊皮纸训练书和雕刻木架',状态:'等待真实运行画面验收'});
}
await writeFile('docs/art-quality/material-manifest.json',JSON.stringify({说明:'内置图像生成；设计图只提供材质风格，地图布局保持现有游戏；没有图片滤镜冒充材质重绘',素材:records},null,2));
const path='public/assets/manifest.json',manifest=JSON.parse(await readFile(path,'utf8'));
for(const r of records){
  const file=r.运行文件.replace('public/assets/',''),old=manifest.资源.find(a=>a.文件===file),bytes=await readFile(r.运行文件),meta=await sharp(bytes).metadata();
  const record={...(old??{}),ID:old?.ID??`quality-${r.标识}`,文件:file,源文件:r.源文件,用途:r.用途,来源:'内置图像生成，设计图仅作材质风格参考；可复现切图见tools/pack-art-quality.mjs',尺寸:[meta.width,meta.height],透明通道:meta.hasAlpha,摘要:createHash('sha256').update(bytes).digest('hex'),是否临时:false,验证状态:'当前运行截图待验收，最终美术待用户确认'};
  for(const key of ['源有效裁切','运行有效边界','源透明度范围','源透明像素','源半透明像素','运行透明度范围'])delete record[key];
  if(r.标识==='fountain'){record.显示尺寸=[140,168];record.碰撞占地=[35,28];record.动画='高柱细流水，内池涟漪和水滴遮罩';}
  if(old)manifest.资源[manifest.资源.indexOf(old)]=record;else manifest.资源.push(record);
}
for(const key of ['flow-mask','basin-mask']){
  const file=`water-effects/water-${key}.png`,record=manifest.资源.find(a=>a.文件===file);
  if(record){record.摘要=createHash('sha256').update(await readFile(`public/assets/${file}`)).digest('hex');record.用途='从本轮重绘喷泉生成的真实流水或水域遮罩';record.验证状态='当前运行截图待验收';for(const key of ['透明像素','半透明像素','有效内容边界'])delete record[key];}
}
await writeFile(path,JSON.stringify(manifest,null,2));
const legacyPath='docs/visual-polish/asset-processing.json',legacy=JSON.parse(await readFile(legacyPath,'utf8'));
legacy.资源=legacy.资源.map(r=>r.ID==='fountain'?manifest.资源.find(n=>n.ID==='fountain'):r);
await writeFile(legacyPath,JSON.stringify(legacy,null,2));
console.log('十四项材质和景观素材、水效遮罩已打包，透明通道验证通过');
