// 封装浏览器当前DOM帧的原生排版导出；不生成或模拟未录制的画面。
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
const root=path.dirname(fileURLToPath(import.meta.url));
const record=JSON.parse(await fs.readFile(path.join(root,'animation-capture.json'),'utf8'));
const groups=[['截图','sword-wind-demo.gif'],['三向截图','three-way-demo.gif']];
for(const [key,name] of groups) {
  const frames=record[key];
  if(!frames?.length)continue;
  const pixels=[];
  let width,height;
  for(const frame of frames) {
    const clip=key==='三向截图'?record.三向截取范围:record.截取范围;
    const {data,info}=await sharp(path.join(root,'references/animation-frames',frame.文件)).extract(clip).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    width=info.width;height=info.height;pixels.push(data);
  }
  const delays=frames.map((frame,index)=>Math.max(20,index===frames.length-1?160:frames[index+1].时间-frame.时间));
  await sharp(Buffer.concat(pixels),{raw:{width,height:height*frames.length,pageHeight:height,channels:4}}).gif({loop:0,delay:delays,effort:7}).toFile(path.join(root,name));
  console.log(`${name}：${width}×${height}，${frames.length}张浏览器原生排版帧。`);
}
