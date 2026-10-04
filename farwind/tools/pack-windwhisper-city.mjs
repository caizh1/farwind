// 独立构件裁切与怪物图集打包，不改变原始绘制内容。
import sharp from 'sharp';
import fs from 'node:fs/promises';
const base='docs/windwhisper-city/design/';
const out='public/assets/windwhisper-city/';
await fs.mkdir(out,{recursive:true});
const names=['gate-north','gate-south','gate-beam','wind-tower','wall','stone-bridge'];
const building=base+'buildings-source.png';
let m=await sharp(building).metadata(); console.log('建筑',m.width,m.height,m.hasAlpha);
for(let i=3;i<6;i++){const w=Math.floor(m.width/3),h=Math.floor(m.height/2);const tile=await sharp(building).extract({left:(i%3)*w,top:Math.floor(i/3)*h,width:w,height:h}).png().toBuffer();await sharp(tile).trim().png().toFile(out+names[i]+'.png');}
const towers=base+'gate-towers-source.png';const towerMeta=await sharp(towers).metadata();
for(let i=0;i<2;i++){const half=Math.floor(towerMeta.width/2);const tile=await sharp(towers).extract({left:i*half,top:0,width:half,height:towerMeta.height}).png().toBuffer();await sharp(tile).trim().png().toFile(out+names[i]+'.png');}
await sharp(base+'gate-beam-source.png').trim().png().toFile(out+'gate-beam.png');
const sprite=['hunter-source.png','lancer-source.png','axeman-source.png'];
for(let i=0;i<3;i++){const file=base+sprite[i]; const m=await sharp(file).metadata(); const w=Math.floor(m.width/8),h=Math.floor(m.height/6);let tiles=[];for(let j=0;j<48;j++){const data=await sharp(file).extract({left:(j%8)*w,top:Math.floor(j/8)*h,width:w,height:h}).resize(160,160,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();tiles.push({input:data,left:j%8*160,top:Math.floor(j/8)*160});}await sharp({create:{width:1280,height:960,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(tiles).png().toFile(out+['canyonHunter','cliffLancer','cragAxeman'][i]+'.png');console.log('怪物',m.width,m.height,m.hasAlpha);}
