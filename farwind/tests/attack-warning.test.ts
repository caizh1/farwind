import {describe,expect,it} from 'vitest';
import {previewWarning,warningProgress,hazardWarningAt,drawDanger,drawHeroDanger,WARNING} from '../src/game/entities/attackWarningView';
import {advanceEnemyAttack,createEnemyAttack,geometryTouches,delayEnemyAttack} from '../src/game/systems/enemyAttack';
import {bossHazardGeometry} from '../src/game/systems/campBossCombat';
import {BOSS_RULES} from '../src/data/maps/windbell/campBosses';
import type {BossHazard} from '../src/game/systems/campBossState';

const empty={blocked:()=>false,clear:()=>true,melee:()=>true};
const hazard=(extra:Partial<BossHazard>={}):BossHazard=>({id:'地刺',owner:'敌人',attempt:0,kind:'circle',point:{x:900,y:700},born:0,activeAt:1000,expires:2000,radius:52,speed:0,damage:20,used:[],...extra});

describe('朱红攻击预警读取正式判定',()=>{
  it('冲刺走廊包含起点与终点接触，带宽沿用真实攻击半径',()=>{
    const a=createEnemyAttack('敌人',1,'boar',0,{x:0,y:0},{x:180,y:0}),before=structuredClone(a),root={x:0,y:0},g=previewWarning(a,root,empty);
    expect(g.a).toEqual({x:29,y:0});expect(g.b).toEqual({x:239,y:0});expect(g.radius).toBe(23);
    for(const p of [{x:180,y:22},{x:260,y:0},{x:60,y:-23}]){expect(geometryTouches(g,p)).toBe(true);expect(advanceEnemyAttack(structuredClone(a),{...root},p,a.activeUntil,empty)).not.toBeNull();}
    expect(geometryTouches(g,{x:180,y:24})).toBe(false);expect(a).toEqual(before);expect(root).toEqual({x:0,y:0});
  });
  it('障碍截断冲刺，预览不穿过墙也不写入取消状态',()=>{
    const a=createEnemyAttack('敌人',1,'boar',0,{x:0,y:0},{x:180,y:0}),space={...empty,blocked:(x:number)=>x>=100,clear:(_a:{x:number},b:{x:number})=>b.x<100},g=previewWarning(a,{x:0,y:0},space);
    expect(g.b.x).toBeCloseTo(129,3);expect(geometryTouches(g,{x:180,y:0})).toBe(false);expect(a.cancelled).toBe(false);expect(a.motionAt).toBe(0);
  });
  it('首领窄扇区冲撞沿实际轨迹形成轮廓，不缩减到起点扇区',()=>{
    const a=createEnemyAttack('首领',1,'boar',0,{x:0,y:0},{x:180,y:0});Object.assign(a,{boss:'crag-tusk',step:300,bossGeometry:{kind:'sector',point:{x:0,y:0},radius:40,halfAngle:.65}});
    const g=previewWarning(a,{x:0,y:0},empty);expect(g.outline).toBeDefined();expect(Math.max(...g.outline!.map(p=>p.x))).toBeCloseTo(340);expect(Math.max(...g.outline!.map(p=>p.y))).toBeCloseTo(Math.sin(.65)*40);
  });
  it('受击延迟平移全部时钟，收拢进度不会继续前进',()=>{
    const a=createEnemyAttack('敌人',1,'boar',0,{x:0,y:0},{x:180,y:0}),before=warningProgress(a.startedAt,a.contactAt,250);delayEnemyAttack(a,400);
    expect(warningProgress(a.startedAt,a.contactAt,650)).toBe(before);
  });
  it('地刺贴身提示只覆盖有效危险区，已命中、过期和圈外都不提示',()=>{
    const h=hazard();expect(hazardWarningAt(h,{x:900,y:700},500)).toBe(1000);expect(hazardWarningAt(h,{x:900,y:700},1200)).toBe(1200);
    expect(hazardWarningAt(h,{x:960,y:700},500)).toBeNull();expect(hazardWarningAt({...h,used:['player']},{x:900,y:700},500)).toBeNull();expect(hazardWarningAt(h,{x:900,y:700},2000)).toBeNull();
  });
  it('扩散环按真实波前预计到达时间，安全中心与已扫过区域不提示',()=>{
    const h=hazard({kind:'ring',radius:240,speed:165,expires:3000});
    expect(hazardWarningAt(h,{x:900,y:700},500)).toBeNull();
    const p={x:1100,y:700},at=hazardWarningAt(h,p,500)!;expect(at).toBeCloseTo(1000+(200-BOSS_RULES.ringInner-BOSS_RULES.ringWidth)/165*1000);expect(geometryTouches(bossHazardGeometry(h,at),p)).toBe(true);
    expect(hazardWarningAt(h,{x:900+BOSS_RULES.ringInner+1,y:700},2900)).toBeNull();
  });
  it('计时收拢不改变危险外圈，红色填充只画在地面层',()=>{
    const calls:Record<string,unknown[][]>={};
    const mock=(name:string):any=>new Proxy({}, {get:(_target,key)=> (...args:unknown[])=>{(calls[name+':'+String(key)]??=[]).push(args);return mocks[name];}});
    const mocks:Record<string,any>={};mocks.edge=mock('edge');mocks.floor=mock('floor');
    const h=hazard(),g=bossHazardGeometry(h,500);drawDanger(mocks.edge,mocks.floor,g,.1,true);drawDanger(mocks.edge,mocks.floor,g,.9,true);
    const rings=calls['edge:strokeCircle'];expect(rings.filter(c=>c[2]===52)).toHaveLength(8);
    expect(rings.filter(c=>c[2]!==52).at(-1)![2]).toBeLessThan(rings.filter(c=>c[2]!==52)[0][2] as number);
    expect(calls['edge:fillPath']).toBeUndefined();expect(calls['floor:fillStyle'][0]).toEqual([WARNING.red,.38]);expect(g.radius).toBe(52);
  });
  it('脚边短弧与方向指针留在地面，头侧气泡单独绘制',()=>{
    const calls:Record<string,number>={},mocks:Record<string,any>={};
    for(const name of ['head','floor'])mocks[name]=new Proxy({}, {get:(_target,key)=>(..._args:unknown[])=>{calls[name+':'+String(key)]=(calls[name+':'+String(key)]??0)+1;return mocks[name];}});
    drawHeroDanger(mocks.head,mocks.floor,{x:790,y:720},{x:850,y:650},300);
    expect(calls['floor:strokePath']).toBeGreaterThan(0);expect(calls['floor:fillPath']).toBeGreaterThan(0);
    expect(calls['head:strokePath']).toBeUndefined();expect(calls['head:fillPath']).toBeUndefined();expect(calls['head:fillCircle']).toBeGreaterThan(0);
  });
});
