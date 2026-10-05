import type Phaser from 'phaser';
import {CITY_FORTRESS,FORTRESS_TAIL,fortressFrontY} from '../../data/cityFortress';
// 只切帧，不缩放、拉斜或重绘美术；窄列依据各自墙脚排序，人物能从门洞穿过。
export function makeCityFortress(scene:Phaser.Scene){
 const texture=scene.textures.get('city-fortress-v4'),layers:Phaser.GameObjects.Image[]=[];
 for(let x=0;x<CITY_FORTRESS.width;x+=24){const width=Math.min(24,CITY_FORTRESS.width-x),key=`column-${x}`;
  if(!texture.has(key))texture.add(key,0,x,0,width,CITY_FORTRESS.height);
  layers.push(scene.add.image(CITY_FORTRESS.x+x,CITY_FORTRESS.y,'city-fortress-v4',key).setOrigin(0,0).setDepth(fortressFrontY(x+width/2)));
 }
 const t=FORTRESS_TAIL;
 for(let u=0;u<t.length;u+=24){const width=Math.min(24,t.length-u),key=`return-${u}`,tile=Math.floor(u/t.tileWidth),sx=t.sourceX+u%t.tileWidth;
  if(!texture.has(key))texture.add(key,0,sx,t.sourceY,width,t.tileHeight);
  layers.push(scene.add.image(t.x-u-width,t.y-t.foot+tile*170,'city-fortress-v4',key).setOrigin(0,0).setFlipX(true).setDepth(t.y+(u+width/2)*t.slope));
 }
 return layers;
}
