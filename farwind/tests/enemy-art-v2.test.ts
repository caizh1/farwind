import {describe,it,expect} from 'vitest';
import sharp from 'sharp';
import {ENEMIES,enemyArt} from '../src/data/enemies';
import {EnemyAnimation} from '../src/game/systems/enemyAnimation';
import {createEnemyAttack} from '../src/game/systems/enemyAttack';

describe('森林怪物样片与正式时窗',()=>{
 for(const kind of ['leaf','spore'] as const){
  it(`${kind}出手姿态与真实接触严格同步，暂停不推进`,()=>{
   const body={type:kind,x:0,y:0,hp:60},attack=createEnemyAttack('sample',1,kind,100,body,{x:0,y:100}),animation=new EnemyAnimation();
   for(const at of [attack.lockAt-1,attack.lockAt,attack.contactAt-1,attack.contactAt,attack.activeUntil-1,attack.activeUntil]){
    const pose=animation.sample(body,attack,at),phase=at<attack.lockAt?'charge':at<attack.contactAt?'commit':at<attack.activeUntil?'active':'recovery';
    expect(pose.phase).toBe(phase);expect(animation.sample(body,attack,at)).toEqual(pose);
    if(phase==='active')expect(pose.index).toBeGreaterThanOrEqual(5);
    if(phase==='commit')expect(pose.index).toBe(4);
   }
   attack.cancelled=true;expect(animation.sample(body,attack,attack.activeUntil+1).action).toBe('idle');
  });
  it(`${kind}弹反优先于受击和攻击，死亡优先于弹反`,()=>{
   const body={type:kind,x:0,y:0,hp:60},animation=new EnemyAnimation(),attack=createEnemyAttack('sample',1,kind,0,body,{x:0,y:100});
   animation.sample(body,attack,0);body.hp=40;
   const hit={...body,staggerUntil:500,parried:{at:100,until:900,direction:{x:-1,y:0},perfect:true}};
   expect(animation.sample(hit,attack,100)).toMatchObject({action:'perfect',facing:2,frame:132});
   expect(animation.sample({...hit,hp:0},attack,120)).toMatchObject({action:'death',facing:2,frame:124});
  });
  it(`${kind}显示高度保持原值，图集在四千零九十六像素内`,async()=>{
   const art=enemyArt(kind),meta=await sharp('public'+art.path).metadata();
   expect([meta.width,meta.height,meta.hasAlpha]).toEqual([3840,3840,true]);
   expect(ENEMIES[kind].height).toBe(kind==='leaf'?78:72);expect(art.nativeHeight).toBe(160);
  });
 }
});
