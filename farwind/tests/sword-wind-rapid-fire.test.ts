import {describe,it,expect} from 'vitest';
import {CombatController,attackConfig,type Attack} from '../src/game/systems/combat';
import {resolveSwordWindConfig,SWORD_WIND,swordWindInterval} from '../src/data/swordWind';
import {SwordWindSystem} from '../src/game/systems/swordWind';
import {RuneCombat} from '../src/game/systems/runeCombat';
import {WindGiftCombat} from '../src/game/systems/windGiftCombat';
import {initialState,parseSave} from '../src/game/systems/state';
import {giftChoiceSnapshot,chooseWindGift,offerWindGift,giftEffect,validateWindGifts} from '../src/game/systems/windGifts';
import {StateCommit} from '../src/game/systems/stateCommit';
import {CombatTimeline} from '../src/game/systems/timeline';

function arena(level=0,rhythm=0,stage:1|5=1){
 const state=initialState();state.player.x=0;state.player.y=0;
 if(level)state.windGifts.held.push({id:'rapidFire',level});
 if(rhythm)state.windGifts.held.push({id:'windRhythm',level:rhythm});
 const c=new CombatController(),winds=new SwordWindSystem(),released:{at:number;id:number;interval:number}[]=[],started:Attack[]=[];
 c.swordWindEnabled=true;c.swordWindConfig=resolveSwordWindConfig(stage,level);
 let now=0;
 const engine=new RuneCombat({state:()=>state,targets:()=>[],A:()=>18,clear:()=>true,visible:()=>true,blocker:()=>null,push:()=> 'immune',sound:()=>{},checkpoint:()=>{},damage:()=>({applied:false,damage:0,killed:false})});
 const gifts=new WindGiftCombat(engine,{active:()=>true,now:()=>now,following:()=>false,companion:()=>undefined,move:()=>0,stagger:()=>{}});
 const tick=(prev:number,to:number)=>{now=to;state.runes.clock=to;c.update(prev,to,3,state.player,[],()=>false,()=>true,()=>{},(_s,a)=>{started.push(a);gifts.capture(a);},()=>{},()=>true,(a,p,at)=>{const wind=winds.launch(a,p,at,36)!;if(a.kind==='swordWind'){released.push({at,id:a.id,interval:a.fireInterval!});gifts.release(wind);}});};
 const run=(from:number,to:number,step=5)=>{tick(from,from);for(let at=from+step;at<=to;at+=step)tick(at-step,at);};
 return {state,c,winds,gifts,released,started,tick,run};
}
describe('原生剑风统一发射节奏',()=>{
 it.each([0,1,2,3])('等级%s首发110毫秒，后续按同一间隔释放且参数不变',level=>{
  const h=arena(level);h.c.windHeld=true;h.run(0,3300);const interval=swordWindInterval(level);
  expect(h.released.slice(0,4).map(r=>r.at)).toEqual([110,110+interval,110+interval*2,110+interval*3]);
  expect(h.c.swordWindConfig!.strike).toEqual(SWORD_WIND.strike);expect(h.c.swordWindConfig!.speed).toBe(900);expect(h.c.swordWindConfig!.distance).toBe(300);
 });
 it.each([1,2])('风律%s级只缩短第三次发射后的间隔，三级可达370／340',rhythm=>{
  const h=arena(3,rhythm);h.c.windHeld=true;h.run(0,2200);expect(h.released.slice(0,4).map(r=>r.at)).toEqual([110,510,910,1310-rhythm*30]);expect(h.released[2].interval).toBe(400-rhythm*30);
 });
 it('教学试用保持800毫秒，已持有三级与风律也不改变试用节奏',()=>{
  const h=arena(3,2);h.c.swordWindConfig={...resolveSwordWindConfig(1),trialLesson:'windLessonResolved'};h.c.windHeld=true;h.run(0,2600);
  expect(h.released.map(r=>r.at)).toEqual([110,910,1710,2510]);expect(h.released.every(r=>r.interval===800)).toBe(true);
 });
 it('手按、连按、长按与自动锁定共享门禁；切目标和松按不清零',()=>{
  const h=arena();h.c.resolveWindAim=()=>({direction:{x:0,y:1},facing:0,target:'新目标'});
  h.c.requestSwordWind(0,true);h.run(0,400);
  for(let at=400;at<900;at+=5){h.c.requestSwordWind(at,at%2===0);h.c.windHeld=at%3===0;h.tick(at,at+5);}
  expect(h.released.map(r=>r.at)).toEqual([110]);h.run(900,920);expect(h.released.map(r=>r.at)).toEqual([110,910]);expect(h.started).toHaveLength(2);
 });
 it('松开长按取消自动等待，手按产生的一次有效预约仍保留',()=>{
  const h=arena();h.c.windHeld=true;h.run(0,500);expect(h.c.windReservation?.held).toBe(true);h.c.windHeld=false;h.run(500,1500);expect(h.released.map(r=>r.at)).toEqual([110]);
  h.c.requestSwordWind(1500);h.run(1500,1620);expect(h.released[1].at).toBe(1610);
 });
 it('单次冷却预约不占pending，移动与J能执行，近战不会绕过发射间隔',()=>{
  const h=arena();h.c.requestSwordWind(0);h.run(0,400);h.c.requestSwordWind(410);expect(h.c.pending).toBe(false);expect(h.c.phase(410)).toBe('idle');
  h.state.player.x+=30;h.c.requestAttack(420);h.tick(420,420);expect(h.c.attack?.kind).toBe('melee');h.c.cancelAttack();h.c.requestSwordWind(430);h.run(430,920);expect(h.released.map(r=>r.at)).toEqual([110,910]);
 });
 it.each(['K','L','受击','取消'] as const)('释放后%s清理仍保留冷却；动作之后可恢复输入',kind=>{
  const h=arena();h.c.requestSwordWind(0);h.run(0,400);const deadline=h.c.windFireUntil;
  if(kind==='K'){expect(h.c.requestParry(410,3)).toBe(true);h.c.flushActions(410,h.state.player);}else if(kind==='L'){expect(h.c.requestDash(410,100,{x:1,y:0},3)).toBe(true);}else if(kind==='受击')h.c.takeHit(410,3,{x:1,y:0},h.state.player);else h.c.cancelAttack();
  expect(h.c.windFireUntil).toBe(deadline);h.run(410,800);h.c.requestSwordWind(800);h.run(800,940);expect(h.released[1]?.at).toBeGreaterThanOrEqual(910);
 });
 it('提前架剑取消不耗冷却，也不计风律次数；升级不改变当前实例快照',()=>{
  const h=arena(0,2);h.c.requestSwordWind(0);h.tick(0,0);h.c.requestParry(20,3);h.c.flushActions(20,h.state.player);expect(h.c.windFireUntil).toBe(0);expect(h.released).toHaveLength(0);
  h.run(20,500);h.c.requestSwordWind(500);h.tick(500,500);const a=h.c.attack!;h.c.swordWindConfig=resolveSwordWindConfig(1,3);h.run(500,620);expect(a.fireInterval).toBe(800);expect(h.released[0].interval).toBe(800);expect(h.c.windFireUntil).toBe(1410);
 });
 it('五阶三向、回风、回声及剑气反击不额外占用原生施放次数',()=>{
  const h=arena(3,0,5);h.state.windGifts.held.push({id:'echoWind',level:1});h.c.windHeld=true;h.run(0,1400);expect(h.released).toHaveLength(4);expect(h.winds.winds).toHaveLength(12);h.gifts.advance(1400,1470,[]);expect(h.gifts.metrics.echoes).toBe(1);expect(h.c.windFireUntil).toBe(1710);
  const until=h.c.windFireUntil;h.c.cancelAttack();const counter:Attack={id:100,kind:'counter',counter:'perfect',delivery:'wind',start:1400,stage:1,facing:3,hit:new Set()};expect(h.winds.launch(counter,h.state.player,1500,20)).not.toBeNull();expect(h.c.windFireUntil).toBe(until);
  h.winds.returnAnchor=()=>h.state.player;const back={...counter,id:101,kind:'swordWind' as const,counter:undefined,returnMode:'path' as const,swordWind:resolveSwordWindConfig(1,3)};h.winds.launch(back,h.state.player,1500,36);h.winds.advance(1500,1900,[]);expect(h.c.windFireUntil).toBe(until);
 });
 it('暂停冻结模拟冷却，慢帧只消耗50毫秒预算且不补发积压',()=>{
  const h=arena(3);h.c.windHeld=true;h.run(0,400);const timeline=new CombatTimeline();timeline.reset(10000);const until=h.c.windFireUntil;
  h.c.clearInputs('暂停',400);timeline.reset(20000);h.c.windHeld=true;
  const sim=timeline.frame(400,25000,5000,[],h.c,{boundary:n=>h.c.nextBoundary(n),advance:h.tick,input:()=>{},resolve:n=>h.tick(n,n)});
  expect(sim).toBe(450);expect(h.c.windFireUntil).toBe(until);expect(h.released).toHaveLength(1);h.run(450,550);expect(h.released.map(r=>r.at)).toEqual([110,510]);
 });
 it('直接大步进也不一次补出多发；释放事件后重新检查冷却',()=>{const h=arena();h.c.windHeld=true;h.tick(0,5000);expect(h.released).toHaveLength(1);h.tick(5000,5010);expect(h.released).toHaveLength(1);});
});
describe('疾风连发随机获取与保存事务',()=>{
 it('仅解锁后普通随机出现；三级退出新池，其他风赐可继续升级',()=>{
  let appeared=0;for(let seed=0;seed<1000;seed++){const s=initialState().windGifts;offerWindGift(s,'普通随机',seed,false);expect(s.pending[0].candidates).not.toContain('rapidFire');const t=initialState().windGifts;offerWindGift(t,'普通随机',seed,true);appeared+=Number(t.pending[0].candidates.includes('rapidFire'));t.held=[{id:'rapidFire',level:3}];offerWindGift(t,'满级',seed,true);expect(t.pending[1].candidates).not.toContain('rapidFire');}expect(appeared).toBeGreaterThan(0);expect(appeared).toBeLessThan(1000);
 });
 it('积压候选不重抽、满级禁止结算、其他候选可领取并拒绝重复领取',()=>{
  const s=initialState().windGifts;s.held=[{id:'rapidFire',level:2}];s.receipts=['甲','乙'];s.pending=s.receipts.map(receipt=>({receipt,candidates:['rapidFire','blade','armor']}));const second=structuredClone(s.pending[1]);chooseWindGift(s,'甲','rapidFire');expect(s.held[0].level).toBe(3);expect(s.pending[0]).toEqual(second);const before=structuredClone(s);expect(()=>chooseWindGift(s,'乙','rapidFire')).toThrow('满级');expect(s).toEqual(before);chooseWindGift(s,'乙','blade');expect(()=>chooseWindGift(s,'乙','blade')).toThrow('失效');expect(validateWindGifts(s)).toEqual(s);
 });
 it('保存失败不生效、成功后原子发布，刷新与旧档恢复无需版本变化',async()=>{
  let state=initialState();state.windGifts.held=[{id:'armor',level:12}];state.windGifts.receipts=['领取'];state.windGifts.pending=[{receipt:'领取',candidates:['rapidFire','blade','armor']}];const before=structuredClone(state),lock=new StateCommit();
  await expect(lock.run(()=>state,s=>giftChoiceSnapshot(s,'领取','rapidFire'),async()=>{throw Error('磁盘失败');},s=>{state=s;})).rejects.toThrow('磁盘失败');expect(state).toEqual(before);
  let stored='';await lock.run(()=>state,s=>giftChoiceSnapshot(s,'领取','rapidFire'),async s=>{stored=JSON.stringify(s);expect(state).toEqual(before);},s=>{state=s;});expect(parseSave(stored)).toEqual(state);expect(state.schema_version).toBe(before.schema_version);const old=parseSave(JSON.stringify(before));expect(old.windGifts).toEqual(before.windGifts);expect(swordWindInterval(old.windGifts.held.find(g=>g.id==='rapidFire')?.level)).toBe(800);
 });
 it('非法四级存档拒绝，等级说明包含当前、下一档和三级上限',()=>{const s=initialState();s.windGifts.held=[{id:'rapidFire',level:4}];expect(()=>parseSave(JSON.stringify(s))).toThrow('风赐记录');expect(giftEffect('rapidFire',1)).toContain('600毫秒');expect(giftEffect('rapidFire',1)).toContain('480毫秒');expect(giftEffect('rapidFire',3)).toContain('已满级');});
});
