import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {move} from './map-navigation';
const output=process.env.RUNE_EVIDENCE_DIRECTORY??'docs/runes/lightning-animation/runtime';
const read=(page:Page)=>page.evaluate(()=>(window as any).__runeLab.snapshot());
async function reset(page:Page,build:string,target='dummy'){
 await mkdir(output,{recursive:true});await page.goto('/?runeLab=1');
 await page.locator('#rune-lab-build').selectOption(build);await page.locator('#rune-lab-target').selectOption(target);await page.locator('#rune-lab-reset').click();
 await page.waitForFunction(()=>(window as any).__farwind().mode==='');await page.locator('#rune-lab-close').click();
}
async function shot(page:Page,name:string){await page.screenshot({path:`${output}/${name}.png`});}
test('单次真实雷击逐帧出现下降、接地回击和残弧，不请求雷柱贴图',async({page})=>{
 const requested:string[]=[];page.on('request',r=>{if(r.url().endsWith('/thunder.webp'))requested.push(r.url());});
 await reset(page,'r01');await page.keyboard.press('j');
 await page.waitForFunction(()=>{const s=(window as any).__runeLab.snapshot().符文;return s.visual.lightning.some((f:any)=>f.visual==='fork'&&f.age<60);},{},{polling:5});
 const first=await read(page),id=first.符文.visual.lightning.find((f:any)=>f.visual==='fork').id,frames:any[]=[];
 // 先读相位再拍摄，截图接口有耗时；不能拿截图后的相位冒充拍摄瞬间。
 for(const phase of ['descent','contact','afterglow']){
  await page.waitForFunction(({id,phase})=>(window as any).__runeLab.snapshot().符文.visual.lightning.some((f:any)=>f.id===id&&f.phase===phase),{id,phase},{polling:5});
  const before=(await read(page)).符文.visual.lightning.find((f:any)=>f.id===id);
  await page.screenshot({path:`${output}/motion-${phase}.jpg`,type:'jpeg',quality:88});
  const after=(await read(page)).符文.visual.lightning.find((f:any)=>f.id===id);
  frames.push({截图:`motion-${phase}.jpg`,拍摄前:before??null,拍摄后:after??null});
 }
 await page.waitForTimeout(450);const end=await read(page);
 await writeFile(`${output}/motion.json`,JSON.stringify({说明:'单次J真实命中，正常战斗时钟拍摄同一个事件；记录拍摄前后年龄，截图没有冻结、修改时钟或模拟伤害。截图接口耗时可能跨相位，记录完整保留。',事件:id,分镜:frames,贴图请求:requested,伤害:end.符文.metrics,环境:end.环境},null,2));
 expect(frames.map(f=>f.拍摄前?.phase)).toEqual(['descent','contact','afterglow']);expect(requested).toEqual([]);
 expect(end.符文.metrics.native).toBe(1);expect(end.符文.events.filter((e:any)=>e.tags.includes('lightning_hit'))).toHaveLength(1);expect(end.符文.visual.lightning).toHaveLength(0);
});
test('雷诏三轮与终结雷柱使用正式攻击',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await reset(page,'build-5');
 for(let i=0;i<28;i++){await page.keyboard.press('j');await page.waitForTimeout(150);}
 // 读取已有事件定位分镜，不改生命、时钟或命中结果。
 await page.waitForFunction(()=>{const s=(window as any).__runeLab.snapshot().符文;return s.effects.some((f:any)=>f.visual==='thunder-pillar'&&s.clock-f.born>=f.lead&&s.clock-f.born<f.lead+110);},{},{polling:10});
 await shot(page,'thunder-pillar');const active=await read(page);
 expect(active.符文.metrics.damage).toBeGreaterThan(0);expect(active.符文.visual.lightning.some((f:any)=>f.phase==='contact')).toBe(true);
 expect(active.符文.events.some((e:any)=>e.sourceDuoId==='d14')).toBe(true);
 await page.waitForTimeout(7000);const end=await read(page);expect(end.符文.visual.visible).toBe(0);expect(errors).toEqual([]);
 await writeFile(`${output}/thunder.json`,JSON.stringify({说明:'五绝世真实装备，J攻击触发三轮雷诏、雷矢连锁与主雷柱。正常时钟下捕获；动态折线、回击和分叉直接使用正式战斗时钟；末尾不留下雷电渲染对象。',运行环境:active.环境,伤害:active.符文.metrics,活跃材质:active.符文.visual,消散材质:end.符文.visual,页面异常:errors},null,2));
});
test('首领真实致命伤害触发凰心分镜',async({page})=>{
 await reset(page,'build-5','boss');await page.waitForFunction(()=>(window as any).__runeLab.snapshot().符文.metrics.phoenix===1,{},{timeout:60000,polling:10});
 await shot(page,'phoenix-ash');await page.waitForTimeout(390);await shot(page,'phoenix-wings');const release=await read(page);expect(release.符文.temporary.feathers).toBe(3);expect(release.世界.state.player.hp).toBeGreaterThan(0);
 await page.waitForTimeout(650);await shot(page,'phoenix-dissolve');
 await writeFile(`${output}/phoenix.json`,JSON.stringify({说明:'正式荆冠猎王攻击至致命伤害；不模拟命中，不修改生命。化烬、展翼与消散截图来自同次重生。',环境:release.环境,伤害:release.符文.metrics,冷却:release.符文.cooldowns,材质:release.符文.visual,生命:release.世界.state.player.hp,敌方预警:release.世界.warnings},null,2));
});
test('低闪光与简化画质仍有真实雷柱且无页面错误',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await reset(page,'build-5');
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'设置',exact:true}).click();
 await page.locator('#rune-simple').check();await page.locator('#rune-low-flash').check();
 await page.getByRole('button',{name:'返回',exact:true}).click();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');
 for(let i=0;i<28;i++){await page.keyboard.press('j');await page.waitForTimeout(150);}
 await page.waitForFunction(()=>{const s=(window as any).__runeLab.snapshot().符文;return s.effects.some((f:any)=>f.visual==='thunder-pillar'&&s.clock-f.born>=f.lead&&s.clock-f.born<f.lead+110);},{},{polling:10});
 const end=await read(page);expect(end.符文.metrics.damage).toBeGreaterThan(0);expect(end.世界.state.runes.settings).toEqual({simple:true,lowFlash:true});expect(errors).toEqual([]);
 await shot(page,'simplified');await writeFile(`${output}/simplified.json`,JSON.stringify({说明:'通过正式设置界面开启两项画质设置，正常J攻击。画质不改变判定另有确定性单测。',设置:end.世界.state.runes.settings,伤害:end.符文.metrics,材质:end.符文.visual,页面异常:errors},null,2));
});
test('正式流程取得雷触后装备并在生产构建命中木桩',async({page})=>{
 await mkdir(output,{recursive:true});await page.goto('http://127.0.0.1:5197/');await page.getByRole('button',{name:'启程 · 新游戏',exact:true}).click();
 await page.waitForFunction(()=>(window as any).__farwind().mode==='');await move(page,380,1335);await page.keyboard.press('e');
 await page.waitForFunction(()=>(window as any).__farwind().state.runes.owned.includes('r01'));await page.keyboard.press('r');await page.locator('[data-rune-id="r01"]').click();await page.locator('#rune-equip').click();
 await page.waitForFunction(()=>(window as any).__farwind().state.runes.slots[0]==='r01');await page.keyboard.press('Escape');await move(page,850,715);await page.keyboard.press('w');
 for(let i=0;i<3;i++){await page.keyboard.press('j');await page.waitForTimeout(150);}
 await page.waitForFunction(()=>{const s=(window as any).__farwind().runes;return s.effects.some((f:any)=>f.visual==='fork'&&s.clock-f.born>=f.lead&&s.clock-f.born<f.lead+160);},{},{polling:10});await shot(page,'production-lightning');
 const s=await page.evaluate(()=>(window as any).__farwind());expect(s.runes.events.some((e:any)=>e.tags.includes('lightning_hit'))).toBe(true);expect(s.state.skills.swordWindStage).toBe(0);expect(await page.locator('#rune-lab').count()).toBe(0);
 await writeFile(`${output}/production-lightning.json`,JSON.stringify({说明:'生产构建中新游戏，采集木材正常获得雷触，R页面正式装备，走到木桩以W转向、J三连命中。无赠予、无模拟攻击、无跳过技能学习。',装备:s.state.runes.slots,已学习剑风:s.state.skills.swordWindStage,伤害:s.runes.metrics,材质:s.runes.visual},null,2));
});
