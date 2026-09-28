import {describe,it,expect} from 'vitest';
import sharp from 'sharp';
import {CombatController,PLAYER_HURT,type ActionKind} from '../src/game/systems/combat';
import {hurtVisual} from '../src/data/animation';
import {motionBlocked,clearMotionLine} from '../src/game/systems/obstacles';
import {props,propBounds} from '../src/data/world';

const tick=(c:CombatController,prev:number,now:number,p:{x:number;y:number},blocked=(x:number,_y:number)=>false,clear=(_a:{x:number;y:number},_b:{x:number;y:number})=>true)=>
  c.update(prev,now,0,p,[],blocked,()=>true,()=>{throw Error('受击期间不应命中');},()=>{},()=>{},clear);

describe('主角真实受击后的动作和位移',()=>{
  it('清除旧攻击和预约，保留风步冷却；硬直内的三种输入全部丢弃',()=>{
    for(const kind of ['attack','parry','dash'] as ActionKind[]) {
      const c=new CombatController(),p={x:0,y:0,stamina:100};
      c.requestAttack(0);tick(c,0,0,p);c.requestAttack(50);c.dashCooldown=500;
      c.takeHit(100,3,{x:-1,y:0},p);
      expect(c.attack).toBeNull();expect(c.pending).toBe(false);expect(c.hurtReaction?.until).toBe(320);
      expect(c.dashCooldown).toBe(500);
      for(const now of [100,200,319.999]) {
        c.requestActions([{kind,at:now,sequence:1,axis:{x:1,y:0}}],now,p,3);
        c.requestAttack(now);expect(c.requestParry(now,0)).toBe(false);expect(c.requestDash(now,100,{x:1,y:0},3)).toBe(false);
        expect(c.flushActions(now,p)).toEqual([]);tick(c,now,now,p);
        expect(c.attack).toBeNull();expect(c.parry).toBeNull();expect(c.dashPending).toBeNull();expect(c.pending).toBe(false);
      }
      tick(c,100,320,p);expect(c.attack).toBeNull();expect(p.stamina).toBe(100);
      c.requestAttack(320);tick(c,320,320,p);expect(c.attack?.stage).toBe(1);
    }
  });
  it('边界之后新按才能出招；重置清理硬直、姿态和击退',()=>{
    const c=new CombatController(),p={x:10,y:20,stamina:100};c.takeHit(0,1,{x:0,y:1},p);
    expect(c.hurting(219.999)).toBe(true);expect(c.hurting(220)).toBe(false);
    expect(c.nextBoundary(140)).toBe(220);
    expect(c.requestParry(220,1)).toBe(true);expect(c.flushActions(220,p)).toEqual(['parry']);
    c.reset(650);tick(c,0,300,p);expect(p).toMatchObject({x:10,y:20});expect(c.hurtReaction).toBeNull();expect(c.actionLockUntil).toBe(0);expect(c.dashCooldown).toBe(650);
  });
  it('30／60／120帧和长帧均沿来袭方向累计14像素，无自主步态或方向反转',()=>{
    for(const step of [1000/30,1000/60,1000/120,500]) {
      const c=new CombatController(),p={x:0,y:0};c.takeHit(0,2,{x:3,y:4},p);
      for(let prev=0;prev<300;){const now=Math.min(300,prev+step);tick(c,prev,now,p);prev=now;}
      expect(p.x).toBeCloseTo(8.4,8);expect(p.y).toBeCloseTo(11.2,8);expect(c.hurtReaction?.facing).toBe(2);
      tick(c,300,900,p);expect(Math.hypot(p.x,p.y)).toBeCloseTo(14,8);
    }
  });
  it('击退不穿过贴墙位置或禁止通过的边，阻挡不会积蓄下一帧位移',()=>{
    const c=new CombatController(),p={x:0,y:0};c.takeHit(0,3,{x:1,y:0},p);
    tick(c,0,110,p,x=>x>5);expect(p.x).toBeLessThanOrEqual(5);expect(p.y).toBe(0);
    tick(c,110,220,p);expect(p.x).toBeLessThanOrEqual(5);
    const b=new CombatController(),q={x:0,y:0};b.takeHit(0,0,{x:0,y:1},q);
    tick(b,0,220,q,()=>false,()=>false);expect(q).toEqual({x:0,y:0});
  });
  it('正式地图树干碰撞和世界边缘也拦住击退',()=>{
    const tree=props.find(p=>p.id==='tree-14')!,bounds=propBounds(tree,true);
    const points=[{x:bounds.left-1,y:(bounds.top+bounds.bottom)/2,direction:{x:1,y:0}},{x:31,y:100,direction:{x:-1,y:0}}];
    for(const point of points){const p={x:point.x,y:point.y},c=new CombatController();expect(motionBlocked(p.x,p.y)).toBe(false);
      c.takeHit(0,3,point.direction,p);for(let prev=0;prev<220;prev+=5)tick(c,prev,prev+5,p,motionBlocked,clearMotionLine);
      expect(motionBlocked(p.x,p.y)).toBe(false);expect(Math.hypot(p.x-point.x,p.y-point.y)).toBeLessThan(2);
    }
  });
  it('三阶段同一脚底锚点；左右共享侧向帧，面向锁定到恢复结束',()=>{
    for(const facing of [0,1,2,3] as const) {
      const c=new CombatController();c.takeHit(10,facing,{x:1,y:0},{x:10,y:20});
      for(const [elapsed,pose] of [[0,0],[54.999,0],[55,1],[139.999,1],[140,2],[219.999,2]]) {
        const visual=hurtVisual(c.hurtReaction!,10+elapsed);
        expect(visual.frameIndex).toBe(pose);expect(visual.facing).toBe(facing);expect(visual.phase).toBe('hurt');expect(visual.texture).toBe('hero-hurt');expect(visual.weapon).toBeUndefined();
      }
    }
  });
  it('九帧透明素材完整、互不重复，脚底落在统一根附近',async()=>{
    const {data,info}=await sharp('public/assets/animation/hero-hurt.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
    expect([info.width,info.height]).toEqual([480,480]);
    const frames=new Set<string>();
    for(let row=0;row<3;row++)for(let pose=0;pose<3;pose++) {
      let count=0,bottom=0;
      for(let y=0;y<160;y++)for(let x=0;x<160;x++)if(data[((row*160+y)*480+pose*160+x)*4+3]>12){count++;bottom=Math.max(bottom,y);}
      expect(count).toBeGreaterThan(2500);expect(bottom).toBeGreaterThanOrEqual(153);expect(bottom).toBeLessThanOrEqual(155);
      frames.add((await sharp('public/assets/animation/hero-hurt.png').extract({left:pose*160,top:row*160,width:160,height:160}).png().toBuffer()).toString('base64'));
    }
    expect(frames.size).toBe(9);expect(PLAYER_HURT.duration).toBe(220);
  });
});
