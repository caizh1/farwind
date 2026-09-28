import {ENCOUNTERS,ENCOUNTER_LIMITS,encounterUnit} from "../../data/maps/windbell/encounters";
import {creatureMaxHP,ARENA_STONES,type ArenaStoneId,type EliteKind} from "../../data/maps/windbell/elites";
import {validOutdoorPoint} from "../../data/maps/windbell/bounds";
export type EncounterMemberState={hp:number;x:number;y:number;serial:number;cooldown:number;defeated:boolean;drop:boolean;dropRemaining:number;participated:boolean;face:{x:number;y:number};guardOpen:number};
export type EncounterGroupState={cycle:number;activated:boolean;cleared:boolean;cooldown:number;members:EncounterMemberState[];warning:number|null};
export type EncounterState={elapsed:number;broken:ArenaStoneId[];groups:Record<string,EncounterGroupState>};
const member=(m:{type:string;elite?:EliteKind;x:number;y:number}):EncounterMemberState=>({hp:creatureMaxHP(m.type,m.elite),x:m.x,y:m.y,serial:0,cooldown:0,defeated:false,drop:false,dropRemaining:0,participated:false,face:{x:0,y:1},guardOpen:0});
export const initialEncounters=():EncounterState=>({elapsed:0,broken:[],groups:Object.fromEntries(ENCOUNTERS.map(d=>[d.id,{cycle:0,activated:false,cleared:false,cooldown:0,warning:null,members:d.members.map(member)}]))});
export function validateEncounters(raw:unknown):EncounterState{
 const s=structuredClone(raw) as EncounterState;
 const n=(v:unknown,max:number)=>typeof v==="number"&&Number.isFinite(v)&&v>=0&&v<=max;
 const fail=()=>{throw Error("荒野遭遇存档无效，上一份有效存档仍保留。");};
 if(!s||!n(s.elapsed,1e12)||!s.groups||Object.keys(s.groups).length!==ENCOUNTERS.length||!Array.isArray(s.broken)||new Set(s.broken).size!==s.broken.length||s.broken.some(id=>!ARENA_STONES.some(p=>p.id===id)))fail();
 for(const d of ENCOUNTERS){const g=s.groups[d.id];
  if(!g||!Number.isSafeInteger(g.cycle)||!n(g.cycle,1e9)||typeof g.activated!=="boolean"||typeof g.cleared!=="boolean"||!n(g.cooldown,d.cooldownMs)||!Array.isArray(g.members)||g.members.length!==d.members.length)fail();
  if(g.warning!==null&&(!d.after||g.activated||!n(g.warning,2500)||!s.groups[d.after]?.cleared))fail();
  for(const [i,u] of g.members.entries()){
   if(!u||!n(u.hp,creatureMaxHP(d.members[i].type,d.members[i].elite))||!validOutdoorPoint(u)||Math.hypot(u.x-d.members[i].x,u.y-d.members[i].y)>900||!Number.isSafeInteger(u.serial)||!n(u.serial,1e9)||!n(u.cooldown,10000)||typeof u.defeated!=="boolean"||u.defeated!==(u.hp===0)||typeof u.drop!=="boolean"||!n(u.dropRemaining,ENCOUNTER_LIMITS.dropLifetimeMs)||u.drop!==(u.dropRemaining>0)||u.drop&&!u.defeated||typeof u.participated!=="boolean"||!u.face||!Number.isFinite(u.face.x)||!Number.isFinite(u.face.y)||Math.abs(Math.hypot(u.face.x,u.face.y)-1)>.001||!n(u.guardOpen,1200))fail();
  }
  if(g.cleared!==g.members.every(u=>u.defeated)||!g.activated&&(g.cycle!==0||g.cleared||g.cooldown>0||g.members.some((u,i)=>u.hp!==creatureMaxHP(d.members[i].type,d.members[i].elite)||u.defeated||u.drop||u.participated||u.x!==d.members[i].x||u.y!==d.members[i].y||u.serial!==0||u.cooldown!==0)))fail();
 }
 if(s.broken.length&&!s.groups["north-rock-arena"].activated)fail();
 return {elapsed:s.elapsed,broken:[...s.broken],groups:Object.fromEntries(ENCOUNTERS.map(d=>{const g=s.groups[d.id];return [d.id,{cycle:g.cycle,activated:g.activated,cleared:g.cleared,cooldown:g.cooldown,warning:g.warning,members:g.members.map(u=>({hp:u.hp,x:u.x,y:u.y,serial:u.serial,cooldown:u.cooldown,defeated:u.defeated,drop:u.drop,dropRemaining:u.dropRemaining,participated:u.participated,face:{...u.face},guardOpen:u.guardOpen}))}];}))};
}
export function unitState(s:EncounterState,id:string){const d=encounterUnit(id);if(!d)return;const group=ENCOUNTERS.find(g=>g.id===d.group)!;return s.groups[d.group].members[group.members.findIndex(m=>m.id===id)];}
export const campCleared=(s:EncounterState,id:string)=>ENCOUNTERS.some(d=>d.id===id&&d.kind==="camp")&&s.groups[id].cleared;
// 当前批次结算一次；卫兵击杀不会生成可反复引怪刷取的资源。
export function settleEncounterDeath(s:EncounterState,id:string,reward:boolean){
 const u=unitState(s,id),d=encounterUnit(id);if(!u||!d||u.defeated)return false;
 u.hp=0;u.defeated=true;u.drop=reward;u.dropRemaining=reward?ENCOUNTER_LIMITS.dropLifetimeMs:0;u.cooldown=0;
 const group=s.groups[d.group],definition=ENCOUNTERS.find(g=>g.id===d.group)!;
 if(group.members.every(m=>m.defeated)){group.cleared=true;group.cooldown=definition.cooldownMs;}
 return true;
}
// 仅正式有效运行时间调用；离线、暂停、读档或休息不传入历史跨度。
export function advanceEncounters(s:EncounterState,delta:number){
 const dt=Math.max(0,Math.min(250,delta));s.elapsed=Math.min(1e12,s.elapsed+dt);
 for(const g of Object.values(s.groups)){
  g.cooldown=Math.max(0,g.cooldown-dt);if(g.warning!==null)g.warning=Math.max(0,g.warning-dt);
  for(const u of g.members){u.cooldown=Math.max(0,u.cooldown-dt);u.guardOpen=Math.max(0,u.guardOpen-dt);u.dropRemaining=Math.max(0,u.dropRemaining-dt);if(u.dropRemaining===0)u.drop=false;}
 }
}
export function resetEncounter(s:EncounterState,id:string){
 const d=ENCOUNTERS.find(g=>g.id===id)!,g=s.groups[id];
 if(!d||!g||g.cycle>=1e9||d.kind!=="patrol"||!g.cleared||g.cooldown>0||g.members.some(m=>m.drop)||campCleared(s,d.source))return false;
 g.members=d.members.map((m,i)=>({...member(m),serial:g.members[i].serial}));g.cycle++;g.cleared=false;g.activated=true;return true;
}
