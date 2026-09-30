import {expect,test,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {initialState,add} from '../src/game/systems/state';
import {CAMP_BOSSES,BOSS_RULES} from '../src/data/maps/windbell/campBosses';
import {ENCOUNTERS} from '../src/data/maps/windbell/encounters';
import {syncMapGeometry} from '../src/data/world';
import {move} from './map-navigation';
import {fight} from './field-combat';

const dir=`.enemy-local/pursuit/evidence-v2-${Date.now()}`;
const sample=(page:Page)=>page.evaluate(()=>{
  const s=(window as any).__farwind(),live=s.enemies.find((e:any)=>e.id==='wild-margin-slime'),e=live??s.state.encounters.groups['south-reed-margin'].members[0];
  return {玩家:{x:s.state.player.x,y:s.state.player.y,hp:s.state.player.hp},敌人:{x:e.x,y:e.y,hp:e.hp,休眠:!live},界面:s.mode};
});
async function walkTo(page:Page,x:number,key:'a'|'d'){
  await page.keyboard.down(key);
  try{await page.waitForFunction(({x,key})=>{
    const p=(window as any).__farwind().state.player;return key==='d'?p.x>=x:p.x<=x;
  },{x,key},{timeout:20000});}
  finally{await page.keyboard.up(key);}
}
// 场景编号使用英文，避免浏览器录像与错误目录生成中文文件名。
test('pursuit-gameplay',async({page})=>{
  test.info().annotations.push({type:'说明',description:'正式地图真实步行、超出旧边界追击、保存恢复与脱战返家'});
  await mkdir(dir,{recursive:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  // 合法固定存档只提供近敌起点；怪物坐标、AI、移动、战斗和返家结果均不改写。
  const state=initialState();Object.assign(state.player,{x:270,y:2150});state.xiaobao.task='free';state.encounters.groups['south-reed-margin'].activated=true;
  await page.goto('/');const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入存档',exact:true}).click();
  await(await chooser).setFiles({name:'pursuit-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({说明:'南部芦边史莱姆的合法近敌初始条件，之后只用真实键盘操作。',...state}))});
  await page.waitForFunction(()=>(window as any).__farwind?.().mode===''&&(window as any).__farwind().enemies.some((e:any)=>e.id==='wild-margin-slime'));
  const before=await sample(page);await walkTo(page,-180,'a');const separated=await sample(page);
  expect(Math.hypot(separated.玩家.x-separated.敌人!.x,separated.玩家.y-separated.敌人!.y)).toBeGreaterThan(380);
  const enemyX=separated.敌人!.x;await page.waitForFunction(x=>(window as any).__farwind().enemies.find((e:any)=>e.id==='wild-margin-slime').x<x-30,enemyX);
  await walkTo(page,-600,'a');await page.waitForFunction(()=>(window as any).__farwind().enemies.find((e:any)=>e.id==='wild-margin-slime').x<500-950,{},{timeout:30000});
  await page.screenshot({path:`${dir}/extended-chase.png`});await page.keyboard.press('Escape');const extended=await sample(page);
  await page.getByRole('button',{name:'保存旅途',exact:true}).click();await expect(page.locator('#toast')).toContainText('已保存');
  await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');
  const restored=await sample(page);expect(restored.敌人!.x).toBeLessThan(500-900);expect(restored.敌人!.hp).toBe(extended.敌人!.hp);
  await walkTo(page,-1250,'a');const withdrawn=await sample(page);
  await page.waitForFunction(()=>{
    const s=(window as any).__farwind(),e=s.enemies.find((e:any)=>e.id==='wild-margin-slime')??s.state.encounters.groups['south-reed-margin'].members[0];return e.hp>0&&Math.hypot(e.x-500,e.y-2150)<=8;
  },null,{timeout:50000});
  await page.keyboard.press('Escape');const returned=await sample(page);await page.screenshot({path:`${dir}/returned-home.png`});
  const report={说明:'正式构建、完整真实地图。导入固定合法起点后，只用键盘步行、暂停、保存和继续。未直接修改敌人位置、仇恨或通关进度；返家必须在玩家仍停留于撤离点且未受伤的情况下完成。',结果:'待断言',开始:before,拉开距离:separated,超过旧家园边界:extended,保存恢复:restored,实际撤离:withdrawn,返家:returned,页面错误:errors};
  await writeFile(`${dir}/gameplay.json`,JSON.stringify(report,null,2));
  // 松键事件在下一模拟帧消费，允许不足两帧的自然位移；重生回村仍会明确失败。
  expect(returned.敌人!.hp).toBe(restored.敌人!.hp);expect(Math.abs(returned.玩家.x-withdrawn.玩家.x)).toBeLessThanOrEqual(5);expect(returned.玩家.y).toBe(2150);expect(returned.玩家.hp).toBe(before.玩家.hp);expect(errors).toEqual([]);
  report.结果='通过';await writeFile(`${dir}/gameplay.json`,JSON.stringify(report,null,2));
});

test('boss-pursuit-gameplay',async({page})=>{
  test.info().annotations.push({type:'说明',description:'真实清理驻守、首领入场、长距离追击、保存恢复和真正撤战'});
  syncMapGeometry(false);await mkdir(dir,{recursive:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  const camp=ENCOUNTERS.find(d=>d.id==='south-spore-camp')!,state=initialState();Object.assign(state.player,{x:1450,y:2820});state.xiaobao.task='free';state.encounters.groups[camp.id].activated=true;
  // 固定存档只提供据点附近的起点、普通铁剑和药剂；所有杂兵和首领都保持未清除。
  add(state,'ironSword',1);add(state,'potion',15);state.equipment.weapon='ironSword';
  await page.goto('/');const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入存档',exact:true}).click();
  await(await chooser).setFiles({name:'boss-pursuit-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({说明:'只提供据点近旁的装备起点，不写死亡、清剿或首领战阶段；之后正常攻击与步行。',...state}))});
  await page.waitForFunction(()=>(window as any).__farwind?.().mode==='');await fight(page,camp.members.filter(m=>!m.boss).map(m=>m.id));
  await page.waitForFunction(()=>(window as any).__farwind().enemies.some((e:any)=>e.id==='boss-spore-heart'&&e.hp>0));
  const read=()=>page.evaluate(()=>{const s=(window as any).__farwind(),e=s.enemies.find((e:any)=>e.id==='boss-spore-heart');return {玩家:{...s.state.player},首领:e&&{x:e.x,y:e.y,hp:e.hp,动作:e.ai},据点:s.state.encounters.groups['south-spore-camp'],界面:s.mode,时钟:s.skillGrowth.sim};});
  const entered=await read();
  for(const [x,y] of [[1000,2450],[1050,2040],[500,2150],[-150,2150]]){const s=await read();if(s.玩家.hp<65)await page.keyboard.press('1');await move(page,x,y);}
  const separated=await read();expect(separated.据点.boss.attempt).toBe(entered.据点.boss.attempt);expect(separated.据点.boss.stage).toBe('battle');
  await expect(page.locator('#camp-boss-status')).toBeVisible();
  expect(Math.hypot(separated.玩家.x-separated.首领!.x,separated.玩家.y-separated.首领!.y)).toBeGreaterThan(380);
  const deadline=Date.now()+60000;let extended=await read();
  while(Math.hypot(extended.首领!.x-camp.x,extended.首领!.y-camp.y)<1100&&Date.now()<deadline){
    if(extended.玩家.hp<65)await page.keyboard.press('1');await page.waitForTimeout(200);extended=await read();expect(extended.据点.boss.stage).toBe('battle');
    // 实战受击会自然推移；限定仍在撤离区域，回村重生会明确失败。
    expect(extended.玩家.x).toBeLessThan(50);expect(extended.玩家.y).toBeGreaterThan(2000);expect(extended.玩家.y).toBeLessThan(2400);expect(extended.玩家.hp).toBeGreaterThan(0);
  }
  await page.screenshot({path:`${dir}/boss-extended-chase.png`});expect(Math.hypot(extended.首领!.x-camp.x,extended.首领!.y-camp.y)).toBeGreaterThanOrEqual(1100);
  await page.keyboard.press('Escape');const saved=await read();await page.getByRole('button',{name:'保存旅途',exact:true}).click();await expect(page.locator('#toast')).toContainText('已保存');
  await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');
  const restored=await read();expect(restored.首领!.hp).toBe(saved.首领!.hp);expect(restored.据点.boss.attempt).toBe(saved.据点.boss.attempt);expect(Math.hypot(restored.首领!.x-saved.首领!.x,restored.首领!.y-saved.首领!.y)).toBeLessThan(10);
  const restoredDistance=Math.hypot(restored.首领!.x-restored.玩家.x,restored.首领!.y-restored.玩家.y);
  expect(restoredDistance).toBeGreaterThan(380);await page.waitForFunction(({x,y})=>{const s=(window as any).__farwind(),e=s.enemies.find((e:any)=>e.id==='boss-spore-heart');return Math.hypot(e.x-s.state.player.x,e.y-s.state.player.y)<Math.hypot(x-s.state.player.x,y-s.state.player.y)-20;},{x:restored.首领!.x,y:restored.首领!.y},{timeout:15000});
  if((await read()).玩家.hp<65)await page.keyboard.press('1');await move(page,-1400,2150);const withdrawn=await read();
  await page.waitForFunction(()=>(window as any).__farwind().state.encounters.groups['south-spore-camp'].boss.stage==='warning',null,{timeout:BOSS_RULES.retreat+5000});
  await page.keyboard.press('Escape');const reset=await read();expect(reset.据点.boss.attempt).toBe(entered.据点.boss.attempt+1);expect(reset.据点.members.at(-1).hp).toBe(CAMP_BOSSES['spore-heart'].hp);expect(reset.据点.members.slice(0,-1).every((m:any)=>m.defeated)).toBe(true);expect(reset.首领).toBeUndefined();expect(Math.hypot(reset.玩家.x-withdrawn.玩家.x,reset.玩家.y-withdrawn.玩家.y)).toBeLessThan(10);expect(errors).toEqual([]);
  await page.screenshot({path:`${dir}/boss-retreat-reset.png`});
  await writeFile(`${dir}/boss-gameplay.json`,JSON.stringify({说明:'导入合法装备起点后，真实键盘清理驻守、正常首领入场、步行追击、服药、暂停保存、刷新继续和远离撤战。没有写运行时位置、AI、死亡或清除。',结果:'通过',首领入场:entered,拉开距离:separated,超过一千追击:extended,保存:saved,恢复:restored,实际撤离:withdrawn,撤战结果:reset,页面错误:errors},null,2));
});
