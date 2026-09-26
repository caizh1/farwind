import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
const source='docs/parry/assets/parry-design.png';
const roots=[[[194,334],[578,334],[960,334],[1344,334]],[[194,660],[578,660],[960,660],[1344,660]],[[194,972],[578,972],[960,972],[1344,972]]];
const crop=460,size=160,frames=[];
const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
for(let view=0;view<3;view++)for(let pose=0;pose<4;pose++) {
 const raw=Buffer.alloc(crop*crop*4),[rx,ry]=roots[view][pose];
 for(let y=Math.round(view*info.height/3);y<Math.round((view+1)*info.height/3);y++)for(let x=pose*384;x<(pose+1)*384;x++) {
  const tx=Math.round(x-rx+crop/2),ty=Math.round(y-ry+crop*154/160);
  if(tx>=0&&tx<crop&&ty>=0&&ty<crop)data.copy(raw,(ty*crop+tx)*4,(y*info.width+x)*4,(y*info.width+x)*4+4);
 }
 const frame=await sharp(raw,{raw:{width:crop,height:crop,channels:4}}).resize(size,size).png().toBuffer();
 frames.push({input:frame,left:pose*size,top:view*size});
}
await sharp({create:{width:640,height:480,channels:4,background:'#00000000'}}).composite(frames).png().toFile('public/assets/animation/hero-parry.png');
await sharp('public/assets/animation/hero-parry.png').flatten({background:'#e7e4d6'}).png().toFile('docs/parry/evidence/fixed-preview.png');
await writeFile('docs/parry/assets/manifest.json',JSON.stringify({说明:'内置图像生成的新弹反动作，正面、背面、右侧各四姿态；左向仅运行时镜像。打包不按含剑包围盒逐帧缩放。',源图:source,地面根:roots,裁切尺寸:crop,图集帧尺寸:160,图集根:[80,154],显示尺寸:145,姿态:['架剑','受力','拨开','持剑就绪'],状态:'已完成固定预览与真实运行核查；保留临时标记，用户主观美术验收未完成'},null,2));
console.log('已打包十二个固定根弹反姿态');
