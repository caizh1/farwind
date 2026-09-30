import type Phaser from 'phaser';
import {CAMP_BOSSES,BOSS_PROJECTILES,BOSS_RULES,type CampBossKind} from '../../data/maps/windbell/campBosses';
import {sampleEnemyAttack,sporeDirections,sporeOrigin,type EnemyAttack,type AttackGeometry} from '../systems/enemyAttack';
import {bossHazardGeometry} from '../systems/campBossCombat';
import type {BossHazard,BossBattle} from '../systems/campBossState';
import type {Point} from '../systems/obstacles';
import {sampleBossParry,type BossParryPose} from '../systems/bossParry';

type Body=Point&{hp?:number;boss?:CampBossKind;bossBattle?:BossBattle;wallHit?:{at:number;until:number;direction?:Point};parried?:{at:number;until:number;direction:Point;perfect:boolean}};
type Effect={id:string;boss:CampBossKind;kind:string;phase:'蓄力'|'出手'|'消散';point:Point;radius:number;elapsed:number;direction?:Point;inner?:number;skill?:number};
const PALETTE={
  'spore-heart':{edge:0xf0a94f,core:0xfff1bc,ink:0x574037},
  'thorn-crown':{edge:0xe8b46d,core:0xfff3d2,ink:0x49352e},
  'crag-tusk':{edge:0xeab076,core:0xffecd0,ink:0x493629},
  'bound-branch':{edge:0x8fdbc1,core:0xe7ffe1,ink:0x294e42},
} as const;
const unit=(n:number)=>Math.max(0,Math.min(1,n));

// 分镜的两层特效直接采样战斗时钟，不建立粒子计时器或另一套持久化状态。
export class CampBossEffects{
  readonly groundInk:Phaser.GameObjects.Graphics;
  readonly strikeInk:Phaser.GameObjects.Graphics;
  private records:Effect[]=[];
  constructor(scene:Phaser.Scene){this.groundInk=scene.add.graphics().setDepth(8992);this.strikeInk=scene.add.graphics().setDepth(8993);}
  begin(){this.groundInk.clear();this.strikeInk.clear();this.records=[];}
  snapshot(){return {objects:2,effects:this.records};}
  private record(boss:CampBossKind,id:string,kind:string,phase:Effect['phase'],point:Point,radius:number,elapsed:number,extra:Partial<Effect>={}){this.records.push({boss,id,kind,phase,point:{x:point.x,y:point.y},radius,elapsed,...extra});}
  private path(ink:Phaser.GameObjects.Graphics,points:Point[],close=false){ink.beginPath().moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i++)ink.lineTo(points[i].x,points[i].y);if(close)ink.closePath();}
  private glint(p:Point,r:number,color:number,alpha:number){const ink=this.strikeInk;ink.lineStyle(3,0x46382e,alpha*.6).lineBetween(p.x-r,p.y,p.x+r,p.y).lineBetween(p.x,p.y-r,p.x,p.y+r);ink.lineStyle(1.5,color,alpha).lineBetween(p.x-r,p.y,p.x+r,p.y).lineBetween(p.x,p.y-r,p.x,p.y+r);}
  private shard(p:Point,size:number,angle:number,color:number,alpha:number){
    const points=[0,1,2,3].map(i=>{const a=angle+i*Math.PI/2,r=size*(i%2?.58:1);return {x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r};});
    const ink=this.groundInk;ink.fillStyle(color,alpha).lineStyle(1.4,0x46372c,alpha*.8);this.path(ink,points,true);ink.fillPath().strokePath();ink.lineStyle(1,0xf0d9ae,alpha*.7).lineBetween(points[0].x,points[0].y,p.x,p.y);
  }
  private debris(p:Point,r:number,elapsed:number,kind:CampBossKind,alpha=1){
    const ink=this.groundInk,palette=PALETTE[kind],u=unit(elapsed/620),fade=(1-u)*alpha;if(fade<=0)return;
    // 先裂土，碎片沿抛物线起落；淡尘圈只装饰，实线危险边界由原几何层绘制。
    ink.lineStyle(9,palette.ink,fade*.14).strokeEllipse(p.x,p.y,r*(1+u)*2,r*(1+u)*.95);
    for(let i=0;i<9;i++){
      const a=i*Math.PI*2/9+.13,dx=Math.cos(a),dy=Math.sin(a),reach=r*(.6+(i%3)*.15),bend=a+(i%2?.22:-.24);
      ink.lineStyle(3,palette.ink,fade*.85).beginPath().moveTo(p.x+dx*7,p.y+dy*7).lineTo(p.x+Math.cos(bend)*reach*.58,p.y+Math.sin(bend)*reach*.58).lineTo(p.x+dx*reach,p.y+dy*reach).strokePath();
      ink.lineStyle(1,palette.edge,fade*.55).lineBetween(p.x+dx*8,p.y+dy*8,p.x+Math.cos(bend)*reach*.58,p.y+Math.sin(bend)*reach*.58);
      const distance=r*.5+u*(20+i%3*10),lift=Math.sin(u*Math.PI)*(17+i%3*8),x=p.x+dx*distance,y=p.y+dy*distance;
      ink.fillStyle(palette.ink,fade*.16).fillEllipse(x,y,10,4);
      this.shard({x,y:y-lift},4+i%3,a+u*2,kind==='spore-heart'?0x9a7760:kind==='bound-branch'?0xa4b77b:0xbda081,fade);
    }
  }
  private sweep(g:AttackGeometry,elapsed:number,duration:number,kind:CampBossKind,part:number,strong:boolean,tail=false){
    const ink=this.strikeInk,palette=PALETTE[kind],u=unit(elapsed/duration),fade=elapsed<duration?.98:unit(1-(elapsed-duration)/220),angle=Math.atan2(g.direction!.y,g.direction!.x),half=g.halfAngle!,reverse=part%2?-1:1;
    const head=.18+.82*unit(u*2.6),localEnd=-half+half*2*head,end=angle+reverse*localEnd,start=angle+reverse*Math.max(-half,localEnd-half*(.65+head*.65)),count=tail?1:kind==='thorn-crown'?3:kind==='spore-heart'?2:1;
    for(let claw=0;claw<count;claw++){
      const r=g.radius*(.94-claw*.18),points:Point[]=[];
      for(let i=0;i<=18;i++){const t=i/18,a=start+(end-start)*t,rough=Math.sin(i*1.7+claw)*1.2;points.push({x:g.a.x+Math.cos(a)*(r+rough),y:g.a.y+Math.sin(a)*(r+rough)});}
      ink.lineStyle(strong?23:19,palette.edge,fade*.11);this.path(ink,points);ink.strokePath();
      // 双端收尖的手绘刃痕，避免等宽粗线像一组悬空管道。
      const side=(sign:number)=>points.map((p,i)=>{const width=(strong?6:4.5)*Math.sin(i/18*Math.PI)**.7+.2,dx=(p.x-g.a.x)/r,dy=(p.y-g.a.y)/r;return {x:p.x+dx*width*sign,y:p.y+dy*width*sign};});
      ink.fillStyle(palette.edge,fade*.92).lineStyle(1.7,palette.ink,fade*.75);this.path(ink,[...side(1),...side(-1).reverse()],true);ink.fillPath().strokePath();
      ink.lineStyle(2,palette.core,fade*.95);this.path(ink,points);ink.strokePath();
      if(tail)for(let i=3;i<16;i+=3){const p=points[i],dx=(p.x-g.a.x)/r,dy=(p.y-g.a.y)/r;ink.fillStyle(palette.ink,fade*.85).fillTriangle(p.x-dy*4,p.y+dx*4,p.x+dy*4,p.y-dx*4,p.x+dx*9,p.y+dy*9).lineStyle(1,palette.edge,fade).lineBetween(p.x,p.y,p.x+dx*9,p.y+dy*9);}
      const tip=points.at(-1)!;this.glint(tip,5,palette.core,fade*.9);
    }
    // 散开的末端碎光不形成第二道危险弧，也不扩大判定。
    for(let i=0;i<5;i++){const a=angle-half+half*2*i/4,r=g.radius+u*18,x=g.a.x+Math.cos(a)*r,y=g.a.y+Math.sin(a)*r;ink.lineStyle(1.6,palette.edge,fade*.65).lineBetween(x,y,x+Math.cos(a)*8,y+Math.sin(a)*8);}
  }
  private parryDebris(body:Body,p:BossParryPose){
    const kind=body.boss!,palette=PALETTE[kind],power=p.quality==='perfect'?1.4:1,t=p.elapsed,u=unit(t/280),fade=1-u;
    if(fade>0)for(let i=0;i<5;i++){
      const side=(i-2)*9,travel=8+u*(16+i%2*6),lift=Math.sin(u*Math.PI)*(12+i%3*6),point={x:body.x+p.x-p.direction.x*travel-p.direction.y*side,y:body.y+p.y-CAMP_BOSSES[kind].height*.45-p.direction.y*travel*.4+p.direction.x*side*.35-lift};
      if(kind==='spore-heart')this.strikeInk.fillStyle(palette.core,fade*.7).fillCircle(point.x,point.y,(1.5+i%2)*power);
      else if(kind==='bound-branch')this.strikeInk.fillStyle(palette.edge,fade*.8).fillTriangle(point.x-3,point.y,point.x+4,point.y-5*power,point.x+2,point.y+3);
      else this.shard(point,(2+i%2)*power,i+u*2,kind==='crag-tusk'?0xb9a37e:0x9e9674,fade*.8);
    }
    const dust=unit(p.braceElapsed/260),alpha=(1-dust)*.2;
    if(p.phase!=='impact'&&p.phase!=='recoil'&&alpha>0)for(const side of [-1,1])this.groundInk.fillStyle(palette.ink,alpha).fillEllipse(body.x+side*(13+dust*12),body.y-1,18+dust*20,5+dust*5);
    if(fade>0||alpha>0)this.record(kind,'弹反:'+body.parried!.at,p.debris,'消散',body,24*power,t,{direction:{...p.direction}});
  }
  draw(body:Body,a:EnemyAttack|null|undefined,now:number,parry:BossParryPose|null=sampleBossParry(body,now)){
    const kind=body.boss,b=body.bossBattle;if(!kind||(body.hp??0)<=0||b&&(now<b.entryUntil||now<b.transformUntil))return;
    const palette=PALETTE[kind],ink=this.strikeInk;
    if(kind==='crag-tusk'&&body.wallHit&&now<body.wallHit.at+620){const t=now-body.wallHit.at,d=body.wallHit.direction??{x:0,y:1},p={x:body.x+d.x*30,y:body.y+d.y*30};this.debris(p,48,t,kind);this.record(kind,'撞墙:'+body.wallHit.at,'撞墙碎石','消散',p,48,t);}
    if(kind==='bound-branch'&&b&&now<b.exposedUntil){
      const p={x:body.x,y:body.y-CAMP_BOSSES[kind].height*.46},alpha=.65+Math.sin(now/100)*.15;this.glint(p,14,palette.core,alpha);ink.lineStyle(2,palette.edge,.55).strokeCircle(p.x,p.y,20);
      this.record(kind,'风核:'+b.exposedUntil,'风核暴露','出手',p,20,Math.max(0,now-(b.exposedUntil-BOSS_RULES.exposed)));
      // 破茧已有可靠受击时钟；弹反也只显示短碎光，不复用伤害爆炸。
      if(!parry&&body.parried&&now-body.parried.at<620)this.debris({x:body.x,y:body.y-25},30,now-body.parried.at,kind,.8);
    }
    if(parry){this.parryDebris(body,parry);return;}
    if(!a||a.cancelled||now<a.startedAt||now>=a.recoveryUntil)return;
    const pose=sampleEnemyAttack(a,now,body),t=now-a.contactAt,skill=a.bossSkill??0,d=a.direction,strong=b?.phase===2;
    if(t<0){
      const u=unit((now-a.startedAt)/(a.contactAt-a.startedAt)),p={x:body.x+d.x*24,y:body.y-CAMP_BOSSES[kind].height*.35+d.y*12};
      this.glint(p,5+u*7,a.bossShotAngles?BOSS_PROJECTILES[kind as keyof typeof BOSS_PROJECTILES].core:palette.core,.25+u*.6);
      if(!a.bossArea)this.record(kind,a.attackId,'武器蓄光','蓄力',p,5+u*7,now-a.startedAt,{skill,direction:{...d}});
      return;
    }
    if(a.bossCocoon){
      const p={x:body.x,y:body.y-CAMP_BOSSES[kind].height*.38},u=unit(t/240),alpha=now<a.activeUntil?.9:unit((a.recoveryUntil-now)/220);
      for(let i=0;i<3;i++){const points:Point[]=[];for(let n=0;n<=12;n++){const angle=-Math.PI*.85+n/12*Math.PI*1.7,r=27+i*5;points.push({x:p.x+Math.sin(angle)*r*u,y:p.y+Math.cos(angle)*(36+i*4)*u});}ink.lineStyle(5,palette.ink,alpha*.7);this.path(ink,points);ink.strokePath();ink.lineStyle(2,palette.edge,alpha);this.path(ink,points);ink.strokePath();}
      this.glint(p,7,palette.core,.6);this.record(kind,a.attackId,'护心枝壳',pose.phase==='recovery'?'消散':'出手',p,40,t,{skill});return;
    }
    if(a.bossArea)return;
    if(a.bossShotAngles){
      if(t>=300)return;const style=BOSS_PROJECTILES[kind as keyof typeof BOSS_PROJECTILES],alpha=1-t/300;
      for(const direction of sporeDirections(a)){const p=sporeOrigin(body,direction,true),start={x:p.x,y:p.y-28},end={x:start.x+direction.x*(16+t*.07),y:start.y+direction.y*(16+t*.07)};
        ink.lineStyle(10,style.outline,alpha*.65).lineBetween(start.x,start.y,end.x,end.y).lineStyle(6,style.color,alpha).lineBetween(start.x,start.y,end.x,end.y).lineStyle(2,style.core,alpha).lineBetween(start.x,start.y,end.x,end.y);this.glint(end,5,style.core,alpha);
      }
      this.record(kind,a.attackId,'齐射喷闪','出手',body,40,t,{skill,direction:{...d}});return;
    }
    if((a.step??0)>30){
      const duration=a.activeUntil-a.contactAt,u=unit(t/duration),alpha=now<a.activeUntil?1:unit((a.recoveryUntil-now)/220),length=Math.min(110,a.motionAt),g=pose.geometry;
      for(const side of [-1,1]){const x=body.x-d.y*g.radius*.7*side,y=body.y+d.x*g.radius*.7*side;ink.lineStyle(9,palette.ink,alpha*.35).lineBetween(x-d.x*length,y-d.y*length,x,y).lineStyle(4,palette.edge,alpha*.75).lineBetween(x-d.x*length,y-d.y*length,x,y).lineStyle(1.6,palette.core,alpha).lineBetween(x-d.x*length,y-d.y*length,x,y);}
      for(let i=0;i<7;i++){const behind=length*(i+1)/8,side=(i%2?1:-1)*(g.radius*.6+i*2);this.groundInk.fillStyle(0xc4b590,alpha*.22).fillEllipse(body.x-d.x*behind-d.y*side,body.y-d.y*behind+d.x*side,14+i*2,8+i);}
      this.sweep(g,t,duration,kind,0,!!strong);
      if(u>.8)this.debris(body,kind==='crag-tusk'?38:28,Math.max(0,t-duration),kind,.7);
      this.record(kind,a.attackId,'突进爪刃与尘尾',pose.phase==='recovery'?'消散':'出手',g.a,g.radius,t,{skill,direction:{...g.direction!}});
    }else{
      this.sweep(pose.geometry,t,a.activeUntil-a.contactAt,kind,a.bossPart??0,!!strong,kind==='thorn-crown'&&skill===2);
      this.record(kind,a.attackId,kind==='thorn-crown'&&skill===2?'背后荆尾扫弧':kind==='thorn-crown'?'三道爪痕':kind==='bound-branch'?'镰枝斩弧':kind==='crag-tusk'?'獠牙半月':'菌冠扫弧',pose.phase==='recovery'?'消散':'出手',pose.geometry.a,pose.geometry.radius,t,{skill,direction:{...pose.geometry.direction!}});
    }
  }
  ground(h:BossHazard,now:number){
    const kind=h.owner.slice(5) as CampBossKind;if(!PALETTE[kind]||now<h.born||now>=h.expires)return;
    const palette=PALETTE[kind],ink=this.groundInk,t=now-h.activeAt,g=bossHazardGeometry(h,now);
    if(t<0){
      if(h.kind==='circle'){const u=unit((now-h.born)/(h.activeAt-h.born));ink.lineStyle(2,palette.ink,.2+u*.25);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ink.lineBetween(h.point.x+Math.cos(a)*8,h.point.y+Math.sin(a)*8,h.point.x+Math.cos(a)*h.radius*.6*u,h.point.y+Math.sin(a)*h.radius*.6*u);}}
      this.record(kind,h.id,'地面异动','蓄力',h.point,h.radius,now-h.born,{inner:g.inner});return;
    }
    const fade=unit((h.expires-now)/260);
    if(h.kind==='ring'){
      const middle=(g.radius+g.inner!)/2;ink.lineStyle(g.radius-g.inner!,palette.edge,fade*.18).strokeCircle(h.point.x,h.point.y,middle).lineStyle(6,palette.ink,fade*.65).strokeCircle(h.point.x,h.point.y,g.radius).lineStyle(3.5,palette.edge,fade).strokeCircle(h.point.x,h.point.y,g.radius).lineStyle(1.4,palette.core,fade).strokeCircle(h.point.x,h.point.y,g.radius);
      for(let i=0;i<16;i++){const a=i*Math.PI/8,r=g.radius+8+(i%3)*5,p={x:h.point.x+Math.cos(a)*r,y:h.point.y+Math.sin(a)*r-6-Math.sin(t/120+i)*4};this.shard(p,3+i%3,a+t/500,kind==='spore-heart'?0xaf86a5:0xbda081,fade*.7);}
      this.debris(h.point,30,t,kind,.8);this.record(kind,h.id,'扩散冲击与碎屑','出手',h.point,g.radius,t,{inner:g.inner});return;
    }
    this.debris(h.point,h.radius,t*620/Math.min(620,h.expires-h.activeAt),kind,fade);
    if(kind==='spore-heart'||kind==='bound-branch'){
      const rise=unit(t/140),sink=unit((h.expires-now)/200);
      for(let i=0;i<5;i++){const a=i*Math.PI*2/5,x=h.point.x+Math.cos(a)*h.radius*.55,y=h.point.y+Math.sin(a)*h.radius*.48,height=(28+i%3*8)*rise*sink;
        const points=[{x:x-5,y},{x:x-9,y:y-height*.35},{x:x+3,y:y-height},{x:x+2,y:y-height*.32},{x:x+7,y}];ink.fillStyle(kind==='spore-heart'?0x967154:0x667b49,fade*.75).lineStyle(2,palette.ink,fade*.9);this.path(ink,points,true);ink.fillPath().strokePath();ink.lineStyle(1.5,0xd9c89b,fade*.65).lineBetween(x,y,x+3,y-height);
      }
    }
    this.record(kind,h.id,kind==='crag-tusk'?'震踏裂土与飞石':'破土根枝',fade<1?'消散':'出手',h.point,h.radius,t);
  }
}
