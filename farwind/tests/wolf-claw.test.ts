import {describe,it,expect} from 'vitest';
import {CAMP_BOSSES} from '../src/data/maps/windbell/campBosses';
import {createBossAttack} from '../src/game/systems/campBossCombat';
import {initialBossBattle,shiftBossAttack} from '../src/game/systems/campBossState';
import {advanceEnemyAttack,predictEnemyContact,sampleEnemyAttack,geometryTouches} from '../src/game/systems/enemyAttack';
import {previewWarning} from '../src/game/entities/attackWarningView';
import {CampBossEffects} from '../src/game/entities/campBossEffects';
import {sampleWolfClaw,deformWolfClaw,wolfClawSkin} from '../src/game/systems/wolfClaw';
import type {EnemyBody} from '../src/game/systems/enemy';
const space={blocked:()=>false,clear:()=>true,melee:()=>true};
function setup(direction={x:1,y:0},part=0,phase:1|2=1){
 const body={id:'狼爪专项',boss:'thorn-crown',type:'wolf',hp:2800,x:0,y:0,bossBattle:{...initialBossBattle(0),move:1,part,phase},face:direction} as EnemyBody;
 const attack=createBossAttack(body,0,{x:direction.x*100,y:direction.y*100},body.bossBattle!);return {body,attack};
}
function effects(){let ink:any;ink=new Proxy({}, {get:()=>()=>ink});return new CampBossEffects({add:{graphics:()=>ink}} as any);}
describe('狼爪挥击、波刃和正式命中共用时钟',()=>{
 it.each(['right','down','up'])('%s 前爪真正抬离地面并大幅挥出，相邻时刻没有跳姿势',view=>{
  for(const part of [0,1]){const direction=view==='right'?{x:1,y:0}:{x:0,y:view==='down'?1:-1},{attack}=setup(direction,part),skin=wolfClawSkin(view,part),tip=(now:number)=>deformWolfClaw(skin,skin.tip,sampleWolfClaw(attack,now,view)),rest=tip(0),raised=tip(attack.contactAt-160),released=tip(attack.contactAt);
   expect((rest.y-raised.y)*210).toBeGreaterThan(35);expect(Math.hypot(released.x-raised.x,released.y-raised.y)*210).toBeGreaterThan(45);expect(((released.x-raised.x)*direction.x+(released.y-raised.y)*direction.y)*210).toBeGreaterThan(25);
   let previous=rest;for(let now=1;now<=attack.recoveryUntil;now++){const current=tip(now);expect(Math.hypot(current.x-previous.x,current.y-previous.y)*210).toBeLessThan(4);previous=current;}expect(tip(attack.recoveryUntil)).toEqual(rest);
  }
 });
 it.each([0,1])('第%d爪只在伸爪后释放，向外飞离固定释放点且取消后消失',part=>{
  for(const direction of [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}]){const {body,attack}=setup(direction,part),fx=effects(),before=structuredClone(attack),draw=(now:number)=>{fx.begin();fx.draw(body,attack,now);return structuredClone(fx.snapshot().effects);};
   expect(draw(attack.contactAt-1).map(e=>e.kind)).toEqual(['爪尖蓄光']);const release=draw(attack.contactAt)[0],later=draw(attack.contactAt+280)[0];
   expect(release.kind).toBe('挥出爪风');expect(release.point).toEqual(release.origin);expect(later.origin).toEqual(release.origin);expect(later.travel).toBeGreaterThan(60);
   expect((later.point.x-release.point.x)*later.direction!.x+(later.point.y-release.point.y)*later.direction!.y).toBeGreaterThan(55);
   expect(draw(attack.contactAt+280)).toEqual([later]);expect(attack).toEqual(before);attack.cancelled=true;expect(draw(attack.contactAt+300)).toEqual([]);
  }
 });
 it.each([1,2] as const)('阶段%d的远处目标等待波刃到达，预测与实际一致，地面预警覆盖终点',phase=>{
  for(const part of [0,1]){const {body,attack}=setup({x:1,y:0},part,phase),first=sampleEnemyAttack(attack,attack.contactAt,body).geometry,d=first.direction!,target={x:d.x*245,y:d.y*245},warning=previewWarning(attack,body,space),before=structuredClone(attack);
   expect(geometryTouches(first,target)).toBe(false);expect(geometryTouches(warning,target)).toBe(true);expect(warning.radius).toBe(260);
   const predicted=predictEnemyContact(attack,body,target,0,space);expect(attack).toEqual(before);expect(predicted).toBeGreaterThan(attack.contactAt+200);
   expect(advanceEnemyAttack(attack,body,target,attack.contactAt+200,space)).toBeNull();const event=advanceEnemyAttack(attack,body,target,attack.activeUntil,space)!;expect(event.at).toBeCloseTo(predicted!);expect(event.geometry!.radius).toBeCloseTo(245);
   expect(advanceEnemyAttack(attack,body,target,attack.activeUntil,space)).toBeNull();
   const distant=setup({x:1,y:0},part,phase);expect(predictEnemyContact(distant.attack,distant.body,{x:d.x*261,y:d.y*261},0,space)).toBeNull();
  }
 });
 it('障碍阻挡爪风，暂停、存档换时钟保持挥爪与飞行同一帧',()=>{
  const {body,attack}=setup(),fx=effects(),now=attack.contactAt+170;
  expect(predictEnemyContact(attack,body,{x:150,y:-80},0,{...space,melee:()=>false})).toBeNull();
  fx.draw(body,attack,now);const record=structuredClone(fx.snapshot()),shifted=shiftBossAttack(attack,40000);fx.begin();fx.draw(body,shifted,now+40000);expect(fx.snapshot()).toEqual(record);expect(sampleWolfClaw(shifted,now+40000)).toEqual(sampleWolfClaw(attack,now));
  expect(CAMP_BOSSES['thorn-crown'].height).toBe(210);
 });
});
