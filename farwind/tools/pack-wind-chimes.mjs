import sharp from 'sharp';
import {mkdir, writeFile} from 'node:fs/promises';
const source='docs/wind-chimes/chime-parts-source.png', out='public/assets/wind-chimes';
await mkdir(out,{recursive:true});
const parts=[['frame',0,690],['bell',690,410],['ribbon',1100,436]], records=[];
for(const [name,left,width] of parts){
 const file=`${out}/${name}.png`;
 const crop=await sharp(source).extract({left,top:0,width,height:1024}).png().toBuffer();
 await sharp(crop).trim({background:'#00000000',threshold:10}).png().toFile(file);
 const {width:w,height:h,hasAlpha}=await sharp(file).metadata();
 if(!hasAlpha)throw Error('风铃部件缺少透明通道');
 records.push({部件:name,路径:file,宽:w,高:h,透明:hasAlpha});
}
await writeFile('docs/wind-chimes/assets.json',JSON.stringify({说明:'内置图像生成的分层风铃，保留原始素材并分区裁切；木架、铃体、捕风飘带独立摆动。',资源:records},null,2));
console.log('风铃三层素材已打包');
