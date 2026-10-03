import type Phaser from 'phaser';
import {ART_QUALITY,appearanceFor,appearanceSeed,buildingDecorations} from '../../data/worldAppearance';
import {props,WATERS,BRIDGES,canDecorate} from '../../data/world';
import {regionAt} from '../../data/village';
import {bakedShadowProp} from './shadowGeometry';

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
  const masks=new Map<string,HTMLCanvasElement>();
  const decor=props.flatMap(buildingDecorations);
  // 主路两侧保留通行缓冲；湖岸装饰避开所有桥面及入口。
  for(const water of WATERS)for(let i=0;i<34;i++){
    const a=i*2.399963,seed=appearanceSeed(`${water.id}-${i}`),x=water.x+Math.cos(a)*(water.rx+32+seed%25),y=water.y+Math.sin(a)*(water.ry+24+seed%20);
    if(!canDecorate(x,y,15)||BRIDGES.some(b=>x>b.x-32&&x<b.x+b.w+32&&y>b.y-35&&y<b.y+b.h+35))continue;
    decor.push({x,y,width:32+seed%20,height:20+seed%10,texture:`quality-${ART_QUALITY.decorations[seed%3]}`,flip:!!(seed%2)});
  }
  const image=(key:string)=>scene.textures.get(key).getSourceImage() as HTMLImageElement;
  const shadowMask=(key:string,frameName?:string)=>{
    const name=`${key}:${frameName??'base'}`;let mask=masks.get(name);if(mask)return mask;
    const frame=scene.textures.getFrame(key,frameName??'__BASE');if(!frame)return undefined;
    mask=document.createElement('canvas');mask.width=128;mask.height=Math.max(32,Math.min(192,Math.round(128*frame.cutHeight/frame.cutWidth)));
    const c=mask.getContext('2d')!;c.drawImage(frame.source.image as CanvasImageSource,frame.cutX,frame.cutY,frame.cutWidth,frame.cutHeight,0,0,mask.width,mask.height);
    c.globalCompositeOperation='source-in';c.fillStyle='#173c31';c.fillRect(0,0,mask.width,mask.height);masks.set(name,mask);return mask;
  };
  const bake=(c:CanvasRenderingContext2D,cx:number,cy:number)=>{
    for(const logical of staticProps){
      const p=logical.displayAt?{...logical,...logical.displayAt}:logical;
      const base=scene.textures.get(appearanceFor(p).texture),frame=base.get(p.frame??'__BASE'),a=appearanceFor(p,{width:frame.cutWidth,height:frame.cutHeight}),tree=p.art==='tree'||p.art==='pink';
      const reach=a.height*ART_QUALITY.shadow.x;
      if(p.x+a.width/2+reach<cx||p.x-a.width/2>cx+600||p.y+Math.max(22,a.height*ART_QUALITY.shadow.y)<cy||p.y-22>cy+550)continue;
      const rx=Math.max(12,Math.min(a.width*.5,(p.solid?.[0]??a.width)*.65)),ry=Math.max(7,Math.min(24,(p.solid?.[1]??20)*.24));
      c.save();c.translate(p.x,p.y+3);c.scale(1,ry/rx);
      const contact=c.createRadialGradient(0,0,0,0,0,rx);contact.addColorStop(0,'#14271d80');contact.addColorStop(.4,'#14271d50');contact.addColorStop(1,'#14271d00');
      c.fillStyle=contact;c.fillRect(-rx,-rx,rx*2,rx*2);c.restore();
      const mask=shadowMask(a.texture,p.frame);if(!mask)continue;
      c.save();c.globalAlpha=tree?ART_QUALITY.shadow.tree:ART_QUALITY.shadow.building;c.translate(p.x,p.y+3);c.transform(1,0,-ART_QUALITY.shadow.x,-ART_QUALITY.shadow.y,0,0);c.filter='blur(1.5px)';c.drawImage(mask,-a.width/2,-a.height,a.width,a.height);c.restore();
    }
    for(const d of decor){
      if(d.x+d.width/2<cx||d.x-d.width/2>cx+600||d.y<cy||d.y-d.height>cy+550)continue;
      c.save();c.globalAlpha=.18;c.fillStyle='#203728';c.filter='blur(2px)';c.beginPath();c.ellipse(d.x+3,d.y+2,d.width*.43,Math.max(3,d.height*.13),0,0,Math.PI*2);c.fill();c.restore();
      c.save();c.translate(d.x,d.y);if(d.flip)c.scale(-1,1);c.drawImage(image(d.texture),-d.width/2,-d.height,d.width,d.height);c.restore();
    }
    // 连贯的大色块比逐像素噪声更接近手绘；全局坐标让跨块与刷新保持相同。
  };
  scene.data.set('appearanceSnapshot',()=>({版本:ART_QUALITY.version,低矮景观:decor.length,阴影原型:masks.size,逻辑物件:props.length,说明:'只改变表现，入口、占地、水域与道路保持原数据'}));
  scene.events.once('shutdown',()=>{masks.clear();decor.length=0;});
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
