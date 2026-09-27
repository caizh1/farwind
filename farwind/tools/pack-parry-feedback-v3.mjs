import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
const roots=[[[128,342],[371,343],[645,341],[903,343],[1158,342],[1406,343]],[[125,666],[403,671],[658,665],[903,666],[1163,666],[1417,666]],[[126,969],[399,969],[658,969],[909,969],[1172,969],[1429,969]]];
const weapons=[[[67,139,132,65],[370,277,430,349],[660,265,733,334],[930,281,1011,322],[1215,258,1303,301],[1390,213,1316,100]],[[204,462,92,394],[370,493,344,411],[689,569,732,602],[960,590,1030,619],[1217,549,1297,575],[1460,533,1496,447]],[[142,762,49,700],[435,847,527,802],[713,895,777,946],[955,887,1037,908],[1220,889,1305,916],[1452,849,1516,749]]];
const rows=[0,353,681,1024],crop=460,size=160,frames=[];
const {data,info}=await sharp('docs/parry-feedback-v3/assets/counter-source.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
for(let row=0;row<3;row++)for(let pose=0;pose<6;pose++){
 const raw=Buffer.alloc(crop*crop*4),[rx,ry]=roots[row][pose];
 for(let y=rows[row];y<rows[row+1];y++)for(let x=0;x<info.width;x++){const tx=Math.round(x-rx+crop/2),ty=Math.round(y-ry+crop*154/160);if(tx>=0&&tx<crop&&ty>=0&&ty<crop)data.copy(raw,(ty*crop+tx)*4,(y*info.width+x)*4,(y*info.width+x)*4+4);}
 // 固定根选主体连通域，去掉邻格碎片；所有姿态共用460裁切，不按含剑包围盒缩放。
 const labels=new Int32Array(crop*crop),groups=[];let serial=0;
 for(let i=0;i<labels.length;i++)if(!labels[i]&&raw[i*4+3]>12){const queue=[i];labels[i]=++serial;let min=Infinity;for(let k=0;k<queue.length;k++){const q=queue[k],x=q%crop,y=Math.floor(q/crop);min=Math.min(min,Math.hypot(x-crop/2,y-crop*154/160));for(const n of [x>0?q-1:-1,x<crop-1?q+1:-1,y>0?q-crop:-1,y<crop-1?q+crop:-1])if(n>=0&&!labels[n]&&raw[n*4+3]>12){labels[n]=serial;queue.push(n);}}groups.push({id:serial,count:queue.length,distance:min});}
 groups.sort((a,b)=>(a.count<100?Infinity:a.distance)-(b.count<100?Infinity:b.distance));const keep=groups[0].id;
 for(let i=0;i<labels.length;i++)if(labels[i]!==keep)raw[i*4+3]=0;
 frames.push({input:await sharp(raw,{raw:{width:crop,height:crop,channels:4}}).resize(size,size).png().toBuffer(),left:pose*size,top:row*size});
}
await sharp({create:{width:960,height:480,channels:4,background:'#00000000'}}).composite(frames).png().toFile('public/assets/animation/hero-counter-v3.png');
await sharp('public/assets/animation/hero-counter-v3.png').flatten({background:'#e7e4d6'}).png().toFile('docs/parry-feedback-v3/evidence/counter-fixed-preview.png');
const points=weapons.map((row,r)=>row.map((p,i)=>({grip:{x:(p[0]-roots[r][i][0])*145/crop,y:(p[1]-roots[r][i][1])*145/crop},tip:{x:(p[2]-roots[r][i][0])*145/crop,y:(p[3]-roots[r][i][1])*145/crop}})));
await writeFile('src/data/counterArt.ts',`// 内置图像生成的反斩姿态手工剑柄／剑尖标注；左向统一在根局部镜像。\nexport const COUNTER_WEAPONS=${JSON.stringify(points)} as const;\n`);
await writeFile('docs/parry-feedback-v3/assets/counter-manifest.json',JSON.stringify({说明:'新反斩六姿态，正面、背面、右向；左向由Actor镜像',源根:roots,剑柄剑尖:weapons,统一裁切:crop,帧:160,显示:145,地面根:[80,154],临时:true,用户认可:false},null,2));
console.log('已打包固定根反斩姿态与真实武器点');
