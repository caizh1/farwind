import type Phaser from 'phaser';

export type ContactPath=readonly (readonly [number,number])[];
export type GroundContact={paths:readonly ContactPath[];closed?:boolean};
const stoneBases:Record<string,ContactPath>={
  'city-complete-check-booth':[[.06,.84],[.59,1],[.90,.80],[.39,.64]],
  'city-complete-street-lamp':[[.05,.94],[.55,1],[.95,.94],[.46,.88]],
  'city-complete-city-flag':[[.18,.93],[.50,1],[.75,.91],[.43,.84]],
};
// 斜视图的后轮、后椅脚与梯脚高于前脚；它们仍接地，不能靠统一底缘阈值遗漏。
const rearSupports:Record<string,readonly ContactPath[]>={
  'city-complete-cargo-cart':[[[.10,.795],[.16,.795]],[[.73,.78],[.79,.78]]],
  'city-complete-street-bench':[[[.005,.714],[.065,.714]],[[.16,.612],[.21,.612]]],
  'city-complete-wall-stairs':[[[.74,.774],[.80,.774]],[[.92,.65],[.98,.65]]],
};
const caches=new WeakMap<Phaser.Scene,Map<string,GroundContact>>();

// 只取最下方18%的实体边缘，忽略淡投影；断开的桌脚／门柱分别描边，不跨空隙铺黑带。
export function contactContours(alpha:ArrayLike<number>,width:number,height:number):GroundContact {
  const paths:[number,number][][]=[];let path:[number,number][]=[];
  const finish=()=>{if(path.length>=2)paths.push(path);path=[];};
  const top=Math.floor(height*.82);
  for(let x=0;x<width;x++){
    let y=height-1;while(y>=top&&alpha[y*width+x]<160)y--;
    if(y<top){finish();continue;}
    path.push([(x+.5)/width,(y+.5)/height]);
  }
  finish();return {paths};
}

export function contactForFrame(scene:Phaser.Scene,key:string,frameName:string|number='__BASE'):GroundContact {
  let cache=caches.get(scene);
  if(!cache){cache=new Map();caches.set(scene,cache);scene.events.once('shutdown',()=>caches.delete(scene));}
  const id=`${key}:${frameName}`,known=cache.get(id);if(known)return known;
  const base=stoneBases[key];if(base){const contact={paths:[base],closed:true};cache.set(id,contact);return contact;}
  const frame=scene.textures.getFrame(key,frameName);if(!frame)return {paths:[]};
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=Math.max(32,Math.min(192,Math.round(128*frame.cutHeight/frame.cutWidth)));
  const c=canvas.getContext('2d',{willReadFrequently:true})!;
  c.drawImage(frame.source.image as CanvasImageSource,frame.cutX,frame.cutY,frame.cutWidth,frame.cutHeight,0,0,canvas.width,canvas.height);
  const rgba=c.getImageData(0,0,canvas.width,canvas.height).data,alpha=new Uint8Array(canvas.width*canvas.height);
  for(let i=0;i<alpha.length;i++)alpha[i]=rgba[i*4+3];
  const contact=contactContours(alpha,canvas.width,canvas.height);
  if(rearSupports[key])contact.paths=[...contact.paths,...rearSupports[key]];
  cache.set(id,contact);return contact;
}

// 接触暗边始终贴住可见底部，不修改素材像素、坐标、碰撞或交互范围。
export function paintContact(c:CanvasRenderingContext2D,contact:GroundContact,width:number,height:number,plant=false) {
  c.save();c.translate(0,plant?0:1);c.lineJoin='round';c.lineCap='round';
  for(const path of contact.paths){
    c.beginPath();path.forEach(([x,y],i)=>{const px=(x-.5)*width,py=(y-1)*height;if(i)c.lineTo(px,py);else c.moveTo(px,py);});
    if(contact.closed)c.closePath();
    c.filter=plant?'blur(1.5px)':'blur(3px)';c.fillStyle='#332c2380';c.strokeStyle=plant?'#24351f45':'#332c2370';c.lineWidth=plant?3:7;if(contact.closed)c.fill();c.stroke();
    c.filter='none';c.fillStyle='#29261fd0';c.strokeStyle=plant?'#24351f60':'#29261fb0';c.lineWidth=plant?1:2.5;if(contact.closed)c.fill();c.stroke();
  }
  c.restore();
}
