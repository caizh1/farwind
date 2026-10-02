import sharp from 'sharp';
import path from 'node:path';
import {cut,packEntries} from './pack-combat-v2.mjs';
// 四类可攻击机关独立轮廓及脚底锚点，不能用同一菌根图替代岩柱和祭印。
const entries=[];
for(const kind of ['root','sac','rock','sigil']){
 const file=path.resolve(`docs/combat-v2/source/mechanism-${kind}.png`),meta=await sharp(file).metadata();
 if(!meta.hasAlpha)throw Error('机关素材必须是真正透明背景。');
 entries.push(await cut(file,{left:0,top:0,width:meta.width,height:meta.height},kind));
}
await packEntries('mechanisms',entries,path.resolve('public/assets/combat-mechanisms'));
