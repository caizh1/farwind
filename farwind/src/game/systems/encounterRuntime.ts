import {ENCOUNTERS,ENCOUNTER_LIMITS,encounterUnit,type EncounterDefinition} from "../../data/maps/windbell/encounters";
import {advanceEncounters,campCleared,resetEncounter,unitState,type EncounterState,type EncounterMemberState} from "./encounterState";
import {motionBlocked,type Point,type Rect} from "./obstacles";
import type {EnemyBody} from "./enemy";
type Member=EncounterDefinition["members"][number];
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
const inView=(p:Point,v:Rect,margin=140)=>p.x>=v.left-margin&&p.x<=v.right+margin&&p.y>=v.top-margin&&p.y<=v.bottom+margin;
export type EncounterPort={read:()=>EncounterState;bodies:()=>EnemyBody[];spawn:(d:Member,s:EncounterMemberState)=>void;release:(id:string)=>void;busy:(id:string)=>boolean;signal?:(d:EncounterDefinition)=>void;};
// 本控制器只决定实例生灭；血量仍由 World 里唯一的 EnemyBody 和伤害系统结算。
export class WildernessEncounters{
  constructor(private port:EncounterPort){}
  restore(player:Point){
    const state=this.port.read(),existing=new Set(this.port.bodies().map(e=>e.id));let count=this.port.bodies().filter(e=>e.hp>0&&encounterUnit(e.id)).length;
    for(const d of [...ENCOUNTERS].sort((a,b)=>distance(a,player)-distance(b,player))){const g=state.groups[d.id];if(!g.activated)continue;
      for(const [i,m] of d.members.entries())if(!existing.has(m.id)&&!g.members[i].defeated&&(distance(g.members[i],player)<ENCOUNTER_LIMITS.activateDistance||this.port.busy(m.id))&&count<ENCOUNTER_LIMITS.active){this.port.spawn(m,g.members[i]);count++;}
    }
  }
  capture(now:number){
    const state=this.port.read();
    for(const e of this.port.bodies()){
      const u=unitState(state,e.id);if(!u||u.defeated||e.hp<=0)continue;
      u.hp=e.hp;u.x=e.x;u.y=e.y;u.serial=e.attackSerial??0;u.face={...e.face??e.attack?.direction??u.face};u.guardOpen=Math.max(0,Math.min(1200,(e.guardOpenUntil??0)-now));
      u.cooldown=Math.max(0,Math.min(10000,Math.max(e.cool,e.attack?.recoveryUntil??0,e.staggerUntil)-now));
    }
  }
  update(delta:number,now:number,player:Point,view:Rect){
    const state=this.port.read();advanceEncounters(state,delta);this.capture(now);
    // 仅休眠远处已结束交战的单位；伤势和当前批次留在固定记录内，不因出屏重置。
    for(const e of this.port.bodies()){
      const u=unitState(state,e.id);if(!u)continue;
      if(distance(e,player)>ENCOUNTER_LIMITS.respawnDistance+200&&!e.attack&&!e.nav.returning&&e.nav.mode!=="chase"&&!this.port.busy(e.id))this.port.release(e.id);
    }
    for(const d of [...ENCOUNTERS].sort((a,b)=>distance(a,player)-distance(b,player))){
      const g=state.groups[d.id];
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
      const missing=d.members.filter((m,i)=>!g.members[i].defeated&&!existing.has(m.id));
      if(!missing.length)continue;
      if(!g.activated&&missing.some(m=>(!d.after&&inView(m,view))||distance(m,player)<(d.after?150:350)||motionBlocked(m.x,m.y)))continue;
      let live=this.port.bodies().filter(e=>encounterUnit(e.id)&&e.hp>0).length;
      if(live+missing.length>ENCOUNTER_LIMITS.active){
        // 给近处新场地让出显示预算。休眠前已经捕获伤势，不卸载交战、返家或在途事件。
        const candidates=this.port.bodies().filter(e=>encounterUnit(e.id)&&e.hp>0&&!e.attack&&!e.nav.returning&&e.nav.mode!=="chase"&&!this.port.busy(e.id)&&!inView(e,view)&&distance(e,player)>Math.max(650,distance(d,player)+250)).sort((a,b)=>distance(b,player)-distance(a,player));
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
