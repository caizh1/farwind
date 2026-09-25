import fs from 'node:fs/promises';
import sharp from 'sharp';
const dir='docs/animation/after',list=[];
for(const id of ['hero','cat']){
 const entries=[];
 for(const [d,name]of ['下','上','左','右'].entries())for(const action of ['idle','walk','run']){
  const side=id==='cat'||d>=2,frames=action==='idle'?[side?0:d*6]:side?[1,2,3,4,5,6,7,8]:[d*6+1,d*6+2,d*6+3,d*6+4];
  const provisional=action!=='idle'||(id==='cat'&&d<2);
  for(const [index,frame]of frames.entries())entries.push({direction:name,action,frame,index,texture:side?`public/assets/animation/${id}-motion.png`:`public/assets/${id}.png`,flip:side&&d===2,provisional});
 }
 const w=168,h=178,cols=9,layers=[];
 for(let i=0;i<entries.length;i++){
  const e=entries[i],left=i%cols*w,top=Math.floor(i/cols)*h;
  layers.push({input:Buffer.from(`<svg width="168" height="178"><rect width="100%" height="100%" fill="#efe8d5"/><text x="5" y="18" font-family="PingFang SC" font-size="11">${e.direction}/${e.action}/${e.index} 帧${e.frame}${e.provisional?' 待验收':''}</text><path d="M20 148H148 M84 140V155" stroke="#ad6552"/><text x="5" y="171" font-family="PingFang SC" font-size="10">128² 锚64,124 镜像${e.flip}</text></svg>`),left,top});
  let f=sharp(e.texture).extract({left:e.frame*128,top:0,width:128,height:128});if(e.flip)f=f.flop();layers.push({input:await f.png().toBuffer(),left:left+20,top:top+24});
 }
 await sharp({create:{width:cols*w,height:Math.ceil(entries.length/cols)*h,channels:4,background:'#efe8d5'}}).composite(layers).png().toFile(`${dir}/${id}-contact.png`);list.push({角色:id,实际映射:entries});
}
await fs.writeFile(`${dir}/animation-mapping.json`,JSON.stringify({说明:'实际加载映射。横向行走已接入候选但美术未验收；奔跑无独立素材；猫前后方向无独立素材；主角前后保留旧帧。不得将复用视为制作完成。',角色:list},null,2));
