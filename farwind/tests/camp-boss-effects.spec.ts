import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {CAMP_BOSSES,type CampBossKind} from '../src/data/maps/windbell/campBosses';
import {syncMapGeometry} from '../src/data/world';
import {clearMotionLine,motionBlocked} from '../src/game/systems/obstacles';
import {readBossGame as read,startBossFight} from './camp-boss-test-flow';
for(const kind of Object.keys(CAMP_BOSSES) as CampBossKind[])test(`effects-${kind}`,async({page})=>{
 syncMapGeometry(false);const root=`docs/camp-bosses/evidence/vfx/${kind}`;mkdirSync(root,{recursive:true});const errors:string[]=[],report:any={说明:'先生成分镜、后开发的正式无授予构建；真实新游戏、购买和装备、步行清驻守、正常服药和逐招观察。诊断只读。',首领:CAMP_BOSSES[kind].name,招式:[],特效:[],服药:[],错误:errors,结果:'进行中'};page.on('pageerror',e=>errors.push(e.message));const save=()=>writeFileSync(root+'/gameplay.json',JSON.stringify(report,null,2));
 try{
  const camp=await startBossFight(page,kind),start=await read(page),attempt=start.state.encounters.groups[camp.id].boss.attempt,seen=new Set<number>(),captured=new Set<number>(),deadline=Date.now()+50000;expect(start.state.skills.swordWindStage).toBe(0);expect(start.state.xiaobao.task).toBe('free');let lastPotion=-10000,saved=false,moving:{key:string;until:number}|undefined;
  while(Date.now()<deadline){
   const s=await read(page),now=s.skillGrowth.sim,g=s.state.encounters.groups[camp.id],a=g.boss.combat?.attack,e=s.enemies.find((v:any)=>v.id==='boss-'+kind);if(errors.length)throw Error(errors[0]);
   if(moving&&now>=moving.until){await page.keyboard.up(moving.key);moving=undefined;}
   if(s.mode==='dialog'){await page.getByRole('button',{name:'继续 · E',exact:true}).click();continue;}expect(s.mode).toBe('');if(g.boss.attempt!==attempt)break;
   expect(s.bossEffects.objects).toBe(2);if(a)seen.add(a.bossSkill);
   const effects=s.bossEffects.effects.filter((v:any)=>v.boss===kind&&v.phase!=='蓄力');
   if(effects.length){report.特效.push({时刻:now,效果:effects,对象:s.skillGrowth.objects,纹理:s.skillGrowth.textures});const skill=a?.bossSkill;
    if(skill!==undefined&&!captured.has(skill)&&!(a.bossArea==='ring'&&effects.every((fx:any)=>fx.elapsed<700))){captured.add(skill);report.招式.push({技能:skill,名称:CAMP_BOSSES[kind].skills[skill],攻击:a,首领:{x:e.x,y:e.y},特效:effects});await page.screenshot({path:root+`/skill-${skill}.png`});}
    if(kind==='bound-branch'&&skill===2&&!saved){
     if(moving){await page.keyboard.up(moving.key);moving=undefined;}
     await page.keyboard.press('Escape');await expect(page.locator('.pause-panel')).toBeVisible();const paused=await read(page);await page.waitForTimeout(300);const held=await read(page);expect(held.skillGrowth.sim).toBe(paused.skillGrowth.sim);expect(held.bossEffects).toEqual(paused.bossEffects);
     await page.getByRole('button',{name:'保存旅途',exact:true}).click();await expect(page.locator('#toast')).toContainText('已保存');const savedBoss=(await read(page)).state.encounters.groups[camp.id].boss;
     await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');await page.waitForFunction(()=>(window as any).__farwind().bossEffects.effects.some((v:any)=>v.boss==='bound-branch'&&v.kind==='破土根枝'));
     const restored=await read(page),combat=restored.state.encounters.groups[camp.id].boss;expect(combat.attempt).toBe(savedBoss.attempt);expect(combat.combat.hazards.map((v:any)=>v.point)).toEqual(savedBoss.combat.hazards.map((v:any)=>v.point));expect(combat.combat.hazards[0].expires).toBeLessThanOrEqual(savedBoss.combat.hazards[0].expires);expect(combat.combat.hazards[0].expires).toBeGreaterThan(savedBoss.combat.hazards[0].expires-250);
     report.暂停与重开={暂停:paused.bossEffects,恢复:restored.bossEffects,保存危险区:savedBoss.combat.hazards,恢复危险区:combat.combat.hazards};await page.screenshot({path:root+'/roots-reloaded.png'});saved=true;lastPotion=-10000;continue;
    }
   }
   if(s.state.player.hp<65&&now-lastPotion>1200&&s.state.bag.some((v:any)=>v?.id==='potion'&&v.count>0)){report.服药.push({时刻:now,之前生命:s.state.player.hp});await page.keyboard.press('1');lastPotion=now;}
   // 用正常侧移躲避已锁定的落点；视觉检查不要求角色站桩挨完整三连震踏。
   if(!moving&&a?.bossArea==='circle'&&a.contactAt<350&&a.contactAt>80){
    const p=s.state.player,point=a.bossGeometry.point;if(Math.hypot(p.x-point.x,p.y-point.y)<a.bossGeometry.radius+20){
     const choices=[['w',0,-85],['s',0,85],['a',-85,0],['d',85,0]] as const;const choice=choices.find(([,dx,dy])=>{const to={x:p.x+dx,y:p.y+dy};return !motionBlocked(to.x,to.y)&&clearMotionLine(p,to)&&Math.hypot(to.x-camp.x,to.y-camp.y)<camp.radius+45;});
     if(choice){await page.keyboard.down(choice[0]);moving={key:choice[0],until:now+450};}
    }
   }
   if(captured.size===4&&g.boss.combat?.battle.move===-1)break;save();await page.waitForTimeout(30);
  }
  expect([...seen].sort()).toEqual([0,1,2,3]);expect([...captured].sort()).toEqual([0,1,2,3]);expect(report.特效.some((v:any)=>v.效果.some((fx:any)=>fx.kind.includes(kind==='crag-tusk'?'裂土':kind==='thorn-crown'?'爪痕':kind==='spore-heart'?'根枝':'护心')))).toBe(true);
  const last=await read(page);report.结束={模拟毫秒:last.skillGrowth.sim,对象:last.skillGrowth.objects,纹理:last.skillGrowth.textures,玩家:last.state.player};expect(errors).toEqual([]);report.结果='通过';
 }catch(error){report.结果='未通过';report.原因=(error as Error).message;report.失败状态=await read(page);await page.screenshot({path:root+'/failure.png'});throw error;}finally{save();const video=page.video();await page.close();if(video)await video.saveAs(root+'/gameplay.webm');}
});
