import { test,expect } from "@playwright/test";
import { initialState } from "../src/game/systems/state";
import { mkdir } from "node:fs/promises";
const root=process.env.FARWIND_EVIDENCE_ROOT ?? "docs/village-defense/m2/production";
test("生产构建的服务、暂停、实际成交和重载",async({page})=>{
  await mkdir(root,{recursive:true});const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));page.on("dialog",d=>d.accept());
  await page.goto("/");const s=initialState();s.player.x=930;s.player.y=1220;
  const chooser=page.waitForEvent("filechooser");await page.getByRole("button",{name:"导入存档",exact:true}).click();
  await (await chooser).setFiles({name:"production-location.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(s))});
  await page.waitForFunction(()=>(window as any).__farwind().target==="service-general");await page.keyboard.press("e");
  await page.getByLabel("物品",{exact:true}).selectOption("potion");await page.getByRole("button",{name:"核对交易"}).click();await page.getByRole("button",{name:"确认购买"}).click();await expect(page.locator("#shop-feedback")).toContainText("交易已完成并保存");
  const before=await page.evaluate(()=>(window as any).__farwind());expect(before.state.coins).toBe(102);expect(before.layoutLabels).toBeUndefined();
  await page.screenshot({path:`${root}/shop.png`});await page.keyboard.press("Escape");await page.reload();await page.getByRole("button",{name:"继续旅途",exact:true}).click();
  const restored=await page.evaluate(()=>(window as any).__farwind().state);expect([restored.coins,restored.economyRevision,restored.map_version]).toEqual([102,1,6]);expect(restored.bag).toEqual(before.state.bag);expect(restored.shopStock).toEqual(before.state.shopStock);expect(errors).toEqual([]);
});
