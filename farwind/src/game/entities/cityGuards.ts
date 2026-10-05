import {CITY_FORTRESS,fortressFrontY} from '../../data/cityFortress';
import Phaser from 'phaser';
import {groundShadows} from '../rendering/groundShadows';
import type {CityDefense} from '../systems/cityDefense';
import type {CityState} from '../systems/tradeRoadState';
import {CITY_GUARD_POSTS,cityGuardId,cityWallElevation} from '../../data/maps/windwhisper';
import {cityWallScreenX} from '../rendering/cityWalls';
import {NpcMotion} from '../systems/npcAnimation';
import {Actor} from './actor';
export class CityGuards {
  views=new Map<string,{sprite:Phaser.GameObjects.Sprite;label:Phaser.GameObjects.Text;motion:NpcMotion}>();
  arrows:Phaser.GameObjects.Graphics;bars:Phaser.GameObjects.Graphics;
  wallFronts:Phaser.GameObjects.Image[]=[];
  constructor(private scene:Phaser.Scene){
    this.arrows=scene.add.graphics().setDepth(8996);this.bars=scene.add.graphics().setDepth(8997);}
  snapshot(){return {弓卫:[...this.views].filter(([id])=>id.includes('archer-')).map(([id,v])=>({身份:id,x:v.sprite.x,脚底:v.sprite.y,层级:v.sprite.depth,可见:v.sprite.visible,帧:v.sprite.frame.name})),前墙:this.wallFronts.map(v=>({x:v.x,y:v.y,宽:v.displayWidth,高:v.displayHeight,层级:v.depth,可见:v.visible,纹理:v.texture.key}))};}
  update(state:CityState,defense:CityDefense,now:number,visible:boolean){
    const ids=new Set(state.guards.map(g=>cityGuardId(g.slot,g.serial)));for(const [id,v]of this.views)if(!ids.has(id)){v.sprite.destroy();v.label.destroy();this.views.delete(id);}
    this.bars.clear();this.arrows.clear();for(const front of this.wallFronts)front.setVisible(visible);
    for(const g of state.guards){const p=CITY_GUARD_POSTS.find(p=>p.slot===g.slot)!,id=cityGuardId(g.slot,g.serial),onWall=p.role==='archer'&&['post','intercept'].includes(g.mode);let v=this.views.get(id);
      if(!v){v={sprite:this.scene.add.sprite(g.x,g.y,'defender-guard',0).setOrigin(.5,1),label:this.scene.add.text(0,0,'',{fontSize:'12px',color:'#fff0c4',stroke:'#293c40',strokeThickness:3}).setOrigin(.5),motion:new NpcMotion()};this.views.set(id,v);groundShadows(this.scene).add(v.sprite,undefined,{label:p.role==='archer'?'城墙弓卫':'重甲近卫',width:34,height:11,person:true,surfaceDepth:()=>v!.sprite.getData('城墙表面')?v!.sprite.depth-.5:this.scene.data.get('shadowSettings')?.().floor??v!.sprite.depth-.54});}
      v.motion.sample({...g,space:onWall?'wall':'ground'},now,g.hp>0);const m=v.motion,walking=m.speed>1,row=m.direction===1?1:m.direction>=2?2:0;
      const action=['post','intercept'].includes(g.mode)&&g.cooldown>(p.role==='archer'?1150:720),key=action?'city-complete-guard-actions-v2':`city-complete-${p.role==='archer'?'archer':'guard'}-walk`,frame=action?(p.role==='archer'?4:0)+Math.min(3,Math.floor(((p.role==='archer'?1440:900)-g.cooldown)/75)):row*4+(walking?Math.floor(m.distance/26)%4:0);
      const hiddenByWall=p.role!=='archer'&&g.x>CITY_FORTRESS.x&&g.x<CITY_FORTRESS.x+CITY_FORTRESS.width&&g.y>fortressFrontY(g.x-CITY_FORTRESS.x)-300&&g.y<fortressFrontY(g.x-CITY_FORTRESS.x);
      const elevation=p.role==='archer'?cityWallElevation(g):0,footY=g.y-elevation,screenX=g.x;
      v.sprite.setTexture(key,Math.max(0,frame)).setOrigin(.5,.94).setDisplaySize(100,100).setPosition(screenX,footY).setDepth(g.y+2).setVisible(visible).setAlpha(g.hp<=0?.4:1).setData('城墙表面',elevation>0);Actor.mirror(v.sprite,m.direction===2);
      v.label.setText(`${onWall?'城墙弓卫':'重甲近卫'}${g.mode==='down'?' · 后备军'+Math.ceil(g.replacement/1000)+'秒':g.mode==='replacement'?' · 接岗途中':g.mode==='recover'?(g.hp===p.maxHP?' · 换岗交接':' · 疗伤'):g.mode==='retreat'?(g.hp===p.maxHP?' · 退岗交接':' · 撤回疗伤'):''}`).setPosition(screenX,footY-100).setDepth(g.y+200).setVisible(visible&&!hiddenByWall&&Math.hypot(g.x-this.scene.cameras.main.midPoint.x,g.y-this.scene.cameras.main.midPoint.y)<650);
      if(visible&&!hiddenByWall&&g.hp>0){this.bars.fillStyle(0x263b40,.85).fillRect(screenX-24,footY-88,48,5);this.bars.fillStyle(0x8ab5bd).fillRect(screenX-24,footY-88,48*g.hp/p.maxHP,5);}
    }
    if(visible)for(const a of defense.arrows){const dx=a.vx/650,dy=a.vy/650,x=a.x;this.arrows.lineStyle(3,0x674732).lineBetween(x-dx*22,a.y-a.elevation-28-dy*22,x,a.y-a.elevation-28).fillStyle(0xe5e4c5).fillTriangle(x+dx*5,a.y-a.elevation-28+dy*5,x-dy*4,a.y-a.elevation-28+dx*4,x+dy*4,a.y-a.elevation-28-dx*4);}
  }
}
