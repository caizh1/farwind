import {NpcLife} from "../src/game/systems/npcLife";
import {moveLife,lifeNavigation} from "../src/game/systems/npcNavigation";
import {describe,it,expect} from "vitest";
import {advanceTime,phaseAt,currentNight,upcomingNight,nextDawn,crossedBoundaries,clockLabel,lightAt} from "../src/game/systems/worldClock";
import {initialState,validate,count} from "../src/game/systems/state";
import {advanceNight,nightWarningSnapshot,mayStartNight,makeNightPlan} from "../src/game/systems/nightDirector";
import {discoverySnapshot,canDiscover} from "../src/game/systems/nightDiscovery";
import {sleepSnapshot} from "../src/game/systems/sleep";
import {StateCommit} from "../src/game/systems/stateCommit";
import {EastDefense,prepareRaid} from "../src/game/systems/defense";
import {RAID_GATES} from "../src/data/defense";
const safety={action:false,threat:false,projectile:false,conflict:false};
function planned(night=2){const s=initialState();s.time=(night-1)*1440+1020;advanceNight(s,s.time-1);if(s.night.plan?.outcome==="quiet"&&night>1){s.defense.seed++;s.night.plan=makeNightPlan(s,night);}s.time=s.night.plan!.at;s.defense.protectionMs=s.defense.cooldownMs=0;return s;}
describe("累计世界时间",()=>{
  it.each([[359,360,"dawn"],[479,480,"day"],[1019,1020,"dusk"],[1139,1140,"night"],[1439,1440,"midnight"]])("边界 %s → %s",(a,b,phase)=>{
    expect(crossedBoundaries(a as number,b as number).events).toEqual([{time:b,phase}]);
    expect(crossedBoundaries(b as number,b as number).events).toEqual([]);
  });
  it("午夜不改变当夜编号，日历改变",()=>{expect(currentNight(1439)).toBe(1);expect(currentNight(1440)).toBe(1);expect(currentNight(1800)).toBeNull();expect(upcomingNight(2460)).toBe(2);expect(clockLabel(1440)).toContain("第2日 00:00");});
  it("累计值不截断，零增量和异常",()=>{expect(advanceTime(5000,1000)).toBe(5001.5);expect(advanceTime(480,0)).toBe(480);for(const n of [NaN,Infinity,-1,1e8+1])expect(()=>phaseAt(n)).toThrow();expect(()=>advanceTime(480,-1)).toThrow();expect(()=>crossedBoundaries(5,4)).toThrow();});
  it("跨多边界与巨大跨度有界",()=>{expect(crossedBoundaries(359,1440).events).toHaveLength(5);expect(crossedBoundaries(0,1e8).events.length).toBeLessThanOrEqual(5);});
  it.each([[1260,1800],[1620,1800],[1799,1800],[1140,1800]])("睡眠目标%s",(t,target)=>expect(nextDawn(t)).toBe(target));
  it("06:00不可住宿",()=>expect(()=>nextDawn(1800)).toThrow());
  it("午夜与关键帧连续",()=>{expect(lightAt(1440)).toEqual(lightAt(0));expect(Math.abs(lightAt(1439.999).shade-lightAt(1440).shade)).toBeLessThan(.001);for(const t of [360,480,1020,1140,1200])expect(Math.abs(lightAt(t-.001).shade-lightAt(t+.001).shade)).toBeLessThan(.001);});
});
describe("夜间许可与存档",()=>{
  it.each([[180,1],[720,1],[1020,2],[1260,2],[1620,2]])("旧档%s从下一次黄昏接管",(time,takeover)=>{const s:any=initialState();s.schema_version=4;delete s.night;s.time=time;const n=validate(s);expect(n.night.takeoverNight).toBe(takeover);expect(n.night.plan).toBeNull();const dusk=(takeover-1)*1440+1020;n.time=dusk;advanceNight(n,dusk-1);expect(n.night.plan?.night).toBe(takeover);expect(validate(n)).toEqual(n);});
  it("第一夜安静，同时间处理不重抽",()=>{const s=planned(1),p=structuredClone(s.night.plan);expect(p!.outcome).toBe("quiet");advanceNight(s,s.time);expect(s.night.plan).toEqual(p);expect(mayStartNight(s)).toBe(false);});
  it.each(RAID_GATES.map(g=>g.id))("%s正式预警、午夜不重刷与黎明不删事件",gate=>{const s=planned();s.night.plan!.outcome="pending";s.night.plan!.gate=gate;s.night.plan!.count=2;const next=validate(nightWarningSnapshot(s));expect(next.night.plan!.raidSequence).toBe(1);expect(s.defense.raid).toBeNull();expect(mayStartNight(next)).toBe(false);const d=new EastDefense(next.defense,0);expect(d.enemies).toEqual([]);d.update(3000,3000,next.player,{queries:2});expect(d.enemies).toHaveLength(2);next.time=2880;advanceNight(next,2879);expect(next.defense.raid).not.toBeNull();next.time=3240;advanceNight(next,3239);expect(next.defense.raid).not.toBeNull();expect(validate(next).night).toEqual(next.night);});
  it("保护、冷却、人口、视口、近身与占用拒绝，同一计划保留",()=>{const s=planned();s.night.plan!.outcome="pending";s.night.plan!.count=2;s.defense.protectionMs=1;expect(mayStartNight(s)).toBe(false);s.defense.protectionMs=0;s.defense.cooldownMs=1;expect(mayStartNight(s)).toBe(false);s.defense.cooldownMs=0;const p=structuredClone(s.night.plan);expect(()=>nightWarningSnapshot(s,{left:0,right:4200,top:0,bottom:2200})).toThrow();expect(()=>nightWarningSnapshot(s,undefined,Array(24).fill(s.player))).toThrow();const spawn=RAID_GATES.find(g=>g.id===p!.gate)!.spawns[0];expect(()=>nightWarningSnapshot(s,undefined,RAID_GATES.map(g=>g.spawns[0]))).toThrow();s.player={...s.player,...spawn};expect(nightWarningSnapshot(s).defense.raid!.gateId).not.toBe(p!.gate);expect(s.night.plan).toEqual(p);});
  it("窗口截止取消，加载不重抽，演练不消费夜额度",()=>{const s=planned();s.night.plan!.outcome="pending";s.time=2880;advanceNight(s,2879);expect(s.night.plan!.outcome).toBe("cancelled");const v=validate(s);expect(validate(v)).toEqual(v);s.defense=prepareRaid(s.defense,{x:670,y:720},"east-gate",2);expect(s.night.plan!.outcome).toBe("cancelled");});
  it.each([1,2,3,4])("结构%s迁移时间/经济/守卫，重复幂等",version=>{const s:any=initialState();s.schema_version=version;s.time=1260;s.bag[0]={id:"herb",count:7};if(version===3){s.defense.guards=s.defense.guards.slice(0,3);for(const k of ["protectionMs","cooldownMs","retryMs","seed"])delete s.defense[k];}if(version>=3)Object.assign(s.defense.guards[0],{hp:0,dead:true,mode:"dead"});delete s.night;const v=validate(s);expect(v.schema_version).toBe(6);expect(v.time).toBe(1260);expect(v.bag[0]).toEqual(s.bag[0]);expect(v.night.takeoverNight).toBe(2);expect(v.night.plan).toBeNull();if(version>=3)expect(v.defense.guards[0].dead).toBe(true);expect(validate(v)).toEqual(v);});
  it("当前版本缺字段及计划非法拒绝",()=>{const s:any=initialState();delete s.night;expect(()=>validate(s)).toThrow();for(const mutate of [(s:any)=>s.night.takeoverNight=NaN,(s:any)=>s.night.plan.at=2880,(s:any)=>s.night.plan.count=5,(s:any)=>{s.night.plan.outcome="started";s.night.plan.raidSequence=99;}]){const p=planned();mutate(p);expect(()=>validate(p)).toThrow();}});
  it("当前计划与发生时间不一致不能作为旧档重置",()=>{
    const p=planned();p.time=2459;expect(()=>validate(p)).toThrow();
    for(const outcome of ["cancelled","skipped"]as const){const s=planned();s.night.plan!.outcome=outcome;expect(()=>validate(s)).toThrow();}
    const s=planned();s.night.plan!.outcome="pending";const started=nightWarningSnapshot(s);started.time=started.night.plan!.at-1;expect(()=>validate(started)).toThrow();
  });
  it("旧档带活跃来袭保留，迁入当夜不安排",()=>{const s:any=initialState();s.schema_version=4;delete s.night;s.time=1260;s.defense=prepareRaid(s.defense,s.player,"east-gate",2);const v=validate(s);expect(v.defense.raid).toEqual(s.defense.raid);expect(v.night.plan).toBeNull();v.time=1261;advanceNight(v,1260);expect(v.night.plan).toBeNull();});
});
describe("探索和原子住宿",()=>{
  it("短提交和写失败都同步完成钩子，竞争请求不清在途输入",async()=>{
    const s=initialState(),events:string[]=[],c=new StateCommit(()=>events.push("开始"),()=>events.push("结束"));let release!:()=>void;
    const p=c.run(()=>s,x=>x,()=>new Promise<void>(r=>release=r),()=>events.push("发布"));expect(events).toEqual(["开始"]);
    await expect(c.run(()=>s,x=>x,async()=>{},()=>{})).rejects.toThrow();expect(events).toEqual(["开始"]);release();await p;expect(events).toEqual(["开始","发布","结束"]);
    await expect(c.run(()=>s,x=>x,async()=>{throw Error("测试写失败");},()=>{})).rejects.toThrow();expect(events.slice(-2)).toEqual(["开始","结束"]);expect(c.busy).toBe(false);
  });
  it("满包不丢奖励，重复领取及导出导入不能复领",()=>{const s=initialState();s.time=1260;s.player.x=1330;s.player.y=1470;s.bag=Array.from({length:24},()=>({id:"wood" as const,count:20}));expect(canDiscover(s)).toBe(true);expect(()=>discoverySnapshot(s)).toThrow();expect(s.night.discovered).toBe(false);s.bag[0]=null;const next=discoverySnapshot(s);expect(count(next,"potion")).toBe(1);expect(()=>discoverySnapshot(validate(JSON.parse(JSON.stringify(next))))).toThrow();});
  it("白天、远处或阻挡无法领取",()=>{const s=initialState();expect(canDiscover(s)).toBe(false);s.time=1260;expect(()=>discoverySnapshot(s)).toThrow();});
  it.each([1260,1620,1799,1140])("%s满状态可住宿，守卫与有效计时不变",time=>{const s=initialState();s.time=time;s.player.x=1685;s.player.y=1680;const n=sleepSnapshot(s,1,safety);expect(n.time).toBe(1800);expect(n.coins).toBe(s.coins-12);expect(n.defense).toEqual(s.defense);expect(n.bag).toEqual(s.bag);expect(n.quest).toBe(s.quest);expect(()=>sleepSnapshot(n,1,safety)).toThrow();});
  it("06点、穷、战斗、投射物、活跃来袭拒绝",()=>{for(const configure of [(s:ReturnType<typeof initialState>)=>s.time=1800,s=>s.coins=0,s=>s.defense=prepareRaid(s.defense,{x:670,y:720},"east-gate",2)]){const s=initialState();s.time=1260;s.player.x=1685;s.player.y=1680;configure(s);const before=structuredClone(s);expect(()=>sleepSnapshot(s,1,safety)).toThrow();expect(s).toEqual(before);}for(const key of Object.keys(safety)){const s=initialState();s.time=1260;s.player.x=1685;s.player.y=1680;expect(()=>sleepSnapshot(s,1,{...safety,[key]:true})).toThrow();}});
  it("同步帧尾驻防死亡进度在快照前收齐，副本发布不丢失",async()=>{
    let s=initialState();const c=new StateCommit(),stored:ReturnType<typeof initialState>[]=[];
    const pending=c.run(()=>s,x=>{const next=structuredClone(x);next.night.discovered=true;return next;},async x=>{stored.push(structuredClone(x));},x=>{s=x;});
    expect(c.busy).toBe(true);s.killed.push("slime-1");s.side=2;
    await pending;expect(stored[0].killed).toEqual(["slime-1"]);expect(s.killed).toEqual(["slime-1"]);expect(s.side).toBe(2);expect(s.night.discovered).toBe(true);expect(c.busy).toBe(false);
  });
  it("未开始计划跳过，保存失败/双击/旧自动保存交错不能发布",async()=>{let s=planned();s.night.plan!.outcome="pending";s.player.x=1685;s.player.y=1680;const before=structuredClone(s),c=new StateCommit();await expect(c.run(()=>s,x=>sleepSnapshot(x,1,safety),async()=>{throw Error("模拟写失败");},next=>s=next)).rejects.toThrow();expect(s).toEqual(before);let release!:()=>void;const p=c.run(()=>s,x=>sleepSnapshot(x,1,safety),()=>new Promise<void>(r=>release=r),next=>s=next);await expect(c.run(()=>s,x=>x,async()=>{},next=>s=next)).rejects.toThrow();release();await p;expect(s.night.plan!.outcome).toBe("skipped");expect(s.coins).toBe(before.coins-12);expect(s.time).toBe(3240);expect(validate(s)).toEqual(s);});
});

it("营房共用出口重叠可逐步分离返岗，不进入新的同伴重叠",()=>{
 const body={space:"village" as const,x:1995,y:650},peer={...body},nav=lifeNavigation();
 for(let n=1;n<=120&&Math.hypot(body.x-peer.x,body.y-peer.y)===0;n++)moveLife(body,{space:"village",x:2010,y:970},50,n*50,{queries:2},nav,()=>true,[peer]);
 expect(Math.hypot(body.x-peer.x,body.y-peer.y)).toBeGreaterThan(0);
 const a={space:"village" as const,x:670,y:720},b={space:"village" as const,x:690,y:720};
 moveLife(a,{space:"village",x:740,y:720},50,50,{queries:2},lifeNavigation(),()=>true,[b]);expect(a.x).toBe(670);
});

// 实际生活日程21点允许弓手赏夜；pending计划必须先召回才能提交正式预警。
it.each(RAID_GATES.map(g=>g.id))("%s计划先召回轮休，避免在岗准入与正式预警循环依赖",gate=>{
 const s=planned();s.night.plan!.outcome="pending";s.night.plan!.gate=gate;s.night.plan!.count=2;s.time=Math.max(s.time,2700);
 const d=new EastDefense(s.defense,0),l=new NpcLife(s,d),id=gate.split("-")[0]+"-archer",g=s.defense.guards.find(g=>g.id===id)!,n=s.life.people.find(n=>n.id===id)!;
 l.decide(n);expect(g.offDuty).not.toBe(true);expect(l.guardAlert(g.id)).toBe(true);
 d.leaveGuard(g.id);l.decide(n);expect(g.mode).toBe("return");
 for(let i=0;i<50;i++){d.update(i*100,100,s.player,{queries:2});l.step(100,{queries:2});}
 expect(g.offDuty).toBe(false);expect(d.canScheduleAtGate(gate,s.player,RAID_GATES.find(g=>g.id===gate)!.spawns.slice(0,2))).toBe(true);
 s.night.plan!.outcome="quiet";expect(l.guardAlert(g.id)).toBe(false);
});
