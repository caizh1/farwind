import fs from 'node:fs/promises';
import sharp from 'sharp';

// 将内置生成母版转换为现有立绘规格，安全余量保持真实透明。
const folder='docs/dialogue-portraits/expansion';
const records=JSON.parse(await fs.readFile(`${folder}/generation.json`,'utf8')).角色;
const manifest=JSON.parse(await fs.readFile('public/assets/manifest.json','utf8'));
await fs.mkdir(`${folder}/masters`,{recursive:true});
const metrics=[];
for(const r of records){
  if(!r.原图)continue;
  const master=`${folder}/masters/${r.id}-neutral.png`;
  const dest=`public/assets/portraits/${r.id}-neutral.webp`;
  await fs.copyFile(r.原图,master);
  const source=await sharp(master).metadata();
  if(!source.hasAlpha)throw Error(`${r.姓名}母版缺少透明通道`);
  await sharp(master).resize(720,1080,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).extend({top:36,bottom:36,left:24,right:24,background:{r:0,g:0,b:0,alpha:0}}).webp({quality:92,alphaQuality:100}).toFile(dest);
  const {data,info}=await sharp(dest).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let clear=0,opaque=0;for(let i=3;i<data.length;i+=4){if(data[i]===0)clear++;if(data[i]>250)opaque++;}
  const m={id:r.id,姓名:r.姓名,尺寸:[info.width,info.height],透明比例:clear/(info.width*info.height),实体比例:opaque/(info.width*info.height),字节:(await fs.stat(dest)).size};
  if(m.透明比例<.1||m.实体比例<.15)throw Error(`${r.姓名}透明或实体覆盖异常`);
  metrics.push(m);
  const entry={ID:`dialogue-${r.id}-neutral`,文件:`portraits/${r.id}-neutral.webp`,用途:'对话独立半身立绘',来源:'内置 imagegen，角色身份参考与小满手绘样板；Sharp等比例转换与透明安全区；提示见docs/dialogue-portraits/expansion/generation.json',母版:master,尺寸:[768,1152],透明通道:true,锚点:null,动画:null,是否临时:true,验证状态:'独立手绘素材；透明与尺寸自检。实际页面与最终美术验收见本目录报告'};
  const index=manifest.资源.findIndex(e=>e.ID===entry.ID);if(index<0)manifest.资源.push(entry);else manifest.资源[index]=entry;
}
await fs.writeFile('public/assets/manifest.json',JSON.stringify(manifest,null,2)+'\n');
await fs.writeFile(`${folder}/asset-report.json`,JSON.stringify({说明:'立绘导出与透明像素量测，不代替实际页面或用户美术验收。',角色:metrics},null,2)+'\n');
console.log(`已导出${metrics.length}张透明立绘，合计${metrics.reduce((n,m)=>n+m.字节,0)}字节。`);
