# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: safety-defense.spec.ts >> 实机主动拦截、一人守门、塔箭命中、归岗与脱战回血
- Location: tests/safety-defense.spec.ts:18:1

# Error details

```
Error: page.waitForTimeout: Target page, context or browser has been closed
```

# Test source

```ts
  1  | import {test,expect,type Page} from '@playwright/test';
  2  | import {mkdir,writeFile} from 'node:fs/promises';
  3  | import {initialState,validate,type State} from '../src/game/systems/state';
  4  | import {advanceNight} from '../src/game/systems/nightDirector';
  5  | import {prepareRaid} from '../src/game/systems/defense';
  6  | import {move} from './map-navigation';
  7  | const root=process.env.FARWIND_EVIDENCE_ROOT!;
  8  | const read=(p:Page)=>p.evaluate(()=>(window as any).__farwind());
  9  | async function initial(p:Page,s:State){validate(s);p.once('dialog',d=>d.accept());const choose=p.waitForEvent('filechooser');await p.getByRole('button',{name:'导入存档',exact:true}).click();await(await choose).setFiles({name:'safety-initial-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(s))});await p.waitForFunction(()=>(window as any).__farwind().mode==='');}
  10 | async function caption(p:Page,text:string){await p.evaluate(text=>{let n=document.getElementById('acceptance-caption');if(!n){n=document.createElement('p');n.id='acceptance-caption';n.style.cssText='position:fixed;bottom:4px;left:12px;margin:0;padding:6px 12px;background:#132b26dd;color:#fff;z-index:9999;font:14px sans-serif;max-width:1000px';document.body.append(n);}n.textContent='验收字幕（只读）：'+text;},text);}
  11 | test.beforeEach(async({page})=>{await mkdir(root,{recursive:true});await page.goto('/');});
  12 | test.afterEach(async({page},info)=>{if(!page.isClosed()){const name=info.title.includes('近郊')?'walk':info.title.includes('低血')?'weak':'battle';await writeFile(`${root}/${name}-${info.status}.json`,JSON.stringify({说明:'只读实际运行记录；初始条件只通过正式导入建立，未写运行生命或位置。',状态:await read(page)},null,2));const video=page.video();await page.close();await video?.saveAs(`${root}/${name}-footage.webm`);}});
  13 | test('安全近郊实际漫步、远怪不追、主角与黑猫过门',async({page})=>{
  14 |  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const s=initialState();Object.assign(s.player,{x:2010,y:1080});await initial(page,s);await caption(page,'初始夹具只定位东门内侧；真实键盘漫步，保留全部常驻野怪。');
  15 |  await move(page,2250,1080);await page.waitForTimeout(3500);const end=await read(page);expect(end.state.player.hp).toBe(100);expect(end.region).not.toBe('危险');expect(end.defense.history.filter((h:any)=>h.kind==='shot')).toEqual([]);
  16 |  expect(Math.hypot(end.companion.x-end.state.player.x,end.companion.y-end.state.player.y)).toBeLessThan(130);await page.screenshot({path:`${root}/safe-outskirts.png`});await move(page,1990,1080);expect(errors).toEqual([]);
  17 | });
  18 | test('实机主动拦截、一人守门、塔箭命中、归岗与脱战回血',async({page})=>{
  19 |  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const s=initialState();s.defense=prepareRaid(s.defense,{x:670,y:720},'east-gate',3);Object.assign(s.player,{x:1940,y:1080});await initial(page,s);
  20 |  await caption(page,'初始夹具：已经生成的三只弱怪事件；位置、伤害、箭矢和恢复全部由正式模拟推进。其他用例另验自然调度。');
  21 |  let captured=false;const samples:any[]=[];for(let n=0;n<25;n++){await page.waitForTimeout(500);const d=await read(page);samples.push({time:d.state.time,guards:d.state.defense.guards,threats:d.defense.threats,arrows:d.defense.arrows,history:d.defense.history});if(!captured&&d.state.defense.guards.find((g:any)=>g.id==='east-patrol').x>2100){captured=true;await page.screenshot({path:`${root}/active-interception.png`});}if(!d.state.defense.raid)break;}
  22 |  const fight=await read(page);expect(fight.defense.history.some((h:any)=>h.kind==='shot')).toBe(true);expect(fight.defense.history.some((h:any)=>h.kind==='hit'&&h.sourceId==='east-archer')).toBe(true);expect(samples.some(d=>d.guards.find((g:any)=>g.id==='east-patrol').x>2100)).toBe(true);expect(samples.every(d=>d.guards.find((g:any)=>g.id==='east-watch').x<=2100)).toBe(true);
> 23 |  await page.waitForFunction(()=>(window as any).__farwind().state.defense.raid===null,undefined,{timeout:40000});const ended=await read(page);await caption(page,'事件已结束：目标释放、回固定岗位；脱战8秒后按真实速度缓慢回血。');await page.waitForTimeout(12000);const healed=await read(page);expect(healed.state.defense.guards.every((g:any)=>!g.dead)).toBe(true);for(const g of healed.state.defense.guards){const old=ended.state.defense.guards.find((x:any)=>x.id===g.id);expect(g.hp).toBeGreaterThanOrEqual(old.hp);}expect(Math.hypot(healed.state.defense.guards[1].x-2010,healed.state.defense.guards[1].y-1160)).toBeLessThan(85);await page.screenshot({path:`${root}/return-and-recovery.png`});await writeFile(`${root}/interception-samples.json`,JSON.stringify({说明:'500毫秒只读采样；实际浏览器推进，无运行改值。',样本:samples,结束:ended.state.defense,恢复:healed.state.defense,页面错误:errors},null,2));expect(errors).toEqual([]);
     |                                                                                                                                                                                                                 ^ Error: page.waitForTimeout: Target page, context or browser has been closed
  24 | });
  25 | test('低血三门正式调度延期，暂停双方冻结、保存重载不复活',async({page})=>{
  26 |  const s=initialState();Object.assign(s.player,{x:1940,y:1080});s.defense.protectionMs=s.defense.cooldownMs=0;s.time=2460;advanceNight(s,2459);Object.assign(s.night.plan!,{outcome:"pending",gate:"east-gate",count:1,at:2700});s.time=2700;s.defense.guards.forEach(g=>g.hp=1);await initial(page,s);await caption(page,'初始夹具：三门全部1HP，保护／冷却已结束；正式调度只能延期，不能补血或创建预警。');await page.waitForTimeout(3000);const weak=await read(page);expect(weak.state.defense.raid).toBeNull();expect(weak.state.defense.sequence).toBe(0);expect(weak.state.defense.retryMs).toBeGreaterThan(0);await page.screenshot({path:`${root}/weak-gates-deferred.png`});
  27 |  await page.keyboard.press('Escape');await page.waitForFunction(()=>(window as any).__farwind().mode==='pause');const paused=await read(page);await page.waitForTimeout(800);expect((await read(page)).state.defense).toEqual(paused.state.defense);await page.getByRole('button',{name:'保存旅途',exact:true}).click();await expect(page.locator('#toast')).toContainText('已保存');await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();const restored=await read(page);expect(restored.state.defense.sequence).toBe(0);expect(restored.state.defense.guards.every((g:any)=>g.hp<10)).toBe(true);expect(restored.defense.arrows).toEqual([]);
  28 | });
  29 | 
```