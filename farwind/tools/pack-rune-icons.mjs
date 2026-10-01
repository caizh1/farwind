import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';

// 仅整理生成原画的透明留白、尺寸与编码，不绘制或替换原画内容。
const directory=process.argv[2]??'docs/runes/painted-icons';
const destination='public/assets/runes/painted';
const input=JSON.parse(await readFile(`${directory}/sources.json`,'utf8'));
const expected=directory==='docs/combat-build/rune-art'?['r31','r32','r33']:[...Array.from({length:30},(_,i)=>`r${String(i+1).padStart(2,'0')}`),'return-wind'];
if(input.图片.length!==expected.length||expected.some(id=>input.图片.filter(a=>a.符文===id).length!==1))throw Error(`必须有${expected.length}份独立原画且符文编号不重复`);
await mkdir(destination,{recursive:true});
const records=[];
for(const item of input.图片){
 const original=await readFile(item.原图);
 const {data,info}=await sharp(original).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let left=info.width,top=info.height,right=-1,bottom=-1,transparent=0;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
  const alpha=data[(y*info.width+x)*4+3];
  if(!alpha)transparent++;
  if(alpha>2){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
 }
 if(right<left||transparent<info.width*info.height*.05)throw Error(`${item.符文} 缺少有效透明背景或主体`);
 const region={left,top,width:right-left+1,height:bottom-top+1};
 const painting=await sharp(original).extract(region).resize(464,464,{fit:'inside',withoutEnlargement:true}).png().toBuffer();
 const size=await sharp(painting).metadata();
 const png=await sharp({create:{width:512,height:512,channels:4,background:'#00000000'}})
  .composite([{input:painting,left:Math.floor((512-size.width)/2),top:Math.floor((512-size.height)/2)}]).png().toBuffer();
 const webp=await sharp(png).webp({quality:95,alphaQuality:100,effort:6}).toBuffer();
 const path=`${destination}/${item.符文}.webp`;
 await writeFile(path,webp);
 records.push({符文:item.符文,名称:item.名称,品阶:item.品阶,正式图片:path,尺寸:[512,512],透明:true,
  原图尺寸:[info.width,info.height],裁剪范围:region,原图哈希:createHash('sha256').update(original).digest('hex'),
  正式图片哈希:createHash('sha256').update(webp).digest('hex'),字节:webp.length});
}
await writeFile(`${directory}/manifest.json`,JSON.stringify({说明:`${records.length}枚手绘位图；仅裁除透明留白、统一尺寸并编码。原画形体、笔触与光感未由代码重绘。`,图片:records,总字节:records.reduce((sum,r)=>sum+r.字节,0)},null,2));
console.log(JSON.stringify({结果:'透明手绘图标整理完成',数量:records.length,总字节:records.reduce((sum,r)=>sum+r.字节,0)}));
