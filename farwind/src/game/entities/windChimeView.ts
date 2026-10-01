import type Phaser from 'phaser';

// 地面木架固定；铃体绕悬绳顶端摆动，飘带跟随铃体底端并独立受风。
export class WindChimeView {
  static preload(scene:Phaser.Scene){for(const part of ['frame','bell','ribbon'])scene.load.image(`wind-chime-${part}`,`/assets/wind-chimes/${part}.png`);}
  private frame:Phaser.GameObjects.Image;
  private bell:Phaser.GameObjects.Image;
  private ribbon:Phaser.GameObjects.Image;
  private glow:Phaser.GameObjects.Graphics;
  label:Phaser.GameObjects.Text;
  private rang=-1e6;
  private cycle=-1;
  private poweredAt:number|null=null;
  private angle=0;
  constructor(scene:Phaser.Scene,readonly x:number,readonly y:number,private phase:number,private sound:()=>void){
    this.frame=scene.add.image(x,y,'wind-chime-frame').setOrigin(.5,1).setDisplaySize(74,92).setDepth(y);
    this.bell=scene.add.image(x,y-84,'wind-chime-bell').setOrigin(.5,0).setDisplaySize(26,57).setDepth(y+.1);
    this.ribbon=scene.add.image(x,y-27,'wind-chime-ribbon').setOrigin(.5,0).setDisplaySize(10,30).setDepth(y+.2);
    this.glow=scene.add.graphics().setDepth(y+.3);
    this.label=scene.add.text(x,y+7,'铜风铃',{fontSize:'12px',color:'#fff2d3',stroke:'#264938',strokeThickness:3}).setOrigin(.5,0).setDepth(y+1);
  }
  ring(now:number){if(now-this.rang<120)return;this.rang=now;this.sound();}
  reset(){this.rang=-1e6;this.cycle=-1;this.poweredAt=null;}
  draw(now:number,powered:boolean,visible:boolean,near:boolean){
    for(const object of [this.frame,this.bell,this.ribbon,this.glow])object.setVisible(visible);
    this.label.setVisible(visible&&near);
    if(!visible)return;
    if(powered&&this.poweredAt===null){this.poweredAt=now;this.cycle=-1;}
    if(!powered)this.poweredAt=null;
    const cycle=Math.floor((now-(this.poweredAt??now)-this.phase)/2600);
    if(powered&&cycle>=0&&cycle!==this.cycle){this.cycle=cycle;this.ring(now);}
    const elapsed=Math.max(0,now-this.rang),response=Math.exp(-elapsed/650);
    this.angle=Math.sin((now+this.phase)*.002)*(powered?.075:.025)+Math.sin(elapsed*.018)*response*.27;
    this.bell.setRotation(this.angle);
    this.ribbon.setPosition(this.x-Math.sin(this.angle)*57,this.y-84+Math.cos(this.angle)*57).setRotation(this.angle+Math.sin((now+this.phase)*.005)*.16+response*.12);
    this.glow.clear();
    if(elapsed<1000)this.glow.lineStyle(2,0xffe9a7,(1-elapsed/1000)*.7).strokeEllipse(this.x,this.y-40,35+elapsed*.035,22+elapsed*.025);
  }
  snapshot(){return {木架:{x:this.x,y:this.y},铃体角度:this.angle,鸣响时间:this.rang,材质:this.bell.texture.key};}
  destroy(){for(const object of [this.frame,this.bell,this.ribbon,this.glow,this.label])object.destroy();}
}
