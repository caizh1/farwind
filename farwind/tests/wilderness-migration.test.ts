import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {validate} from '../src/game/systems/state';
import {ENCOUNTERS} from '../src/data/maps/windbell/encounters';
const evidence=JSON.parse(readFileSync('docs/first-map/evidence-m3/field-loop.json','utf8'));
describe('冻结M3真实键鼠存档的连续升级',()=>{
 for(const node of evidence.节点)it(node.名称,()=>{
  const original=node.状态;expect(original.schema_version).toBe(11);
  const restored=validate(structuredClone(original));
  expect(restored.bag).toEqual(original.bag);expect(restored.coins).toBe(original.coins);
  expect(restored.skills).toEqual(original.skills);expect(restored.fieldQuests).toEqual(original.fieldQuests);
  expect(restored.defense.guards).toEqual(original.defense.guards);expect(restored.life).toEqual(original.life);
  for(const [id,g] of Object.entries(original.encounters.groups) as [string,any][]){
   const current=restored.encounters.groups[id];expect(current.cleared).toBe(g.cleared);expect(current.cycle).toBe(g.cycle);
   g.members.forEach((m:any,i:number)=>expect(current.members[i]).toMatchObject(m));
  }
  expect(Object.keys(restored.encounters.groups)).toHaveLength(ENCOUNTERS.length);expect(restored.encounters.broken).toEqual([]);
  expect(validate(restored)).toEqual(restored);
 });
});
