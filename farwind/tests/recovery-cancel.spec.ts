import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const directory='docs/recovery-cancel/evidence';
async function read(page:Page){return page.evaluate(()=>{const s=(window as any).__farwind();return {时刻:s.session.sim,结束:s.session.attackUntil,战斗:s.session.combat,符文:s.state.runes.slots,生命:s.state.player.hp,体力:s.state.player.stamina,剑风事件:s.swordWind?.events,剑风实例:s.swordWind?.entities,模式:s.mode};});}
async function reset(page:Page,wind=false){
 await page.goto('/?runeLab=1');await page.getByRole('button',{name:'启程 · 新游戏',exact:true}).click();
 await page.locator('#rune-lab-build').selectOption('r09');await page.locator('#rune-lab-target').selectOption('dummy');
 await page.locator('#rune-lab-wind').setChecked(wind);await page.locator('#rune-lab-reset').click();
 await page.waitForFunction(()=>(window as any).__farwind().mode==='');await page.locator('#rune-lab-close').click();
 await page.waitForFunction(()=>(window as any).__farwind().session.combat.recoveryCancelEnabled);
}
async function stage(page:Page,n:number){
 await page.keyboard.press('j');await page.keyboard.press('j');
 for(let i=2;i<=n;i++){
  await page.waitForFunction(i=>(window as any).__farwind().session.combat.stage===i,i);
  if(i<n){
   // 第三击接剑风沿用最后150毫秒的攻击预约窗口。
   if(i===3){const s=await read(page),m=s.战斗.attackConfig;await until(page,s.结束-m.windup-m.active-m.recovery,365);}
   await page.keyboard.press('j');
  }
 }
 const s=await read(page),m=s.战斗.attackConfig;return s.结束-m.windup-m.active-m.recovery;
}
async function until(page:Page,start:number,age:number){await page.waitForFunction(({start,age})=>(window as any).__farwind().session.sim>=start+age,{start,age});}
async function evidence(page:Page,name:string,record:unknown){await mkdir(directory,{recursive:true});await page.screenshot({path:`${directory}/${name}.png`});await writeFile(`${directory}/${name}.json`,JSON.stringify({说明:'隔离初始条件来自可见符文试验场，攻击和装卸使用真实键鼠与正式入口；诊断只读。',记录:record},null,2));}

for(const mouse of [false,true])test(`轻羽第三击${mouse?'鼠标':'键盘'}招架在后摇开始发动`,async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await reset(page);
 const box=await page.locator('#game canvas').boundingBox();expect(box).not.toBeNull();
 if(mouse)await page.mouse.move(box!.x+1100,box!.y+420);
 const start=await stage(page,3);await until(page,start,155);
 if(mouse)await page.mouse.click(box!.x+1100,box!.y+420,{button:'right'});else await page.keyboard.press('k');
 await page.waitForFunction(()=>(window as any).__farwind().session.combat.actions.some((a:any)=>a.kind==='parry'&&a.executed!==undefined));
 const s=await read(page),action=s.战斗.actions.findLast((a:any)=>a.kind==='parry'&&a.executed!==undefined);
 expect(action.at-start).toBeGreaterThanOrEqual(125);expect(action.at-start).toBeLessThan(275);
 expect(action.executed-start).toBeCloseTo(275,4);expect(s.生命).toBe(100);expect(errors).toEqual([]);
 await evidence(page,mouse?'mouse-parry':'keyboard-parry',{第三击起手:start,实际招架:action,结算:s,页面错误:errors});
});

test('轻羽第三击风步及正式卸装恢复原取消点',async({page})=>{
 await reset(page);const start=await stage(page,3);await until(page,start,155);await page.keyboard.press('l');
 await page.waitForFunction(()=>(window as any).__farwind().session.combat.actions.some((a:any)=>a.kind==='dash'&&a.executed!==undefined));
 const improved=await read(page),dash=improved.战斗.actions.findLast((a:any)=>a.kind==='dash'&&a.executed!==undefined);
 expect(dash.executed-start).toBeCloseTo(275,4);expect(improved.体力).toBeGreaterThanOrEqual(84);expect(improved.体力).toBeLessThan(86);
 // 攻击木桩也会进入交战；先在世界运行时满足原有八秒脱战规则。
 await page.waitForFunction(()=>{const s=(window as any).__farwind();return s.session.combat.dashRemaining===0&&s.state.runes.peace===8000;});await page.keyboard.press('r');
 await page.locator('[data-rune-slot="0"]').click();await page.locator('#rune-remove').click();
 await page.waitForFunction(()=>(window as any).__farwind().state.runes.slots[0]===null);await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!(window as any).__farwind().session.combat.recoveryCancelEnabled);
 const base=await stage(page,3);await until(page,base,260);await page.keyboard.press('k');
 await page.waitForFunction(({base})=>(window as any).__farwind().session.combat.actions.some((a:any)=>a.kind==='parry'&&a.executed>=base),{base});
 const restored=await read(page),parry=restored.战斗.actions.findLast((a:any)=>a.kind==='parry'&&a.executed!==undefined);
 expect(parry.executed-base).toBeCloseTo(390,4);
 await evidence(page,'equip-remove',{轻羽风步:dash,原始招架:parry,增强结算:improved,卸装结算:restored});
});

test('轻羽保存读取与正式界面说明一致',async({page})=>{
 await reset(page);await page.keyboard.press('r');await page.locator('[data-rune-id="r09"]').click();
 await expect(page.locator('.rune-detail')).toContainText('立即取消剩余后摇');await evidence(page,'rune-description',await read(page));
 await page.keyboard.press('Escape');await page.keyboard.press('Escape');await page.locator('#save').click();
 await expect(page.locator('#toast')).toContainText('旅途已保存');
 await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();
 await page.waitForFunction(()=>(window as any).__farwind().session.combat.recoveryCancelEnabled);
 const s=await read(page);expect(s.符文[0]).toBe('r09');
 await evidence(page,'reload',s);
});

test('轻羽第四段风步取消保留已正式发射的剑风',async({page})=>{
 await reset(page,true);const start=await stage(page,4);await until(page,start,130);await page.keyboard.press('l');
 await page.waitForFunction(()=>(window as any).__farwind().session.combat.actions.some((a:any)=>a.kind==='dash'&&a.executed!==undefined));
 const s=await read(page),dash=s.战斗.actions.findLast((a:any)=>a.kind==='dash'&&a.executed!==undefined);
 expect(dash.executed-start).toBeCloseTo(210,4);
 // 诊断记录的是正式飞行实例及命中／结束事件，发射不是独立事件。
 expect(s.剑风实例).toHaveLength(1);expect(s.剑风实例[0].born-start).toBeCloseTo(110,4);
 const release=s.剑风实例[0].releaseId;await until(page,start,650);
 const after=await read(page);expect(after.剑风事件.filter((e:any)=>e.attackId===release)).toHaveLength(1);
 await evidence(page,'sword-wind',{剑风起手:start,风步:dash,取消时结算:s,飞行后结算:after});
});
