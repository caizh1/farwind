import sharp from 'sharp';
import path from 'node:path';
import {cut,packEntries} from './pack-combat-v2.mjs';
const root=process.cwd(),names=['idle','walk/0','walk/1','charge','strike','recover'];
for(const kind of ['archer','bell','shade','geomancer']){
 const frames=[];
 for(const dir of ['down','up','right']){
  const file=path.join(root,'docs/combat-v2/source',`${kind}-${dir}-actions.png`),m=await sharp(file).metadata(),w=Math.floor(m.width/2),h=Math.floor(m.height/3);
  if(!m.hasAlpha)throw Error('新敌人动作图缺少透明通道。');
  for(const [i,name] of names.entries())frames.push(await cut(file,{left:i%2*w,top:Math.floor(i/2)*h,width:w,height:h},`${dir}/${name}`,4*({archer:80,bell:76,shade:74,geomancer:90}[kind])));
 }
 await packEntries(kind,frames,path.join(root,'public/assets/enemies-combat-v2',kind));
}
