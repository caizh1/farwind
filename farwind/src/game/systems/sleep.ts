import {INTERIOR_SERVICE} from '../../data/villageInteriors';
import {spaceClear} from './npcNavigation';
import {VILLAGE_ANCHORS} from '../../data/maps/windbell/layout';
import {DAY_NIGHT as C} from "../../data/dayNight";
import {currentNight,nextDawn} from "./worldClock";
import {validate,type State} from "./state";
import {clearMotionLine} from "./obstacles";
import {makeNightPlan} from "./nightDirector";
export type SleepSafety={action:boolean;threat:boolean;projectile:boolean;conflict:boolean};
export function sleepSnapshot(s:State,sequence:number,safety:SleepSafety){
  if(!safety||safety.conflict)throw Error("存在冲突的状态提交，请稍候。");
  if(s.life.playerSpace!=="village"&&s.life.playerSpace!=="inn")throw Error("请到旅馆门前或室内柜台办理住宿。");
  if(s.defense.raid)throw Error("村门来袭尚未结束，暂不能住宿。");
  if(safety.action||safety.threat||safety.projectile)throw Error("附近仍有战斗或攻击风险，暂不能住宿。");
  const indoor=s.life.playerSpace==="inn", entrance=indoor?INTERIOR_SERVICE:VILLAGE_ANCHORS.inn;
  if(Math.hypot(s.player.x-entrance.x,s.player.y-entrance.y)>=95||!(indoor?spaceClear("inn",s.player,entrance):clearMotionLine(s.player,entrance,"service-inn")))throw Error("请在旅馆门前办理住宿。");
  if(sequence!==s.economyRevision+1||!Number.isSafeInteger(sequence))throw Error("住宿请求已处理或已过期。");
  const target=nextDawn(s.time);
  if(s.coins<C.sleepCost)throw Error(`铜币不足，住宿需要${C.sleepCost}枚。`);
  const next=validate(s),night=currentNight(s.time)!;
  next.coins-=C.sleepCost;next.player.hp=next.player.stamina=100;next.time=target;next.economyRevision=sequence;
  if(!next.night.plan&&night>=next.night.takeoverNight&&night>=1)next.night.plan=makeNightPlan(s,night);
  if(next.night.plan?.night===night&&next.night.plan.outcome!=="started")next.night.plan.outcome="skipped";
  return validate(next);
}
