import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
const roots=[[[143,334],[408,334],[658,334],[907,334],[1167,334],[1416,334]],[[143,659],[408,659],[658,659],[907,659],[1167,659],[1416,659]],[[143,964],[408,964],[658,964],[907,964],[1167,964],[1416,964]]];
const columns=[0,275,536,795,1022,1330,1536],rows=[0,350,670,1024],crop=460,size=160,frames=[];
const {data,info}=await sharp('docs/parry-v2/assets/hero-design.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
for(let row=0;row<3;row++)for(let pose=0;pose<6;pose++){
 const raw=Buffer.alloc(crop*crop*4),[rx,ry]=roots[row][pose];
 for(let y=rows[row];y<rows[row+1];y++)for(let x=0;x<info.width;x++){
  const tx=Math.round(x-rx+crop/2),ty=Math.round(y-ry+crop*154/160);
  if(tx>=0&&tx<crop&&ty>=0&&ty<crop)data.copy(raw,(ty*crop+tx)*4,(y*info.width+x)*4,(y*info.width+x)*4+4);
 }
 // 仅保留与主体相连的像素，排除源图相邻格子伸入的碎片；不改主体比例。
 const labels=new Int32Array(crop*crop),groups=[];let serial=0;
 for(let i=0;i<labels.length;i++)if(!labels[i]&&raw[i*4+3]>12){const queue=[i];labels[i]=++serial;for(let k=0;k<queue.length;k++){const q=queue[k],x=q%crop,y=Math.floor(q/crop);for(const n of [x>0?q-1:-1,x<crop-1?q+1:-1,y>0?q-crop:-1,y<crop-1?q+crop:-1])if(n>=0&&!labels[n]&&raw[n*4+3]>12){labels[n]=serial;queue.push(n);}}groups.push({id:serial,count:queue.length,distance:Math.min(...queue.map(q=>Math.hypot(q%crop-crop/2,Math.floor(q/crop)-crop*154/160)))});}
 groups.sort((a,b)=>(a.count<100?Infinity:a.distance)-(b.count<100?Infinity:b.distance));const main=groups[0]?.id,keep=new Uint8Array(labels.length);
 for(let i=0;i<labels.length;i++)if(labels[i]===main){const x=i%crop,y=Math.floor(i/crop);for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(x+dx>=0&&x+dx<crop&&y+dy>=0&&y+dy<crop)keep[(y+dy)*crop+x+dx]=1;}
 for(let i=0;i<labels.length;i++)if(!keep[i])raw[i*4+3]=0;
 frames.push({input:await sharp(raw,{raw:{width:crop,height:crop,channels:4}}).resize(size,size).png().toBuffer(),left:pose*size,top:row*size});
}
await sharp({create:{width:960,height:480,channels:4,background:'#00000000'}}).composite(frames).png().toFile('public/assets/animation/hero-parry-v2.png');
await sharp('public/assets/animation/hero-parry-v2.png').flatten({background:'#e7e4d6'}).png().toFile('docs/parry-v2/evidence/fixed-preview.png');
await writeFile('docs/parry-v2/assets/manifest.json',JSON.stringify({说明:'内置图像生成，十八连续防御与反斩姿态；全套统一缩放，左向由Actor镜像',根:roots,裁切:crop,帧尺寸:size,地面根:[80,154],显示尺寸:145,姿态:['架剑','受力','拨开','反斩起势','反斩挥出','跟随收势'],状态:'临时素材，等待固定预览与真实运行验证'},null,2));
console.log('已打包十八个固定根姿态');
