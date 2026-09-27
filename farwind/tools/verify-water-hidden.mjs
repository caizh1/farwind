import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
// 使用Playwright标准临时浏览器启动参数，launchServer不创建游戏上下文。
// 另以noDefaults连接其原生默认上下文，避免任何会话强制模拟焦点。
const browserServer=await chromium.launchServer({headless:false,args:["--remote-debugging-port=9237","--use-angle=metal","--window-size=1280,900"]});
let endpoint;
for(let i=0;i<40;i++){try{const r=await fetch("http://127.0.0.1:9237/json/version");endpoint=(await r.json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,100));}}
if(!endpoint)throw Error("测试浏览器调试端口未就绪");
const browser=await chromium.connectOverCDP(endpoint,{noDefaults:true,isLocal:true}),context=browser.contexts()[0],page=context.pages()[0]??await context.newPage();
try {
  await page.goto("http://127.0.0.1:5203/");await page.getByRole("button",{name:"启程 · 新游戏"}).click();await page.waitForTimeout(700);
  const read=()=>page.evaluate(()=>({隐藏:document.hidden,焦点:document.hasFocus(),模式:window.__farwind().mode,水效:window.__waterGame.scene.getScene("World").waterEffects.snapshot()}));
  const before=await read();const other=await context.newPage();await other.goto("about:blank");await other.bringToFront();await page.waitForTimeout(300);
  const hidden=await read();await page.waitForTimeout(1200);const still=await read();
  await page.bringToFront();const returned=await read();await page.getByRole("button",{name:"继续旅途"}).click();await page.waitForTimeout(250);const resumed=await read();
  const result={说明:"官方Chrome独立启动，Playwright以noDefaults连接默认上下文，完全不启用模拟焦点。通过真实同窗标签切换产生document.hidden，不伪造事件或属性。",开始:before,隐藏:hidden,隐藏一秒后:still,返回:returned,继续:resumed};
  await writeFile("docs/water-effects/video/visibility.json",JSON.stringify(result,null,2));
  if(!hidden.隐藏||still.水效.time!==hidden.水效.time||resumed.水效.time<=hidden.水效.time||resumed.水效.time-hidden.水效.time>350)throw Error("真实隐藏停止与恢复未通过");
  console.log("真实标签页隐藏停止与恢复已通过");
}finally{await browser.close();await browserServer.close();}
