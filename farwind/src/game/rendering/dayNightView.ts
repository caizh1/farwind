import type Phaser from "phaser";
import {WORLD_LIGHTS,NIGHT_DISCOVERY} from "../../data/dayNight";
import {lightAt,phaseAt} from "../systems/worldClock";
import type {State} from "../systems/state";
// 覆盖主画布，而非加入会再受zoom影响的世界物体。HUD是独立DOM层。
export class DayNightView {
  canvas=document.createElement("canvas");
  context=this.canvas.getContext("2d")!;
  glow=document.createElement("canvas");
  mask=document.createElement("canvas");
  draws=0;visibleLights=0;lastTime=-Infinity;shaded=false;
  afterRender=()=>this.render();
  constructor(private scene:Phaser.Scene,private read:()=>State,private visibility:()=>number){
    this.canvas.id="day-night-overlay";this.canvas.setAttribute("aria-hidden","true");
    this.canvas.style.cssText="position:fixed;pointer-events:none;z-index:1;";
    document.body.append(this.canvas);
    for(const [canvas,color]of [[this.glow,"255,195,104"],[this.mask,"0,0,0"]] as const){
      canvas.width=canvas.height=256;const c=canvas.getContext("2d")!,g=c.createRadialGradient(128,128,0,128,128,128);
      g.addColorStop(0,`rgba(${color},.5)`);g.addColorStop(.35,`rgba(${color},.22)`);g.addColorStop(1,`rgba(${color},0)`);c.fillStyle=g;c.fillRect(0,0,256,256);
    }
    scene.game.events.on("postrender",this.afterRender,this);
    scene.events.once("shutdown",()=>this.destroy());
  }
  render(force=false){
    const state=this.read(),rect=this.scene.game.canvas.getBoundingClientRect(),c=this.context,cam=this.scene.cameras.main;
    const w=this.scene.scale.width,h=this.scene.scale.height;
    if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;force=true;}
    Object.assign(this.canvas.style,{left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`});
    const light=lightAt(state.time);
    if(!light.shade&&!light.lamps){if(this.shaded||force)c.clearRect(0,0,w,h);this.shaded=false;this.lastTime=state.time;this.visibleLights=0;return;}
    this.shaded=true;
    this.draws++;this.lastTime=state.time;c.clearRect(0,0,w,h);
    c.globalCompositeOperation="source-over";c.globalAlpha=1;
    c.fillStyle=`rgba(${light.color.join(",")},${light.shade*(1-this.visibility()*.28)})`;c.fillRect(0,0,w,h);
    const point=(x:number,y:number)=>({x:(x-cam.midPoint.x)*cam.zoom+w/2,y:(y-cam.midPoint.y)*cam.zoom+h/2});
    const draw=(x:number,y:number,r:number,warm=true,strength=1)=>{
      const p=point(x,y),radius=r*cam.zoom;if(p.x+radius<0||p.x-radius>w||p.y+radius<0||p.y-radius>h)return;
      this.visibleLights++;c.globalAlpha=light.lamps*strength;
      c.globalCompositeOperation="destination-out";c.drawImage(this.mask,p.x-radius,p.y-radius,radius*2,radius*2);
      if(warm){c.globalCompositeOperation="source-over";c.globalAlpha=light.lamps*.2*strength;c.drawImage(this.glow,p.x-radius,p.y-radius,radius*2,radius*2);}
    };
    this.visibleLights=0;if(state.life.playerSpace!=="village"){draw(700,700,410,true);c.globalAlpha=1;c.globalCompositeOperation="source-over";return;}for(const l of WORLD_LIGHTS)draw(l.x,l.y,l.r);
    draw(1330,1440,240,false,.6);draw(3750,610,145,false,.4);
    if(phaseAt(state.time)==="night"&&!state.night.discovered){
      for(let i=0;i<7;i++){const x=NIGHT_DISCOVERY.x+Math.sin(i*2.3)*65,y=NIGHT_DISCOVERY.y+Math.cos(i*1.7)*40,p=point(x,y);
        c.globalCompositeOperation="source-over";c.globalAlpha=.45+.12*Math.sin(state.time*.08+i);c.fillStyle="#f4e6aa";c.beginPath();c.ellipse(p.x,p.y,2*cam.zoom,1.5*cam.zoom,0,0,Math.PI*2);c.fill();}
    }
    c.globalAlpha=1;c.globalCompositeOperation="source-over";
  }
  destroy(){this.scene.game.events.off("postrender",this.afterRender,this);this.canvas.remove();this.glow.width=this.mask.width=0;}
}
