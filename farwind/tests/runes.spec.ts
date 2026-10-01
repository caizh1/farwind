import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {RUNE_LOADOUTS} from '../src/data/runes';
import {HOMES} from '../src/data/npcLife';
import {VILLAGE_ANCHORS} from '../src/data/maps/windbell/layout';
import {move} from './map-navigation';
const directory=process.env.RUNE_EVIDENCE_DIRECTORY??'docs/runes/evidence';
const read=(p:Page)=>p.evaluate(()=>(window as any).__farwind());
const labRead=(p:Page)=>p.evaluate(()=>(window as any).__runeLab.snapshot());
function concise(value:any):any{if(Array.isArray(value))return value.map(concise);if(!value||typeof value!=='object')return value;const out:any={};for(const [k,v] of Object.entries(value)){if(k==='世界'){const s=(v as any).state;out.世界={玩家:s.player,符文:s.runes,技能:s.skills,任务:s.quest,装备:s.equipment,金币:s.coins,预警:(v as any).warnings,接触:(v as any).contacts,保存:(v as any).session?.saving};}else out[k]=concise(v);}return out;}
async function evidence(page:Page,name:string,record:unknown){await mkdir(directory,{recursive:true});await page.screenshot({path:`${directory}/${name}.png`});await writeFile(`${directory}/${name}.json`,JSON.stringify({说明:'真实浏览器运行；状态仅用于读取诊断，推进通过正式键鼠。试验场只提供公开的隔离初始条件，正常获取另行验证。',记录:concise(record)},null,2));}
async function reset(page:Page,build:string,target='dummy',wind=true){await page.goto('/?runeLab=1');await page.locator('#rune-lab-build').selectOption(build);await page.locator('#rune-lab-target').selectOption(target);await page.locator('#rune-lab-wind').setChecked(wind);await page.locator('#rune-lab-reset').click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');await page.locator('#rune-lab-close').click();}
async function attacks(page:Page,count:number,delay=155){for(let i=0;i<count;i++){await page.keyboard.press('j');await page.waitForTimeout(delay);}}
test('rune-equipment',async({page})=>{
 await reset(page,'slice');await page.keyboard.press('r');await expect(page.locator('[data-active-duo="d01"]')).toHaveCount(1);
 await page.locator('[data-rune-id="r08"]').dragTo(page.locator('[data-rune-slot="3"]'));await page.waitForFunction(()=>(window as any).__farwind().state.runes.slots[3]==='r08');
 await expect(page.locator('[data-active-duo="d13"]')).toHaveCount(1);await page.locator('[data-preset-save="0"]').click();await page.waitForFunction(()=>(window as any).__farwind().state.runes.presets[0].slots[3]==='r08');
 await page.locator('[data-rune-slot="3"]').click();await page.locator('#rune-remove').click();await page.waitForFunction(()=>(window as any).__farwind().state.runes.slots[3]===null);await page.locator('[data-preset-load="0"]').click();await page.waitForFunction(()=>(window as any).__farwind().state.runes.slots[3]==='r08');
 await page.locator('#rune-tier').selectOption('legend');await expect(page.locator('.rune-card')).toHaveCount(5);await page.locator('#rune-fixed').click();await expect(page.locator('.rune-detail')).toContainText('永久绑定');
 await evidence(page,'equipment-wide',await read(page));await page.setViewportSize({width:590,height:820});await expect(page.locator('.rune-panel')).toBeVisible();const width=await page.locator('.rune-panel').evaluate(e=>({client:e.clientWidth,scroll:e.scrollWidth}));expect(width.scroll).toBeLessThanOrEqual(width.client+2);await evidence(page,'equipment-narrow',width);
 await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');expect((await read(page)).state.runes.slots[3]).toBe('r08');
 const dbs=await page.evaluate(async()=>(await indexedDB.databases()).map(d=>d.name));expect(dbs).toContain('farwind-rune-lab-isolated');expect(dbs).not.toContain('farwind-first-map');
});
for(const index of [0,1,2,3,4,5])test(`rune-combo-${index}`,async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await reset(page,'build-'+index);const samples:any[]=[];let captured=false;
 for(let i=0;i<70;i++){await page.keyboard.press('j');await page.waitForTimeout(155);if(i%4===3){const sample=await labRead(page);samples.push(sample);const visiblePeak=index===5?sample.符文.effects.some((f:any)=>f.visual==='sword-domain')&&sample.符文.fields.length>0:index===3?sample.符文.fields.some((f:any)=>f.kind==='mist'&&sample.符文.clock-f.born>900):index===2?sample.符文.projectiles.some((p:any)=>p.kind==='vortex'&&sample.符文.clock-p.born>200):index===4?sample.符文.statuses['training-dummy']?.poison?.stacks===11:sample.符文.effects.some((f:any)=>f.visual==='storm-wave'&&sample.符文.clock-f.born>60);if(!captured&&visiblePeak){await page.screenshot({path:`${directory}/combo-${index}-peak.png`});captured=true;}}}
 const final=await labRead(page),events=final.符文.events;expect(final.符文.metrics.native).toBeGreaterThan(10);expect(final.符文.metrics.damage).toBeGreaterThan(300);expect(errors).toEqual([]);
 const tags=new Set(events.flatMap((e:any)=>e.tags));
 if(index===0){expect(tags.has('tide_hit')).toBe(true);expect(tags.has('lightning_hit')).toBe(true);}
 if(index===1){await page.keyboard.press('j');await page.waitForTimeout(150);await page.keyboard.press('l');await page.waitForTimeout(350);const after=await labRead(page);expect(after.符文.events.some((e:any)=>e.sourceDuoId==='d02')).toBe(true);samples.push(after);}
 if(index===2){expect(tags.has('vortex_hit')).toBe(true);expect(samples.some(s=>s.符文.events.some((e:any)=>e.tags.includes('vortex_hit')&&e.critical))).toBe(true);expect(samples.some(s=>s.符文.statuses['training-dummy']?.chill)).toBe(true);}
 if(index===3){expect(tags.has('mist_tick')).toBe(true);expect(events.some((e:any)=>e.sourceDuoId==='d05')).toBe(true);expect(tags.has('poison_tick')).toBe(true);}
 if(index===4){expect(final.符文.statuses['training-dummy'].poison.stacks).toBe(11);expect(tags.has('seeking_projectile_hit')).toBe(true);}
 if(index===5){expect(final.符文.cooldowns.r26).toBeGreaterThan(0);expect(final.符文.cooldowns.r27).toBeGreaterThan(0);expect(final.符文.cooldowns.r28).toBeGreaterThan(0);expect(tags.has('seeking_projectile_hit')).toBe(true);expect(events.some((e:any)=>e.sourceDuoId==='d14')).toBe(true);}
 // 从过程中选择实际存在场域的帧记录，截图仍由正在运行的浏览器直接捕获。
 await evidence(page,'combo-'+index,{最终:final,过程:samples,异常:errors});
});
test('rune-boss-phoenix',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await reset(page,'build-5','boss');const initial=await labRead(page),samples:any[]=[];expect(initial.敌人[0].hp).toBeGreaterThan(1000);
 // 先接受首领的正式攻击到致命命中；不修改生命或模拟伤害。
 let s=initial;for(let i=0;i<220&&!s.符文.metrics.phoenix;i++){await page.waitForTimeout(250);s=await labRead(page);if(i%8===0)samples.push(s);}
 expect(s.符文.metrics.phoenix).toBe(1);expect(s.符文.temporary.feathers).toBe(3);expect(s.世界.state.player.hp).toBeGreaterThan(0);await evidence(page,'phoenix-boss',s);
 const immortal=s.符文.clock;await page.waitForTimeout(400);s=await labRead(page);expect(s.符文.clock-immortal).toBeLessThan(1500);expect(s.符文.temporary.feathers).toBe(3);
 // 先根据正式危险提示完成完美格挡，再连续输入三连，避免诊断采样把连击窗口拖断。
 const triggered=new Set<string>(['r30']);let peaked=false;
 for(let i=0;i<220&&!s.符文.cooldowns.r29;i++){
  const state=await read(page),e=state.enemies.find((e:any)=>e.hp>0&&e.behavior.boss),p=state.state.player;expect(e).toBeTruthy();if(p.hp<55)await page.keyboard.press('1');
  const dx=e.x-p.x,dy=e.y-p.y,key=Math.abs(dx)>Math.abs(dy)?dx<0?'a':'d':dy<0?'w':'s';await page.keyboard.down(key);await page.waitForTimeout(Math.hypot(dx,dy)>82?45:8);await page.keyboard.up(key);
  const fresh=await read(page);if(fresh.warnings.some((w:any)=>w.quality==='perfect'&&w.lead>=25&&w.lead<130))await page.keyboard.press('k');await page.waitForTimeout(45);s=await labRead(page);if(i%8===0)samples.push(s);
 }
 expect(s.符文.cooldowns.r29).toBeGreaterThan(0);triggered.add('r29');await evidence(page,'legend-time',s);
 for(let i=0;i<140;i++){
  if(i%6===0){const state=await read(page),e=state.enemies.find((e:any)=>e.hp>0&&e.behavior.boss),p=state.state.player;if(!e)break;if(p.hp<65)await page.keyboard.press('1');const dx=e.x-p.x,dy=e.y-p.y,key=Math.abs(dx)>Math.abs(dy)?dx<0?'a':'d':dy<0?'w':'s';await page.keyboard.down(key);await page.waitForTimeout(Math.hypot(dx,dy)>85?90:8);await page.keyboard.up(key);}
  await page.keyboard.press('j');await page.waitForTimeout(155);
  if(i%6===5){s=await labRead(page);samples.push(s);for(const id of ['r26','r27','r28','r29','r30'])if(s.符文.cooldowns[id]>0)triggered.add(id);if(!peaked&&s.符文.effects.some((f:any)=>f.visual==='sword-domain')){await page.screenshot({path:`${directory}/legend-boss-peak.png`});peaked=true;}if(triggered.size===5&&s.符文.metrics.prevented>0)break;}
 }
 await evidence(page,'legend-boss',{最终:s,过程:samples,已触发:[...triggered],异常:errors});expect(errors).toEqual([]);expect(s.敌人[0].hp).toBeLessThan(initial.敌人[0].hp);expect(s.符文.metrics.prevented).toBeGreaterThan(0);expect([...triggered].sort()).toEqual(['r26','r27','r28','r29','r30']);
 await page.keyboard.press('Escape');const cooldown=(await read(page)).state.runes.cooldowns.r30;await page.locator('#save').click();await page.waitForTimeout(250);await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');expect((await read(page)).state.runes.cooldowns.r30).toBeGreaterThan(cooldown-2000);
});
test('rune-normal-acquisition',async({page})=>{
 await page.goto('http://127.0.0.1:5197/');await page.getByRole('button',{name:'启程 · 新游戏',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');expect((await read(page)).state.runes.owned).toEqual([]);
 await move(page,380,1335);expect((await read(page)).target).toBe('wood-v1');await page.keyboard.press('e');await page.waitForFunction(()=>(window as any).__farwind().state.runes.owned.includes('r01'));
 await move(page,580,1520);expect((await read(page)).target).toBe('village-chest');await page.keyboard.press('e');await page.waitForFunction(()=>(window as any).__farwind().state.runes.owned.includes('r04'));
 await move(page,VILLAGE_ANCHORS.general.x,VILLAGE_ANCHORS.general.y+65);await page.keyboard.press('e');await page.locator('[data-flow="runes"]').click();await page.locator('[data-rune-buy="r08"]').click();await page.waitForFunction(()=>(window as any).__farwind().state.runes.owned.includes('r08'));await page.keyboard.press('Escape');
 await page.keyboard.press('r');await page.locator('[data-rune-id="r01"]').click();await page.locator('#rune-equip').click();await page.waitForFunction(()=>(window as any).__farwind().state.runes.slots[0]==='r01');await page.locator('[data-rune-slot="1"]').click();await page.locator('[data-rune-id="r08"]').click();await page.locator('#rune-equip').click();await page.waitForFunction(()=>(window as any).__farwind().state.runes.slots[1]==='r08');await evidence(page,'normal-acquisition',await read(page));await page.keyboard.press('Escape');
 await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');expect((await read(page)).state.runes.slots.slice(0,2)).toEqual(['r01','r08']);expect((await read(page)).state.skills.swordWindStage).toBe(0);
 const before=(await read(page)).state.player;await page.keyboard.down('g');await page.waitForTimeout(550);await page.keyboard.press('d');await page.keyboard.up('g');expect((await read(page)).state.runes.cooldowns['return-wind']??0).toBe(0);
 await page.keyboard.down('g');await page.waitForFunction(()=>(window as any).__farwind().state.runes.cooldowns['return-wind']>0);await page.waitForTimeout(600);await page.keyboard.up('g');const end=await read(page);expect(end.state.player.hp).toBe(before.hp);expect(Math.hypot(end.state.player.x-670,end.state.player.y-720)).toBeLessThan(5);await evidence(page,'return-wind',end);
});
test('rune-stress',async({page})=>{
 await reset(page,'build-5','crowd');const runs:any[]=[];await attacks(page,60);runs.push(await labRead(page));
 for(let i=0;i<5;i++){await page.locator('#rune-lab summary').click();await page.locator('#rune-lab-build').selectOption(i%2?'build-3':'build-5');await page.locator('#rune-lab-reset').click();await page.waitForTimeout(100);await page.locator('#rune-lab-close').click();await attacks(page,24);runs.push(await labRead(page));}
 const count=runs.map(s=>s.对象数);expect(Math.max(...count)-Math.min(...count)).toBeLessThan(120);expect(runs.every(s=>s.符文.pending<120&&s.符文.effects.length<=256)).toBe(true);
 await evidence(page,'stress',{轮次:runs,浏览器:page.context().browser()?.version(),说明:'本机 Chromium + Metal，1280×720，录像开启，正常模拟速度；原始帧保留慢帧，仅为短测，不能宣称稳定帧率或零泄漏。'});
});

test('rune-production-isolation',async({page})=>{
 await page.goto('http://127.0.0.1:5197/?runeLab=1');await expect(page.locator('#rune-lab')).toHaveCount(0);expect(await page.evaluate(()=>typeof (window as any).__runeLab)).toBe('undefined');await page.getByRole('button',{name:'启程 · 新游戏',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');const state=(await read(page)).state;expect(state.runes.owned).toEqual([]);expect(state.skills.swordWindStage).toBe(0);await evidence(page,'production-isolation',state.runes);
});


test('rune-room-lifecycle',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await reset(page,'r26');await attacks(page,32);const active=await labRead(page);expect(active.符文.temporary.domain).toBeGreaterThan(active.符文.clock);
 // 木桩近战停在底座边缘；先正常向南走出导航脚部安全边距。
 await page.keyboard.down('s');await page.waitForTimeout(320);await page.keyboard.up('s');
 const door=HOMES.find(h=>h.id==='healer-home')!.door;await move(page,door.x,door.y+60);await page.keyboard.press('e');let state=await read(page);if(state.mode==='dialog'){await page.getByRole('button',{name:'继续 · E',exact:true}).click();await page.keyboard.press('e');}
 await page.waitForFunction(()=>(window as any).__farwind().state.life.playerSpace==='healer-home');const inside=await labRead(page);expect(inside.符文.pending).toBe(0);expect(inside.符文.projectiles).toHaveLength(0);expect(inside.符文.fields).toHaveLength(0);expect(inside.符文.temporary.domain).toBe(0);expect(inside.符文.cooldowns.r26).toBeGreaterThan(0);
 await page.waitForTimeout(8200);const hp=(await read(page)).state.player.hp;await page.keyboard.down('g');await page.waitForFunction(()=>(window as any).__farwind().state.life.playerSpace==='village'&&(window as any).__farwind().state.runes.cooldowns['return-wind']>0);await page.keyboard.up('g');await page.waitForTimeout(550);const end=await labRead(page);expect(end.世界.state.player.hp).toBe(hp);expect(Math.hypot(end.世界.state.player.x-670,end.世界.state.player.y-720)).toBeLessThan(5);expect(errors).toEqual([]);await evidence(page,'room-lifecycle',{进入前:active,室内:inside,归风后:end,异常:errors});
});

// 原画与真实界面分开验收：逐一解码正式图片，并比对生产服务返回的文件哈希。
test('rune-build-painted-icons',async({page})=>{
 const output='docs/combat-build/rune-art/evidence',errors:string[]=[];
 await mkdir(output,{recursive:true});page.on('pageerror',e=>errors.push(e.message));
 await reset(page,'r31');await page.keyboard.press('r');
 for(const [i,id] of ['r31','r32','r33'].entries()){
  await page.locator(`[data-rune-slot="${i}"]`).click();await page.locator(`[data-rune-id="${id}"]`).click();
  await expect(page.locator('.rune-detail image')).toHaveAttribute('href',`/assets/runes/painted/${id}.webp`);
  await page.locator('#rune-equip').click();await page.waitForFunction(({i,id})=>(window as any).__farwind().state.runes.slots[i]===id,{i,id});
  await page.locator('.rune-panel').evaluate(e=>{e.scrollTop=0;});
  await page.screenshot({path:`${output}/${id}-detail.png`});
 }
 await page.keyboard.press('Escape');await page.keyboard.down('i');await page.waitForTimeout(700);await page.keyboard.up('i');
 await page.keyboard.down('d');await page.waitForTimeout(180);await page.keyboard.up('d');
 await expect(page.locator('#rune-hud svg image')).toHaveCount(4);
 await page.screenshot({path:`${output}/hud.png`});await page.keyboard.press('r');
 const widths=[];
 for(const width of [590,390]){
  await page.setViewportSize({width,height:844});
  const bounds=await page.locator('.rune-panel').evaluate(e=>({可视宽度:e.clientWidth,内容宽度:e.scrollWidth}));
  expect(bounds.内容宽度).toBeLessThanOrEqual(bounds.可视宽度+2);widths.push({屏幕宽度:width,...bounds});
  await page.screenshot({path:`${output}/narrow-${width}.png`});
 }
 expect(errors).toEqual([]);
 await writeFile(`${output}/validation.json`,JSON.stringify({说明:'隔离图标验收，正式收藏/详情/装备/HUD及真实按住施放。不是正常解锁证据；未改变正式存档。',窄屏:widths,页面异常:errors,结果:'通过'},null,2));
});

test('rune-painted-icons',async({page})=>{
 const output='docs/runes/painted-icons',errors:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 await mkdir(output,{recursive:true});await reset(page,'build-5');await page.keyboard.press('r');
 await expect(page.locator('.rune-panel')).toBeVisible();
 const original=JSON.parse(await readFile(`${output}/manifest.json`,'utf8'));
 const added=JSON.parse(await readFile('docs/combat-build/rune-art/manifest.json','utf8'));
 const manifest={图片:[...original.图片,...added.图片]};
 expect(manifest.图片).toHaveLength(34);
 const audit=await page.evaluate(async()=>{
  const icons=[...document.querySelectorAll<SVGElement>('svg[data-rune-art]')];
  const cards=[...document.querySelectorAll<SVGElement>('.rune-card>svg')];
  const paths=[...new Set(icons.map(e=>e.querySelector('image')?.getAttribute('href')))];
  const images=await Promise.all(paths.map(async path=>{
   const image=new Image();image.src=path!;await image.decode();
   const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
   const context=canvas.getContext('2d')!;context.drawImage(image,0,0);
   return {路径:path,尺寸:[image.naturalWidth,image.naturalHeight],角透明度:context.getImageData(0,0,1,1).data[3]};
  }));
  return {图鉴数量:cards.length,品阶:cards.reduce((result,e)=>{const tier=e.dataset.runeTier!;result[tier]=(result[tier]??0)+1;return result;},{} as Record<string,number>),
   绘制模式:[...new Set(icons.map(e=>e.dataset.runeArt))],图片:images,
   界面图标数量:icons.length,缺少图片:icons.filter(e=>e.querySelectorAll('image').length!==1).length,
   重画能力形体:icons.filter(e=>e.querySelector('defs')).length,
   固定归风:document.querySelector<SVGElement>('#rune-fixed svg')!.dataset.runeTier};
 });
 expect(audit.图鉴数量).toBe(33);expect(audit.品阶).toEqual({low:13,mid:8,high:7,legend:5});
 expect(audit.绘制模式).toEqual(['painted-v3']);expect(audit.缺少图片).toBe(0);
 expect(audit.重画能力形体).toBe(0);expect(audit.固定归风).toBe('fixed');
 expect(audit.图片).toHaveLength(34);
 for(const image of audit.图片){expect(image.尺寸).toEqual([512,512]);expect(image.角透明度).toBe(0);}
 const files=[];
 for(const item of manifest.图片){
  const response=await page.request.get(`http://127.0.0.1:5197/assets/runes/painted/${item.符文}.webp`);
  expect(response.status()).toBe(200);
  const hash=createHash('sha256').update(await response.body()).digest('hex');
  expect(hash).toBe(item.正式图片哈希);files.push({符文:item.符文,生产图片哈希:hash,状态:response.status()});
 }
 await page.locator('[data-rune-id="r01"]').click();await page.screenshot({path:`${output}/runtime-wide.png`});
 for(const [tier,id,count] of [['low','r01',13],['mid','r11',8],['high','r19',7],['legend','r27',5]] as const){
  await page.locator('#rune-tier').selectOption(tier);await expect(page.locator('.rune-card')).toHaveCount(count);
  await page.locator(`[data-rune-id="${id}"]`).click();await page.screenshot({path:`${output}/runtime-${tier}.png`});
 }
 await page.locator('#rune-fixed').click();await page.screenshot({path:`${output}/runtime-return.png`});
 await page.locator('#rune-tier').selectOption('');
 for(const [i,id] of ['r01','r11','r19','r27'].entries()){
  await page.locator(`[data-rune-slot="${i}"]`).click();await page.locator(`[data-rune-id="${id}"]`).click();
  await page.locator('#rune-equip').click();await page.waitForFunction(({i,id})=>(window as any).__farwind().state.runes.slots[i]===id,{i,id});
 }
 await page.keyboard.press('Escape');await attacks(page,45);
 const hud=await page.locator('#rune-hud').evaluate(e=>({品阶:[...e.querySelectorAll<SVGElement>('svg')].map(s=>s.dataset.runeTier),
  图片数量:e.querySelectorAll('svg image').length,冷却扇面:e.querySelectorAll('svg path[fill="#e4d0a4"],svg circle[fill="#e4d0a4"]').length,
  图标尺寸:[...e.querySelectorAll('svg')].map(s=>s.getBoundingClientRect().width)}));
 expect(hud.品阶).toEqual(['low','mid','high','legend','legend','fixed']);expect(hud.图片数量).toBe(6);
 expect(hud.冷却扇面).toBeGreaterThan(0);expect(hud.图标尺寸).toEqual([34,34,34,34,34,34]);
 await page.screenshot({path:`${output}/runtime-hud.png`});
 await page.keyboard.press('r');await page.locator('.rune-panel').waitFor({state:'visible'});
 const widths=[];
 for(const width of [590,390]){
  await page.setViewportSize({width,height:844});
  const bounds=await page.locator('.rune-panel').evaluate(e=>({可视宽度:e.clientWidth,内容宽度:e.scrollWidth}));
  expect(bounds.可视宽度).toBeGreaterThan(0);expect(bounds.内容宽度).toBeLessThanOrEqual(bounds.可视宽度+2);
  widths.push({屏幕宽度:width,...bounds});await page.screenshot({path:`${output}/runtime-narrow-${width}.png`});
 }
 expect(errors).toEqual([]);
 await writeFile(`${output}/runtime-validation.json`,JSON.stringify({说明:'真实浏览器图鉴、四品阶筛选、生产图片哈希、正式装备与真实攻击后的冷却扇面、窄屏检查；未修改游戏状态或模拟命中。',
  图鉴:audit,生产文件:files,HUD:hud,窄屏:widths,页面错误:errors,结果:'通过'},null,2));
});
