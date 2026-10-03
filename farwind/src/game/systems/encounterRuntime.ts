import {adventureSpawn} from './adventureSpawns';
import {ENCOUNTERS,ENCOUNTER_LIMITS,encounterUnit,type EncounterDefinition,adventureIndex,ADVENTURE_ROUTES} from "../../data/maps/windbell/encounters";
import {advanceEncounters,campCleared,resetEncounter,unitState,encounterDefinitions,activateAdventure,advanceAdventureWave,type EncounterState,type EncounterMemberState} from "./encounterState";
import {motionBlocked,clearMotionLine,type Point,type Rect} from "./obstacles";
import type {EnemyBody} from "./enemy";
import {CAMP_BOSSES,BOSS_RULES} from '../../data/maps/windbell/campBosses';
import type {SavedBossCombat} from './campBossState';
import {enemyLeashRadius} from '../../data/enemyPursuit';
type Member=EncounterDefinition["members"][number];
export const SPAWN_CUE={lead:900,fade:260} as const;
export type SpawnCue=Point&{id:string;startedAt:number;readyAt:number;spawned:boolean};
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
const inView=(p:Point,v:Rect,margin=140)=>p.x>=v.left-margin&&p.x<=v.right+margin&&p.y>=v.top-margin&&p.y<=v.bottom+margin;
export type EncounterPort={reserved?:()=>number;bossReady?:(kind:NonNullable<Member['boss']>)=>boolean;checkpoint?:()=>Promise<void>;enabled?:(d:EncounterDefinition)=>boolean;read:()=>EncounterState;bodies:()=>EnemyBody[];spawn:(d:Member,s:EncounterMemberState)=>void;release:(id:string)=>void;busy:(id:string)=>boolean;signal?:(d:EncounterDefinition)=>void;bossEnter?:(d:Member)=>void;occupied?:()=>readonly Point[];bossCapture?:(e:EnemyBody,now:number)=>SavedBossCombat;bossReset?:(id:string)=>void;};
// 本控制器只决定实例生灭；血量仍由 World 里唯一的 EnemyBody 和伤害系统结算。
export class WildernessEncounters{
  arrivals=new Map<string,SpawnCue>();
  get pendingCount(){return [...this.arrivals.values()].filter(c=>!c.spawned).length;}
  private live(){return this.port.bodies().filter(e=>e.hp>0&&!e.disabled).length+this.pendingCount+(this.port.reserved?.()??0);}
  private existing(){return new Set([...this.port.bodies().map(e=>e.id),...this.arrivals.keys()]);}
  private queue(m:Member,u:EncounterMemberState,now:number){this.arrivals.set(m.id,{id:m.id,x:u.x,y:u.y,startedAt:now,readyAt:now+SPAWN_CUE.lead,spawned:false});}
  private advanceArrivals(now:number,player:Point){
    const state=this.port.read();
    for(const [id,cue] of this.arrivals){
      const unit=encounterUnit(id),d=unit&&ENCOUNTERS.find(d=>d.id===unit.group),u=unitState(state,id);
      if(!d||!u||u.defeated||this.port.enabled&&!this.port.enabled(d)||distance(d,player)>ENCOUNTER_LIMITS.activateDistance){this.arrivals.delete(id);continue;}
      if(cue.spawned){if(now>=cue.readyAt+SPAWN_CUE.fade)this.arrivals.delete(id);continue;}
      if(now<cue.readyAt)continue;
      // 预告阶段没有战斗身体；落地仍复核总名额，夜袭或召唤不能挤出超额波次。
      if(this.live()>ENCOUNTER_LIMITS.active)continue;
      const m=encounterDefinitions(state,d).find(m=>m.id===id);if(!m){this.arrivals.delete(id);continue;}
      if(!this.port.bodies().some(e=>e.id===id)){u.participated=true;this.port.spawn(m,u);}
      cue.spawned=true;cue.readyAt=now;
    }
  }
  saving=false;
  checkpointFailed=false;
  constructor(private port:EncounterPort){}
  confirmed(){this.checkpointFailed=false;}
  private checkpoint(){if(!this.port.checkpoint)return;this.saving=true;void this.port.checkpoint().then(()=>{this.checkpointFailed=false;},()=>{this.checkpointFailed=true;}).finally(()=>{this.saving=false;});}
  private definitions(){const s=this.port.read();return ENCOUNTERS.map(d=>({...d,members:encounterDefinitions(s,d)}));}
  restore(player:Point,now=0){
    const state=this.port.read(),existing=this.existing();let count=this.live();
    // 存档中的进行中首领优先恢复，防止邻近历史巡游占满预算后丢失战斗实例。
    for(const d of this.definitions()){const g=state.groups[d.id];if(g.boss?.stage!=='battle')continue;const i=d.members.findIndex(m=>m.boss),m=d.members[i];if((!this.port.bossReady||this.port.bossReady(m.boss!))&&!existing.has(m.id)&&!g.members[i].defeated&&count<ENCOUNTER_LIMITS.active){this.port.spawn(m,g.members[i]);existing.add(m.id);count++;}}
    for(const d of this.definitions().sort((a,b)=>distance(a,player)-distance(b,player))){const g=state.groups[d.id];if(!g.activated)continue;
      for(const [i,m] of d.members.entries())if((!m.boss||g.boss?.stage==='battle'&&(!this.port.bossReady||this.port.bossReady(m.boss)))&&(g.wave===undefined||m.boss||'wave' in m&&m.wave===g.wave&&(g.waveWarning??0)===0)&&!existing.has(m.id)&&!g.members[i].defeated&&(m.boss||distance(g.members[i],player)<ENCOUNTER_LIMITS.activateDistance||this.port.busy(m.id))&&count<ENCOUNTER_LIMITS.active){if(!m.boss&&!g.members[i].participated)this.queue(m,g.members[i],now);else this.port.spawn(m,g.members[i]);count++;}
    }
  }
  capture(now:number){
    const state=this.port.read();
    for(const e of this.port.bodies()){
      const u=unitState(state,e.id);if(!u||u.defeated||e.hp<=0)continue;
      u.hp=e.hp;u.x=e.x;u.y=e.y;u.serial=e.attackSerial??0;u.face={...e.face??e.attack?.direction??u.face};u.guardOpen=Math.max(0,Math.min(1200,(e.guardOpenUntil??0)-now));
      if(e.boss&&this.port.bossCapture){const d=encounterUnit(e.id)!;state.groups[d.group].boss!.combat=this.port.bossCapture(e,now);}
      u.cooldown=Math.max(0,Math.min(10000,Math.max(e.cool,e.attack?.recoveryUntil??0,e.staggerUntil)-now));
    }
  }
  resetBosses(){for(const d of this.definitions()){const g=this.port.read().groups[d.id];if(g.boss?.stage==='battle'||g.boss?.stage==='warning')this.resetBoss(d);}}
  private resetBoss(d:EncounterDefinition){
    const g=this.port.read().groups[d.id],b=g.boss!,i=d.members.findIndex(m=>m.boss),m=d.members[i],u=g.members[i];
    this.port.bossReset?.(m.id);this.port.release(m.id);
    Object.assign(u,{hp:CAMP_BOSSES[m.boss!].hp,x:m.x,y:m.y,cooldown:0,guardOpen:0,participated:false,face:{x:0,y:1}});
    Object.assign(b,{stage:'warning',warning:BOSS_RULES.entry,away:0,attempt:b.attempt+1,combat:null});
  }
  private updateBoss(d:EncounterDefinition,delta:number,player:Point){
    const g=this.port.read().groups[d.id],b=g.boss;if(!b||['guards','legacy','defeated'].includes(b.stage))return;
    // 预警和入场仍要求靠近据点，正式战斗使用与移动、技能相同的大范围。
    const near=distance(d,player)<=(b.stage==='battle'?d.radius+BOSS_RULES.retreatMargin:d.radius+BOSS_RULES.retreatMargin);
    b.away=near?0:Math.min(BOSS_RULES.retreat,b.away+Math.max(0,delta));
    if(!near){if(b.away>=BOSS_RULES.retreat&&(b.stage==='battle'||b.warning<BOSS_RULES.entry))this.resetBoss(d);return;}
    if(b.stage==='battle'){
      const i=d.members.findIndex(m=>m.boss),m=d.members[i];
      if((!this.port.bossReady||this.port.bossReady(m.boss!))&&!this.port.bodies().some(e=>e.id===m.id)&&this.live()<ENCOUNTER_LIMITS.active)this.port.spawn(m,g.members[i]);
      return;
    }
    if(b.warning===BOSS_RULES.entry)this.port.signal?.(d);
    b.warning=Math.max(0,b.warning-delta);if(b.warning>0)return;
    const i=d.members.findIndex(m=>m.boss),m=d.members[i];
    if(this.port.bossReady&&!this.port.bossReady(m.boss!))return;
    if(this.port.bodies().some(e=>e.boss&&e.hp>0&&e.id!==m.id))return;
    if(this.port.bodies().some(e=>e.id===m.id))return;
    if(this.live()>=ENCOUNTER_LIMITS.active)return;
    const candidates=[{x:d.x,y:d.y},...Array.from({length:24},(_,n)=>({x:d.x+Math.cos(n*Math.PI/12)*120,y:d.y+Math.sin(n*Math.PI/12)*120})),...Array.from({length:24},(_,n)=>({x:d.x+Math.cos(n*Math.PI/12)*220,y:d.y+Math.sin(n*Math.PI/12)*220}))];
    const occupied=this.port.occupied?.()??[];
    const p=candidates.find(p=>distance(p,player)>=220&&!motionBlocked(p.x,p.y)&&clearMotionLine(p,d)&&!this.port.bodies().some(e=>e.hp>0&&distance(e,p)<60)&&!occupied.some(e=>distance(e,p)<60));if(!p)return;
    Object.assign(g.members[i],p);b.stage='battle';b.warning=0;b.away=0;b.combat=null;g.activated=true;this.port.spawn(m,g.members[i]);this.port.bossEnter?.(m);
  }
  update(delta:number,now:number,player:Point,view:Rect){
    const state=this.port.read();if(this.saving||this.checkpointFailed)return;advanceEncounters(state,delta);this.capture(now);this.advanceArrivals(now,player);
    // 仅休眠远处已结束交战的单位；伤势和当前批次留在固定记录内，不因出屏重置。
    for(const e of this.port.bodies()){
      const u=unitState(state,e.id);if(!u)continue;
      if(!e.boss&&distance(e,player)>ENCOUNTER_LIMITS.respawnDistance+200&&!e.attack&&!e.nav.returning&&e.nav.mode!=="chase"&&!this.port.busy(e.id))this.port.release(e.id);
    }
    for(const d of this.definitions().sort((a,b)=>distance(a,player)-distance(b,player))){
      const g=state.groups[d.id];
      if(this.port.enabled&&!this.port.enabled(d))continue;
      if(adventureIndex(d.id)>=0&&state.seed!==undefined){
        if(!g.activated){if(distance(d,player)<650&&activateAdventure(state,d.id)){this.port.signal?.(d);this.checkpoint();return;}continue;}
        const before=g.wave;advanceAdventureWave(state,d,delta);if(before!==g.wave){this.port.signal?.(d);this.checkpoint();return;}
      }
      this.updateBoss(d,delta,player);
      if(g.cleared){
        if(state.seed===undefined&&d.kind==="patrol"&&distance(d,player)>ENCOUNTER_LIMITS.respawnDistance&&d.members.every(m=>!inView(m,view)&&!this.port.busy(m.id))){
          // 每个新批次替换原有槽位，旧尸体显示对象在重生前释放。
          if(g.cooldown===0&&!g.members.some(m=>m.drop)&&!campCleared(state,d.source)){
            for(const m of d.members)this.port.release(m.id);resetEncounter(state,d.id);
          }
        }
        continue;
      }
      if(!g.activated&&d.kind==="patrol"&&campCleared(state,d.source))continue;
      if(distance(d,player)>ENCOUNTER_LIMITS.activateDistance)continue;
      if(!g.activated&&(d.after||d.id.startsWith('legacy-'))){
        if(d.after&&!state.groups[d.after].cleared)continue;
        if(g.warning===null){g.warning=2500;this.port.signal?.(d);continue;}
        if(g.warning>0)continue;
      }
      const existing=this.existing();
      const missing=d.members.filter((m,i)=>!m.boss&&!g.members[i].defeated&&!existing.has(m.id)&&(g.wave===undefined||'wave' in m&&m.wave===g.wave));
      if(g.wave!==undefined&&(g.waveWarning??0)>0)continue;
      if(!missing.length)continue;
      if(!g.activated&&missing.some(m=>(!d.after&&!d.id.startsWith('legacy-')&&inView(m,view))||distance(m,player)<(d.id.startsWith('legacy-')?75:d.after?150:350)||motionBlocked(m.x,m.y)))continue;
      let live=this.live();
      if(live+missing.length>ENCOUNTER_LIMITS.active){
        // 给近处新场地让出显示预算。休眠前已经捕获伤势，不卸载交战、返家或在途事件。
        const candidates=this.port.bodies().filter(e=>encounterUnit(e.id)&&!e.boss&&e.hp>0&&!e.attack&&!e.nav.returning&&e.nav.mode!=="chase"&&!this.port.busy(e.id)&&!inView(e,view)&&distance(e,player)>Math.max(650,distance(d,player)+250)).sort((a,b)=>distance(b,player)-distance(a,player));
        for(const e of candidates){if(live+missing.length<=ENCOUNTER_LIMITS.active)break;this.port.release(e.id);live--;}
        if(live+missing.length>ENCOUNTER_LIMITS.active)continue;
      }
      if(g.wave!==undefined){
        const occupied=[...this.port.bodies().filter(e=>e.hp>0),...[...this.arrivals.values()].filter(c=>!c.spawned),...this.port.occupied?.()??[]];
        const selected:{u:EncounterMemberState;p:Point}[]=[];
        for(const m of missing){const u=unitState(state,m.id)!;
          if(u.participated){selected.push({u,p:{x:u.x,y:u.y}});continue;}
          const p=adventureSpawn(d,player,[...occupied,...selected.map(e=>e.p)],d.members.indexOf(m),view);
          if(!p){selected.length=0;break;}selected.push({u,p});
        }
        if(selected.length!==missing.length)continue;for(const {u,p} of selected)Object.assign(u,p);
      }
      // 初始点通过地形与其他敌人占地校验；不能重叠出生。
      if(missing.some(m=>this.port.bodies().some(e=>e.hp>0&&distance(g.members[d.members.indexOf(m)],e)<45)))continue;
      for(const m of missing)this.queue(m,unitState(state,m.id)!,now);
      g.activated=true;g.warning=null;
    }
  }
}
