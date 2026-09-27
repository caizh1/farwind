import { DAY_NIGHT as C, PHASE_NAMES, LIGHT_KEYS, type DayPhase } from "../../data/dayNight";
export function validTime(time:number) {
  if (!Number.isFinite(time) || time < 0 || time > C.maxTime) throw Error("世界时间无效。");
  return time;
}
export const minuteOfDay = (time:number) => validTime(time) % C.day;
export const dayNumber = (time:number) => Math.floor(validTime(time) / C.day) + 1;
export function phaseAt(time:number):DayPhase {
  const m=minuteOfDay(time);
  return m<C.dawn || m>=C.night ? "night" : m<C.daylight ? "dawn" : m<C.dusk ? "day" : "dusk";
}
// 夜晚编号是开始夜晚的日期；第1日零点以前的夜晚为0。
export function currentNight(time:number):number|null {
  const m=minuteOfDay(time),day=dayNumber(time);
  return m>=C.night ? day : m<C.dawn ? day-1 : null;
}
export const upcomingNight = (time:number) => dayNumber(time);
export const nightStart = (night:number) => (night-1)*C.day+C.night;
export const nightWindowEnd = (night:number) => night*C.day;
export function nextDawn(time:number) {
  const m=minuteOfDay(time);
  if(phaseAt(time)!=="night")throw Error("住宿仅在19:00至06:00前开放。");
  return validTime(time+(m<C.dawn ? C.dawn-m : C.day-m+C.dawn));
}
export function advanceTime(time:number,simulationMs:number) {
  validTime(time);
  if(!Number.isFinite(simulationMs)||simulationMs<0)throw Error("模拟时间增量无效。");
  return validTime(time+simulationMs/1000*C.speed);
}
export function clockLabel(time:number) {
  const m=minuteOfDay(time);
  return `第${dayNumber(time)}日 ${String(Math.floor(m/60)).padStart(2,"0")}:${String(Math.floor(m%60)).padStart(2,"0")} · ${PHASE_NAMES[phaseAt(time)]}`;
}
export function lightAt(time:number) {
  const m=minuteOfDay(time),i=LIGHT_KEYS.findIndex(k=>k.minute>m),a=LIGHT_KEYS[i-1],b=LIGHT_KEYS[i];
  const t=(m-a.minute)/(b.minute-a.minute),smooth=t*t*(3-2*t);
  const mix=(x:number,y:number)=>x+(y-x)*smooth;
  return {color:a.color.map((v,j)=>Math.round(mix(v,b.color[j]))),shade:mix(a.shade,b.shade),lamps:mix(a.lamps,b.lamps)};
}
export type ClockBoundary = {time:number;phase:DayPhase|"midnight"};
// 有界枚举；超长跨度返回每类最后一次边界和跨日数，导演只处理最后一夜。
export function crossedBoundaries(previous:number,next:number):{events:ClockBoundary[];days:number} {
  validTime(previous);validTime(next);
  if(next<previous)throw Error("世界时间不能倒退。");
  const offsets:[[number,ClockBoundary["phase"]],... [number,ClockBoundary["phase"]][]]=[[0,"midnight"],[C.dawn,"dawn"],[C.daylight,"day"],[C.dusk,"dusk"],[C.night,"night"]];
  const first=Math.floor(previous/C.day),last=Math.floor(next/C.day),events:ClockBoundary[]=[];
  for(const [offset,phase]of offsets){
    const begin=Math.max(first,Math.floor((previous-offset)/C.day)+1),end=Math.floor((next-offset)/C.day);
    if(last-first>2){if(end>=begin)events.push({time:end*C.day+offset,phase});}
    else for(let d=begin;d<=end;d++)events.push({time:d*C.day+offset,phase});
  }
  return {events:events.sort((a,b)=>a.time-b.time),days:last-first};
}
