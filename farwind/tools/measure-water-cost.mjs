import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
const browser=await chromium.launch({args:["--enable-webgl","--use-angle=swiftshader","--enable-unsafe-swiftshader"]}),rows=[];
for(const [width,height,dpr] of [[1280,800,1],[1365,853,1.5]]) {
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr}),page=await context.newPage();page.on("dialog",d=>d.accept());
  await page.route(/\/src\/main\.ts(?:\?|$)/,async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace('window.addEventListener("resize"','window.__waterGame=game;\nwindow.addEventListener("resize"')});});
  await page.goto(process.env.FARWIND_URL ?? "http://127.0.0.1:5221");await page.getByRole("button",{name:"启程 · 新游戏"}).click();await page.waitForTimeout(500);
  const state=await page.evaluate(()=>window.__farwind().state);state.player.x=1090;state.player.y=1130;state.time=600;
  await page.keyboard.press("Escape");const chooser=page.waitForEvent("filechooser");await page.getByRole("button",{name:"导入存档",exact:true}).click();await(await chooser).setFiles({name:"water-cost-fixture.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(state))});await page.waitForTimeout(1200);
  for(const visible of [true,false,true]) {
    await page.evaluate(visible=>{const s=window.__waterGame.scene.getScene("World");for(const o of s.waterEffects.owned)o.cameraFilter=visible?0:s.cameras.main.id;},visible);
    const stats=await page.evaluate(()=>new Promise(resolve=>{const frames=[];let start=performance.now(),previous=start;const frame=t=>{frames.push(t-previous);previous=t;if(t-start<10000)requestAnimationFrame(frame);else{frames.sort((a,b)=>a-b);resolve({样本:frames.length,中位:frames[Math.floor(frames.length*.5)],百分之95:frames[Math.floor(frames.length*.95)]});}};requestAnimationFrame(frame);}));
    rows.push({视口:[width,height],像素密度:dpr,绘制水效:visible,帧间隔毫秒:stats});console.log(`已测量${width}像素，水效显示${visible}`);
  }
  await context.close();
}
await browser.close();await writeFile("docs/water-effects/performance-software-final.json",JSON.stringify({说明:"最终5221水效，同一站位和同一上下文，显示→仅相机忽略水效拥有对象→恢复显示，各10秒。仅诊断绘制开销，关闭阶段桥与荷叶也暂时不绘制；产品代码与碰撞未改变。软件渲染及并行任务环境，不代表实际GPU帧率。",记录:rows},null,2));
