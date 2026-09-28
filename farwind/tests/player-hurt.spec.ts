import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {initialState} from '../src/game/systems/state';
import {enemyDefs} from '../src/data/world';
const dir='docs/player-hurt/evidence',read=(page:Page)=>page.evaluate(()=>(window as any).__farwind());
async function fixture(page:Page,x=2380,y=1060,hp=100,alive=['slime-1']){
  const s=initialState();s.quest=3;Object.assign(s.player,{x,y,hp});s.killed=enemyDefs.filter(e=>!alive.includes(e.id)).map(e=>e.id);
  await page.goto('/');
  const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入存档',exact:true}).click();
  await(await chooser).setFiles({name:'player-hurt-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(s))});
  await page.waitForFunction(()=>(window as any).__farwind?.().mode==='');
  await page.evaluate(()=>{const w=window as any;w.__hurtFrames=[];const sample=()=>{const s=w.__farwind();w.__hurtFrames.push({时间:s.session.sim,生命:s.state.player.hp,位置:{x:s.state.player.x,y:s.state.player.y},动作:s.animation.hero,战斗:s.session.combat,接触:s.contacts});if(w.__hurtFrames.length>1800)w.__hurtFrames.shift();w.__hurtSampler=requestAnimationFrame(sample);};sample();});
}
async function face(page:Page,d:0|1|2|3){const key=['s','w','a','d'][d];await page.keyboard.down(key);await page.waitForFunction(d=>(window as any).__farwind().animation.hero.direction===d,d);await page.keyboard.up(key);}
async function hit(page:Page){await page.waitForFunction(()=>(window as any).__farwind().session.combat.hurt?.active,null,{polling:'raf',timeout:18000});return read(page);}
async function evidence(page:Page,name:string){const frames=await page.evaluate(()=>{const w=window as any;cancelAnimationFrame(w.__hurtSampler);return w.__hurtFrames;});await writeFile(`${dir}/${name}.json`,JSON.stringify({说明:'合法初始存档通过导入入口设置起点；真实敌人攻击与键盘输入；运行诊断只读。',帧:frames,最终:await read(page)},null,2));return frames;}
test.beforeAll(async()=>mkdir(dir,{recursive:true}));
test.beforeEach(({page})=>{page.on('dialog',d=>d.accept());});
test.afterEach(async({page},info)=>{if(info.status!==info.expectedStatus&&!page.isClosed()){
  await mkdir('.parry-local/player-hurt/failures',{recursive:true});
  const name=info.title.split(' ')[0];await writeFile(`.parry-local/player-hurt/failures/${name}.json`,JSON.stringify({说明:'当次失败首因，不盲目重试',状态:await read(page).catch(()=>null),帧:await page.evaluate(()=>(window as any).__hurtFrames).catch(()=>null)},null,2));
  await page.screenshot({path:`.parry-local/player-hurt/failures/${name}.png`});
}});
// 固定预览四方向与地面根。
test('HURT-01-fixed-preview',async({page})=>{
  await page.goto('/player-hurt-preview.html');await page.waitForFunction(()=>(window as any).__hurtPreview);
  for(const facing of [0,1,2,3])for(const elapsed of [0,80,180]) {
    await page.locator('#direction').selectOption(String(facing));await page.locator('#scrub').fill(String(elapsed));
    const s=await page.evaluate(()=>(window as any).__hurtPreview());expect(s.受击.root).toEqual([500,280]);expect(s.受击.anchor).toEqual([80,154]);expect(s.受击.direction).toBe(facing);expect(s.受击.flip).toBe(facing===2);
    if(elapsed===80)await page.screenshot({path:`${dir}/fixed-facing-${facing}.png`});
  }
});
// 四方向真实接触、14像素击退和恢复。
test('HURT-02-real-four-directions',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  for(const facing of [0,1,2,3] as const) {
    await fixture(page);await face(page,facing);const first=await hit(page),hurt=first.session.combat.hurt;
    expect(first.state.player.hp).toBe(90);expect(hurt.until-hurt.start).toBe(220);expect(first.animation.hero.texture).toBe('hero-hurt');expect(hurt.facing).toBe(facing);
    await page.screenshot({path:`${dir}/runtime-facing-${facing}.png`});
    await page.waitForFunction(()=>(window as any).__farwind().session.combat.hurt?.active===false);
    const end=await read(page);expect(Math.hypot(end.state.player.x-hurt.root.x,end.state.player.y-hurt.root.y)).toBeCloseTo(14,4);
    expect(end.session.invulnerable-hurt.start).toBe(850);expect(end.animation.hero.phase).not.toBe('hurt');
    const frames=await evidence(page,`runtime-facing-${facing}`),hurtFrames=frames.filter((f:any)=>f.战斗.hurt?.active);
    expect(new Set(hurtFrames.map((f:any)=>f.动作.frameIndex))).toEqual(new Set([0,1,2]));
    expect(hurtFrames.every((f:any)=>f.动作.phase==='hurt'&&f.动作.direction===facing&&f.动作.alpha===1&&f.动作.speed===0)).toBe(true);
    await page.keyboard.press('j');await page.waitForFunction(()=>(window as any).__farwind().attackSerial>0);
  }
  expect(errors).toEqual([]);
});
// 硬直丢弃新出招，暂停冻结后正常恢复。
test('HURT-03-paused-inputs',async({page})=>{
  await fixture(page);await face(page,3);const first=await hit(page),hurt=first.session.combat.hurt;
  await page.keyboard.press('j');await page.keyboard.press('k');await page.keyboard.press('l');await page.keyboard.press('Escape');
  const paused=await read(page);expect(paused.session.combat.hurt.active).toBe(true);
  await page.waitForTimeout(300);const frozen=await read(page);expect(frozen.session.sim).toBe(paused.session.sim);expect(frozen.state.player).toEqual(paused.state.player);
  await page.getByRole('button',{name:'继续旅途',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().session.combat.hurt?.active===false);
  const after=await read(page);expect(after.attackSerial).toBe(0);expect(after.session.combat.parrySerial).toBe(0);expect(after.session.combat.dashCooldownRemaining).toBe(0);expect(after.session.combat.buffered).toBe(false);
  expect(Math.hypot(after.state.player.x-hurt.root.x,after.state.player.y-hurt.root.y)).toBeCloseTo(14,4);
  await evidence(page,'paused-inputs');
});
// 成功弹反和风步接触不触发受击。
test('HURT-04-parry-dash-negative',async({page})=>{
  for(const action of ['parry','dash']) {
    await fixture(page);await face(page,3);
    // 向敌人风步会提前接触；需先走过既有40毫秒起步空窗，不能套用站立弹反的晚按时刻。
    await page.waitForFunction(action=>{const s=(window as any).__farwind();return s.warnings.some((w:any)=>w.id.startsWith('slime-1:')&&w.lead!==null&&(action==='parry'?w.lead<65&&w.lead>30:w.lead<130&&w.lead>105));},action,{polling:5,timeout:18000});
    await page.keyboard.press(action==='parry'?'k':'l');
    await page.waitForFunction(()=>{const s=(window as any).__farwind();return s.contacts.some((c:any)=>['normal','perfect','immune'].includes(c.result));},null,{timeout:10000});
    const s=await read(page);expect(s.state.player.hp).toBe(100);expect(s.session.combat.hurt).toBeNull();
    expect(s.contacts.some((c:any)=>action==='parry'?['normal','perfect'].includes(c.result):c.result==='immune')).toBe(true);await evidence(page,`${action}-negative`);
  }
});
// 致死回城及读档清除受击临时状态。
test('HURT-05-death-reload',async({page})=>{
  await fixture(page,2380,1060,10);await page.waitForFunction(()=>{const s=(window as any).__farwind();return s.contacts.some((c:any)=>c.result==='hurt')&&s.state.player.x===670&&s.state.player.y===720;},null,{timeout:18000});
  let s=await read(page);expect(s.state.player.hp).toBe(100);expect(s.session.combat.hurt).toBeNull();expect(s.animation.hero.phase).not.toBe('hurt');
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'保存并返回标题',exact:true}).click();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');
  s=await read(page);expect(s.session.combat.hurt).toBeNull();await evidence(page,'death-reload');
});
// 不同敌人的接触落在保护期内，不延长硬直或再次扣血。
test('HURT-06-multiple-enemies',async({page})=>{
  await fixture(page,2550,1145,100,['slime-1','slime-2']);
  await page.waitForFunction(()=>{const s=(window as any).__farwind();return s.contacts.some((c:any)=>c.result==='hurt')&&s.contacts.some((c:any)=>c.result==='immune');},null,{timeout:18000});
  const s=await read(page),hurt=s.session.combat.hurt;
  expect(s.state.player.hp).toBe(90);expect(s.contacts.filter((c:any)=>c.result==='hurt')).toHaveLength(1);expect(hurt.until-hurt.start).toBe(220);expect(s.session.invulnerable-hurt.start).toBe(850);await evidence(page,'multiple-enemies');
});
// 孢子实际接触也走统一伤害入口。
test('HURT-07-spore-projectile',async({page})=>{
  await fixture(page,2650,1840,100,['spore-1']);await face(page,3);const first=await hit(page),hurt=first.session.combat.hurt;
  expect(first.state.player.hp).toBe(86);expect(first.contacts.at(-1).id).toContain(':spore');
  await page.screenshot({path:`${dir}/runtime-spore.png`});await page.waitForFunction(()=>(window as any).__farwind().session.combat.hurt?.active===false);
  const s=await read(page);expect(Math.hypot(s.state.player.x-hurt.root.x,s.state.player.y-hurt.root.y)).toBeCloseTo(14,4);await evidence(page,'spore-projectile');
});
// 存活受击中保存返回标题；读档和新游戏均不能继承临时效果。
test('HURT-08-session-reset',async({page})=>{
  await fixture(page);await hit(page);await page.keyboard.press('Escape');
  expect((await read(page)).session.combat.hurt.active).toBe(true);
  await page.getByRole('button',{name:'保存并返回标题',exact:true}).click();await page.getByRole('button',{name:'继续旅途',exact:true}).click();
  await page.waitForFunction(()=>(window as any).__farwind().mode==='');expect((await read(page)).session.combat.hurt).toBeNull();
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'保存并返回标题',exact:true}).click();await page.getByRole('button',{name:'启程 · 新游戏',exact:true}).click();await page.getByRole('button',{name:'确认新游戏',exact:true}).click();
  await page.waitForFunction(()=>(window as any).__farwind().mode==='');const s=await read(page);expect(s.session.combat.hurt).toBeNull();expect(s.state.player.hp).toBe(100);expect(s.animation.hero.phase).toBe('idle');
});
