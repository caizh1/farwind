import {test,expect,type Page} from '@playwright/test';
import {initialState} from '../src/game/systems/state';
import {CONTINENT,fitCurrentArea} from '../src/game/ui/mapViewport';
import {WORLD_PLAN_REGIONS} from '../src/data/worldPlan';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const evidence=process.env.MAP_EVIDENCE_DIR??'docs/map-zoom/evidence/';
const unknownPoint=WORLD_PLAN_REGIONS.find(r=>r.id==='unknown')!.point;
const observe=(page:Page)=>page.locator('#combat-observation').evaluate(e=>JSON.parse(e.textContent!));
const view=(page:Page)=>page.locator('#world-map').evaluate((e:HTMLCanvasElement)=>({x:Number(e.dataset.centerX),y:Number(e.dataset.centerY),scale:Number(e.dataset.scale),min:Number(e.dataset.minScale),max:Number(e.dataset.maxScale),area:e.dataset.area,player:{x:Number(e.dataset.playerX),y:Number(e.dataset.playerY)},width:Number(e.dataset.viewportWidth),height:Number(e.dataset.viewportHeight),performance:JSON.parse(e.dataset.performance!)}));
const viewportReady=async(page:Page)=>{await expect.poll(async()=>page.locator('#world-map').evaluate(e=>Math.abs(Number(e.dataset.viewportWidth)-Math.round(e.clientWidth))+Math.abs(Number(e.dataset.viewportHeight)-Math.round(e.clientHeight)))).toBe(0);};
const currentFit=async(page:Page)=>{await expect.poll(async()=>{const c=await view(page),fit=fitCurrentArea(c.player,{width:c.width,height:c.height});return Math.abs(c.scale-fit.scale)+Math.abs(c.x-fit.x)+Math.abs(c.y-fit.y);}).toBeLessThan(1e-8);};
const stable=(s:any)=>({位置:s.位置,生命:s.生命,金币:s.金币,行囊:s.行囊,主线:s.主线,商路:s.商路,城市:s.城市,风赐:s.风赐});
async function start(page:Page){await mkdir(evidence,{recursive:true});await page.goto('/?combatObservation=1');await page.getByRole('button',{name:'启程 · 新游戏',exact:true}).click();await expect(page.locator('#combat-observation')).toBeAttached();await expect.poll(async()=>(await observe(page)).暂停).toBe(false);}
async function open(page:Page){await page.keyboard.press('m');await expect(page.getByRole('heading',{name:'远风舆图',exact:true})).toBeVisible();await expect(page.locator('#map-loading')).toBeHidden();await expect(page.locator('#world-map')).toHaveAttribute('data-scale',/.+/);await expect.poll(async()=>(await observe(page)).暂停).toBe(true);await expect.poll(async()=>page.locator('#world-map').evaluate((e,b)=>Math.abs(Number(e.dataset.minScale)-Math.min(e.clientWidth/b.width,e.clientHeight/b.height)),CONTINENT)).toBeLessThan(1e-8);}
async function screenshot(page:Page,name:string){await page.screenshot({path:evidence+name+'.png'});}
test.afterEach(async({page},info)=>{const video=page.video();if(info.status!==info.expectedStatus)await writeFile(evidence+info.title+'-failure.json',JSON.stringify({说明:'失败时保留真实页面证据。',页面:await page.locator('body').innerText().catch(()=>''),运行:await observe(page).catch(()=>null),地图:await view(page).catch(()=>null),视口:page.viewportSize()},null,2));await page.close();if(video)await video.saveAs(evidence+info.title.replace(/[^a-z0-9-]/g,'')+'.webm');});

test('map-input-and-world',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await start(page);await open(page);
 const before=stable(await observe(page));expect(before.商路.nodes).toEqual([]);await expect(page.locator('#world-map')).toHaveAttribute('data-area','plains');await expect(page.locator('[data-camp-status]')).toHaveCount(4);await screenshot(page,'plains-runtime');
 await writeFile(evidence+'input-start.json',JSON.stringify({说明:'开始输入前的真实视口基线。',地图:await view(page)},null,2));
 const old=await view(page),box=(await page.locator('#world-map').boundingBox())!,anchor={x:Math.floor(box.x+box.width*.37)-box.x,y:Math.floor(box.y+box.height*.6)-box.y};
 await page.mouse.move(box.x+anchor.x,box.y+anchor.y);await page.mouse.wheel(0,-120);await expect.poll(async()=>(await view(page)).scale).toBeGreaterThan(old.scale);
 const next=await view(page),point=(c:any)=>({x:c.x+(anchor.x*c.width/box.width-c.width/2)/c.scale,y:c.y+(anchor.y*c.height/box.height-c.height/2)/c.scale});expect(point(next).x).toBeCloseTo(point(old).x,4);expect(point(next).y).toBeCloseTo(point(old).y,4);
 await page.mouse.down();await page.mouse.move(box.x+anchor.x+120,box.y+anchor.y+65,{steps:12});await page.mouse.up();await expect(page.locator('#world-map')).not.toHaveClass(/is-dragging/);await expect.poll(async()=>(await view(page)).x).toBeLessThan(next.x-20);
 await page.locator('#map-world').click();await expect.poll(async()=>{const c=await view(page);return Math.abs(c.scale-c.min)}).toBeLessThan(1e-8);await expect(page.locator('#map-level')).toHaveText('世界全貌');const world=await view(page);expect(world.scale).toBeCloseTo(world.min,8);await expect(page.locator('#map-zoom-out')).toBeDisabled();await screenshot(page,'world-runtime');
 const unknownBox=(await page.locator('#world-map').boundingBox())!;await page.mouse.click(unknownBox.x+((unknownPoint.x-world.x)*world.scale+world.width/2)*unknownBox.width/world.width,unknownBox.y+((unknownPoint.y-world.y)*world.scale+world.height/2-35)*unknownBox.height/world.height);await expect(page.locator('#atlas-region-name')).toHaveText('？？？');await expect(page.locator('#atlas-region-status')).toContainText('未知位置');
 await expect(page.locator('#map-directory-panel')).toBeHidden();await page.locator('#map-directory-toggle').click();await expect(page.locator('#map-directory-toggle')).toHaveAttribute('aria-expanded','true');await expect.poll(async()=>{const c=await view(page);return Math.abs(c.scale-c.min)}).toBeLessThan(1e-8);const directoryWorld=await view(page);
 for(const id of ['snow','mountains','fire','emerald','lake','coast','desert','islands','unknown']){await page.locator(`[data-atlas-region=${id}]`).click();await expect(page.locator('#atlas-region-status')).toContainText('暂未开放');await expect(page.locator('#atlas-enter')).toBeDisabled();await expect(page.locator('#atlas-region-name')).toBeInViewport();expect((await view(page)).scale).toBe(directoryWorld.scale);}
 await screenshot(page,'directory-runtime');await page.locator('#map-directory-close').click();await expect(page.locator('#map-directory-panel')).toBeHidden();await viewportReady(page);await expect.poll(async()=>Math.abs((await view(page)).scale-world.scale)).toBeLessThan(1e-8);
 // 从画布上的风语城标签真实点击进入区域，目录负责补充无障碍入口。
 const cityView=await view(page),worldBox=(await page.locator('#world-map').boundingBox())!;await page.mouse.click(worldBox.x+((11790-cityView.x)*cityView.scale+cityView.width/2)*worldBox.width/cityView.width,worldBox.y+((1050-cityView.y)*cityView.scale+cityView.height/2-35)*worldBox.height/cityView.height);await expect(page.locator('#atlas-region-name')).toHaveText('风语城');await expect(page.locator('#atlas-region-status')).toHaveText('部分开放');await expect.poll(async()=>(await view(page)).scale).toBeGreaterThan(world.scale);await page.waitForTimeout(350);await screenshot(page,'city-runtime');
 await page.locator('#map-directory-toggle').click();await page.locator('[data-atlas-region=road]').click();await page.locator('#map-directory-close').click();await page.waitForTimeout(350);await screenshot(page,'road-runtime');
 await viewportReady(page);await page.locator('#map-current').click();await currentFit(page);
 for(let i=0;i<2;i++){const scale=(await view(page)).scale;await page.locator('#map-zoom-in').click();await expect.poll(async()=>(await view(page)).scale).toBeGreaterThan(scale);}
 await page.locator('#world-map').focus();for(let i=0;i<14;i++)await page.keyboard.press('+');
 await expect(page.locator('#map-zoom-in')).toBeDisabled();const closest=await view(page);expect(closest.width/closest.scale).toBeCloseTo(1000,4);await page.locator('#map-locate').click();await expect.poll(async()=>(await view(page)).x).toBeCloseTo(closest.player.x,4);await page.locator('#world-map').focus();for(let i=0;i<18;i++)await page.keyboard.press('ArrowRight');await screenshot(page,'local-runtime');const performance=await view(page);expect(performance.performance.缓存峰值).toBeLessThanOrEqual(96);
 const wheelBox=(await page.locator('#world-map').boundingBox())!;await page.mouse.move(wheelBox.x+wheelBox.width/2,wheelBox.y+wheelBox.height/2);await page.mouse.wheel(0,20000);await expect.poll(async()=>(await view(page)).scale).toBeLessThan(closest.scale);await page.locator('#map-current').click();await currentFit(page);expect(stable(await observe(page))).toEqual(before);expect(errors).toEqual([]);
 await writeFile(evidence+'input-record.json',JSON.stringify({说明:'固定生产构建；新档尚未生成商路节点；真实键鼠缩放、锚点、拖动、世界边界、未开放地区和返回。',缩放前:old,缩放后:next,世界:world,最近:closest,性能:performance,最后:await view(page),状态不变:true,错误:errors},null,2));
});

test('map-touch-and-responsive',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await start(page);await open(page);
 for(const [width,height]of [[1280,720],[1440,900],[800,600],[390,844],[320,640],[600,420],[390,420],[320,480]]){
  await page.setViewportSize({width,height});await expect.poll(async()=>Math.round((await page.locator('.zoom-map-panel').boundingBox())!.width)).toBeLessThanOrEqual(width);
  await expect(page.locator('#close')).toBeInViewport();expect(await page.locator('.zoom-map-panel').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
  expect((await view(page)).height).toBeGreaterThanOrEqual(height<560?90:120);const canvasBox=(await page.locator('#world-map').boundingBox())!,closeBox=(await page.locator('#close').boundingBox())!;expect(canvasBox.y+canvasBox.height).toBeLessThan(closeBox.y);await screenshot(page,`viewport-${width}-${height}`);
 }
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);const b=(await page.locator('#world-map').boundingBox())!,old=await view(page);
 const cdp=await page.context().newCDPSession(page),x=b.x+b.width/2,y=b.y+b.height/2;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-45,y,id:1},{x:x+45,y,id:2}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-80,y:y+10,id:1},{x:x+80,y:y+10,id:2}]});
 await expect.poll(async()=>(await view(page)).scale).toBeGreaterThan(old.scale*1.5);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await expect(page.locator('#world-map')).not.toHaveClass(/is-dragging/);
 await screenshot(page,'touch-runtime');await cdp.detach();expect(errors).toEqual([]);
 await writeFile(evidence+'touch-record.json',JSON.stringify({说明:'浏览器真实触控输入协议产生双指手势，取消后释放拖动。八种视口实际截图；页面无横向溢出，关闭按钮可见。',手势前:old,手势后:await view(page),错误:errors},null,2));
});

test('map-lifecycle-and-focus',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await start(page);await open(page);const baseline=await view(page);
 await page.locator('#world-map').focus();await page.keyboard.press('+');await expect.poll(async()=>(await view(page)).scale).toBeGreaterThan(baseline.scale);await page.keyboard.press('Home');await expect.poll(async()=>Math.abs((await view(page)).scale-baseline.scale)).toBeLessThan(1e-8);
 for(let i=0;i<8;i++){await page.keyboard.press('m');await expect(page.locator('#modal')).toBeHidden();await open(page);expect((await view(page)).scale).toBeCloseTo(baseline.scale,8);}
 await page.keyboard.press('m');await expect(page.locator('#modal')).toBeHidden();await page.keyboard.press('Escape');await page.locator('#pause-map').click();await expect(page.locator('#map-loading')).toBeHidden();await page.keyboard.press('Escape');await expect(page.getByRole('heading',{name:'在风中歇一会儿',exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#modal')).toBeHidden();
 await page.locator('#minimap-toggle').click();await page.getByRole('button',{name:'M 完整地图',exact:true}).click();await expect(page.locator('#map-loading')).toBeHidden();await page.locator('#close').click();await expect(page.locator('#modal')).toBeHidden();
 await expect.poll(async()=>(await observe(page)).暂停).toBe(false);const before=await observe(page);await page.keyboard.down('d');await page.keyboard.down('Space');await expect.poll(async()=>(await observe(page)).位置.x,{timeout:6000}).toBeGreaterThan(before.位置.x+90);const running=await observe(page);await page.keyboard.up('Space');await page.keyboard.up('d');expect(running.体力).toBeLessThan(before.体力);expect(errors).toEqual([]);
 await screenshot(page,'movement-after-close');await writeFile(evidence+'lifecycle-record.json',JSON.stringify({说明:'八次真实开关，键盘Home、暂停菜单返回，HUD鼠标打开及关闭后真实奔跑。',关闭前:before,奔跑后:await observe(page),错误:errors},null,2));
});

async function importState(page:Page,s:ReturnType<typeof initialState>){
 await page.goto('/?combatObservation=1');page.once('dialog',d=>d.accept());const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入存档',exact:true}).click();await(await chooser).setFiles({name:'map-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(s))});await expect.poll(async()=>(await observe(page)).位置.x).toBeCloseTo(s.player.x,0);await expect.poll(async()=>(await observe(page)).暂停).toBe(false);
}
test('map-default-area-and-interior',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const records=[];
 for(const [x,y,area]of [[5000,1600,'road'],[11000,1600,'city'],[13800,3300,'city']]as const){
  const s=initialState();s.player.x=x;s.player.y=y;await importState(page,s);await open(page);await expect(page.locator('#world-map')).toHaveAttribute('data-area',area);await expect(page.locator('#map-landmark-list')).toContainText(area==='road'?'原野驿站':'西门驿站');const c=await view(page);expect(c.player).toEqual({x,y});records.push(c);await screenshot(page,`default-${area}-${x}`);
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);const resized=await view(page),px=(x-resized.x)*resized.scale+resized.width/2,py=(y-resized.y)*resized.scale+resized.height/2;expect(px).toBeGreaterThan(0);expect(px).toBeLessThan(resized.width);expect(py).toBeGreaterThan(0);expect(py).toBeLessThan(resized.height);await page.setViewportSize({width:1280,height:800});
 }
 const s=initialState();s.life.playerSpace='general-shop';s.life.outside={x:1060,y:790};s.player.x=700;s.player.y=910;await importState(page,s);await open(page);expect((await view(page)).player).toEqual(s.life.outside);await expect(page.locator('.map-selection')).toContainText('室外入口');await screenshot(page,'indoor-runtime');records.push(await view(page));expect(errors).toEqual([]);
 await writeFile(evidence+'defaults-record.json',JSON.stringify({说明:'合法存档通过正式文件导入验证默认区域与室外入口，不是新档连续通行证明；不修改运行状态。',样本:records,错误:errors},null,2));
});

async function walk(page:Page,x:number,y:number){
 let stuck=0,last:any;
 for(let i=0;i<220;i++){
  const s=await observe(page),p=s.位置,dx=x-p.x,dy=y-p.y,d=Math.hypot(dx,dy),bridge=p.x>6700&&p.x<7500;
  if(d<(bridge?10:20)&&await page.locator('#modal').isHidden())return;if(s.生命<55)await page.keyboard.press('1');
  if(s.敌人.some((e:any)=>Math.hypot(e.x-p.x,e.y-p.y)<150))await page.keyboard.press('j');
  if(p.x<1000&&x>3000)throw Error('连续通行中阵亡回村。');
  if(s.暂停){if(await page.locator('#modal').isHidden()){await expect.poll(async()=>(await observe(page)).暂停).toBe(false);continue;}const close=page.locator('#gift-close, #victory-continue, #close').first();if(await close.isVisible()){try{await close.click({timeout:2000});}catch(e){if(await page.locator('#modal').isVisible())throw e;}}else throw Error(`通行遇到尚未处理的界面：${s.界面}`);await expect.poll(async()=>(await observe(page)).暂停).toBe(false);continue;}
  const diagonal=Math.abs(dx)>30&&Math.abs(dy)>30&&Math.abs(dx/dy)>.6&&Math.abs(dx/dy)<1.65,keys=diagonal?[dx>0?'d':'a',dy>0?'s':'w']:[Math.abs(dx)>Math.abs(dy)?dx>0?'d':'a':dy>0?'s':'w'];
  for(const key of keys)await page.keyboard.down(key);if(d>120)await page.keyboard.down('Space');await page.waitForTimeout(Math.min(320,Math.max(bridge?60:140,(Math.abs(dx)>Math.abs(dy)?Math.abs(dx):Math.abs(dy))*3.2)));for(const key of keys)await page.keyboard.up(key);await page.keyboard.up('Space');
  stuck=last&&Math.hypot(p.x-last.x,p.y-last.y)<2?stuck+1:0;last=p;if(stuck>8)throw Error(`键盘通行受阻：${JSON.stringify({当前位置:p,目标:{x,y}})}`);
 }
 throw Error('键盘通行超时。');
}
test('map-real-continuous-walk',async({page})=>{
 test.setTimeout(420000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await start(page);const began=Date.now(),records=[];
 const check=async(area:string,name:string)=>{await open(page);await expect(page.locator('#world-map')).toHaveAttribute('data-area',area);records.push({位置:await observe(page),地图:await view(page)});await screenshot(page,name);await page.keyboard.press('m');await expect(page.locator('#modal')).toBeHidden();await expect.poll(async()=>(await observe(page)).暂停).toBe(false);};
 // 通过正式邀请获得同行保护，避免不还击的初始角色在林地耗尽六瓶药；不授予或改写状态。
 await walk(page,760,720);await page.locator('#xiaobao-summary').click();await page.getByRole('button',{name:'与我出征',exact:true}).click();await expect(page.locator('#modal')).toBeHidden();await expect.poll(async()=>(await observe(page)).同行.小宝.安排).toBe('follow');await walk(page,670,720);
 await check('plains','walk-plains');const route=JSON.parse(await readFile('docs/windwhisper-city/evidence/walk-route.json','utf8'));
 for(const p of route.补给.slice(1))await walk(page,p.x,p.y);await expect.poll(async()=>(await observe(page)).交互).toBe('service-general');await page.keyboard.press('e');await page.getByLabel('物品',{exact:true}).selectOption('potion');await page.getByLabel('数量',{exact:true}).fill('6');await page.getByRole('button',{name:'核对交易',exact:true}).click();await page.getByRole('button',{name:'确认购买',exact:true}).click();await expect(page.locator('#shop-feedback')).toContainText('交易已完成并保存');await page.keyboard.press('Escape');for(const p of [...route.补给].reverse().slice(1))await walk(page,p.x,p.y);
 for(const p of route.原野.slice(1))await walk(page,p.x,p.y);console.log('已真实步行到原野东口');
 // 地图往返只沿实际通路行走；商路首次进入自动创建本趟，不依赖额外休整。
 for(const [i,p]of route.商路.slice(1).entries()){await walk(page,p.x,p.y);if(i===7)await check('road','walk-road');if(i===22)await screenshot(page,'walk-bridge');}
 console.log('已真实跨桥进入风语城');await check('city','walk-city');const arrived=await observe(page);expect(arrived.城市.visited).toBe(true);
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'保存旅途',exact:true}).click();await expect(page.locator('#toast')).toContainText('旅途已保存');await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await expect.poll(async()=>(await observe(page)).暂停).toBe(false);await check('city','walk-city-reload');expect((await observe(page)).商路.seed).toBe(arrived.商路.seed);
 for(const p of [...route.商路].reverse().slice(1))await walk(page,p.x,p.y);await check('plains','walk-return');expect((await observe(page)).生命).toBeGreaterThan(0);expect(errors).toEqual([]);
 await writeFile(evidence+'walk-record.json',JSON.stringify({说明:'固定生产构建；新档通过真实键鼠邀请小宝同行、购买补给、战斗、步行穿过商路与桥进城，保存刷新后原路步行返回原野东口。没有授予、传送或运行状态修改。完整录像同名。',耗时秒:(Date.now()-began)/1000,到达:arrived,检查点:records,结束:await observe(page),错误:errors},null,2));
});

// 新目录路径：低矮窄屏展开后介绍、地图和关闭入口都必须可用。
test('map-directory-and-small-screen',async({page})=>{
 await start(page);await open(page);
 for(const [width,height]of [[1440,900],[390,844],[320,420]]){
  await page.setViewportSize({width,height});await page.locator('#map-world').click();await page.waitForTimeout(300);
  await page.locator('#map-directory-toggle').click();await expect(page.locator('#map-directory-panel')).toBeVisible();await expect(page.locator('#map-directory-close')).toBeInViewport();
  await page.locator('[data-atlas-region=unknown]').click();await expect(page.locator('#atlas-region-name')).toBeInViewport();await expect(page.locator('#atlas-region-status')).toContainText('未知位置');await expect(page.locator('#atlas-enter')).toBeDisabled();
  expect(await page.locator('.zoom-map-panel').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);expect((await view(page)).height).toBeGreaterThanOrEqual(90);
  await screenshot(page,`directory-${width}-${height}`);await page.locator('#map-directory-close').click();await expect(page.locator('#map-directory-panel')).toBeHidden();await expect(page.locator('#map-directory-toggle')).toBeFocused();
 }
 await page.setViewportSize({width:1440,height:900});await page.locator('#map-current').click();await page.waitForTimeout(300);await page.locator('#map-world').click();await page.waitForTimeout(300);await screenshot(page,'world-design-match');
});
