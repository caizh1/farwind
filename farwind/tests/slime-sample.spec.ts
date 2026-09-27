import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { move } from './map-navigation';
const dir='docs/enemy-design-v2/slime-animation/evidence';
const state=(page:Page)=>page.evaluate(()=>(window as any).__farwind());
const sample=(page:Page)=>page.evaluate(()=>(window as any).__slimeSample());
async function faceIncoming(page:Page,id:string) {
  await page.waitForFunction(id=>{const s=(window as any).__farwind();return s.warnings.some((w:any)=>w.id.startsWith(id)&&w.predicted!==null&&w.lead<=300&&w.lead>200);},id,{polling:5,timeout:10000});
  const s=await state(page), enemy=s.enemies.find((e:any)=>e.id===id);
  const dx=enemy.x-s.state.player.x,dy=enemy.y-s.state.player.y;
  const key=Math.abs(dx)>Math.abs(dy)?dx<0?'a':'d':dy<0?'w':'s';
  await page.keyboard.down(key);await page.waitForTimeout(35);await page.keyboard.up(key);
}
test.beforeAll(async()=>mkdir(dir,{recursive:true}));
test.afterEach(async({page},info)=>{
  if(info.status!==info.expectedStatus && !page.isClosed()) await writeFile(`${dir}/${info.title}-first-cause.json`,JSON.stringify({说明:'失败首因，保留当次状态，不以重放掩盖错误',样片:await sample(page).catch(()=>null),世界:await state(page).catch(()=>null)},null,2));
});
test('fixed-preview',async({page})=>{
  const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/slime-preview.html'); await page.waitForFunction(()=>(window as any).__slimeSample);
  await page.getByRole('button',{name:'暂停',exact:true}).click();
  const observations=[];
  for(const facing of ['0','1','2','3']) for(const action of ['idle','walk','attack','hurt','parry','perfect','death']) {
    await page.locator('#direction').selectOption(facing); await page.locator('#action').selectOption(action);
    await page.locator('#scrub').press('End'); const s=await sample(page); observations.push(s);
    expect(s.pose.action).toBe(action); expect(s.pose.facing).toBe(Number(facing)); expect(s.root).toEqual([630,410]);
    expect(s.paused).toBe(true); expect(s.provisional).toBe(true);
  }
  await page.locator('#action').selectOption('attack'); await page.locator('#scrub').press('Home');
  await page.screenshot({path:`${dir}/fixed-preview.png`,fullPage:true});
  await page.locator('#action').selectOption('parry'); await page.locator('#direction').selectOption('1');
  await page.locator('#background').selectOption('village-night'); await page.locator('#scrub').press('End');
  await page.screenshot({path:`${dir}/fixed-up-parry-night.png`,fullPage:true});
  expect(errors).toEqual([]); await writeFile(`${dir}/fixed-validation.json`,JSON.stringify({说明:'真实控件检查四方向七动作；左向为角色镜像，未增加独立生成帧',状态:'技术检查通过，美术待验收',错误:errors,观察:observations},null,2));
});
test('natural-gameplay',async({page})=>{
  const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/slime-preview.html?mode=game');
  await page.getByRole('button',{name:'启程 · 新游戏',exact:true}).click();
  await page.waitForFunction(()=>(window as any).__farwind()?.mode==='');
  await move(page,2390,1060);
  await page.waitForFunction(()=>(window as any).__slimeSample().history.some((x:any)=>x.id==='slime-1'&&x.action==='attack'),null,{timeout:10000});
  await page.screenshot({path:`${dir}/game-attack.png`});
  await page.keyboard.down('d'); await page.waitForTimeout(50); await page.keyboard.up('d'); await page.keyboard.press('j');
  await page.waitForFunction(()=>(window as any).__slimeSample().history.some((x:any)=>x.id==='slime-1'&&x.action==='hurt'),null,{timeout:10000});
  await page.screenshot({path:`${dir}/game-hurt.png`});
  await faceIncoming(page,'slime-1');
  await page.waitForFunction(()=>{const s=(window as any).__farwind();return s.warnings.some((w:any)=>w.id.startsWith('slime-1')&&w.predicted!==null&&w.lead<=150&&w.lead>110);},null,{polling:5,timeout:10000});
  await page.keyboard.press('k');
  await page.waitForFunction(()=>(window as any).__slimeSample().history.some((x:any)=>x.id==='slime-1'&&(x.action==='parry'&&x.frame===6||x.action==='death')),null,{polling:5,timeout:10000});
  await page.screenshot({path:`${dir}/game-parry.png`});
  // 守卫箭矢可在失衡中造成致死伤害；正确末态是死亡，不能强迫已死敌人播放恢复帧。
  await page.waitForFunction(()=>(window as any).__slimeSample().history.some((x:any)=>x.id==='slime-1'&&(x.action==='parry'&&x.frame===11||x.action==='death')),null,{timeout:10000});
  if((await state(page)).enemies.find((e:any)=>e.id==='slime-1').hp>0) {await page.waitForTimeout(250);await page.keyboard.press('j');}
  await page.waitForFunction(()=>(window as any).__slimeSample().history.some((x:any)=>x.id==='slime-1'&&x.action==='death'),null,{timeout:10000});
  await page.waitForTimeout(650); await page.screenshot({path:`${dir}/game-death.png`});
  // 第二只史莱姆已自然追来；其家园旁的2610,1230在河道内，不能当作站立目标。
  await faceIncoming(page,'slime-2');
  await page.waitForFunction(()=>{const s=(window as any).__farwind();return s.warnings.some((w:any)=>w.id.startsWith('slime-2')&&w.predicted!==null&&w.lead<=50&&w.lead>25);},null,{polling:5,timeout:10000});
  await page.keyboard.press('k');
  await page.waitForFunction(()=>(window as any).__slimeSample().history.some((x:any)=>x.id==='slime-2'&&x.action==='perfect'),null,{polling:5,timeout:10000});
  await page.screenshot({path:`${dir}/game-perfect-parry.png`});
  // 致死反斩应进入死亡，不能为了播放完整失衡而让已经死亡的敌人恢复待机。
  await page.waitForFunction(()=>(window as any).__slimeSample().history.some((x:any)=>x.id==='slime-2'&&(x.action==='perfect'&&x.frame===11||x.action==='death')),null,{timeout:10000});
  const s=await state(page),art=await sample(page);
  expect(s.contacts.some((c:any)=>c.result==='normal')).toBe(true); expect(s.contacts.some((c:any)=>c.result==='perfect')).toBe(true);
  for(const e of art.enemies) {expect(e.origin).toEqual([.5,110/128]);expect(e.scale[0]).toBeCloseTo(e.scale[1],7);}
  expect(errors).toEqual([]);
  await page.keyboard.press('Escape');const before=(await sample(page)).sim;await page.waitForTimeout(250);expect((await sample(page)).sim).toBe(before);
  await writeFile(`${dir}/game-validation.json`,JSON.stringify({说明:'从新游戏正常键盘行走至森林；未导入修改存档、未注入状态。弹反按只读接触时间触发用于集成验证，不能据此宣称普通玩家可读性通过。',状态:'技术检查通过，美术与设备性能待验收',错误:errors,样片:art,接触:s.contacts,存档边界:'专用服务使用farwind-slime-animation-sample；不读写现有farwind-save或5173存档'},null,2));
});
test('training-parry-recovery',async({page})=>{
  await page.goto('/slime-preview.html?mode=game'); await page.getByRole('button',{name:'启程 · 新游戏',exact:true}).click();
  await page.waitForFunction(()=>(window as any).__farwind()?.mode===''); await move(page,850,720);
  await page.keyboard.down('w');await page.waitForTimeout(35);await page.keyboard.up('w');
  await page.getByRole('button',{name:'迎风架剑练习',exact:true}).click();
  await page.getByRole('button',{name:'史莱姆节奏 · 450毫秒',exact:true}).click();
  await page.waitForFunction(()=>{const s=(window as any).__farwind();return s.warnings.some((w:any)=>w.id.startsWith('practice-')&&w.predicted!==null&&w.lead<=150&&w.lead>110);},null,{polling:5,timeout:10000});
  await page.keyboard.press('k');
  await page.waitForFunction(()=>(window as any).__slimeSample().history.some((x:any)=>x.id.startsWith('practice-')&&x.action==='parry'&&x.frame===11),null,{timeout:10000});
  await page.waitForFunction(()=>{const s=(window as any).__farwind();return s.warnings.some((w:any)=>w.id.startsWith('practice-')&&w.predicted!==null&&w.lead<=50&&w.lead>25);},null,{polling:5,timeout:10000});
  await page.keyboard.press('k');
  await page.waitForFunction(()=>(window as any).__slimeSample().history.some((x:any)=>x.id.startsWith('practice-')&&x.action==='perfect'&&x.frame===6),null,{polling:5,timeout:10000});
  await page.screenshot({path:`${dir}/game-training-perfect.png`});
  await page.waitForFunction(()=>(window as any).__slimeSample().history.some((x:any)=>x.id.startsWith('practice-')&&x.action==='perfect'&&x.frame===11),null,{timeout:10000});
  const art=await sample(page);expect((await state(page)).contacts.some((c:any)=>c.result==='perfect')).toBe(true);
  const databases=await page.evaluate(async()=>(await indexedDB.databases()).map(d=>d.name));
  expect(databases).toContain('farwind-slime-animation-sample');expect(databases).not.toContain('farwind-save');
  expect(art.history.some((x:any)=>x.action==='parry'&&x.frame===11)).toBe(true);
  await writeFile(`${dir}/training-perfect-validation.json`,JSON.stringify({说明:'通过正常行走与可见练习按钮启用史莱姆投影，反斩伤害落在木桩而非投影，验证完整600毫秒普通与800毫秒精准弹反恢复；未注入状态',状态:'技术检查通过，美术待验收',样片:art,数据库:databases},null,2));
});
test('normal-entry-is-unchanged',async({page})=>{
  const candidates:string[]=[];page.on('request',r=>{if(r.url().includes('slime-sample'))candidates.push(r.url());});
  await page.goto('/'); await page.getByRole('button',{name:'启程 · 新游戏',exact:true}).waitFor();
  expect(await page.evaluate(()=>typeof (window as any).__slimeSample)).toBe('undefined');expect(candidates).toEqual([]);
});
