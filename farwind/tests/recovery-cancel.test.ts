import {describe,it,expect} from 'vitest';
import {CombatController,resolveStrike,PARRY,COMBAT,type ActionKind} from '../src/game/systems/combat';
import {initialState,parseSave} from '../src/game/systems/state';
import {runeSnapshot} from '../src/game/systems/runeState';

function arena(stage:number,enabled=true){
 const c=new CombatController(),p={x:0,y:0,stamina:100};
 c.recoveryCancelEnabled=enabled;c.dashCostMultiplier=.8;c.swordWindEnabled=true;
 c.attack={id:1,stage,start:0,facing:3,hit:new Set(),config:resolveStrike(stage)};
 return {c,p,m:resolveStrike(stage)};
}
function request(c:CombatController,p:{stamina:number},kind:ActionKind,at:number){
 c.requestActions([{kind,at,sequence:1,axis:{x:1,y:0}}],at,p,3);
}

describe('轻羽攻击后摇取消',()=>{
 for(const stage of [1,2,3,4])for(const kind of ['parry','dash'] as const)
 it(`第${stage}段${kind==='parry'?'招架':'风步'}完整保留有效期，后摇开始只执行一次`,()=>{
  const {c,p,m}=arena(stage),legal=m.windup+m.active;
  request(c,p,kind,legal-80);
  expect(c.flushActions(legal-0.001,p)).toEqual([]);expect(p.stamina).toBe(100);
  expect(kind==='parry'?c.parryLegalAt(legal-1):c.dashLegalAt(legal-1)).toBe(legal);
  expect(c.nextBoundary(legal-1)).toBe(legal);
  expect(c.flushActions(legal,p)).toEqual([kind]);expect(c.attack).toBeNull();
  expect(p.stamina).toBe(100-(kind==='parry'?PARRY.cost:COMBAT.dash.cost*.8));
  expect(c.flushActions(legal+1,p)).toEqual([]);
  if(kind==='dash'){expect(c.invulnerable(legal+39.999)).toBe(false);expect(c.invulnerable(legal+40)).toBe(true);expect(c.invulnerable(legal+140)).toBe(false);}
 });
 it('第三击不装备时保持390／400，卸装与读取按真实槽位重算',()=>{
  let s=initialState();s.runes.owned=['r09'];
  const safe={combat:false,boss:false,defense:false,trial:false,story:false,action:false};
  s=runeSnapshot(s,{kind:'equip',slot:0,id:'r09'},safe);
  s=parseSave(JSON.stringify(s));const {c}=arena(3,s.runes.slots.includes('r09'));
  expect(c.parryLegalAt(0)).toBe(275);expect(c.dashLegalAt(0)).toBe(275);
  s=runeSnapshot(s,{kind:'equip',slot:0,id:null},safe);c.recoveryCancelEnabled=s.runes.slots.includes('r09');
  expect(c.parryLegalAt(0)).toBe(390);expect(c.dashLegalAt(0)).toBe(400);expect(s.runes.owned).toContain('r09');
 });
 for(const kind of ['parry','dash'] as const)it(`${kind==='parry'?'招架':'风步'}早按过期不复活，体力不足不免费取消`,()=>{
  const early=arena(3);request(early.c,early.p,kind,100);early.c.flushActions(251,early.p);
  expect(early.c.flushActions(275,early.p)).toEqual([]);expect(early.c.attack).not.toBeNull();expect(early.p.stamina).toBe(100);
  const poor=arena(3);poor.p.stamina=0;request(poor.c,poor.p,kind,200);
  expect(poor.c.flushActions(275,poor.p)).toEqual([]);expect(poor.c.attack).not.toBeNull();expect(poor.p.stamina).toBe(0);
 });
 it('强化权限不越过招架冷却、风步冷却或受击恢复',()=>{
  const a=arena(3);a.c.parryCooldown=350;request(a.c,a.p,'parry',250);
  expect(a.c.flushActions(275,a.p)).toEqual([]);expect(a.c.flushActions(350,a.p)).toEqual(['parry']);
  const b=arena(3);b.c.dashCooldown=350;request(b.c,b.p,'dash',250);
  expect(b.c.flushActions(275,b.p)).toEqual([]);expect(b.c.flushActions(350,b.p)).toEqual(['dash']);
  const hurt=arena(3);hurt.c.takeHit(260,3,{x:1,y:0},hurt.p);
  request(hurt.c,hurt.p,'parry',275);request(hurt.c,hurt.p,'dash',275);
  expect(hurt.c.flushActions(275,hurt.p)).toEqual([]);expect(hurt.p.stamina).toBe(100);
 });
 it('已命中不重击，已发射剑风不补发，取消清理旧连段预约',()=>{
  const a=arena(3),target={id:'敌人',x:60,y:0,hp:100};let hits=0;
  a.c.update(0,200,3,a.p,[target],()=>false,()=>true,()=>hits++,()=>{});
  request(a.c,a.p,'parry',200);a.c.update(200,275,3,a.p,[target],()=>false,()=>true,()=>hits++,()=>{});
  expect(a.c.flushActions(275,a.p)).toEqual(['parry']);
  a.c.update(275,300,3,a.p,[target],()=>false,()=>true,()=>hits++,()=>{});expect(hits).toBe(1);
  const b=arena(4),releases:number[]=[];b.c.attack={...b.c.attack!,kind:'swordWind',delivery:'wind',stage:1,config:{windup:110,active:100,recovery:190,range:0,angle:0,damage:36,step:8,knock:12,flash:120,stagger:120}};
  b.c.update(0,110,3,b.p,[],()=>false,()=>true,()=>{},()=>{},()=>{},()=>true,x=>releases.push(x.id));
  b.c.requestAttack(200);request(b.c,b.p,'dash',200);
  b.c.update(110,210,3,b.p,[],()=>false,()=>true,()=>{},()=>{},()=>{},()=>true,x=>releases.push(x.id));
  expect(b.c.flushActions(210,b.p)).toEqual(['dash']);
  b.c.update(210,500,3,b.p,[],()=>false,()=>true,()=>{},()=>{},()=>{},()=>true,x=>releases.push(x.id));
  expect(releases).toEqual([1]);expect(b.c.pending).toBe(false);expect(b.c.attack).toBeNull();
 });
});
