import {approachNpc} from "./npc-navigation";
import {test,expect,chromium,type Page} from "@playwright/test";
import {mkdir,writeFile,readFile} from "node:fs/promises";
import {initialState,type State} from "../src/game/systems/state";
import {advanceNight,nightWarningSnapshot} from "../src/game/systems/nightDirector";
import {move} from "./map-navigation";
const root="docs/day-night/evidence",read=(p:Page)=>p.evaluate(()=>(window as any).__farwind());
async function shot(p:Page,name:string){
  await p.waitForTimeout(350);await mkdir(root,{recursive:true});await p.screenshot({path:`${root}/${name}.png`});
  const s=await read(p),metadata={文件:`${name}.png`,记录时间:new Date().toISOString(),累计分钟:s.state.time,地点:{x:s.state.player.x,y:s.state.player.y,空间:s.state.life.playerSpace},分辨率:p.viewportSize(),DPR:await p.evaluate(()=>devicePixelRatio),批次:name.slice(0,2).toUpperCase(),调试条件:p.url(),说明:"真实运行截图；状态通过隔离导入或实际键鼠操作准备，未修图。版本参见所在副本源码摘要。"};
  let rows:Record<string,unknown>={};try{rows=JSON.parse(await readFile(`${root}/screenshots.json`,"utf8"));}catch{}rows[name]=metadata;await writeFile(`${root}/screenshots.json`,JSON.stringify(rows,null,2));
}
async function fixture(p:Page,s:State){
  await p.goto("/");await p.waitForFunction(()=>typeof (window as any).__farwind==="function");p.once("dialog",d=>d.accept());
  const fc=p.waitForEvent("filechooser");await p.getByRole("button",{name:"导入存档",exact:true}).click();await(await fc).setFiles({name:"day-night-fixture.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(s))});
  await p.waitForFunction(({x,y})=>(window as any).__farwind().mode===""&&Math.abs((window as any).__farwind().state.player.x-x)<5&&Math.abs((window as any).__farwind().state.player.y-y)<5,s.player);await p.waitForTimeout(300);
}
async function pause(p:Page){await p.keyboard.press("Escape");await p.waitForFunction(()=>(window as any).__farwind().mode==="pause");}
async function resume(p:Page){await p.keyboard.press("Escape");await p.waitForFunction(()=>(window as any).__farwind().mode==="");}
async function sleepUI(p:Page){await p.keyboard.press("e");await expect(p.getByRole("heading",{name:"归风旅馆"})).toBeVisible();await p.locator('[data-flow="sleep"]').click();await p.locator("#shop-review").click();}
test("四阶段及夜间森林遗迹，HUD不被覆盖",async({page})=>{
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  for(const [name,time,x,y]of [["day",720,670,720],["dusk",1080,670,720],["night",1260,670,720],["dawn",390,670,720],["forest",1260,2650,1180],["ruins",1260,3720,780]] as const){
    const s=initialState();s.time=time;s.player.x=x;s.player.y=y;await fixture(page,s);await shot(page,`m2-fixed-${name}`);
    const layers=await page.evaluate(()=>({hud:getComputedStyle(document.querySelector("#ui")!).zIndex,shade:getComputedStyle(document.querySelector("#day-night-overlay")!).zIndex}));expect(Number(layers.hud)).toBeGreaterThan(Number(layers.shade));
    if(name==="night"){await pause(page);await shot(page,"m2-night-menu");await resume(page);}
  }expect(errors).toEqual([]);
});
test("真实键鼠探索链：白天准备、第一夜发现、旅馆住宿、标题继续",async({page})=>{
  console.log("路线：新游戏与长者任务");
  await page.goto("/?dayNightDebug=1");await page.getByRole("button",{name:"启程 · 新游戏"}).click();await expect(page.locator("#hud")).toBeVisible();
  await approachNpc(page,"elder");await page.keyboard.press("e");await expect(page.locator("#dialog-title")).toContainText("岚爷爷");await page.getByRole("button",{name:"继续 · E"}).click();
  console.log("路线：采集");await move(page,1180,560);await page.keyboard.press("e");await expect.poll(async()=>(await read(page)).state.collected["herb-v1"]).toBeDefined();
  await move(page,975,1230);await page.keyboard.press("e");await expect(page.locator("#modal")).toContainText("风铃杂货铺");await page.locator("#shop-item").selectOption("potion");await page.locator("#shop-review").click();await page.locator("#shop-confirm").click();await expect(page.locator("#shop-feedback")).toContainText("已完成");await page.locator("#close").click();
  console.log("路线：练习与黄昏");await move(page,820,790);await page.keyboard.press("j");await page.waitForTimeout(800);
  await page.locator("#day-night-debug summary").click();await page.locator('[data-clock-minute="1020"]').click();await expect.poll(async()=>(await read(page)).state.night.plan?.outcome).toBe("quiet");await page.locator('[data-clock-minute="1140"]').click();await expect(page.locator("#clock")).toContainText("夜晚");await page.locator("#day-night-debug summary").click();
  console.log("路线：第一夜探索");await move(page,1330,1470);await expect.poll(async()=>(await read(page)).target).toBe("waterside-night");await shot(page,"m3-discovery-before");await page.keyboard.press("e");await expect(page.locator("#dialog-title")).toHaveText("临水夜风");await shot(page,"m3-discovery-reward");expect((await read(page)).state.night.discovered).toBe(true);await page.getByRole("button",{name:"继续 · E"}).click();
  console.log("路线：旅馆与继续游戏");await move(page,1685,1680);await sleepUI(page);await shot(page,"m4-inn-before");await page.locator("#shop-confirm").click();await expect(page.locator("#shop-feedback")).toContainText("已完成");await page.locator("#close").click();await expect(page.locator("#clock")).toContainText("黎明");await shot(page,"m4-inn-after");
  const slept=(await read(page)).state;expect(slept.night.plan.outcome).toBe("skipped");await pause(page);await page.getByRole("button",{name:"保存并返回标题"}).click();await expect(page.getByRole("button",{name:"启程 · 新游戏"})).toBeVisible();await page.getByRole("button",{name:"继续旅途",exact:true}).click();expect((await read(page)).state.night.discovered).toBe(true);await shot(page,"m4-continue-dawn");
});
test("住宿保存失败、双击与重载的金币时间守恒",async({page})=>{
  const s=initialState();s.time=1260;s.player.x=1685;s.player.y=1680;await fixture(page,s);await sleepUI(page);const before=(await read(page)).state;
  await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args:Parameters<IDBObjectStore["put"]>){IDBObjectStore.prototype.put=original;throw Error("测试写入故障：保留原档");};});
  await page.locator("#shop-confirm").click();await expect(page.locator("#shop-feedback")).toContainText("未完成");expect((await read(page)).state).toEqual(before);await shot(page,"m4-save-failed");
  await page.locator("#shop-review").click();await page.locator("#shop-confirm").dblclick();await expect(page.locator("#shop-feedback")).toContainText("已完成");expect((await read(page)).state.coins).toBe(before.coins-12);await page.reload();await page.getByRole("button",{name:"继续旅途",exact:true}).click();expect((await read(page)).state.coins).toBe(before.coins-12);expect((await read(page)).state.time).toBeGreaterThanOrEqual(1800);
});
test("住宿不足与06点关闭，失败仍可退出",async({page})=>{
  for(const [name,time,coins]of [["poor",1260,0],["six",1800,120]] as const){const s=initialState();s.time=time;s.coins=coins;s.player.x=1685;s.player.y=1680;await fixture(page,s);await sleepUI(page);await page.locator("#shop-confirm").click();await expect(page.locator("#shop-feedback")).toContainText("未完成");await shot(page,`m4-${name}-failed`);await page.locator("#close").click();await expect(page.locator("#modal")).toBeHidden();}
});
test("住宿保留有效风步冷却，保存中快捷药剂不能覆盖探索提交",async({page})=>{
  const s=initialState();s.time=1260;s.player.x=1685;s.player.y=1680;s.dashCooldownRemaining=650;await fixture(page,s);await sleepUI(page);
  const cooldown=(await read(page)).session.combat.dashCooldownRemaining;await page.locator("#shop-confirm").click();await expect(page.locator("#shop-feedback")).toContainText("已完成");expect((await read(page)).session.combat.dashCooldownRemaining).toBeCloseTo(cooldown,0);await page.locator("#close").click();
  const n=initialState();n.time=1260;n.player={...n.player,x:1330,y:1470,hp:20};n.bag[0]={id:"potion",count:1};await fixture(page,n);
  await page.evaluate(()=>{const open=IDBFactory.prototype.open;IDBFactory.prototype.open=function(...a:Parameters<IDBFactory["open"]>){const req=open.apply(this,a),descriptor=Object.getOwnPropertyDescriptor(IDBRequest.prototype,"onsuccess")!;Object.defineProperty(req,"onsuccess",{set(fn){descriptor.set!.call(req,(event:Event)=>setTimeout(()=>fn.call(req,event),650));}});return req;};});
  await page.keyboard.press("e");await page.locator('[data-hotbar-slot="0"]').click();expect((await read(page)).state.player.hp).toBe(20);await expect.poll(async()=>(await read(page)).state.night.discovered).toBe(true);const result=(await read(page)).state;expect(result.player.hp).toBe(20);expect(result.bag[0].count).toBe(2);
});
test("正式夜袭保存后才出生，午夜及加载不重复",async({page})=>{
  let s=initialState();s.defense.protectionMs=s.defense.cooldownMs=0;
  for(let seed=1;seed<10000;seed++){s.defense.seed=seed;s.time=2460;s.night.plan=null;advanceNight(s,2459);if(s.night.plan?.outcome==="pending"&&s.night.plan.gate==="east-gate")break;}
  s.player.x=1550;s.player.y=1400;s.night.plan!.at=2879.8;s.time=2879.6;await fixture(page,s);
  await expect.poll(async()=>(await read(page)).state.night.plan?.outcome,{timeout:15000}).toBe("started");
  await page.waitForFunction(()=>(window as any).__farwind().defense.enemies.some((e:any)=>e.hp>0),null,{timeout:10000});
  // 出生后立即沿真实输入靠近，使战斗尚未结算时的敌人、守卫和道路进入镜头。
  await page.keyboard.down("d");await page.keyboard.down("w");await page.waitForTimeout(1600);await page.keyboard.up("d");await page.keyboard.up("w");
  expect((await read(page)).defense.enemies.some((e:any)=>e.hp>0)).toBe(true);await shot(page,"m3-east-night-live");
  await expect.poll(async()=>(await read(page)).state.time).toBeGreaterThan(2880);await expect(page.locator("#clock")).toContainText("第3日 00:");await shot(page,"m3-midnight");
  await move(page,1900,1080);await page.keyboard.press("k");await page.waitForTimeout(200);await page.keyboard.press("j");await shot(page,"m3-east-night-battle");const started=await read(page);expect(started.state.defense.sequence).toBe(1);expect(started.state.killed).toEqual(s.killed);await pause(page);await page.getByRole("button",{name:"保存旅途",exact:true}).click();await expect(page.locator("#toast")).toContainText("已保存");await page.reload();await page.getByRole("button",{name:"继续旅途",exact:true}).click();expect((await read(page)).state.night.plan.raidSequence).toBe(1);await shot(page,"m3-night-reload");
});
test("预警保存时松开方向不会续走",async({page})=>{
 const s=initialState();s.time=2460;s.defense.protectionMs=s.defense.cooldownMs=0;advanceNight(s,2459);s.night.plan!.outcome="pending";s.night.plan!.gate="east-gate";s.night.plan!.count=2;s.night.plan!.at=2879.8;s.time=2878;s.player.x=1330;s.player.y=1470;await fixture(page,s);
 await page.evaluate(()=>{const open=IDBFactory.prototype.open;IDBFactory.prototype.open=function(...a:Parameters<IDBFactory["open"]>){const req=open.apply(this,a),descriptor=Object.getOwnPropertyDescriptor(IDBRequest.prototype,"onsuccess")!;(window as any).__testSaving=true;Object.defineProperty(req,"onsuccess",{set(fn){descriptor.set!.call(req,(event:Event)=>setTimeout(()=>fn.call(req,event),650));}});return req;};});
 await page.keyboard.down("d");await page.waitForFunction(()=>(window as any).__testSaving);await page.keyboard.up("d");await expect.poll(async()=>(await read(page)).state.night.plan.outcome).toBe("started");const x=(await read(page)).state.player.x;await page.waitForTimeout(350);expect((await read(page)).state.player.x).toBeCloseTo(x,1);
});
for(const [width,height,dpr] of [[1280,720,1],[1366,768,1.5],[1920,1080,2]])test(`适配${width}×${height} DPR${dpr}移动resize焦点`,async({baseURL})=>{
  const browser=await chromium.launch({headless:false,args:["--use-angle=metal","--ignore-gpu-blocklist"]});
  const c=await browser.newContext({baseURL,viewport:{width,height},deviceScaleFactor:dpr}),page=await c.newPage();const s=initialState();s.time=1260;try{await fixture(page,s);
  await page.keyboard.down("d");await page.waitForTimeout(500);await page.keyboard.up("d");await page.setViewportSize({width:width-180,height:height-90});await page.waitForTimeout(200);await page.setViewportSize({width,height});await page.waitForTimeout(200);
  const rects=await page.evaluate(()=>{const a=document.querySelector("#game canvas")!.getBoundingClientRect(),b=document.querySelector("#day-night-overlay")!.getBoundingClientRect();return [a.x-b.x,a.y-b.y,a.width-b.width,a.height-b.height];});for(const v of rects)expect(Math.abs(v)).toBeLessThan(1);
  await pause(page);await page.getByRole("button",{name:"设置",exact:true}).click();await page.locator("#night-visibility").press("End");await expect(page.locator("#night-visibility")).toHaveValue("100");await page.getByRole("button",{name:"返回",exact:true}).click();await resume(page);
  const focus=await c.newCDPSession(page);await focus.send("Emulation.setFocusEmulationEnabled",{enabled:false});const other=await c.newPage();await other.goto("about:blank");await other.bringToFront();await expect.poll(async()=>(await read(page)).mode).toBe("pause");const t=(await read(page)).state.time;await page.waitForTimeout(500);expect((await read(page)).state.time).toBe(t);await page.bringToFront();await resume(page);await shot(page,`m5-matrix-${width}-${dpr}`);}finally{await c.close();await browser.close();}
});
test("昼夜反复接管与标题继续，资源和环境音不增长",async({page})=>{
 await page.goto("/?dayNightDebug=1");await page.getByRole("button",{name:"启程 · 新游戏"}).click();await page.waitForTimeout(500);
 const resource=async()=>{const s=await read(page);return {对象:s.dayNight.objects,纹理:s.dayNight.textures,循环:s.dayNight.loops,覆盖层:await page.locator("#day-night-overlay").count()};};
 const before=await resource(),rows=[];const cdp=await page.context().newCDPSession(page);
 const listeners=async()=>{const r=await cdp.send("Runtime.evaluate",{expression:'JSON.stringify({窗口:Object.fromEntries(Object.entries(getEventListeners(window)).map(([k,v])=>[k,v.length])),文档:Object.fromEntries(Object.entries(getEventListeners(document)).map(([k,v])=>[k,v.length]))})',includeCommandLineAPI:true,returnByValue:true});return JSON.parse(r.result.value);};
 const priorListeners=await listeners(),listenerRows=[];
 for(let i=0;i<4;i++){await page.locator("#day-night-debug summary").click();for(const minute of [1020,1140,360,480]){await page.locator(`[data-clock-minute="${minute}"]`).click();await page.waitForTimeout(100);}await page.locator("#day-night-debug summary").click();await pause(page);await page.getByRole("button",{name:"保存并返回标题"}).click();await page.getByRole("button",{name:"继续旅途",exact:true}).click();await page.waitForTimeout(150);rows.push(await resource());listenerRows.push(await listeners());}
 for(const r of rows)expect(r).toEqual(before);for(const r of listenerRows.slice(1))expect(r).toEqual(listenerRows[0]);for(const name of ["blur","focus","keydown","keyup","resize","beforeunload"])expect(listenerRows[0].窗口[name]).toBe(priorListeners.窗口[name]);expect(listenerRows[0].文档).toEqual(priorListeners.文档);await pause(page);await page.waitForTimeout(1500);expect((await read(page)).dayNight.loopGains.every((v:number)=>v<.001)).toBe(true);
 await writeFile(`${root}/lifecycle.json`,JSON.stringify({说明:"四次开发日历跨昼夜及同页标题继续的资源检查；首轮Playwright懒加载指针监听后全量数量不再增长，游戏键盘/焦点/尺寸/文档监听始终一致。跳时不补战斗tick，不是正常速率长期性能。",开始:before,循环:rows,监听器:listenerRows},null,2));
});
