import {describe,it,expect} from 'vitest';
import {initialState,parseSave,count,validate} from '../src/game/systems/state';
import {footwearStock,shops,shoeSpeedBonus} from '../src/data/economy';
import {itemIcon} from '../src/data/content';
import {economySnapshot,movementSpeed,EconomyCommit} from '../src/game/systems/economy';
import {runeSnapshot} from '../src/game/systems/runeState';
import {phaseStepDestination} from '../src/game/systems/phaseStep';
import {clearPhaseLine,rectInterval,motionBlocked,clearMotionLine} from '../src/game/systems/obstacles';
import {props,propBounds,WATERS} from '../src/data/world';
import {CombatController,COMBAT} from '../src/game/systems/combat';
import {runePreviewScene} from '../src/game/ui/runePreview';

const shoes=['brookShoes','deerBoots','windBoots','mistBoots','starShoes'] as const;
const safe={combat:false,boss:false,defense:false,trial:false,story:false,action:false};
describe('五款鞋子与穿隙的真实事务和边界',()=>{
 it('五款价格和移速递增，购买、替换、读档和卸下保持物品守恒',()=>{
  let s=initialState();s.coins=3000;
  for(const [i,id] of shoes.entries()){
   const price=shops.smith.goods[id];
   if(i){expect(price).toBeGreaterThan(shops.smith.goods[shoes[i-1]]);expect(shoeSpeedBonus(id)).toBeGreaterThan(shoeSpeedBonus(shoes[i-1]));}
   const coins=s.coins,stock=s.shopStock[`smith:${id}`];
   s=economySnapshot(s,{sequence:s.economyRevision+1,kind:'buy',shop:'smith',item:id,quantity:1});
   expect(s.coins).toBe(coins-price);expect(s.shopStock[`smith:${id}`]).toBe(stock-1);
   s=economySnapshot(s,{sequence:s.economyRevision+1,kind:'equip',slot:'feet',item:id});
   s=parseSave(JSON.stringify(s));
   expect(s.equipment.feet).toBe(id);expect(count(s,id)).toBe(0);
   expect(movementSpeed(s,150)).toBeCloseTo(150*(1+shoeSpeedBonus(id)));
   expect(movementSpeed(s,235)).toBeCloseTo(235*(1+shoeSpeedBonus(id)));
   expect(itemIcon(id)).toMatch(/equipment\/.+\.webp$/);
   for(const earlier of shoes.slice(0,i))expect(count(s,earlier)).toBe(1);
  }
  s=economySnapshot(s,{sequence:s.economyRevision+1,kind:'equip',slot:'feet',item:null});
  for(const id of shoes)expect(count(s,id)).toBe(1);
  expect(movementSpeed(s,150)).toBe(150);
 });
 it('旧库存只补新商品，不返还售罄库存或赠送装备，迁移幂等',()=>{
  const old=initialState();old.coins=47;old.equipment.feet='windBoots';old.shopStock['smith:windBoots']=0;
  for(const key of Object.keys(footwearStock))delete old.shopStock[key];
  const s=parseSave(JSON.stringify(old));expect(s.shopStock['smith:windBoots']).toBe(0);expect(s.coins).toBe(47);expect(s.equipment.feet).toBe('windBoots');expect(s.bag).toEqual(old.bag);
  expect(validate(s)).toEqual(s);expect(Object.keys(old.shopStock)).not.toContain('smith:brookShoes');
  s.shopStock['smith:starShoes']=0;expect(parseSave(JSON.stringify(s)).shopStock['smith:starShoes']).toBe(0);
 });
 it('新鞋购买保存失败不扣款或发货，穿隙扣款一次且购买不等于装备',async()=>{
  const s=initialState(),commit=new EconomyCommit();let published=false;
  await expect(commit.run(()=>s,{sequence:1,kind:'buy',shop:'smith',item:'brookShoes',quantity:1},async()=>{throw Error('保存失败');},()=>{published=true;})).rejects.toThrow('保存失败');
  expect(published).toBe(false);expect(s.coins).toBe(120);expect(count(s,'brookShoes')).toBe(0);
  s.coins=360;const bought=runeSnapshot(s,{kind:'claim',id:'r34',shop:'general'},safe);
  expect(bought.coins).toBe(0);expect(bought.runes.slots).not.toContain('r34');expect(bought.bag).toEqual(s.bag);
  expect(()=>runeSnapshot(bought,{kind:'claim',id:'r34',shop:'general'},safe)).toThrow('已拥有');
  const equipped=runeSnapshot(bought,{kind:'equip',slot:0,id:'r34'},safe);expect(parseSave(JSON.stringify(equipped)).runes.slots[0]).toBe('r34');
 });
 const wall={left:25,right:60,top:-20,bottom:20},origin={x:0,y:0},end={x:90,y:0};
 const blocked=(x:number,y:number)=>x>wall.left&&x<wall.right&&y>wall.top&&y<wall.bottom;
 const clear=(a:{x:number;y:number},b:{x:number;y:number})=>!rectInterval(a,b,wall);
 it('可以穿完整障碍；终点在墙内回查；超厚障碍停在前方；硬边界不能跳过',()=>{
  expect(phaseStepDestination(origin,end,blocked,()=>true,clear)).toEqual(end);
  expect(phaseStepDestination(origin,{x:45,y:0},blocked,()=>true,clear)).toEqual({x:25,y:0});
  expect(phaseStepDestination(origin,end,(x)=>x>25,()=>true,()=>false)).toEqual({x:25,y:0});
  expect(phaseStepDestination(origin,end,blocked,(a,b)=>b.x<=70,clear)).toEqual({x:70,y:0});
  expect(phaseStepDestination(origin,end,()=>false,()=>true,()=>true)).toBeNull();
 });
 it('真实地图的普通木桩可穿，封印、建筑、水域和世界边界不可穿',()=>{
  const p=props.find(p=>p.id==='training-dummy')!,r=propBounds(p,true),a={x:p.x,y:r.top-4},b={x:p.x,y:r.bottom+4};
  expect(clearMotionLine(a,b)).toBe(false);expect(clearPhaseLine(a,b)).toBe(true);expect(motionBlocked(b.x,b.y)).toBe(false);
  for(const p of props.filter(p=>p.solid&&(p.id.endsWith('-seal')||p.id.startsWith('barrier-')||p.art==='house'))){const r=propBounds(p,true);expect(clearPhaseLine({x:p.x,y:r.top-1},{x:p.x,y:r.bottom+1}),p.id).toBe(false);}
  const water=WATERS[0];expect(clearPhaseLine({x:water.x-water.rx-20,y:water.y},{x:water.x+water.rx+20,y:water.y})).toBe(false);
  expect(clearPhaseLine({x:0,y:0},{x:-9999,y:0})).toBe(false);
 });
 it('正式瞬步只穿一次，保持距离、冷却和动作时长；受击后不会留在墙内',()=>{
  const c=new CombatController(),p={...origin};let resolved=0;
  c.resolvePhaseDash=(a,b)=>{resolved++;return phaseStepDestination(a,b,blocked,()=>true,clear);};
  expect(c.requestDash(0,100,{x:1,y:0},3)).toBe(true);
  for(let now=10;now<=200;now+=10)c.update(now-10,now,3,p,[],blocked,()=>true,()=>{},()=>{},()=>{},clear);
  expect(p).toEqual(end);expect(resolved).toBe(1);expect(c.dashCooldown).toBe(COMBAT.dash.cooldown);expect(c.dashUntil).toBe(COMBAT.dash.duration);
  c.takeHit(220,3,{x:1,y:0},p);expect(blocked(p.x,p.y)).toBe(false);
  const plain=new CombatController(),q={...origin};plain.requestDash(0,100,{x:1,y:0},3);plain.update(0,200,3,q,[],blocked,()=>true,()=>{},()=>{},()=>{},clear);expect(q.x).toBeLessThanOrEqual(25);
 });
 it('单枚符文预览使用同一落点逻辑，明确展示穿障前后',()=>{
  const scene=runePreviewScene('r34',initialState(),18);scene.step(1);expect(scene.state.player.x).toBe(92);scene.step(300);expect(scene.state.player.x).toBe(182);expect(scene.phase).toContain('安全落点');expect(scene.engine.effects.some(f=>f.visual==='phase-step')).toBe(true);scene.clear();
 });
});
