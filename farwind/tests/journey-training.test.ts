import { describe, it, expect } from 'vitest';
import { initialState, validate, parseSave } from '../src/game/systems/state';
import { journeyThreshold, journeyProgress, playerVitals, recordRunDistance, JOURNEY_MAX_DISTANCE } from '../src/game/systems/journeyTraining';
import { Sprint } from '../src/game/systems/sprint';
import { CombatController, sweepMove, PARRY } from '../src/game/systems/combat';
import { economySnapshot, movementSpeed } from '../src/game/systems/economy';
import { springSnapshot } from '../src/game/systems/villageSpring';
import { sleepSnapshot } from '../src/game/systems/sleep';
import { RuneCombat } from '../src/game/systems/runeCombat';
import { runeById } from '../src/data/runes';
import { SaveQueue } from '../src/game/systems/saveQueue';
import { VILLAGE_ANCHORS } from '../src/data/maps/windbell/layout';

const safe = { combat:false, boss:false, defense:false, trial:false, story:false, action:false };
function trained(meters = 5000) {
  const state = initialState(); state.physique.runDistance = meters * 32; return state;
}
describe('旅途锻炼里程结算', () => {
  it.each([false, true])('每个整数门槛前后准确发奖，生命分支为 %s', health => {
    let cumulative = 0;
    for (let gain = 1; gain <= 100; gain++) {
      cumulative += (health ? 1000 : 500) + (gain - 1) * (health ? 50 : 25);
      expect(journeyThreshold(gain, health)).toBe(cumulative * 32);
      const state = trained(cumulative), key = health ? 'maxHp' : 'maxStamina';
      expect(playerVitals(state)[key]).toBe(100 + gain);
      state.physique.runDistance -= .000001;
      expect(playerVitals(state)[key]).toBe(99 + gain);
    }
  });
  it('共用里程、余量继承、多门槛与练满不重复奖励，不恢复当前值', () => {
    const state = initialState(); state.player.hp = 41; state.player.stamina = 35;
    expect(recordRunDistance(state,{x:0,y:0},{x:5000*32,y:0},true)).toEqual({hp:4,stamina:8});
    expect(playerVitals(state)).toEqual({maxHp:104,maxStamina:108});
    expect(journeyProgress(state)).toMatchObject({meters:5000,staminaRemaining:400,healthRemaining:500});
    expect(state.player).toMatchObject({hp:41,stamina:35});
    expect(recordRunDistance(state,{x:0,y:0},{x:400*32,y:0},true)).toEqual({hp:0,stamina:1});
    const max=recordRunDistance(state,{x:0,y:0},{x:JOURNEY_MAX_DISTANCE*2,y:0},true);
    expect(max).toEqual({hp:96,stamina:91});
    expect(state.physique.runDistance).toBe(JOURNEY_MAX_DISTANCE);
    expect(journeyProgress(state)).toMatchObject({maxHp:200,maxStamina:200,staminaRemaining:null,healthRemaining:null});
    expect(recordRunDistance(state,{x:0,y:0},{x:100,y:0},true)).toEqual({hp:0,stamina:0});
  });
  it.each([30,60,120])('%s 帧下只积累碰撞后的真实奔跑距离，斜向和鞋子加速正确', hz => {
    for (const diagonal of [false,true]) for (const boots of [false,true]) {
      const state=initialState(), p={x:0,y:0};
      if(boots)state.equipment.feet='windBoots';
      const speed=movementSpeed(state,235), axis=diagonal?Math.SQRT1_2:1;
      for(let frame=0;frame<hz*2;frame++){
        const from={...p}; sweepMove(p,speed/hz*axis,diagonal?speed/hz*axis:0,()=>false);
        recordRunDistance(state,from,p,true);
      }
      expect(state.physique.runDistance).toBeCloseTo(speed*2,7);
    }
    const state=initialState(),p={x:0,y:0};
    for(let frame=0;frame<hz;frame++){
      const from={...p};sweepMove(p,235/hz,0,(x)=>x>50);recordRunDistance(state,from,p,true);
    }
    expect(state.physique.runDistance).toBeCloseTo(p.x,7);
    expect(p.x).toBeLessThanOrEqual(50);
    const end=state.physique.runDistance;
    for(let frame=0;frame<hz;frame++){const from={...p};sweepMove(p,235/hz,0,()=>true);recordRunDistance(state,from,p,true);}
    expect(state.physique.runDistance).toBe(end);
  });
  it('走路、原地按跑、非奔跑位移、异常数值都不能积累', () => {
    const state=initialState();
    for(const running of [false,true]) recordRunDistance(state,{x:10,y:20},{x:10,y:20},running);
    recordRunDistance(state,{x:0,y:0},{x:10000,y:10000},false);
    recordRunDistance(state,{x:0,y:0},{x:Infinity,y:0},true);
    expect(state.physique.runDistance).toBe(0);
  });
});
describe('动态上限与存档兼容', () => {
  it('十八版零里程迁移保留其余状态，当前版导入导出不重发奖励', () => {
    const state=initialState(); state.coins=43;state.player.hp=72;state.bag[0]={id:'berry',count:3};
    const old:any=structuredClone(state);old.schema_version=18;delete old.physique;
    const next=validate(old);
    expect(next).toEqual({...state,physique:{runDistance:0}});expect(old.physique).toBeUndefined();
    const grown=trained();grown.player.hp=104;grown.player.stamina=108;
    expect(parseSave(JSON.stringify(grown))).toEqual(grown);
    const loaded=validate(grown);
    expect(recordRunDistance(loaded,loaded.player,loaded.player,true)).toEqual({hp:0,stamina:0});
    expect(initialState().physique.runDistance).toBe(0);
  });
  it('十九版迁移到同期小黑版本时保留已积累的里程和动态上限', () => {
    const current=trained();current.player.hp=104;current.player.stamina=108;
    const old:any=structuredClone(current);old.schema_version=19;delete old.catBond;
    const next=validate(old);
    expect(next.physique).toEqual(current.physique);
    expect(next.player).toEqual(current.player);
    expect(playerVitals(next)).toEqual({maxHp:104,maxStamina:108});
    expect(next.schema_version).toBe(current.schema_version);
  });
  it.each([-1,NaN,Infinity,JOURNEY_MAX_DISTANCE+1])('拒绝异常里程 %s，不能凭当前值伪造上限', distance => {
    const state=initialState();state.physique.runDistance=distance;expect(()=>validate(state)).toThrow('里程');
    const fresh=initialState();fresh.player.hp=101;expect(()=>validate(fresh)).toThrow();
  });
  it('本版缺失成长字段拒绝；只允许按真实里程获得的上限', () => {
    const state:any=trained();delete state.physique;expect(()=>validate(state)).toThrow('里程');
    for(const key of ['hp','stamina'] as const){const grown=trained();grown.player[key]=109;expect(()=>validate(grown)).toThrow();}
  });
  it('体力高于100不会被奔跑或恢复压低；消耗、恢复与耗尽门槛保持', () => {
    const sprint=new Sprint();
    expect(sprint.update(200,true,1,true,200)).toMatchObject({stamina:179,speed:235,running:true});
    expect(sprint.update(190,false,1,true,200).stamina).toBe(200);
    expect(sprint.update(150,false,0,true,200).stamina).toBe(150);
    sprint.reset(1);expect(sprint.update(19.9,true,0,true,200).running).toBe(false);
    expect(sprint.update(20,true,0,true,200).running).toBe(true);
  });
  it.each(['normal','perfect'] as const)('%s 弹反按成长体力上限返还，不改变固定返还量', kind => {
    const combat=new CombatController(),player={x:0,y:0,stamina:150};
    combat.requestParry(0,0);combat.flushActions(0,player);
    expect(player.stamina).toBe(150-PARRY.cost);
    combat.succeedParry(30,kind,player,'',undefined,undefined,200);
    expect(player.stamina).toBe(150+(kind==='perfect'?PARRY.bonus:0));
    const capped=new CombatController(),full={stamina:199};capped.requestParry(0,0);capped.flushActions(0,full);
    capped.succeedParry(30,'perfect',full,'',undefined,undefined,200);expect(full.stamina).toBe(200);
  });
  it('药剂维持固定回复量，超过100仍可用；满状态拒绝不扣物品', () => {
    const state=trained(347500);state.player.hp=120;state.player.stamina=180;
    state.bag[0]={id:'potion',count:3};state.bag[1]={id:'tea',count:2};
    let next=economySnapshot(state,{kind:'consume',item:'potion',sequence:1});expect(next.player.hp).toBe(170);
    next=economySnapshot(next,{kind:'consume',item:'potion',sequence:2});expect(next.player.hp).toBe(200);
    expect(()=>economySnapshot(next,{kind:'consume',item:'potion',sequence:3})).toThrow('状态充足');
    next=economySnapshot(next,{kind:'consume',item:'tea',sequence:3});expect(next.player.stamina).toBe(200);
    expect(next.player.hp).toBe(200);expect(state.bag[0]?.count).toBe(3);
  });
  it('泉水、旅馆休息、住宿分别填充两项成长上限且保留里程', () => {
    const state=trained();state.player.x=680;state.player.y=920;
    const spring=springSnapshot(state,safe);expect(spring.player).toMatchObject({hp:104,stamina:108});
    expect(()=>springSnapshot(spring,safe)).toThrow('已满');
    const rest=economySnapshot(state,{kind:'rest',shop:'inn',quantity:1,sequence:1});
    expect(rest.player).toMatchObject({hp:104,stamina:108});expect(rest.physique).toEqual(state.physique);
    expect(()=>economySnapshot(rest,{kind:'rest',shop:'inn',quantity:1,sequence:2})).toThrow('已满');
    Object.assign(state.player,VILLAGE_ANCHORS.inn);state.time=1260;
    const sleep=sleepSnapshot(state,1,{action:false,threat:false,projectile:false,conflict:false});
    expect(sleep.player).toMatchObject({hp:104,stamina:108});expect(sleep.physique).toEqual(state.physique);
  });
  it('符文固定体力回复与凰心百分比回复读取动态上限', () => {
    const state=trained(347500);state.runes.owned=['r17','r30'];state.runes.slots=['r17','r30',null,null,null];state.player.stamina=150;
    const engine=new RuneCombat({state:()=>state,targets:()=>[],A:()=>10,clear:()=>true,blocker:()=>null,visible:()=>true,damage:()=>({applied:false,damage:0,killed:false}),push:()=> 'moved',sound:()=>{},checkpoint:()=>{}});
    engine.block(true,'成长格挡',state.player);
    expect(state.player.stamina).toBe(Math.min(200,150+runeById('r17')!.config.stamina));
    const config=runeById('r30')!.config;
    expect(engine.damaged(undefined,0,200)).toBe(200*config.heal);
    for(let n=0;n<300;n++)engine.advance(20);
    expect(state.player.hp).toBeCloseTo(200*(config.heal+6*config.regen));
  });
  it('保存失败保留内存成长和上一有效快照，后续保存可落盘且不重发', async () => {
    const state=initialState();let disk=structuredClone(state),fail=true;
    const queue=new SaveQueue(async snapshot=>{if(fail)throw Error('固定基准：保存失败');disk=structuredClone(snapshot);});
    recordRunDistance(state,{x:0,y:0},{x:16000,y:0},true);
    await expect(queue.enqueue(state,true)).rejects.toThrow('保存失败');
    expect(disk.physique.runDistance).toBe(0);expect(playerVitals(state).maxStamina).toBe(101);
    expect(queue.snapshot().dirty).toBe(true);fail=false;await queue.enqueue(state,true);
    expect(disk).toEqual(state);expect(queue.snapshot().dirty).toBe(false);
    expect(playerVitals(validate(disk)).maxStamina).toBe(101);
  });
});
