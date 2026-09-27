import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {move} from './map-navigation';
const dir='docs/enemy-combat-v1/evidence';
const read=(page:Page)=>page.evaluate(()=>(window as any).__farwind());
test.beforeAll(async()=>mkdir(dir,{recursive:true}));
test.afterEach(async({page},info)=>{if(info.status!==info.expectedStatus&&!page.isClosed())await writeFile(`${dir}/${info.title}-first-cause.json`,JSON.stringify({说明:'生产验收失败首因；诊断只读',世界:await read(page),反馈:await page.locator('#parry-feedback').textContent(),训练:await page.locator('#training-stats').textContent()},null,2));});
test('production-assets-save-and-diagnostics',async({page,request})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'启程 · 新游戏',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');
  await expect(page.locator('#toast')).toContainText('风铃村欢迎你');
  const s=await read(page);expect(s.enemies).toHaveLength(7);expect(s.state.player.hp).toBe(100);expect(s.animation).toBeUndefined();expect(s.session).toBeUndefined();expect(s.enemies.every((e:any)=>e.art===undefined)).toBe(true);expect(await page.evaluate(()=>typeof (window as any).__enemyPreview)).toBe('undefined');
  for(const name of ['moss-slime','branch-reaper','ashen-spore','armored-boar','dusk-raven','spore-projectile','spore-burst'])expect((await request.get(`/assets/enemies-v1/${name}.png`)).status()).toBe(200);
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'保存并返回标题',exact:true}).click();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');expect((await read(page)).enemies).toHaveLength(7);expect(errors).toEqual([]);await page.screenshot({path:`${dir}/production-entry.png`});await writeFile(`${dir}/production-entry.json`,JSON.stringify({说明:'生产图集和新游戏、读取存档验证；未暴露新敌人动画调试入口',错误:errors,世界:await read(page)},null,2));
});
test('production-real-input-new-enemy-parry',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'启程 · 新游戏',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');await move(page,850,720);
  const y=(await read(page)).state.player.y;await page.keyboard.down('w');await page.waitForFunction(y=>(window as any).__farwind().state.player.y<y-5,y);await page.keyboard.up('w');await page.getByRole('button',{name:'迎风架剑练习',exact:true}).click();const at=(await read(page)).skillGrowth.sim;await page.getByRole('button',{name:'棘甲林豕 · 直线冲锋',exact:true}).click();
  // 软件渲染会限制每帧模拟预算；读取现有生产只读时钟，避免把墙钟等待当成战斗时间。
  // 在暂停的选择菜单里记录稳定起点，避免关闭菜单至读状态期间多推进一帧导致普通窗口变精准窗口。
  await page.waitForFunction(at=>(window as any).__farwind().skillGrowth.sim>=at+920,at,{polling:5});await page.keyboard.press('k');
  await expect(page.locator('#parry-feedback')).toContainText('普通成功');await expect(page.locator('#training-stats')).toContainText('24伤害');expect((await read(page)).state.player.hp).toBe(100);expect(errors).toEqual([]);await page.screenshot({path:`${dir}/production-boar-parry.png`});await writeFile(`${dir}/production-validation.json`,JSON.stringify({说明:'生产构建，通过新游戏、正常键盘行走及可见林豕练习按钮，真实K完成普通弹反与自动反斩；只读生产模拟时钟用于输入时序，不注入任何状态。此项是技术集成验证，玩家动作可读性仍待审阅。',状态:'技术通过，美术待审阅',错误:errors,训练:await page.locator('#training-stats').textContent(),世界:await read(page)},null,2));
});
