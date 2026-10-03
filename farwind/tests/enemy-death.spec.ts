import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {ENEMIES} from '../src/data/enemies';
import {initialState,add} from '../src/game/systems/state';
import {initialEncounters} from '../src/game/systems/encounterState';
import {ENCOUNTERS,waveMembers} from '../src/data/maps/windbell/encounters';

const root='docs/enemy-death/evidence';
test('enemy-death-preview',async({page})=>{
 await mkdir(root,{recursive:true});const errors:string[]=[],samples:unknown[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/combat-art-preview.html');await expect(page.locator('#actor')).toBeEnabled();
 const read=()=>page.evaluate(()=>(window as any).__bossMotionPreview());
 await page.getByRole('button',{name:'暂停播放',exact:true}).click();
 for(const kind of Object.keys(ENEMIES)){
  await page.locator('#actor').selectOption(kind);await expect(page.locator('#action')).toBeEnabled();
  await page.locator('#action').selectOption('death');
  for(const direction of ['0','1','2','3']){
   await page.locator('#direction').selectOption(direction);
   const frames:any[]=[];
   for(const at of [0,180,400,700,1800,2200,2400]){
    await page.locator('#time').fill(String(at));const s=await read(),art=s.样本[1].怪物表现;
    expect(art.pose.action).toBe('death');expect(art.pose.elapsed).toBe(at);
    expect(art.root).toEqual([940,540]);expect(art.flip).toBe(direction==='2');
    expect(art.alpha).toBe(at<=2000?1:at===2200?.5:0);expect(art.visible).toBe(at<2400);
    frames.push(s);
    if(['archer','bell','geomancer','shade'].includes(kind)&&direction==='3'&&[0,400,700].includes(at))await page.screenshot({path:`${root}/${kind}-${at}.png`});
   }
   if(['archer','bell','geomancer','shade'].includes(kind)){
    expect(Math.abs(frames[1].样本[1].怪物表现.rotation)).toBeGreaterThan(0);
    expect(Math.abs(frames[2].样本[1].怪物表现.rotation)).toBeGreaterThan(Math.abs(frames[1].样本[1].怪物表现.rotation));
    expect(frames[3].样本[1].怪物表现.rotation).toBeCloseTo(direction==='2'?-1.35:1.35);
    expect(frames[4].样本[1].怪物表现.rotation).toBe(frames[3].样本[1].怪物表现.rotation);
   }else expect(frames[0].样本[1].素材).not.toBe(frames[3].样本[1].素材);
   samples.push({怪物:kind,方向:direction,帧:frames});
  }
 }
 await page.locator('#actor').selectOption('archer');await page.locator('#action').selectOption('death');await page.locator('#time').fill('400');
 const paused=await read();await page.waitForTimeout(200);expect(await read()).toEqual(paused);
 await page.getByRole('button',{name:'从头播放',exact:true}).click();expect((await read()).样本[1].怪物表现.pose.elapsed).toBe(0);
 await page.locator('#action').selectOption('idle');const idle=(await read()).样本[1].怪物表现;
 expect(idle.rotation).toBe(0);expect(idle.alpha).toBe(1);expect(idle.visible).toBe(true);
 expect(errors).toEqual([]);
 await writeFile(root+'/preview-validation.json',JSON.stringify({说明:'通过正常预览控件调用正式怪物渲染器，核对十四种普通怪物四方向阵亡、脚根、镜像、倒地停留、淡出、暂停和重新播放；不读取或修改游戏存档。',结果:'通过',错误:errors,样本:samples},null,2));
});

test('enemy-death-gameplay',async({page})=>{
 await mkdir(root,{recursive:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const group=ENCOUNTERS.find(g=>g.id==='south-reed-patrol')!;
 let seed=1;while(!waveMembers(group,seed).some(m=>m.wave===0&&m.type==='archer'))seed++;
 const state=initialState();state.encounters=initialEncounters(seed);state.player.x=group.x;state.player.y=group.y+330;
 add(state,'ironSword',1);add(state,'leatherCoat',1);add(state,'potion',8);state.equipment.weapon='ironSword';state.equipment.armor='leatherCoat';
 await page.goto('/');page.on('dialog',d=>d.accept());const chooser=page.waitForEvent('filechooser');
 await page.getByRole('button',{name:'导入存档',exact:true}).click();
 await(await chooser).setFiles({name:'enemy-death-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({说明:'固定种子、合法装备与药品起点。敌人出生、攻击、死亡与保存完全走正式游戏链路。',...state}))});
 await page.waitForFunction(()=>(window as any).__farwind?.().enemies.some((e:any)=>e.type==='archer'&&e.hp>0));
 const read=()=>page.evaluate(()=>(window as any).__farwind());const first=await read(),id=first.enemies.find((e:any)=>e.type==='archer'&&e.hp>0).id;
 let dead:any;
 for(let step=0;step<180;step++){
  const s=await read(),e=s.enemies.find((e:any)=>e.id===id);expect(s.state.player.hp).toBeGreaterThan(0);
  if(e?.hp<=0){dead=s;break;}
  const dx=e.x-s.state.player.x,dy=e.y-s.state.player.y,keys:string[]=[];
  if(Math.abs(dx)>20)keys.push(dx>0?'d':'a');if(Math.abs(dy)>20)keys.push(dy>0?'s':'w');
  for(const key of keys)await page.keyboard.down(key);
  if(s.state.player.hp<65)await page.keyboard.press('1');
  if(Math.hypot(dx,dy)<120)await page.keyboard.press('j');
  await page.waitForTimeout(100);for(const key of keys)await page.keyboard.up(key);
 }
 expect(dead,'真实攻击应击败目标').toBeDefined();
 await page.waitForTimeout(150);await page.screenshot({path:root+'/archer-gameplay-fall.png'});await page.keyboard.press('Escape');const paused=await read(),art=paused.animation.enemies.find((e:any)=>e.id===id).art;
 expect(art.pose.action).toBe('death');expect(Math.abs(art.rotation)).toBeGreaterThan(.01);expect(art.alpha).toBe(1);expect(art.visible).toBe(true);
 await page.waitForTimeout(200);
 expect((await read()).animation.enemies.find((e:any)=>e.id===id).art).toEqual(art);
 await page.locator('#save').click();await expect(page.getByText('旅途已保存',{exact:true})).toBeVisible();
 await page.waitForFunction(()=>{const s=(window as any).__farwind();return !s.session.saving.writing&&s.session.saving.queued===0&&!s.defenseSaving&&!s.sessionStarting;});
 await page.getByRole('button',{name:'继续旅途',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');
 await page.waitForFunction(id=>{const e=(window as any).__farwind().animation.enemies.find((e:any)=>e.id===id);return e&&!e.art.visible;},id,{timeout:10000});
 await page.keyboard.press('Escape');await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();
 await page.waitForFunction(()=>(window as any).__farwind?.().mode==='');const loaded=await read();expect(loaded.enemies.some((e:any)=>e.id===id)).toBe(false);expect(errors).toEqual([]);
 await writeFile(root+'/gameplay-validation.json',JSON.stringify({说明:'独立浏览器导入固定合法装备起点，通过真实方向键追击和J近战击败风针弩灵。检查正式死亡姿态、连续倒地、暂停冻结、淡出、保存和刷新后不复活；未写运行时战斗结果。',结果:'通过',种子:seed,目标:id,死亡表现:art,刷新后无该怪物:true,错误:errors},null,2));
});
