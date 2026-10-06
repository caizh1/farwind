import type Phaser from 'phaser';
import type {Point} from '../systems/obstacles';
import type {EnemyAttack,AttackGeometry} from '../systems/enemyAttack';

export const EAST_VINE_TEXTURE_BYTES=1024*256*4;
const MATERIAL_VERSION='4f10603ef5fc3f86336a00dcc6e7b6f88abf9859ae0f52091c54ac522b84e49c';
const KEY='east-boss-vine-'+MATERIAL_VERSION;
const LIMIT=128;
const FRAMES={base:[0,0,256,256],shaft:[256,0,512,256],tip:[768,0,256,256]} as const;
const unit=(v:number)=>Math.max(0,Math.min(1,v));

// 只描述画面从高处手臂落向地面路径的弧线；尖端始终落在正式攻击端点。
export function vineVisualPath(hand:Point,g:AttackGeometry,fade:number){
 const end=fade===1?g.b:{x:g.a.x+(g.b.x-g.a.x)*fade,y:g.a.y+(g.b.y-g.a.y)*fade},length=Math.hypot(end.x-hand.x,end.y-hand.y),n=Math.max(2,Math.min(60,Math.ceil(length/72)));
 const dx=end.x-hand.x,dy=end.y-hand.y,bend=Math.min(9,length*.025);
 const step=Math.max(72,length/60);
 return Array.from({length:n+1},(_,i)=>{if(i===0)return {...hand};if(i===n)return {...end};const u=Math.min(1,i*step/Math.max(1,length));return {x:hand.x+dx*u,y:hand.y+dy*u-Math.sin(u*Math.PI)*bend};});
}

export class BossVineVfx{
 private pool:Phaser.GameObjects.Image[]=[];private cursor=0;
 constructor(private scene:Phaser.Scene){}
 static preload(scene:Phaser.Scene){scene.load.image(KEY,'/assets/boss-vine/vine-material-v1.png?v='+MATERIAL_VERSION);}
 begin(){for(const image of this.pool)image.setVisible(false);this.cursor=0;}
 snapshot(){return {ready:!!this.scene.textures?.exists(KEY),objects:this.pool.length,visible:this.cursor,textureBytes:this.scene.textures?.exists(KEY)?EAST_VINE_TEXTURE_BYTES:0,limit:LIMIT};}
 private stamp(frame:keyof typeof FRAMES,a:Point,b:Point,height:number,alpha:number,depth:number){
  if(this.cursor>=LIMIT)return;const texture=this.scene.textures.get(KEY);
  if(!texture.has(frame)){const [x,y,w,h]=FRAMES[frame];texture.add(frame,0,x,y,w,h);}
  const image=this.pool[this.cursor]??(this.pool[this.cursor]=this.scene.add.image(0,0,KEY,frame));this.cursor++;
  image.setTexture(KEY,frame).setPosition((a.x+b.x)/2,(a.y+b.y)/2).setOrigin(.5).setDisplaySize(Math.hypot(b.x-a.x,b.y-a.y)*(frame==='tip'?1:1.025),height).setRotation(Math.atan2(b.y-a.y,b.x-a.x)).setAlpha(alpha).setDepth(depth).setVisible(true);
 }
 draw(a:EnemyAttack,root:Point,hand:Point,g:AttackGeometry,now:number,ink:Phaser.GameObjects.Graphics){
  const fade=now<a.activeUntil?1:unit(1-(now-a.activeUntil)/180),alpha=fade*unit((now-a.contactAt)/22);if(alpha<=0)return;
  const points=vineVisualPath(hand,g,fade),end=points.at(-1)!;
  // 地面细影给出真实落点，避免投影高度被误读为偏离伤害线。
  ink.lineStyle(7,0x17231d,alpha*.30).lineBetween(g.a.x,g.a.y,g.a.x+(g.b.x-g.a.x)*fade,g.a.y+(g.b.y-g.a.y)*fade);
  if(!this.scene.textures?.exists(KEY)){
   const left=points.map((p,i)=>({x:p.x,y:p.y+(4*(1-i/(points.length-1))+.5)})),right=[...points].reverse().map((p,i)=>({x:p.x,y:p.y-(4*i/(points.length-1)+.5)}));
   ink.fillStyle(0x9b8152,alpha).beginPath().moveTo(left[0].x,left[0].y);for(const p of [...left.slice(1),...right])ink.lineTo(p.x,p.y);ink.closePath().fillPath();return;
  }
  for(let i=1;i<points.length;i++){
   const u=i/(points.length-1),height=128*(1-u*.22),depth=root.y+(end.y-root.y)*u+1;
   this.stamp(i===1?'base':i===points.length-1?'tip':'shaft',points[i-1],points[i],height,alpha,depth);
  }
 }
}
