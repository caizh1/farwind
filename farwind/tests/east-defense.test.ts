import { describe, it, expect } from "vitest";
import { GUARD_DEFS, EAST_TOWER, DEFENSE } from "../src/data/defense";
import { initialState, validate } from "../src/game/systems/state";
import { EastDefense, prepareEastRaid } from "../src/game/systems/defense";
import { initialDefense, validateDefense } from "../src/game/systems/defenseState";
import { resolveDamage } from "../src/game/systems/damage";
import { motionBlocked, clearMotionLine, shotLineBlocker } from "../src/game/systems/obstacles";
const player = { x: 670, y: 720, hp: 100 };
function run(d: EastDefense, ms: number, p = player) {
  for (let now=d.now+5,end=d.now+ms;now<=end;now+=5) {
    const contacts=d.update(now,5,p,{queries:now%50===0?2:0});
    // 本组玩家不参与，远处没有玩家接触。
    if(p===player)expect(contacts).toEqual([]);
  }
}
describe("东门真实模拟与数据边界",()=>{
  it("登记三名单位和塔基，门柱与中央通路独立",()=>{
    expect(new Set(GUARD_DEFS.map(d=>d.id)).size).toBe(12);
    for(const d of GUARD_DEFS.filter(d=>d.role==="melee"))expect(motionBlocked(d.post.x,d.post.y)).toBe(false);
    expect(motionBlocked(EAST_TOWER.x,EAST_TOWER.y)).toBeTruthy();
    expect(clearMotionLine({x:1950,y:1080},{x:2280,y:1080})).toBe(true);
  });
  it("玩家离屏，一组普通怪可被自主击退，没有写主线或奖励",()=>{
    const s=initialState(),old=structuredClone(s);
    s.defense=prepareEastRaid(s.defense,player);
    const d=new EastDefense(s.defense,0);run(d,45000);
    expect(d.state.raid).toBeNull();expect(d.state.completedSequence).toBe(1);
    expect(d.state.guards.every(g=>!g.dead&&g.hp>0)).toBe(true);
    expect(d.history.some(e=>e.kind==="shot")).toBe(true);
    expect([s.quest,s.killed,s.bag,s.coins,s.pendingDrops]).toEqual([old.quest,old.killed,old.bag,old.coins,old.pendingDrops]);
    expect(()=>validate(s)).not.toThrow();
  });
  it("重入、近身生成和序号错误被拒绝",()=>{
    const s=initialDefense();
    expect(()=>prepareEastRaid(s,{x:2400,y:1100})).toThrow("近身");
    expect(()=>prepareEastRaid(prepareEastRaid(s,player),player)).toThrow("已有");
    expect(()=>validateDefense({...s,sequence:1})).toThrow();
  });
  it("受伤低血真实后撤、脱战8秒后缓慢恢复，死者不回血",()=>{
    const s=initialDefense(),g=s.guards[0];g.hp=50;
    const d=new EastDefense(s,0),old={x:g.x,y:g.y};run(d,4000);
    expect(Math.hypot(g.x-old.x,g.y-old.y)).toBeGreaterThan(30);expect(g.hp).toBe(50);
    run(d,5000);expect(g.hp).toBeGreaterThan(50);expect(g.hp).toBeLessThan(54);
    const enemy={id:"test-hostile",hp:100};
    const ev={sourceId:enemy.id,targetId:g.id,attackId:"fatal:1",amount:1000,sourceType:"enemy-melee" as const,eventId:"test"};
    expect(d.damageGuard(ev,enemy)).toBe(true);expect(g.hp).toBe(0);expect(g.dead).toBe(true);
    expect(d.damageGuard(ev,enemy)).toBe(false);run(d,15000);
    expect(g.hp).toBe(0);expect(d.history.filter(e=>e.kind==="death"&&e.id===g.id)).toHaveLength(1);
    const restored=new EastDefense(validateDefense(s),0);run(restored,12000);
    expect(restored.state.guards[0].dead).toBe(true);expect(restored.state.guards[0].hp).toBe(0);
  });
  it("单入口关闭友伤并要求实际敌对来源和目标",()=>{
    const a={id:"player",faction:"village" as const,hp:100,armor:0},b={id:"guard",faction:"village" as const,hp:10,armor:6};
    const e={sourceId:a.id,targetId:b.id,attackId:"1",amount:18,sourceType:"player-melee" as const,eventId:null};
    expect(resolveDamage(e,a,b)).toEqual({applied:false,damage:0,hp:10,killed:false});
    expect(resolveDamage({...e,sourceId:"bad"},a,{...b,faction:"hostile"})).toHaveProperty("applied",false);
    expect(resolveDamage(e,a,{...b,faction:"hostile"})).toMatchObject({applied:true,damage:12,hp:0,killed:true});
  });
  it("弓手死亡后不再射击，离岗也不产生隐形炮台",()=>{
    const s=prepareEastRaid(initialDefense(),player),d=new EastDefense(s,0),archer=s.guards[2];
    d.damageGuard({sourceId:"hostile",targetId:archer.id,attackId:"fatal",amount:1000,sourceType:"enemy-melee",eventId:s.raid!.id},{id:"hostile",hp:1});
    run(d,20000);expect(d.arrows).toEqual([]);expect(d.history.filter(e=>e.kind==="shot")).toEqual([]);
    const live=new EastDefense(prepareEastRaid(initialDefense(),player),0);
    live.state.guards[2].x-=20;run(live,2000);
    expect(live.history.filter(e=>e.kind==="shot")).toEqual([]);
  });
  it("已放出的箭具有飞行时间、单次命中与寿命，重载不补箭伤",()=>{
    const s=prepareEastRaid(initialDefense(),player),d=new EastDefense(s,0),e=d.enemies[0],g=s.guards[2];
    Object.assign(e,{x:2260,y:1090});d.sync();d.fire(g,e,"arrow-test");expect(d.arrows).toHaveLength(1);expect(e.hp).toBe(48);
    d.updateArrows(1);expect(e.hp).toBe(48);expect(d.arrows[0].travelled).toBeGreaterThan(0);
    const reload=new EastDefense(validateDefense(s),0);expect(reload.arrows).toEqual([]);expect(reload.enemies[0].hp).toBe(48);
    d.updateArrows(1500);expect(e.hp).toBe(26);expect(d.arrows).toEqual([]);
    d.updateArrows(1500);expect(e.hp).toBe(26);
    d.fire(g,d.enemies[1],"expired");d.updateArrows(DEFENSE.arrowLife+1);expect(d.arrows).toEqual([]);
  });
  it("发射口越过登记低挡，屋顶与高柱仍阻挡，不接受任意起点豁免",()=>{
    const low={id:"low",art:"fence",x:2300,y:900,w:100,h:70,solid:[40,30] as [number,number],cover:"low" as const,owner:"village"};
    const roof={id:"roof",art:"house",x:2400,y:1040,w:100,h:180,solid:[80,35] as [number,number],cover:"high" as const};
    const a={x:2200,y:890},b={x:2500,y:890},port={origin:a,lowCoverIds:["low","roof"]};
    expect(shotLineBlocker(a,b,port,[low])).toBeUndefined();
    expect(shotLineBlocker(a,b,port,[low,roof])).toBe("roof");
    expect(shotLineBlocker({...a,x:a.x+10},b,port,[low])).toBe("low");
  });
  it("旧结构2只补驻防，不重复发钱，新结构缺字段或复活矛盾拒绝",()=>{
    const old:any=initialState();old.schema_version=2;old.skills={swordWind:false};old.map_version=4;old.coins=17;old.equipment.weapon="ironSword";delete old.defense;
    const next=validate(old);expect([next.schema_version,next.map_version,next.coins]).toEqual([16,8,17]);
    expect(next.equipment.weapon).toBe("ironSword");expect(validate(next)).toEqual(next);
    const g=next.defense.guards[0];g.hp=0;g.dead=true;g.mode="dead";
    expect(validate(next).defense.guards[0].dead).toBe(true);
    expect(()=>validate({...next,defense:undefined})).toThrow();
    expect(()=>validateDefense({...next.defense,guards:next.defense.guards.map(x=>({...x,dead:false}))})).toThrow();
  });
});
