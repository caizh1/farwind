import {test,expect,type Page} from "@playwright/test";
import {readFile} from "node:fs/promises";
import {initialState,count,type State} from "../src/game/systems/state";
import {advanceNight} from "../src/game/systems/nightDirector";
const read=(p:Page)=>p.evaluate(()=>(window as any).__farwind());
async function fixture(p:Page,s:State){
  await p.goto("/");await p.waitForFunction(()=>typeof (window as any).__farwind==="function");p.once("dialog",d=>d.accept());
  const fc=p.waitForEvent("filechooser");await p.getByRole("button",{name:"导入存档",exact:true}).click();await(await fc).setFiles({name:"day-night-failure.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(s))});
  await p.waitForFunction(()=> (window as any).__farwind().mode==="");await p.waitForTimeout(300);
}
function planned(time:number,at:number){const s=initialState();s.time=2460;s.defense.protectionMs=s.defense.cooldownMs=0;advanceNight(s,2459);Object.assign(s.night.plan!,{outcome:"pending",gate:"east-gate",count:2,at});s.time=time;s.player.x=1330;s.player.y=1470;return s;}
async function failWarningWrite(p:Page){await p.addInitScript(()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...a:Parameters<IDBObjectStore["put"]>){if((a[0]as any).night?.plan?.outcome==="started"){IDBObjectStore.prototype.put=put;(window as any).__testWarningFailed=true;throw Error("测试预警写入失败");}return put.apply(this,a);};});}
async function pause(p:Page){await p.keyboard.press("Escape");await p.waitForFunction(()=> (window as any).__farwind().mode==="pause");}
test("预警写失败不出生，同页继续按原计划重试",async({page})=>{
 const s=planned(2700,2700.1);await failWarningWrite(page);await fixture(page,s);await page.waitForFunction(()=> (window as any).__testWarningFailed,undefined,{timeout:15000});
 const failed=(await read(page)).state;expect(failed.night.plan).toEqual(s.night.plan);expect(failed.defense.sequence).toBe(0);expect(failed.defense.raid).toBeNull();await expect(page.locator("#toast")).toContainText("测试预警写入失败");
 expect((await read(page)).mode).toBe("pause");await page.getByRole("button",{name:"保存并返回标题"}).click();await page.getByRole("button",{name:"继续旅途",exact:true}).click();
 await expect.poll(async()=>(await read(page)).state.night.plan.outcome,{timeout:40000}).toBe("started");const n=(await read(page)).state;
 expect(n.defense.sequence).toBe(1);expect(n.night.plan.raidSequence).toBe(1);for(const k of ["night","at","gate","count"]as const)expect(n.night.plan[k]).toBe(s.night.plan![k]);expect(n.defense.seed).toBe(s.defense.seed);
});
test("窗口末端预警写失败，午夜取消且不补刷",async({page})=>{
 const s=planned(2870,2870.1);await failWarningWrite(page);await fixture(page,s);await page.waitForFunction(()=> (window as any).__testWarningFailed,undefined,{timeout:15000});
 const frozen=await read(page);expect(frozen.mode).toBe("pause");await page.waitForTimeout(500);expect((await read(page)).state.time).toBe(frozen.state.time);await page.getByRole("button",{name:"继续旅途",exact:true}).click();
 await expect.poll(async()=>(await read(page)).state.night.plan.outcome,{timeout:15000}).toBe("cancelled");await page.waitForTimeout(5500);const n=(await read(page)).state;
 expect(n.defense.sequence).toBe(0);expect(n.defense.raid).toBeNull();expect(n.night.plan.at).toBe(s.night.plan!.at);expect(n.time).toBeGreaterThan(2880);
});
test("满包夜风不吞奖励，真实整理后领取且重载不能复领",async({page})=>{
 const s=initialState();s.time=1260;s.player.x=1330;s.player.y=1470;s.bag=Array.from({length:24},()=>({id:"ironSword" as const,count:1}));await fixture(page,s);
 await page.keyboard.press("e");await expect(page.locator("#toast")).toContainText("行囊已满");expect((await read(page)).state.night.discovered).toBe(false);expect(count((await read(page)).state,"potion")).toBe(0);
 await page.keyboard.press("Tab");await expect(page.locator("#modal")).toContainText("旅人的行囊");await page.locator('[data-slot="0"]').click();page.once("dialog",d=>d.accept());await page.locator("#discard").click();await page.locator("#close").click();
 await page.keyboard.press("e");await expect(page.locator("#dialog-title")).toHaveText("临水夜风");await page.getByRole("button",{name:"继续 · E"}).click();expect(count((await read(page)).state,"potion")).toBe(1);
 await pause(page);await page.getByRole("button",{name:"保存旅途",exact:true}).click();await expect(page.locator("#toast")).toContainText("已保存");await page.reload();await page.getByRole("button",{name:"继续旅途",exact:true}).click();await page.keyboard.press("e");await page.waitForTimeout(350);
 expect((await read(page)).state.night.discovered).toBe(true);expect(count((await read(page)).state,"potion")).toBe(1);
 await pause(page);const download=page.waitForEvent("download");await page.getByRole("button",{name:"导出备份",exact:true}).click();const raw=await readFile((await(await download).path())!,"utf8");expect(JSON.parse(raw).night.discovered).toBe(true);
 await fixture(page,JSON.parse(raw));await page.keyboard.press("e");await page.waitForTimeout(350);expect(count((await read(page)).state,"potion")).toBe(1);expect((await read(page)).state.night.discovered).toBe(true);
});
