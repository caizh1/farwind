import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root='docs/wind-gifts-visuals',out='public/assets/animation/wind-gifts',audit=[];
await mkdir(out,{recursive:true});
for(const name of ['offense','survival','tactics']){
 const source=await readFile(`${root}/assets/${name}-source.png`),meta=await sharp(source).metadata();
 if(!meta.hasAlpha||meta.width!==1536||meta.height!==1024)throw Error('风赐源图尺寸或透明通道不符');
 const cells=[],frames=[];
 for(let i=0;i<24;i++){
  const frame=await sharp(source).extract({left:i%6*256,top:Math.floor(i/6)*256,width:256,height:256}).resize(224,224).extend({top:16,bottom:16,left:16,right:16,background:'#00000000'}).png().toBuffer();
  const stats=await sharp(frame).stats();if(stats.channels[3].min!==0||stats.channels[3].max<100)throw Error('风赐帧透明边或主体不符');
  frames.push(frame);cells.push({input:frame,left:i%6*256,top:Math.floor(i/6)*256});
 }
 const file=`${out}/${name}.webp`;
 await sharp({create:{width:1536,height:1024,channels:4,background:'#00000000'}}).composite(cells).webp({lossless:true}).toFile(file);
 await sharp(file).flatten({background:'#425343'}).png().toFile(`${root}/evidence/${name}-contact.png`);
 const preview=[];for(let col=0;col<6;col++)preview.push(await sharp({create:{width:512,height:512,channels:4,background:'#00000000'}}).composite([0,1,2,3].map(row=>({input:frames[row*6+col],left:row%2*256,top:Math.floor(row/2)*256}))).png().toBuffer());
 await sharp(preview,{join:{animated:true}}).webp({lossless:true,delay:[90,90,90,90,90,350],loop:0}).toFile(`${root}/${name}-preview.webp`);
 audit.push({类别:name,图集:file,帧数:24,尺寸:[1536,1024],帧尺寸:256,透明安全边:16,源图摘要:createHash('sha256').update(source).digest('hex'),图集摘要:createHash('sha256').update(await readFile(file)).digest('hex')});
}
await writeFile(`${root}/assets/metadata.json`,JSON.stringify({说明:'内置imagegen生成十二类六帧动画，逐格等比缩放并增加透明边；未删除背景或修改主体。预览为素材封装，不是实机录像。',素材:audit},null,2)+'\n');
console.log('十二类风赐动画已打包。');
