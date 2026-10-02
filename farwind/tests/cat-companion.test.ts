import {describe,it,expect} from 'vitest';
import {initialState,validate,add,count} from '../src/game/systems/state';
import {catBenefits,catStage,catRemember,catCareGain,catTrailKey,CAT_STAGES} from '../src/game/systems/catBond';
import {CatCompanion,catCareSnapshot} from '../src/game/systems/catCompanion';
import {Sprint} from '../src/game/systems/sprint';
import {StateCommit} from '../src/game/systems/stateCommit';
import {resolveDamage} from '../src/game/systems/damage';
import {JOURNEY_MAX_DISTANCE} from '../src/game/systems/journeyTraining';
import {props,enemyDefs} from '../src/data/world';
import {ENCOUNTERS} from '../src/data/maps/windbell/encounters';
const clear=()=>true;
function setup(score=0){const s=initialState(),c=new CatCompanion();s.catBond.score=score;c.advance(s,16,s.player,clear);return {s,c};}
const enemy=(s:ReturnType<typeof initialState>)=>({id:'真实敌人',x:s.player.x+80,y:s.player.y,hp:300});
describe('小黑默契与正式存档',()=>{
 it.each(CAT_STAGES)('默契 $score 的阶段为 $name，前一分不会提前解锁',stage=>{
  expect(CAT_STAGES[catStage(stage.score)].name).toBe(stage.name);
  if(stage.score)expect(catStage(stage.score-1)).toBe(catStage(stage.score)-1);
  const b=catBenefits(stage.score);expect(b.sniff).toBe(stage.score>=20);expect(b.claw).toBe(stage.score>=45);expect(b.guard).toBe(stage.score>=75);
 });
 it('旧十九版只结算明确经历，迁移副本不改原档，二次读取不重复增加',()=>{
  const old:any=initialState();old.schema_version=19;delete old.catBond;
  old.chests=[props.find(p=>p.kind==='chest')!.id];old.killed=[enemyDefs[0].id];old.night.discovered=true;
  const before=structuredClone(old),next=validate(old);expect(old).toEqual(before);
  expect(next.schema_version).toBe(20);expect(next.catBond.score).toBeGreaterThanOrEqual(10);
  expect(next.catBond.memories).toContain('night');expect(validate(next)).toEqual(next);
  expect(next.bag).toEqual(old.bag);expect(next.physique).toEqual(old.physique);
 });
 it('十八版同时迁移体魄与默契，不凭游戏时间推测奖励',()=>{
  const old:any=initialState();old.schema_version=18;delete old.physique;delete old.catBond;
  const next=validate(old);expect(next.physique.runDistance).toBe(0);expect(next.catBond.score).toBe(0);
 });
 it('记忆按正式编号去重，未知编号不计分，满默契仍记录共同经历',()=>{
  const {s}=setup(99),key=`battle:${ENCOUNTERS[0].members[0].id}`;
  expect(catRemember(s.catBond,key)).toBe(1);expect(catRemember(s.catBond,key)).toBe(0);
  expect(catRemember(s.catBond,'battle:无限生成的假敌人')).toBe(0);expect(s.catBond.score).toBe(100);
  expect(validate(s).catBond.memories).toEqual([key]);
 });
 it.each([NaN,-1,101,2.5])('拒绝非法默契 %s',score=>{const {s}=setup();s.catBond.score=score;expect(()=>validate(s)).toThrow('默契');});
 it('拒绝未知、重复、无限记忆与超长冷却、无技能护盾',()=>{
  const changes=[{memories:['unknown']},{memories:['night','night']},{clawCooldown:12001},{guardCooldown:60001},{clawCooldown:1},{guardCooldown:1},{shield:10,shieldTime:5000,guardCooldown:60000}];
  for(const change of changes){const {s}=setup();Object.assign(s.catBond,change);expect(()=>validate(s)).toThrow('默契');}
 });
 it('每日摸猫、喂食各一次，浆果实际扣除，换日恢复，满级不消耗',()=>{
  const {s}=setup();add(s,'berry',2);const pet=catCareSnapshot(s,'pet');const fed=catCareSnapshot(pet,'feed');
  expect(fed.catBond.score).toBe(5);expect(count(fed,'berry')).toBe(1);expect(count(s,'berry')).toBe(2);
  expect(()=>catCareSnapshot(fed,'pet')).toThrow('今天');expect(()=>catCareSnapshot(fed,'feed')).toThrow('今天');
  fed.time+=1440;const tomorrow=catCareSnapshot(fed,'feed');expect(tomorrow.catBond.score).toBe(8);expect(count(tomorrow,'berry')).toBe(0);
  tomorrow.catBond.score=100;tomorrow.time+=1440;expect(()=>catCareSnapshot(tomorrow,'feed')).toThrow('心有灵犀');
 });
 it('休息每日一次，不与摸猫喂食相互覆盖',()=>{const {s}=setup();catCareGain(s.catBond,'rest',s.time);catCareGain(s.catBond,'rest',s.time);catCareGain(s.catBond,'pet',s.time);expect(s.catBond.score).toBe(4);});
 it('保存失败保持原浆果与默契，事务未完成不能重复消费',async()=>{
  let {s}=setup();add(s,'berry',2);const before=structuredClone(s),commit=new StateCommit();
  await expect(commit.run(()=>s,old=>catCareSnapshot(old,'feed'),async()=>{throw Error('存储失败');},next=>s=next)).rejects.toThrow('存储失败');expect(s).toEqual(before);
  let finish!:()=>void;const pending=commit.run(()=>s,old=>catCareSnapshot(old,'feed'),()=>new Promise<void>(resolve=>finish=resolve),next=>s=next);
  await Promise.resolve();await Promise.resolve();expect(s).toEqual(before);
  await expect(commit.run(()=>s,old=>catCareSnapshot(old,'feed'),async()=>{},next=>s=next)).rejects.toThrow('正在保存');finish();await pending;
  expect(s.catBond.score).toBe(3);expect(count(s,'berry')).toBe(1);
 });
});
describe('真实随行、协同与护盾边界',()=>{
 it('短暂落后有宽限，墙体或距离持续隔离停止增益；倒下立即停止',()=>{
  const {s,c}=setup();c.advance(s,1000,{x:s.player.x+500,y:s.player.y},clear);expect(c.aura).toBe(true);
  c.advance(s,700,s.player,()=>false);expect(c.aura).toBe(false);
  c.advance(s,16,s.player,clear);s.player.hp=0;c.advance(s,16,s.player,clear);expect(c.aura).toBe(false);
 });
 it('随行恢复只加恢复速度，奔跑消耗和动态上限不变',()=>{
  const sprint=new Sprint();sprint.reset(50);
  expect(sprint.update(50,false,1,true,200,.1).stamina).toBeCloseTo(65.4);
  expect(sprint.update(50,true,1,true,200,.2).stamina).toBe(29);
  expect(sprint.update(199,false,1,true,200,.2).stamina).toBe(200);
  expect(sprint.update(50,false,1,false,200,.2).stamina).toBe(50);
 });
 it('实际探索才积累；挂机、回头、传送、训练与室内不刷分',()=>{
  const {s,c}=setup();s.player.x=560;const before={...s.player};
  for(let i=0;i<1000;i++)c.travel(s,before,16,true);expect(s.catBond.score).toBe(0);
  const move=(dx:number,allowed=true)=>{const old={...s.player};s.player.x+=dx;c.advance(s,1000,s.player,clear);c.travel(s,old,1000,allowed);};
  move(80);move(-80);expect(s.catBond.score).toBe(2);const key=catTrailKey(s.player);expect(s.catBond.memories).toContain(key);
  for(let i=0;i<20;i++){move(80);move(-80);}expect(s.catBond.score).toBe(2);
  move(800);expect(s.catBond.score).toBe(2);move(100,false);expect(s.catBond.score).toBe(2);
  s.life.playerSpace='inn';move(180);expect(s.catBond.score).toBe(2);
 });
 it('未解锁、墙体阻隔、倒下、根节点和同一动作都不能触发影爪',()=>{
  const {s,c}=setup(44),target=enemy(s);expect(c.requestClaw(s,s.player,target,'终结',clear)).toBe(false);
  s.catBond.score=45;expect(c.requestClaw(s,s.player,target,'终结',()=>false)).toBe(false);
  expect(c.requestClaw(s,s.player,{...target,hp:0},'终结',clear)).toBe(false);
  expect(c.requestClaw(s,s.player,{...target,passiveRoot:{}},'终结',clear)).toBe(false);
  expect(c.requestClaw(s,s.player,target,'终结',clear)).toBe(true);s.catBond.clawCooldown=0;
  expect(c.requestClaw(s,s.player,target,'终结',clear)).toBe(false);
 });
 it('小黑必须真的扑近；无伤、其他目标不能消耗印记，命中一次后结束',()=>{
  const {s,c}=setup(45),target=enemy(s);target.x+=80;c.requestClaw(s,s.player,target,'终结',clear);
  expect(c.multiplier(s,target)).toBe(1);expect(c.pounceGoal(s,s.player,[target],clear)).not.toBeNull();
  c.pounceGoal(s,target,[target],clear);expect(c.multiplier(s,target)).toBe(1.15);
  c.landed(target,0,true);c.landed({...target,id:'其他敌人'},10,true);expect(c.mark).not.toBeNull();
  c.landed(target,20,true);expect(c.multiplier(s,target)).toBe(1);expect(c.metrics.boosts).toBe(1);
 });
 it('冷却读档保留，印记五秒失效，跨空间与会话不保留旧敌人的印记',()=>{
  const {s,c}=setup(100),target=enemy(s);c.requestClaw(s,target,target,'弹反',clear);c.pounceGoal(s,target,[target],clear);
  const restored=validate(JSON.parse(JSON.stringify(s)));const other=new CatCompanion();other.advance(restored,16,restored.player,clear);
  expect(other.requestClaw(restored,target,target,'另一次攻击',clear)).toBe(false);expect(other.mark).toBeNull();
  c.advance(s,5000,s.player,clear);expect(c.mark).toBeNull();c.transition();expect(c.aura).toBe(false);expect(c.pounce).toBeNull();
 });
 it('低血受伤才护主，不能复活；冷却与五秒有效期保存后继续计时',()=>{
  const {s,c}=setup(75);s.player.hp=31;expect(c.hurt(s)).toBe(false);s.player.hp=30;expect(c.hurt(s)).toBe(true);
  expect(s.catBond.shield).toBe(16);const restored=validate(s);expect(restored.catBond.guardCooldown).toBe(60000);
  c.advance(restored,1000,restored.player,clear);expect(restored.catBond.shieldTime).toBe(4000);expect(c.hurt(restored)).toBe(false);
  c.advance(restored,4000,restored.player,clear);expect(restored.catBond.shield).toBe(0);
  restored.catBond.guardCooldown=0;restored.player.hp=0;expect(c.hurt(restored)).toBe(false);
 });
 it('体魄满级时护盾随生命上限扩大，合法保存，不改变小宝的保命下限',()=>{
  const {s,c}=setup(100);s.physique.runDistance=JOURNEY_MAX_DISTANCE;s.player.hp=60;c.hurt(s);
  expect(s.catBond.shield).toBe(44);expect(()=>validate(s)).not.toThrow();
  const event={sourceId:'敌人',targetId:'player',attackId:'攻击',amount:100,sourceType:'enemy-melee' as const,eventId:null};
  const hit=resolveDamage(event,{id:'敌人',hp:100,armor:0,faction:'hostile'},{id:'player',hp:60,armor:0,faction:'village',hpFloor:30});
  const result=c.protect(s,hit);expect(result).toEqual({damage:0,hp:60});expect(s.catBond.shield).toBe(14);
 });
 it('护盾抵扣致命攻击不会凭空加血或错误救活，足量护盾才保住当前血量',()=>{
  for(const [amount,expected] of [[6,1],[3,0],[16,5]]){
   const {s,c}=setup(75);s.player.hp=5;c.hurt(s);s.catBond.shield=amount;
   const hit=resolveDamage({sourceId:'敌人',targetId:'player',attackId:'攻击',amount:10,sourceType:'enemy-melee',eventId:null},{id:'敌人',hp:100,armor:0,faction:'hostile'},{id:'player',hp:5,armor:0,faction:'village'});
   expect(c.protect(s,hit).hp).toBe(expected);
  }
 });
 it('嗅迹尊重发现记录、任务条件、视线与威胁，不给出穿墙提示',()=>{
  const {s,c}=setup(20),resource=props.find(p=>p.kind==='resource')!;Object.assign(s.player,{x:resource.x,y:resource.y});
  c.advance(s,16,s.player,clear);c.sniff(s,s.player,()=>false,false);expect(c.hint).toBeNull();
  c.advance(s,500,s.player,clear);c.sniff(s,s.player,clear,false);expect(c.hint).not.toBeNull();
  c.sniff(s,s.player,clear,true);expect(c.hint).toBeNull();
  for(const p of props){if(p.kind==='resource')s.collected[p.id]=s.time;if(p.kind==='chest')s.chests.push(p.id);}
  s.quest=0;catRemember(s.catBond,'find:clue');c.advance(s,500,s.player,clear);c.sniff(s,s.player,clear,false);expect(c.hint).toBeNull();
 });
});
