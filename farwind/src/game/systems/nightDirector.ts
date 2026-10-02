import {sourceAllowsRaid} from "./wildThreat";
import {DAY_NIGHT as C} from "../../data/dayNight";
import {RAID_GATES,DEFENSE,type GateId} from "../../data/defense";
import {DEMON_KING,demonFormation,harassmentChance,validRaidOrder,wildOrder,type RaidOrder} from '../../data/demonKing';
import {demonMalice,pendingRetaliations} from './demonKingState';
import {ENCOUNTERS} from '../../data/maps/windbell/encounters';
import {dayNumber,nightWindowEnd,crossedBoundaries,minuteOfDay} from "./worldClock";
import {nextRandom,prepareRaid,raidSpawnPoints,EastDefense} from "./defense";
import type {State} from "./state";
import type {Rect,Point} from "./obstacles";
export type NightPlan={night:number;at:number;gate:GateId;count:number;outcome:"quiet"|"pending"|"started"|"cancelled"|"skipped";raidSequence:number|null;order?:RaidOrder};
const sourceAllowed=(s:State,p:NightPlan,gate=p.gate)=>p.order?.source==='demon-king'||sourceAllowsRaid(s.encounters,gate);
export type NightState={takeoverNight:number;plan:NightPlan|null;discovered:boolean};
export const initialNight=():NightState=>({takeoverNight:1,plan:null,discovered:false});
export const migratedNight=(time:number):NightState=>({takeoverNight:dayNumber(time)+(minuteOfDay(time)<C.dusk?0:1),plan:null,discovered:false});
export function validateNight(s:State){
  const n=s.night,p=n?.plan,integer=(v:number)=>Number.isSafeInteger(v)&&v>=0&&v<=1e9;
  if(!n||!integer(n.takeoverNight)||n.takeoverNight<1||n.takeoverNight>dayNumber(s.time)+1||typeof n.discovered!=="boolean"||p===undefined)throw Error("昼夜存档字段无效。");
  if(p!==null&&(!p||!integer(p.night)||p.night<1||p.night<n.takeoverNight||p.night>dayNumber(s.time)||s.time<(p.night-1)*C.day+C.dusk||
    !Number.isFinite(p.at)||p.at<(p.night-1)*C.day+C.raidStart||p.at>=nightWindowEnd(p.night)||
    !validRaidOrder(p.order)||p.order?.retaliationCamp!==undefined||!RAID_GATES.some(g=>g.id===p.gate)||!Number.isInteger(p.count)||p.count<1||p.count>(p.order?.source==='demon-king'?DEMON_KING.maxUnits:DEFENSE.historyUnitLimit)||
    !["quiet","pending","started","cancelled","skipped"].includes(p.outcome)||
    (p.outcome==="started"? !integer(p.raidSequence!)||p.raidSequence!<1||p.raidSequence!>s.defense.sequence:p.raidSequence!==null)||
    (p.night===1&&p.outcome!=="quiet"&&p.outcome!=="skipped")||
    (p.outcome==="started"&&s.time<p.at)||
    (p.outcome==="cancelled"&&s.time<nightWindowEnd(p.night))||
    (p.outcome==="skipped"&&s.time<nightWindowEnd(p.night)+C.dawn)||
    (p.outcome==="pending"&&s.time>=nightWindowEnd(p.night))||
    (p.outcome==="started"&&s.defense.raid?.sequence===p.raidSequence&&
      (s.defense.raid.gateId!==p.gate||s.defense.raid.members.length!==p.count))))throw Error("夜间计划或来袭序号无效。");
  if(p?.order?.source==='demon-king'&&(p.order.malice>demonMalice(s.encounters)||p.count<demonFormation(p.order.malice,1).count||p.count>demonFormation(p.order.malice,3).count))throw Error('魔王夜间计划与清剿进度不一致。');
  if(p?.outcome==='started'&&s.defense.raid?.sequence===p.raidSequence){const order=p.order??wildOrder(),raid=s.defense.raid.order??wildOrder();
    if(order.source!==raid.source||order.malice!==raid.malice||order.profileVersion!==raid.profileVersion)throw Error('夜间计划与派遣来源不一致。');
  }
  return {takeoverNight:n.takeoverNight,discovered:n.discovered,plan:p===null?null:{night:p.night,at:p.at,gate:p.gate,count:p.count,outcome:p.outcome,raidSequence:p.raidSequence,...(p.order?{order:{...p.order}}:{})}};
}
export function makeNightPlan(s:State,night:number):NightPlan{
  const seed=nextRandom((s.defense.seed^Math.imul(night,2654435761))>>>0||1729),r=nextRandom(seed);
  const malice=demonMalice(s.encounters),order:RaidOrder=malice?{source:'demon-king',malice,profileVersion:1}:wildOrder();
  return {night,at:(night-1)*C.day+C.raidStart+r%210,gate:RAID_GATES[seed%RAID_GATES.length].id,count:demonFormation(malice,1+r%DEFENSE.unitLimit).count,order,
    outcome:night===1||!malice&&!sourceAllowsRaid(s.encounters,RAID_GATES[seed%RAID_GATES.length].id)||nextRandom(r)%100>=harassmentChance(malice)?"quiet":"pending",raidSequence:null};
}
// 只在常规推进的黄昏边界制定计划；加载不调用本函数，长跨度不回放历史。
export function advanceNight(s:State,previous:number){
  let changed=false;
  const dusk=crossedBoundaries(previous,s.time).events.filter(e=>e.phase==="dusk").at(-1);
  if(dusk){const night=dayNumber(dusk.time);if(night>=s.night.takeoverNight&&(!s.night.plan||s.night.plan.night<night)){s.night.plan=makeNightPlan(s,night);changed=true;}}
  const p=s.night.plan;
  if(p?.outcome==="pending"&&!sourceAllowed(s,p)){p.outcome="quiet";changed=true;}
  if(p?.outcome==="pending"&&s.time>=nightWindowEnd(p.night)){p.outcome="cancelled";changed=true;}
  return changed;
}
export function mayStartNight(s:State){
  const p=s.night.plan,d=s.defense;
  return !!p&&sourceAllowed(s,p)&&p.outcome==="pending"&&s.time>=p.at&&s.time<nightWindowEnd(p.night)&&minuteOfDay(s.time)>=C.raidStart&&
    !d.raid&&!d.protectionMs&&!d.cooldownMs&&!d.retryMs;
}
export class RaidDeferredError extends Error {}
export const mayStartRetaliation=(s:State)=>!s.defense.raid&&!s.defense.retryMs&&pendingRetaliations(s).length>0;
export function retaliationWarningSnapshot(s:State,view?:Rect,occupied:readonly Point[]=[],defense?:EastDefense){
  if(!mayStartRetaliation(s))throw Error('当前没有可启动的据点报复。');
  const camp=pendingRetaliations(s)[0],direction=ENCOUNTERS.find(d=>d.id===camp)!.direction;
  const order:RaidOrder={source:'demon-king',malice:demonMalice(s.encounters),profileVersion:1,retaliationCamp:camp,retaliationLevel:(s.demonKing.retaliatedCamps?.length??0)+1};
  const admission=defense??new EastDefense(structuredClone(s.defense),0);
  const player=s.life.playerSpace==='village'?s.player:{x:-10000,y:-10000},visible=s.life.playerSpace==='village'?view:undefined;
  const first=RAID_GATES.findIndex(g=>g.id===`${direction}-gate`);
  const gate=RAID_GATES.map((_,i)=>RAID_GATES[(first+i)%RAID_GATES.length]).find(g=>{
    if(g.id==='west-gate'&&s.mapProgress.westRoad!=='open')return false;
    const points=raidSpawnPoints(g.id,DEMON_KING.maxUnits,player,visible,occupied,order);
    return points.length===DEMON_KING.maxUnits&&admission.canScheduleAtGate(g.id,player,points,visible,occupied,order);
  });
  if(!gate)throw new RaidDeferredError('地图边缘尚无足量安全站位，报复部队等待出发。');
  const next=structuredClone(s);
  next.defense=prepareRaid(next.defense,player,gate.id,DEMON_KING.maxUnits,true,visible,occupied,order);
  next.demonKing.retaliatedCamps=[...(next.demonKing.retaliatedCamps??[]),camp];
  return next;
}
export function nightWarningSnapshot(s:State,view?:Rect,occupied:readonly Point[]=[],defense?:EastDefense){
  if(!mayStartNight(s))throw Error("当前夜间计划尚不能启动。");
  const next=structuredClone(s),p=next.night.plan!;
  // 历史已出生四怪原样恢复；旧待定计划尚未出生，按新事件上限准备。
  const count=p.order?.source==='demon-king'?p.count:Math.min(p.count,DEFENSE.unitLimit);
  const admission=defense??new EastDefense(structuredClone(s.defense),0);
  if(!defense)admission.rebind(s.defense);
  const player=s.life.playerSpace==="village"?s.player:{x:-10000,y:-10000};
  const visible=s.life.playerSpace==="village"?view:undefined;
  const first=RAID_GATES.findIndex(g=>g.id===p.gate);
  const gate=RAID_GATES.map((_,i)=>RAID_GATES[(first+i)%RAID_GATES.length]).find(g=>{
    if(!sourceAllowed(s,p,g.id)||g.id==='west-gate'&&s.mapProgress.westRoad!=='open')return false;
    const spawns=raidSpawnPoints(g.id,count,player,visible,occupied,p.order);
    return spawns.length===count&&admission.canScheduleAtGate(g.id,player,spawns,visible,occupied,p.order);
  });
  if(!gate)throw new RaidDeferredError("各门防线健康、岗位或生成条件尚不满足，延后来袭。");
  next.defense=prepareRaid(next.defense,player,gate.id,count,true,visible,occupied,p.order);
  p.gate=gate.id;p.count=count;
  p.outcome="started";p.raidSequence=next.defense.sequence;
  return next;
}
