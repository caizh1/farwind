import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {initialState,count} from '../src/game/systems/state';
import {prepareEastRaid} from '../src/game/systems/defense';
import {SERVICE_SIGNS} from '../src/data/maps/windbell/layout';
// 场景编号保持英文以免录像目录出现中文；每项验收说明写入中文诊断。
const dir='docs/combat-feel/demo/validation',read=(p:Page)=>p.evaluate(()=>(window as any).__farwind());
test.use({video:{mode:'on',size:{width:1280,height:720}}});
test.beforeAll(async()=>mkdir(dir,{recursive:true}));
test.afterEach(async({page},info)=>{if(info.status!==info.expectedStatus)await writeFile(`${dir}/${info.title}-${Date.now()}.json`,JSON.stringify({说明:'当次首因快照，保留原始失败。',世界:await read(page).catch(()=>null)},null,2));});
async function reset(p:Page,preset:string,wind=false){await p.goto('/?combatFeel=1');await p.waitForFunction(()=>(window as any).__combatFeel);await p.evaluate(async({preset,wind})=>{await (window as any).__combatFeel.reset(preset,wind);},{preset,wind});await p.waitForFunction(()=>{const s=(window as any).__combatFeel.status();return s.active&&!s.busy&&s.sim>120;});}
async function combo(p:Page){await p.keyboard.press('j');await p.waitForFunction(()=>(window as any).__farwind().session.combat.stage===1);await p.keyboard.press('j');await p.waitForFunction(()=>(window as any).__farwind().session.combat.stage===2);await p.keyboard.press('j');}
async function faceRight(p:Page){const x=(await read(p)).state.player.x;await p.keyboard.down('d');await p.waitForFunction(x=>(window as any).__farwind().state.player.x>x+.5,x);await p.keyboard.up('d');}
// 正式构建不开放反馈诊断；死亡唯一性从正式结算历史验证。
function deaths(s:any){return s.defense.history.filter((e:any)=>e.kind==='death'&&e.id.startsWith('east-raid-'));}
test('input-cleanup',async({page})=>{
 await reset(page,'dummy');const before=await read(page);await page.keyboard.press('l');await page.waitForFunction(()=>{const s=(window as any).__farwind().session.combat;return s.dashRemaining<120&&s.dashRemaining>50;});await page.keyboard.press('j');await expect.poll(async()=>(await read(page)).attackSerial).toBe(before.attackSerial+1);
 await page.keyboard.press('Escape');const paused=await read(page);await page.keyboard.press('j');await page.waitForTimeout(300);expect((await read(page)).session.sim).toBe(paused.session.sim);
 await page.getByRole('button',{name:'继续旅途',exact:true}).click();await page.waitForTimeout(400);expect((await read(page)).attackSerial).toBe(paused.attackSerial);
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));expect((await read(page)).mode).toBe('pause');
 await writeFile(`${dir}/input.json`,JSON.stringify({说明:'真实L、J、Escape；失焦事件只模拟环境清理，不改变战斗结果。',世界:await read(page)},null,2));
});
test('parry-counter-contact',async({page})=>{
 await reset(page,'slime');const before=await read(page);
 await page.waitForFunction(()=>window.__farwind().warnings.some((w:any)=>w.id.startsWith('slime-1')&&w.lead!==null&&w.lead<210&&w.lead>150),null,{polling:5});await page.keyboard.press('k');
 await page.waitForFunction(()=>window.__farwind().feedback.events.some((e:any)=>e.kind==='counter-hit'));
 const settled=await read(page),contact=settled.feedback.events.filter((e:any)=>e.kind==='counter-hit');expect(contact).toHaveLength(1);expect(contact[0].damage).toBeGreaterThan(0);expect(contact[0].sourceId).toBe('player');expect(contact[0].killed).toBe(false);expect(contact[0].sourceContactId).toBeTruthy();expect(settled.state.player.hp).toBe(before.state.player.hp);expect(before.enemies[0].hp-settled.enemies[0].hp).toBe(contact[0].damage);expect(settled.contacts.filter((e:any)=>['normal','perfect'].includes(e.result))).toHaveLength(1);
 await writeFile(`${dir}/parry-counter.json`,JSON.stringify({说明:'真实K输入产生一次正式弹反接触及自动反斩；反馈实际伤害等于目标生命差，没有直接写入结果。',之前:before,结算:settled},null,2));
});
for(const delay of [300,1000])test(`save-delay-${delay}`,async({page})=>{
 await reset(page,'slime');await page.evaluate(delay=>(window as any).__combatFeel.fault(delay,0),delay);
 // 只读有界观察：慢帧和跨进程读取可能让1000ms窗口在断言前结束，保留窗口内的真实模拟与输入。
 await page.evaluate(async()=>{const {saveDiagnostic}=await import('/src/game/systems/save.ts'),w=window as any,started=performance.now();w.__saveProbe={frames:[],keys:[],done:false};let seen=false;
  const key=(e:KeyboardEvent)=>{if(['j','k','l'].includes(e.key.toLowerCase())){w.__saveProbe.keys.push({key:e.key.toLowerCase(),wall:performance.now(),sim:w.__combatFeel.status().sim,saving:saveDiagnostic()});if(w.__saveProbe.keys.length>32)w.__saveProbe.keys.shift();}};window.addEventListener('keydown',key);
  const sample=()=>{const saving=saveDiagnostic();if(saving.writing){seen=true;w.__saveProbe.frames.push({wall:performance.now(),sim:w.__combatFeel.status().sim,saving});if(w.__saveProbe.frames.length>160)w.__saveProbe.frames.shift();}if(seen&&!saving.writing||performance.now()-started>=12000){w.__saveProbe.done=true;window.removeEventListener('keydown',key);}else setTimeout(sample,10);};sample();
 });await combo(page);
 await page.waitForFunction(()=>(window as any).__farwind().enemies.find((e:any)=>e.id==='slime-1')?.hp===0);
 await page.keyboard.press('j');
 const killed=await read(page);expect(killed.feedback.events.filter((e:any)=>e.kind==='kill'&&e.targetId==='slime-1')).toHaveLength(1);
 const sim=killed.session.sim;await page.waitForFunction(sim=>(window as any).__farwind().session.sim>sim+80,sim);const progressing=await read(page);expect(progressing.session.sim).toBeGreaterThan(sim+80);expect(progressing.inputs.some((e:any)=>e.kind==='attack'&&e.at>=killed.feedback.events.find((e:any)=>e.kind==='kill'&&e.targetId==='slime-1').at)).toBe(true);
 if(delay===1000){await page.waitForFunction(()=>{const s=(window as any).__farwind();return s.session.combat.dashLegalAt<=s.session.sim+80;});await page.keyboard.press('l');await page.waitForFunction(()=>(window as any).__farwind().session.combat.dashRemaining>0);await page.keyboard.press('k');}
 await page.waitForFunction(()=>(window as any).__saveProbe.done);const probe=await page.evaluate(()=>(window as any).__saveProbe);
 if(delay===1000){expect(probe.frames.length).toBeGreaterThan(1);expect(Math.max(...probe.frames.map((s:any)=>s.sim))-Math.min(...probe.frames.map((s:any)=>s.sim))).toBeGreaterThan(80);expect(probe.keys.some((k:any)=>k.key==='j'&&k.saving.writing)).toBe(true);}
 await page.waitForFunction(()=>(window as any).__farwind().session.saving.writing===false);await page.keyboard.press('Escape');await page.getByRole('button',{name:'保存旅途',exact:true}).click();await expect(page.locator('#toast')).toContainText('已保存');await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');
 const restored=await read(page);expect(restored.state.killed.filter((id:string)=>id==='slime-1')).toHaveLength(1);expect(restored.state.encounters.groups['east-road-slimes'].members[0].defeated).toBe(true);await writeFile(`${dir}/save-${delay}.json`,JSON.stringify({说明:'初始隔离预设后只用正式三段普攻击杀；写入延迟时模拟与输入继续。窗口内有界只读采样不发送输入、不改变时钟；风步/弹反记录实际时刻，慢帧时可能在存储完成后才到合法取消点。显式保存后刷新。',击杀:killed,推进:progressing,写入窗口:probe,恢复:restored},null,2));
});
test('save-failure',async({page})=>{
 await reset(page,'slime');await page.keyboard.press('Escape');await page.getByRole('button',{name:'保存旅途',exact:true}).click();await expect(page.locator('#toast')).toContainText('已保存');await page.getByRole('button',{name:'继续旅途',exact:true}).click();
 await page.evaluate(()=>(window as any).__combatFeel.fault(300,1));await combo(page);await page.waitForFunction(()=>(window as any).__farwind().state.killed.includes('slime-1'));await expect(page.locator('#toast')).toContainText('保存失败');
 const current=await read(page),disk=await page.evaluate(()=>new Promise<any>((ok,no)=>{const r=indexedDB.open('farwind-combat-feel-isolated',1);r.onsuccess=()=>{const d=r.result,t=d.transaction('states'),get=t.objectStore('states').get('current');get.onsuccess=()=>ok(get.result);t.oncomplete=()=>d.close();};r.onerror=()=>no(r.error);}));expect(disk.killed).not.toContain('slime-1');expect(current.state.killed).toContain('slime-1');expect(current.mode).toBe('');await page.waitForFunction(sim=>(window as any).__farwind().session.sim>sim+80,current.session.sim);
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'保存旅途',exact:true}).click();await expect(page.locator('#toast')).toContainText('已保存');await writeFile(`${dir}/failure.json`,JSON.stringify({说明:'真实IDB写入前故障；旧档保留，内存状态保留，显式保存后完成。',旧档:disk,内存:current},null,2));
});
test('save-session-switch',async({page})=>{
 await reset(page,'slime');await page.evaluate(()=>(window as any).__combatFeel.fault(1000,0));await combo(page);await page.waitForFunction(()=>(window as any).__farwind().state.killed.includes('slime-1')&&(window as any).__farwind().session.saving.writing);
 const oldSerial=(await read(page)).attackSerial;await page.evaluate(()=>{(window as any).__resetDone=false;void (window as any).__combatFeel.reset('guardian',false).then(()=>(window as any).__resetDone=true);});await page.keyboard.press('j');await page.keyboard.press('l');await page.waitForFunction(()=>(window as any).__resetDone);await page.waitForFunction(()=>(window as any).__farwind().session.sim>120);const fresh=await read(page);expect(fresh.attackSerial).toBe(oldSerial);expect(fresh.session.combat.actions).toHaveLength(0);expect(fresh.state.killed).not.toContain('slime-1');expect(fresh.enemies[0].hp).toBe(84);
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'保存旅途',exact:true}).click();await expect(page.locator('#toast')).toContainText('已保存');await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');expect((await read(page)).state.killed).not.toContain('slime-1');await writeFile(`${dir}/session-switch.json`,JSON.stringify({说明:'真实击杀触发旧写入后切换隔离会话；先等旧IDB结束，新会话不补放旧输入；显式保存及刷新确认旧击杀不覆盖新档。',新会话:fresh,恢复:await read(page)},null,2));
});
test('enemy-fixtures',async({page})=>{
 test.setTimeout(90000);
 await reset(page,'group');const threats=await page.evaluate(async()=>{const samples=[],end=performance.now()+30000;while(performance.now()<end){const s=(window as any).__farwind(),now=s.session.sim,active=s.enemies.filter((e:any)=>e.hp>0&&e.attack&&!e.attack.cancelled&&now<e.attack.activeUntil&&Math.hypot(e.x-s.state.player.x,e.y-s.state.player.y)<=340);samples.push({模拟时刻:now,近战:active.filter((e:any)=>e.type!=='spore').length,远程:active.filter((e:any)=>e.type==='spore').length});if(now>=5000)break;await new Promise(ok=>setTimeout(ok,80));}return samples;});await writeFile(`${dir}/threats.json`,JSON.stringify({说明:'持续取样到五秒模拟时间，保留全部取样；另设三十秒墙钟上限，不把慢帧当作敌人饥饿。',取样:threats},null,2));expect(threats.at(-1)!.模拟时刻).toBeGreaterThanOrEqual(5000);expect(Math.max(...threats.map((s:any)=>s.近战))).toBeLessThanOrEqual(1);expect(Math.max(...threats.map((s:any)=>s.远程))).toBeLessThanOrEqual(1);const group=await read(page);expect(group.enemies.filter((e:any)=>e.hp>0).every((e:any)=>e.attackSerial>0||group.feedback.events.some((f:any)=>f.kind==='enemy-charge'&&f.targetId===e.id))).toBe(true);
 await reset(page,'boarWall');await page.waitForFunction(()=>{const e=(window as any).__farwind().enemies[0];return e.attack&&e.attack.locked;});await page.keyboard.down('s');await page.keyboard.press('l');await page.waitForTimeout(450);await page.keyboard.up('s');await page.waitForFunction(()=>(window as any).__farwind().enemies[0].wallHit!==null&&(window as any).__farwind().enemies[0].wallHit!==undefined);const wall=await read(page);expect(wall.enemies[0].hp).toBe(90);await page.screenshot({path:`${dir}/boar-wall.png`});
 await reset(page,'guardian');await page.locator('#combat-numbers').uncheck();await page.locator('#combat-shake').uncheck();await page.locator('#combat-feel-debug summary').click();await combo(page);await page.waitForFunction(()=>(window as any).__farwind().feedback.events.some((e:any)=>e.kind==='guard-break'));const guarded=await read(page);expect(guarded.enemies[0].hp).toBeCloseTo(40.7,5);await page.screenshot({path:`${dir}/no-numbers-no-shake.png`});await writeFile(`${dir}/enemies.json`,JSON.stringify({说明:'无伤害数字和震屏的正式防护/破防；林豕撞墙只由真实树障触发。',威胁取样:threats,群战:group,撞墙:wall,破防:guarded},null,2));
});
// 完整三段普攻加第四段，发射与多目标扣血来自正式键盘输入。
test('wind-multiple-targets',async({page})=>{
 await reset(page,'groupLine',true);await combo(page);await page.waitForFunction(()=>{const s=(window as any).__farwind();return s.session.combat.stage===3&&s.session.attackUntil-s.session.sim<140;});await page.keyboard.press('j');
 await page.waitForFunction(()=>new Set((window as any).__farwind().skillGrowth.contacts.filter((e:any)=>e.kind==='hit').map((e:any)=>e.target)).size>=2);
 const s=await read(page);expect(new Set(s.skillGrowth.contacts.filter((e:any)=>e.kind==='hit').map((e:any)=>e.release)).size).toBe(1);
 await writeFile(`${dir}/wind-multiple.json`,JSON.stringify({说明:'隔离预设明确使用已存在的二阶段双穿，三名现有敌人初始站位和600毫秒冷却；AI、体力、碰撞、普攻、剑风、伤害去重全部正式执行。一阶段原有规则仅命中一个目标，不修改生产参数。',世界:s},null,2));
});

async function importState(page:Page,s:ReturnType<typeof initialState>){page.on('dialog',d=>d.accept());await page.goto('/');const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入存档',exact:true}).click();await(await chooser).setFiles({name:'combat-world-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(s))});await page.waitForFunction(()=>(window as any).__farwind().mode==='');}
test('complete-world-economy',async({page})=>{
 // 沿当前建筑登记建立合法起点；交易和刷新结果仍由正式UI与存档产生，不修改旧地图测试断言。
 const s=initialState(),entry=SERVICE_SIGNS.find(p=>p.id==='service-general')!;Object.assign(s.player,entry.point);
 await importState(page,s);await page.waitForFunction(()=>window.__farwind().target==='service-general');await page.keyboard.press('e');await expect(page.getByRole('heading',{name:'风铃杂货铺',exact:true})).toBeVisible();const paused=await read(page);
 await page.getByLabel('物品',{exact:true}).selectOption('potion');await page.getByRole('button',{name:'核对交易',exact:true}).click();await page.getByRole('button',{name:'确认购买',exact:true}).click();await expect(page.locator('#shop-feedback')).toContainText('交易已完成并保存');const bought=await read(page);
 expect(bought.state.coins).toBe(s.coins-18);expect(bought.state.economyRevision).toBe(s.economyRevision+1);expect(bought.state.shopStock['general:potion']).toBe(s.shopStock['general:potion']-1);expect(count(bought.state,'potion')).toBe(count(s,'potion')+1);expect(bought.state.time).toBe(paused.state.time);
 await page.keyboard.press('Escape');await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await page.waitForFunction(()=>window.__farwind().mode==='');const restored=await read(page);
 expect(restored.state.coins).toBe(bought.state.coins);expect(restored.state.bag).toEqual(bought.state.bag);expect(restored.state.shopStock).toEqual(bought.state.shopStock);expect(restored.state.economyRevision).toBe(bought.state.economyRevision);expect(restored.state.map_version).toBe(s.map_version);
 await writeFile(`${dir}/world-economy-${process.env.COMBAT_PRODUCTION==='1'?'production':'development'}.json`,JSON.stringify({说明:'当前地图正式杂货入口，真实E交互、核对并购买一瓶药剂；原子保存后钱物库存守恒，刷新不回滚或重复交易。预设只建立当前合法起点。',之前:s,交易:bought,刷新:restored},null,2));
});
test('complete-world',async({page})=>{
 // 含两次素材装载；保留单个动作门槛，只给软件渲染的完整保存/刷新流程总时限。
 test.setTimeout(90000);
 const s=initialState();Object.assign(s.player,{x:2130,y:1090});s.xiaobao.task='follow';s.xiaobao.known=true;s.xiaobao.x=2080;s.xiaobao.y=1090;s.skills.swordWindStage=1;s.skills.legacySwordWind=true;s.defense=prepareEastRaid(s.defense,s.player);
 Object.assign(s.player,{x:2290,y:1090});
 await importState(page,s);const before=await read(page);await faceRight(page);await page.keyboard.press('j');await page.waitForTimeout(80);await page.keyboard.press('j');await page.waitForFunction(()=>window.__farwind().defense.history.some((e:any)=>e.kind==='hit'&&e.sourceId==='xiaobao'),null,{timeout:15000});const world=await read(page);expect(world.defense.history.some((e:any)=>e.kind==='hit'&&e.sourceId==='player')).toBe(true);expect(world.state.xiaobao.task).toBe('follow');expect(world.attackSerial).toBeGreaterThan(before.attackSerial);expect(new Set(deaths(world).map((e:any)=>e.id)).size).toBe(deaths(world).length);if(world.feedback)expect(new Set(world.feedback.events.filter((e:any)=>e.kind==='kill').map((e:any)=>e.targetId)).size).toBe(world.feedback.events.filter((e:any)=>e.kind==='kill').length);
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'保存并返回标题',exact:true}).click();await expect(page.getByRole('button',{name:'继续旅途',exact:true})).toBeEnabled();await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');const restored=await read(page);expect(restored.state.xiaobao.task).toBe('follow');expect(restored.state.defense.sequence).toBe(world.state.defense.sequence);await page.screenshot({path:`${dir}/world.png`});
 if(process.env.COMBAT_PRODUCTION==='1')expect(await page.evaluate(()=>typeof(window as any).__combatFeel)).toBe('undefined');await writeFile(`${dir}/world-${process.env.COMBAT_PRODUCTION==='1'?'production':'development'}.json`,JSON.stringify({说明:'导入只设置起点，玩家键鼠和驻防/伙伴AI正式出手；未设置敌人死亡或任务结果。',之前:before,世界:world,刷新:restored},null,2));
});
test('complete-world-guard',async({page})=>{
 test.setTimeout(90000);const s=initialState();Object.assign(s.player,{x:2130,y:1090});s.xiaobao.task='free';s.defense=prepareEastRaid(s.defense,s.player);Object.assign(s.player,{x:2290,y:1090});await importState(page,s);await faceRight(page);await page.keyboard.press('j');await page.waitForFunction(()=>window.__farwind().defense.history.some((e:any)=>e.kind==='death'&&e.sourceId!=='player'),null,{timeout:60000});const world=await read(page);expect(world.defense.history.some((e:any)=>e.kind==='hit'&&e.sourceId==='player')).toBe(true);expect(deaths(world).some((e:any)=>e.sourceId!=='player'&&e.sourceId!=='xiaobao')).toBe(true);if(world.feedback)expect(world.feedback.events.some((e:any)=>e.kind==='kill'&&e.sourceId!=='player'&&e.sourceId!=='xiaobao')).toBe(true);expect(new Set(deaths(world).map((e:any)=>e.id)).size).toBe(deaths(world).length);if(world.feedback)expect(new Set(world.feedback.events.filter((e:any)=>e.kind==='kill').map((e:any)=>e.targetId)).size).toBe(world.feedback.events.filter((e:any)=>e.kind==='kill').length);await writeFile(`${dir}/world-guard-${process.env.COMBAT_PRODUCTION==='1'?'production':'development'}.json`,JSON.stringify({说明:'已进入接近阶段的合法存档初始条件；玩家真实第一刀，守卫正式AI补刀，结果反馈与死亡仍只结算一次。未降低伙伴数值，另场完整世界覆盖随行。',世界:world},null,2));
});
test('complete-world-death',async({page})=>{
 test.setTimeout(90000);
 const s=initialState();Object.assign(s.player,{x:2130,y:1090,hp:5});s.xiaobao.task='free';s.defense=prepareEastRaid(s.defense,s.player);Object.assign(s.player,{x:2290,y:1090});
 await importState(page,s);
 // 同一帧的抵达提示会替换回城文字；读取真实DOM变更而不把最终提示当成伤害权威。
 await page.evaluate(()=>{const w=window as any;w.__returnMessages=[];w.__returnObserver=new MutationObserver(records=>{for(const record of records){for(const node of [...record.addedNodes,...record.removedNodes])if(node.textContent)w.__returnMessages.push(node.textContent);if(record.oldValue)w.__returnMessages.push(record.oldValue);}w.__returnMessages=w.__returnMessages.slice(-30);});w.__returnObserver.observe(document.querySelector('#toast'),{childList:true,subtree:true,characterData:true,characterDataOldValue:true});});
 await page.waitForFunction(()=>{const s=(window as any).__farwind();return s.state.player.x===670&&s.state.player.y===720&&s.state.player.hp===100;},null,{timeout:60000});
 const messages=await page.evaluate(()=>{const w=window as any;w.__returnObserver.disconnect();return w.__returnMessages as string[];});expect(messages.some(m=>m.includes('岚爷爷把你带回广场'))).toBe(true);
 const returned=await read(page);expect(returned.state.player.hp).toBe(100);expect(returned.state.bag).toEqual(s.bag);
 if(returned.session){expect(returned.contacts.some((e:any)=>e.result==='hurt'&&e.hp===0)).toBe(true);expect(returned.session.combat.hurt).toBeNull();expect(returned.session.combat.actions).toHaveLength(0);}
 await page.keyboard.press('j');await expect.poll(async()=>(await read(page)).attackSerial).toBeGreaterThan(returned.attackSerial);
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'保存并返回标题',exact:true}).click();await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');
 const restored=await read(page);expect(restored.state.player.hp).toBe(100);expect(restored.state.bag).toEqual(s.bag);expect(restored.state.defense.sequence).toBe(s.defense.sequence);
 await writeFile(`${dir}/world-death-${process.env.COMBAT_PRODUCTION==='1'?'production':'development'}.json`,JSON.stringify({说明:'低血存档仅建立初始条件；实际史莱姆接触致死，正式回城恢复、再按攻击、显式保存与刷新。没有写死死亡结果或额外补血。',真实提示变更:messages,回城:returned,恢复:restored},null,2));
});
