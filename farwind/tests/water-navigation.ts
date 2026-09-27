import { expect, type Page } from "@playwright/test";
export const readWater = (page: Page) => page.evaluate(() => {
  const s = (window as any).__waterGame.scene.getScene("World");
  const f = s.propImages.get("plaza-fountain");
  return { water: s.waterEffects.snapshot(), objects: s.children.length, textures: s.textures.getTextureKeys().length,
    gpu: { buffers: s.game.renderer.glBufferWrappers.length, vaos: s.game.renderer.glVAOWrappers.length, programs: s.game.renderer.glProgramWrappers.length },
    bridges: s.children.list.filter((o: any) => o.texture?.key==="bridge").map((o: any) => ({x:o.x,y:o.y,width:o.displayWidth,height:o.displayHeight,rotation:o.rotation,depth:o.depth})),
    mode: s.ui.mode, state: (window as any).__farwind().state, camera: { x: s.cameras.main.worldView.x, y: s.cameras.main.worldView.y, zoom: s.cameras.main.zoom },
    stone: { x:f.x,y:f.y,w:f.displayWidth,h:f.displayHeight,depth:f.depth,alpha:f.alpha,rotation:f.rotation }, hitstop:s.combat.hitStopRemaining };
});
export async function startWater(page: Page, point = { x:1090,y:1130 }) {
  const errors: string[] = [];
  page.on("dialog", d=>d.accept()); page.on("pageerror", e=>errors.push(e.message));
  page.on("console", m=>{if(m.type()==="error" || /already exists/.test(m.text()))errors.push(m.text());});
  page.on("response", r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route(/\/src\/main\.ts(?:\?|$)/, async route=>{
    const response=await route.fetch(), body=await response.text();
    expect(body).toContain('window.addEventListener("resize"');
    await route.fulfill({response,body:body.replace('window.addEventListener("resize"','window.__waterGame = game;\nwindow.addEventListener("resize"')});
  });
  await page.goto("/"); await page.getByRole("button",{name:"启程 · 新游戏"}).click();
  await page.waitForFunction(()=>(window as any).__farwind().mode===""); await page.waitForTimeout(500);
  const fixture=await page.evaluate(()=>(window as any).__farwind().state);
  Object.assign(fixture.player,point);fixture.time=600;
  await page.keyboard.press("Escape"); await page.getByRole("button",{name:"保存并返回标题"}).click();
  const chooser=page.waitForEvent("filechooser"); await page.getByRole("button",{name:"导入存档"}).click();
  await (await chooser).setFiles({name:"water-location-fixture.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(fixture))});
  await page.waitForFunction(()=>(window as any).__farwind().mode===""); await page.waitForTimeout(1800);
  const p=(await readWater(page)).state.player; expect(Math.hypot(p.x-point.x,p.y-point.y)).toBeLessThan(1);
  return errors;
}
