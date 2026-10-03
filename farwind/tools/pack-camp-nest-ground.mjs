import sharp from 'sharp';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const materials=[];
const path='public/assets/manifest.json',manifest=JSON.parse(await readFile(path,'utf8'));
for(const direction of ['south','west','north','east']){
  const source=`docs/camp-nests/${direction}-ground-source.png`,file=`camp-nests/nest-ground-${direction}.webp`;
  await sharp(source).resize(768,768).webp({quality:92}).toFile(`public/assets/${file}`);
  const bytes=await readFile(`public/assets/${file}`);
  const record={ID:`nest-ground-${direction}`,文件:file,源文件:source,用途:'巢穴脚下至原草地的不规则柔和材质过渡',来源:'内置图像生成；缩放打包，运行时按世界坐标羽化混合',尺寸:[768,768],透明通道:false,摘要:createHash('sha256').update(bytes).digest('hex'),是否临时:false,验证状态:'待实机截图复核，最终美术待用户确认'};
  const index=manifest.资源.findIndex(r=>r.ID===record.ID);
  if(index>=0)manifest.资源[index]=record;else manifest.资源.push(record);
  materials.push(record);
}
await writeFile(path,JSON.stringify(manifest,null,2));
await writeFile('docs/camp-nests/ground-materials.json',JSON.stringify({说明:'四向巢穴独立地表，地形区块生成时烘焙，后续水面和道路覆盖，通行与存档未改变',素材:materials},null,2));
console.log('四处巢穴过渡地表已打包');
