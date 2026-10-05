import type Phaser from 'phaser';
import type {Prop} from '../../data/world';
import {CITY_WALL_ACCESS,CITY_WALL_HEIGHT} from '../../data/maps/windwhisper';
import {cityMasonry} from './cityMasonry';

export const cityStairDepths=(y:number)=>({treads:y-36,front:y+3});
export function makeCityWallStairs(scene:Phaser.Scene,p:Prop,base:Phaser.GameObjects.Image){
 const key='fortress-v3-stair',width=430,height=CITY_WALL_HEIGHT+100,left=260;
 if(!scene.textures.exists(key)){
  const access=CITY_WALL_ACCESS[Number(p.id.split('-').at(-1))],top=access.top.x-p.x,bottom=access.bottom.x-p.x,steps=20,run=(bottom-top)/steps;
  for(const front of [false,true]){
   const texture=scene.textures.createCanvas(front?`${key}-front`:key,width,height)!,c=texture.context;c.translate(left,height-45);
   const m=cityMasonry(scene,c);
   if(!front){
    c.fillStyle='#343c3428';c.fillRect(top,-48,bottom-top+10,60);
    // 梯面随守卫的实际路线同步降低，入口位于梯脚前25单位。
    for(let i=0;i<steps;i++){
     const x0=top+i*run,x1=x0+run,z=CITY_WALL_HEIGHT*(1-i/steps),y=25*i/steps;
     m.block(x0,y-66,x1,y,0,z);
     m.block(x0,y-73,x1,y-61,z,z+22);
    }
    m.block(top-36,-68,top+3,0,CITY_WALL_HEIGHT-12,CITY_WALL_HEIGHT);
   }else{
    for(let i=0;i<steps;i++){
     const x0=top+i*run,x1=x0+run,z=CITY_WALL_HEIGHT*(1-i/steps),y=25*i/steps;
     m.block(x0,y-3,x1,y+6,z,z+22);
     if(i%5===0)m.block(x0-2,y-5,x1+2,y+8,z,z+39);
    }
   }
   texture.refresh();
  }
 }
 const depth=cityStairDepths(p.y);
 base.setTexture(key).setOrigin(left/width,(height-45)/height).setDisplaySize(width,height).setDepth(depth.treads);
 const front=scene.add.image(base.x,base.y,`${key}-front`).setOrigin(left/width,(height-45)/height).setDisplaySize(width,height).setDepth(depth.front);
 base.setData('阶梯前栏',front);
 const sync=()=>front.setVisible(base.visible&&!scene.data.get('shadowSettings')?.().indoor).setAlpha(base.alpha);
 scene.events.on('postupdate',sync);scene.events.once('shutdown',()=>scene.events.off('postupdate',sync));
}
