import { chromium } from "@playwright/test";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
const directory="docs/water-effects/production";
await mkdir(directory,{recursive:true});
const browser=await chromium.launch({headless:false,args:["--use-angle=metal","--ignore-gpu-blocklist"]});
try {
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  page.on("dialog",d=>d.accept());page.on("pageerror",e=>errors.push(e.message));
  page.on("console",m=>{if(m.type()==="error"||/already exists/.test(m.text()))errors.push(m.text());});
  page.on("response",r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.goto("http://127.0.0.1:5223/");await page.bringToFront();
  await page.getByRole("button",{name:"启程 · 新游戏"}).click();await page.waitForTimeout(600);
  const fixture=await page.evaluate(()=>window.__farwind().state);
  fixture.player.x=1090;fixture.player.y=1130;fixture.time=600;
  await page.keyboard.press("Escape");
  const chooser=page.waitForEvent("filechooser");await page.getByRole("button",{name:"导入存档",exact:true}).click();
  await(await chooser).setFiles({name:"water-production-location.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(fixture))});
  await page.waitForFunction(()=>window.__farwind().mode==="");await page.waitForTimeout(2500);
  await page.screenshot({path:`${directory}/overview.png`});
  await page.addStyleTag({content:"#hud,#toast,#day-night-overlay{visibility:hidden!important}"});
  const a=await page.screenshot({path:`${directory}/time-a.png`});await page.waitForTimeout(2300);
  const b=await page.screenshot({path:`${directory}/time-b.png`});
  // 固定1280视口与正式站位，相机跟随偏移150；不注入开发用游戏实例或修改运行位置。
  const compare=async(x,y,w,h)=>{
    const rect={left:x-450,top:y-580,width:w,height:h};
    const aa=await sharp(a).extract(rect).removeAlpha().raw().toBuffer(),bb=await sharp(b).extract(rect).removeAlpha().raw().toBuffer();
    let changed=0;for(let i=0;i<aa.length;i+=3)if(Math.abs(aa[i]-bb[i])+Math.abs(aa[i+1]-bb[i+1])+Math.abs(aa[i+2]-bb[i+2])>6)changed++;
    return changed/(aa.length/3);
  };
  const result={说明:"直接运行最终生产构建，不注入游戏实例、不替换源码；正式菜单导入固定机位，局部截图临时隐藏HUD/昼夜覆盖，全景保留正常HUD。",喷泉变化比例:await compare(647,789,69,63),池塘变化比例:await compare(1240,1090,110,42),池沿变化比例:await compare(638,860,85,18),桥面变化比例:await compare(1045,920,75,130),错误:errors};
  await writeFile(`${directory}/result.json`,JSON.stringify(result,null,2));
  if(result.喷泉变化比例<=0.005||result.池塘变化比例<=0.008||result.池沿变化比例>0.003||result.桥面变化比例>0.003||errors.length)throw Error("生产构建水景局部变化或静态控制区域检查失败");
  console.log("生产构建真实局部水景检查通过");
} finally { await browser.close(); }
