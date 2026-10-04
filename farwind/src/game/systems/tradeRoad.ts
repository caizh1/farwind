import type {World} from '../scenes/World';
import {TRADE_ROAD_NODES} from '../../data/maps/windwhisper';
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
  reset(){this.capture();this.releaseAll();renewTradeRoad(this.w.state,randomSeed());}
  releaseAll(){for(const e of [...this.w.enemies])if(e.id.startsWith('road:'))this.release(e.id);this.cues.clear();this.w.enemyProjectiles.shots=this.w.enemyProjectiles.shots.filter(s=>!s.attack.attackerId.startsWith('road:'));}
  private release(id:string){const e=this.w.enemies.find(e=>e.id===id);if(!e)return;e.sprite.destroy();e.shadow.destroy();this.w.enemyBlades.get(id)?.destroy();this.w.enemyBlades.delete(id);this.w.enemies=this.w.enemies.filter(e=>e.id!==id);}
  capture(){for(const e of this.w.enemies){const u=roadUnit(this.w.state.tradeRoad,e.id);if(!u||u.defeated)continue;Object.assign(u,{hp:e.hp,x:e.x,y:e.y,serial:e.attackSerial??0,cooldown:Math.min(15000,Math.max(0,Math.max(e.cool,e.attack?.recoveryUntil??0,e.staggerUntil)-this.w.sim))});}}
  private legal(u:RoadUnit,node:number){
    const base=TRADE_ROAD_NODES[node];if(!motionBlocked(u.homeX,u.homeY)&&Math.abs(u.homeY-base.y)>=85)return true;
    const n=TRADE_ROAD_NODES[node],offset=Number(u.id.split(':').at(-1))*19+u.wave*11;
    for(let i=0;i<80;i++){const angle=(offset+i*2.399963),radius=240+i%5*30,p={x:n.x+Math.cos(angle)*radius,y:n.y+Math.sin(angle)*radius};
      if(p.x<4330||p.x>9620||p.y<720||p.y>2360||motionBlocked(p.x,p.y)||Math.abs(p.y-n.y)<85)continue;
      Object.assign(u,{x:p.x,y:p.y,homeX:p.x,homeY:p.y});return true;
    }return false;
  }
  update(delta:number){
    const w=this.w,p=w.state.player,now=w.sim;
    this.capture();
    // 远处敌人存入旅途后释放身体和弹体，返回时重新建立冷却，不补积压攻击。
    for(const e of [...w.enemies])if(e.id.startsWith('road:')&&(w.state.life.playerSpace!=='village'||distance(e,p)>1150)){this.release(e.id);w.enemyProjectiles.shots=w.enemyProjectiles.shots.filter(s=>s.attack.attackerId!==e.id);}
    if(w.state.life.playerSpace!=='village'){this.cues.clear();return;}
    if(p.x<4210){this.cues.clear();for(const [i,n]of w.state.tradeRoad.nodes.entries())if(n.active&&!n.cleared)for(const u of n.units)if(u.wave===n.wave&&u.spawned&&!u.defeated&&!w.enemies.some(e=>e.id===u.id)&&distance(u,p)<1150&&this.live()<12)this.spawn(u,i);return;}
    if(w.state.tradeRoad.seed===null)w.state.tradeRoad=createTradeRoad(1,randomSeed());
    if(p.x>9780&&!w.state.city.visited){w.state.city.visited=true;w.snapshotPending=true;w.ui.message('抵达风语城 · 西门集市、驿站与风塔广场已开放。');}
    for(const [i,n] of w.state.tradeRoad.nodes.entries()){
      const d=TRADE_ROAD_NODES[i],near=distance(d,p)<900;
      if(!n.active&&distance(d,p)<300){n.active=true;w.snapshotPending=true;w.ui.message(`${d.name} · 第一波动静，沿路可以绕行或撤退。`);}
      for(const u of n.units)if(u.drop&&near){u.dropRemaining=Math.max(0,u.dropRemaining-delta);if(u.dropRemaining===0)u.drop=false;}
      // 已出生的追击者按自身保存位置恢复；不能因最初节点离城门太远而在刷新后消失。
      if(n.active&&!n.cleared)for(const u of n.units)if(u.wave===n.wave&&u.spawned&&!u.defeated&&!w.enemies.some(e=>e.id===u.id)&&distance(u,p)<1150&&this.live()<12)this.spawn(u,i);
      if(!n.active||n.cleared||!near){for(const u of n.units)this.cues.delete(u.id);continue;}
      for(const u of n.units.filter(u=>u.wave===n.wave&&!u.defeated)){
        if(w.enemies.some(e=>e.id===u.id))continue;
        if(!this.legal(u,i))continue;
        if(u.spawned){if(this.live()>=12)continue;this.spawn(u,i);continue;}
        // 每个出生点都在道路肩部，中央至少120单位保持可撤退。
        if(Math.abs(u.homeY-d.y)<85){const adjusted={...u,y:d.y+(u.homeY<d.y?-260:260),homeY:d.y+(u.homeY<d.y?-260:260)};if(!motionBlocked(adjusted.x,adjusted.y))Object.assign(u,adjusted);else continue;}
        if(distance(u,p)<220){this.cues.delete(u.id);u.cue=800;continue;}
        let cue=this.cues.get(u.id),created=false;if(!cue){if(this.live()>=12)continue;cue={id:u.id,x:u.x,y:u.y,startedAt:now,readyAt:now+u.cue,spawned:false};this.cues.set(u.id,cue);created=true;}
        if(!created)u.cue=Math.max(0,u.cue-delta);cue.readyAt=now+u.cue;
        if(u.cue===0){this.cues.delete(u.id);this.spawn(u,i);}
      }
    }
  }
  private live(){return [...this.w.enemies,...this.w.defense.enemies].filter(e=>e.hp>0&&!e.disabled).length+(this.w.wilderness?.pendingCount??0)+this.pendingCount;}
  private spawn(u:RoadUnit,node:number){const w=this.w,e=w.makeEnemy({id:u.id,type:u.type,x:u.x,y:u.y});Object.assign(e,{hp:u.hp,maxHP:u.maxHP,attackSerial:u.serial,homeX:u.homeX,homeY:u.homeY,cool:w.sim+(u.spawned?Math.max(800,u.cooldown):u.cooldown),leashRadius:1100,damageScale:TRADE_ROAD_NODES[node].scale*(u.elite?1.25:1),eliteLevel:u.elite?1:0,nav:enemyNavigation()});u.spawned=true;u.cue=0;w.enemies.push(e);}
  defeat(e:World['enemies'][number],source:'player'|'companion'|'guard'){
    const s=this.w.state,u=roadDefeat(s.tradeRoad,e.id,source!=='guard');if(!u)return false;
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
