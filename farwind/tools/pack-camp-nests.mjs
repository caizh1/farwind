import sharp from 'sharp';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const records=[];
for(const id of ['south','west','north','east']){
  const source=`docs/camp-nests/${id}-source.png`,target=`public/assets/camp-nests/nest-${id}.webp`;
  const trimmed=await sharp(source).trim({threshold:12}).png().toBuffer();
  const meta=await sharp(trimmed).metadata();
  const width=720,height=Math.round(width*meta.height/meta.width);
  await sharp(trimmed).resize(width,height).webp({lossless:true}).toFile(target);
  const {data,info}=await sharp(target).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let zero=0;for(let i=3;i<data.length;i+=4)if(data[i]===0)zero++;
  if(zero<info.width*info.height*.08)throw Error(`${id}缺少透明边缘`);
  records.push({方向:id,源文件:source,运行文件:target,尺寸:[width,height],透明像素:zero,说明:'内置图像生成；只裁透明空边和缩放，不替换生成透明通道'});
}
await writeFile('docs/camp-nests/material-manifest.json',JSON.stringify({说明:'四处独立巢穴；原交互锚点和碰撞不变。最终美术待用户确认。',素材:records},null,2));
const path='public/assets/manifest.json',manifest=JSON.parse(await readFile(path,'utf8'));
for(const r of records){
  const id=`nest-${r.方向}`,record={ID:id,文件:r.运行文件.replace('public/assets/',''),源文件:r.源文件,用途:'四向据点独立巢穴地标',来源:'内置图像生成；透明素材裁边缩放',尺寸:r.尺寸,透明通道:true,摘要:createHash('sha256').update(await readFile(r.运行文件)).digest('hex'),是否临时:false,验证状态:'待运行截图复核，最终美术待用户确认'};
  const index=manifest.资源.findIndex(r=>r.ID===id);
  if(index>=0)manifest.资源[index]=record;else manifest.资源.push(record);
}
await writeFile(path,JSON.stringify(manifest,null,2));
console.log('四处巢穴已打包，透明边缘通过');
