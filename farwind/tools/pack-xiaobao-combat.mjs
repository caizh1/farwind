import sharp from 'sharp';
import {readFile,writeFile} from 'node:fs/promises';
// 只裁切与等比缩放，保留生成图的透明通道，不重绘宝宝的脸。
const root='docs/xiaobao/art/sources',output='public/assets/xiaobao',records=[],failures=[];
for(const direction of ['front','side','back']){
  const frames=[];
  for(let batch=1;batch<=7;batch++){
    const file=`${root}/battle-${direction}-${batch}-source.png`,{data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const total=info.width*info.height,seen=new Uint8Array(total),queue=new Int32Array(total),bodies=[];
    for(let p=0;p<total;p++){
      if(seen[p]||data[p*4+3]<32)continue;
      let head=0,tail=1,left=info.width,top=info.height,right=0,bottom=0;seen[p]=1;queue[0]=p;
      while(head<tail){const n=queue[head++],x=n%info.width,y=Math.floor(n/info.width);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
        for(const k of [x>0?n-1:-1,x+1<info.width?n+1:-1,y>0?n-info.width:-1,y+1<info.height?n+info.width:-1])if(k>=0&&!seen[k]&&data[k*4+3]>=32){seen[k]=1;queue[tail++]=k;}}
      if(tail>4000)bodies.push({left,top,right,bottom});
    }
    if(bodies.length!==24){failures.push(`${direction}第${batch}组不是24个完整主体：${bodies.length}，不得静默切分。`);continue;}
    bodies.sort((a,b)=>(a.top+a.bottom)/2-(b.top+b.bottom)/2);
    const ordered=[];for(let row=0;row<4;row++)ordered.push(...bodies.slice(row*6,row*6+6).sort((a,b)=>a.left-b.left));
    for(const body of ordered){let sum=0,weight=0;for(let y=body.bottom-8;y<=body.bottom;y++)for(let x=body.left;x<=body.right;x++){const alpha=data[(y*info.width+x)*4+3];if(alpha>32){sum+=x*alpha;weight+=alpha;}}
      const bounds={left:Math.max(0,body.left-2),top:Math.max(0,body.top-2),width:Math.min(info.width,body.right+3)-Math.max(0,body.left-2),height:Math.min(info.height,body.bottom+3)-Math.max(0,body.top-2)};
      frames.push({file,bounds,anchor:sum/weight});}
  }
  if(frames.length!==168||process.argv.includes('--check'))continue;
  // 整个方向图集一个尺度，盘腿与飞行不会按包围盒被逐帧放大。
  const scale=Math.min(104/frames[0].bounds.height,...frames.map(f=>Math.min(142/f.bounds.height,142/f.bounds.width))),composite=[];
  for(const [i,f] of frames.entries()){
    const width=Math.round(f.bounds.width*scale),height=Math.round(f.bounds.height*scale),left=Math.round(80-(f.anchor-f.bounds.left)*scale),top=148-height;
    if(left<3||left+width>157||top<3)throw Error(`${direction}第${i+1}帧超出透明安全边界。`);
    const input=await sharp(f.file).extract(f.bounds).resize(width,height).png().toBuffer();
    composite.push({input,left:i%12*160+left,top:Math.floor(i/12)*160+top});
  }
  await sharp({create:{width:1920,height:2240,channels:4,background:'#00000000'}}).composite(composite).png().toFile(`${output}/battle-${direction}.png`);
  records.push({方向:direction==='front'?'正面':direction==='side'?'侧面':'背面',文件:`xiaobao/battle-${direction}.png`,帧数:168,帧尺寸:[160,160],地面根:[80,148],统一缩放:scale,切分:frames.map(f=>({原图:f.file,范围:f.bounds,脚底横根:f.anchor}))});
}
if(failures.length)throw Error(failures.join('\n'));
if(process.argv.includes('--check')){console.log('21张源图都包含24个独立主体。');process.exit(0);}
await writeFile(`${output}/combat-manifest.json`,JSON.stringify({说明:'新动作仍待游戏内美术验收；图集包含504个独立生成姿态，左右由Actor统一镜像。',工具:'内置imagegen；Sharp只切分、缩放与对齐',资源:records},null,2)+'\n');
const manifest=JSON.parse(await readFile('public/assets/manifest.json','utf8'));
for(const [i,r]of records.entries()){const id=`xiaobao-battle-${['front','side','back'][i]}`;manifest.资源=manifest.资源.filter(e=>e.ID!==id);manifest.资源.push({ID:id,文件:r.文件,尺寸:[1920,2240],透明通道:true,动画:{帧数:168,帧尺寸:[160,160],地面根:[80,148]},来源:'内置imagegen，输入保存在docs/xiaobao/art/combat-prompts.md',是否临时:true});}
await writeFile('public/assets/manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log('小宗师战斗图集打包完成：三方向，共504个独立姿态。');
