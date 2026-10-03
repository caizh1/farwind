import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {initialState} from '../src/game/systems/state';
import {initialEncounters} from '../src/game/systems/encounterState';
import {ENCOUNTERS,waveMembers} from '../src/data/maps/windbell/encounters';

const root='docs/attack-warning/evidence-v3';
const read=(page:Page)=>page.evaluate(()=>(window as any).__farwind());
function checkLayers(s:any){
  const layers=s.warningLayers;
  for(const depth of [layers.ground,...layers.enemyEdges,layers.bossGround,layers.bossEdges,layers.bossGroundEffects])expect(depth).toBeLessThan(layers.heroShadow);
  expect(layers.heroShadow).toBeLessThan(layers.hero);expect(layers.overlay).toBeGreaterThan(layers.hero);
  return {地面预警均低于主角阴影:true,头侧提示独立于地面:true};
}
async function fixture(page:Page,s:ReturnType<typeof initialState>){
  await page.goto('/');page.on('dialog',dialog=>dialog.accept());
  const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入存档',exact:true}).click();
  await(await chooser).setFiles({name:'warning-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(s))});
  await page.waitForFunction(()=>(window as any).__farwind?.().mode==='');
}
async function pixels(png:Buffer){const {data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});let red=0;for(let i=0;i<data.length;i+=4){const [r,g,b]=[data[i],data[i+1],data[i+2]];if(r>130&&g<130&&b>55&&b>g*1.1&&r>b*1.5)red++;}return {朱红像素:red,宽:info.width,高:info.height};}

for(const [name,time,width,height] of [['day',480,1280,720],['night',1320,1280,720],['compact',480,768,600]] as const)test(`冲刺预警与贴身提示-${name}`,async({page})=>{
  await mkdir(root,{recursive:true});await page.setViewportSize({width,height});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const s=initialState();s.player.x=790;s.player.y=720;s.time=time;await fixture(page,s);
  await page.getByRole('button',{name:'迎风架剑练习',exact:true}).click();await page.getByRole('button',{name:'棘甲林豕 · 直线冲锋',exact:true}).click();
  await page.waitForFunction(()=>{const s=(window as any).__farwind(),a=s.parryTraining.attack;return a&&a.contactAt-s.session.sim>300&&a.contactAt-s.session.sim<520;});
  const before=await read(page),png=await page.screenshot({path:`${root}/boar-${name}.png`}),metric=await pixels(png);
  expect(before.warningLayers.enemyEdges.length).toBeGreaterThan(0);const layers=checkLayers(before);
  expect(metric.朱红像素).toBeGreaterThan(80);expect(before.parryTraining.predictedContact).not.toBeNull();
  await page.keyboard.press('Escape');const paused=await read(page);await page.waitForTimeout(180);const still=await read(page);expect(still.session.sim).toBe(paused.session.sim);expect(still.parryTraining.attack?.contactAt).toBe(paused.parryTraining.attack?.contactAt);await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'迎风架剑练习',exact:true}).click();await page.locator('#parry-indicators').uncheck();await page.getByRole('button',{name:'返回木桩练习',exact:true}).click();
  expect((await read(page)).parryTraining.indicators).toBe(false);const off=await pixels(await page.screenshot({path:`${root}/boar-${name}-off.png`}));expect(off.朱红像素).toBeLessThan(metric.朱红像素*.35);expect(errors).toEqual([]);
  await writeFile(`${root}/boar-${name}.json`,JSON.stringify({说明:'隔离浏览器通过导入全新起始夹具与正式训练入口验收。只设置初始位置和时间，不授予装备、进度或战斗结果；暂停与开关均使用真实按键和按钮。检查全部地面预警层级低于主角阴影，头侧提示使用独立高层。',层级:layers,画面:metric,关闭后:off,视口:{宽:width,高:height},暂停同步:'通过',关闭指示器:'通过',生命:before.state.player.hp,错误:errors},null,2));
});

test('正式地刺危险区由敌人自然施放，预警与生效位置不漂移',async({page})=>{
  await mkdir(root,{recursive:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const group=ENCOUNTERS.find(d=>d.id==='north-pass-charge')!;
  let seed=1;while(!waveMembers(group,seed).some(m=>m.wave===0&&m.type==='geomancer'))seed++;
  const mage=waveMembers(group,seed).find(m=>m.wave===0&&m.type==='geomancer')!;
  const s=initialState();s.encounters=initialEncounters(seed);s.player.x=mage.x+70;s.player.y=mage.y+70;await fixture(page,s);
  await page.waitForFunction(()=>{const s=(window as any).__farwind();return s.bossHazards.some((h:any)=>h.activeAt-s.session.sim>350&&h.activeAt-s.session.sim<900);},undefined,{timeout:25000});
  await page.waitForFunction(()=>{const s=(window as any).__farwind();return s.bossHazards.some((h:any)=>h.activeAt-s.session.sim>150&&h.activeAt-s.session.sim<320);});
  const before=await read(page),pending=before.bossHazards.filter((h:any)=>h.activeAt>before.session.sim);
  checkLayers(before);
  const png=await page.screenshot({path:`${root}/spikes-charge.png`});expect((await pixels(png)).朱红像素).toBeGreaterThan(80);
  await page.waitForFunction(()=>{const s=(window as any).__farwind();return s.bossHazards.some((h:any)=>s.session.sim>=h.activeAt&&h.expires>s.session.sim);});
  const active=await read(page);const same=active.bossHazards.filter((h:any)=>pending.some((p:any)=>p.id===h.id));expect(same.length).toBeGreaterThan(0);
  checkLayers(active);
  for(const h of same){const previous=pending.find((p:any)=>p.id===h.id);expect(h.point).toEqual(previous.point);expect(h.radius).toBe(previous.radius);}
  // 真实按键走入正在生效的圆圈，检查轮廓、尖刺符号和计时线不会盖住身体。
  const target=[...same].sort((a:any,b:any)=>Math.hypot(a.point.x-active.state.player.x,a.point.y-active.state.player.y)-Math.hypot(b.point.x-active.state.player.x,b.point.y-active.state.player.y))[0];
  // 一进入圆圈就停下；不继续走到圆心，也不在短暂危险区存续期间插入额外截图。
  const dx=target.point.x-active.state.player.x,dy=target.point.y-active.state.player.y,key=Math.abs(dx)>Math.abs(dy)?dx>0?'d':'a':dy>0?'s':'w';
  await page.keyboard.down(key);
  try{await page.waitForFunction(({point,radius})=>{const p=(window as any).__farwind().state.player;return Math.hypot(p.x-point.x,p.y-point.y)<radius*.8;},{point:target.point,radius:target.radius},{timeout:1800});}finally{await page.keyboard.up(key);}
  const inside=await read(page),stillHazard=inside.bossHazards.find((h:any)=>h.id===target.id);expect(stillHazard).toBeDefined();expect(stillHazard.expires).toBeGreaterThan(inside.session.sim);
  expect(Math.hypot(inside.state.player.x-target.point.x,inside.state.player.y-target.point.y)).toBeLessThan(target.radius);checkLayers(inside);
  const insidePng=await page.screenshot({path:`${root}/spikes-player-inside.png`});await writeFile(`${root}/spikes-active.png`,insidePng);expect(errors).toEqual([]);
  await writeFile(`${root}/spikes.json`,JSON.stringify({说明:'隔离初始夹具只固定遭遇种子与玩家起始位置；未修改波次、敌人、伤害、击杀或通关结果。预警来自自然生成的地脉术士正式危险区。',种子:seed,危险区数量:same.length,锁定前后落点:'一致',半径:'一致',错误:errors},null,2));
});
