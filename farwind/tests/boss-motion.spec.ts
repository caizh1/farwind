import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {CAMP_BOSSES,type CampBossKind} from '../src/data/maps/windbell/campBosses';
for(const kind of Object.keys(CAMP_BOSSES) as CampBossKind[])test(`boss-motion-${kind}`,async({page})=>{
 const root=`docs/boss-motion/evidence/${kind}`;mkdirSync(root,{recursive:true});const errors:string[]=[],samples:unknown[]=[];page.on('pageerror',e=>errors.push(e.message));
 const read=()=>page.evaluate(()=>(window as any).__bossMotionPreview());
 try{
  await page.goto('/combat-art-preview.html');await page.waitForFunction(()=>typeof (window as any).__bossMotionPreview==='function');await expect(page.locator('#actor')).toBeEnabled();await page.locator('#actor').selectOption(kind);await expect(page.locator('#action')).toBeEnabled();
  for(const action of ['idle','walk',...Array.from({length:6},(_,i)=>'skill-'+i)]){
   await page.locator('#action').selectOption(action);await page.locator('#direction').selectOption('3');await page.waitForTimeout(200);const first=await read();await page.waitForTimeout(220);const second=await read();
   expect(first.样本[1].动画.vertices).toBeGreaterThanOrEqual(441);expect(second.样本[1].动画.visible).toBe(true);expect(first.样本[1].动画.points).not.toEqual(second.样本[1].动画.points);expect(second.样本[1].素材).toBe('right/idle');samples.push({动作:action,起点:first,后续:second});
   if(action.startsWith('skill-'))await page.waitForTimeout(520);await page.screenshot({path:root+`/${action}.png`});
  }
  for(const dir of ['0','1','2','3']){await page.locator('#direction').selectOption(dir);await page.waitForTimeout(50);const s=await read();expect(s.样本[1].镜像).toBe(dir==='2');expect(s.样本[1].动画.visible).toBe(true);}
  await page.getByRole('button',{name:'暂停播放',exact:true}).click();const paused=await read();await page.waitForTimeout(120);expect(await read()).toEqual(paused);await page.screenshot({path:root+'/paused.png'});
  await page.locator('#baseline').check();expect((await read()).样本[0].动画.visible).toBe(false);expect((await read()).样本[1].动画.visible).toBe(true);await page.screenshot({path:root+'/comparison.png'});
  // 保留一个完整、不间断的蓄力→出手→收势周期供视觉审阅。
  await page.locator('#action').selectOption('skill-'+({'spore-heart':2,'thorn-crown':1,'crag-tusk':3,'bound-branch':0}[kind]));await page.getByRole('button',{name:'继续播放',exact:true}).click();await page.waitForTimeout(4200);await page.screenshot({path:root+'/continuous-comparison.png'});
  expect(errors).toEqual([]);writeFileSync(root+'/validation.json',JSON.stringify({说明:'固定预览使用正式首领渲染器。通过正常选择、播放、暂停检查四首领六招、实际位移步态、三向和镜像；不读写存档，不能代替实战验收。',结果:'通过',错误:errors,样本:samples},null,2));
 }finally{const video=page.video();await page.close();if(video)await video.saveAs(root+'/animation.webm');}
});
test('wolf-claw-release-and-flight',async({page})=>{
 const root='docs/boss-motion/evidence/wolf-claw';mkdirSync(root,{recursive:true});const samples:unknown[]=[],errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const read=()=>page.evaluate(()=>(window as any).__bossMotionPreview());
 await page.goto('/combat-art-preview.html');await expect(page.locator('#actor')).toBeEnabled();await page.locator('#actor').selectOption('thorn-crown');await expect(page.locator('#action')).toBeEnabled();await page.locator('#action').selectOption('skill-1');
 for(const part of ['0','1'])for(const direction of ['3','2','0','1']){
  await page.locator('#direction').selectOption(direction);await page.locator('#part').selectOption(part);
  const frames:any[]=[];
  for(const time of [0,590,680,749,750,830,1010,1070,1289,1290]){
   await page.locator('#time').fill(String(time));const sample=await read();frames.push(sample);if([590,750,1010].includes(time))await page.screenshot({path:`${root}/part-${part}-direction-${direction}-time-${time}.png`});
  }
  const before=frames[1].样本[1].动画.clawTip,swing=frames[4].样本[1].动画.clawTip,release=frames[4].特效.effects.find((e:any)=>e.id==='固定预览-1:战斗0:1'),later=frames[6].特效.effects.find((e:any)=>e.id==='固定预览-1:战斗0:1');
  expect(Math.hypot(swing.x-before.x,swing.y-before.y)).toBeGreaterThan(45);expect(frames[3].特效.effects.every((e:any)=>e.phase==='蓄力')).toBe(true);
  expect(Math.hypot(swing.x-release.origin.x,swing.y-release.origin.y)).toBeLessThan(.001);expect(release.point).toEqual(release.origin);expect(later.travel).toBeGreaterThan(60);expect(later.origin).toEqual(release.origin);
  const paw=frames[6].样本[1].动画.clawTip;expect(Math.hypot(later.point.x-paw.x,later.point.y-paw.y)).toBeGreaterThan(60);expect(frames[9].特效.effects).toEqual([]);expect(frames[9].样本[1].动画.clawTip).toBeNull();samples.push({连段:part,方向:direction,帧:frames});
 }
 await page.locator('#direction').selectOption('3');await page.locator('#part').selectOption('0');
 // 用正常预览时间输入采集连续20毫秒帧；动图帧率降低一半供慢放审阅。
 mkdirSync(root+'/frames',{recursive:true});for(let time=0;time<=1320;time+=20){await page.locator('#time').fill(String(time));await page.screenshot({path:`${root}/frames/frame-${String(time/20).padStart(3,'0')}.png`});}
 const paused=await read();await page.waitForTimeout(100);expect(await read()).toEqual(paused);expect(errors).toEqual([]);
 writeFileSync(root+'/validation.json',JSON.stringify({说明:'正式首领渲染器，正常预览控件驱动；核对两爪四方向的实际爪尖、释放原点、向外飞行和暂停。不读写游戏存档，不代表正式路线通关。',结果:'通过',错误:errors,样本:samples},null,2));
});
