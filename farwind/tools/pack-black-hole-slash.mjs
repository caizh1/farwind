import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const root='docs/black-hole-slash',out='public/assets/animation/black-hole-slash';
await mkdir(out,{recursive:true});
const audit=[];
for(const [name,cols,rows,count] of [['flight',3,2,6],['rift',4,4,16],['suction',4,2,8]]){
 const source=await readFile(`${root}/assets/${name}-source.png`),meta=await sharp(source).metadata();
 if(!meta.hasAlpha)throw Error(`${name}源图缺少透明通道`);
 const cells=[],atlasCols=Math.min(count,8),atlasRows=Math.ceil(count/atlasCols);
 for(let i=0;i<count;i++){
  const col=i%cols,row=Math.floor(i/cols),left=Math.round(col*meta.width/cols),top=Math.round(row*meta.height/rows);
  const width=Math.round((col+1)*meta.width/cols)-left,height=Math.round((row+1)*meta.height/rows)-top;
  const frame=await sharp(source).extract({left,top,width,height}).resize({width:224,height:224,fit:'contain',background:'#00000000'}).extend({top:16,bottom:16,left:16,right:16,background:'#00000000'}).png().toBuffer();
  const stats=await sharp(frame).stats();
  if(stats.channels[3].min!==0)throw Error(`${name}第${i}帧没有透明安全边`);
  cells.push({input:frame,left:(i%atlasCols)*256,top:Math.floor(i/atlasCols)*256});
 }
 const file=`${out}/${name}.png`;
 await sharp({create:{width:atlasCols*256,height:atlasRows*256,channels:4,background:'#00000000'}}).composite(cells).png().toFile(file);
 await sharp(file).flatten({background:'#537459'}).png().toFile(`${root}/evidence/${name}-contact.png`);
 audit.push({素材:name,文件:file,来源摘要:createHash('sha256').update(source).digest('hex'),图集摘要:createHash('sha256').update(await readFile(file)).digest('hex'),帧数:count,帧尺寸:256,透明安全边:16,图集尺寸:[atlasCols*256,atlasRows*256],用户美术验收:'待验收'});
}
await writeFile(`${root}/assets/metadata.json`,JSON.stringify({说明:'内置imagegen生成；按固定格逐帧裁切与等比打包，保留原始透明度；没有去背或删除主体。',素材:audit,动画:{飞行:'六帧循环',裂缝:'零至三帧张开，四至十一帧循环，十二至十五帧闭合',吸入:'八帧循环，另以真实时间驱动向心粒子'}},null,2)+'\n');
console.log('黑洞斩三套透明图集已打包，保留中文素材审计记录。');

// 把已经生成的帧按正式播放时序封装为动画预览，不改变原始美术。
const frame=async(name,i)=>sharp(`${out}/${name}.png`).extract({left:(i%8)*256,top:Math.floor(i/8)*256,width:256,height:256}).png().toBuffer();
const flight=[];for(let i=0;i<6;i++)flight.push(await frame('flight',i));
await sharp(flight,{join:{animated:true}}).webp({lossless:true,delay:Array(6).fill(50),loop:0}).toFile(`${root}/flight-preview.webp`);
const cycle=[],delays=[];
for(let i=0;i<24;i++){
 const riftFrame=i<4?i:i<20?4+(i-4)%8:12+i-20;
 const core=await sharp(await frame('rift',riftFrame)).resize(180,240).png().toBuffer();
 const layers=[{input:core,left:166,top:94}];
 if(i>=4&&i<20){const flow=await sharp(await frame('suction',(i-4)%8)).resize(410,410).ensureAlpha().linear([1,1,1,.52],[0,0,0,0]).png().toBuffer();layers.unshift({input:flow,left:51,top:51});}
 cycle.push(await sharp({create:{width:512,height:512,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer());delays.push(i<4?60:i<20?90:80);
}
cycle.push(await sharp({create:{width:512,height:512,channels:4,background:'#00000000'}}).png().toBuffer());delays.push(400);
await sharp(cycle,{join:{animated:true}}).webp({lossless:true,delay:delays,loop:0}).toFile(`${root}/rift-preview.webp`);
