import {describe,it,expect} from 'vitest';
import {initialState,validate,add,count} from '../src/game/systems/state';
import {EconomyCommit,economySnapshot,maxTradeQuantity} from '../src/game/systems/economy';
import {MAX_COINS} from '../src/data/economy';
import {WindAim} from '../src/game/systems/windAim';
import {resolveSwordWindConfig} from '../src/data/swordWind';
import {CombatController} from '../src/game/systems/combat';
import {Input} from '../src/game/systems/input';
import {creditCombatCoins,settleEncounterCoins,combatCoinValue} from '../src/game/systems/combatCoins';
import {unitState,resetEncounter} from '../src/game/systems/encounterState';
import {ENCOUNTERS} from '../src/data/maps/windbell/encounters';
const target=(id:string,x:number,y=0)=>({id,x,y,hp:100});
const open=()=>null;

describe('寻风瞄准镜与金币',()=>{
 it('十五版迁移保留钱、背包、任务、技能与世界记录，不发镜、不补历史金币，重复幂等',()=>{
  const old:any=initialState();old.schema_version=15;delete old.equipment.head;delete old.shopStock['smith:windScope'];old.coins=47;old.bag[0]={id:'herb',count:7};
  const before=structuredClone(old),next=validate(old);
  expect(next.schema_version).toBe(16);expect(next.coins).toBe(47);expect(next.equipment.head).toBeNull();expect(count(next,'windScope')).toBe(0);expect(next.shopStock['smith:windScope']).toBe(1);
  for(const k of ['skills','runes','encounters','defense','bag','quest'] as const)expect(next[k]).toEqual(old[k]);expect(validate(next)).toEqual(next);expect(old).toEqual(before);
 });
 it('购买、穿戴、读档、卸下保持唯一持有，未学本领不授予剑风',()=>{
  let s=economySnapshot(initialState(),{sequence:1,kind:'buy',shop:'smith',item:'windScope',quantity:1});expect(s.coins).toBe(40);expect(count(s,'windScope')).toBe(1);expect(s.skills.swordWindStage).toBe(0);
  expect(maxTradeQuantity(s,'smith','windScope')).toBe(0);
  s=economySnapshot(s,{sequence:2,kind:'equip',slot:'head',item:'windScope'});expect(count(s,'windScope')).toBe(0);expect(s.equipment.head).toBe('windScope');expect(validate(s)).toEqual(s);
  expect(()=>economySnapshot(s,{sequence:3,kind:'buy',shop:'smith',item:'windScope',quantity:1})).toThrow('只能持有一件');
  s=economySnapshot(s,{sequence:3,kind:'equip',slot:'head',item:null});expect(count(s,'windScope')).toBe(1);expect(s.coins).toBe(40);
 });
 it('拒绝批量买镜、错误槽位、负余额、重复镜和出售；满包不扣款',()=>{
  const s=initialState();expect(maxTradeQuantity(s,'smith','windScope')).toBe(1);
  expect(()=>economySnapshot(s,{sequence:1,kind:'buy',shop:'smith',item:'windScope',quantity:2})).toThrow();
  add(s,'windScope',1);expect(()=>economySnapshot(s,{sequence:1,kind:'equip',slot:'weapon',item:'windScope'})).toThrow('不匹配');
  expect(()=>economySnapshot(s,{sequence:1,kind:'sell',shop:'general',item:'windScope',quantity:1})).toThrow();
  const duplicate=structuredClone(s);duplicate.equipment.head='windScope';expect(()=>validate(duplicate)).toThrow();
  s.coins=-1;expect(()=>validate(s)).toThrow();const full=initialState();full.bag=Array(24).fill({id:'wood',count:20});expect(()=>economySnapshot(full,{sequence:1,kind:'buy',shop:'smith',item:'windScope',quantity:1})).toThrow('空间');expect(full.coins).toBe(120);
 });
 it('保存失败不发布扣款或装备，重复交易序列拒绝',async()=>{
  const s=initialState(),commit=new EconomyCommit();let published=false;
  await expect(commit.run(()=>s,{sequence:1,kind:'buy',shop:'smith',item:'windScope',quantity:1},async()=>{throw Error('保存失败');},()=>{published=true;})).rejects.toThrow();expect(published).toBe(false);expect(s.coins).toBe(120);
  const next=economySnapshot(s,{sequence:1,kind:'buy',shop:'smith',item:'windScope',quantity:1});expect(()=>economySnapshot(next,{sequence:1,kind:'equip',slot:'head',item:'windScope'})).toThrow('过期');
 });
 it('最近合法目标、稳定排序、保持目标以及死亡后换目标',()=>{
  const aim=new WindAim(),config=resolveSwordWindConfig();const a=target('a',100),b=target('b',150);
  expect(aim.select({x:0,y:0},config,[b,a],open)?.target).toBe('a');b.x=40;expect(aim.select({x:0,y:0},config,[b,a],open)?.target).toBe('a');a.hp=0;expect(aim.select({x:0,y:0},config,[a,b],open)?.target).toBe('b');aim.clear();expect(aim.select({x:0,y:0},config,[target('z',50),target('a',50)],open)?.target).toBe('a');
 });
 it('无遮挡判定从实际完整起始路径扫掠；越界、禁用与无候选清理',()=>{
  const aim=new WindAim(),c=resolveSwordWindConfig();const a=target('a',60),b=target('b',100,100);
  const block=(from:{x:number;y:number},to:{x:number;y:number})=>to.y===0?{id:'墙',t:.5}:null;
  expect(aim.select({x:0,y:0},c,[a,b],block)?.target).toBe('b');expect(aim.select({x:0,y:0},c,[{...b,disabled:true},target('far',1000)],open)).toBeNull();expect(aim.target).toBeNull();
 });
 it('从已学阶段读取射程，不提前给四阶；不把原生风变成追踪弹',()=>{
  const aim=new WindAim(),p={x:0,y:0},t=target('far',440);expect(aim.select(p,resolveSwordWindConfig(1),[t],open)).toBeNull();expect(aim.select(p,resolveSwordWindConfig(4),[t],open)?.target).toBe('far');
  const result=aim.select(p,resolveSwordWindConfig(1),[target('a',100,50)],open)!;const original={...result.direction};aim.select(p,resolveSwordWindConfig(1),[target('a',80,-50)],open);expect(result.direction).toEqual(original);
 });
 it('不同步长持续输入均在动作开始解析，伤害来源与分束原生实例不变',()=>{
  const run=(step:number)=>{const c=new CombatController(),p={x:0,y:0,stamina:100},a=new WindAim(),rows:any[]=[];c.swordWindEnabled=true;c.swordWindConfig=resolveSwordWindConfig(5);c.windHeld=true;c.windAuto=true;c.resolveWindAim=(p,conf)=>a.select(p,conf,[target('enemy',200,100)],open);c.requestSwordWind(0);
   for(let now=step;now<=2400;now+=step)c.update(now-step,now,0,p,[],()=>false,()=>{},()=>{},(_stage,attack)=>rows.push({start:attack.start,kind:attack.kind,root:attack.rootActionId,target:attack.primaryTarget,angles:attack.swordWind?.angles}));return rows;};
  expect(run(10)).toEqual(run(40));expect(run(10).every(r=>r.kind==='swordWind'&&r.target==='enemy'&&r.angles.length===3)).toBe(true);
 });
 it('同一帧快速按下并松开 I 仍保留本次自动瞄准，中键明确手动；重复键不补发',()=>{
  const input=new Input(null,()=>0),c=new CombatController(),p={x:0,y:0,stamina:100};c.swordWindEnabled=true;c.swordWindConfig=resolveSwordWindConfig();let count=0;
  c.resolveWindAim=()=>{count++;return {target:'enemy',facing:3,direction:{x:1,y:0}};};
  input.keyDown('i');input.keyDown('i',true);input.keyUp('i');const events=input.drain();expect(events.filter(e=>e.kind==='wind')).toHaveLength(1);
  c.windAuto=false;c.requestActions(events.filter((e):e is typeof e & {kind:'wind'}=>e.kind==='wind'),0,p,0);c.update(0,1,0,p,[],()=>false,()=>{},()=>{},()=>{});expect(count).toBe(1);expect(c.attack?.primaryTarget).toBe('enemy');
  c.reset(0);c.windAuto=true;c.requestActions([{kind:'wind',at:0,sequence:2,axis:{x:0,y:0},windAuto:false}],0,p,0);c.update(0,1,0,p,[],()=>false,()=>{},()=>{},()=>{});expect(count).toBe(1);expect(c.attack?.primaryTarget).toBeUndefined();
 });
 it('金币与正式死亡一起结算，重载不重复；新合法刷新可再领取',()=>{
  const s=initialState(),group=ENCOUNTERS.find(g=>g.kind==='patrol')!,g=s.encounters.groups[group.id];g.activated=true;const id=group.members[0].id;
  expect(settleEncounterCoins(s,id,true,false)).toBe(3);expect(s.coins).toBe(123);expect(settleEncounterCoins(s,id,true,false)).toBeNull();const next=validate(s);expect(settleEncounterCoins(next,id,true,false)).toBeNull();expect(next.coins).toBe(123);
  for(const m of group.members.slice(1))settleEncounterCoins(s,m.id,false,false);g.cooldown=0;expect(resetEncounter(s.encounters,group.id)).toBe(true);expect(settleEncounterCoins(s,id,true,false)).toBe(3);
 });
 it('参与后守卫补刀得奖励，纯守卫无奖；满包上限只收实际可容纳金额',()=>{
  const s=initialState(),g=ENCOUNTERS.find(g=>g.kind==='patrol')!;s.encounters.groups[g.id].activated=true;unitState(s.encounters,g.members[0].id)!.participated=true;expect(settleEncounterCoins(s,g.members[0].id,false,false)).toBe(3);
  expect(settleEncounterCoins(s,g.members[1].id,false,false)).toBe(0);expect(combatCoinValue({elite:'shield'})).toBe(8);expect(combatCoinValue({elite:'shield',boss:'moss'})).toBe(35);
  s.bag=Array(24).fill({id:'wood',count:20});s.coins=MAX_COINS-2;expect(creditCombatCoins(s,{boss:'moss'},true)).toBe(2);expect(s.coins).toBe(MAX_COINS);expect(creditCombatCoins(s,{},true)).toBe(0);
 });
});
