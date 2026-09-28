import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';

// 手工核对脚底中心。全帧共用比例，不能按各姿态包围盒缩放。
const roots=[[[218,399],[620,401],[1029,401]],[[219,819],[633,822],[1039,820]],[[227,1194],[653,1193],[1049,1194]]];
const source='docs/player-hurt/assets/hurt-source.png',crop=560,size=160;
const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
if(info.width!==1254||info.height!==1254)throw Error('源图尺寸已变化，请重新核对三方向脚底锚点');
const frames=[];
for(let row=0;row<3;row++)for(let pose=0;pose<3;pose++){
  const raw=Buffer.alloc(crop*crop*4),[rx,ry]=roots[row][pose];
  for(let y=row*418;y<(row+1)*418;y++)for(let x=pose*418;x<(pose+1)*418;x++){
    const tx=Math.round(x-rx+crop/2),ty=Math.round(y-ry+crop*154/160);
    if(tx>=0&&tx<crop&&ty>=0&&ty<crop)data.copy(raw,(ty*crop+tx)*4,(y*info.width+x)*4,(y*info.width+x)*4+4);
  }
  frames.push({input:await sharp(raw,{raw:{width:crop,height:crop,channels:4}}).resize(size,size).png().toBuffer(),left:pose*size,top:row*size});
}
await sharp({create:{width:480,height:480,channels:4,background:'#00000000'}}).composite(frames).png().toFile('public/assets/animation/hero-hurt.png');
await sharp('public/assets/animation/hero-hurt.png').flatten({background:'#e7e4d6'}).png().toFile('docs/player-hurt/evidence/hurt-fixed-preview.png');
await writeFile('docs/player-hurt/assets/hurt-manifest.json',JSON.stringify({说明:'内置图像生成：正面、背面、右向各三姿态；左向由角色系统镜像',源文件:source,源尺寸:[info.width,info.height],源根:roots,统一裁切:crop,帧尺寸:160,显示尺寸:145,地面根:[80,154],阶段毫秒:[0,55,140,220],临时:true,用户认可:false},null,2));
console.log('已打包三方向受击动作与固定预览');
