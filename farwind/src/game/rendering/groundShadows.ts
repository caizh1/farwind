import Phaser from 'phaser';
import {projectShadowPoint,shadowStrength} from './shadowGeometry';

type Source=Phaser.GameObjects.Image|Phaser.GameObjects.Sprite|Phaser.GameObjects.Graphics|Phaser.GameObjects.Text;
type Root={x:number;y:number;depth:number};
type Options={label?:string;width?:number;height?:number;projection?:boolean;root?:()=>Root;visible?:()=>boolean;surfaceDepth?:()=>number};
type Entry={source:Source;contact:Phaser.GameObjects.Ellipse;soft:Phaser.GameObjects.Image;cast?:Phaser.GameObjects.Mesh2D;options:Options;alpha:number;managed:boolean;cleanup:()=>void};
const views=new WeakMap<Phaser.Scene,GroundShadows>();
const SOFT='ground-shadow-soft';

// 只复用当前帧的纹理与四个顶点，不复制高清图集、不逐帧读像素或上传画布。
export class GroundShadows {
  entries=new Map<Source,Entry>();
  enabled=true;
  constructor(private scene:Phaser.Scene) {
    if(!scene.textures.exists(SOFT)){
      const texture=scene.textures.createCanvas(SOFT,128,64)!,c=texture.context;
      c.scale(1,.5);const g=c.createRadialGradient(64,64,0,64,64,64);
      g.addColorStop(0,'rgba(18,30,25,1)');g.addColorStop(.38,'rgba(18,30,25,.8)');
      g.addColorStop(.72,'rgba(18,30,25,.32)');g.addColorStop(1,'rgba(18,30,25,0)');
      c.fillStyle=g;c.fillRect(0,0,128,128);texture.refresh();
    }
    scene.events.on('prerender',this.draw,this);
    scene.data.set('shadowSnapshot',()=>this.snapshot());
    scene.events.once('shutdown',()=>{
      scene.events.off('prerender',this.draw,this);
      for(const e of [...this.entries.values()])e.cleanup();
      views.delete(scene);
    });
  }
  add(source:Source,contact?:Phaser.GameObjects.Ellipse,options:Options={}) {
    if(this.entries.has(source))return this.entries.get(source)!.contact;
    const managed=!contact;
    contact??=this.scene.add.ellipse(source.x,source.y,options.width??48,options.height??16,0x122019,1);
    const soft=this.scene.add.image(0,0,SOFT).setVisible(false);
    const cast=options.projection!==false&&'frame' in source?
      this.scene.add.mesh2d(0,0,source.texture.key,new Array(16).fill(0),[0,1,2,0,0,2,3,0]).setVisible(false):undefined;
    if(cast){const tint=cast as Phaser.GameObjects.Mesh2D&{tint:number;tintMode:Phaser.TintModes};tint.tint=0x122019;tint.tintMode=Phaser.TintModes.FILL;}
    cast?.buildOrderedIndices(0,true);
    const e:Entry={source,contact,soft,cast,options,alpha:contact.alpha||1,managed,cleanup:()=>{}};
    // 保留原阴影对象作为位置、显隐与飞行缩放的权威，硬边椭圆由柔边纹理替代。
    contact.setFillStyle(0x122019,0);
    e.cleanup=()=>{
      source.off('destroy',e.cleanup);contact!.off('destroy',e.cleanup);
      this.entries.delete(source);soft.destroy();cast?.destroy();if(managed)contact!.destroy();
    };
    source.once('destroy',e.cleanup);contact.once('destroy',e.cleanup);
    this.entries.set(source,e);return contact;
  }
  draw() {
    if(!this.enabled){for(const e of this.entries.values()){e.soft.setVisible(false);e.cast?.setVisible(false);}return;}
    const settings=this.scene.data.get('shadowSettings')?.()??{time:480,indoor:false};
    const strength=shadowStrength(settings.time,settings.indoor),view=this.scene.cameras.main.worldView;
    for(const e of this.entries.values()){
      const {source:s,contact:c,options:o,soft,cast}=e;
      if(e.managed){const root=o.root?.()??{x:s.x,y:s.y,depth:s.depth-.5};c.setPosition(root.x,root.y).setDepth(root.depth).setVisible(s.visible);}
      const visible=c.visible&&(o.visible?.()??s.visible)&&s.alpha>0&&c.alpha>0&&(!settings.indoor||c.depth>7000||!!o.surfaceDepth);
      // 静态建筑仍烘焙在地面；这里只更新可变化物件。视窗外不提交网格。
      const onScreen=visible&&c.x>=view.x-350&&c.x<=view.right+350&&c.y>=view.y-350&&c.y<=view.bottom+350;
      soft.setVisible(onScreen);cast?.setVisible(onScreen);if(!onScreen)continue;
      const alpha=Math.min(s.alpha,c.alpha/e.alpha);
      const depth=o.surfaceDepth?.()??(settings.indoor?7200:settings.floor??c.depth-.04);
      soft.setPosition(c.x,c.y+6).setDepth(depth+.01).setRotation(.12)
        .setDisplaySize(c.width*1.45*Math.abs(c.scaleX),c.height*1.8*Math.abs(c.scaleY)).setAlpha(strength.contact*alpha);
      if(!cast||!('frame' in s))continue;
      const f=s.frame,v=cast.vertices,coords=[[f.x,f.y],[f.x+f.cutWidth,f.y],[f.x+f.cutWidth,f.y+f.cutHeight],[f.x,f.y+f.cutHeight]];
      const uvs=[[f.u0,f.v0],[f.u1,f.v0],[f.u1,f.v1],[f.u0,f.v1]];
      for(let i=0;i<4;i++){
        const p=projectShadowPoint((coords[i][0]-s.displayOriginX)*s.scaleX,(coords[i][1]-s.displayOriginY)*s.scaleY,s.flipX,s.rotation);
        v[i*4]=p.x;v[i*4+1]=p.y;v[i*4+2]=uvs[i][0];v[i*4+3]=uvs[i][1];
      }
      // 多页图集必须跟随当前帧的页号，避免首领和高清小怪投影串图。
      if(cast.indices[3]!==f.sourceIndex){cast.indices[3]=cast.indices[7]=f.sourceIndex;cast.buildOrderedIndices(0,true);}
      cast.setTexture(s.texture.key).setPosition(c.x,c.y+3).setDepth(depth).setAlpha(strength.cast*alpha);
    }
    // Phaser在prerender前已排序；新建或跨室内层级的阴影需要当帧重排。
    this.scene.children.depthSort();
  }
  snapshot() {
    return {说明:'柔边接地影与当前帧轮廓投影；阴影只改变表现，不写入存档或碰撞。',数量:this.entries.size,
      实体:[...this.entries.values()].map(e=>({名称:e.options.label??('texture' in e.source?e.source.texture.key:'公共设施'),位置:[e.contact.x,e.contact.y],尺寸:[e.contact.width,e.contact.height],可见:e.soft.visible,透明度:e.soft.alpha,层级:e.soft.depth,投影:e.cast?.visible??false,投影层级:e.cast?.depth,投影透明度:e.cast?.alpha,顶点:e.cast?.vertices.slice(),页号:e.cast?.indices[3],源位置:[e.source.x,e.source.y],源层级:e.source.depth,源透明度:e.source.alpha,素材:'texture' in e.source?e.source.texture.key:null,帧:'frame' in e.source?e.source.frame.name:null}))};
  }
}

export function groundShadows(scene:Phaser.Scene) {
  let view=views.get(scene);if(!view){view=new GroundShadows(scene);views.set(scene,view);}return view;
}
