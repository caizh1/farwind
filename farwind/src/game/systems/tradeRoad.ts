import {ROAD_NEST} from '../../data/merchantRoad';
import {resetRoadNest} from './merchantRoadState';
import type {World} from '../scenes/World';
import {TRADE_ROAD_NODES,tradeRoadAnchor,tradeRoadSpawnPoint} from '../../data/maps/windwhisper';
import {renewTradeRoad,createTradeRoad,roadUnit,roadDefeat,type RoadUnit} from './tradeRoadState';
import {randomSeed,offerWindGift,giftValue} from './windGifts';
import {motionBlocked,clearMotionLine} from './obstacles';
import {enemyNavigation} from './enemy';
import {enemyProfile} from '../../data/enemies';
import {add} from './state';
import {creditCombatCoins} from './combatCoins';
import type {SpawnCue} from './encounterRuntime';
const distance=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
export class TradeRoad {
  cues=new Map<string,SpawnCue>();
  constructor(private w:World){}
  get pendingCount(){return this.cues.size;}
  reset(){this.capture();this.releaseAll();resetRoadNest(this.w.state);renewTradeRoad(this.w.state,randomSeed());}
  releaseAll(){for(const e of [...this.w.enemies])if((e.id.startsWith('road:')||e.id.startsWith('road-nest:')))this.release(e.id);this.cues.clear();this.w.enemyProjectiles.shots=this.w.enemyProjectiles.shots.filter(s=>!(s.attack.attackerId.startsWith('road:')||s.attack.attackerId.startsWith('road-nest:')));}
  private release(id:string){const e=this.w.enemies.find(e=>e.id===id);if(!e)return;e.sprite.destroy();e.shadow.destroy();this.w.enemyBlades.get(id)?.destroy();this.w.enemyBlades.delete(id);this.w.enemies=this.w.enemies.filter(e=>e.id!==id);}
  unit(id:string){return roadUnit(this.w.state.tradeRoad,id)??this.w.state.merchantRoad.nest.units.find(u=>u.id===id);}
  participate(id:string,damage:number){const u=this.unit(id);if(u&&damage>0)u.participated=true;}
  capture(){for(const e of this.w.enemies){const u=this.unit(e.id);if(!u||u.defeated)continue;Object.assign(u,{hp:e.hp,x:e.x,y:e.y,serial:e.attackSerial??0,cooldown:Math.min(15000,Math.max(0,Math.max(e.cool,e.attack?.recoveryUntil??0,e.staggerUntil)-this.w.sim))});}}
  private legal(u:RoadUnit,node:number){
    if(u.spawned)return true;
    const original=TRADE_ROAD_NODES[node],opened=this.w.state.merchantRoad.opened,base=tradeRoadAnchor(node,opened);
    const allowed=(p:{x:number;y:number})=>tradeRoadSpawnPoint(p)&&!motionBlocked(p.x,p.y)&&Math.abs(p.y-base.y)>=85&&(!opened||Math.abs(p.y-original.y)>=350);
    const home={x:u.homeX,y:u.homeY};if(allowed(home)){Object.assign(u,home);return true;}
    const n=base,offset=Number(u.id.split(':').at(-1))*19+u.wave*11;
    for(let i=0;i<80;i++){const angle=(offset+i*2.399963),radius=240+i%5*30,p={x:n.x+Math.cos(angle)*radius,y:n.y+Math.sin(angle)*radius};
      if(!allowed(p))continue;
      Object.assign(u,{x:p.x,y:p.y,homeX:p.x,homeY:p.y});return true;
    }return false;
  }
  update(delta:number){
    const w=this.w,p=w.state.player,now=w.sim;
    this.capture();
    // 远处敌人存入旅途后释放身体和弹体，返回时重新建立冷却，不补积压攻击。
    for(const e of [...w.enemies])if((e.id.startsWith('road:')||e.id.startsWith('road-nest:'))&&(w.state.life.playerSpace!=='village'||distance(e,p)>1150)){this.release(e.id);w.enemyProjectiles.shots=w.enemyProjectiles.shots.filter(s=>s.attack.attackerId!==e.id);}
    if(w.state.life.playerSpace!=='village'){this.cues.clear();return;}
    this.updateNest(delta);
    if(p.x<4210){this.cues.clear();for(const [i,n]of w.state.tradeRoad.nodes.entries())if(n.active&&!n.cleared)for(const u of n.units)if(u.wave===n.wave&&u.spawned&&!u.defeated&&!w.enemies.some(e=>e.id===u.id)&&distance(u,p)<1150&&this.live()<12)this.spawn(u,i);return;}
    if(w.state.tradeRoad.seed===null)w.state.tradeRoad=createTradeRoad(1,randomSeed());
    if(p.x>9780&&!w.state.city.visited){w.state.city.visited=true;w.snapshotPending=true;w.ui.message('抵达风语城 · 西门集市、驿站与风塔广场已开放。');}
    for(const [i,n] of w.state.tradeRoad.nodes.entries()){
      const d=tradeRoadAnchor(i,w.state.merchantRoad.opened),near=distance(d,p)<900;
      if(!n.active&&distance(d,p)<300){n.active=true;w.snapshotPending=true;w.ui.message(`${d.name} · 第一波动静，沿路可以绕行或撤退。`);}
      for(const u of n.units)if(u.drop&&near){u.dropRemaining=Math.max(0,u.dropRemaining-delta);if(u.dropRemaining===0)u.drop=false;}
      // 已出生的追击者按自身保存位置恢复；不能因最初节点离城门太远而在刷新后消失。
      if(n.active&&!n.cleared)for(const u of n.units)if(u.wave===n.wave&&u.spawned&&!u.defeated&&!w.enemies.some(e=>e.id===u.id)&&distance(u,p)<1150&&this.live()<12)this.spawn(u,i);
      if(!n.active||n.cleared||!near){for(const u of n.units)this.cues.delete(u.id);continue;}
      for(const u of n.units.filter(u=>u.wave===n.wave&&!u.defeated)){
        if(w.state.merchantRoad.opened&&!u.spawned&&distance(d,p)>=300){this.cues.delete(u.id);continue;}
        if(w.enemies.some(e=>e.id===u.id))continue;
        if(!this.legal(u,i))continue;
        if(u.spawned){if(this.live()>=12)continue;this.spawn(u,i);continue;}
        // 新出生点统一检查道路肩部与真实城墙外侧；已出生单位保留追击位置。
        if(distance(u,p)<220){this.cues.delete(u.id);u.cue=800;continue;}
        let cue=this.cues.get(u.id),created=false;if(!cue){if(this.live()>=12)continue;cue={id:u.id,x:u.x,y:u.y,startedAt:now,readyAt:now+u.cue,spawned:false};this.cues.set(u.id,cue);created=true;}
        if(!created)u.cue=Math.max(0,u.cue-delta);Object.assign(cue,{x:u.x,y:u.y,readyAt:now+u.cue});
        if(u.cue===0){this.cues.delete(u.id);this.spawn(u,i);}
      }
    }
  }

  private updateNest(delta:number){
    const w=this.w,n=w.state.merchantRoad.nest,p=w.state.player;
    for(const u of n.units)if(u.drop){u.dropRemaining=Math.max(0,u.dropRemaining-delta);if(!u.dropRemaining)u.drop=false;}
    if(n.wave===3)return;
    for(const u of n.units){if((!u.spawned&&distance(p,ROAD_NEST)>330)||(u.spawned&&distance(p,u)>1150)){this.cues.delete(u.id);continue;}if(u.wave!==n.wave||u.defeated||w.enemies.some(e=>e.id===u.id))continue;
      if(this.live()>=12&&!this.cues.has(u.id)||distance(p,u)<80)continue;
      if(motionBlocked(u.x,u.y)){for(let i=0;i<50;i++){const point={x:u.homeX+(i%7-3)*24,y:u.homeY+Math.floor(i/7)*24};if(!motionBlocked(point.x,point.y)){Object.assign(u,point);break;}}if(motionBlocked(u.x,u.y))continue;}
      let cue=this.cues.get(u.id);if(!cue){cue={id:u.id,x:u.x,y:u.y,startedAt:w.sim,readyAt:w.sim+u.cue,spawned:false};this.cues.set(u.id,cue);}else u.cue=Math.max(0,u.cue-delta);
      if(u.cue===0){this.cues.delete(u.id);const e=w.makeEnemy({id:u.id,type:u.type,x:u.x,y:u.y});Object.assign(e,{hp:u.hp,maxHP:u.maxHP,attackSerial:u.serial,homeX:u.homeX,homeY:u.homeY,cool:w.sim+Math.max(800,u.cooldown),combatTier:w.state.merchantRoad.nest.rulesVersion===2?(u.wave>=1?2:1):0,leashRadius:650,damageScale:u.elite?1.25:1.1,eliteLevel:u.elite?1:0,nav:enemyNavigation()});u.spawned=true;w.enemies.push(e);}
    }
  }
  private live(){return [...this.w.enemies,...this.w.defense.enemies].filter(e=>e.hp>0&&!e.disabled).length+(this.w.wilderness?.pendingCount??0)+this.pendingCount;}
  private spawn(u:RoadUnit,node:number){if(!u.spawned&&!this.legal(u,node))return;const w=this.w,e=w.makeEnemy({id:u.id,type:u.type,x:u.x,y:u.y});Object.assign(e,{hp:u.hp,maxHP:u.maxHP,attackSerial:u.serial,homeX:u.homeX,homeY:u.homeY,cool:w.sim+(u.spawned?Math.max(800,u.cooldown):u.cooldown),combatTier:w.state.tradeRoad.rulesVersion===2?(node>=1?2:1):0,leashRadius:1100,damageScale:TRADE_ROAD_NODES[node].scale*(u.elite?1.25:1),eliteLevel:u.elite?1:0,nav:enemyNavigation()});u.spawned=true;u.cue=0;w.enemies.push(e);}
  defeat(e:World['enemies'][number],source:'player'|'companion'|'guard'){
    const s=this.w.state;if(e.id.startsWith('road-nest:')){const n=s.merchantRoad.nest,u=n.units.find(u=>u.id===e.id);if(!u||u.defeated)return false;u.hp=0;u.defeated=true;u.participated||=source!=='guard';u.x=e.x;u.y=e.y;if(u.participated){const gold=creditCombatCoins(s,{elite:u.elite?1:0},true);if(gold)this.w.float(e.x,e.y,`金币 +${gold}`);if(!add(s,enemyProfile(u.type).drop,1)){u.drop=true;u.dropRemaining=60000;}}if(n.units.filter(u=>u.wave===n.wave).every(u=>u.defeated)){n.wave++;this.w.ui.message(n.wave===3?'裂牙巢穴已清剿。返回西门向岚铎将军报告。':`裂牙巢穴 · 第${n.wave+1}阶段`);}this.w.snapshotPending=true;this.w.syncDrops();return true;}
    const u=roadDefeat(s.tradeRoad,e.id,source!=='guard');if(!u)return false;
    const direct=u.participated;Object.assign(u,{x:e.x,y:e.y});
    if(direct){const gold=creditCombatCoins(s,{elite:u.elite?1:0},true);if(gold)this.w.float(e.x,e.y,`金币 +${gold}`);if(!add(s,enemyProfile(u.type).drop,1)){u.drop=true;u.dropRemaining=60000;}}
    const i=Number(u.id.split(':')[2]),n=s.tradeRoad.nodes[i];
    if(n.units.filter(m=>m.wave===n.wave).every(m=>m.defeated)){
      n.wave++;if(n.wave===3){n.cleared=true;n.rewarded=n.units.filter(m=>m.participated).length>=9;
        if(n.rewarded&&offerWindGift(s.windGifts,`商路:${s.tradeRoad.serial}:${i}`,s.tradeRoad.seed!,s.skills.swordWindStage>0)){
          this.w.runes?.gifts.encounterHeal(giftValue(s.windGifts,'spring'));
          this.w.ui.mode='reward-saving';this.w.ui.shell('商路节点胜利','<p>正在保存永久风赐候选……</p>');void this.w.persist(true).then(()=>this.w.ui.open('wind-gifts')).catch(()=>{this.w.ui.open('pause');this.w.ui.message('候选尚未保存，保留待领；请保存旅途。');});
        }else this.w.ui.message(`${TRADE_ROAD_NODES[i].name}已平静，守军清理不产生风赐。`);
      }else this.w.ui.message(`${TRADE_ROAD_NODES[i].name} · 第${n.wave+1}波正在接近。`);
    }
    this.w.snapshotPending=true;this.w.syncDrops();return true;
  }
}
