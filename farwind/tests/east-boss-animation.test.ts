import {describe,it,expect} from 'vitest';
import {EastBossAnimation,eastDirection,eastAttackTime,eastFrameAt,type EastAtlas} from '../src/game/systems/eastBossAnimation';
import {createBossAttack} from '../src/game/systems/campBossCombat';
import {initialBossBattle,shiftBossAttack,shiftBossBattle} from '../src/game/systems/campBossState';
import {enemyNavigation,type EnemyBody} from '../src/game/systems/enemy';
import {SlimeAnimation} from '../src/game/systems/slimeAnimation';
import type {EnemyPose} from '../src/game/systems/enemyAnimation';
const base:EnemyPose={action:'idle',frame:0,index:0,facing:0,phase:'idle',elapsed:0,provisional:true};
function boss():EnemyBody{return {id:'boss-bound-branch',boss:'bound-branch',type:'leaf',x:0,y:0,homeX:0,homeY:0,hp:2500,cool:0,windup:0,ai:'警戒',face:{x:0,y:1},nav:enemyNavigation(),bossBattle:{...initialBossBattle(0),entryUntil:0,move:0,part:0}};}
describe('东侧首领真实战斗时钟动画',()=>{
 it('只读预取覆盖藤刺换手和末刺退出，不改攻击、实体或播放器进度',()=>{
  const e=boss(),b=e.bossBattle!;b.move=8;b.part=6;
  const a=createBossAttack(e,2000,{x:0,y:100},b),player=new EastBossAnimation(),now=a.recoveryUntil-40;
  player.sample(e,a,now,base,0);const before=JSON.stringify({e,a,player});
  const predicted=player.forecast(e,a,now,base,0);
  expect(predicted.some(p=>p.clip==='vine-right')).toBe(true);expect(JSON.stringify({e,a,player})).toBe(before);
  b.part=7;const last=createBossAttack(e,4000,{x:0,y:100},b);player.sample(e,last,last.activeUntil-40,base,0);
  const tail=player.forecast(e,last,last.activeUntil-40,base,0);expect(tail.some(p=>p.clip==='vine-exit')).toBe(true);expect(tail.some(p=>p.clip==='vine-left')).toBe(false);
 });
 it('预取遵守已经取消的攻击以及正式待机循环，不续播下一击',()=>{
  const e=boss();e.bossBattle!.move=8;const a=createBossAttack(e,2000,{x:0,y:100},e.bossBattle!);a.cancelled=true;
  const player=new EastBossAnimation();player.sample(e,a,1180,base,0);const predicted=player.forecast(e,a,1180,base,0);
  expect(predicted.every(p=>!p.clip.startsWith('vine-'))).toBe(true);expect(predicted.some(p=>p.clip==='idle'&&p.time<100)).toBe(true);
 });
 it('预取排定藤刺起手，不把开场当成双镰，也不决定尚未排定的选招',()=>{
  const e=boss(),player=new EastBossAnimation();e.bossBattle!.move=8;e.bossBattle!.nextAt=1400;
  player.sample(e,null,1000,base,0);expect(player.forecast(e,null,1000,base,0).some(p=>p.clip==='vine-enter')).toBe(true);
  e.bossBattle!.move=-1;expect(player.forecast(e,null,1000,base,0).every(p=>!p.clip.startsWith('vine-')&&!p.clip.startsWith('cross-'))).toBe(true);
 });
 it('同伴独占大招时不预取被阻止的施法，移动时持续预取真实步态',()=>{
  const e=boss(),peer=boss(),player=new EastBossAnimation();peer.id='peer';e.bossClone={owner:'peer',attempt:0,serial:0};e.eastPeers=[peer,e];peer.bossBattle!.eastMajorUntil=10000;e.bossBattle!.move=8;e.bossBattle!.nextAt=1000;
  player.sample(e,null,1000,base,0);expect(player.forecast(e,null,1000,base,0).every(p=>!p.clip.startsWith('vine-'))).toBe(true);
  e.bossBattle!.move=0;e.eastMotion={speed:50,heading:0,distance:0,now:1000};const walk={...base,action:'walk'} as EnemyPose;player.sample(e,null,1000,walk,0);
  expect(player.forecast(e,null,1000,walk,0).some(p=>p.clip==='walk')).toBe(true);expect(player.forecast(e,null,1000,walk,0).some(p=>p.clip.startsWith('cross-'))).toBe(false);
 });
 it.each([1,2] as const)('第 %i 阶段的命中与收势对齐同一美术关键帧',phase=>{
  const e=boss(),b=e.bossBattle!;b.phase=phase;const a=createBossAttack(e,2000,{x:0,y:100},b);
  expect(eastAttackTime(a,a.startedAt)).toBe(0);expect(eastAttackTime(a,a.lockAt)).toBe(400);expect(eastAttackTime(a,a.contactAt)).toBe(750);expect(eastAttackTime(a,a.activeUntil)).toBe(950);expect(eastAttackTime(a,a.recoveryUntil)).toBe(1030);
 });
 it('第一刀之后实际间隔保持换手姿势，第二刀不从待机开始',()=>{
  const e=boss(),player=new EastBossAnimation(),a=createBossAttack(e,2000,{x:0,y:100},e.bossBattle!);
  expect(player.sample(e,a,a.contactAt,base,0).clip).toBe('cross-left');e.bossBattle!.part=1;e.bossBattle!.nextAt=a.recoveryUntil+160;
  expect(player.sample(e,null,a.recoveryUntil+80,base,0).clip).toBe('cross-link');
  const second=createBossAttack(e,e.bossBattle!.nextAt,{x:0,y:100},e.bossBattle!);expect(player.sample(e,second,second.startedAt,base,0)).toMatchObject({clip:'cross-right',time:0});
 });
 it.each([1,2,3,5,6])('招式 %i 在真实起手、持续及收势时刻选对片段',skill=>{
  const e=boss();e.bossBattle!.move=skill;const a=createBossAttack(e,2000,{x:0,y:100},e.bossBattle!),player=new EastBossAnimation();
  expect(player.sample(e,a,a.contactAt-1,base,0).clip).toMatch(/-enter$/);expect(player.sample(e,a,a.contactAt,base,0).clip).toMatch(/-hold$/);expect(player.sample(e,a,a.activeUntil,base,0).clip).toMatch(/-exit$/);
 });
 it('暂停重复采样保持帧位置，所有采样不修改实体和攻击',()=>{
  const e=boss(),a=createBossAttack(e,2000,{x:50,y:100},e.bossBattle!),player=new EastBossAnimation(),before=structuredClone({e,a});const p=player.sample(e,a,2510,base,0);
  expect(player.sample(e,a,2510,base,0)).toEqual(p);expect({e,a}).toEqual(before);
 });
 it('死亡优先于攻击和转换；取消攻击不再显示出手',()=>{
  const e=boss(),a=createBossAttack(e,2000,{x:0,y:100},e.bossBattle!),player=new EastBossAnimation();a.cancelled=true;
  expect(player.sample(e,a,a.contactAt,base,0).clip).not.toContain('cross');e.hp=0;e.bossBattle!.transformUntil=9000;
  expect(player.sample(e,a,3000,{...base,action:'death',elapsed:300},0)).toMatchObject({clip:'death',time:300});
 });
 it('弹反归一到真实失衡时长，结束后服从正式暴露窗口',()=>{
  const e=boss(),player=new EastBossAnimation();e.parried={at:2000,until:2800,direction:{x:0,y:1},perfect:true};e.bossBattle!.exposedUntil=4000;
  expect(player.sample(e,null,2400,base,0)).toMatchObject({clip:'perfect-left',time:500});expect(player.sample(e,null,2800,base,0).clip).toBe('exposed');
 });
 it('失衡暴露窗口优先于尚未结束的双镰组合',()=>{const e=boss();Object.assign(e.bossBattle!,{move:0,part:1,nextAt:4000,exposedUntil:4000});expect(new EastBossAnimation().sample(e,null,3000,base,0).clip).toBe('exposed');});
 it('保存相对时钟再恢复后保留攻击相位',()=>{const e=boss(),a=createBossAttack(e,2000,{x:0,y:100},e.bossBattle!),now=2700,delta=100000;const before=new EastBossAnimation().sample(e,a,now,base,0);e.bossBattle=shiftBossBattle(e.bossBattle!,delta);expect(new EastBossAnimation().sample(e,shiftBossAttack(a,delta),now+delta,base,0)).toEqual(before);});
 it('步态按距离推进，零位移不随渲染帧率前进',()=>{
  const e=boss(),p=new EastBossAnimation(),walk={...base,action:'walk'} as EnemyPose;p.sample(e,null,1000,walk,0);
  const a=p.sample(e,null,1300,walk,18),b=p.sample(e,null,1400,walk,18);expect(a.time).toBe(b.time);expect(p.sample(e,null,1500,walk,30).time).toBeGreaterThan(b.time);
 });
 it.each([[0,1,0],[1,1,1],[1,0,2],[1,-1,3],[0,-1,4],[-1,-1,5],[-1,0,6],[-1,1,7]])('旧攻击朝向不覆盖实际移动 %i,%i', (x,y,direction)=>{
  const e=boss(),p=new EastBossAnimation(),motion=new SlimeAnimation();e.face={x:-x,y:-y};
  p.sample(e,null,1000,motion.sample(e,null,1000),motion.distance);
  e.x+=x;e.y+=y;
  expect(p.sample(e,null,1016,motion.sample(e,null,1016),motion.distance).direction).toBe(direction);
  for(const now of [1032,1300,1600])expect(p.sample(e,null,now,motion.sample(e,null,now),motion.distance).direction).toBe(direction);
  const a=createBossAttack(e,2000,{x:e.x-x*100,y:e.y-y*100},e.bossBattle!);
  expect(p.sample(e,a,2000,motion.sample(e,a,2000),motion.distance).direction).toBe((direction+4)%8);
 });
 it('八方向边界具有回差，左右方向使用不同编号',()=>{
  expect(eastDirection(1,0)).toBe(2);expect(eastDirection(-1,0)).toBe(6);expect(eastDirection(0,-1)).toBe(4);expect(eastDirection(Math.sin(.4),Math.cos(.4),0)).toBe(0);expect(eastDirection(Math.sin(.5),Math.cos(.5),0)).toBe(1);
 });
 it('逐帧选择支持不等间隔和末帧停留，掉帧不累积播放误差',()=>{
  const m={clips:{cut:{duration:100,loop:false,directions:{0:[{at:0,frame:'a'},{at:20,frame:'b'},{at:50,frame:'c'},{at:100,frame:'d'}]}}},frames:{a:{page:0},b:{page:0},c:{page:1},d:{page:1}}} as unknown as EastAtlas;
  expect(eastFrameAt(m,{clip:'cut',time:55,direction:0,phase:''})?.id).toBe('c');expect(eastFrameAt(m,{clip:'cut',time:200,direction:0,phase:''})?.id).toBe('d');
 });
});
