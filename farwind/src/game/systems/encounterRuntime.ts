import {ENCOUNTERS,ENCOUNTER_LIMITS,encounterUnit,type EncounterDefinition} from "../../data/maps/windbell/encounters";
import {advanceEncounters,campCleared,resetEncounter,unitState,type EncounterState,type EncounterMemberState} from "./encounterState";
import {motionBlocked,clearMotionLine,type Point,type Rect} from "./obstacles";
import type {EnemyBody} from "./enemy";
import {CAMP_BOSSES,BOSS_RULES} from '../../data/maps/windbell/campBosses';
import type {SavedBossCombat} from './campBossState';
import {enemyLeashRadius} from '../../data/enemyPursuit';
type Member=EncounterDefinition["members"][number];
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
const inView=(p:Point,v:Rect,margin=140)=>p.x>=v.left-margin&&p.x<=v.right+margin&&p.y>=v.top-margin&&p.y<=v.bottom+margin;
export type EncounterPort={read:()=>EncounterState;bodies:()=>EnemyBody[];spawn:(d:Member,s:EncounterMemberState)=>void;release:(id:string)=>void;busy:(id:string)=>boolean;signal?:(d:EncounterDefinition)=>void;bossEnter?:(d:Member)=>void;occupied?:()=>readonly Point[];bossCapture?:(e:EnemyBody,now:number)=>SavedBossCombat;bossReset?:(id:string)=>void;};
// 本控制器只决定实例生灭；血量仍由 World 里唯一的 EnemyBody 和伤害系统结算。
export class WildernessEncounters{
  constructor(private port:EncounterPort){}
  restore(player:Point){
    const state=this.port.read(),existing=new Set(this.port.bodies().map(e=>e.id));let count=this.port.bodies().filter(e=>e.hp>0&&encounterUnit(e.id)).length;
    // 存档中的进行中首领优先恢复，防止邻近历史巡游占满预算后丢失战斗实例。
    for(const d of ENCOUNTERS){const g=state.groups[d.id];if(g.boss?.stage!=='battle')continue;const i=d.members.findIndex(m=>m.boss),m=d.members[i];if(!existing.has(m.id)&&!g.members[i].defeated&&count<ENCOUNTER_LIMITS.active){this.port.spawn(m,g.members[i]);existing.add(m.id);count++;}}
    for(const d of [...ENCOUNTERS].sort((a,b)=>distance(a,player)-distance(b,player))){const g=state.groups[d.id];if(!g.activated)continue;
      for(const [i,m] of d.members.entries())if((!m.boss||g.boss?.stage==='battle')&&!existing.has(m.id)&&!g.members[i].defeated&&(m.boss||distance(g.members[i],player)<ENCOUNTER_LIMITS.activateDistance||this.port.busy(m.id))&&count<ENCOUNTER_LIMITS.active){this.port.spawn(m,g.members[i]);count++;}
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
  resetBosses(){for(const d of ENCOUNTERS){const g=this.port.read().groups[d.id];if(g.boss?.stage==='battle'||g.boss?.stage==='warning')this.resetBoss(d);}}
  private resetBoss(d:EncounterDefinition){
    const g=this.port.read().groups[d.id],b=g.boss!,i=d.members.findIndex(m=>m.boss),m=d.members[i],u=g.members[i];
    this.port.bossReset?.(m.id);this.port.release(m.id);
    Object.assign(u,{hp:CAMP_BOSSES[m.boss!].hp,x:m.x,y:m.y,cooldown:0,guardOpen:0,participated:false,face:{x:0,y:1}});
    Object.assign(b,{stage:'warning',warning:BOSS_RULES.entry,away:0,attempt:b.attempt+1,combat:null});
  }
  private updateBoss(d:EncounterDefinition,delta:number,player:Point){
    const g=this.port.read().groups[d.id],b=g.boss;if(!b||['guards','legacy','defeated'].includes(b.stage))return;
    // 预警和入场仍要求靠近据点，正式战斗使用与移动、技能相同的大范围。
    const near=distance(d,player)<=(b.stage==='battle'?enemyLeashRadius({boss:true,leashRadius:d.radius}):d.radius+BOSS_RULES.retreatMargin);
    b.away=near?0:Math.min(BOSS_RULES.retreat,b.away+Math.max(0,delta));
    if(!near){if(b.away>=BOSS_RULES.retreat&&(b.stage==='battle'||b.warning<BOSS_RULES.entry))this.resetBoss(d);return;}
    if(b.stage==='battle'){
      const i=d.members.findIndex(m=>m.boss),m=d.members[i];
      if(!this.port.bodies().some(e=>e.id===m.id)&&this.port.bodies().filter(e=>encounterUnit(e.id)&&e.hp>0).length<ENCOUNTER_LIMITS.active)this.port.spawn(m,g.members[i]);
      return;
    }
    if(b.warning===BOSS_RULES.entry)this.port.signal?.(d);
    b.warning=Math.max(0,b.warning-delta);if(b.warning>0)return;
    const i=d.members.findIndex(m=>m.boss),m=d.members[i];
    if(this.port.bodies().some(e=>e.id===m.id))return;
    if(this.port.bodies().filter(e=>encounterUnit(e.id)&&e.hp>0).length>=ENCOUNTER_LIMITS.active)return;
    const candidates=[{x:d.x,y:d.y},...Array.from({length:24},(_,n)=>({x:d.x+Math.cos(n*Math.PI/12)*120,y:d.y+Math.sin(n*Math.PI/12)*120})),...Array.from({length:24},(_,n)=>({x:d.x+Math.cos(n*Math.PI/12)*220,y:d.y+Math.sin(n*Math.PI/12)*220}))];
    const occupied=this.port.occupied?.()??[];
    const p=candidates.find(p=>distance(p,player)>=110&&!motionBlocked(p.x,p.y)&&clearMotionLine(p,d)&&!this.port.bodies().some(e=>e.hp>0&&distance(e,p)<60)&&!occupied.some(e=>distance(e,p)<60));if(!p)return;
    Object.assign(g.members[i],p);b.stage='battle';b.warning=0;b.away=0;b.combat=null;g.activated=true;this.port.spawn(m,g.members[i]);this.port.bossEnter?.(m);
  }
  update(delta:number,now:number,player:Point,view:Rect){
    const state=this.port.read();advanceEncounters(state,delta);this.capture(now);
    // 仅休眠远处已结束交战的单位；伤势和当前批次留在固定记录内，不因出屏重置。
    for(const e of this.port.bodies()){
      const u=unitState(state,e.id);if(!u)continue;
      if(!e.boss&&distance(e,player)>ENCOUNTER_LIMITS.respawnDistance+200&&!e.attack&&!e.nav.returning&&e.nav.mode!=="chase"&&!this.port.busy(e.id))this.port.release(e.id);
    }
    for(const d of [...ENCOUNTERS].sort((a,b)=>distance(a,player)-distance(b,player))){
      const g=state.groups[d.id];
      this.updateBoss(d,delta,player);
      if(g.cleared){
        if(d.kind==="patrol"&&distance(d,player)>ENCOUNTER_LIMITS.respawnDistance&&d.members.every(m=>!inView(m,view)&&!this.port.busy(m.id))){
          // 每个新批次替换原有槽位，旧尸体显示对象在重生前释放。
          if(g.cooldown===0&&!g.members.some(m=>m.drop)&&!campCleared(state,d.source)){
            for(const m of d.members)this.port.release(m.id);resetEncounter(state,d.id);
          }
        }
        continue;
      }
      if(!g.activated&&d.kind==="patrol"&&campCleared(state,d.source))continue;
      if(distance(d,player)>ENCOUNTER_LIMITS.activateDistance)continue;
      if(!g.activated&&d.after){
        if(!state.groups[d.after].cleared)continue;
        if(g.warning===null){g.warning=2500;this.port.signal?.(d);continue;}
        if(g.warning>0)continue;
      }
      const existing=new Set(this.port.bodies().map(e=>e.id));
      const missing=d.members.filter((m,i)=>!m.boss&&!g.members[i].defeated&&!existing.has(m.id));
      if(!missing.length)continue;
      if(!g.activated&&missing.some(m=>(!d.after&&inView(m,view))||distance(m,player)<(d.after?150:350)||motionBlocked(m.x,m.y)))continue;
      let live=this.port.bodies().filter(e=>encounterUnit(e.id)&&e.hp>0).length;
      if(live+missing.length>ENCOUNTER_LIMITS.active){
        // 给近处新场地让出显示预算。休眠前已经捕获伤势，不卸载交战、返家或在途事件。
        const candidates=this.port.bodies().filter(e=>encounterUnit(e.id)&&!e.boss&&e.hp>0&&!e.attack&&!e.nav.returning&&e.nav.mode!=="chase"&&!this.port.busy(e.id)&&!inView(e,view)&&distance(e,player)>Math.max(650,distance(d,player)+250)).sort((a,b)=>distance(b,player)-distance(a,player));
        for(const e of candidates){if(live+missing.length<=ENCOUNTER_LIMITS.active)break;this.port.release(e.id);live--;}
        if(live+missing.length>ENCOUNTER_LIMITS.active)continue;
      }
      // 初始点通过地形与其他敌人占地校验；不能重叠出生。
      if(missing.some(m=>this.port.bodies().some(e=>e.hp>0&&distance(g.members[d.members.indexOf(m)],e)<45)))continue;
      for(const m of missing)this.port.spawn(m,g.members[d.members.indexOf(m)]);
      g.activated=true;g.warning=null;
    }
  }
}
