import { chromium } from "@playwright/test";
import { mkdir, writeFile, copyFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
const directory="docs/water-effects/video",raw=".water-local/video";
await mkdir(directory,{recursive:true});await mkdir(raw,{recursive:true});
const browser=await chromium.launch({headless:false,args:["--use-angle=metal","--ignore-gpu-blocklist"]}),records=[];
for(const name of ["fountain","pond-bridges"]) {
  const context=await browser.newContext({viewport:{width:1280,height:800},recordVideo:{dir:raw,size:{width:1280,height:800}}});
  const videoStart=Date.now(),page=await context.newPage(),errors=[];
  page.on("dialog",d=>d.accept());page.on("pageerror",e=>errors.push(e.message));
  await page.route(/\/src\/main\.ts(?:\?|$)/,async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('window.addEventListener("resize"','window.__waterGame=game;\nwindow.addEventListener("resize"')});});
  await page.goto(process.env.FARWIND_URL ?? "http://127.0.0.1:5221");await page.bringToFront();
  await page.getByRole("button",{name:"启程 · 新游戏"}).click();await page.waitForTimeout(500);
  const s=await page.evaluate(()=>window.__farwind().state);s.time=600;s.player.x=name==="fountain"?680:1090;s.player.y=name==="fountain"?940:920;
  await page.keyboard.press("Escape");const chooser=page.waitForEvent("filechooser");await page.getByRole("button",{name:"导入存档",exact:true}).click();
  await(await chooser).setFiles({name:"water-video-location.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(s))});
  await page.waitForFunction(()=>window.__farwind().mode==="");await page.waitForTimeout(1800);
  const start=Date.now(),timeline=[];
  const record=async label=>timeline.push({内容:label,秒:(Date.now()-start)/1000,状态:await page.evaluate(()=>({玩家:window.__farwind().state.player,黑猫:window.__farwind().companion,水效:window.__waterGame.scene.getScene("World").waterEffects.snapshot()}))});
  await record("正常HUD与默认缩放");await page.waitForTimeout(3000);
  if(name==="fountain") {
    await page.evaluate(()=>window.__waterGame.scene.getScene("World").cameras.main.stopFollow().setZoom(2).centerOn(680,838));
    await record("游戏相机2倍近景，主体仍为原尺寸");await page.waitForTimeout(7000);
    await page.screenshot({path:`${directory}/fountain-close.png`});
  } else {
    const move=async(axis,target)=>{
      const current=await page.evaluate(axis=>window.__farwind().state.player[axis],axis),sign=Math.sign(target-current);
      const key=axis==="x"?(sign>0?"d":"a"):(sign>0?"s":"w");await page.keyboard.down(key);
      try{await page.waitForFunction(({axis,target,sign})=>sign*(window.__farwind().state.player[axis]-target)>-3,{axis,target,sign},{timeout:15000});}finally{await page.keyboard.up(key);}
    };
    await move("y",1435);await record("沿西桥由北向南真实行走");
    await move("x",1310);await move("y",1310);await record("通过南桥进入池面通道");await page.waitForTimeout(2500);
    await page.keyboard.press("j");await page.waitForTimeout(700);await record("水景附近实际挥剑");
    await move("y",1425);await record("离开南桥");
    await page.screenshot({path:`${directory}/pond-bridges.png`});
  }
  const duration=(Date.now()-start)/1000,video=page.video();await context.close();
  const source=await video.path();await copyFile(source,`${raw}/${name}-raw.webm`);
  // 只去除建档菜单和加载等待，不加图形、不改游戏像素、不插帧。
  const result=spawnSync("/opt/homebrew/bin/ffmpeg",["-hide_banner","-loglevel","error","-y","-ss",String((start-videoStart)/1000),"-i",source,"-t",String(duration),"-c:v","libx264","-pix_fmt","yuv420p","-crf","18","-movflags","+faststart",`${directory}/${name}.mp4`]);
  if(result.status!==0)throw Error(result.stderr.toString());
  records.push({录像:name,时长秒:duration,处理:"仅按实际录屏时间裁去加载与建档菜单，未绘制修饰画面；正常HUD保留。",过程:timeline,错误:errors});
}
await writeFile(`${directory}/record.json`,JSON.stringify(records,null,2));
await browser.close();
console.log("水景真实录屏完成；真实标签页隐藏由verify-water-hidden.mjs单独验证");
