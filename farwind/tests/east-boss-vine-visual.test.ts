import {describe,it,expect} from 'vitest';
import {BossVineVfx,vineVisualPath,EAST_VINE_TEXTURE_BYTES} from '../src/game/entities/bossVineVfx';
import {CampBossEffects} from '../src/game/entities/campBossEffects';
import {createBossAttack} from '../src/game/systems/campBossCombat';
import {initialBossBattle} from '../src/game/systems/campBossState';
import {enemyNavigation,type EnemyBody} from '../src/game/systems/enemy';

describe('精修藤刺的连续路径与共享材质',()=>{
 it.each(Array.from({length:8},(_,i)=>i))('方向 %i 的手臂连接不折回脚底，尖端保持正式端点',n=>{
  const angle=n*Math.PI/4,d={x:Math.sin(angle),y:Math.cos(angle)},g={a:{x:d.x*24,y:d.y*24},b:{x:d.x*900,y:d.y*900},radius:32},hand={x:-55,y:-130};
  const path=vineVisualPath(hand,g,1);expect(path[0]).toEqual(hand);expect(path.at(-1)).toEqual(g.b);expect(path.slice(1).some(p=>p.x===g.a.x&&p.y===g.a.y)).toBe(false);
  const v={x:g.b.x-hand.x,y:g.b.y-hand.y};for(let i=1;i<path.length;i++)expect((path[i].x-path[i-1].x)*v.x+(path[i].y-path[i-1].y)*v.y).toBeGreaterThan(0);
  const back=vineVisualPath(hand,g,.5);expect(back.at(-1)!.x).toBeCloseTo((g.a.x+g.b.x)/2);expect(back.at(-1)!.y).toBeCloseTo((g.a.y+g.b.y)/2);expect(path.length).toBeLessThanOrEqual(61);
 });
 it('两实体复用有界图像池，暂停采样相同，取消后清空',()=>{
  const images:any[]=[];const texture={has:()=>true};let commands:any[]=[];
  function chain(){let value:any;value=new Proxy({}, {get:(_,key)=> (...args:any[])=>{commands.push([key,...args]);return value;}});return value;}
  const scene={textures:{exists:()=>true,get:()=>texture},add:{graphics:chain,image:()=>{const image=chain();images.push(image);return image;}}} as any;
  const view=new BossVineVfx(scene),ink=chain(),a={contactAt:0,activeUntil:120} as any,g={a:{x:24,y:0},b:{x:4600,y:0},radius:32};
  const draw=()=>{view.begin();commands=[];view.draw(a,{x:0,y:0},{x:45,y:-130},g,110,ink);view.draw(a,{x:0,y:200},{x:45,y:70},{...g,a:{x:24,y:200},b:{x:4600,y:200}},110,ink);return [...commands];};
  const first=draw();expect(draw()).toEqual(first);expect(images.length).toBe(120);expect(view.snapshot().textureBytes).toBe(EAST_VINE_TEXTURE_BYTES);view.begin();expect(view.snapshot().visible).toBe(0);view.draw(a,{x:0,y:0},{x:45,y:-130},g,301,ink);expect(view.snapshot().visible).toBe(0);
  const e:EnemyBody={id:'boss-bound-branch',type:'leaf',boss:'bound-branch',memoryDifficulty:{version:1,level:5},bossBattle:{...initialBossBattle(0),move:8},x:0,y:0,homeX:0,homeY:0,hp:4750,ai:'首领',cool:0,windup:0,nav:enemyNavigation()};
  const attack=createBossAttack(e,0,{x:200,y:0},e.bossBattle!);attack.cancelled=true;const effects=new CampBossEffects(scene);effects.begin();effects.draw(e,attack,attack.contactAt+80);expect(effects.snapshot().effects).toEqual([]);expect(effects.snapshot().vineMaterials.visible).toBe(0);
 });
});
