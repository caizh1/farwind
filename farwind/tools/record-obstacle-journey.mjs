import { chromium } from "@playwright/test";
import { writeFile, mkdtemp } from "node:fs/promises";
const directory="docs/obstacle-fix/evidence";
const captureDirectory=await mkdtemp("/tmp/farwind-obstacle-video-");
// 独立浏览器上下文的新游戏；不导入存档、不赋值玩家/敌人状态。
const browser=await chromium.launch({headless:false,args:["--enable-webgl"]});
const context=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:captureDirectory,size:{width:1280,height:720}}});
const page=await context.newPage(),read=()=>page.evaluate(()=>window.__farwind());
page.on("pageerror",e=>{console.error("页面错误",e.message);});
await page.goto(`${process.env.FARWIND_URL ?? "http://127.0.0.1:5173"}/?obstacleDebug=1`);
await page.getByRole("button",{name:"启程 · 新游戏"}).click();
await page.waitForFunction(()=>window.__farwind()?.mode==="" && window.__farwind().session.sim>500);
const initial=await read();
await page.evaluate(()=>{
  window.__journeyTrace=[];
  window.__journeyTimer=setInterval(()=>{
    const s=window.__farwind();
    window.__journeyTrace.push({时间:s.session.sim,玩家:s.state.player,敌人:s.enemies,战斗:s.session.combat,猫:s.companion,训练:s.training,状态:s.mode});
  },16);
});
async function recover() {
  const s=await read();
  if(s.state.player.hp<65 && s.state.bag.some(v=>v?.id==="potion")) {
    await page.keyboard.press("1");await page.waitForTimeout(100);
  }
}
async function walk(x,y) {
  await recover();
  const obstruction=await page.evaluate(async({x,y})=>{
    const {motionLineBlocker}=await import("/src/game/systems/obstacles.ts");
    const p=window.__farwind().state.player,corner={x,y:p.y};
    return motionLineBlocker(p,corner) ?? motionLineBlocker(corner,{x,y});
  },{x,y});
  if(obstruction) throw Error(`步行路线被${obstruction}阻挡，目标(${x},${y})`);
  for(const [axis,target] of [["x",x],["y",y]]) {
    const current=(await read()).state.player[axis];
    if(Math.abs(target-current)<3) continue;
    const sign=Math.sign(target-current),key=axis==="x"?(sign>0?"d":"a"):sign>0?"s":"w";
    await page.keyboard.down(key);
    try {
      await page.waitForFunction(({axis,target,sign})=>sign*(window.__farwind().state.player[axis]-target)>-2,{axis,target,sign},{timeout:25000});
    } finally {await page.keyboard.up(key);}
  }
}
async function face(key,direction) {
  await page.keyboard.down(key);
  await page.waitForFunction(d=>window.__farwind().animation.hero.direction===d,direction);
  await page.keyboard.up(key);
}
async function combo() {
  await page.keyboard.press("j");await page.waitForTimeout(60);
  await page.keyboard.press("j");await page.waitForTimeout(400);
  await page.keyboard.press("j");await page.waitForTimeout(850);
}
try {
  // 正常广场训练与底座碰撞，训练不改变行囊或任务。
  await walk(850,720);await face("w",1);await combo();
  await page.screenshot({path:`${directory}/journey-training.png`});
  await walk(960,720);await walk(960,610);await walk(850,610);await face("s",0);await combo();
  await walk(960,610);await walk(960,720);
  // 正常领取村庄宝箱药剂，供战斗受伤时使用。
  await walk(850,720);await walk(850,940);await walk(470,940);await walk(470,1500);await walk(580,1500);
  await page.keyboard.press("e");await page.waitForTimeout(350);
  if(!(await read()).state.chests.includes("village-chest")) throw Error("未领取村庄宝箱");
  await walk(470,1500);await walk(470,940);await walk(850,940);await walk(850,720);
  await walk(1230,720);await walk(1600,720);await walk(1600,840);await walk(1870,840);await walk(2170,840);await walk(2170,1100);
  await walk(2700,1100);
  // 正常击杀其余三只敌人，避免最终树边演示被围攻；不改生命或位置。
  for(let attempt=0;attempt<55;attempt++) {
    await recover();
    const s=await read();
    const targets=s.enemies.filter(e=>e.id!=="leaf-2" && e.hp>0).sort((a,b)=>Math.hypot(a.x-s.state.player.x,a.y-s.state.player.y)-Math.hypot(b.x-s.state.player.x,b.y-s.state.player.y));
    if(!targets.length) break;
    const e=targets[0],dx=e.x-s.state.player.x,dy=e.y-s.state.player.y;
    if(Math.hypot(dx,dy)>85) {await page.waitForTimeout(200);continue;}
    await page.waitForFunction(()=>window.__farwind().session.combat.stage===0);
    await face(Math.abs(dx)>Math.abs(dy)?dx>0?"d":"a":dy>0?"s":"w",Math.abs(dx)>Math.abs(dy)?dx>0?3:2:dy>0?0:1);
    await page.keyboard.press("j");await page.waitForTimeout(390);
  }
  if((await read()).enemies.some(e=>e.id!=="leaf-2" && e.hp>0)) throw Error("正常击杀尚未完成");
  await walk(3030,1100);await walk(3030,1010);
  await page.waitForTimeout(1600);
  await page.screenshot({path:`${directory}/journey-tree-start.png`});
  await walk(3210,1010);await walk(3210,960);
  await face("a",2);await page.keyboard.press("j");await page.waitForTimeout(500);
  await page.screenshot({path:`${directory}/journey-edge-hit.png`});
  await page.keyboard.down("Space");await walk(3210,1020);await walk(3130,1020);await walk(3130,993);await page.keyboard.up("Space");
  await face("w",1);await page.keyboard.press("j");await page.waitForTimeout(550);
  await page.keyboard.down("Space");await walk(3060,993);await walk(3060,930);await walk(3130,930);await page.keyboard.up("Space");
  await face("s",0);await page.keyboard.press("j");await page.waitForTimeout(400);
  await page.waitForTimeout(1000);
  await page.screenshot({path:`${directory}/journey-detour.png`});
  // 从绕障后的合法站位实际打中叶灵；允许使用正常获得的药剂。
  for(let attempt=0;attempt<14;attempt++) {
    await recover();
    const s=await read(),e=s.enemies.find(e=>e.id==="leaf-2");
    if(!e || e.hp<72) break;
    if(s.state.player.hp<65 && s.state.bag.some(v=>v?.id==="potion")) {await page.keyboard.press("1");await page.waitForTimeout(100);}
    await page.waitForFunction(()=>window.__farwind().session.combat.stage===0);
    const current=await read(),target=current.enemies.find(e=>e.id==="leaf-2");
    const dx=target.x-current.state.player.x,dy=target.y-current.state.player.y;
    const key=Math.abs(dx)>Math.abs(dy)?dx>0?"d":"a":dy>0?"s":"w";
    await face(key,Math.abs(dx)>Math.abs(dy)?dx>0?3:2:dy>0?0:1);
    await page.keyboard.press("j");await page.waitForTimeout(400);
  }
  const final=await read();
  if(final.enemies.find(e=>e.id==="leaf-2")?.hp===72) throw Error("最终叶灵尚未实际命中");
  if(final.state.player.x<3000) throw Error("树边演示期间已回村，需保留失败证据");
  await page.screenshot({path:`${directory}/journey-confirmed-hit.png`});
  await page.waitForTimeout(600);
} catch(e) {
  process.exitCode=1;
  await page.screenshot({path:`${directory}/journey-interruption.png`});
  console.error("录制中断",e.message);
} finally {
  const trace=await page.evaluate(()=>{clearInterval(window.__journeyTimer);return window.__journeyTrace;});
  await writeFile(`${directory}/normal-journey.json`,JSON.stringify({说明:"正常新游戏，本机可见Chromium，正常速度真实键盘；未导入存档或修改玩家/敌人坐标、生命、碰撞、时间倍率。",初始:{玩家:initial.state.player,敌人:initial.enemies},轨迹:trace},null,2));
  const video=page.video();await page.close();await video.saveAs(`${directory}/normal-journey.webm`);await browser.close();
}
