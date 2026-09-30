import {test,expect,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {ENCOUNTERS,encounterUnit} from '../src/data/maps/windbell/encounters';
import {CAMP_BOSSES,type CampBossKind} from '../src/data/maps/windbell/campBosses';
import {syncMapGeometry} from '../src/data/world';
import {clearMotionLine,motionBlocked} from '../src/game/systems/obstacles';
import {startBossFight,approachParryBoss,readBossGame as read} from './camp-boss-test-flow';
import {move} from './map-navigation';

// 面向当前体积碰撞的正式输入：站稳面向目标，适时架剑，动作结束再重新调整距离。
async function guards(page:Page,ids:string[],steps:any[]=[]){
 const began=(await read(page)).skillGrowth.sim;
 for(let i=0;i<240;i++){
  const s=await read(page),targets=s.enemies.filter((e:any)=>e.hp>0&&(ids.includes(e.id)||!e.behavior?.boss&&Math.hypot(e.x-s.state.player.x,e.y-s.state.player.y)<330)).sort((a:any,b:any)=>Math.hypot(a.x-s.state.player.x,a.y-s.state.player.y)-Math.hypot(b.x-s.state.player.x,b.y-s.state.player.y));
  if(!targets.length&&ids.every(id=>{const m=encounterUnit(id)!;return s.state.encounters.groups[m.group].members[ENCOUNTERS.find(d=>d.id===m.group)!.members.findIndex(u=>u.id===id)].defeated;}))return;if(s.mode)throw Error('清驻守时界面中断：'+s.mode);
  if(s.contacts.some((c:any)=>c.at>=began&&c.hp===0))throw Error('清驻守期间真实死亡回村，保留失败路径。');
  if(!targets.length){await page.waitForTimeout(80);continue;}
  if(s.state.player.hp<72)await page.keyboard.press('1');
  const e=targets[0],p=s.state.player,dx=e.x-p.x,dy=e.y-p.y,key=Math.abs(dx)>Math.abs(dy)?dx<0?'a':'d':dy<0?'w':'s',distance=Math.hypot(dx,dy);
  if(distance>125&&!clearMotionLine(p,e)){
   const points=[[1,0],[-1,0],[0,1],[0,-1]].map(([x,y])=>({x:e.x+x*170,y:e.y+y*170})).filter(q=>!motionBlocked(q.x,q.y)&&clearMotionLine(q,e)).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));
   if(!points.length)throw Error('驻守附近没有可达的接敌位置。');await move(page,points[0].x,points[0].y);continue;
  }
  if(i%10===0)steps.push({模拟毫秒:s.skillGrowth.sim,驻守:ids,玩家:{...p},目标:{id:e.id,x:e.x,y:e.y,hp:e.hp},动作:s.session.combat.phase,距离:distance,预警:s.warnings.map((w:any)=>({id:w.id,剩余:w.lead})),拒绝:s.session.combat.lastRejection});
  if(s.session.combat.phase!=='idle'&&s.session.combat.phase!=='ready'){await page.waitForTimeout(35);continue;}
  await page.keyboard.down(key);await page.waitForTimeout(distance>85?70:15);await page.keyboard.up(key);
  const next=await read(page),warning=next.warnings.find((w:any)=>w.id.startsWith(e.id+':')&&w.lead!==null&&w.lead>15&&w.lead<205);
  if(warning)await page.keyboard.press('k');else if(distance<100)await page.keyboard.press('j');
  await page.waitForTimeout(80);
 }
 throw Error('正式架剑与攻击未在限定输入内清理驻守。');
}
// 只用正式输入等待目标品质；不可弹反的地面招式要真实避让，不能站着等到死亡。
async function triggerParry(page:Page,id:string,quality:string){
 const began=(await read(page)).skillGrowth.sim,lead=quality==='normal'?190:75;
 for(let i=0;i<1000;i++){
  const s=await page.evaluate(id=>{const s=(window as any).__farwind(),e=s.enemies.find((e:any)=>e.id===id);return {sim:s.skillGrowth.sim,p:s.state.player,e,mode:s.mode,warnings:s.warnings.filter((w:any)=>w.id.startsWith(id)),hazards:s.bossHazards,contacts:s.bossContacts,remedies:s.state.bag};},id);
  if(!s.e||s.contacts.some((c:any)=>c.at>=began&&c.hp===0))throw Error('等待弹反时真实死亡或首领退出。');
  if(s.sim-began>45000)throw Error('未在四十五秒战斗内找到目标品质的正式弹反窗口。');
  if(s.p.hp<70){const remedy=s.remedies.find((v:any)=>v&&['potion','berry'].includes(v.id)&&v.count>0);if(remedy){await page.keyboard.press(remedy.id==='potion'?'1':'2');continue;}}
  const e=s.e,p=s.p,dx=e.x-p.x,dy=e.y-p.y,distance=Math.hypot(dx,dy),toward=Math.abs(dx)>Math.abs(dy)?dx<0?'a':'d':dy<0?'w':'s';
  const warning=s.warnings.find((w:any)=>w.predicted!==null&&w.lead>0);
  if(e.attack?.parryable&&warning&&(distance<100||(e.attack.step??0)>30)&&warning.lead>(quality==='normal'?105:5)){
   await page.keyboard.down(toward);await page.waitForTimeout(15);await page.keyboard.up(toward);
   try{await page.waitForFunction(({id,attackId,lead,min})=>{const s=(window as any).__farwind(),w=s.warnings.find((w:any)=>w.id===attackId);return !s.mode&&w&&w.lead<=lead&&w.lead>min;},{id,attackId:warning.id,lead,min:quality==='normal'?105:5},{polling:5,timeout:Math.min(2500,Math.max(200,warning.lead+200))});}
   catch{continue;}
   const before=s.contacts.length;await page.keyboard.press('k');
   await page.waitForFunction(({id,before})=>(window as any).__farwind().bossContacts.slice(before).some((c:any)=>c.id.startsWith(id)&&(c.result==='normal'||c.result==='perfect')),{id,before},{polling:5,timeout:2500});
   const contact=(await read(page)).bossContacts.slice(before).find((c:any)=>c.id.startsWith(id)&&(c.result==='normal'||c.result==='perfect'));expect(contact.result).toBe(quality);return contact;
  }
  const a=e.attack,g=a?.bossArea?a.bossGeometry:null,h=s.hazards.find((h:any)=>h.owner===id&&Math.hypot(p.x-h.point.x,p.y-h.point.y)<h.radius+50),danger=g??h;
  if(danger){
   const point=danger.point,vx=p.x-point.x,vy=p.y-point.y;
   if(Math.hypot(vx,vy)<danger.radius+50||g&&!a.locked){const key=Math.abs(vx)>Math.abs(vy)?vx<0?'a':'d':vy<0?'w':'s';await page.keyboard.down(key);await page.waitForTimeout(70);await page.keyboard.up(key);continue;}
  }else if(distance>92){await page.keyboard.down(toward);await page.waitForTimeout(60);await page.keyboard.up(toward);continue;}
  await page.waitForTimeout(15);
 }
 throw Error('正式弹反操作数量超出限制。');
}
for(const kind of Object.keys(CAMP_BOSSES) as CampBossKind[])test(`boss-parry-${kind}`,async({page})=>{
 syncMapGeometry(false);const root=`docs/camp-bosses/parry/evidence/after-${kind}`;mkdirSync(root,{recursive:true});
 const id='boss-'+kind,errors:string[]=[],report:any={说明:'全部进度来自真实键鼠录像；可经正式存档导入恢复未经修改的备份。清怪、补给使用与弹反均用正式输入，未授予能力或改写运行状态字段。',首领:CAMP_BOSSES[kind].name,驻守操作:[],样本:[],错误:errors,结果:'进行中'};
 const save=()=>writeFileSync(root+'/validation.json',JSON.stringify(report,null,2));page.on('pageerror',e=>errors.push(e.message));
 try{
  const replay=process.env.BOSS_PARRY_REPLAY;
  if(replay){
   report.正式导入来源=replay;await page.goto('/');await page.getByRole('button',{name:'启程 · 新游戏',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind?.().mode==='');await page.keyboard.press('Escape');
   page.once('dialog',d=>d.accept());const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入存档',exact:true}).click();await (await chooser).setFiles(resolve(replay));await page.waitForFunction(()=>(window as any).__farwind?.().mode==='');
   const camp=ENCOUNTERS.find(c=>c.id===CAMP_BOSSES[kind].camp)!,p=(await read(page)).state.player;const active=(await read(page)).enemies.some((e:any)=>e.id===id);
   if(!active&&Math.hypot(p.x-camp.x,p.y-camp.y)>800){
    await approachParryBoss(page,kind,(p,ids)=>guards(p,ids,report.驻守操作));
   }else if(!active){await guards(page,camp.members.filter(m=>!m.boss).map(m=>m.id),report.驻守操作);await move(page,camp.x,camp.y-290);}
  }else await startBossFight(page,kind,(p,ids)=>guards(p,ids,report.驻守操作));
  await page.waitForFunction(id=>{const s=(window as any).__farwind(),e=s.enemies.find((e:any)=>e.id===id);return e&&s.skillGrowth.sim>=e.behavior.battle.entryUntil;},id);
  const e=(await read(page)).enemies.find((e:any)=>e.id===id),p=(await read(page)).state.player;
  const points=[[1,0],[-1,0],[0,1],[0,-1]].map(([x,y])=>({x:e.x+x*82,y:e.y+y*82})).filter(q=>!motionBlocked(q.x,q.y)&&clearMotionLine(q,e)&&clearMotionLine(p,q));
  expect(points.length,'首领附近存在可达的正式弹反站位').toBeGreaterThan(0);
  for(const quality of ['normal','perfect']){
   const contact=await triggerParry(page,id,quality);
   const frames:any[]=[];await page.evaluate(id=>{const sample=()=>{const s=(window as any).__farwind(),e=s.enemies.find((e:any)=>e.id===id);return {模拟毫秒:s.skillGrowth.sim,根:e?{x:e.x,y:e.y}:null,动画:e?.art,姿态:e?.behavior.pose,弹反:e?.parried,硬直:e?.staggerRemaining,效果:s.bossEffects};};(window as any).__bossParryFrames=[];const loop=()=>{(window as any).__bossParryFrames.push(sample());(window as any).__bossParrySampler=requestAnimationFrame(loop);};loop();},id);
   await page.screenshot({path:root+'/'+quality+'-impact.png'});
   await page.waitForTimeout(210);await page.screenshot({path:root+'/'+quality+'-brace.png'});await page.keyboard.press('Escape');const paused=await read(page);await page.waitForTimeout(120);expect((await read(page)).skillGrowth.sim).toBe(paused.skillGrowth.sim);await page.getByRole('button',{name:'继续旅途',exact:true}).click();
   await page.waitForFunction(id=>{const e=(window as any).__farwind().enemies.find((e:any)=>e.id===id);return e&&!e.parried||e&&e.parried.until<=(window as any).__farwind().skillGrowth.sim;},id,{polling:5,timeout:2500});
   frames.push(...await page.evaluate(()=>{cancelAnimationFrame((window as any).__bossParrySampler);return (window as any).__bossParryFrames;}));
   report.样本.push({品质:quality,接触:contact,暂停:paused.skillGrowth.sim,帧:frames});save();
   {const active=frames.filter(f=>f.动画?.parryReaction);expect(active.length).toBeGreaterThan(8);expect(new Set(active.map(f=>f.动画.parryReaction.phase))).toEqual(new Set(['impact','recoil','brace','recover']));expect(active.some(f=>Math.abs(f.动画.rotation)>.08)).toBe(true);expect(active.some(f=>f.动画.parryReaction.progress>.9)).toBe(true);expect(frames.at(-1).动画.parryReaction).toBeNull();}
  }
  await page.waitForFunction(id=>{const e=(window as any).__farwind().enemies.find((e:any)=>e.id===id);return e&&e.attack&&!e.attack.cancelled&&e.attack.startedAt>=e.parried.until;},id,{timeout:6000});report.恢复出招=(await read(page)).enemies.find((e:any)=>e.id===id).attack;
  expect(errors).toEqual([]);report.结果='通过';
 }catch(error){report.结果='未通过';report.原因=(error as Error).message;report.失败状态=await read(page);writeFileSync(root+'/checkpoint.json',JSON.stringify(report.失败状态.state,null,2));await page.screenshot({path:root+'/failure.png'});throw error;}finally{save();const video=page.video();await page.close();if(video)await video.saveAs(root+'/gameplay.webm');}
});
