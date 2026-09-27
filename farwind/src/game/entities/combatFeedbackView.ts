import Phaser from 'phaser';
import {CombatFeedback,FEEDBACK,BLADE_GLOW,feedbackVisual} from '../systems/combatFeedback';
import type {Actor} from './actor';
export class CombatFeedbackView {
 private ink=new Map<string,Phaser.GameObjects.Graphics>();
 private bladeInk?:Phaser.GameObjects.Graphics;
 private bladeEdgeInk?:Phaser.GameObjects.Graphics;
 private glow:ReturnType<CombatFeedback['bladeGlow']>=null;
 private flashes:{id:string;alpha:number;core:number;edge:number}[]=[];
 constructor(private scene:Phaser.Scene,private feedback:CombatFeedback){}
 draw(now:number,hero?:Actor) {
  this.glow=hero?this.feedback.bladeGlow(now,{x:hero.sprite.x,y:hero.sprite.y},hero.weapon,hero.presentation.facing):null;
  this.bladeInk?.clear();
  this.bladeEdgeInk?.clear();
  if(this.glow){
   this.bladeInk??=this.scene.add.graphics();
   this.bladeEdgeInk??=this.scene.add.graphics();
   const {start,tip,alpha,depth,edgeDepth,quality}=this.glow,g=this.bladeInk,edge=this.bladeEdgeInk,perfect=quality==='perfect';
   g.setDepth(depth);
   // 薄红亮边贴着剑身，暖白内芯保留钢刃；不覆盖整个人物或产生悬空光弧。
   g.lineStyle(BLADE_GLOW.width,0xff443b,alpha*.28).lineBetween(start.x,start.y,tip.x,tip.y);
   // 背向柔光仍在身体后层；细亮边覆盖图集中已可见的钢刃，避免被同一张角色贴图完全吞没。
   edge.setDepth(edgeDepth).lineStyle(BLADE_GLOW.edgeWidth,0xf04438,alpha*.9).lineBetween(start.x,start.y,tip.x,tip.y);
   edge.lineStyle(perfect?1.1:.8,0xffead1,alpha*(perfect?.85:.65)).lineBetween(start.x,start.y,tip.x,tip.y);
  }
  this.flashes=[];
  const visible=feedbackVisual(this.feedback.mode)?this.feedback.effects:[];
  for(const [id,g] of this.ink)if(!visible.some(e=>e.id===id)){g.destroy();this.ink.delete(id);}
  for(const e of visible){let g=this.ink.get(e.id);if(!g){g=this.scene.add.graphics();this.ink.set(e.id,g);}g.clear().setDepth(e.depth??e.point.y+35);
   const age=Math.max(0,now-e.at),life=e.kind==='counter-hit'?FEEDBACK.hitLife:e.kind==='afterguard'?FEEDBACK.afterguardLife:FEEDBACK.contactLife,u=age/life,alpha=Math.max(0,1-u),p=e.point,b=e.blade,d=e.deflect;
   if(e.kind==='counter-hit') {
    const length=13+u*7;g.lineStyle(3,0xffedc2,alpha).lineBetween(p.x-b.x*length,p.y-b.y*length,p.x+b.x*length,p.y+b.y*length);
    g.lineStyle(1,0xffffff,alpha).lineBetween(p.x-b.x*length,p.y-b.y*length,p.x+b.x*length,p.y+b.y*length);
    g.fillStyle(e.material==='slime'?0x99d8bc:0xd1c889,alpha*.8);
    for(let i=0;i<3;i++){const side=i-1;g.fillCircle(p.x+d.x*(6+u*12)-d.y*side*(3+u*5),p.y+d.y*(6+u*12)+d.x*side*(3+u*5),1.8*(1-u));}
    continue;
   }
   const perfect=e.quality==='perfect',small=e.kind==='afterguard';
   // 初始形状已完整：接触核心、剑刃短亮边、偏向拨开一侧的碎光；模拟停顿不吞首帧。
   const core=(small?2.5:perfect?6.5:5.5)*(1-u*.6),edge=small?5:perfect?18:14;
   this.flashes.push({id:e.id,alpha,core,edge});
   if(!small)g.fillStyle(0xffc98d,alpha*.18).fillCircle(p.x,p.y,core+3);
   g.fillStyle(0xfff7dc,alpha).fillCircle(p.x,p.y,core);
   g.lineStyle(small?1.2:4,0xfff1cf,alpha*.6).lineBetween(p.x-b.x*edge,p.y-b.y*edge,p.x+b.x*edge,p.y+b.y*edge);
   g.lineStyle(small?1.2:2,0xffffff,alpha).lineBetween(p.x-b.x*edge,p.y-b.y*edge,p.x+b.x*edge,p.y+b.y*edge);
   const angle=Math.atan2(d.y,d.x),length=small?8:perfect?26:20;
   for(const [i,offset] of [-.45,-.1,.22,.52].entries()) {
    const a=angle+offset,r=length*(i===1?1:.75)+u*10,dx=Math.cos(a),dy=Math.sin(a);
    g.lineStyle(i===1?2.2:1.3,i===1?0xfff5d1:0xe8d5a6,alpha*(1-i*.12)).lineBetween(p.x+dx*4,p.y+dy*4,p.x+dx*r,p.y+dy*r);
    if(!small&&u<.75)g.fillStyle(0xffedc2,alpha).fillCircle(p.x+dx*(r+3),p.y+dy*(r+3),1.1);
   }
   if(perfect&&!small){g.lineStyle(1,0xffffff,alpha*.85).lineBetween(p.x-b.x*edge-d.x*3,p.y-b.y*edge-d.y*3,p.x+b.x*edge-d.x*3,p.y+b.y*edge-d.y*3);}
  }
 }
 snapshot(){return {bladeGlow:this.glow,flashes:this.flashes};}
 clear(){for(const g of this.ink.values())g.destroy();this.ink.clear();this.bladeInk?.destroy();this.bladeInk=undefined;this.bladeEdgeInk?.destroy();this.bladeEdgeInk=undefined;this.glow=null;this.flashes=[];}
}
