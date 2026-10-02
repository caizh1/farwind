import {activeHostileCount} from './combatUnitBudget';
import type {World} from '../scenes/World';
import {encounterUnit,ENCOUNTERS,ENCOUNTER_LIMITS} from '../../data/maps/windbell/encounters';
import {clearMotionLine,motionBlocked} from './obstacles';
import type {EncounterMemberState} from './encounterState';
// 铃妖支援的实例进入同一成员查询；四只总额包含已死亡实例，读档不会重新获得召唤次数。
export function updateSummonSupport(w:World){
 const records=w.combatEncounters;
 for(const e of w.enemies){if(e.hp<=0||e.type!=='bell')continue;const d=encounterUnit(e.id);if(!d)continue;const g=records.groups[d.group],a=e.attack;
  if(!a||a.cancelled||a.launched||w.sim<a.contactAt)continue;a.launched=true;g.summons??=[];
  const points=Array.from({length:24},(_,i)=>({x:e.x+Math.cos(i*Math.PI/12)*200,y:e.y+Math.sin(i*Math.PI/12)*200}));
  for(const p of points){if(g.summons.length>=4||g.summons.filter(s=>s.hp>0).length>=2)break;
   if(motionBlocked(p.x,p.y)||!clearMotionLine(e,p)||Math.hypot(p.x-w.state.player.x,p.y-w.state.player.y)<220||w.enemies.some(b=>b.hp>0&&Math.hypot(b.x-p.x,b.y-p.y)<65)||g.summons.some(s=>s.hp>0&&Math.hypot(s.x-p.x,s.y-p.y)<65))continue;
   g.summons.push({id:`${e.id}:唤巢:${g.summons.length}`,hp:48,...p,serial:0,cooldown:0,defeated:false,drop:false,dropRemaining:0,participated:false,face:{x:0,y:1},guardOpen:0});
  }
 }
 for(const [id,g] of Object.entries(records.groups)){const d=ENCOUNTERS.find(d=>d.id===id)!;if(g.rewarded||Math.hypot(d.x-w.state.player.x,d.y-w.state.player.y)>1000)continue;
  for(const u of g.summons??[]){if(u.defeated||w.enemies.some(e=>e.id===u.id)||activeHostileCount(w)>=ENCOUNTER_LIMITS.active||w.enemies.filter(e=>e.hp>0&&(e.bossSummon||e.id.includes(':唤巢:'))).length>=2)continue;const body=w.makeEnemy({id:u.id,type:'slime',x:u.x,y:u.y});Object.assign(body,{hp:u.hp,face:{...u.face},attackSerial:u.serial,cool:w.sim+u.cooldown});w.enemies.push(body);}
 }
}
