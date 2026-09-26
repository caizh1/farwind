import {test,expect,type Page}from"@playwright/test";
import{mkdir,writeFile}from"node:fs/promises";
import{initialState}from"../src/game/systems/state";
import{prepareEastRaid}from"../src/game/systems/defense";
import{move}from"./map-navigation";
const root=process.env.FARWIND_EVIDENCE_ROOT ?? "docs/village-defense/m3/evidence";
const read=(p:Page)=>p.evaluate(()=>(window as any).__farwind());
async function fixture(page:Page,s:any){
  page.once("dialog",d=>d.accept());const chooser=page.waitForEvent("filechooser");
  await page.getByRole("button",{name:"导入存档",exact:true}).click();
  await(await chooser).setFiles({name:"east-defense-fixture.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(s))});
  await page.waitForFunction(()=>(window as any).__farwind().mode==="");
}
async function saved(page:Page){await expect.poll(async()=>{const s=await read(page);return !s.defenseCheckpointPending&&!s.defense.critical}).toBe(true);}
test("新游戏实走东门演练，真实放箭、自主击退和离屏持续按键不受停顿",async({page})=>{
  await mkdir(root,{recursive:true});const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto('/?defenseDebug=1');await page.getByRole('button',{name:'启程 · 新游戏'}).click();
  await move(page,1960,1230);await expect.poll(async()=>(await read(page)).target).toBe('east-gate-sign');
  await page.keyboard.press('e');await page.getByRole('button',{name:'启动东门演练 · 3只普通怪'}).click();
  await expect.poll(async()=>(await read(page)).state.defense.sequence).toBe(1);
  const before=(await read(page)).state;
  await page.waitForFunction(()=>(window as any).__farwind().defense.arrows.length>0);
  let s=await read(page);expect(s.defense.arrows[0].travelled).toBeGreaterThan(0);
  expect(s.session.combat.hitStopRemaining).toBe(0);await page.screenshot({path:`${root}/arrow-flight.png`});
  // 全程保持真实左行输入，远处死亡的自动保存不能清空按键或引入命中停顿。
  await page.keyboard.down('a');let observations:any[]=[];
  try{
    const deadline=Date.now()+10000;
    while(Date.now()<deadline){s=await read(page);observations.push({sim:s.session.sim,x:s.state.player.x,raid:s.state.defense.raid?.members.map((m:any)=>m.hp),hitStop:s.session.combat.hitStopRemaining});
      if(s.state.player.x<1780)break;await page.waitForTimeout(100);}
  }finally{await page.keyboard.up('a');}
  expect(s.state.player.x).toBeLessThan(1780);
  await move(page,930,1220);
  await expect.poll(async()=>(await read(page)).state.defense.raid,{timeout:45000}).toBeNull();await saved(page);
  s=await read(page);expect(s.state.defense.guards.every((g:any)=>!g.dead&&g.hp>0)).toBe(true);
  expect(s.defense.history.some((e:any)=>e.kind==='shot')).toBe(true);
  expect([s.state.quest,s.state.killed,s.state.coins,s.state.bag]).toEqual([before.quest,before.killed,before.coins,before.bag]);
  expect(s.state.player.hp).toBe(100);expect(observations.every(o=>o.hitStop===0)).toBe(true);
  await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();
  const restored=await read(page);expect(restored.state.defense.completedSequence).toBe(1);expect(restored.state.defense.raid).toBeNull();
  await writeFile(`${root}/autonomous.json`,JSON.stringify({说明:'新游戏正式步行和开发演练按钮启动，未直接修改运行状态。',过程:observations,完成:s.state.defense,重载:restored.state.defense,页面错误:errors},null,2));expect(errors).toEqual([]);
});
test("受控低血守卫被实际怪物致死，关键保存与重载不复活",async({page})=>{
  await mkdir(root,{recursive:true});await page.goto('/');const s=initialState();s.player.x=930;s.player.y=1220;
  s.defense=prepareEastRaid(s.defense,s.player);s.defense.guards[0].hp=1;
  // 合法历史夹具建立低血与位置，致死仍由正式怪物AI接触产生。
  s.defense.raid!.members[0].x=2018;s.defense.raid!.members[0].y=977;
  await fixture(page,s);
  await expect.poll(async()=>(await read(page)).state.defense.guards[0].dead,{timeout:20000}).toBe(true);
  await saved(page);const death=await read(page);
  expect(death.state.defense.guards[0].hp).toBe(0);
  expect(death.defense.history.filter((e:any)=>e.kind==='death'&&e.id==='east-watch')).toHaveLength(1);
  await page.screenshot({path:`${root}/guard-death.png`});await page.reload();
  await page.getByRole('button',{name:'继续旅途',exact:true}).click();
  expect((await read(page)).state.defense.guards[0]).toMatchObject({hp:0,dead:true,mode:'dead'});
  await page.waitForTimeout(8500);expect((await read(page)).state.defense.guards[0].hp).toBe(0);
  await writeFile(`${root}/death.json`,JSON.stringify({说明:'低血存档只建立前提；正式史莱姆接触造成一次死亡。',致死:death.state.defense,重载:(await read(page)).state.defense},null,2));
});
test("活跃波次保存重载、商店与失焦全体暂停，射手死亡塔停火",async({page})=>{
  await mkdir(root,{recursive:true});await page.goto('/');const s=initialState();s.player.x=930;s.player.y=1220;
  s.defense=prepareEastRaid(s.defense,s.player);
  await fixture(page,s);await page.keyboard.press('e');await expect.poll(async()=>(await read(page)).mode).toBe('shop');
  const paused=await read(page);await page.waitForTimeout(700);
  expect((await read(page)).state.defense).toEqual(paused.state.defense);
  await page.keyboard.press('Escape');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  const blurred=await read(page);await page.waitForTimeout(600);expect((await read(page)).state.defense).toEqual(blurred.state.defense);
  await page.getByRole('button',{name:'保存旅途',exact:true}).click();await expect(page.locator('#toast')).toContainText('已保存');
  const savedState=(await read(page)).state;await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();
  let next=await read(page);expect(next.state.defense.sequence).toBe(1);expect(next.defense.arrows).toEqual([]);
  expect(next.state.defense.guards.map((g:any)=>g.hp)).toEqual(savedState.defense.guards.map((g:any)=>g.hp));
  await page.keyboard.press('Escape');const dead=initialState();dead.player.x=930;dead.player.y=1220;
  dead.defense=prepareEastRaid(dead.defense,dead.player);Object.assign(dead.defense.guards[2],{hp:0,dead:true,mode:'dead'});
  await fixture(page,dead);await page.waitForTimeout(7000);next=await read(page);
  expect(next.defense.history.filter((e:any)=>e.kind==='shot')).toEqual([]);expect(next.defense.arrows).toEqual([]);
  await page.screenshot({path:`${root}/tower-disabled.png`});
});
test("正常模式不显示开发演练，玩家攻击不会伤守卫，主角黑猫通过门口",async({page})=>{
  await mkdir(root,{recursive:true});await page.goto('/');await page.getByRole('button',{name:'启程 · 新游戏'}).click();
  await move(page,2010,1060);const before=(await read(page)).state.defense.guards.map((g:any)=>g.hp);
  await page.keyboard.down('w');await page.waitForTimeout(30);await page.keyboard.up('w');await page.keyboard.press('j');await page.waitForTimeout(350);
  expect((await read(page)).state.defense.guards.map((g:any)=>g.hp)).toEqual(before);
  await move(page,1960,1230);await page.keyboard.press('e');
  await expect(page.getByRole('heading',{name:'东门驻防',exact:true})).toBeVisible();
  await expect(page.locator('#defense-drill')).toHaveCount(0);await page.getByRole('button',{name:'继续 · E',exact:true}).click();
  await move(page,2200,1080);await move(page,1940,1080);const end=await read(page);
  expect(end.companion.blocked).toBe(false);expect(end.layoutLabels).toBe(0);
  await page.screenshot({path:`${root}/gate-passage.png`});
});
