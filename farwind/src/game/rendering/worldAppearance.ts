import type Phaser from 'phaser';
import {ART_QUALITY,appearanceFor,appearanceSeed,buildingDecorations,lowPlantTexture} from '../../data/worldAppearance';
import {props,WATERS,BRIDGES,canDecorate} from '../../data/world';
import {regionAt} from '../../data/village';
import {bakedShadowProp} from './shadowGeometry';
import {contactForFrame,paintContact} from './contactContour';

// 只在CPU侧羽化对边，不镜像整块图案；避免石路出现对称花纹。不逐帧加工图片。
export function seamlessGround(source: CanvasImageSource) {
  const {width,height}=source as HTMLImageElement;
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const c=canvas.getContext('2d',{willReadFrequently:true})!;c.drawImage(source,0,0);
  const original=c.getImageData(0,0,width,height),target=c.createImageData(width,height),band=24;target.data.set(original.data);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const fx=Math.max(0,1-Math.min(x,width-1-x)/band)*.5,fy=Math.max(0,1-Math.min(y,height-1-y)/band)*.5;
    if(!fx&&!fy)continue;
    const a=(y*width+x)*4,b=(y*width+width-1-x)*4,d=((height-1-y)*width+x)*4,e=((height-1-y)*width+width-1-x)*4;
    for(let k=0;k<4;k++)target.data[a+k]=Math.round(original.data[a+k]*(1-fx)*(1-fy)+original.data[b+k]*fx*(1-fy)+original.data[d+k]*(1-fx)*fy+original.data[e+k]*fx*fy);
  }
  c.putImageData(target,0,0);
  return canvas;
}
export function makeGroundAppearance(scene: Phaser.Scene) {
  const staticProps=props.filter(bakedShadowProp);
  const decor=props.flatMap(buildingDecorations);
  // 主路两侧保留通行缓冲；湖岸装饰避开所有桥面及入口。
  for(const water of WATERS)for(let i=0;i<34;i++){
    const a=i*2.399963,seed=appearanceSeed(`${water.id}-${i}`),x=water.x+Math.cos(a)*(water.rx+32+seed%25),y=water.y+Math.sin(a)*(water.ry+24+seed%20);
    if(!canDecorate(x,y,15)||BRIDGES.some(b=>x>b.x-32&&x<b.x+b.w+32&&y>b.y-35&&y<b.y+b.h+35))continue;
    decor.push({x,y,width:32+seed%20,height:20+seed%10,texture:`quality-${ART_QUALITY.decorations[seed%3]}`,flip:!!(seed%2)});
  }
  const image=(key:string)=>scene.textures.get(key).getSourceImage() as HTMLImageElement;
  const bake=function*(c:CanvasRenderingContext2D,cx:number,cy:number):Generator<void,void,unknown>{
    for(const logical of staticProps){
      const p=logical.displayAt?{...logical,...logical.displayAt}:logical;
      const base=scene.textures.get(appearanceFor(p).texture),frame=base.get(p.frame??'__BASE'),a=appearanceFor(p,{width:frame.cutWidth,height:frame.cutHeight});
      const contact=contactForFrame(scene,a.texture,p.art==='bush'?0:p.frame);
      const contactTop=contact?Math.min(-22,...contact.paths.flatMap(path=>path.map(([,y])=>(y-1)*a.height-8))):-22;
      if(p.x+a.width/2+8<cx||p.x-a.width/2-8>cx+600||p.y+32<cy||p.y+contactTop>cy+550)continue;
      if(contact?.paths.length){
        c.save();c.translate(p.x,p.y);if(p.id.startsWith('city-guard-stairs-'))c.scale(-1,1);paintContact(c,contact,a.width,a.height,lowPlantTexture(a.texture));c.restore();
      }else{
        const rx=Math.max(12,Math.min(a.width*.5,(p.solid?.[0]??a.width)*.65)),ry=Math.max(7,Math.min(24,(p.solid?.[1]??20)*.24));
        c.save();c.translate(p.x,p.y+3);c.scale(1,ry/rx);
        const contact=c.createRadialGradient(0,0,0,0,0,rx);contact.addColorStop(0,'#14271d80');contact.addColorStop(.4,'#14271d50');contact.addColorStop(1,'#14271d00');
        c.fillStyle=contact;c.fillRect(-rx,-rx,rx*2,rx*2);c.restore();
      }
      c.getImageData(0,0,1,1);
      yield;
      if(lowPlantTexture(a.texture))continue;
      // 与动态场景物件一致，只烘焙脚根柔影，不把整张立面贴图投到地上。
    }
    for(const d of decor){
      if(d.x+d.width/2+8<cx||d.x-d.width/2-8>cx+600||d.y+8<cy||d.y-d.height-8>cy+550)continue;
      c.save();c.translate(d.x,d.y);if(d.flip)c.scale(-1,1);paintContact(c,contactForFrame(scene,d.texture),d.width,d.height,true);c.restore();
      c.save();c.translate(d.x,d.y);if(d.flip)c.scale(-1,1);c.drawImage(image(d.texture),-d.width/2,-d.height,d.width,d.height);c.restore();
      c.getImageData(0,0,1,1);
      yield;
    }
    // 连贯的大色块比逐像素噪声更接近手绘；全局坐标让跨块与刷新保持相同。
  };
  scene.data.set('appearanceSnapshot',()=>({版本:ART_QUALITY.version,低矮景观:decor.length,阴影原型:0,逻辑物件:props.length,说明:'场景物件仅使用脚根柔影；入口、占地、水域与道路保持原数据'}));
  scene.events.once('shutdown',()=>{decor.length=0;});
  return {bake};
}
export function paintGroundVariation(c:CanvasRenderingContext2D,cx:number,cy:number){
  for(let gy=Math.floor((cy-200)/260);gy<=Math.floor((cy+750)/260);gy++)for(let gx=Math.floor((cx-200)/260);gx<=Math.floor((cx+800)/260);gx++){
    const seed=appearanceSeed(`${gx},${gy}`),x=gx*260+seed%137,y=gy*260+(seed>>>8)%127,r=140+seed%95;
    const area=regionAt({x,y}).id,g=c.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,area==='north'?'#31515b19':area==='south'||area==='west'?'#97764516':area==='ruins'?'#515c6518':'#32513918');g.addColorStop(1,'#32513900');
    c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
  }
}
