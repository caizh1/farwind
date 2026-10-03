import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {CAMP_NESTS} from '../src/data/campNests';
import {syncMapGeometry} from '../src/data/world';
import {move} from './map-navigation';

const root='docs/camp-nests/evidence/ground';
const purifiedRoot='docs/camp-nests/evidence/purification';
const routes={south:[[900,1900],[1050,2040],[1000,2450],[1250,2990]],west:[[820,120],[-80,120],[-350,800],[-1820,850],[-1880,1700],[-1700,1680]],north:[[820,120],[980,80],[1400,80],[1750,-260],[1750,-570],[1480,-570]],east:[[1980,1100],[2580,1100],[3710,1220]]};
for(const direction of Object.keys(CAMP_NESTS) as (keyof typeof CAMP_NESTS)[])test(`nest-runtime-${direction}`,async({page})=>{
  mkdirSync(root,{recursive:true});syncMapGeometry(false);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.getByRole('button',{name:'启程 · 新游戏',exact:true}).click();
  await page.waitForFunction(()=>(window as any).__farwind?.().mode==='');
  const initial=await page.evaluate(()=>(window as any).__farwind().campNests);
  expect(new Set(initial.map((n:any)=>n.texture)).size).toBe(4);
  for(const n of initial)expect(n.texture).toBe(CAMP_NESTS[n.direction as keyof typeof CAMP_NESTS].texture);
  for(const [x,y] of routes[direction]){
    try { await move(page,x,y); }
    catch(error){
      const s=await page.evaluate(()=>(window as any).__farwind());
      writeFileSync(`${root}/${direction}-route-diagnostics.json`,JSON.stringify({说明:'键盘行程失败现场；仅读取状态，不回写进度。',目标:[x,y],现场:s},null,2));
      throw error;
    }
  }
  await page.keyboard.press('Escape');
  const snapshot=await page.evaluate(()=>{const s=(window as any).__farwind();return {玩家:s.state.player,巢穴:s.campNests,地表:s.ground,据点:s.state.encounters.groups,镜头:s.bossPresentation.camera};});
  expect(snapshot.地表.nestGround.map((a:any)=>a.direction).sort()).toEqual(['east','north','south','west']);
  expect(snapshot.玩家.hp).toBeGreaterThan(0);
  const n=snapshot.巢穴.find((n:any)=>n.direction===direction);expect(n.texture).toBe(CAMP_NESTS[direction].texture);
  await page.getByRole('button',{name:'继续旅途',exact:true}).click();
  await page.screenshot({path:`${root}/${direction}-runtime.png`});
  await page.keyboard.press('Escape');
  writeFileSync(`${root}/${direction}-runtime.json`,JSON.stringify({说明:'关闭开发授予的正式构建；全新独立浏览器存档，通过真实键盘步行至巢穴；不传送、不修改游戏状态。画面为当前真实运行截图。',方向:direction,快照:snapshot,错误:errors},null,2));
  expect(errors).toEqual([]);
});

test('cleared-save-reload',async({page})=>{
  mkdirSync(purifiedRoot,{recursive:true});syncMapGeometry(false);
  await page.goto('/');page.once('dialog',d=>d.accept());
  const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.getByRole('button',{name:'导入存档',exact:true}).click()]);
  await chooser.setFiles('docs/combat-v2/evidence/four-camps-exported-save.json');
  await page.waitForFunction(()=>(window as any).__farwind?.().campNests?.every((n:any)=>n.tint!==0xffffff));
  const s=await page.evaluate(()=>(window as any).__farwind());
  expect(s.ground.nestGround.every((a:any)=>a.cleared&&!a.applied)).toBe(true);
  for(const n of s.campNests){expect(n.texture).toBe(CAMP_NESTS[n.direction as keyof typeof CAMP_NESTS].texture);expect(n.alpha).toBeLessThan(1);}
  await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();
  await page.waitForFunction(()=>(window as any).__farwind?.().mode==='');
  const after=await page.evaluate(()=>(window as any).__farwind());
  const restored=after.campNests;
  expect(restored.map((n:any)=>[n.direction,n.texture,n.tint])).toEqual(s.campNests.map((n:any)=>[n.direction,n.texture,n.tint]));
  expect(after.ground.nestGround).toEqual(s.ground.nestGround);
  writeFileSync(`${purifiedRoot}/cleared-reload.json`,JSON.stringify({说明:'导入已有真实通关样本并刷新读档；仅读取外观参数与地表区域，未写入或伪造清剿进度。',刷新前:s.campNests,刷新后:restored,刷新前地表:s.ground.nestGround,刷新后地表:after.ground.nestGround},null,2));
  const clearedRoutes={east:[[3710,1220]],north:[[2580,1100],[1980,1100],[1750,120],[1750,-570],[1480,-570]],west:[[1750,120],[820,120],[-80,120],[-350,800],[-1820,850],[-1880,1700],[-1700,1680]],south:[[-1880,1700],[-1880,1900],[-800,1900],[300,1900],[900,1900],[1050,2040],[1000,2450],[1250,2990]]};
  for(const [direction,waypoints] of Object.entries(clearedRoutes)){
    for(const [x,y] of waypoints)await move(page,x,y);
    await page.screenshot({path:`${purifiedRoot}/${direction}-cleared.png`});
    const ground=await page.evaluate(()=>(window as any).__farwind().ground);
    expect(ground.nestGround.every((a:any)=>!a.applied)).toBe(true);
  }
});

test('purification-live-cache',async({page})=>{
  mkdirSync(purifiedRoot,{recursive:true});
  await page.goto('/');page.once('dialog',d=>d.accept());
  const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.getByRole('button',{name:'导入存档',exact:true}).click()]);
  await chooser.setFiles('docs/combat-v2/evidence/four-camps-exported-save.json');
  await page.waitForFunction(()=>{const s=(window as any).__farwind?.();return s&&!s.sessionStarting&&s.mode==='';});
  await page.keyboard.press('q');await page.locator('#journal-wind-memory').click();
  const before=await page.evaluate(()=>(window as any).__farwind().ground);
  await page.locator('[data-memory="east"]').click();
  await page.waitForFunction(()=>(window as any).__farwind().state.windMemory.active?.direction==='east');
  await page.locator('#memory-close').click();
  await page.waitForFunction(()=>{const s=(window as any).__farwind();return s.ground.nestGround.find((a:any)=>a.direction==='east').applied&&s.ground.created>0;});
  await page.screenshot({path:`${purifiedRoot}/east-memory-active.png`});
  const active=await page.evaluate(()=>(window as any).__farwind().ground);
  expect(active.created).toBeGreaterThan(before.created);expect(active.released).toBeGreaterThan(before.released);
  expect(active.nestGround.filter((a:any)=>a.applied).map((a:any)=>a.direction)).toEqual(['east']);
  await page.keyboard.press('q');await page.locator('#journal-wind-memory').click();await page.locator('#memory-end').click();
  await page.waitForFunction(()=>(window as any).__farwind().state.windMemory.active===null);
  await page.locator('#memory-close').click();
  await page.screenshot({path:`${purifiedRoot}/east-memory-ended.png`});
  const ended=await page.evaluate(()=>(window as any).__farwind().ground);
  expect(ended.nestGround.every((a:any)=>!a.applied)).toBe(true);
  expect(ended.created).toBeGreaterThan(active.created);expect(ended.released).toBeGreaterThan(active.released);
  writeFileSync(`${purifiedRoot}/live-cache.json`,JSON.stringify({说明:'真实清剿样本经正式界面开启并退出东侧风忆；不刷新页面，通过区块创建/释放计数与实机图核对局部缓存随净化切换，其他方向保持净化。',开始:before,挑战:active,恢复:ended},null,2));
});
