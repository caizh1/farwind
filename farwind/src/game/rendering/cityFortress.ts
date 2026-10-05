import type Phaser from 'phaser';
import {CITY_FORTRESS,FORTRESS_TAIL,fortressFrontY,fortressParapetY} from '../../data/cityFortress';
// 沿前垛口轮廓切分步道后景与前景；不能把整列建筑夹在人物身体中间。
export function makeCityFortress(scene:Phaser.Scene){
 const texture=scene.textures.get('city-fortress-v5'),layers:Phaser.GameObjects.Image[]=[];
 for(let x=0;x<CITY_FORTRESS.width;x+=4){const width=Math.min(4,CITY_FORTRESS.width-x),cut=fortressParapetY(x+width/2),depth=fortressFrontY(x+width/2);
  const parts=cut===undefined?[[0,CITY_FORTRESS.height,depth]]:[[0,cut,depth],[cut,60,depth+150],[cut+60,CITY_FORTRESS.height-cut-60,depth]];
  for(const [y,height,z] of parts){const key=`walkway-${x}-${y}`;
   if(!texture.has(key))texture.add(key,0,x,y,width,height);
   layers.push(scene.add.image(CITY_FORTRESS.x+x,CITY_FORTRESS.y+y,'city-fortress-v5',key).setOrigin(0,0).setDepth(z));
  }
 }
 const t=FORTRESS_TAIL,tailTexture=scene.textures.get('city-fortress-v4');
 for(let u=0;u<t.length;u+=24){const width=Math.min(24,t.length-u),key=`return-${u}`,tile=Math.floor(u/t.tileWidth),sx=t.sourceX+u%t.tileWidth;
  if(!tailTexture.has(key))tailTexture.add(key,0,sx,t.sourceY,width,t.tileHeight);
  layers.push(scene.add.image(t.x-u-width,t.y-t.foot+tile*170,'city-fortress-v4',key).setOrigin(0,0).setFlipX(true).setDepth(t.y+(u+width/2)*t.slope));
 }
 return layers;
}
