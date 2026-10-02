import {randomSeed} from './windGifts';
import {ENCOUNTERS,ENCOUNTER_LIMITS,encounterUnit,LEGACY_ENCOUNTER_IDS,ENCOUNTER_COMPOSITION_VERSION,waveMembers,adventureIndex,ADVENTURE_ROUTES} from "../../data/maps/windbell/encounters";
import {creatureMaxHP,ARENA_STONES,type ArenaStoneId,type EliteKind} from "../../data/maps/windbell/elites";
import {validOutdoorPoint} from "../../data/maps/windbell/bounds";
import {type CampBossKind} from '../../data/maps/windbell/campBosses';
import {initialCampBoss,validateCampBoss,type CampBossState} from './campBossState';
import {enemyLeashRadius} from '../../data/enemyPursuit';
export type EncounterMemberState={id:string;hp:number;x:number;y:number;serial:number;cooldown:number;defeated:boolean;drop:boolean;dropRemaining:number;participated:boolean;face:{x:number;y:number};guardOpen:number};
export type EncounterGroupState={composition:number;cycle:number;activated:boolean;cleared:boolean;cooldown:number;members:EncounterMemberState[];warning:number|null;summons?:EncounterMemberState[];wave?:number;waveWarning?:number;rewarded?:boolean;boss?:CampBossState};
export type EncounterState={elapsed:number;seed?:number;instance?:string;broken:ArenaStoneId[];groups:Record<string,EncounterGroupState>};
const member=(m:{id:string;type:string;elite?:EliteKind;boss?:CampBossKind;x:number;y:number}):EncounterMemberState=>({id:m.id,hp:creatureMaxHP(m.type,m.elite,m.boss),x:m.x,y:m.y,serial:0,cooldown:0,defeated:false,drop:false,dropRemaining:0,participated:false,face:{x:0,y:1},guardOpen:0});
export const initialEncounters=(seed=randomSeed(),instance?:string):EncounterState=>({elapsed:0,seed,...instance?{instance}:{},broken:[],groups:Object.fromEntries(ENCOUNTERS.map(d=>[d.id,{composition:ENCOUNTER_COMPOSITION_VERSION,cycle:0,activated:false,cleared:false,cooldown:0,warning:null,members:d.members.map(m=>member({...m,id:instance?`${instance}|${m.id}`:m.id})),...d.kind==='camp'?{boss:initialCampBoss()}: {}}]))});
export const campGuardsDefeated=(d:typeof ENCOUNTERS[number],g:EncounterGroupState)=>g.members.every(m=>!!encounterUnit(m.id)?.boss||m.defeated);

// 未击败的首领只封锁自己的场地；撤离后的待登场记录不能锁住其他方向或村庄。
export function campBossLocksAt(s:EncounterState,p:{x:number;y:number}){
 return ENCOUNTERS.some(d=>{
  const b=s.groups[d.id]?.boss,dist=Math.hypot(p.x-d.x,p.y-d.y);
  return d.kind==='camp'&&(b?.stage==='battle'?dist<=enemyLeashRadius({boss:true,leashRadius:d.radius}):b?.stage==='warning'&&dist<d.radius+200);
 });
}

// 仅结构升级调用：原成员槽位保持原值，历史已清据点明确继承，不伪造首领死亡。
export function migrateCampBosses(s:EncounterState){
  for(const d of ENCOUNTERS.filter(d=>d.kind==='camp')){const g=s.groups[d.id],boss=d.members.find(m=>m.boss)!,legacy=LEGACY_ENCOUNTER_IDS[d.id];
    if(!g||!Array.isArray(g.members))throw Error('旧据点成员记录缺失，不能覆盖清剿进度。');
    if(g.composition===undefined){
      if(![legacy.length-1,legacy.length].includes(g.members.length))throw Error('旧据点成员记录缺失，不能覆盖清剿进度。');
      if(g.members.length===legacy.length-1)g.members.push(member(boss));
    }
    if(g.composition===ENCOUNTER_COMPOSITION_VERSION&&g.members.length===d.members.length-1&&g.members.every((u,i)=>u.id===d.members[i].id))g.members.push(member(boss));
    const historical=g.cleared;g.boss??=initialCampBoss();
    if(historical){const i=g.composition===undefined?legacy.indexOf(boss.id):d.members.findIndex(m=>m.boss);if(g.members.some((u,n)=>n!==i&&(!u.defeated||u.hp!==0)))throw Error('旧据点清除记录不一致。');g.members[i]=member(boss);Object.assign(g.boss,{stage:'legacy',warning:0,away:0,combat:null});}
  }
  migrateEncounterComposition(s);
  for(const d of ENCOUNTERS.filter(d=>d.kind==='camp')){const g=s.groups[d.id];
    if(!g.cleared&&campGuardsDefeated(d,g)&&g.boss!.stage==='guards'){g.boss!.stage='warning';g.boss!.warning=2500;g.activated=true;}
  }
  return s;
}
// 已激活的旧批次不加入新敌人；新增槽位记为本批次不参战，后续合法重生才出现。
export function migrateEncounterComposition(s:EncounterState){
  for(const d of ENCOUNTERS){const g=s.groups?.[d.id];if(!g||g.composition!==undefined)continue;
    const ids=LEGACY_ENCOUNTER_IDS[d.id];
    if(!Array.isArray(g.members)||g.members.length!==ids.length||g.members.some((u,i)=>u.id!==undefined&&u.id!==ids[i]))throw Error('旧遭遇成员身份不一致，不能覆盖进度。');
    const old=new Map(g.members.map((u,i)=>[ids[i],{...u,id:ids[i]}]));
    g.members=d.members.map(m=>old.get(m.id)??{...member(m),...g.activated?{hp:0,defeated:true}: {}});
    g.composition=ENCOUNTER_COMPOSITION_VERSION;
  }
  return s;
}
export function validateEncounters(raw:unknown):EncounterState{
 const s=structuredClone(raw) as EncounterState;
 migrateEncounterComposition(s);
 const n=(v:unknown,max:number)=>typeof v==="number"&&Number.isFinite(v)&&v>=0&&v<=max;
 const fail=()=>{throw Error("荒野遭遇存档无效，上一份有效存档仍保留。");};
 if(!s||!n(s.elapsed,1e12)||!s.groups||Object.keys(s.groups).length!==ENCOUNTERS.length||!Array.isArray(s.broken)||new Set(s.broken).size!==s.broken.length||s.broken.some(id=>!ARENA_STONES.some(p=>p.id===id)))fail();
 if(s.instance!==undefined&&!/^memory:[1-9]\d{0,9}$/.test(s.instance))fail();
 if(s.seed!==undefined&&(!Number.isSafeInteger(s.seed)||s.seed<0||s.seed>0xffffffff))fail();
 for(const d of ENCOUNTERS){const g=s.groups[d.id],defs=encounterDefinitions(s,d);
  if(g?.wave!==undefined&&(s.seed===undefined||adventureIndex(d.id)<0||!Number.isSafeInteger(g.wave)||g.wave<0||g.wave>3||!n(g.waveWarning,2000)||typeof g.rewarded!=="boolean"))fail();
  if(!g||g.composition!==ENCOUNTER_COMPOSITION_VERSION||!Number.isSafeInteger(g.cycle)||!n(g.cycle,1e9)||typeof g.activated!=="boolean"||typeof g.cleared!=="boolean"||!n(g.cooldown,d.cooldownMs)||!Array.isArray(g.members)||g.members.length!==defs.length)fail();
  if(g.summons!==undefined&&(!Array.isArray(g.summons)||g.summons.length>4||g.summons.filter(u=>!u.defeated).length>2||new Set(g.summons.map(u=>u.id)).size!==g.summons.length||g.summons.some(u=>{const owner=encounterUnit(u.id);return !owner||owner.group!==d.id||!u.id.includes(':唤巢:')||!n(u.hp,48)||u.defeated!==(u.hp===0)||!validOutdoorPoint(u)||u.drop||u.dropRemaining!==0||!n(u.serial,1e9)||!n(u.cooldown,10000)||!u.face||Math.abs(Math.hypot(u.face.x,u.face.y)-1)>.001;})))fail();
  if(g.warning!==null&&(!d.after&&!d.id.startsWith('legacy-')||g.activated||!n(g.warning,2500)||!!d.after&&!s.groups[d.after]?.cleared))fail();
  if(d.kind==='camp'){
   g.boss=validateCampBoss(g.boss,defs.find(m=>m.boss)!.id);
   const guards=campGuardsDefeated(d,g),boss=g.members[defs.findIndex(m=>m.boss)];
   if((g.boss.stage==='guards')===guards||g.boss.stage==='defeated'!==boss.defeated||g.boss.stage==='legacy'&&boss.defeated||g.boss.stage!=='guards'&&!g.activated)fail();
  }else if(g.boss!==undefined)fail();
  for(const [i,u] of g.members.entries()){
   // 额外余量容纳边缘受击后撤，坐标仍受室外边界及有限活动范围校验。
   const savedRadius=enemyLeashRadius({...defs[i],leashRadius:d.radius})+100;
   if(!u||u.id!==defs[i].id||!n(u.hp,creatureMaxHP(defs[i].type,defs[i].elite,defs[i].boss))||!validOutdoorPoint(u)||Math.hypot(u.x-defs[i].x,u.y-defs[i].y)>savedRadius||!Number.isSafeInteger(u.serial)||!n(u.serial,1e9)||!n(u.cooldown,10000)||typeof u.defeated!=="boolean"||u.defeated!==(u.hp===0)||typeof u.drop!=="boolean"||!n(u.dropRemaining,ENCOUNTER_LIMITS.dropLifetimeMs)||u.drop!==(u.dropRemaining>0)||u.drop&&!u.defeated||typeof u.participated!=="boolean"||!u.face||!Number.isFinite(u.face.x)||!Number.isFinite(u.face.y)||Math.abs(Math.hypot(u.face.x,u.face.y)-1)>.001||!n(u.guardOpen,1200))fail();
  }
  if(g.cleared!==(g.members.every(u=>u.defeated)||g.boss?.stage==='legacy')||!g.activated&&(g.cycle!==0||g.cleared||g.cooldown>0||g.members.some((u,i)=>u.hp!==creatureMaxHP(defs[i].type,defs[i].elite,defs[i].boss)||u.defeated||u.drop||u.participated||u.x!==defs[i].x||u.y!==defs[i].y||u.serial!==0||u.cooldown!==0)))fail();
 }
 if(Object.values(s.groups).filter(g=>g.boss?.stage==='battle').length>1)fail();
 if(s.broken.length&&!s.groups["north-rock-arena"].activated)fail();
 return {elapsed:s.elapsed,...s.seed===undefined?{}:{seed:s.seed},...s.instance?{instance:s.instance}:{},broken:[...s.broken],groups:Object.fromEntries(ENCOUNTERS.map(d=>{const g=s.groups[d.id];return [d.id,{composition:g.composition,cycle:g.cycle,activated:g.activated,cleared:g.cleared,cooldown:g.cooldown,warning:g.warning,...g.summons?{summons:structuredClone(g.summons)}:{},...g.wave===undefined?{}:{wave:g.wave,waveWarning:g.waveWarning,rewarded:g.rewarded},...g.boss?{boss:g.boss}:{},members:g.members.map(u=>({id:u.id,hp:u.hp,x:u.x,y:u.y,serial:u.serial,cooldown:u.cooldown,defeated:u.defeated,drop:u.drop,dropRemaining:u.dropRemaining,participated:u.participated,face:{...u.face},guardOpen:u.guardOpen}))}];}))};
}
export function unitState(s:EncounterState,id:string):EncounterMemberState|undefined{const d=encounterUnit(id);if(!d)return;if(s.instance&&!id.startsWith(s.instance+'|'))return;const group=s.groups[d.group],u=group?.members.find(m=>m.id===id);if(u)return u;const summon=group?.summons?.find(m=>m.id===id);if(summon)return summon;
 const owned=/^(.+):(祭根|护猎):(\d+):(\d+)$/.exec(id);if(!owned||group?.boss?.attempt!==Number(owned[3]))return;
 const b=group.boss.combat?.battle,node=owned[2]==='祭根'?b?.roots?.[Number(owned[4])]:b?.summons?.find(m=>m.id===id);if(!node)return;
 return {id,hp:node.hp,x:node.x,y:node.y,serial:0,cooldown:0,defeated:node.hp===0,drop:false,dropRemaining:0,participated:false,face:{x:0,y:1},guardOpen:0};
}
export const campCleared=(s:EncounterState,id:string)=>ENCOUNTERS.some(d=>d.id===id&&d.kind==="camp")&&s.groups[id].cleared;
// 当前批次结算一次；卫兵击杀不会生成可反复引怪刷取的资源。
export function settleEncounterDeath(s:EncounterState,id:string,reward:boolean){
 const u=unitState(s,id),d=encounterUnit(id);if(!u||!d||u.defeated)return false;
 const group=s.groups[d.group],definition=ENCOUNTERS.find(g=>g.id===d.group)!;
 if(d.boss&&group.boss?.stage!=='battle')return false;
 u.hp=0;u.defeated=true;u.drop=reward;u.dropRemaining=reward?ENCOUNTER_LIMITS.dropLifetimeMs:0;u.cooldown=0;
 if(group.boss){if(d.boss){group.boss.stage='defeated';group.boss.warning=0;group.boss.combat=null;group.boss.away=0;}
   else if(campGuardsDefeated(definition,group)&&group.boss.stage==='guards'){group.boss.stage='warning';group.boss.warning=2500;}}
 if(group.wave!==undefined&&group.members.filter(m=>!encounterUnit(m.id)?.boss).every(m=>m.defeated))group.rewarded=true;
 if(group.members.every(m=>m.defeated)){group.cleared=true;group.cooldown=definition.cooldownMs;}
 return true;
}
// 仅正式有效运行时间调用；离线、暂停、读档或休息不传入历史跨度。
export function advanceEncounters(s:EncounterState,delta:number){
 const dt=Math.max(0,Math.min(250,delta));s.elapsed=Math.min(1e12,s.elapsed+dt);
 for(const g of Object.values(s.groups)){
  g.cooldown=Math.max(0,g.cooldown-dt);if(g.warning!==null)g.warning=Math.max(0,g.warning-dt);
  for(const u of [...g.members,...g.summons??[]]){u.cooldown=Math.max(0,u.cooldown-dt);u.guardOpen=Math.max(0,u.guardOpen-dt);u.dropRemaining=Math.max(0,u.dropRemaining-dt);if(u.dropRemaining===0)u.drop=false;}
 }
}
export function resetEncounter(s:EncounterState,id:string){
 const d=ENCOUNTERS.find(g=>g.id===id)!,g=s.groups[id];
 if(s.seed!==undefined||g?.wave!==undefined)return false;
 if(!d||!g||g.cycle>=1e9||d.kind!=="patrol"||!g.cleared||g.cooldown>0||g.members.some(m=>m.drop)||campCleared(s,d.source))return false;
 g.members=d.members.map((m,i)=>({...member(m),serial:g.members[i].serial}));g.cycle++;g.cleared=false;g.activated=true;return true;
}

export function encounterDefinitions(s:EncounterState,d:typeof ENCOUNTERS[number]){const defs=s.groups[d.id]?.wave===undefined?d.members:waveMembers(d,s.seed!);return s.instance?defs.map(m=>({...m,id:`${s.instance}|${m.id}`})):defs;}
export function activateAdventure(s:EncounterState,id:string){
 const d=ENCOUNTERS.find(d=>d.id===id)!,g=s.groups[id],node=adventureIndex(id);if(node<0||g.activated||s.seed===undefined)return false;
 const route=ADVENTURE_ROUTES[d.direction];if(node>0&&!s.groups[route[node-1]].rewarded)return false;
 g.members=waveMembers(d,s.seed).map(m=>member({...m,id:s.instance?`${s.instance}|${m.id}`:m.id}));g.wave=0;g.waveWarning=2000;g.rewarded=false;g.activated=true;g.warning=null;return true;
}
export function advanceAdventureWave(s:EncounterState,d:typeof ENCOUNTERS[number],delta:number){
 const g=s.groups[d.id];if(g.wave===undefined||g.rewarded)return;
 // 运行控制器传入的成员已带实例前缀；从固定定义重建，避免风忆身份被重复加前缀。
 const definition=ENCOUNTERS.find(v=>v.id===d.id)!;
 const defs=encounterDefinitions(s,definition),current=defs.filter(m=>!m.boss&&'wave' in m&&m.wave===g.wave);
 if(current.length&&current.every(m=>unitState(s,m.id)?.defeated)){g.wave++;g.waveWarning=2000;}
 else g.waveWarning=Math.max(0,(g.waveWarning??0)-delta);
}
