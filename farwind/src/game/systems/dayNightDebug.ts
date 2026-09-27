import {DAY_NIGHT as C} from "../../data/dayNight";
import {clockLabel,minuteOfDay,advanceTime} from "./worldClock";
import {advanceNight} from "./nightDirector";
import type {World} from "../scenes/World";
import {save} from "./save";
// 仅开发模块；入口由DEV分支动态导入，正式构建不包含按钮或可写全局。
export function installClockDebug(world:World){
  const panel=document.createElement("details");panel.id="day-night-debug";
  panel.style.cssText="position:fixed;right:20px;top:140px;display:flex;gap:6px;padding:8px;background:#243c35;pointer-events:auto;max-width:300px;";
  panel.innerHTML='<summary>昼夜测试 · 仅隔离存档</summary><p id="clock-debug-read"></p><div style="display:flex;flex-wrap:wrap;gap:6px"><button data-clock-minute="360">下一黎明</button><button data-clock-minute="480">下一白天</button><button data-clock-minute="1020">下一黄昏</button><button data-clock-minute="1140">下一夜晚</button><button data-clock-minute="1200">下一20点</button><button data-clock-minute="1439.95">临近午夜</button></div>';
  world.ui.root.append(panel);
  const show=()=>{panel.querySelector("p")!.textContent=clockLabel(world.state.time);};show();
  const timer=()=>show();world.events.on("update",timer);
  panel.querySelectorAll<HTMLButtonElement>("[data-clock-minute]").forEach(b=>b.onclick=async()=>{
    if(!world.active||world.economy.busy||world.state.defense.raid)return;
    try{await world.economy.run(()=>world.state,s=>{
      const next=structuredClone(s),minute=Number(b.dataset.clockMinute),current=minuteOfDay(s.time),delta=minute>current?minute-current:C.day-current+minute;
      next.time=advanceTime(s.time,delta/C.speed*1000);advanceNight(next,s.time);return next;
    },save,next=>world.publishState(next));world.keys.clear();world.timeline.reset(performance.now());show();}
    catch(e){world.ui.message((e as Error).message);}
  });
  world.events.once("shutdown",()=>{world.events.off("update",timer);panel.remove();});
}
