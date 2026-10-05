import type Phaser from 'phaser';
import type {Prop} from '../../data/world';
import {CITY_WALL_HEIGHT} from '../../data/maps/windwhisper';
import {CITY_WALL_LEAN,cityMasonry,stonePoint,type StonePoint} from './cityMasonry';
export {CITY_WALL_LEAN,cityWallScreenX} from './cityMasonry';

export const isContinuousCityWall=(p:Prop)=>p.id.startsWith('city-west-wall-')||p.id.startsWith('city-east-wall-')||p.id.startsWith('city-edge-');
export const isCityFortification=(p:Prop)=>isContinuousCityWall(p)||p.id.startsWith('city-gate-')||p.id.startsWith('city-corner-');
export function cityWallProfile(p:Prop){
 const vertical=!p.id.startsWith('city-edge-'),left=85+CITY_WALL_LEAN+24;
 return {vertical,width:left+120,height:(vertical?110:70)+CITY_WALL_HEIGHT+64,step:vertical?110:155,originX:left/(left+120)};
}
// 连接件共用墙脚与280单位墙顶，前栏是单独的遮挡层。
export function makeContinuousCityWall(scene:Phaser.Scene,p:Prop,base:Phaser.GameObjects.Image){
 const gate=p.id==='city-gate-beam',tower=p.id==='city-gate-north'||p.id==='city-gate-south',corner=p.id.startsWith('city-corner-');
 const profile=cityWallProfile(p),vertical=profile.vertical,H=CITY_WALL_HEIGHT;
 const shape=gate?'gate':tower?'tower':corner?'corner':vertical?'long':'cross';
 const width=gate?620:tower||corner?400:profile.width,height=gate?420+H+64:tower?180+H+270:corner?170+H+64:profile.height;
 const left=gate?370:tower||corner?260:profile.originX*width;
 const key=`fortress-v3-${shape}`,frontKey=`${key}-front`;
 if(!scene.textures.exists(key)){
  for(const front of [false,true]){
   const texture=scene.textures.createCanvas(front?frontKey:key,width,height)!,c=texture.context;c.translate(left,height);
   const m=cityMasonry(scene,c,gate?-300/420:0,gate?-150:0);
   const shadow=(x:number,y:number,w:number,h:number)=>{const g=c.createLinearGradient(x,0,x+w,0);g.addColorStop(0,'#242a2f65');g.addColorStop(1,'#242a2f00');c.fillStyle=g;c.fillRect(x,y,w,h);};
   const rail=(x0:number,y0:number,x1:number,y1:number,axis:'x'|'y')=>{
    m.block(x0,y0,x1,y1,H,H+19);
    const length=axis==='y'?y1-y0:x1-x0,count=Math.max(1,Math.round(length/55)),step=length/count;
    for(let i=0;i<count;i++){const u=i*step+4;
     if(axis==='y')m.block(x0-1,y0+u,x1+1,Math.min(y1,y0+u+26),H+19,H+48);
     else m.block(x0+u,y0-1,Math.min(x1,x0+u+26),y1+1,H+19,H+48);
    }
   };
   const slit=(x:number,y:number,z:number)=>{
    m.polygon([[x,y-3,z-23],[x,y+3,z-23],[x,y+3,z+23],[x,y-3,z+23]],'#353c3c');
    m.line([x,y+4,z-24],[x,y+4,z+24],'#cdbd96',2);
   };
   if(gate){
    const y0=-420,y1=0,x=front?65:-81;
    // 门洞在两个立面上都是真正透明的孔，洞顶平台与门塔同高。
    if(!front){m.face([-81,y0,0],[65,y0,0],[-81,y1,0],146,420,2,'#26333e28');}
    c.save();const [px,py]=m.project([x,y0,0]);c.transform(-300/420,1,-CITY_WALL_LEAN/H,-1,px,py);
    c.beginPath();c.rect(0,0,420,H);c.moveTo(0,0);c.lineTo(420,0);c.lineTo(420,130);c.quadraticCurveTo(210,270,0,130);c.closePath();c.clip('evenodd');
    c.setTransform(1,0,0,1,left,height);c.fillStyle=c.createPattern(m.tiles[0],'repeat')!;c.fillRect(-left,-height,width,height);c.fillStyle=front?'#39465033':'#30384566';c.fillRect(-left,-height,width,height);
    c.restore();
    // 内拱与外拱之间的拱腹体现城门厚度。
    if(!front){for(let i=0;i<16;i++){
     const t=i/16,u=t*420,z=130+280*t*(1-t),t2=(i+1)/16,u2=t2*420,z2=130+280*t2*(1-t2);
     m.polygon([[-81,y0+u,z],[65,y0+u,z],[65,y0+u2,z2],[-81,y0+u2,z2]],i%2?'#8a806b':'#968b75','#655d50');
    }}else{
     for(let i=0;i<16;i++){const t=i/16,t2=(i+1)/16,u=t*420,u2=t2*420,z=130+280*t*(1-t),z2=130+280*t2*(1-t2);
      m.polygon([[x,y0+u,z],[x,y0+u2,z2],[x,y0+u2,z2+24],[x,y0+u,z+24]],i%2?'#c5b89b':'#d6c9aa','#8a7e64');
     }
     // 抬起的铁栅固定在洞顶，木门贴在两端洞壁，不占据道路。
     for(let y=y0+32;y<-20;y+=24){const t=(y-y0)/420,z=130+280*t*(1-t);m.line([x-4,y,z-3],[x-4,y,z-31],'#343838',3);}
     m.face([-81,y0,H],[65,y0,H],[-81,y1,H],146,420,2,'#fff1cd18');
     rail(-81,y0,-63,y1,'y');rail(47,y0,65,y1,'y');
     m.banner(65,-210,H-46);
    }
   }else if(tower||corner){
    const half=tower?100:90,back=tower?-180:-170;
    if(!front){
     shadow(half,back,28,-back);m.block(-half,back,half,0,0,H);
     m.block(-half-5,back-5,half+5,4,0,23);m.block(-half-4,back-4,half+4,3,H-18,H-6);
     rail(-half,back,-half+18,0,'y');rail(-half,back,half,back+18,'x');
     if(tower){
      slit(half,back/2,125);m.banner(25,1,H-45);
      const source=scene.textures.get('city-gate-crown').getSourceImage() as HTMLImageElement;
      const [cx,cy]=m.project([-15,-105,H]);c.drawImage(source,cx-99,cy-210,198,210);
     }
    }else{
     // 墙顶出入口留在塔台南北中部，连续步道可以接入平台。
     rail(half-18,back,half,0,'y');
     for(const [a,b] of [[-half,-65],[65,half]])rail(a,-18,b,0,'x');
    }
   }else if(vertical){
    if(!front){
     shadow(65,-110,45,110);
     m.face([65,-110,0],[65,0,0],[65,-110,H],110,H,0,'#3e4c5738',-110);
     // 水平腰线与凸出的扶壁都按同一投影砌筑，不用斜线代替墙身。
     for(const z of [12,H*.45,H-20])m.block(64,-110,72,0,z,z+9);
     m.face([-81,-110,H],[65,-110,H],[-81,0,H],146,110,2,'#fff0c512');
     const y=-63,z=H-36;
     m.polygon([[65,y-13,z],[65,y+13,z],[81,y+18,0],[81,y-18,0]],'#b6ab90','#8c816a');
     m.polygon([[65,y+13,z],[81,y+18,0],[65,y+18,0]],'#857e6c');
     m.line([65,y-13,z],[81,y-18,0],'#dfd1b0',2);
     for(let h=25;h<z;h+=28){const x=81-16*h/z;m.line([x,y-17,h],[x,y+17,h],'#887e68',1);}
     slit(65,-18,135);rail(-81,-110,-63,0,'y');
    }else rail(47,-110,65,0,'y');
   }else{
    if(!front){
     m.face([-77.5,0,0],[77.5,0,0],[-77.5,0,H],155,H,0,'#4c4b4215',p.x-77.5);
     m.face([-77.5,-70,H],[77.5,-70,H],[-77.5,0,H],155,70,2,'#fff1cd18');
     for(const z of [12,H*.45,H-20])m.block(-77.5,-3,77.5,4,z,z+9);
     m.block(-10,-2,10,12,0,H-36);rail(-77.5,-70,77.5,-52,'x');
     shadow(0,-8,120,8);
    }else rail(-77.5,-18,77.5,0,'x');
   }
   texture.refresh();
  }
 }
 base.setTexture(key).setOrigin(left/width,1).setDisplaySize(width,height);
 if(gate)base.setDepth(p.y-420);
 const front=scene.add.image(base.x,base.y,frontKey).setOrigin(left/width,1).setDisplaySize(width,height).setDepth(p.y+4);
 base.setData('连续城墙前栏',front);
 const sync=()=>front.setVisible(base.visible&&!scene.data.get('shadowSettings')?.().indoor).setAlpha(base.alpha);
 scene.events.on('postupdate',sync);scene.events.once('shutdown',()=>scene.events.off('postupdate',sync));
}
