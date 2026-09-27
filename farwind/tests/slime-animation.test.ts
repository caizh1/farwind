import { describe, expect, it } from 'vitest';
import { SlimeAnimation, slimePose, SLIME_TIMES, timedPose } from '../src/game/systems/slimeAnimation';
import { createEnemyAttack } from '../src/game/systems/enemyAttack';

describe('史莱姆样片时间与地面根', () => {
  it('锁向属于真实前摇，出手与收招不提前', () => {
    const attack = createEnemyAttack('slime', 1, 'slime', 100, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(slimePose('attack', 3, 329, 0, attack).phase).toBe('charge');
    expect(slimePose('attack', 3, 330, 0, attack).phase).toBe('commit');
    expect(slimePose('attack', 3, 449, 0, attack).index).toBe(5);
    expect(slimePose('attack', 3, 450, 0, attack).phase).toBe('active');
    expect(slimePose('attack', 3, 550, 0, attack).phase).toBe('recovery');
    expect(slimePose('attack', 3, 809, 0, attack).index).toBe(11);
  });
  it('普通与精准弹反分别保留600和800毫秒，恢复帧继续可见', () => {
    expect(SLIME_TIMES.parry.reduce((a,b)=>a+b,0)).toBe(600);
    expect(SLIME_TIMES.perfect.reduce((a,b)=>a+b,0)).toBe(800);
    expect(timedPose(SLIME_TIMES.parry, 545)).toBe(10);
    expect(timedPose(SLIME_TIMES.parry, 599)).toBe(11);
    expect(timedPose(SLIME_TIMES.perfect, 470)).toBe(6);
    expect(timedPose(SLIME_TIMES.perfect, 799)).toBe(11);
  });
  it('静止、暂停、传送和受击击退都不累计移动步态', () => {
    const motion = new SlimeAnimation(), body = { x: 0, y: 0, hp: 48 };
    motion.sample(body, null, 0);
    expect(motion.sample(body, null, 16).action).toBe('idle');
    body.x += 1; expect(motion.sample(body, null, 32).action).toBe('walk');
    expect(motion.distance).toBe(1);
    body.x += 500; expect(motion.sample(body, null, 48).action).toBe('idle');
    body.x += 6; body.hp -= 12; expect(motion.sample(body, null, 64).action).toBe('hurt');
    expect(motion.distance).toBe(1);
    motion.sample(body, null, 64); expect(motion.distance).toBe(1);
  });
  it('不同采样频率下，同样自主位移得到同一移动姿态', () => {
    const run = (hz: number) => {
      const m = new SlimeAnimation(); m.sample({x:0,y:0,hp:48},null,0);
      for (let i=1;i<=hz;i++) m.sample({x:60*i/hz,y:0,hp:48},null,1000*i/hz);
      return { distance:m.distance, pose:slimePose('walk',m.facing,1000,m.distance) };
    };
    const a=run(60),b=run(120); expect(a.distance).toBeCloseTo(b.distance,8); expect(a.pose.frame).toBe(b.pose.frame);
  });
  it('弹反优先于同时受伤，死亡优先于弹反，根坐标不被表现采样改写', () => {
    const m = new SlimeAnimation(), body={x:20,y:30,hp:48,parried:undefined as {at:number;until:number;direction:{x:number;y:number};perfect:boolean}|undefined};
    m.sample(body,null,0); body.hp=24; body.parried={at:20,until:620,direction:{x:0,y:-1},perfect:false};
    expect(m.sample(body,null,20).action).toBe('parry'); expect(m.facing).toBe(1);
    body.hp=0; expect(m.sample(body,null,40).action).toBe('death');
    expect(m.sample(body,null,1400).index).toBe(7); expect([body.x,body.y]).toEqual([20,30]);
  });
  it('重开会话后清除旧受击和死亡计时；上下独立，左右共用侧向帧', () => {
    const m=new SlimeAnimation(); m.sample({x:0,y:0,hp:48},null,1000); m.sample({x:0,y:0,hp:0},null,1100);
    expect(m.sample({x:0,y:0,hp:48},null,0).action).toBe('idle');
    expect(slimePose('idle',0,0).frame).not.toBe(slimePose('idle',1,0).frame);
    expect(slimePose('idle',2,0).frame).toBe(slimePose('idle',3,0).frame);
  });
});
