import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const input='docs/runes/combat-art/sources',output='public/assets/runes/combat';
await mkdir(output,{recursive:true});
const records=[];
for(const name of ['thunder','phoenix','flame']){
 const source=`${input}/${name}.png`, image=sharp(source),meta=await image.metadata();
 if(!meta.hasAlpha)throw Error(`素材缺少透明通道：${name}`);
 const data=await image.resize({width:name==='phoenix'?1024:512,withoutEnlargement:true}).webp({quality:92,alphaQuality:100}).toBuffer();
 const packed=sharp(data),size=await packed.metadata(),{data:pixels,info}=await packed.ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const alpha=(x,y)=>pixels[(y*info.width+x)*info.channels+info.channels-1];
 if([[0,0],[info.width-1,0],[0,info.height-1],[info.width-1,info.height-1]].some(([x,y])=>alpha(x,y)!==0))throw Error(`素材边角不透明：${name}`);
 await writeFile(`${output}/${name}.webp`,data);
 records.push({素材:name,尺寸:[size.width,size.height],字节:data.length,透明通道:size.hasAlpha,哈希:createHash('sha256').update(data).digest('hex')});
}
await writeFile('docs/runes/combat-art/assets.json',JSON.stringify({说明:'三张原创透明手绘材质，按比例压缩为正式 WebP；不包含哈迪斯游戏素材。',图片:records},null,2));
