import {beforeEach,describe,expect,it,vi} from 'vitest';
import {ENEMY_PURSUIT,enemyLeashRadius,enemyAttackPermitted,enemyAttackSpace,enemyNavigation,updateEnemy,type EnemyBody} from '../src/game/systems/enemy';
import {BOSS_PURSUIT} from '../src/data/enemyPursuit';
import {CAMP_BOSSES,type CampBossKind} from '../src/data/maps/windbell/campBosses';
import {initialBossBattle} from '../src/game/systems/campBossState';
import {createBossAttack} from '../src/game/systems/campBossCombat';

// 只隔离地形输入；追击、计时、攻击和有界寻路仍运行正式实现。
const terrain=vi.hoisted(()=>({wall:false}));
vi.mock('../src/game/systems/obstacles',async importOriginal=>{
  const original=await importOriginal<typeof import('../src/game/systems/obstacles')>();
  const blocked=(x:number,y:number)=>terrain.wall&&x>=3550&&x<=3580&&y>=1410&&y<=1590;
  const clear=(a:{x:number;y:number},b:{x:number;y:number})=>{
    const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/4));
    return Array.from({length:steps+1},(_,i)=>i/steps).every(t=>!blocked(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t));
  };
  return {...original,motionBlocked:blocked,clearMotionLine:clear,clearMeleeLine:clear,meleeBlocker:()=>undefined};
});
const body=():EnemyBody=>({id:'pursuit-slime',type:'slime',hp:48,x:3300,y:1500,homeX:3300,homeY:1500,leashRadius:200,cool:0,windup:0,staggerUntil:0,nav:enemyNavigation(),ai:'家园',disabled:false,recovered:false});
const tick=(e:EnemyBody,p:{x:number;y:number},now:number,dt=20)=>updateEnemy(e,p,now,dt,{queries:2});
beforeEach(()=>{terrain.wall=false;});

describe('警戒、持续追击与脱战宽限',()=>{
  it('普通怪拉开一千距离、越过旧八百活动边界后仍追击',()=>{
    const e=body();e.nav.mode='chase';e.x=4200;
    tick(e,{x:4500,y:1500},1000);expect(e.nav.returning).toBe(false);expect(e.x).toBeGreaterThan(4200);
    const nearHome=body();nearHome.nav.mode='chase';tick(nearHome,{x:4300,y:1500},1000);
    expect(nearHome.nav.mode).toBe('chase');expect(nearHome.x).toBeGreaterThan(3300);
  });
  it.each(Object.keys(CAMP_BOSSES) as CampBossKind[])('%s：已入场首领持续追踪远处目标，并能越过营地小圈',kind=>{
    const e={...body(),boss:kind,type:CAMP_BOSSES[kind].type,hp:CAMP_BOSSES[kind].hp,bossBattle:initialBossBattle(0)};
    tick(e,{x:4300,y:1500},1000);expect(e.nav.mode).toBe('chase');expect(e.x).toBeGreaterThan(3300);expect(e.nav.returning).toBe(false);
    e.x=4200;tick(e,{x:4800,y:1500},1020);expect(e.x).toBeGreaterThan(4200);expect(e.nav.returning).toBe(false);
  });
  it('首领冲锋越过旧营地边界时不误判为撞墙失衡',()=>{
    const e={...body(),boss:'crag-tusk' as const,type:'boar',hp:2500,x:4000,bossBattle:initialBossBattle(0)},target={x:4200,y:1500};
    e.bossBattle.move=0;e.bossBattle.nextAt=0;e.attack=createBossAttack(e,1000,target,e.bossBattle);
    for(let now=1020;now<=2400;now+=20)tick(e,target,now);
    expect(e.x).toBeGreaterThan(4200);expect(e.wallHit).toBeUndefined();
  });
  it('未交战时仍不主动吸引五百距离外的怪物',()=>{
    const e=body();tick(e,{x:3800,y:1500},20);expect(e.x).toBe(3300);expect(e.nav.mode).not.toBe('chase');
  });
  it('玩家正常走开三秒，拉开超过旧距离并离开原活动圈后仍被追击',()=>{
    const e=body();let playerX=3500;
    for(let now=20;now<=3000;now+=20){playerX+=150*.02;tick(e,{x:playerX,y:1500},now);}
    expect(playerX-e.x).toBeGreaterThan(380);expect(e.x).toBeGreaterThan(e.homeX+170);expect(e.nav.mode).toBe('chase');expect(e.nav.returning).toBe(false);
  });
  it('首次近身攻击也建立追击记忆，收招后不会因拉开距离立即回家',()=>{
    const e=body();tick(e,{x:3340,y:1500},20);expect(e.attack).toBeTruthy();
    const end=e.attack!.recoveryUntil;tick(e,{x:3850,y:1500},end,end-20);tick(e,{x:3850,y:1500},end+20);
    expect(e.nav.mode).toBe('chase');expect(e.nav.returning).toBe(false);
  });
  it('远程怪站定等待冷却也保留交战记忆，玩家走开后仍能继续追击',()=>{
    const e=body();e.type='spore';e.cool=10000;
    tick(e,{x:3560,y:1500},20);expect(e.ai).toBe('等待冷却');expect(e.nav.mode).toBe('chase');
    tick(e,{x:3850,y:1500},40);expect(e.x).toBeGreaterThan(e.homeX);expect(e.nav.returning).toBe(false);expect(e.nav.mode).toBe('chase');
  });
  it('短暂丢失目标保留五秒追踪，再真正脱战返家',()=>{
    const e=body();tick(e,{x:3500,y:1500},1000,1000);const away={x:5500,y:1500};
    tick(e,away,1020);tick(e,away,1020+ENEMY_PURSUIT.lostDelay-1,ENEMY_PURSUIT.lostDelay-1);expect(e.nav.returning).toBe(false);expect(e.nav.mode).toBe('chase');
    tick(e,away,1020+ENEMY_PURSUIT.lostDelay,1);expect(e.nav.returning).toBe(true);expect(e.nav.mode).toBe('return');
  });
  it('宽限内目标回来会清除旧脱战计时',()=>{
    const e=body();tick(e,{x:3500,y:1500},1000,1000);tick(e,{x:5500,y:1500},1020);
    tick(e,{x:3800,y:1500},2020,1000);expect(e.nav.mode).toBe('chase');
    tick(e,{x:5500,y:1500},3020,1000);tick(e,{x:5500,y:1500},5020,2000);
    expect(e.nav.returning).toBe(false);expect(e.nav.mode).toBe('chase');
  });
  it('回撤中重新进入警戒范围即可再追击，无须走完返家路',()=>{
    const e=body();e.x=3600;e.nav.mode='return';e.nav.returning=true;
    tick(e,{x:3800,y:1500},1000);expect(e.nav.returning).toBe(false);expect(e.nav.mode).toBe('chase');expect(e.x).toBeGreaterThan(3600);
  });
  it('回撤中被远处玩家再次挑衅也会恢复追击',()=>{
    const e=body();e.x=3400;e.nav.mode='return';e.nav.returning=true;e.playerAggroUntil=2000;
    tick(e,{x:3900,y:1500},1000);expect(e.nav.returning).toBe(false);expect(e.nav.mode).toBe('chase');
  });
  it('扩大后的硬边界仍能返回，不在边缘反复追击',()=>{
    const e=body();e.x=e.homeX+enemyLeashRadius(e)+1;e.nav.mode='chase';const away={x:e.x+150,y:1500};
    for(let now=100;now<=30000;now+=100){tick(e,away,now,100);expect(e.nav.mode).not.toBe('chase');}
    expect(Math.hypot(e.x-e.homeX,e.y-e.homeY)).toBeLessThanOrEqual(8);
  });
  it('普通怪和首领的冲锋空间、目标资格使用各自统一的大范围',()=>{
    const e=body(),radius=enemyLeashRadius(e);expect(enemyAttackSpace(e).blocked(e.homeX+1000,1500)).toBe(false);expect(enemyAttackSpace(e).blocked(e.homeX+radius+1,1500)).toBe(true);
    expect(enemyAttackPermitted(e,{x:e.homeX+radius+50,y:1500})).toBe(true);expect(enemyAttackPermitted(e,{x:e.homeX+radius+101,y:1500})).toBe(false);
    const boss={...e,boss:'spore-heart' as const},bossRadius=enemyLeashRadius(boss);expect(enemyAttackSpace(boss).blocked(e.homeX+1800,1500)).toBe(false);expect(enemyAttackSpace(boss).blocked(e.homeX+bossRadius+1,1500)).toBe(true);expect(enemyAttackPermitted(boss,{x:e.homeX+bossRadius+101,y:1500})).toBe(false);
  });
  it('首领丢失目标保留八秒，回来会重新开始宽限，回撤亦可恢复交战',()=>{
    const e={...body(),x:3900,boss:'spore-heart' as const,type:'spore',hp:2300,bossBattle:initialBossBattle(0)};
    tick(e,{x:4600,y:1500},1000);const far={x:6000,y:1500};tick(e,far,1020);
    tick(e,far,1020+BOSS_PURSUIT.lostDelay-1);expect(e.nav.returning).toBe(false);
    tick(e,{x:4600,y:1500},9020);expect(e.nav.lostAt).toBeUndefined();
    tick(e,far,9040);tick(e,far,9040+BOSS_PURSUIT.lostDelay);expect(e.nav.returning).toBe(true);
    tick(e,{x:4600,y:1500},9040+BOSS_PURSUIT.lostDelay+20);expect(e.nav.returning).toBe(false);expect(e.nav.mode).toBe('chase');
  });
  it('远距离追击和返家分段绕过障碍，沿途不穿墙且查询保持有界',()=>{
    terrain.wall=true;const e=body();e.leashRadius=420;e.nav.mode='chase';e.cool=Infinity;
    for(let now=100;now<=14000;now+=100){const prev={x:e.x,y:e.y};tick(e,{x:3970,y:1500},now,100);expect(e.x>=3550&&e.x<=3580&&e.y>=1410&&e.y<=1590).toBe(false);expect(Math.hypot(e.x-prev.x,e.y-prev.y)).toBeLessThanOrEqual(6.001);}
    expect(e.x).toBeGreaterThan(3800);const queries=e.nav.queries;
    for(let now=14100;now<=41000;now+=100)tick(e,{x:5300,y:1500},now,100);
    expect(Math.hypot(e.x-e.homeX,e.y-e.homeY)).toBeLessThanOrEqual(8);expect(e.nav.queries-queries).toBeLessThan(50);
  });
});
