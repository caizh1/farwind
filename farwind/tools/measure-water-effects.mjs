import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { cpus, platform, release } from "node:os";
const directory="docs/water-effects"; await mkdir(directory,{recursive:true});
// 同机原生Metal，交替顺序；其他项目任务并行运行，结果作为短测而非长期性能保证。
const browser=await chromium.launch({headless:false,args:["--use-angle=metal","--ignore-gpu-blocklist"]});
const rows=[];
for(const [width,height,dpr] of [[1280,800,1],[1365,853,1.5]]) for(const phase of ["before","after"]) {
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr}),page=await context.newPage(),errors=[];
  page.on("dialog",d=>d.accept());page.on("pageerror",e=>errors.push(e.message));
  await page.route(/\/src\/main\.ts(?:\?|$)/,async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('window.addEventListener("resize"','window.__waterGame=game;\nwindow.addEventListener("resize"')});});
  await page.goto(phase==="before" ? (process.env.FARWIND_BEFORE_URL ?? "http://127.0.0.1:5191") : (process.env.FARWIND_URL ?? "http://127.0.0.1:5221"));await page.bringToFront();
  await page.getByRole("button",{name:"启程 · 新游戏"}).click();await page.waitForTimeout(500);
  const s=await page.evaluate(()=>window.__farwind().state);s.player.x=1090;s.player.y=1130;s.time=600;
  await page.keyboard.press("Escape");const chooser=page.waitForEvent("filechooser");await page.getByRole("button",{name:"导入存档",exact:true}).click();
  await(await chooser).setFiles({name:"water-performance-fixture.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(s))});
  await page.waitForFunction(()=>window.__farwind().mode==="");await page.waitForTimeout(2500);
  const result=await page.evaluate(()=>new Promise(resolve=>{
    const scene=window.__waterGame.scene.getScene("World"),gl=scene.game.renderer.gl,ext=gl.getExtension("WEBGL_debug_renderer_info");
    const frames=[],updates=[];let previous=performance.now(),first=previous,start=0;
    const pre=()=>start=performance.now(),post=()=>updates.push(performance.now()-start);
    scene.events.on("preupdate",pre);scene.events.on("postupdate",post);
    const step=at=>{frames.push(at-previous);previous=at;if(at-first<20000)requestAnimationFrame(step);else{
      scene.events.off("preupdate",pre);scene.events.off("postupdate",post);
      const stats=a=>{a=a.slice(3).sort((x,y)=>x-y);return {样本:a.length,中位:a[Math.floor(a.length*.5)],百分之95:a[Math.floor(a.length*.95)],最大:a.at(-1)};};
      resolve({帧间隔毫秒:stats(frames),场景更新毫秒:stats(updates),对象:scene.children.length,纹理:scene.textures.getTextureKeys().length,
        渲染器:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),水效:scene.waterEffects?.snapshot?.()??null,页面隐藏:document.hidden});
    }};requestAnimationFrame(step);
  }));
  await page.screenshot({path:`${directory}/native-${phase}-${width}-dpr${dpr}.png`});
  rows.push({阶段:phase,视口:[width,height],像素密度:dpr,时长秒:20,结果:result,错误:errors});
  console.log(`已完成${phase} ${width}像素的原生水景短测`);await context.close();
}
await browser.close();await writeFile(`${directory}/performance-native-final.json`,JSON.stringify({说明:"相同原生Metal浏览器、相同正式存档导入站位、相同游戏视口与HUD，分别20秒。最终水效副本5221与工作区源码一致；其他任务并行运行，短测不代替长期性能保证。",处理器:cpus()[0].model,系统:`${platform()} ${release()}`,浏览器:browser.version(),记录:rows},null,2));
