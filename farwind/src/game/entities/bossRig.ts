import Phaser from 'phaser';
import type {CampBossKind} from '../../data/maps/windbell/campBosses';
import type {BossFrame} from './bossArtCache';
import {deformBossPoint,type BossMotionPose} from '../systems/bossMotion';
import {wolfClawSkin,deformWolfClaw,sampleWolfClaw,isWolfClaw,type WolfClawSkin} from '../systems/wolfClaw';
import type {EnemyAttack} from '../systems/enemyAttack';
import type {Point} from '../systems/obstacles';

// 直接复用高清图集；狼的挥爪单独蒙皮，不让大幅抬爪把躯干拉成橡皮。
export class BossRig{
 mesh:Phaser.GameObjects.Mesh2D;
 private claw?:Phaser.GameObjects.Mesh2D;
 private clawPoints:Point[]=[];
 private skin?:WolfClawSkin;
 clawTip?:Point;
 private frame='';
 private points:number[]=[];
 private cleanup:()=>void;
 constructor(scene:Phaser.Scene,key:string,private owner:Phaser.GameObjects.Sprite,onDestroy:()=>void){this.mesh=scene.add.mesh2d(0,0,key,[],[]);this.cleanup=()=>{onDestroy();this.destroy();};owner.once('destroy',this.cleanup);}
 draw(kind:CampBossKind,sprite:Phaser.GameObjects.Sprite,art:BossFrame,p:BossMotionPose,attack?:EnemyAttack|null,now=0){
  const frame=sprite.frame,native=art.nativeHeight,columns=20,rows=20;
  const clawing=isWolfClaw(attack)&&!attack!.cancelled&&now<attack!.recoveryUntil,view=String(frame.name).split('/')[0],skin=clawing?wolfClawSkin(view,attack!.bossPart):undefined,frameKey=String(frame.name)+(clawing?'/claw-'+((attack!.bossPart??0)%2):'');
  if(this.frame!==frameKey){
   this.frame=frameKey;this.skin=skin;this.points=[];const vertices:number[]=[],indices:number[]=[];
   this.claw?.setVisible(false);this.clawPoints=[];
   if(skin){
    this.claw??=sprite.scene.add.mesh2d(0,0,sprite.texture.key,[],[]);
    const border=[{x:-art.foot[0]/native,y:-art.foot[1]/native},{x:(art.width-art.foot[0])/native,y:-art.foot[1]/native},{x:(art.width-art.foot[0])/native,y:(art.height-art.foot[1])/native},{x:-art.foot[0]/native,y:(art.height-art.foot[1])/native}];
    const build=(points:Point[],holes:number[],mesh:Phaser.GameObjects.Mesh2D,rest:Point[])=>{
     const triangles=Phaser.Geom.Polygon.Earcut(points.flatMap(p=>[p.x,p.y]),holes),vs:number[]=[],is:number[]=[];
     // 分割后共享原纹理坐标，肩部边缘完全相接；细分只改善关节曲面，不加图片。
     const triangle=(a:Point,b:Point,c:Point,depth:number)=>{
      if(depth){const mid=(a:Point,b:Point)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2}),ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);triangle(a,ab,ca,depth-1);triangle(ab,b,bc,depth-1);triangle(ca,bc,c,depth-1);triangle(ab,bc,ca,depth-1);return;}
      const offset=rest.length;for(const p of [a,b,c]){rest.push(p);const u=(p.x*native+art.foot[0])/art.width,v=(p.y*native+art.foot[1])/art.height;vs.push(0,0,frame.u0+(frame.u1-frame.u0)*u,frame.v0+(frame.v1-frame.v0)*v);}is.push(offset,offset+1,offset+2,frame.sourceIndex);
     };
     for(let i=0;i<triangles.length;i+=3)triangle(points[triangles[i]],points[triangles[i+1]],points[triangles[i+2]],3);
     mesh.vertices=vs;mesh.indices=is;mesh.buildOrderedIndices(1,true);
    };
     const body:Point[]=[];build([...border,...skin.outline],[4],this.mesh,body);this.points=body.flatMap(p=>[p.x,p.y]);build(skin.outline,[],this.claw,this.clawPoints);
   }else{
   for(let r=0;r<=rows;r++)for(let c=0;c<=columns;c++){
    const x=art.width*c/columns,y=art.height*r/rows;this.points.push((x-art.foot[0])/native,(y-art.foot[1])/native);
    vertices.push(0,0,frame.u0+(frame.u1-frame.u0)*c/columns,frame.v0+(frame.v1-frame.v0)*r/rows);
   }
   for(let r=0;r<rows;r++)for(let c=0;c<columns;c++){const a=r*(columns+1)+c,b=a+columns+1;indices.push(a,b,a+1,frame.sourceIndex,b,a+1,b+1,frame.sourceIndex);}
   this.mesh.vertices=vertices;this.mesh.indices=indices;this.mesh.buildOrderedIndices(1,true);
   }
  }
  const vertices=this.mesh.vertices,width=art.width/native,sign=sprite.flipX?-1:1;
  for(let i=0;i<this.points.length;i+=2){const [x,y]=deformBossPoint(kind,this.frame.startsWith('right/'),this.points[i],this.points[i+1],width,p);vertices[i*2]=x*native*sign;vertices[i*2+1]=y*native;}
  // 镜像消费 Actor 的方向结果；网格锚点固定在真实脚底根，不能改变碰撞身体。
  this.mesh.setTexture(sprite.texture.key).setPosition(sprite.x,sprite.y).setScale(sprite.scaleX,sprite.scaleY).setRotation(sprite.rotation).setAlpha(sprite.alpha).setDepth(sprite.depth).setVisible(sprite.visible);
  this.clawTip=undefined;
  if(this.skin&&this.claw){
   const pose=sampleWolfClaw(attack,now,view),deform=(point:Point)=>{const q=deformWolfClaw(this.skin!,point,pose);return deformBossPoint(kind,view==='right',q.x,q.y,width,p);};
   for(let i=0;i<this.clawPoints.length;i++){const [x,y]=deform(this.clawPoints[i]);this.claw.vertices[i*4]=x*native*sign;this.claw.vertices[i*4+1]=y*native;}
   const [x,y]=deform(this.skin.tip);this.clawTip={x:sprite.x+x*native*sprite.scaleX*sign,y:sprite.y+y*native*sprite.scaleY};
   this.claw.setTexture(sprite.texture.key).setPosition(sprite.x,sprite.y).setScale(sprite.scaleX,sprite.scaleY).setRotation(sprite.rotation).setAlpha(sprite.alpha).setDepth(sprite.depth+.01).setVisible(sprite.visible);
  }
  sprite.setVisible(false);
 }
 setVisible(visible:boolean){this.mesh.setVisible(visible);this.claw?.setVisible(visible&&!!this.skin);}
 setScale(x:number,y:number){if(this.clawTip){this.clawTip.x=this.mesh.x+(this.clawTip.x-this.mesh.x)*x/this.mesh.scaleX;this.clawTip.y=this.mesh.y+(this.clawTip.y-this.mesh.y)*y/this.mesh.scaleY;}this.mesh.setScale(x,y);this.claw?.setScale(x,y);}
 syncImpact(sprite:Phaser.GameObjects.Sprite){for(const mesh of [this.mesh,this.claw])mesh?.setPosition(sprite.x,sprite.y).setRotation(sprite.rotation);}
 destroy(){this.owner.off('destroy',this.cleanup);this.mesh.destroy();this.claw?.destroy();}
}
