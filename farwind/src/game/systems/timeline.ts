import type { CombatController } from "./combat";
import type { InputEvent } from "./input";
export const TIMELINE = {frameLimit:50,quantum:5} as const;
type Hooks={boundary:(now:number)=>number;advance:(prev:number,now:number)=>void;input:(events:InputEvent[],now:number)=>void;resolve:(now:number)=>void};
// 顺序推进，不回滚。墙钟预算同时承载模拟和停顿，输入在接触同刻先提交。
export class CombatTimeline {
  wall=0;
  reset(wall:number) {this.wall=wall;}
  frame(sim:number,wall:number,delta:number,events:InputEvent[],c:CombatController,hooks:Hooks) {
    const span=Math.max(0,wall-this.wall),budget=Math.min(TIMELINE.frameLimit,Math.max(0,delta));
    const queued=[...events].sort((a,b)=>a.at-b.at||a.sequence-b.sequence).map(e=>({e,offset:span?Math.max(0,Math.min(budget,(e.at-this.wall)/span*budget)):0}));
    this.wall=wall;
    let spent=0,index=0;
    const inputs=()=>{
      const batch:InputEvent[]=[];
      while(index<queued.length&&queued[index].offset<=spent+1e-7)batch.push(queued[index++].e);
      if(batch.length)hooks.input(batch,sim);
      hooks.resolve(sim);
    };
    inputs();
    for(let guard=0;guard<10000&&spent<budget-1e-7;guard++) {
      const nextInput=queued[index]?.offset??budget;
      const available=Math.max(0,Math.min(budget,nextInput)-spent);
      if(available<1e-7){spent=nextInput;inputs();continue;}
      if(c.hitStopRemaining>0) {
        const frozen=Math.min(available,c.hitStopRemaining);
        c.advanceFrame(frozen);
        spent+=frozen;
        inputs();
        continue;
      }
      const grid=(Math.floor((sim+1e-7)/TIMELINE.quantum)+1)*TIMELINE.quantum;
      const to=Math.min(sim+available,grid,hooks.boundary(sim));
      if(!(to>sim+1e-7))throw Error("战斗时间轴没有向前推进");
      const prev=sim;
      sim=to;
      spent+=to-prev;
      hooks.advance(prev,sim);
      inputs();
    }
    return sim;
  }
}
