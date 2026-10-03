import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {initialState} from '../src/game/systems/state';
import {initialEncounters} from '../src/game/systems/encounterState';
import {ENCOUNTERS,waveMembers} from '../src/data/maps/windbell/encounters';

test('正式构建的夜间自然地刺预警',async({page})=>{
  const root='docs/attack-warning/evidence-v3';await mkdir(root,{recursive:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  const s=initialState(),d=ENCOUNTERS.find(d=>d.id==='north-pass-charge')!,mage=waveMembers(d,2).find(m=>m.wave===0&&m.type==='geomancer')!;
  s.encounters=initialEncounters(2);s.player.x=mage.x+70;s.player.y=mage.y+70;s.time=1320;
  await page.goto('/?combatObservation');const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入存档',exact:true}).click();await(await chooser).setFiles({name:'production-warning-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(s))});
  await page.waitForFunction(()=>{const s=(window as any).__farwind?.();return s?.bossHazards?.some((h:any)=>h.activeAt-s.skillGrowth.sim>150&&h.activeAt-s.skillGrowth.sim<400);});
  const snapshot=await page.evaluate(()=>(window as any).__farwind());await page.screenshot({path:root+'/production-spikes-night.png'});
  const layers=snapshot.warningLayers;for(const depth of [layers.ground,...layers.enemyEdges,layers.bossGround,layers.bossEdges,layers.bossGroundEffects])expect(depth).toBeLessThan(layers.heroShadow);
  const observation=JSON.parse((await page.locator('#combat-observation').textContent())!);expect(observation.生产构建).toBe(true);expect(errors).toEqual([]);expect(snapshot.bossHazards.length).toBeGreaterThan(0);
  await writeFile(root+'/production.json',JSON.stringify({说明:'冻结正式构建、夜间野外、合法新档夹具；位置与种子用于固定样本，不修改正式战斗。未采用开发调试写入。',生产构建:observation.生产构建,危险区数量:snapshot.bossHazards.length,敌人数量:observation.敌人.length,错误:errors},null,2));
});
