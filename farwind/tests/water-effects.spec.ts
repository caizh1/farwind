import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { startWater, readWater } from "./water-navigation";
import { move } from "./map-navigation";
const directory=process.env.FARWIND_WATER_EVIDENCE_DIR ?? "docs/water-effects/behavior";
test.beforeAll(async()=>{await mkdir(directory,{recursive:true});});

async function difference(a: Buffer,b: Buffer,rect:{left:number;top:number;width:number;height:number}) {
  const aa=await sharp(a).extract(rect).removeAlpha().raw().toBuffer(),bb=await sharp(b).extract(rect).removeAlpha().raw().toBuffer();
  let changed=0,total=0;
  for(let i=0;i<aa.length;i+=3){const d=Math.abs(aa[i]-bb[i])+Math.abs(aa[i+1]-bb[i+1])+Math.abs(aa[i+2]-bb[i+2]);if(d>6)changed++;total+=d;}
  return {变化像素比例:changed/(aa.length/3),平均通道差:total/aa.length};
}

test("water-motion-local",async({page})=>{
  const errors=await startWater(page);
  await page.evaluate(()=>{(window as any).__waterGame.scene.getScene("World").cameras.main.stopFollow();});
  await page.addStyleTag({content:"#hud,#toast,#day-night-overlay{visibility:hidden!important}"});
  const state=await readWater(page); const camera=state.camera;
  const rect=(x:number,y:number,width:number,height:number)=>({left:Math.round(x-camera.x),top:Math.round(y-camera.y),width,height});
  const a=await page.screenshot({path:`${directory}/time-a.png`});await page.waitForTimeout(2300);
  const b=await page.screenshot({path:`${directory}/time-b.png`});
  const results={喷泉流水:await difference(a,b,rect(647,789,69,63)),池塘中心:await difference(a,b,rect(1240,1090,110,42)),
    池水上部:await difference(a,b,rect(1190,1015,150,70)),池水下部:await difference(a,b,rect(1200,1230,140,40)),
    // 只取不透明木板。旧桥PNG的板缝透明，透过缝隙看到动态水面是正确遮挡。
    前池沿:await difference(a,b,rect(638,860,85,18)),空桥面:await difference(a,b,rect(1045,940,75,20)),池外草地:await difference(a,b,rect(1475,940,35,25)),
    固定岸内水带:await difference(a,b,rect(1532,1110,4,20))};
  expect(results.喷泉流水.变化像素比例).toBeGreaterThan(0.005);
  for(const r of [results.池塘中心,results.池水上部,results.池水下部]) {
    expect(r.变化像素比例).toBeGreaterThan(0.25);
    expect(r.平均通道差).toBeGreaterThan(2);
  }
  // 少量像素变化不足以证明默认视口可读；水面变化强度也必须达到最低门槛。
  expect(results.喷泉流水.平均通道差).toBeGreaterThan(0.75);
  for(const r of [results.前池沿,results.空桥面,results.池外草地,results.固定岸内水带])expect(r.变化像素比例).toBeLessThan(0.003);
  expect((await readWater(page)).stone).toEqual(state.stone);
  expect((await readWater(page)).bridges).toEqual(state.bridges);
  expect(errors).toEqual([]); await writeFile(`${directory}/local-motion.json`,JSON.stringify({说明:"固定相机，临时隐藏HUD及既有昼夜覆盖；只比较指定水面与静态控制区域，未以全图差异代替动画检查。",结果:results},null,2));
});

test("water-lifecycle",async({page})=>{
  const errors=await startWater(page); const initial=await readWater(page);
  await page.keyboard.press("Escape");await page.waitForFunction(()=>(window as any).__farwind().mode==="pause");const paused=await readWater(page);await page.waitForTimeout(700);
  expect((await readWater(page)).water.time).toBe(paused.water.time);
  await page.getByRole("button",{name:"继续旅途"}).click();await page.waitForTimeout(180);
  const resumed=await readWater(page); expect(resumed.water.time-paused.water.time).toBeLessThan(300);expect(resumed.water.time).toBeGreaterThan(paused.water.time);
  for(let i=0;i<3;i++) {
    await page.keyboard.press("Escape");await page.getByRole("button",{name:"保存并返回标题"}).click();
    await page.waitForFunction(()=>(window as any).__farwind().mode==="title");
    const title=await readWater(page);await page.waitForTimeout(250);expect((await readWater(page)).water.time).toBe(title.water.time);
    await page.getByRole("button",{name:"继续旅途"}).click();await page.waitForTimeout(400);
    const current=await readWater(page);expect(current.water.counts).toEqual(initial.water.counts);expect(current.textures).toBe(initial.textures);expect(current.objects).toBe(initial.objects);
  }
  const lifecycle=await page.evaluate(async()=>{
    const game=(window as any).__waterGame,scene=game.scene.getScene("World"),old=scene.waterEffects;
    game.scene.stop("World");await new Promise(r=>setTimeout(r,180));
    const stopped={destroyed:old.snapshot().destroyed,owned:old.snapshot().ownedTextures.map((key:string)=>scene.textures.exists(key)),shared:scene.textures.exists("pond-water")&&scene.textures.exists("fountain")&&scene.textures.exists("bridge")};
    game.scene.start("World");return stopped;
  });
  expect(lifecycle.destroyed).toBe(true);expect(lifecycle.owned.every((v:boolean)=>!v)).toBe(true);expect(lifecycle.shared).toBe(true);
  await page.getByRole("button",{name:"继续旅途"}).click();await page.waitForTimeout(600);
  const restarted=await readWater(page);
  expect(restarted.water.counts).toEqual(initial.water.counts);
  expect(restarted.gpu).toEqual(initial.gpu);
  // 再次关闭游戏本体也必须正常，不能让已销毁VAO留在渲染器清理列表中。
  const gameDestroyed=await page.evaluate(()=>{const game=(window as any).__waterGame;game.destroy(true);return true;});
  await page.waitForTimeout(100);expect(gameDestroyed).toBe(true);expect(errors).toEqual([]);
  await writeFile(`${directory}/lifecycle.json`,JSON.stringify({说明:"通过正式菜单返回与继续；另执行真实场景stop/start以及game.destroy检查资源清理，比较重启前后GPU缓冲/VAO/程序数量。",暂停:paused.water,恢复:resumed.water,停止:lifecycle,重启:restarted.water,GPU重启前:initial.gpu,GPU重启后:restarted.gpu,游戏销毁:gameDestroyed},null,2));
});

test("water-tab-focus",async({page,context})=>{
  const errors=await startWater(page);
  // Playwright默认强制焦点；关闭模拟后验证真实标签失焦。当前Chromium仍将
  // document.hidden报告为false，因此这里不将失焦测试包装成visibilitychange验收。
  const cdp=await context.newCDPSession(page);await cdp.send("Emulation.setFocusEmulationEnabled",{enabled:false});
  await page.bringToFront();await page.waitForFunction(()=>document.hasFocus(),undefined,{timeout:10000});
  const tab=await context.newPage();await tab.goto("about:blank");await tab.bringToFront();
  await page.waitForFunction(()=>!document.hasFocus(),undefined,{timeout:10000});
  const hidden=await readWater(page);await page.waitForTimeout(600);const later=await readWater(page);
  expect(later.water.time).toBe(hidden.water.time);expect(later.water.surface.time).toBe(hidden.water.surface.time);
  await tab.close();await page.bringToFront();await page.waitForFunction(()=>document.hasFocus(),undefined,{timeout:10000});
  expect((await readWater(page)).mode).toBe("pause");
  await page.getByRole("button",{name:"继续旅途"}).click();await page.waitForTimeout(200);
  const resumed=await readWater(page);expect(resumed.water.time).toBeGreaterThan(hidden.water.time);
  expect(resumed.water.time-hidden.water.time).toBeLessThan(350);expect(errors).toEqual([]);
  await writeFile(`${directory}/tab-focus.json`,JSON.stringify({说明:"原生浏览器实际切换标签页，关闭默认焦点模拟后确认document.hasFocus变化，恢复通过正式继续菜单；未验证visibilitychange分支，没有伪造document.hidden。",失焦:hidden.water,失焦半秒后:later.water,恢复:resumed.water,错误:errors},null,2));
});

test("water-navigation",async({page})=>{
  const errors=await startWater(page), records=[];
  for(const [name,x,y]of [["west-bridge-north",1090,920],["west-bridge-south",1090,1435],["south-bridge",1310,1420],["south-bridge-water",1310,1330],["east-shore",1560,1120],["fountain-front",680,925],["fountain-back",680,765]] as const){
    await move(page,x,y);await page.waitForTimeout(300);const s=await readWater(page);records.push({位置:name,...s});
    const cat=await page.evaluate(()=>(window as any).__farwind().companion);expect(cat.blocked).toBe(false);
    await page.screenshot({path:`${directory}/${name}.png`});
  }
  await page.setViewportSize({width:1365,height:853});await move(page,1090,1130);await page.waitForTimeout(700);
  const resized=await readWater(page);expect(resized.camera.zoom).toBeCloseTo(1365/1280,3);expect(resized.water.counts.lilies).toBe(18);
  for(const l of resized.water.lilies)expect(Math.abs(l.y-l.anchorY)).toBeLessThanOrEqual(1.251);
  await page.screenshot({path:`${directory}/resized.png`});expect(errors).toEqual([]);
  await writeFile(`${directory}/movement.json`,JSON.stringify({说明:"使用真实键盘与正式碰撞通道，无直接坐标写入；记录黑猫与玩家过桥。",经过:records,缩放:resized},null,2));
});

test("water-hitstop-culling",async({page})=>{
  const errors=await startWater(page,{x:850,y:695});
  // 固定诊断相机使水景可见，实际玩家仍站在正式训练场，由真实按键触发命中停顿。
  await page.evaluate(()=>{const s=(window as any).__waterGame.scene.getScene("World");s.cameras.main.stopFollow().centerOn(1090,980);(window as any).__waterHitFrames=[];const sample=()=>{const water=s.waterEffects.snapshot();(window as any).__waterHitFrames.push({hitstop:s.combat.hitStopRemaining,requested:s.combat.lastHitStopRequested,time:water.time,flow:water.flowOffset,hit:s.training.lastHit});};s.events.on("postupdate",sample);(window as any).__waterSample=sample;});
  await page.keyboard.down("w");await page.waitForTimeout(90);await page.keyboard.up("w");await page.keyboard.press("j");await page.waitForTimeout(700);
  const frames=await page.evaluate(()=>{const s=(window as any).__waterGame.scene.getScene("World");s.events.off("postupdate",(window as any).__waterSample);return (window as any).__waterHitFrames;});
  const frozen=frames.filter((f:any)=>f.hitstop>0),hit=frames.filter((f:any)=>f.requested>0&&f.hit>=0);
  expect(hit.length).toBeGreaterThan(2);
  // 慢帧可能在一次Timeline推进中完整消耗短暂命中停顿；仍须证明真实命中及实际流水偏移持续推进。
  if(frozen.length>1)expect(frozen.at(-1).time).toBeGreaterThan(frozen[0].time);
  expect(hit.at(-1).time).toBeGreaterThan(hit[0].time);expect(hit.at(-1).flow).toBeLessThan(hit[0].flow);
  await page.evaluate(()=>{(window as any).__waterGame.scene.getScene("World").cameras.main.centerOn(3100,600);});
  await page.waitForFunction(()=>{const w=(window as any).__waterGame.scene.getScene("World").waterEffects.snapshot();return !w.pondVisible&&!w.fountainVisible;});
  const off=await readWater(page);await page.waitForTimeout(500);const off2=await readWater(page);
  expect(off2.mode).toBe("");expect(off2.water.time).toBeGreaterThan(off.water.time);
  expect(off2.water.pondUpdates).toBe(off.water.pondUpdates);expect(off2.water.fountainUpdates).toBe(off.water.fountainUpdates);
  await page.evaluate(()=>{(window as any).__waterGame.scene.getScene("World").cameras.main.centerOn(1090,980);});await page.waitForTimeout(250);
  expect((await readWater(page)).water.pondUpdates).toBeGreaterThan(off2.water.pondUpdates);expect(errors).toEqual([]);
  await writeFile(`${directory}/hitstop-culling.json`,JSON.stringify({说明:"正式训练目标与真实攻击触发命中停顿，记录停顿请求与实际纹理偏移；相机固定于水景用于独立观察。慢帧内完整消耗停顿时，postupdate不一定采到正剩余值。实际水景附近挥剑另由录屏展示。",命中停顿帧:frozen,真实命中后流水:hit,离屏:off.water,离屏半秒后:off2.water,回到视野:(await readWater(page)).water},null,2));
});
