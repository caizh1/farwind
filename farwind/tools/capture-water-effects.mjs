import { chromium } from "@playwright/test";
import sharp from "sharp";
import { mkdir, writeFile, access } from "node:fs/promises";
const phase = process.argv[2];
if (!["before", "after"].includes(phase)) throw Error("请选择 before / after");
const directory = `docs/water-effects/${phase}`;
try { await access(`${directory}/record.json`); throw Error("禁止覆盖既有证据"); } catch(e) { if(e.code!=="ENOENT") throw e; }
await mkdir(directory,{recursive:true});
const browser = await chromium.launch({args:["--enable-webgl","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
const records=[];
for(const [width,height,dpr] of [[1280,800,1],[1365,853,1.5]]) {
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr});
  const page=await context.newPage();const errors=[];
  page.on("dialog",d=>d.accept());page.on("pageerror",e=>errors.push(e.message));
  page.on("console",m=>{if(m.type()==="error"||/already exists/.test(m.text()))errors.push(m.text());});
  page.on("response",r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route(/\/src\/main\.ts(?:\?|$)/,async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('window.addEventListener("resize"','window.__waterGame = game;\nwindow.addEventListener("resize"')});});
  await page.goto(process.env.FARWIND_URL??"http://127.0.0.1:5191");
  await page.getByRole("button",{name:"启程 · 新游戏"}).click();
  await page.waitForFunction(()=>window.__farwind().mode==="");
  await page.waitForTimeout(500);
  const fixture=await page.evaluate(()=>window.__farwind().state);fixture.player.x=1090;fixture.player.y=1130;fixture.time=600;
  await page.keyboard.press("Escape");await page.getByRole("button",{name:"保存并返回标题"}).click();
  const chooser=page.waitForEvent("filechooser");await page.getByRole("button",{name:"导入存档"}).click();
  await (await chooser).setFiles({name:"water-location-fixture.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(fixture))});
  await page.waitForFunction(()=>window.__farwind().mode==="");await page.waitForTimeout(3000);
  const p=await page.evaluate(()=>window.__farwind().state.player);
  if(Math.hypot(p.x-1090,p.y-1130)>1)throw Error("水景截图站位不可用");
  const tag=`${width}x${height}-dpr${dpr}`;
  await page.screenshot({path:`${directory}/overview-${tag}.png`});
  await page.addStyleTag({content:"#hud,#toast,#day-night-overlay{visibility:hidden!important}"});
  const first=await page.screenshot({path:`${directory}/water-time-a-${tag}.png`});
  await page.waitForTimeout(2300);
  const second=await page.screenshot({path:`${directory}/water-time-b-${tag}.png`});
  const camera=await page.evaluate(()=>{const c=window.__waterGame.scene.getScene("World").cameras.main;return {左:c.worldView.x,上:c.worldView.y,缩放:c.zoom,画布宽:c.width};});
  const factor=width/1280*dpr;
  for(const [name,x,y,w,h] of [["fountain",610,750,145,150],["pond",1000,870,565,510]]) {
    const crop={left:Math.round((x-camera.左)*factor),top:Math.round((y-camera.上)*factor),width:Math.round(w*factor),height:Math.round(h*factor)};
    for(const [label,buffer] of [["a",first],["b",second]])await sharp(buffer).extract(crop).png().toFile(`${directory}/${name}-${label}-${tag}.png`);
  }
  await page.evaluate(()=>{window.__waterFrameTimes=[];window.__waterMeasureAt=performance.now();window.__waterMeasure=()=>{const now=performance.now();window.__waterFrameTimes.push(now-window.__waterMeasureAt);window.__waterMeasureAt=now;window.__waterRaf=requestAnimationFrame(window.__waterMeasure);};window.__waterRaf=requestAnimationFrame(window.__waterMeasure);});
  await page.waitForTimeout(6000);
  const performanceSample=await page.evaluate(()=>{cancelAnimationFrame(window.__waterRaf);const scene=window.__waterGame.scene.getScene("World"),samples=window.__waterFrameTimes;return {帧间隔:samples,对象:scene.children.length,纹理:scene.textures.getTextureKeys().length,水效:scene.waterEffects?.snapshot?.()??null};});
  records.push({视口:[width,height],像素密度:dpr,机位:p,相机:camera,页面错误:errors,性能:performanceSample,说明:"正式存档导入建立固定机位，真实运行截图未补画；局部仅裁切。水效分析临时隐藏HUD和既有昼夜覆盖，行为与录屏保留正常界面。"});
  await context.close();
}
await browser.close();await writeFile(`${directory}/record.json`,JSON.stringify(records,null,2));
console.log("水景截图与性能样本已保存");
