import Phaser from 'phaser';
import {WORLD} from '../../data/world';
import {BLACK_HOLE,type BlackHoleSlash} from '../systems/blackHoleSlash';

export class BlackHoleView {
 private blades=new Map<number,Phaser.GameObjects.Image>();
 private rifts=new Map<number,{core:Phaser.GameObjects.Image;flow:Phaser.GameObjects.Image;dust:Phaser.GameObjects.Graphics}>();
 static preload(scene:Phaser.Scene){for(const name of ['flight','rift','suction'])scene.load.spritesheet(`black-hole-${name}`,`/assets/animation/black-hole-slash/${name}.png`,{frameWidth:256,frameHeight:256});}
 constructor(private scene:Phaser.Scene,private system:BlackHoleSlash){}
 draw(now:number,simple=false,lowFlash=false){
  const liveBlades=new Set(this.system.blades.winds.filter(w=>!w.terminated).map(w=>w.id));
  for(const [id,image] of this.blades)if(!liveBlades.has(id)){image.destroy();this.blades.delete(id);}
  for(const w of this.system.blades.winds){
   if(w.terminated)continue;
   let image=this.blades.get(w.id);
   if(!image){image=this.scene.add.image(0,0,'black-hole-flight');this.blades.set(w.id,image);}
   image.setFrame(Math.floor(Math.max(0,now-w.born)/50)%6).setPosition(w.position.x+w.visualOffset.x,w.position.y+w.visualOffset.y)
    .setDisplaySize(128,128).setRotation(Math.atan2(w.direction.y,w.direction.x)).setDepth(w.position.y+4).setAlpha(lowFlash?.75:1);
  }
  const live=new Set(this.system.rifts.map(r=>r.id));
  for(const [id,layer] of this.rifts)if(!live.has(id)){layer.core.destroy();layer.flow.destroy();layer.dust.destroy();this.rifts.delete(id);}
  for(const r of this.system.rifts){
   let layer=this.rifts.get(r.id);
   if(!layer){layer={core:this.scene.add.image(r.x,r.y-42,'black-hole-rift'),flow:this.scene.add.image(r.x,r.y,'black-hole-suction').setDepth(WORLD.top-880),dust:this.scene.add.graphics().setDepth(r.y+4)};this.rifts.set(r.id,layer);}
   const age=Math.max(0,now-r.born),closeAt=BLACK_HOLE.open+BLACK_HOLE.hold;
   const frame=age<BLACK_HOLE.open?Math.min(3,Math.floor(age/BLACK_HOLE.open*4)):age<closeAt?4+Math.floor((age-BLACK_HOLE.open)/90)%8:12+Math.min(3,Math.floor((age-closeAt)/BLACK_HOLE.close*4));
   const envelope=Math.min(1,age/BLACK_HOLE.open)*Math.max(0,Math.min(1,(BLACK_HOLE.open+BLACK_HOLE.hold+BLACK_HOLE.close-age)/BLACK_HOLE.close)),alpha=envelope*(lowFlash?.6:1);
   layer.core.setFrame(frame).setPosition(r.x,r.y-42).setDisplaySize(180,240).setDepth(r.y+3).setAlpha(lowFlash?.8:1);
   layer.flow.setFrame(Math.floor(age/80)%8).setDisplaySize(410,410).setAlpha(alpha*.52);
   layer.dust.clear();
   for(let i=0;i<(simple?6:14);i++){
    const u=(age/680+i/14)%1,angle=i*2.399+u*.85+age/2400,radius=BLACK_HOLE.radius*(1-u);
    const x=r.x+Math.cos(angle)*radius,y=r.y+Math.sin(angle)*radius;
    const tail=radius+9,tailAngle=angle-.08,a=alpha*Math.sin(Math.PI*u);
    layer.dust.lineStyle(1.2,0xeee4ff,a*.8).lineBetween(x,y,r.x+Math.cos(tailAngle)*tail,r.y+Math.sin(tailAngle)*tail);
    layer.dust.fillStyle(i%3?0xdabfff:0x8c92ee,a).fillCircle(x,y,i%3?1.7:2.6);
   }
  }
 }
 clear(){for(const image of this.blades.values())image.destroy();this.blades.clear();for(const layer of this.rifts.values()){layer.core.destroy();layer.flow.destroy();layer.dust.destroy();}this.rifts.clear();}
}
