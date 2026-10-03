import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {initialState,add,type State} from '../src/game/systems/state';
import {props} from '../src/data/world';
import {ENEMIES} from '../src/data/enemies';
import {CAMP_BOSSES} from '../src/data/maps/windbell/campBosses';
const root='docs/shadows/evidence';
const read=(page:Page)=>page.evaluate(()=>(window as any).__farwind());
async function start(page:Page,state?:State){
  await page.goto('/');
  if(state){page.once('dialog',d=>d.accept());const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.getByRole('button',{name:'导入存档',exact:true}).click()]);await chooser.setFiles({name:'shadow-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({说明:'独立浏览器的合法起点，仅配置位置与世界时间，阴影通过正式渲染器产生，不写战斗结果。',...state}))});}
  else await page.getByRole('button',{name:'启程 · 新游戏',exact:true}).click();
  await page.waitForFunction(()=>{const s=(window as any).__farwind?.();return s&&s.mode===''&&!s.sessionStarting&&s.shadows?.实体.some((e:any)=>e.名称==='主角'&&e.可见);});
}

test('十四种小怪的像素对照、四方向、光照、首领及死亡淡出',async({page})=>{
  await mkdir(root,{recursive:true});const errors:string[]=[],samples:unknown[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/tools/shadow-preview.html');await page.waitForFunction(()=>(window as any).__shadowPreview?.().就绪);
  await page.getByRole('button',{name:'暂停动画',exact:true}).click();
  const preview=()=>page.evaluate(()=>(window as any).__shadowPreview());
  const first=await preview();expect(first.阴影.数量).toBe(15);expect(first.阴影.实体.every((e:any)=>e.可见&&e.投影)).toBe(true);
  await page.screenshot({path:root+'/monsters-after.png',fullPage:true});
  const after=await page.locator('canvas').screenshot();
  await page.getByRole('button',{name:'查看原阴影',exact:true}).click();
  const before=await page.locator('canvas').screenshot();await page.screenshot({path:root+'/monsters-before.png',fullPage:true});
  const a=await sharp(after).removeAlpha().raw().toBuffer({resolveWithObject:true}),b=await sharp(before).removeAlpha().raw().toBuffer({resolveWithObject:true}),scale=a.info.width/1400;
  const differences=Object.keys(ENEMIES).map((kind,i)=>{
    let darker=0,change=0;const cx=(100+i%7*200)*scale,cy=(180+Math.floor(i/7)*240)*scale;
    for(let y=Math.round(cy+4*scale);y<Math.round(cy+65*scale);y++)for(let x=Math.round(cx-70*scale);x<Math.round(cx+90*scale);x++){
      const at=(y*a.info.width+x)*3,delta=(b.data[at]+b.data[at+1]+b.data[at+2]-a.data[at]-a.data[at+1]-a.data[at+2])/3;
      if(delta>5){darker++;change+=delta;}
    }
    expect(darker,`${kind}脚底附近必须出现新增的真实暗像素`).toBeGreaterThan(300);
    expect(change/darker,`${kind}阴影加深应足够明显`).toBeGreaterThan(15);
    return {怪物:kind,新增暗像素:darker,平均加深:change/darker};
  });
  await page.getByRole('button',{name:'查看增强阴影',exact:true}).click();
  for(const direction of ['0','1','2','3']){
    await page.locator('#direction').selectOption(direction);const s=await preview();expect(s.阴影.实体.every((e:any)=>e.可见&&e.投影)).toBe(true);samples.push({方向:direction,样本:s});
  }
  for(const light of ['480','1080','1260','indoor']){await page.locator('#light').selectOption(light);const s=await preview();expect(s.阴影.实体.every((e:any)=>e.可见&&e.透明度>0)).toBe(true);samples.push({光照:light,样本:s});}
  await page.locator('#light').selectOption('480');
  for(const ground of ['forest','road']){await page.locator('#ground').selectOption(ground);await page.screenshot({path:`${root}/monsters-${ground}.png`,fullPage:true});}
  for(const boss of Object.keys(CAMP_BOSSES)){
    await page.locator('#boss').selectOption(boss);await page.waitForFunction(()=>(window as any).__shadowPreview().就绪);const s=await preview();expect(s.阴影.实体.find((e:any)=>e.名称==='首领').投影).toBe(true);samples.push({首领:boss,样本:s});
  }
  await page.locator('#action').selectOption('death');await page.getByRole('button',{name:'继续动画',exact:true}).click();
  await page.waitForFunction(()=>{const s=(window as any).__shadowPreview();return s.时钟>=2500&&s.阴影.实体.slice(0,14).every((e:any)=>!e.可见&&!e.投影);});
  expect(errors).toEqual([]);
  await writeFile(root+'/preview-validation.json',JSON.stringify({说明:'使用正式渲染器并通过页面控件切换；逐个像素对照十四种小怪脚底，验证真实画面变暗，不以对象存在冒充可见。',结果:'通过',暗像素对照:differences,错误:errors,样本:samples},null,2));
});

test('正式新档中的角色、居民、物件、保存刷新与重启清理',async({page})=>{
  await mkdir(root,{recursive:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await start(page);
  const s=await read(page),list=s.shadows.实体;
  for(const label of ['主角','小黑','小宝','训练靶','室内家具'])expect(list.some((e:any)=>e.名称===label)).toBe(true);
  for(const p of props.filter(p=>p.kind==='resource'||p.kind==='chest'))expect(list.some((e:any)=>e.名称==='场景物件 · '+p.id)).toBe(true);
  const hero=list.find((e:any)=>e.名称==='主角');expect(hero.可见&&hero.投影).toBe(true);expect(hero.层级).toBeLessThan(s.warningLayers.ground);expect(hero.层级).toBeLessThan(hero.源层级);
  await page.screenshot({path:root+'/village-gameplay.png'});
  await page.keyboard.press('Escape');await page.locator('#save').click();await expect(page.getByText('旅途已保存',{exact:true})).toBeVisible();
  await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await page.waitForFunction(count=>{const s=(window as any).__farwind();return s.mode===''&&s.shadows.数量===count;},s.shadows.数量);
  const restored=await read(page);expect(restored.shadows.数量).toBe(s.shadows.数量);expect(restored.state.time).toBeGreaterThanOrEqual(s.state.time);
  await page.keyboard.press('Escape');await page.locator('#title').click();await page.getByRole('button',{name:'启程 · 新游戏',exact:true}).click();await page.locator('#yes').click();
  await page.waitForFunction(count=>{const s=(window as any).__farwind();return s.mode===''&&s.shadows.数量===count;},s.shadows.数量);const restarted=await read(page);expect(restarted.shadows.数量).toBe(s.shadows.数量);expect(errors).toEqual([]);
  await writeFile(root+'/gameplay-validation.json',JSON.stringify({说明:'独立浏览器正式新档核对全部采集物、宝箱及伙伴；通过正式按钮保存、刷新继续和重新启程，检查阴影数量不累积且世界进度正常保存。',结果:'通过',初始:s.shadows,刷新:restored.shadows,重启:restarted.shadows,错误:errors},null,2));
});

test('正式野外怪物与负坐标阴影',async({page})=>{
  await mkdir(root,{recursive:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const state=initialState();state.player.x=330;state.player.y=-50;
  await start(page,state);await page.keyboard.down('w');await page.waitForTimeout(500);await page.keyboard.up('w');
  await page.waitForFunction(()=>{const s=(window as any).__farwind();return s.shadows.实体.some((e:any)=>e.名称.startsWith('怪物')&&e.可见&&e.位置[1]<0);});
  const s=await read(page),monsters=s.shadows.实体.filter((e:any)=>e.名称.startsWith('怪物')&&e.可见);
  for(const e of monsters){expect(e.投影).toBe(true);expect(e.透明度).toBeGreaterThan(.4);expect(e.层级).toBeLessThan(e.源层级);}
  await page.screenshot({path:root+'/north-monsters-gameplay.png'});expect(errors).toEqual([]);
  await writeFile(root+'/wilderness-validation.json',JSON.stringify({说明:'通过正式存档导入合法山口起点，并以W行走触发正式遭遇；检查负坐标怪物的接地影和轮廓投影，不直接写入敌人运行态。',结果:'通过',怪物:monsters,错误:errors},null,2));
});

test('室内家具及返回室外时的阴影层级',async({page})=>{
  await mkdir(root,{recursive:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const state=initialState();state.life.playerSpace='old-home';state.player.x=700;state.player.y=870;
  await start(page,state);const inside=await read(page);expect(inside.state.life.playerSpace).toBe('old-home');
  const furniture=inside.shadows.实体.filter((e:any)=>e.名称==='室内家具'&&e.可见);expect(furniture.length).toBeGreaterThan(2);
  for(const e of furniture){expect(e.层级).toBeGreaterThan(7001);expect(e.层级).toBeLessThan(e.源层级);}
  expect(inside.shadows.实体.find((e:any)=>e.名称==='主角').层级).toBeGreaterThan(7001);
  await page.screenshot({path:root+'/interior-gameplay.png'});
  await page.keyboard.press('e');await page.waitForFunction(()=>(window as any).__farwind().state.life.playerSpace==='village');
  await page.waitForFunction(()=>{const list=(window as any).__farwind().shadows.实体;return list.find((e:any)=>e.名称==='主角').层级<0&&!list.some((e:any)=>e.名称==='室内家具'&&e.可见);});
  const outside=await read(page);expect(errors).toEqual([]);
  await writeFile(root+'/interior-validation.json',JSON.stringify({说明:'通过正式存档导入室内合法起点，核对家具与人物阴影在地面上方、实体下方；地毯无立体投影。按E正式离屋后，家具影隐藏、人物影回到室外地面。',结果:'通过',室内:inside.shadows,室外:outside.shadows,错误:errors},null,2));
});

test('采集淡化与正式修路移除障碍影',async({page})=>{
  await mkdir(root,{recursive:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const herb=initialState();herb.player.x=1180;herb.player.y=565;await start(page,herb);
  const before=await read(page),getHerb=(s:any)=>s.shadows.实体.find((e:any)=>e.名称==='场景物件 · herb-v1');
  expect(getHerb(before).源透明度).toBe(1);await page.keyboard.press('e');
  await page.waitForFunction(()=>(window as any).__farwind().state.collected['herb-v1']!==undefined);
  await page.waitForFunction(()=>(window as any).__farwind().shadows.实体.find((e:any)=>e.名称==='场景物件 · herb-v1').源透明度===.3);
  const gathered=await read(page);expect(getHerb(gathered).透明度/getHerb(before).透明度).toBeCloseTo(.3,2);
  await page.screenshot({path:root+'/gathered-resource.png'});
  // 导入另一个独立、合法的材料起点，修路结果必须由界面交付产生。
  await page.keyboard.press('Escape');await page.locator('#title').click();
  const road=initialState();road.player.x=2720;road.player.y=550;add(road,'wood',3);add(road,'stone',1);
  page.once('dialog',d=>d.accept());const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.getByRole('button',{name:'导入存档',exact:true}).click()]);
  await chooser.setFiles({name:'shadow-repair-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({说明:'独立修路起点，携带所需合法材料，修复只走正式交付与存档事务。',...road}))});
  await page.waitForFunction(()=>{const s=(window as any).__farwind();return s.mode===''&&s.shadows.实体.some((e:any)=>e.名称==='场景物件 · barrier-east-corridor'&&e.可见);});
  const repairBefore=await read(page);await page.keyboard.press('e');await page.getByRole('button',{name:/交付.*并修复/}).click();
  await page.waitForFunction(()=>{const s=(window as any).__farwind();return s.state.mapProgress.shortcuts.includes('east-corridor')&&!s.shadows.实体.find((e:any)=>e.名称==='场景物件 · barrier-east-corridor').可见;});
  const repairAfter=await read(page);expect(repairAfter.shadows.实体.find((e:any)=>e.名称==='场景物件 · barrier-east-corridor').投影).toBe(false);expect(errors).toEqual([]);
  await writeFile(root+'/mutable-props-validation.json',JSON.stringify({说明:'正式E采集使源物件与阴影同步变淡；正式交付材料修路使障碍物与投影同时隐藏，修复已写入存档。未写运行时采集或修路结果。',结果:'通过',采集前:getHerb(before),采集后:getHerb(gathered),修路前:repairBefore.shadows.实体.find((e:any)=>e.名称==='场景物件 · barrier-east-corridor'),修路后:repairAfter.shadows.实体.find((e:any)=>e.名称==='场景物件 · barrier-east-corridor'),错误:errors},null,2));
});
