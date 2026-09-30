import {test,expect,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {CAMP_BOSSES,type CampBossKind} from '../src/data/maps/windbell/campBosses';
import {ENCOUNTERS} from '../src/data/maps/windbell/encounters';
import {VILLAGE_ANCHORS} from '../src/data/maps/windbell/layout';
import {syncMapGeometry} from '../src/data/world';
import {move} from './map-navigation';
import {fight} from './field-combat';
const read=(p:Page)=>p.evaluate(()=>(window as any).__farwind());
async function resume(page:Page){
 await page.getByRole('button',{name:'继续旅途',exact:true}).click();
 for(let n=0;n<8;n++){const s=await read(page);if(!s.mode)return;if(s.mode==='dialog')await page.getByRole('button',{name:'继续 · E',exact:true}).click();await page.waitForTimeout(40);}
 throw Error('正常继续操作没有返回游戏。');
}
async function setup(page:Page,kind:CampBossKind){
 await page.goto('/');await page.getByRole('button',{name:'启程 · 新游戏',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind?.().mode==='');
 await move(page,560,810);await page.keyboard.press('e');await page.getByRole('button',{name:'领取委托与启程补给',exact:true}).click();await expect(page.locator('#commission-feedback')).toContainText('委托已领取');await page.getByRole('button',{name:'合上委托簿 Esc',exact:true}).click();
 await move(page,VILLAGE_ANCHORS.smith.x,VILLAGE_ANCHORS.smith.y+65);await page.keyboard.press('e');await page.getByLabel('物品',{exact:true}).selectOption('ironSword');await page.locator('#shop-review').click();await page.locator('#shop-confirm').click();await expect(page.locator('#shop-feedback')).toContainText('已完成');await page.keyboard.press('Escape');
 await page.keyboard.press('Tab');await page.locator('.slot').filter({hasText:'铁剑'}).click();await page.locator('#equip').click();await page.waitForFunction(()=>(window as any).__farwind().state.equipment.weapon==='ironSword');await page.keyboard.press('Escape');
 // 在首领入场前通过正常按钮展开地图，复现用户截图中的布局条件。
 await page.locator('#minimap-toggle').click();
 const routes:Record<CampBossKind,number[][]>={'spore-heart':[[900,1900],[1050,2040],[1000,2450],[1250,2820]],'thorn-crown':[[820,120],[-80,120],[-140,1260],[-700,1340],[-1700,1490]],'crag-tusk':[[820,120],[560,-140],[1030,-260],[1480,-730]],'bound-branch':[[1980,1100],[2580,1100],[3710,1100]]};
 for(const [x,y] of routes[kind])await move(page,x,y);
}
for(const kind of Object.keys(CAMP_BOSSES) as CampBossKind[])test(`presentation-${kind}`,async({page})=>{
 syncMapGeometry(false);const root=`docs/camp-bosses/evidence/presentation-${kind}`;mkdirSync(root,{recursive:true});const errors:string[]=[],report:any={说明:'关闭测试授予的正式构建；真实键鼠新游戏、领取补给、购买铁剑、装备、步行及清杂兵。诊断只读。检查展开小地图、顶部血条、四种显形、主角反应、输入及保存重开。',首领:CAMP_BOSSES[kind].name,节点:[],布局:[],错误:errors,结果:'进行中'};page.on('pageerror',e=>errors.push(e.message));
 const camp=ENCOUNTERS.find(c=>c.id===CAMP_BOSSES[kind].camp)!,id='boss-'+kind,save=()=>writeFileSync(root+'/presentation.json',JSON.stringify(report,null,2));
 const node=async(name:string,picture?:string)=>{const s=await read(page);report.节点.push({名称:name,模拟毫秒:s.skillGrowth.sim,世界分钟:s.state.time,玩家:s.state.player,据点:s.state.encounters.groups[camp.id],首领:s.enemies.find((e:any)=>e.id===id),动画:s.bossPresentation});save();if(picture)await page.screenshot({path:root+'/'+picture+'.png'});return s;};
 try{
  await setup(page,kind);expect((await read(page)).state.skills.swordWindStage).toBe(0);
  await fight(page,camp.members.filter(m=>!m.boss).map(m=>m.id));await node('地面先出现异动，驻守死亡仍不能清除','warning');
  await page.waitForFunction(id=>{const s=(window as any).__farwind(),e=s.enemies.find((e:any)=>e.id===id);return e&&e.behavior.battle.entryUntil-s.skillGrowth.sim>750&&e.behavior.battle.entryUntil-s.skillGrowth.sim<1050&&s.bossPresentation.hero.key.includes('/alert/');},id);
  const arriving=await node('显形姿态、专属粒子与旅人提剑反应','arrival');const e=arriving.enemies.find((e:any)=>e.id===id);expect(e.behavior.attack).toBe(null);expect(e.behavior.pose.phase).toBe('首领现身');expect(arriving.bossPresentation.reaction.visible).toBe(true);expect(arriving.bossPresentation.reaction.text).toContain('旅人：');expect(arriving.bossPresentation.hero.direction).toBe(arriving.bossPresentation.combatFacing);
  await page.keyboard.press('Escape');await expect(page.locator('.pause-panel')).toBeVisible();const paused=await read(page),remaining=paused.state.encounters.groups[camp.id].boss.combat.battle.entryUntil;expect(remaining).toBeGreaterThan(0);await page.waitForTimeout(250);expect((await read(page)).skillGrowth.sim).toBe(paused.skillGrowth.sim);
  if(kind==='spore-heart'){
   await page.getByRole('button',{name:'保存旅途',exact:true}).click();await expect(page.locator('#toast')).toContainText('已保存');await page.reload();await resume(page);const restored=await node('显形中保存重开继续剩余时间');expect(restored.state.encounters.groups[camp.id].boss.attempt).toBe(paused.state.encounters.groups[camp.id].boss.attempt);expect(restored.enemies.find((e:any)=>e.id===id).behavior.battle.entryUntil-restored.skillGrowth.sim).toBeGreaterThan(0);expect(restored.state.encounters.groups[camp.id].members.at(-1).hp).toBe(CAMP_BOSSES[kind].hp);
  }else await resume(page);
  const before=await read(page);await page.keyboard.down('d');await page.waitForTimeout(80);await page.keyboard.up('d');const after=await node('入场时方向输入正常生效');expect(after.state.player.x).toBeGreaterThan(before.state.player.x+3);
  await page.waitForFunction(id=>{const s=(window as any).__farwind(),e=s.enemies.find((e:any)=>e.id===id);return e&&s.skillGrowth.sim>=e.behavior.battle.entryUntil&&s.skillGrowth.sim<e.behavior.battle.nextAt;},id);expect((await read(page)).enemies.find((e:any)=>e.id===id).behavior.attack).toBe(null);
  await page.waitForFunction(id=>!!(window as any).__farwind().enemies.find((e:any)=>e.id===id)?.behavior.attack,id);const first=await node('显形结束后留出完整首招预警','battle-expanded-map');const attacking=first.enemies.find((e:any)=>e.id===id);expect(attacking.behavior.attack.startedAt).toBeGreaterThanOrEqual(attacking.behavior.battle.entryUntil+650-1);expect(attacking.behavior.attack.contactAt-attacking.behavior.attack.startedAt).toBeGreaterThanOrEqual(650);expect(first.state.encounters.groups[camp.id].cleared).toBe(false);
  // 折叠组合通过按钮切换，量测时暂停；不改游戏状态或样式。
  for(const folds of [[true,false],[true,true],[false,true],[false,false]]){
   for(const [i,name] of ['minimap','quest'].entries())if(await page.locator(`#${name}-toggle`).getAttribute('aria-expanded')!==String(folds[i]))await page.locator(`#${name}-toggle`).click();
   await page.keyboard.press('Escape');await expect(page.locator('.pause-panel')).toBeVisible();
   for(const viewport of [{width:400,height:720},{width:820,height:560},{width:1000,height:628},{width:1280,height:720}]){
    await page.setViewportSize(viewport);await page.waitForTimeout(40);
    const boxes=await page.evaluate(()=>{const rect=(el:Element)=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};},boss=document.querySelector('#camp-boss-status')!;return {boss:rect(boss),children:[...boss.children,...boss.querySelector('.boss-title')!.children].map(rect),panels:['.vitals','.hud-info'].map(s=>rect(document.querySelector(s)!)),canvas:rect(document.querySelector('#game canvas')!),scroll:document.documentElement.scrollWidth,width:innerWidth};});
    expect(boxes.boss.y).toBeLessThanOrEqual(22);expect(boxes.boss.height).toBeLessThanOrEqual(70);expect(boxes.boss.bottom).toBeLessThan(100);expect(boxes.scroll).toBeLessThanOrEqual(viewport.width);
    expect(boxes.canvas.width).toBeCloseTo(viewport.width,0);expect(boxes.canvas.height).toBeCloseTo(viewport.height,0);expect(boxes.canvas.x).toBeCloseTo(0,0);expect(boxes.canvas.y).toBeCloseTo(0,0);
    for(const r of [...boxes.children,...boxes.panels]){expect(r.x).toBeGreaterThanOrEqual(0);expect(r.right).toBeLessThanOrEqual(viewport.width);}
    const a=boxes.boss;for(const p of boxes.panels)expect(a.right<=p.x||p.right<=a.x||a.bottom<=p.y||p.bottom<=a.y).toBe(true);
    report.布局.push({小地图展开:folds[0],任务展开:folds[1],视口:viewport,边界:boxes});save();
   }
   await page.setViewportSize({width:1000,height:628});await resume(page);
  }
  await page.locator('#minimap-toggle').click();await page.keyboard.press('k');await node('展开地图时中央战斗区无遮挡','layout-fixed');await page.setViewportSize({width:400,height:720});await page.waitForTimeout(250);await node('四百像素窄屏仍保留中央战斗区','narrow-layout');await page.setViewportSize({width:1000,height:628});expect(errors).toEqual([]);report.结果='通过';
 }catch(error){report.结果='未通过';report.原因=(error as Error).message;report.失败状态=await read(page);await page.screenshot({path:root+'/failure.png'});throw error;}finally{save();const video=page.video();await page.close();if(video)await video.saveAs(root+'/presentation.webm');}
});
test('viewport-dpr-two',async({browser})=>{
 const context=await browser.newContext({baseURL:'http://127.0.0.1:5815',viewport:{width:1000,height:628},deviceScaleFactor:2}),page=await context.newPage(),root='docs/camp-bosses/evidence/presentation-viewport';mkdirSync(root,{recursive:true});const records:any[]=[];
 try{
  await page.goto('/');await page.getByRole('button',{name:'启程 · 新游戏',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind?.().mode==='');await page.locator('#minimap-toggle').click();
  for(const viewport of [{width:1000,height:628},{width:400,height:720},{width:1280,height:720},{width:820,height:560},{width:720,height:400}]){
   await page.setViewportSize(viewport);await page.waitForTimeout(300);const actual=await page.evaluate(()=>{const c=document.querySelector<HTMLCanvasElement>('#game canvas')!,r=c.getBoundingClientRect(),p=(window as any).__farwind().bossPresentation;return {画布:{x:r.x,y:r.y,width:r.width,height:r.height,像素宽:c.width,像素高:c.height},主角屏幕:{x:r.x+(p.hero.root[0]-p.camera.view.x)*p.camera.zoom*r.width/c.width,y:r.y+(p.hero.root[1]-p.camera.view.y)*p.camera.zoom*r.height/c.height},设备像素比:devicePixelRatio};});
   expect(actual.画布.width).toBeCloseTo(viewport.width,0);expect(actual.画布.height).toBeCloseTo(viewport.height,0);expect(actual.画布.x).toBeCloseTo(0,0);expect(actual.画布.y).toBeCloseTo(0,0);expect(actual.主角屏幕.x).toBeGreaterThan(0);expect(actual.主角屏幕.x).toBeLessThan(viewport.width);expect(actual.主角屏幕.y).toBeGreaterThan(0);expect(actual.主角屏幕.y).toBeLessThan(viewport.height);records.push({视口:viewport,实测:actual});await page.screenshot({path:root+`/viewport-${viewport.width}.png`});
  }
 }finally{writeFileSync(root+'/viewport.json',JSON.stringify({说明:'设备像素比二，真实新游戏和展开地图后改变窗口尺寸；仅读取画布及主角投影，不改游戏状态。',样本:records},null,2));await context.close();}
});
