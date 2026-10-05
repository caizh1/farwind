import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
// 按原始图格的最大相连实体排除串入的下一行头部，再在脚部区域找鞋底。
// 限定横向区域以排除斧刃、矛尖；挥斧时沿用站立脚根，保留身体自身腾起。
export const regions={
 canyonHunter:[[40,120],[40,135],[35,70],[35,140],[35,145],[0,160]],
 cragAxeman:[[72,150],[65,150],[40,130],[40,150],[75,160],[0,160]],
 cliffLancer:[[65,110],[50,130],[50,110],[65,130],[90,150],[0,160]],
};
export async function contacts(kind){
 const {data,info}=await sharp(`public/assets/windwhisper-city/${kind}.png`).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const feet=[],crops=[];
 for(let f=0;f<48;f++){
  const row=Math.floor(f/8),column=f%8,seen=new Uint8Array(25600),solid=new Uint8Array(25600);
  for(let y=0;y<160;y++)for(let x=0;x<160;x++)solid[y*160+x]=data[((row*160+y)*info.width+column*160+x)*4+3]>=200?1:0;
  let main=[];
  for(let start=0;start<solid.length;start++){
   if(!solid[start]||seen[start])continue;
   const component=[start];seen[start]=1;
   for(let i=0;i<component.length;i++){
    const p=component[i],x=p%160,y=Math.floor(p/160);
    for(const n of [x>0?p-1:-1,x<159?p+1:-1,y>0?p-160:-1,y<159?p+160:-1])if(n>=0&&solid[n]&&!seen[n]){seen[n]=1;component.push(n);}
   }
   if(component.length>main.length)main=component;
  }
  const region=regions[kind][row],ranges=Array.isArray(region[0])?region:[region];let bottom=0,crop=0;
  for(const p of main){const x=p%160,y=Math.floor(p/160);crop=Math.max(crop,y+1);if(ranges.some(([left,right])=>x>=left&&x<right)&&y>=80)bottom=Math.max(bottom,y+1);}
  if(!bottom)throw new Error(`${kind} 第${f+1}帧缺少脚部接触点`);
  feet.push(row===3&&kind!=='cliffLancer'?(kind==='cragAxeman'?127:159):bottom);crops.push(kind==='cragAxeman'&&[0,4,5].includes(row)?160:Math.min(160,crop+2));
 }
 return {feet,crops};
}
if(process.argv[1]?.endsWith('audit-enemy-feet.mjs')){
 const axeman=await contacts('cragAxeman'),lancer=await contacts('cliffLancer'),hunter=await contacts('canyonHunter');
 const data={说明:'商路三类怪物共144帧脚底与主体裁切底缘；排除串格和武器尖端，攻击腾起保留。不改变逻辑坐标、体型与存档。',裁切底缘:{cragAxeman:axeman.crops,cliffLancer:lancer.crops,canyonHunter:hunter.crops},cragAxeman:axeman.feet,cliffLancer:lancer.feet,canyonHunter:hunter.feet};
 await writeFile('src/data/enemyFootContacts.json',JSON.stringify(data,null,2)+'\n');console.log('已记录三类怪物共144帧接触高度和主体底缘。');
}
