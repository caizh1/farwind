import {ENCOUNTERS,ENCOUNTER_LIMITS,encounterUnit} from "../../data/maps/windbell/encounters";
import {creatureMaxHP,ARENA_STONES,type ArenaStoneId,type EliteKind} from "../../data/maps/windbell/elites";
import {validOutdoorPoint} from "../../data/maps/windbell/bounds";
import {type CampBossKind} from '../../data/maps/windbell/campBosses';
import {initialCampBoss,validateCampBoss,type CampBossState} from './campBossState';
import {enemyLeashRadius} from '../../data/enemyPursuit';
export type EncounterMemberState={hp:number;x:number;y:number;serial:number;cooldown:number;defeated:boolean;drop:boolean;dropRemaining:number;participated:boolean;face:{x:number;y:number};guardOpen:number};
export type EncounterGroupState={cycle:number;activated:boolean;cleared:boolean;cooldown:number;members:EncounterMemberState[];warning:number|null;boss?:CampBossState};
export type EncounterState={elapsed:number;broken:ArenaStoneId[];groups:Record<string,EncounterGroupState>};
const member=(m:{type:string;elite?:EliteKind;boss?:CampBossKind;x:number;y:number}):EncounterMemberState=>({hp:creatureMaxHP(m.type,m.elite,m.boss),x:m.x,y:m.y,serial:0,cooldown:0,defeated:false,drop:false,dropRemaining:0,participated:false,face:{x:0,y:1},guardOpen:0});
export const initialEncounters=():EncounterState=>({elapsed:0,broken:[],groups:Object.fromEntries(ENCOUNTERS.map(d=>[d.id,{cycle:0,activated:false,cleared:false,cooldown:0,warning:null,members:d.members.map(member),...d.kind==='camp'?{boss:initialCampBoss()}: {}}]))});
export const campGuardsDefeated=(d:typeof ENCOUNTERS[number],g:EncounterGroupState)=>d.members.every((m,i)=>!!m.boss||g.members[i].defeated);

// 仅结构升级调用：原成员槽位保持原值，历史已清据点明确继承，不伪造首领死亡。
export function migrateCampBosses(s:EncounterState){
  for(const d of ENCOUNTERS.filter(d=>d.kind==='camp')){const g=s.groups[d.id],boss=d.members.find(m=>m.boss)!;
    if(!g||!Array.isArray(g.members)||![d.members.length-1,d.members.length].includes(g.members.length))throw Error('旧据点成员记录缺失，不能覆盖清剿进度。');
    const historical=g.cleared;
    if(historical&&!g.members.slice(0,d.members.length-1).every(u=>u.defeated&&u.hp===0))throw Error('旧据点清除记录不一致。');
    if(g.members.length===d.members.length-1)g.members.push(member(boss));
    g.boss??=initialCampBoss();if(historical){g.members[g.members.length-1]=member(boss);Object.assign(g.boss,{stage:'legacy',warning:0,away:0,combat:null});}
    else if(campGuardsDefeated(d,g)&&g.boss.stage==='guards'){g.boss.stage='warning';g.boss.warning=2500;g.activated=true;}
  }
  return s;
}
export function validateEncounters(raw:unknown):EncounterState{
 const s=structuredClone(raw) as EncounterState;
 const n=(v:unknown,max:number)=>typeof v==="number"&&Number.isFinite(v)&&v>=0&&v<=max;
 const fail=()=>{throw Error("荒野遭遇存档无效，上一份有效存档仍保留。");};
 if(!s||!n(s.elapsed,1e12)||!s.groups||Object.keys(s.groups).length!==ENCOUNTERS.length||!Array.isArray(s.broken)||new Set(s.broken).size!==s.broken.length||s.broken.some(id=>!ARENA_STONES.some(p=>p.id===id)))fail();
 for(const d of ENCOUNTERS){const g=s.groups[d.id];
  if(!g||!Number.isSafeInteger(g.cycle)||!n(g.cycle,1e9)||typeof g.activated!=="boolean"||typeof g.cleared!=="boolean"||!n(g.cooldown,d.cooldownMs)||!Array.isArray(g.members)||g.members.length!==d.members.length)fail();
  if(g.warning!==null&&(!d.after||g.activated||!n(g.warning,2500)||!s.groups[d.after]?.cleared))fail();
  if(d.kind==='camp'){
   g.boss=validateCampBoss(g.boss,d.members.find(m=>m.boss)!.id);
   const guards=campGuardsDefeated(d,g),boss=g.members[d.members.findIndex(m=>m.boss)];
   if((g.boss.stage==='guards')===guards||g.boss.stage==='defeated'!==boss.defeated||g.boss.stage==='legacy'&&boss.defeated||g.boss.stage!=='guards'&&!g.activated)fail();
  }else if(g.boss!==undefined)fail();
  for(const [i,u] of g.members.entries()){
   // 额外余量容纳边缘受击后撤，坐标仍受室外边界及有限活动范围校验。
   const savedRadius=enemyLeashRadius({...d.members[i],leashRadius:d.radius})+100;
   if(!u||!n(u.hp,creatureMaxHP(d.members[i].type,d.members[i].elite,d.members[i].boss))||!validOutdoorPoint(u)||Math.hypot(u.x-d.members[i].x,u.y-d.members[i].y)>savedRadius||!Number.isSafeInteger(u.serial)||!n(u.serial,1e9)||!n(u.cooldown,10000)||typeof u.defeated!=="boolean"||u.defeated!==(u.hp===0)||typeof u.drop!=="boolean"||!n(u.dropRemaining,ENCOUNTER_LIMITS.dropLifetimeMs)||u.drop!==(u.dropRemaining>0)||u.drop&&!u.defeated||typeof u.participated!=="boolean"||!u.face||!Number.isFinite(u.face.x)||!Number.isFinite(u.face.y)||Math.abs(Math.hypot(u.face.x,u.face.y)-1)>.001||!n(u.guardOpen,1200))fail();
  }
  if(g.cleared!==(g.members.every(u=>u.defeated)||g.boss?.stage==='legacy')||!g.activated&&(g.cycle!==0||g.cleared||g.cooldown>0||g.members.some((u,i)=>u.hp!==creatureMaxHP(d.members[i].type,d.members[i].elite,d.members[i].boss)||u.defeated||u.drop||u.participated||u.x!==d.members[i].x||u.y!==d.members[i].y||u.serial!==0||u.cooldown!==0)))fail();
 }
 if(s.broken.length&&!s.groups["north-rock-arena"].activated)fail();
 return {elapsed:s.elapsed,broken:[...s.broken],groups:Object.fromEntries(ENCOUNTERS.map(d=>{const g=s.groups[d.id];return [d.id,{cycle:g.cycle,activated:g.activated,cleared:g.cleared,cooldown:g.cooldown,warning:g.warning,...g.boss?{boss:g.boss}:{},members:g.members.map(u=>({hp:u.hp,x:u.x,y:u.y,serial:u.serial,cooldown:u.cooldown,defeated:u.defeated,drop:u.drop,dropRemaining:u.dropRemaining,participated:u.participated,face:{...u.face},guardOpen:u.guardOpen}))}];}))};
}
export function unitState(s:EncounterState,id:string){const d=encounterUnit(id);if(!d)return;const group=ENCOUNTERS.find(g=>g.id===d.group)!;return s.groups[d.group].members[group.members.findIndex(m=>m.id===id)];}
export const campCleared=(s:EncounterState,id:string)=>ENCOUNTERS.some(d=>d.id===id&&d.kind==="camp")&&s.groups[id].cleared;
// 当前批次结算一次；卫兵击杀不会生成可反复引怪刷取的资源。
export function settleEncounterDeath(s:EncounterState,id:string,reward:boolean){
 const u=unitState(s,id),d=encounterUnit(id);if(!u||!d||u.defeated)return false;
 const group=s.groups[d.group],definition=ENCOUNTERS.find(g=>g.id===d.group)!;
 if(d.boss&&group.boss?.stage!=='battle')return false;
 u.hp=0;u.defeated=true;u.drop=reward;u.dropRemaining=reward?ENCOUNTER_LIMITS.dropLifetimeMs:0;u.cooldown=0;
 if(group.boss){if(d.boss){group.boss.stage='defeated';group.boss.warning=0;group.boss.combat=null;group.boss.away=0;}
   else if(campGuardsDefeated(definition,group)&&group.boss.stage==='guards'){group.boss.stage='warning';group.boss.warning=2500;}}
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
