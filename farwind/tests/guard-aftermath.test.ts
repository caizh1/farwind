import {motionBlocked,clearMotionLine} from '../src/game/systems/obstacles';
import {describe,it,expect,beforeEach,afterEach} from 'vitest';
import {initialState,validate} from '../src/game/systems/state';
import {EastDefense} from '../src/game/systems/defense';
import {NpcLife} from '../src/game/systems/npcLife';
import {GUARD_DEFS} from '../src/data/defense';
import {HOMES} from '../src/data/npcLife';
import {syncMapGeometry} from '../src/data/world';
import {StateCommit} from '../src/game/systems/stateCommit';
import {GUARD_MEMORIAL,GUARD_CARE,currentMemorial,funeralTime,guardName,guardCareSnapshot,stepGuardAftermath} from '../src/game/systems/guardAftermath';
const setup=()=>{const s=initialState();s.time=7200+600;s.coins=200;Object.assign(s.player,HOMES.find(h=>h.id==='barracks')!.door);const d=new EastDefense(s.defense,0),life=new NpcLife(s,d);return {s,d,life};};
const death=(s:ReturnType<typeof initialState>,d:EastDefense,index=0)=>{const g=s.defense.guards[index];d.damageGuard({sourceId:'hostile',targetId:g.id,attackId:`致死-${index}-${g.generation??0}`,amount:1000,sourceType:'enemy-melee',eventId:null},{id:'hostile',hp:100});return g;};
const bury=(s:ReturnType<typeof initialState>,d:EastDefense,index=0)=>{const g=death(s,d,index);stepGuardAftermath(s,d,GUARD_CARE.safeMs);const r=currentMemorial(s.defense,g)!;s.time=funeralTime(r);stepGuardAftermath(s,d,100);return r;};
beforeEach(()=>syncMapGeometry(true));afterEach(()=>syncMapGeometry(false));
describe('卫队收殓与补岗闭环',()=>{
 it('纪念碑南侧可站立且交互线畅通，西门开闭均可用',()=>{
  for(const open of [false,true]){syncMapGeometry(open);const p={x:GUARD_MEMORIAL.x,y:GUARD_MEMORIAL.y+47};expect(motionBlocked(p.x,p.y)).toBe(false);expect(clearMotionLine(p,GUARD_MEMORIAL,'guard-memorial')).toBe(true);}
 });
 it('正式致死立即记录准确日期；旧档死亡登记日期不详且重复读档不增加记录',()=>{
  const {s,d}=setup(),g=death(s,d);expect(currentMemorial(s.defense,g)).toMatchObject({legacy:false,diedAt:s.time});
  const old=initialState();delete old.defense.memorials;Object.assign(old.defense.guards[3],{hp:0,dead:true,mode:'dead'});
  let loaded=validate(old);for(let i=0;i<4;i++){const defense=new EastDefense(loaded.defense,0);stepGuardAftermath(loaded,defense,100);loaded=validate(JSON.parse(JSON.stringify(loaded)));}
  expect(loaded.defense.memorials).toHaveLength(1);expect(loaded.defense.memorials![0].legacy).toBe(true);expect(loaded.defense.guards[3].hp).toBe(0);
 });
 it('连续安全12秒才收殓，来袭、弹丸、营房不可用均阻断；刷新保留已收殓事实',()=>{
  const {s,d}=setup(),g=death(s,d);stepGuardAftermath(s,d,6000);expect(currentMemorial(s.defense,g)!.safeMs).toBe(6000);
  stepGuardAftermath(s,d,100,true);expect(currentMemorial(s.defense,g)!.safeMs).toBe(0);
  s.life.unavailable.homes.barracks=true;stepGuardAftermath(s,d,12000);expect(currentMemorial(s.defense,g)!.collectedAt).toBeNull();
  delete s.life.unavailable.homes.barracks;stepGuardAftermath(s,d,11999);expect(currentMemorial(s.defense,g)!.collectedAt).toBeNull();
  stepGuardAftermath(s,d,1);expect(currentMemorial(validate(s).defense,g)!.collectedAt).toBe(s.time);expect(g.dead).toBe(true);
 });
 it('次日黎明安葬一次，暂停不推进；睡眠跨度在下一正式步正确处理',()=>{
  const {s,d}=setup(),g=death(s,d);stepGuardAftermath(s,d,12000);const r=currentMemorial(s.defense,g)!;
  const next=funeralTime(r);s.time=next-1;expect(stepGuardAftermath(s,d,0)).toEqual([]);expect(r.buriedAt).toBeNull();
  s.time=next+30;expect(stepGuardAftermath(s,d,100)).toHaveLength(1);expect(stepGuardAftermath(s,d,100)).toEqual([]);expect(g.dead).toBe(true);validate(s);
 });
 it('招募和献花要求在场、安葬和当前请求号；重复招募、缺钱都不扣款',()=>{
  const {s,d}=setup(),r=bury(s,d);const next=validate(guardCareSnapshot(s,'recruit',r.id,1));
  expect(next.coins).toBe(120);expect(s.coins).toBe(200);expect(()=>guardCareSnapshot(next,'recruit',r.id,2)).toThrow('已补齐或正在招募');
  expect(()=>guardCareSnapshot(s,'recruit',r.id,0)).toThrow('过期');
  const poor=structuredClone(s);poor.coins=79;expect(()=>guardCareSnapshot(poor,'recruit',r.id,1)).toThrow('金币');expect(poor.coins).toBe(79);
  const remote=structuredClone(s);Object.assign(remote.player,{x:670,y:780});expect(()=>guardCareSnapshot(remote,'flowers',r.id,1)).toThrow('营房');
  const flowers=validate(guardCareSnapshot(s,'flowers',r.id,1));expect(flowers.coins).toBe(s.coins);expect(()=>guardCareSnapshot(flowers,'flowers',r.id,2)).toThrow('献过花');
 });
 it('保存失败与并发请求不会扣钱或发布半笔招募',async()=>{
  const {s,d}=setup(),r=bury(s,d),commit=new StateCommit();let published=false;
  await expect(commit.run(()=>s,s=>guardCareSnapshot(s,'recruit',r.id,1),async()=>{throw Error('磁盘不可用');},()=>{published=true;})).rejects.toThrow('磁盘');
  expect(s.coins).toBe(200);expect(r.recruitAt).toBeNull();expect(published).toBe(false);expect(commit.busy).toBe(false);
  let release!:()=>void;const pending=commit.run(()=>s,s=>guardCareSnapshot(s,'recruit',r.id,1),()=>new Promise<void>(resolve=>{release=resolve;}),()=>{});
  await Promise.resolve();await expect(commit.run(()=>s,s=>s,async()=>{},()=>{})).rejects.toThrow('正在保存');release();await pending;
 });
 it('等待满3小时且安全后，新身份从营房报到；重复刷新不再扣款或生成继任者',()=>{
  const {s,d}=setup(),r=bury(s,d);const next=validate(guardCareSnapshot(s,'recruit',r.id,1));d.rebind(next.defense);
  next.time+=179;stepGuardAftermath(next,d,100);expect(next.defense.guards[0].dead).toBe(true);
  next.time++;stepGuardAftermath(next,d,100,true);expect(next.defense.guards[0].dead).toBe(true);
  stepGuardAftermath(next,d,100);const g=next.defense.guards[0];expect(g).toMatchObject({dead:false,generation:1,mode:'return',offDuty:true});expect(guardName(g)).toBe('云舟');
  const record=currentMemorial(s.defense,s.defense.guards[0])!;expect(record.arrivedAt).toBeNull();expect(next.defense.memorials![0].arrivedAt).toBe(next.time);
  let loaded=validate(next);for(let i=0;i<5;i++){const defense=new EastDefense(loaded.defense,0);stepGuardAftermath(loaded,defense,100);loaded=validate(loaded);}
  expect(loaded.coins).toBe(120);expect(loaded.defense.guards[0].generation).toBe(1);expect(loaded.defense.memorials).toHaveLength(1);
 });
 it('四门近战和弓卫均从营房实际沿路到岗；继任者再次阵亡保留两代纪念',()=>{
  for(let index=0;index<12;index++){
   const {s,d,life}=setup(),r=bury(s,d,index);let next=validate(guardCareSnapshot(s,'recruit',r.id,1));d.rebind(next.defense);life.rebind(next,d);next.time+=180;
   stepGuardAftermath(next,d,100);
   const g=next.defense.guards[index],home={x:g.x,y:g.y};let moved=false;
   for(let t=100;t<240000 && g.offDuty;t+=100){d.update(t,100,{x:670,y:780,hp:100},{queries:2});life.step(100,{queries:2});if(Math.hypot(g.x-home.x,g.y-home.y)>20)moved=true;}
   expect(moved,`${g.id}沿路移动`).toBe(true);expect(g.offDuty,`${g.id}真实返岗`).toBe(false);expect(Math.hypot(g.x-GUARD_DEFS[index].post.x,g.y-GUARD_DEFS[index].post.y)).toBeLessThan(6);
   death(next,d,index);expect(next.defense.memorials).toHaveLength(2);expect(next.defense.memorials!.map(r=>r.generation)).toEqual([0,1]);validate(next);
  }
 });
 it('拒绝伪造提前安葬、身份跳代和未来日期',()=>{
  const {s,d}=setup(),r=bury(s,d);const early=structuredClone(s);early.defense.memorials![0].buriedAt=r.collectedAt;expect(()=>validate(early)).toThrow('记录不一致');
  const skipped=structuredClone(s);skipped.defense.guards[0].generation=2;expect(()=>validate(skipped)).toThrow('记录不一致');
  const future=structuredClone(s);future.defense.memorials![0].diedAt=s.time+1;expect(()=>validate(future)).toThrow('记录不一致');
 });
});
