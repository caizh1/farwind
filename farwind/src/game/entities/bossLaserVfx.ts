import type Phaser from 'phaser';
import type {BossHazard} from '../systems/campBossState';
import type {Point} from '../systems/obstacles';
import {laserConfig,laserRadii,laserPoint,laserRays,laserSample} from '../systems/bossLaser';

const KEY='boss-laser-vfx-v2';
const BURST_KEY='boss-laser-burst-v3';
const LIMIT=64;
const BURST_COUNT=36;
const BURST_LIFE=330;
const FRAME_TIMES=[0,12,24,36,48,60,78,105,140,185,235,285];
// 三行原图的实测地面根；换帧时锁住同一落点，避免生成素材的行间留白造成跳动。
const BURST_ROOT=[324/362,329/362,296/362];
const unit=(n:number)=>Math.max(0,Math.min(1,n));
// 坐标保留原始透明素材，不裁改像素。光束与地裂沿地面旋转，升起的爆裂始终朝上。
const FRAMES={beam:[0,50,904,420],flare:[924,0,612,540],scar:[910,660,626,340]} as const;

export class BossLaserVfx{
  private pool:Phaser.GameObjects.Image[]=[];
  private cursor=0;
  private bursts:{site:number;point:Point;age:number;frame:number;phase:string}[]=[];
  constructor(private scene:Phaser.Scene){}
  static preload(scene:Phaser.Scene){scene.load.image(KEY,'/assets/boss-laser/laser-vfx-v2.png');scene.load.image(BURST_KEY,'/assets/boss-laser/laser-burst-v3.png');}
  begin(){for(const image of this.pool)image.setVisible(false);this.cursor=0;this.bursts=[];}
  snapshot(){return {ready:!!this.scene.textures?.exists(KEY)&&!!this.scene.textures?.exists(BURST_KEY),objects:this.pool.length,visible:this.cursor,limit:LIMIT,bursts:this.bursts};}
  private stamp(frame:string,p:Point,w:number,h:number,alpha:number,depth:number,angle=0,origin:Point={x:.5,y:.5},flip=false){
    const key=frame.startsWith('burst-')?BURST_KEY:KEY;
    if(alpha<=0||this.cursor>=LIMIT||!this.scene.textures?.exists(key))return;
    const texture=this.scene.textures.get(key);
    if(!texture.has(frame)){
      if(key===BURST_KEY){const n=Number(frame.slice(6)),col=n%4,row=Math.floor(n/4),source=texture.source[0],x=Math.floor(col*source.width/4),y=Math.floor(row*source.height/3);texture.add(frame,0,x,y,Math.floor((col+1)*source.width/4)-x,Math.floor((row+1)*source.height/3)-y);}
      else{const [x,y,width,height]=FRAMES[frame as keyof typeof FRAMES];texture.add(frame,0,x,y,width,height);}
    }
    const settings=(this.scene as Phaser.Scene&{state?:{runes?:{settings?:{lowFlash?:boolean}}}}).state?.runes?.settings;
    if(settings?.lowFlash&&frame==='flare')alpha*=.45;
    const image=this.pool[this.cursor]??(this.pool[this.cursor]=this.scene.add.image(0,0,key,frame));this.cursor++;
    image.setTexture(key,frame).setPosition(p.x,p.y).setDisplaySize(w,h).setOrigin(origin.x,origin.y).setRotation(angle).setFlipX(flip).setAlpha(alpha).setDepth(depth).setVisible(true);
  }
  core(p:Point,elapsed:number,charge:number,fade:number,depth:number){
    const pulse=1+Math.sin(elapsed/65)*.08,size=(30+charge*30)*pulse;
    this.stamp('flare',p,size,size,fade,depth,elapsed/650);
  }
  ground(h:BossHazard,now:number,ink:Phaser.GameObjects.Graphics){
    if(laserSample(h,now).stage==='rays'){this.groundRing(h,now,ink);return;}
    for(const radius of laserRadii(h))this.groundRing({...h,radius},now,ink);
  }
  private groundRing(h:BossHazard,now:number,ink:Phaser.GameObjects.Graphics){
    const {stage,progress,start,angle,echo}=laserSample(h,now),config=laserConfig(h),t=now-h.activeAt,depth=ink.depth,fade=stage==='recover'?unit((h.expires-now)/500):1;
    if(stage==='rays'){
      const alpha=unit(t/45)*unit((config.rays-t)/90);
      for(const [i,g] of laserRays(h,now).entries()){
        const length=Math.hypot(g.b.x-g.a.x,g.b.y-g.a.y);if(length<1)continue;
        const a=Math.atan2(g.b.y-g.a.y,g.b.x-g.a.x),pulse=1+Math.sin(t/31+i)*.1;
        this.stamp('beam',g.a,length*904/790,112*pulse*config.rayWidth/8,alpha,depth,a,{x:69/904,y:235/420});
        this.stamp('flare',g.b,52*pulse,46*pulse,alpha,depth,a+t/600);
        // 亮点沿射线流动，采样相对战斗时钟，暂停、读档不重新随机。
        for(let n=0;n<2;n++){const u=((t/310+i*.17+n*.5)%1+1)%1;this.stamp('flare',{x:g.a.x+(g.b.x-g.a.x)*u,y:g.a.y+(g.b.y-g.a.y)*u},19,13,alpha*.8,depth,a);}
      }
      return;
    }
    if(stage==='charge'||stage==='pause')return;
    const trace=stage==='etch'?progress:1,segments=h.laser?.version===2?12:28;
    if(trace>0){
      const count=Math.max(1,Math.ceil(trace*112)),edge=(sign:number)=>Array.from({length:count+1},(_,i)=>laserPoint(h,start+Math.min(i/112,trace)*Math.PI*2,h.radius+sign*(7+Math.sin(i*2.7)*2.5)));
      const points=[...edge(1),...edge(-1).reverse()];ink.fillStyle(0x25161d,fade*.72).beginPath().moveTo(points[0].x,points[0].y);for(const p of points.slice(1))ink.lineTo(p.x,p.y);ink.closePath().fillPath();
    }
    for(let i=0;i<segments;i++){
      const u=(i+.5)/segments;if(u>trace)continue;
      const a=start+u*Math.PI*2,p=laserPoint(h,a);
      this.stamp('scar',p,78+Math.sin(i*2.7)*7,64,fade*.95,depth,a+Math.PI/2);
    }
    if(stage==='delay'){
      for(let i=0,n=h.laser?.version===2?6:14;i<n;i++){const a=start+i*Math.PI*2/n,p=laserPoint(h,a),pulse=.2+.3*(.5+.5*Math.sin(t/90+i));this.stamp('flare',p,19,13,pulse,depth,a);}
    }
    if(stage==='echo'||stage==='recover')this.echo(h,t-echo,ink);
    if(stage==='etch'){
      const tip=laserPoint(h,angle),tangent=angle+Math.PI/2;
      this.stamp('flare',tip,51,44,1,depth,tangent);
      const tail=laserPoint(h,Math.max(start,angle-.23));this.stamp('beam',tail,66,54,.9,depth,tangent,{x:69/904,y:235/420});
      for(let i=0,n=(this.scene as Phaser.Scene&{state?:{runes?:{settings?:{simple?:boolean}}}}).state?.runes?.settings?.simple?0:7;i<n;i++){
        const u=((t/240+i*.173)%1+1)%1,a=angle-i*.014-u*.12,p=laserPoint(h,a),side=Math.sin(i*2.4)*(7+u*12),x=p.x+Math.cos(a)*side,y=p.y+Math.sin(a)*side,lift=Math.sin(u*Math.PI)*13;
        this.stamp('flare',{x,y:y-lift},6,8,(1-u)*.85,depth,0);
      }
    }
  }
  private echo(h:BossHazard,elapsed:number,ink:Phaser.GameObjects.Graphics){
    // 落点固定在原灼痕上。每个落点有独立年龄与逐帧形变，绝不跟随圆周光头平移。
    const config=laserConfig(h),count=h.laser?.version===2?24:BURST_COUNT;
    for(let site=0;site<count;site++){
      const age=elapsed-site*config.echo/count;if(age<0||age>=440)continue;
      const angle=h.laser!.angle+site*Math.PI*2/count,p=laserPoint(h,angle),dt=age/1000;
      if(age<BURST_LIFE){
        let frame=0;for(let i=1;i<FRAME_TIMES.length;i++)if(age>=FRAME_TIMES[i])frame=i;
        const width=91+Math.sin(site*2.7)*7,height=142+Math.cos(site*3.2)*9;
        this.stamp('burst-'+frame,p,width,height,unit((BURST_LIFE-age)/100),ink.depth,0,{x:.5,y:BURST_ROOT[Math.floor(frame/4)]});
        this.bursts.push({site,point:{...p},age,frame,phase:age<36?'起爆':age<140?'升腾':'消散'});
      }
      const flash=unit(1-age/85);
      if(flash>0){this.stamp('flare',p,60,25,flash,ink.depth);ink.lineStyle(1.5,0xff7960,flash*.6).strokeEllipse(p.x,p.y,12+age*.8,5+age*.25);}
      // 飞石有独立横向速度、重力与自转；火星也有各自轨迹，而非附着在火焰贴图上。
      for(let i=0,n=(this.scene as Phaser.Scene&{state?:{runes?:{settings?:{simple?:boolean}}}}).state?.runes?.settings?.simple?0:7;i<n;i++){
        const seed=site*2.39+i*1.73,vx=Math.sin(seed)*(i<4?65:125),vy=Math.cos(seed)*35,ground={x:p.x+vx*dt,y:p.y+vy*dt},lift=Math.max(0,(330+i%3*55)*dt-950*dt*dt),fade=unit((440-age)/100);
        if(i<4){
          const x=ground.x,y=ground.y-lift,size=2.5+i%2,rotation=seed+dt*(i%2?-9:8),points=Array.from({length:4},(_,j)=>({x:x+Math.cos(rotation+j*Math.PI/2)*size*(j%2?.65:1),y:y+Math.sin(rotation+j*Math.PI/2)*size*(j%2?.65:1)}));
          ink.fillStyle(0x201016,fade*.2).fillEllipse(ground.x,ground.y,size*2,2).fillStyle(0x38242b,fade).beginPath().moveTo(points[0].x,points[0].y);for(const q of points.slice(1))ink.lineTo(q.x,q.y);ink.closePath().fillPath().lineStyle(.9,0xe45333,fade*unit(1-age/200)).lineBetween(points[0].x,points[0].y,points[1].x,points[1].y);
        }else{
          const x=ground.x,y=ground.y-lift;ink.lineStyle(1.3,i%2?0xffc9a0:0xff4c35,fade*unit(1-age/390)).lineBetween(x,y,x-vx*.025,y-4);
        }
      }
    }
  }
}
