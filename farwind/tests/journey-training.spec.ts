import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { move } from './skill-navigation';

const root = 'docs/journey-training/evidence';
const read = async (page: Page) => {
  await page.waitForFunction(()=>typeof (window as any).__farwind==='function');
  return page.evaluate(() => (window as any).__farwind());
};
async function importSample(page: Page, sample: unknown) {
  page.once('dialog', dialog=>dialog.accept());
  const chooser=page.waitForEvent('filechooser');await page.locator('#import').click();
  await (await chooser).setFiles({name:'journey-sample.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(sample))});
  await page.waitForFunction(()=>(window as any).__farwind().mode==='');
}
async function saveAndReload(page: Page) {
  await page.keyboard.press('Escape');await page.locator('#save').click();
  await expect(page.locator('#toast')).toContainText('旅途已保存');
  await page.reload();await page.locator('#continue').click();
  await page.waitForFunction(()=>(window as any).__farwind().mode==='');
}
test('JT-01', async ({page})=>{
  await mkdir(root,{recursive:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.locator('#new').click();
  await page.waitForFunction(()=>(window as any).__farwind().mode==='');
  expect((await read(page)).state.physique.runDistance).toBe(0);
  await page.keyboard.down('d');await page.waitForTimeout(450);await page.keyboard.up('d');
  expect((await read(page)).state.physique.runDistance).toBe(0);
  await page.keyboard.press('l');await page.waitForTimeout(550);
  expect((await read(page)).state.physique.runDistance).toBe(0);
  await move(page,670,720);
  // 点击真实HUD按钮后重新按空格，验证按钮焦点不会截获奔跑。
  await page.locator('#minimap-toggle').click();
  await page.keyboard.down('Space');await page.keyboard.down('d');
  await expect.poll(async()=>(await read(page)).state.physique.runDistance).toBeGreaterThan(20);
  await page.keyboard.up('d');await page.keyboard.up('Space');
  const beforePause=(await read(page)).state.physique.runDistance;
  await page.keyboard.press('Escape');await page.keyboard.down('a');
  await page.waitForTimeout(500);expect((await read(page)).state.physique.runDistance).toBe(beforePause);
  await page.keyboard.up('a');await page.locator('#close').click();
  // 真实庭院往返；恢复期间的步行仍发生，但不会增加锻炼里程。
  await page.keyboard.down('Space');let turns=0;
  for(;turns<240;turns++){
    const state=await read(page);if(state.state.physique.runDistance>=16000)break;
    const right=state.state.player.x<710,key=right?'d':'a',target=right?810:610;
    await page.keyboard.down(key);
    try{
      await page.waitForFunction(({right,target})=>{
        const s=(window as any).__farwind();
        return s.state.physique.runDistance>=16000||(right?s.state.player.x>=target:s.state.player.x<=target);
      },{right,target},{timeout:8000,polling:30});
    }finally{await page.keyboard.up(key);}
  }
  await page.keyboard.up('Space');const grown=await read(page);
  expect(grown.state.physique.runDistance).toBeGreaterThanOrEqual(16000);
  expect(grown.state.physique.runDistance).toBeLessThan(16150);
  expect(grown.state.player.hp).toBe(100);
  await expect(page.locator('.stamina')).toHaveAttribute('aria-valuemax','101');
  await expect(page.locator('.health')).toHaveAttribute('aria-valuemax','100');
  await expect(page.locator('#toast')).toContainText('体力上限 +1（101）');
  await page.screenshot({path:root+'/first-growth.png'});
  await page.keyboard.press('q');await expect(page.locator('#journey-training')).toContainText('体力上限 101 / 200');
  await expect(page.locator('#journey-training')).toContainText('生命上限 100 / 200');
  await page.screenshot({path:root+'/journal.png'});await page.keyboard.press('Escape');
  await saveAndReload(page);
  expect((await read(page)).state.physique.runDistance).toBe(grown.state.physique.runDistance);
  await expect(page.locator('.stamina')).toHaveAttribute('aria-valuemax','101');
  expect(errors).toEqual([]);
  await writeFile(root+'/normal-flow.json',JSON.stringify({说明:'正式生产构建，从零里程新档用真实键盘跑满首个500米。未修改游戏状态、坐标、速度、时间或里程。',庭院转折次数:turns,成长时里程米:grown.state.physique.runDistance/32,生命当前值:grown.state.player.hp,体力上限:101,暂停与步行及风步不计入:true,鼠标操作后空格奔跑:true,刷新保留:true,页面异常:errors},null,2));
});
test('JT-02',async({page})=>{
  await mkdir(root,{recursive:true});await page.goto('/');
  const sample=(await read(page)).state;sample.physique.runDistance=5000*32;
  await importSample(page,sample);
  await expect(page.locator('.health')).toHaveAttribute('aria-valuemax','104');
  await expect(page.locator('.stamina')).toHaveAttribute('aria-valuemax','108');
  const width=parseFloat(await page.locator('.health i').evaluate(el=>(el as HTMLElement).style.width));
  expect(width).toBeCloseTo(100/104*100,3);
  await move(page,680,920);await page.keyboard.press('e');
  await expect.poll(async()=>(await read(page)).state.player.hp).toBe(104);
  await expect.poll(async()=>(await read(page)).state.player.stamina).toBe(108);
  expect((await read(page)).state.physique.runDistance).toBe(160000);
  await page.keyboard.press('Escape');const download=page.waitForEvent('download');await page.locator('#export').click();
  const exported=JSON.parse(await readFile((await (await download).path())!,'utf8'));
  expect(exported.physique.runDistance).toBe(160000);
  await importSample(page,exported);await page.keyboard.press('q');
  await expect(page.locator('#journey-training')).toContainText('5,000 米');
  await expect(page.locator('#journey-training')).toContainText('永久 +8');
  await expect(page.locator('#journey-training')).toContainText('永久 +4');
  await page.setViewportSize({width:390,height:844});
  const overflow=await page.locator('#journey-training').evaluate(el=>el.scrollWidth>el.clientWidth);
  expect(overflow).toBe(false);await page.screenshot({path:root+'/journal-narrow.png'});
  await page.keyboard.press('Escape');await page.keyboard.press('Escape');
  const full=(await read(page)).state;full.physique.runDistance=347500*32;full.player.hp=full.player.stamina=200;
  await importSample(page,full);await page.keyboard.press('q');
  await expect(page.locator('#journey-training')).toContainText('两项锻炼已满');
  await expect(page.locator('.health')).toHaveAttribute('aria-valuemax','200');
  await expect(page.locator('.stamina')).toHaveAttribute('aria-valuemax','200');
  await writeFile(root+'/boundary-flow.json',JSON.stringify({说明:'明确的成长存档边界样本，仅证明导入导出、恢复、显示和封顶；不作为自然练满证据。',五公里上限:{生命:104,体力:108},泉水按上限恢复:true,导出重新导入保留:true,窄屏无溢出:true,两项封顶:200},null,2));
});
test('JT-03',async({page})=>{
  await page.goto('/');const old:any=(await read(page)).state,currentVersion=old.schema_version;old.schema_version=18;delete old.physique;old.coins=43;old.player.hp=72;old.bag[0]={id:'berry',count:3};
  await importSample(page,old);let state=(await read(page)).state;
  expect(state.physique.runDistance).toBe(0);expect(state.coins).toBe(43);expect(state.bag).toEqual(old.bag);expect(state.player.hp).toBe(72);
  await saveAndReload(page);state=(await read(page)).state;
  expect(state.schema_version).toBe(currentVersion);expect(state.physique.runDistance).toBe(0);expect(state.coins).toBe(43);
  await page.keyboard.press('Escape');await page.locator('#title').click();await page.locator('#new').click();await page.locator('#yes').click();
  await page.waitForFunction(()=>(window as any).__farwind().mode==='');
  expect((await read(page)).state.physique.runDistance).toBe(0);
  await expect(page.locator('.stamina')).toHaveAttribute('aria-valuemax','100');
});
test('JT-04',async({page})=>{
  await mkdir(root,{recursive:true});await page.goto('/');
  const sample=(await read(page)).state;sample.physique.runDistance=15999;
  await importSample(page,sample);
  // 只中止真实存储事务，不修改运行中的游戏状态或保存快照。
  await page.evaluate(()=>{
    const original=IDBDatabase.prototype.transaction;
    (window as any).__journeyRestoreStorage=()=>{IDBDatabase.prototype.transaction=original;};
    IDBDatabase.prototype.transaction=function(...args:any[]){
      const transaction=(original as any).apply(this,args) as IDBTransaction;
      if(this.name==='farwind-first-map'&&args[1]==='readwrite')queueMicrotask(()=>transaction.abort());
      return transaction;
    } as typeof original;
  });
  await page.keyboard.down('Space');await page.keyboard.down('d');
  await expect(page.locator('.stamina')).toHaveAttribute('aria-valuemax','101');
  await page.keyboard.up('d');await page.keyboard.up('Space');await page.keyboard.press('Escape');
  await expect(page.locator('#save-warning')).toBeVisible();
  const grown=(await read(page)).state.physique.runDistance;
  const disk=await page.evaluate(()=>new Promise<any>((resolve,reject)=>{
    const opened=indexedDB.open('farwind-first-map',1);opened.onerror=()=>reject(opened.error);
    opened.onsuccess=()=>{const db=opened.result,t=db.transaction('states','readonly'),r=t.objectStore('states').get('current');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);t.oncomplete=()=>db.close();};
  }));
  expect(disk.physique.runDistance).toBe(15999);expect(grown).toBeGreaterThanOrEqual(16000);
  const download=page.waitForEvent('download');await page.locator('#export').click();
  const backup=JSON.parse(await readFile((await (await download).path())!,'utf8'));expect(backup.physique.runDistance).toBe(grown);
  await page.evaluate(()=>(window as any).__journeyRestoreStorage());await page.locator('#save').click();
  await expect(page.locator('#save-warning')).toBeHidden();
  await page.reload();await page.locator('#continue').click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');
  expect((await read(page)).state.physique.runDistance).toBe(grown);await expect(page.locator('.stamina')).toHaveAttribute('aria-valuemax','101');
  await writeFile(root+'/save-failure.json',JSON.stringify({说明:'正式生产构建的固定门槛样本：真实按键跨越门槛，故意中止真实IndexedDB写入事务；不修改游戏状态。',旧档里程单位:disk.physique.runDistance,内存成长里程单位:grown,失败反馈:true,失败时导出保留成长:true,解除故障后保存刷新保留:true},null,2));
});
test('JT-05',async({page})=>{
  await mkdir(root,{recursive:true});await page.goto('/');
  // 固定低生命存档，等待正式敌人攻击；不调用死亡或复活内部函数。
  const sample=(await read(page)).state;sample.physique.runDistance=5000*32;
  Object.assign(sample.player,{x:1080,y:2100,hp:1,stamina:100});
  await importSample(page,sample);
  // 当前遭遇禁止在玩家眼前突然出生；先确认已有的芦边巡游，再真实步行进入其警戒范围。
  await page.waitForFunction(()=>(window as any).__farwind().skillGrowth.enemies.some((e:any)=>e.id==='wild-margin-slime'));
  await page.keyboard.down('a');
  try{await page.waitForFunction(()=>{const p=(window as any).__farwind().state.player;return p.x<=640||p.hp>1;});}
  finally{await page.keyboard.up('a');}
  await expect.poll(async()=>(await read(page)).state.player.hp,{timeout:25000}).toBe(104);
  const revived=await read(page);
  expect(revived.state.player.x).toBe(670);expect(revived.state.player.y).toBe(720);
  expect(revived.state.player.stamina).toBe(108);expect(revived.state.physique.runDistance).toBe(160000);
  await expect(page.locator('#toast')).toContainText('归风珠');
  await saveAndReload(page);expect((await read(page)).state.physique.runDistance).toBe(160000);
  await writeFile(root+'/respawn.json',JSON.stringify({说明:'正式生产构建的低生命成长存档样本，由真实敌人攻击触发死亡和归风珠复活；未调用内部死亡或复活函数。',复活生命:revived.state.player.hp,复活体力:revived.state.player.stamina,复活坐标:{横:revived.state.player.x,纵:revived.state.player.y},里程米:revived.state.physique.runDistance/32,刷新保留:true},null,2));
});
test('JT-06',async({page})=>{
  await page.goto('/');await page.locator('#new').click();
  await page.waitForFunction(()=>(window as any).__farwind().mode==='');
  await page.keyboard.down('Space');await page.keyboard.down('d');
  await expect.poll(async()=>(await read(page)).state.physique.runDistance).toBeGreaterThan(20);
  // 自动化浏览器强制页面焦点；这里只验证失焦事件处理，不能冒充真实切页验收。
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  await page.waitForFunction(()=>(window as any).__farwind().mode!=='',null,{polling:100});
  const before=await read(page);await page.waitForTimeout(700);const after=await read(page);
  expect(after.state.physique.runDistance).toBe(before.state.physique.runDistance);
  expect(after.state.player.x).toBe(before.state.player.x);
  await page.keyboard.up('d');await page.keyboard.up('Space');
  await writeFile(root+'/background.json',JSON.stringify({说明:'正式构建的失焦事件集成回归：只模拟浏览器失焦事件，不修改游戏状态；真实后台切页仍未验证。',里程不增加:true,角色不移动:true,暂停界面:after.mode},null,2));
});
test('JT-07',async({page})=>{
  await mkdir(root,{recursive:true});await page.goto('/');
  const sample=(await read(page)).state;sample.life.playerSpace='old-home';
  Object.assign(sample.player,{x:1002,y:910});await importSample(page,sample);
  await page.keyboard.down('Space');await page.keyboard.down('d');
  await page.waitForTimeout(400);expect((await read(page)).state.physique.runDistance).toBe(0);
  await page.keyboard.up('d');await page.keyboard.down('a');await page.waitForTimeout(500);
  await page.keyboard.up('a');await page.keyboard.up('Space');
  await page.waitForTimeout(200);
  const indoor=await read(page),atWall=indoor.state.physique.runDistance;
  expect(atWall).toBeGreaterThan(50);expect(atWall).toBeCloseTo(1002-indoor.state.player.x,5);
  const beforeReturn=(await read(page)).state.physique.runDistance;
  await page.keyboard.down('g');
  try{await page.waitForFunction(()=>(window as any).__farwind().state.life.playerSpace==='village',{},{timeout:15000});}
  finally{await page.keyboard.up('g');}
  expect((await read(page)).state.physique.runDistance).toBe(beforeReturn);
  await page.keyboard.down('j');await expect.poll(async()=>(await read(page)).skillGrowth.combatStage).toBeGreaterThan(0);
  const beforeAttack=(await read(page)).state.physique.runDistance;
  await page.keyboard.down('Space');await page.keyboard.down('d');await page.waitForTimeout(100);
  const attacking=await read(page);expect(attacking.skillGrowth.combatStage).toBeGreaterThan(0);
  expect(attacking.state.physique.runDistance).toBe(beforeAttack);
  await page.keyboard.up('Space');await page.keyboard.up('d');await page.keyboard.up('j');
  await writeFile(root+'/excluded-motion.json',JSON.stringify({说明:'正式构建固定室内新档样本，真实奔跑至房屋边墙、长按G归风和移动攻击。',室内真实奔跑世界单位:atWall,顶墙不增长:true,室内归风传送不增长:true,攻击位移不增长:true},null,2));
});
