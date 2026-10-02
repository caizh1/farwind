import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
const source='docs/xiaobao-life/art/daily-source.png';
const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const bodies=[],seen=new Uint8Array(info.width*info.height),queue=new Int32Array(seen.length);
// 原图行距并非严格等分，按真实连通主体切分，不能用格子裁掉脚或道具。
for(let start=0;start<seen.length;start++){
  if(seen[start]||data[start*4+3]<32)continue;
  let head=0,tail=1,left=info.width,top=info.height,right=0,bottom=0;seen[start]=1;queue[0]=start;
  while(head<tail){const pixel=queue[head++],x=pixel%info.width,y=Math.floor(pixel/info.width);left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
    for(const next of [x>0?pixel-1:-1,x+1<info.width?pixel+1:-1,y>0?pixel-info.width:-1,y+1<info.height?pixel+info.width:-1])if(next>=0&&!seen[next]&&data[next*4+3]>=32){seen[next]=1;queue[tail++]=next;}
  }
  if(tail>4000)bodies.push({left,top,width:right-left+1,height:bottom-top+1});
}
if(bodies.length!==24)throw Error(`日常原图必须有24个独立完整主体，实际${bodies.length}个`);
bodies.sort((a,b)=>a.top-b.top);const cells=[];
for(let row=0;row<4;row++)cells.push(...bodies.slice(row*6,row*6+6).sort((a,b)=>a.left-b.left).map(c=>({left:Math.max(0,c.left-2),top:Math.max(0,c.top-2),width:c.width+4,height:c.height+4})));
// 全套同一尺度；坐下或弯腰不能被逐帧放大。
const scale=104/Math.max(...cells.slice(12,18).map(c=>c.height)),composite=[];
for(let i=0;i<cells.length;i++){
  const b=cells[i],width=Math.round(b.width*scale),height=Math.round(b.height*scale);
  if(width>150||height>140)throw Error('日常图集主体超过地面根安全范围');
  composite.push({input:await sharp(source).extract(b).resize(width,height).png().toBuffer(),left:i%6*160+Math.round((160-width)/2),top:Math.floor(i/6)*160+148-height});
}
await sharp({create:{width:960,height:640,channels:4,background:'#00000000'}}).composite(composite).png().toFile('public/assets/xiaobao/daily.png');
await writeFile('docs/xiaobao-life/art/manifest.json',JSON.stringify({说明:'吃饭、采药、提篮送物与写笔记；图像生成素材仅等比缩放与地面根对齐，主观美术待用户验收。',源图:source,运行文件:'public/assets/xiaobao/daily.png',帧尺寸:[160,160],地面根:[80,148],帧数:24,统一缩放:scale,独立主体边界:cells.map(c=>({左:c.left,上:c.top,宽:c.width,高:c.height}))},null,2)+'\n');
console.log('小宝四套日常动作已打包，共24帧，透明通道与地面根通过检查。');
