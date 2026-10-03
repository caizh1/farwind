import {describe,it,expect} from 'vitest';
import {initialState,parseSave} from '../src/game/systems/state';
import {runeSnapshot,validateRunes,migrateBuildRunes,runeModel} from '../src/game/systems/runeState';
import {StateCommit} from '../src/game/systems/stateCommit';

const safe={combat:false,boss:false,defense:false,trial:false,story:false,action:false};
const ids=['r31','r32','r33','r12','r09','r01','r03','r08','r05','r15'];
describe('十槽正式配装与历史存档',()=>{
 it('迁移旧五槽和全部预设，保留分支、冷却、金币和进度且幂等',()=>{
  const old=initialState();old.runes.owned=ids;old.runes.slots=ids.slice(0,5);
  (old.runes as {version:number}).version=3;
  old.runes.presets.forEach((p,i)=>{p.slots=i===1?ids.slice(5):Array(5).fill(null);});
  old.runes.growth.r31={advanced:true,branch:'anchor'};old.runes.presets[1].branches={r31:'anchor'};
  old.runes.cooldowns.r15=200;old.coins=43;old.player.hp=73;
  const before=structuredClone(old),loaded=parseSave(JSON.stringify(old));
  expect(loaded.runes.version).toBe(4);expect(loaded.runes.slots).toEqual([...ids.slice(0,5),...Array(5).fill(null)]);
  expect(loaded.runes.presets[1].slots).toEqual([...ids.slice(5),...Array(5).fill(null)]);
  expect(loaded.runes.presets[1].branches).toEqual(before.runes.presets[1].branches);
  expect(loaded.runes.cooldowns).toEqual(before.runes.cooldowns);expect(loaded.runes.growth).toEqual(before.runes.growth);
  expect(loaded.coins).toBe(43);expect(loaded.player).toEqual(before.player);expect(loaded.bag).toEqual(before.bag);
  expect(parseSave(JSON.stringify(loaded))).toEqual(loaded);expect(old).toEqual(before);
 });
 it('十枚符文分别装备、组合解析、预设与读档覆盖第六至第十槽',()=>{
  let state=initialState();state.runes.owned=ids;state.skills.swordWindStage=1;state.skills.legacySwordWind=true;
  for(const [slot,id] of ids.entries())state=runeSnapshot(state,{kind:'equip',slot,id},safe);
  expect(runeModel(state).runes.map(r=>r!.id)).toEqual(ids);
  expect(runeModel(state).duos.filter(d=>d.active).map(d=>d.id)).toEqual(['d01','d10','d11','d13','d14']);
  state.runes.cooldowns.r15=200;state=runeSnapshot(state,{kind:'preset-save',index:2},safe);
  state=runeSnapshot(state,{kind:'equip',slot:9,id:null},safe);
  state=runeSnapshot(state,{kind:'preset-load',index:2},safe);
  expect(parseSave(JSON.stringify(state)).runes.slots).toEqual(ids);expect(state.runes.cooldowns.r15).toBe(200);
  expect(()=>runeSnapshot(state,{kind:'equip',slot:9,id:'r01'},safe)).toThrow('同名');
  expect(()=>runeSnapshot(state,{kind:'equip',slot:10,id:null},safe)).toThrow('十个');
  expect(()=>runeSnapshot(state,{kind:'equip',slot:9,id:null},{...safe,combat:true})).toThrow('交战');
 });
 it('损坏的旧版和新版槽形状、非法收藏、重复符文均拒绝',()=>{
  const r=initialState().runes;
  expect(()=>validateRunes({...r,slots:Array(5).fill(null)})).toThrow();
  expect(()=>migrateBuildRunes({...r,version:3,slots:Array(6).fill(null)})).toThrow('旧符文');
  const legacy={...r,version:3,owned:['r01'],slots:['r01','r01',null,null,null],presets:r.presets.map(p=>({...p,slots:Array(5).fill(null)}))};
  expect(()=>migrateBuildRunes(legacy)).toThrow();
  expect(()=>validateRunes({...r,slots:[...Array(9).fill(null),'r34']})).toThrow();
 });
 it('第十槽保存失败不发布装备副本，原状态保持不变',async()=>{
  const state=initialState();state.runes.owned=['r34'];let published=false;
  await expect(new StateCommit().run(()=>state,s=>runeSnapshot(s,{kind:'equip',slot:9,id:'r34'},safe),async()=>{throw Error('保存失败');},()=>{published=true;})).rejects.toThrow('保存失败');
  expect(state.runes.slots[9]).toBeNull();expect(published).toBe(false);
 });
});
