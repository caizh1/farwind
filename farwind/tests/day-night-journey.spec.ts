import {test,expect,type Page} from "@playwright/test";
import {mkdir,writeFile,readFile} from "node:fs/promises";
import {move} from "./map-navigation";
import {approachNpc} from "./npc-navigation";
test.use({video:{mode:"on",size:{width:1280,height:720}}});
const read=(p:Page)=>p.evaluate(()=>(window as any).__farwind()),root="docs/day-night/evidence";
async function dismiss(p:Page){const s=await read(p);if(s.mode==="dialog")await p.getByRole("button",{name:"继续 · E"}).click();}
async function interact(p:Page,id:string){await expect.poll(async()=>(await read(p)).target).toBe(id);await p.keyboard.press("e");await p.waitForTimeout(100);}
test("同一新档完整昼夜旅程，保护期以正常游玩耗尽",async({page})=>{
 test.setTimeout(1500000);await mkdir(root,{recursive:true});const errors:string[]=[],steps:unknown[]=[];page.on("pageerror",e=>errors.push(e.message));
 const note=async(name:string)=>{const s=await read(page);steps.push({步骤:name,记录时间:new Date().toISOString(),累计分钟:s.state.time,有效毫秒:s.session.sim,金币:s.state.coins,任务:s.state.quest,夜风:s.state.night.discovered,计划:s.state.night.plan,保护:s.state.defense.protectionMs,守卫:s.state.defense.guards.map((g:any)=>({id:g.id,hp:g.hp,dead:g.dead})),位置:s.state.player});await writeFile(`${root}/complete-path-progress.json`,JSON.stringify({说明:"同档实际路径检查点，尚未结束时不计全程通过。",步骤:steps,存档快照:s.state},null,2));console.log(`同档路线：${name}`);};
 await page.goto("/?dayNightDebug=1");
 if(process.env.FARWIND_JOURNEY_CONTINUE){
  const prior=JSON.parse(await readFile(process.env.FARWIND_JOURNEY_CONTINUE,"utf8"));
  page.once("dialog",d=>d.accept());const file=page.waitForEvent("filechooser");await page.getByRole("button",{name:"导入存档",exact:true}).click();
  await(await file).setFiles({name:"actual-journey-continuation.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(prior.state))});
  await page.waitForFunction(()=> (window as any).__farwind().mode==="");
  expect((await read(page)).state.quest).toBeGreaterThanOrEqual(4);expect((await read(page)).state.night.discovered).toBe(true);await note("恢复前段真实同档，保存全部原值继续后半程");
 }else{
 await page.getByRole("button",{name:"启程 · 新游戏"}).click();await approachNpc(page,"elder");await interact(page,"elder");await dismiss(page);
 for(const [id,x,y]of [["herb-v1",1180,560],["berry-v1",350,1410]]as const){await move(page,x,y);await interact(page,id);}
 await move(page,975,1230);await interact(page,"service-general");await page.locator("#shop-item").selectOption("potion");await page.locator("#shop-review").click();await page.locator("#shop-confirm").click();await expect(page.locator("#shop-feedback")).toContainText("已完成");await page.locator("#close").click();
 await move(page,2170,1080);await dismiss(page);await page.keyboard.press("Tab");await expect(page.locator("#modal")).toContainText("旅人的行囊");await page.locator("#craft").click();await page.locator("#close").click();expect((await read(page)).state.quest).toBe(3);
 await move(page,2500,1080);
 for(let round=0;round<70;round++){await dismiss(page);const s=await read(page);if(s.state.quest>=4)break;const target=s.enemies.find((e:any)=>e.id==="leaf-1"&&e.hp>0)??s.enemies.find((e:any)=>e.hp>0);expect(target).toBeTruthy();const dx=target.x-s.state.player.x,dy=target.y-s.state.player.y,key=Math.abs(dx)>Math.abs(dy)?dx>0?"d":"a":dy>0?"s":"w";await page.keyboard.down(key);await page.waitForTimeout(Math.hypot(dx,dy)>70?180:25);await page.keyboard.up(key);await page.keyboard.press("j");await page.waitForTimeout(440);if(s.state.player.hp<60)await page.keyboard.press("1");}
 expect((await read(page)).state.quest).toBe(4);await note("白天采集、购买、制作与真实森林战斗");await move(page,1330,1470);
 await page.locator("#day-night-debug summary").click();await page.locator('[data-clock-minute="1020"]').click();await expect.poll(async()=>(await read(page)).state.night.plan?.outcome).toBe("quiet");await page.locator('[data-clock-minute="1140"]').click();await page.locator("#day-night-debug summary").click();await interact(page,"waterside-night");await expect(page.locator("#dialog-title")).toHaveText("临水夜风");await dismiss(page);await note("第一夜安静且夜风奖励已领取");
 await move(page,1685,1680);await interact(page,"service-inn");await page.locator('[data-flow="sleep"]').click();await page.locator("#shop-review").click();await page.locator("#shop-confirm").click();await expect(page.locator("#shop-feedback")).toContainText("已完成");await page.locator("#close").click();expect((await read(page)).state.night.plan.outcome).toBe("skipped");await note("旅馆住宿到清晨");
 }
 const restored=await read(page),completedRaid=restored.state.night.plan?.outcome==="started"&&restored.state.defense.completedSequence===restored.state.night.plan.raidSequence;
 if(!completedRaid){
 await move(page,670,720);
 // 日历跳时不减少保护期；剩余保护真实走完，不能直接写计时器或补战斗tick。
 for(let i=0;i<480&&((await read(page)).state.defense.protectionMs>0||(await read(page)).state.defense.cooldownMs>0);i++){for(const k of ["d","a"]){await page.keyboard.down(k);await page.waitForTimeout(1000);await page.keyboard.up(k);}if(i%30===0)console.log(`正常游玩剩余保护/冷却：${Math.ceil(((await read(page)).state.defense.protectionMs+(await read(page)).state.defense.cooldownMs)/1000)}秒`);}
 expect((await read(page)).state.defense.protectionMs).toBe(0);expect((await read(page)).state.defense.cooldownMs).toBe(0);await move(page,1330,1470);await page.locator("#day-night-debug summary").click();
 let current=await read(page);
 if(current.state.night.plan?.outcome!=="pending")for(let i=0;i<4;i++){await page.locator('[data-clock-minute="1020"]').click();await page.waitForTimeout(150);if((await read(page)).state.night.plan.outcome==="pending")break;}
 expect((await read(page)).state.night.plan.outcome).toBe("pending");current=await read(page);if(current.state.time%1440<1200)await page.locator('[data-clock-minute="1200"]').click();await page.locator("#day-night-debug summary").click();await note("后续夜间计划，正式时间窗口");
 await expect.poll(async()=>(await read(page)).state.night.plan.outcome,{timeout:165000}).toBe("started");await expect.poll(async()=>(await read(page)).state.defense.raid?.phase,{timeout:10000}).not.toBe("warning");await note("正式预警已持久化并进入战斗");
 const gate=(await read(page)).state.night.plan.gate,at=gate==="east-gate"?[1940,1080]:gate==="north-gate"?[820,400]:[900,1660];await move(page,at[0],at[1]);await page.keyboard.press("k");await page.waitForTimeout(350);await page.keyboard.press("j");await page.screenshot({path:`${root}/m5-journey-night-raid.png`});
 await expect.poll(async()=>(await read(page)).state.defense.raid,{timeout:65000}).toBeNull();await note("夜袭正常结算");const raid=(await read(page)).state.night.plan.raidSequence;
 await page.keyboard.press("Escape");await page.waitForFunction(()=> (window as any).__farwind().mode==="pause");await page.getByRole("button",{name:"保存旅途",exact:true}).click();await expect(page.locator("#toast")).toContainText("已保存");await page.reload();await page.getByRole("button",{name:"继续旅途",exact:true}).click();expect((await read(page)).state.night.plan.raidSequence).toBe(raid);expect((await read(page)).state.night.discovered).toBe(true);await note("同档保存与重载");
 }
 const raid=(await read(page)).state.night.plan.raidSequence;
 if((await read(page)).state.player.hp<70)await page.keyboard.press("1");if((await read(page)).state.player.hp<70)await page.keyboard.press("1");
 for(const [id,x,y]of [["wood-f1",2860,1140],["stone-f1",3000,1030]]as const){await move(page,x,y);await interact(page,id);}
 await note("实际采集路标修复材料");
 for(const [x,y]of [[3200,1100],[3370,920],[3450,920],[3450,680],[3510,590]])await move(page,x,y);await interact(page,"wind-0");for(const [x,y]of [[3730,500],[3760,450]])await move(page,x,y);await interact(page,"wind-1");await move(page,3950,510);await interact(page,"wind-2");await move(page,3740,730);await interact(page,"waymark");await dismiss(page);await move(page,3550,890);await interact(page,"shortcut");await approachNpc(page,"elder");await interact(page,"elder");await dismiss(page);expect((await read(page)).state.quest).toBe(7);expect((await read(page)).state.stones).toEqual([0,1,2]);await note("夜间顺序谜题、快捷传送与主线完成");
 const live=(await read(page)).enemies.find((e:any)=>e.id==="leaf-2"&&e.hp>0&&!e.disabled)??(await read(page)).enemies.find((e:any)=>e.hp>0&&!e.disabled);expect(live,"保留至少一个实际固定敌人用于死亡返回").toBeTruthy();await move(page,live.x,live.y+200);await page.waitForFunction(()=> (window as any).__farwind().state.player.x<1000,undefined,{timeout:65000});expect((await read(page)).state.quest).toBe(7);expect((await read(page)).state.night.discovered).toBe(true);await page.screenshot({path:`${root}/m5-journey-death-return.png`});await note("实际受击死亡后返回，主线与一次状态保留");
 await page.keyboard.press("Escape");await page.waitForFunction(()=> (window as any).__farwind().mode==="pause");await page.getByRole("button",{name:"保存并返回标题"}).click();await page.getByRole("button",{name:"继续旅途",exact:true}).click();expect((await read(page)).state.quest).toBe(7);expect((await read(page)).state.night.plan.raidSequence).toBe(raid);await note("返回标题并继续同一存档");expect(errors).toEqual([]);
 await writeFile(`${root}/complete-path.json`,JSON.stringify({说明:process.env.FARWIND_JOURNEY_CONTINUE?"从前段实际同档检查点原样正式导入继续，未改写字段；之前失败不计通过。后半程夜袭、谜题、死亡均走真实UI与正式逻辑。":"新游戏和真实键鼠；开发日历按钮缩短时段等待，未改写结果或有效保护时间。",分辨率:"1280×720",DPR:1,网址:page.url(),错误:errors,步骤:steps},null,2));
});
