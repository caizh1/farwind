import {describe,it,expect} from 'vitest';
import {CombatController,attackConfig,isWindAttack,STRIKES,type Attack} from '../src/game/systems/combat';
import {SwordWindSystem,type WindMotion} from '../src/game/systems/swordWind';
import {resolveSwordWindConfig,SWORD_WIND} from '../src/data/swordWind';
import {initialState,validate} from '../src/game/systems/state';
import {completeWindLesson} from '../src/game/systems/skills';
import {runeSnapshot,momentumConfig,returnMode} from '../src/game/systems/runeState';
import {RuneCombat,type RuneContext,type RuneEvent} from '../src/game/systems/runeCombat';
import {Input} from '../src/game/systems/input';
import {firstRectContact} from '../src/game/systems/swordWindGeometry';
import {combatVisual,swordWindVisual} from '../src/data/animation';
const safe={combat:false,boss:false,defense:false,trial:false,story:false,action:false};
const motion=(id:string,x:number,y=0):WindMotion=>({target:{id,x,y,hp:10000},previous:{x,y},current:{x,y}});
const shot=(stage:1|2|3|4|5=1,mode:'path'|'anchor'|undefined='path'):Attack=>({id:1,rootActionId:1,kind:'swordWind',delivery:'wind',stage:1,facing:3,start:0,hit:new Set(),isFinisher:false,config:{...SWORD_WIND.strike},swordWind:resolveSwordWindConfig(stage),returnMode:mode});
function arena(four=false){
 const c=new CombatController();c.meleeFinisherEnabled=four;c.swordWindEnabled=true;
 const p={x:0,y:0,stamina:100},starts:Attack[]=[],hits:Attack[]=[],releases:Attack[]=[];
 const tick=(a:number,b:number)=>c.update(a,b,3,p,[{id:'木桩',x:60,y:0,hp:10000}],()=>false,()=>true,(_,__,x)=>hits.push(x),(_,x)=>starts.push(x),()=>{},()=>true,x=>releases.push(x));
 return {c,p,starts,hits,releases,tick};
}
describe('无槽永久本领与动作来源',()=>{
 it('四刀均有独立有效命中，只有第四刀终结，不发剑风',()=>{
  const a=arena(true);a.c.requestAttack(0);a.tick(0,0);a.c.requestAttack(150);a.tick(0,235);a.c.requestAttack(385);a.tick(235,500);a.c.requestAttack(860);a.tick(500,1600);
  expect(a.starts.map(x=>x.stage)).toEqual([1,2,3,4]);expect(a.hits.map(x=>x.stage)).toEqual([1,2,3,4]);expect(a.releases).toHaveLength(0);
  expect(a.starts.filter(x=>x.isFinisher).map(x=>x.stage)).toEqual([4]);expect(new Set(a.starts.map(x=>x.rootActionId)).size).toBe(4);
  expect(STRIKES[3].stagger).toBeGreaterThan(STRIKES[2].stagger);expect(combatVisual(4,3,250).clip).toContain('melee-finisher');
 });
 it('剑风在第一输入独立发射，无近战充能、无体力消耗，可持续单体施放',()=>{
  const a=arena();a.c.windHeld=true;a.c.requestSwordWind(0);for(let t=0;t<10000;t+=5)a.tick(t,t+5);
  expect(a.releases.length).toBe(25);expect(a.hits).toHaveLength(0);expect(a.p.stamina).toBe(100);expect(a.starts.every(x=>x.kind==='swordWind'&&!x.isFinisher)).toBe(true);
  expect(swordWindVisual(3,110,attackConfig(a.starts[0])).texture).toBe('hero-sword-wind');
 });
 it('松开、失焦或界面清理不累积补发，受击清理，取消不重复释放',()=>{
  const a=arena();a.c.windHeld=true;a.tick(0,100);a.c.windHeld=false;a.tick(100,800);expect(a.releases).toHaveLength(1);
  a.c.windHeld=true;a.tick(800,810);a.c.clearInputs('失焦',810);a.tick(810,4000);expect(a.releases).toHaveLength(2);
  a.c.windHeld=true;a.c.takeHit(4000,3,{x:1,y:0},a.p);a.tick(4000,5000);expect(a.c.windHeld).toBe(false);expect(a.releases).toHaveLength(2);
 });
 it('剑风命中停顿按显式32毫秒，四连终结仍为68毫秒',()=>{
  const c=new CombatController();c.stopOnHit(1,1,32);expect(c.hitStopRemaining).toBe(32);c.advanceFrame(32);c.stopOnHit(4,2);expect(c.hitStopRemaining).toBe(68);
 });
 it('键盘重复只请求一次，独立键与鼠标请求等价，松开携带持续状态',()=>{
  const i=new Input(null,()=>0);i.keyDown('i');i.keyDown('i',true);expect(i.drain().map(x=>x.kind)).toEqual(['wind']);expect(i.windHeld()).toBe(true);i.keyUp('i');expect(i.drain()[0].windHeld).toBe(false);
  i.request('wind');expect(i.drain()[0].kind).toBe('wind');i.keyDown('i');i.clear();expect(i.windHeld()).toBe(false);
 });
 it.each([5,16,33,50])('同时间线步长%s的独立施放次数和释放时间一致',step=>{
  const a=arena();a.c.windHeld=true;for(let t=0;t<2400;t+=step)a.tick(t,Math.min(2400,t+step));expect(a.releases.map(x=>x.start)).toEqual([0,400,800,1200,1600,2000]);
 });
});
describe('续势的有限连段保留',()=>{
 function second(){const a=arena(true);a.c.momentumWindow=700;a.c.recoveryCancelEnabled=true;a.c.requestAttack(0);a.tick(0,0);a.c.requestAttack(150);a.tick(0,235);a.tick(235,445);return a;}
 it('有效第二刀后合法风步接第三刀，同连段只用一次，终结只一次',()=>{
  const a=second();expect(a.c.requestDash(445,100,{x:0,y:1},3)).toBe(true);expect(a.c.momentum?.stage).toBe(3);
  a.c.requestAttack(645);a.tick(445,645);expect(a.c.attack).toMatchObject({stage:3,resumed:true,comboId:1});a.tick(645,920);
  expect(a.c.requestDash(1095,100,{x:0,y:-1},3)).toBe(true);expect(a.c.momentum).toBeNull();
 });
 it('未完成有效期不能保留、连续风步或超时或受击清理',()=>{
  const a=arena(true);a.c.momentumWindow=700;a.c.requestAttack(0);a.tick(0,80);expect(a.c.requestDash(80,100,{x:1,y:0},3)).toBe(false);expect(a.c.momentum).toBeNull();
  const b=second();b.c.requestDash(445,100,{x:0,y:1},3);b.tick(445,1400);b.c.requestAttack(1400);b.tick(1400,1400);expect(b.c.attack?.stage).toBe(1);
  const d=second();d.c.requestDash(445,100,{x:0,y:1},3);d.c.takeHit(500,3,{x:1,y:0},d.p);expect(d.c.momentum).toBeNull();
 });
 it('未装备分支失效，两个分支改变窗口／位移且不能穿阻挡',()=>{
  const s=initialState();s.runes.owned=['r33'];s.runes.growth.r33={advanced:true,branch:'chase'};
  expect(momentumConfig(s)).toEqual({window:0,chase:0});s.runes.slots[0]='r33';expect(momentumConfig(s)).toEqual({window:700,chase:32});s.runes.growth.r33.branch='calm';expect(momentumConfig(s)).toEqual({window:1100,chase:0});
  const a=arena(true);a.c.momentum={stage:3,comboId:1,until:1000,chase:32};a.c.requestAttack(0);
  a.c.update(0,0,3,a.p,[],x=>x>=12,()=>true,()=>{},()=>{});expect(a.p.x).toBeLessThan(12);expect(a.c.invulnerable(0)).toBe(false);
 });
});
describe('回风的几何、来源与去重',()=>{
 it.each([1,2,3,4,5] as const)('第%s阶保留学习参数，各程各目标最多一次，多分束共享去重',stage=>{
  const sys=new SwordWindSystem(),a=shot(stage);sys.launch(a,{x:0,y:0},110,36);const t=motion('高血量',120);
  for(let n=110;n<1400;n+=5)sys.advance(n,n+5,[t],()=>null);
  const hit=sys.events.filter(x=>x.target?.id==='高血量');expect(hit.map(x=>x.wind.leg)).toEqual(['out','back']);expect(hit.map(x=>x.wind.config.damage)).toEqual([36,21.599999999999998]);expect(hit.every(x=>x.wind.rootActionId===1)).toBe(true);expect(sys.winds).toHaveLength(0);
 });
 it.each([1,2] as const)('第%s阶回风同帧多目标不提前获得穿透',stage=>{
  const sys=new SwordWindSystem();sys.launch(shot(stage),{x:0,y:0},110,36);
  const targets=[motion('甲',110),motion('乙',170),motion('丙',230)];
  sys.advance(110,1200,targets,()=>null);
  expect(sys.events.filter(e=>e.target&&e.wind.leg==='out')).toHaveLength(stage);
  expect(sys.events.filter(e=>e.target&&e.wind.leg==='back')).toHaveLength(stage);
 });
 it('原路和锁定玩家路线不同，回程不追随移动，穿墙仍截断',()=>{
  const sys=new SwordWindSystem();let anchor={x:0,y:100};sys.returnAnchor=()=>({...anchor});sys.launch(shot(3,'anchor'),{x:0,y:0},110,36);sys.advance(110,460,[],()=>null);const back=sys.winds.find(x=>x.leg==='back')!;expect(back.direction.y).toBeGreaterThan(0);const direction={...back.direction};anchor={x:500,y:500};sys.advance(460,465,[],()=>null);expect(back.direction).toEqual(direction);
  const blocked=new SwordWindSystem();blocked.launch(shot(3),{x:0,y:0},110,36);const behind=motion('墙后',220);for(let t=110;t<1000;t+=5)blocked.advance(t,t+5,[behind],(a,b,r)=>{const q=firstRectContact(a,b,{left:160-r,right:170+r,top:-100,bottom:100});return q===null?null:{t:q};});expect(blocked.events.some(x=>x.target)).toBe(false);
 });
 it.each([5,16,33,50,400])('步长%s回风接触时刻保持一致',step=>{
  const sys=new SwordWindSystem();sys.launch(shot(),{x:0,y:0},110,36);for(let t=110;t<900;t+=step)sys.advance(t,Math.min(900,t+step),[motion('单体',120)],()=>null);
  const hits=sys.events.filter(x=>x.target);expect(hits).toHaveLength(2);const ref=new SwordWindSystem();ref.launch(shot(),{x:0,y:0},110,36);ref.advance(110,900,[motion('单体',120)],()=>null);hits.forEach((x,i)=>expect(x.at).toBeCloseTo(ref.events.filter(x=>x.target)[i].at,6));expect(hits[1].at).toBeGreaterThan(hits[0].at);expect(sys.events.filter(x=>x.kind==='hit')).toHaveLength(2);
 });
 it('近战第四刀不能启动投射物；反击、复制与潮浪不会产生回风',()=>{
  const sys=new SwordWindSystem();expect(sys.launch({...shot(),kind:'melee',delivery:'blade',stage:4},{x:0,y:0},0,40)).toBeNull();
  sys.launch({...shot(),kind:'counter',primaryTarget:'敌',counter:'perfect'},{x:0,y:0},0,30);expect(sys.winds[0].returnMode).toBeUndefined();
 });
});
describe('符文原生、派生、终结和迁移门禁',()=>{
 function runes(slots:string[]){const state=initialState();state.runes.owned=slots;state.runes.slots=[...slots,...Array(5-slots.length).fill(null)];const target={id:'靶',x:120,y:0,hp:10000},events:RuneEvent[]=[];
  const ctx:RuneContext={state:()=>state,targets:()=>[target],A:()=>18,clear:()=>true,blocker:()=>null,visible:()=>true,damage:(_,e)=>{events.push(e);return {applied:true,damage:e.amount,killed:false};},push:()=> 'immune',sound:()=>{},checkpoint:()=>{}};
  return {state,target,events,engine:new RuneCombat(ctx)};
 }
 it('三连末段迁移到四连，独立剑风与回程不触发终结，按施放计数只一次',()=>{
  const a=runes(['r12','r19']);const e3=a.engine.native('第3刀',a.target,30,3,false,false);a.engine.nativeLanded(a.target,e3,30);expect(a.engine.projectiles).toHaveLength(0);
  const e4=a.engine.native('第4刀',a.target,40,4,false,true);a.engine.nativeLanded(a.target,e4,40);expect(a.engine.projectiles).toHaveLength(1);
  for(const leg of ['out','back'])a.engine.nativeLanded(a.target,a.engine.native('剑风',a.target,36,1,true,false,leg),36);
  expect(a.engine.projectiles).toHaveLength(1);expect(a.state.runes.counts.r19).toBe(3);
 });
 it('留痕独立可用，同去程不自触发，后续或回返消费一次，无递归并数量有界',()=>{
  const a=runes(['r32']);const ev=a.engine.native('attack:1',a.target,36,1,true);a.engine.nativeLanded(a.target,ev,36);expect(a.engine.traces).toHaveLength(1);
  const sys=new SwordWindSystem();sys.launch(shot(3,undefined),{x:0,y:0},0,36);sys.advance(0,150,[motion('靶',120)],()=>null);const w=sys.winds[0];a.engine.tracePass(w);expect(a.engine.traces).toHaveLength(1);
  w.rootActionId=2;a.engine.tracePass(w);expect(a.engine.traces).toHaveLength(0);expect(a.events[0].tags).toEqual(['trace_hit']);expect(a.events[0].procDepth).toBe(1);a.engine.tracePass(w);expect(a.events).toHaveLength(1);
  for(let n=2;n<30;n++)a.engine.nativeLanded(a.target,a.engine.native('attack:'+n,a.target,36,1,true),36);expect(a.engine.traces).toHaveLength(8);a.engine.advance(4001);expect(a.engine.traces).toHaveLength(0);
 });
 it('旧档幂等迁移不发奖、不伪造四连，技能、五槽及进度原样保留；一次补领',()=>{
  const original:any=completeWindLesson(initialState(),'windLessonResolved');original.schema_version=14;delete original.skills.meleeFinisher;delete original.skills.buildLessons;original.runes.version=1;delete original.runes.growth;original.runes.owned=['r01'];original.runes.slots[0]='r01';original.coins=123;
  const s=validate(original);expect(s.skills.swordWindStage).toBe(1);expect(s.skills.meleeFinisher).toBe(false);expect(s.coins).toBe(123);expect(s.runes.owned).toEqual(['r01']);expect(validate(s)).toEqual(s);expect(original.schema_version).toBe(14);
  const claimed=runeSnapshot(s,{kind:'claim',id:'r31'},safe);expect(()=>runeSnapshot(claimed,{kind:'claim',id:'r31'},safe)).toThrow();expect(claimed.runes.growth.r31).toEqual({advanced:false,branch:null});
 });
 it('锁定时不改分支、未获得不能凭预设授予、未装备回返分支不生效',()=>{
  let s=initialState();s.runes.owned=['r31'];s.runes.growth.r31={advanced:true,branch:null};s=runeSnapshot(s,{kind:'branch',id:'r31',branch:'anchor'},safe);expect(returnMode(s)).toBeUndefined();s.runes.slots[0]='r31';expect(returnMode(s)).toBe('anchor');
  expect(()=>runeSnapshot(s,{kind:'branch',id:'r31',branch:'path'},{...safe,action:true})).toThrow();expect(()=>runeSnapshot(s,{kind:'equip',slot:1,id:'r33'},safe)).toThrow();expect(()=>runeSnapshot(s,{kind:'branch',id:'r31',branch:'chase'},safe)).toThrow();
 });
});

import {WIND_LESSONS} from '../src/data/windLessons';
it('三向教学推荐站位可独立释放宽剑风，不与教本实体初始重叠',()=>{
 const root=WIND_LESSONS[4].stand,sys=new SwordWindSystem();
 const targets=[[-130,-225],[0,-260],[90,-206]].map(([dx,dy],i)=>({...motion('铃'+i,root.x+dx,root.y+dy),target:{id:'铃'+i,x:root.x+dx,y:root.y+dy,hp:100,windSensitive:true}}));
 sys.launch({...shot(5),returnMode:undefined,facing:1,aim:{x:0,y:-1}},root,110,36);
 sys.advance(110,900,targets);
 expect(new Set(sys.events.filter(e=>e.kind==='hit').map(e=>e.target!.id)).size).toBe(3);
});
