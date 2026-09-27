import {describe,it,expect} from 'vitest';
import {enemyDefs} from '../src/data/world';
import {motionBlocked} from '../src/game/systems/obstacles';
import {ENEMIES} from '../src/data/enemies';
import {createEnemyAttack,advanceEnemyAttack,predictEnemyContact,sampleEnemyAttack,sporeContactAt,SPORE} from '../src/game/systems/enemyAttack';
import {EnemyProjectiles} from '../src/game/systems/enemyProjectiles';
import {EnemyAnimation} from '../src/game/systems/enemyAnimation';
import {CombatController} from '../src/game/systems/combat';
import {adjudicateContact} from '../src/game/systems/contact';
import {updateEnemy,enemyNavigation,type EnemyBody} from '../src/game/systems/enemy';
import {validate,initialState} from '../src/game/systems/state';
const open={blocked:()=>false,clear:()=>true,melee:()=>true};
describe('五怪共享真实战斗边界',()=>{
  for(const kind of Object.keys(ENEMIES))it(`${kind}锁向只占前摇末段且锁向后不追踪`,()=>{
    const root={x:850,y:700},p={x:1000,y:700},a=createEnemyAttack('one',1,kind,0,root,p);
    advanceEnemyAttack(a,root,p,a.lockAt,open);const direction={...a.direction};advanceEnemyAttack(a,root,{x:850,y:500},a.lockAt+5,open);
    expect(a.direction).toEqual(direction);expect(a.lockAt).toBeLessThan(a.contactAt);expect(sampleEnemyAttack(a,a.lockAt,root).phase).toBe('commit');
  });
  it('林豕撞墙停在合法根、取消冲锋，且不会滑墙继续伤害',()=>{
    const root={x:0,y:0},target={x:500,y:0},a=createEnemyAttack('boar',1,'boar',0,root,target),space={blocked:(x:number)=>x>80,clear:(x:{x:number},y:{x:number})=>y.x<=80,melee:()=>true};
    expect(advanceEnemyAttack(a,root,target,a.activeUntil,space)).toBeNull();expect(root.x).toBeLessThanOrEqual(80);expect(root.x).toBeGreaterThan(79);
    expect(a.cancelled).toBe(true);expect(a.wallAt).toBeGreaterThan(a.contactAt);const before={...root};expect(advanceEnemyAttack(a,root,{x:81,y:0},1000,space)).toBeNull();expect(root).toEqual(before);
  });
  it('撞墙小段内较早的玩家接触仍先结算',()=>{
    const root={x:0,y:0},target={x:130,y:0},a=createEnemyAttack('boar',1,'boar',0,root,target),space={blocked:(x:number)=>x>80,clear:(_:unknown,p:{x:number})=>p.x<=80,melee:()=>true};
    const event=advanceEnemyAttack(a,root,target,a.activeUntil,space);expect(event).not.toBeNull();expect(a.cancelled).toBe(false);expect(root.x).toBeCloseTo(78,4);
  });
  it('家园软边界停止冲锋，但不能在空地冒出撞墙硬直',()=>{
    const root={x:0,y:0},a=createEnemyAttack('boar',1,'boar',0,root,{x:500,y:0});
    const space={blocked:(x:number)=>x>80,clear:()=>true,melee:()=>true,wall:()=>false};
    expect(advanceEnemyAttack(a,root,{x:500,y:0},a.activeUntil,space)).toBeNull();expect(a.cancelled).toBe(true);expect(a.wallAt).toBeUndefined();expect(root.x).toBeLessThanOrEqual(80);
  });
  it('新物种冷却与追击仍受旧家园边界约束',()=>{
    for(const type of ['spore','boar','raven']){
      const e:EnemyBody={id:type,type,x:850,y:700,hp:60,homeX:850,homeY:700,cool:0,windup:0,staggerUntil:0,nav:enemyNavigation(),ai:'家园',disabled:false,recovered:false};
      updateEnemy(e,{x:850,y:1500},10,10);expect(e.attack).toBeUndefined();expect(e.x).toBe(850);
    }
  });
});
describe('孢子独立飞行与弹反',()=>{
  it('不造成喷口第二份近战伤害，锁向弹丸有真实飞行时间',()=>{
    const root={x:850,y:700},p={x:1080,y:700},a=createEnemyAttack('spore',1,'spore',0,root,p),system=new EnemyProjectiles();
    advanceEnemyAttack(a,root,p,a.lockAt,open);const predicted=predictEnemyContact(a,root,p,0,open)!;
    expect(advanceEnemyAttack(a,root,p,a.contactAt,open)).toBeNull();system.launch(a,root,a.contactAt);system.launch(a,root,a.contactAt+5);expect(system.shots).toHaveLength(1);
    expect(system.update(a.contactAt+100,p,()=>true)).toEqual([]);const events=system.update(predicted+5,p,()=>true);expect(events).toHaveLength(1);expect(events[0].at).toBeCloseTo(predicted,5);
    expect(events[0].projectileId).toBeTruthy();expect(system.update(predicted+50,p,()=>true)).toEqual([]);
  });
  it('已放出弹丸不依赖本体攻击或生命，墙阻挡与寿命会清理',()=>{
    const a=createEnemyAttack('spore',1,'spore',0,{x:0,y:0},{x:300,y:0}),system=new EnemyProjectiles();system.launch(a,{x:0,y:0},a.contactAt);a.cancelled=true;
    expect(system.update(a.contactAt+100,{x:300,y:0},()=>false)).toEqual([]);expect(system.shots[0].state).toBe('burst');system.update(a.contactAt+SPORE.burst+101,{x:300,y:0});expect(system.shots).toEqual([]);
    const b=createEnemyAttack('spore',2,'spore',0,{x:0,y:0},{x:500,y:0});system.launch(b,{x:0,y:0},b.contactAt);system.update(b.contactAt+SPORE.life+300,{x:10000,y:0},()=>true);system.update(b.contactAt+SPORE.life+600,{x:10000,y:0},()=>true);expect(system.shots).toEqual([]);
  });
  it('弹丸用正式架剑方向、时窗和单次奖励，成功进入打散而非反伤本体',()=>{
    const a=createEnemyAttack('spore',1,'spore',0,{x:850,y:700},{x:1080,y:700}),system=new EnemyProjectiles();system.launch(a,{x:850,y:700},a.contactAt);
    const at=sporeContactAt(system.shots[0],a.direction,{x:1080,y:700},a.contactAt,a.contactAt+SPORE.life,()=>true)!,p={x:1080,y:700,stamina:100},c=new CombatController();c.requestParry(at-40,2);c.flushActions(at-40,p);
    const contact=system.update(at+1,p,()=>true)[0],result=adjudicateContact(contact,c,p,{valid:true,immune:false,clear:()=>true});expect(result).toBe('perfect');const stamina=p.stamina;
    expect(adjudicateContact(contact,c,p,{valid:true,immune:false,clear:()=>true})).toBe('invalid');expect(p.stamina).toBe(stamina);
    system.settle(contact.projectileId!,at,true);expect(system.shots[0]).toMatchObject({state:'burst',deflected:true});expect(a.cancelled).toBe(false);
    system.reset();expect(system.shots).toEqual([]);
  });
});
describe('独立连续姿态映射',()=>{
  it('所有方向与攻击阶段落在各自独立图集块，左右只镜像',()=>{
    for(const type of ['leaf','spore','boar','raven'])for(const facing of [{x:0,y:1},{x:0,y:-1},{x:1,y:0},{x:-1,y:0}]){
      const body={x:850,y:700,hp:60,type},a=createEnemyAttack('a',1,type,0,body,{x:body.x+facing.x,y:body.y+facing.y}),anim=new EnemyAnimation();a.locked=true;const frames=[];
      for(let now=0;now<a.recoveryUntil;now+=5)frames.push(anim.sample(body,a,now));
      expect(new Set(frames.map(p=>p.index)).size).toBe(8);const direction=facing.y>0?0:facing.y<0?1:2,block=ENEMIES[type as keyof typeof ENEMIES].frames;
      expect(frames.every(p=>p.frame>=direction*block+8&&p.frame<direction*block+16)).toBe(true);
    }
  });
  it('林豕撞墙、被弹反与死亡各有姿态，死亡和弹反优先',()=>{
    const anim=new EnemyAnimation(),body={x:850,y:700,hp:90,type:'boar',wallHit:{at:0,until:850}};
    expect(anim.sample(body,null,100).action).toBe('wall');const hit={...body,parried:{at:110,until:910,direction:{x:0,y:1},perfect:true}};
    expect(anim.sample(hit,null,200).action).toBe('perfect');expect(anim.sample({...hit,hp:0},null,250).action).toBe('death');
  });
  it('受击姿态只覆盖真实硬直，恢复后的有效攻击可见',()=>{
    const anim=new EnemyAnimation(),body={x:850,y:700,hp:60,type:'spore',staggerUntil:0},a=createEnemyAttack('a',1,'spore',0,body,{x:1000,y:700});
    anim.sample(body,a,500);body.hp=42;body.staggerUntil=580;expect(anim.sample(body,a,505).action).toBe('hurt');expect(anim.sample(body,a,580).action).toBe('attack');
  });
  it('新增出生点均可站立，不靠修复传送掩盖错误',()=>{for(const e of enemyDefs)expect(motionBlocked(e.x,e.y),e.id).toBe(false);});
  it('新增林地与原主线出生点保留接近空间，避免在入口叠加三种追击',()=>{
    const fresh=enemyDefs.filter(e=>['spore','boar','raven'].includes(e.type));
    for(const e of fresh)for(const other of enemyDefs)if(other!==e)expect(Math.hypot(e.x-other.x,e.y-other.y),`${e.id}与${other.id}`).toBeGreaterThanOrEqual(500);
  });
  it('旧存档与原主线ID仍有效，新增物种不要求存档结构升级',()=>{const s=initialState();s.killed=['slime-1','leaf-1'];expect(()=>validate(structuredClone(s))).not.toThrow();});
});
