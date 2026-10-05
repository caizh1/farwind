import sharp from 'sharp';
import {readdir,writeFile} from 'node:fs/promises';
// 读取正式人物帧，记录实际鞋底支撑范围；不重绘、裁切或替换原图。
const folder='public/assets/windwhisper-city/completion',contacts={};let count=0;
for(const name of (await readdir(folder)).filter(n=>n.endsWith('-walk.webp')||['guard-actions-v2.webp','citizen-actions-v2.webp'].includes(n)).sort()){
 const {data,info}=await sharp(`${folder}/${name}`).ensureAlpha().raw().toBuffer({resolveWithObject:true}),columns=info.width/256,frames=[];
 for(let f=0;f<columns*info.height/256;f++){
  let bottom=0;const alpha=(x,y)=>data[((Math.floor(f/columns)*256+y)*info.width+f%columns*256+x)*4+3];
  for(let y=200;y<256;y++)for(let x=0;x<256;x++)if(alpha(x,y)>=200)bottom=Math.max(bottom,y+1);
  let left=256,right=-1;for(let y=bottom-3;y<bottom;y++)for(let x=0;x<256;x++)if(alpha(x,y)>=200){left=Math.min(left,x);right=Math.max(right,x);}
  if(right<left||Math.abs(bottom-256*.94)*100/256>=.5)throw Error(`${name} 第${f+1}帧鞋底位置需要人工复核。`);
  frames.push([left,right+1,bottom]);count++;
 }
 contacts[`city-complete-${name.slice(0,-5)}`]=frames;
}
await writeFile('src/data/cityFootContacts.json',JSON.stringify(contacts,null,2)+'\n');
console.log(JSON.stringify({说明:'人物鞋底元数据已更新，未修改原图。',帧数:count}));
