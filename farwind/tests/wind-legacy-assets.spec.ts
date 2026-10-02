import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {initialState,validate} from '../src/game/systems/state';
import {settleEncounterDeath} from '../src/game/systems/encounterState';

// 经正式存档导入入口验证实际纹理与封锁碰撞；固定样本不代表自然通关。
for(const [track,x,y] of [['blade',3300,680],['wind',2585,1870]] as const){
 test(`legacy-${track}-assets`,async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>d.accept());
  await page.goto('/');
  await page.waitForFunction(()=>typeof (window as any).__farwind==='function');
  const s=initialState();s.player.x=x;s.player.y=y;
  const importState=async()=>{
   const chooser=page.waitForEvent('filechooser');
   await page.getByRole('button',{name:'导入存档',exact:true}).click();
   await (await chooser).setFiles({name:'legacy-assets-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(s))});
   await page.waitForFunction(()=>(window as any).__farwind().mode==='');
  };
  await importState();
  const read=()=>page.evaluate(()=>(window as any).__farwind());
  const id=`legacy-${track}-seal`;
  await mkdir('docs/wind-legacy/evidence',{recursive:true});
  await page.screenshot({path:`docs/wind-legacy/evidence/${track}-seal-closed.png`});
  expect((await read()).missingPropTextures).toEqual([]);
  expect((await read()).obstacles.some((p:any)=>p.id===id)).toBe(true);
  await page.reload();
  await page.getByRole('button',{name:'继续旅途',exact:true}).click();
  await page.waitForFunction(()=>(window as any).__farwind().mode==='');
  expect((await read()).missingPropTextures).toEqual([]);
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'保存并返回标题',exact:true}).click();
  s.windLegacy[track]=4;
  if(track==='wind')s.windLegacy.device=true;
  s.runes.growth[track==='wind'?'r32':'r12'].advanced=true;
  for(const groupId of track==='wind'?['legacy-wind-device','legacy-wind-passage']:['legacy-blade-post','legacy-blade-road']){
   const group=s.encounters.groups[groupId];group.activated=true;
   for(const member of group.members)settleEncounterDeath(s.encounters,member.id,false);
  }
  validate(s);
  await importState();
  expect((await read()).missingPropTextures).toEqual([]);
  expect((await read()).obstacles.some((p:any)=>p.id===id)).toBe(false);
  await page.screenshot({path:`docs/wind-legacy/evidence/${track}-seal-open.png`});
  expect(errors).toEqual([]);
 });
}
