import Phaser from 'phaser';
import {groundShadows} from '../rendering/groundShadows';
import type {CityDefense} from '../systems/cityDefense';
import type {CityState} from '../systems/tradeRoadState';
import {CITY_GUARD_POSTS,cityGuardId} from '../../data/maps/windwhisper';
import {NpcMotion} from '../systems/npcAnimation';
import {Actor} from './actor';
export class CityGuards {
  views=new Map<string,{sprite:Phaser.GameObjects.Sprite;label:Phaser.GameObjects.Text;motion:NpcMotion}>();
  arrows:Phaser.GameObjects.Graphics;bars:Phaser.GameObjects.Graphics;
  constructor(private scene:Phaser.Scene){this.arrows=scene.add.graphics().setDepth(8996);this.bars=scene.add.graphics().setDepth(8997);}
  update(state:CityState,defense:CityDefense,now:number,visible:boolean){
    const ids=new Set(state.guards.map(g=>cityGuardId(g.slot,g.serial)));for(const [id,v]of this.views)if(!ids.has(id)){v.sprite.destroy();v.label.destroy();this.views.delete(id);}
    this.bars.clear();this.arrows.clear();
    for(const g of state.guards){const p=CITY_GUARD_POSTS.find(p=>p.slot===g.slot)!,id=cityGuardId(g.slot,g.serial),onWall=p.role==='archer'&&['post','intercept'].includes(g.mode);let v=this.views.get(id);
      if(!v){v={sprite:this.scene.add.sprite(g.x,g.y,'defender-guard',0).setOrigin(.5,1),label:this.scene.add.text(0,0,'',{fontSize:'12px',color:'#fff0c4',stroke:'#293c40',strokeThickness:3}).setOrigin(.5),motion:new NpcMotion()};this.views.set(id,v);groundShadows(this.scene).add(v.sprite,undefined,{label:p.role==='archer'?'城墙弓卫':'重甲近卫',width:34,height:11,projection:p.role!=='archer'});}
      v.motion.sample({...g,space:onWall?'wall':'ground'},now,g.hp>0);const m=v.motion,walking=m.speed>1,row=m.direction===1?1:m.direction>=2?2:0;
      const action=g.cooldown>(onWall?1150:720),key=action?'city-complete-guard-actions-v2':`city-complete-${p.role==='archer'?'archer':'guard'}-walk`,frame=action?(onWall?4:0)+Math.min(3,Math.floor(((onWall?1440:900)-g.cooldown)/75)):row*4+(walking?Math.floor(m.distance/26)%4:0);
      const elevation=p.role==='archer'?Math.max(0,Math.min(80,(9900-g.x)/2)):0;
      v.sprite.setTexture(key,Math.max(0,frame)).setOrigin(.5,.94).setDisplaySize(100,100).setPosition(g.x,g.y-elevation).setDepth(g.y+elevation+2).setVisible(visible).setAlpha(g.hp<=0?.4:1);Actor.mirror(v.sprite,m.direction===2);
      v.label.setText(`${onWall?'城墙弓卫':'重甲近卫'}${g.mode==='down'?' · 后备军'+Math.ceil(g.replacement/1000)+'秒':g.mode==='replacement'?' · 接岗途中':g.mode==='recover'?(g.hp===p.maxHP?' · 换岗交接':' · 疗伤'):g.mode==='retreat'?(g.hp===p.maxHP?' · 退岗交接':' · 撤回疗伤'):''}`).setPosition(g.x,g.y-(onWall?195:112)).setDepth(g.y+200).setVisible(visible&&Math.hypot(g.x-this.scene.cameras.main.midPoint.x,g.y-this.scene.cameras.main.midPoint.y)<650);
      if(visible&&g.hp>0){this.bars.fillStyle(0x263b40,.85).fillRect(g.x-24,g.y-(onWall?180:100),48,5);this.bars.fillStyle(0x8ab5bd).fillRect(g.x-24,g.y-(onWall?180:100),48*g.hp/p.maxHP,5);}
    }
    if(visible)for(const a of defense.arrows){const dx=a.vx/650,dy=a.vy/650;this.arrows.lineStyle(3,0x674732).lineBetween(a.x-dx*22,a.y-28-dy*22,a.x,a.y-28).fillStyle(0xe5e4c5).fillTriangle(a.x+dx*5,a.y-28+dy*5,a.x-dy*4,a.y-28+dx*4,a.x+dy*4,a.y-28-dx*4);}
  }
}
