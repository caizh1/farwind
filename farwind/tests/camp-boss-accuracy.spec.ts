import {test,expect,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {CAMP_BOSSES,type CampBossKind} from '../src/data/maps/windbell/campBosses';
import {ENCOUNTERS} from '../src/data/maps/windbell/encounters';
import {VILLAGE_ANCHORS} from '../src/data/maps/windbell/layout';
import {syncMapGeometry} from '../src/data/world';
import {clearMotionLine,motionBlocked} from '../src/game/systems/obstacles';
import {move} from './map-navigation';
import {fight} from './field-combat';
const read=(p:Page)=>p.evaluate(()=>(window as any).__farwind());
const stage=process.env.BOSS_ACCURACY_STAGE??'after';
async function setup(page:Page,kind:CampBossKind){
 await page.goto('/');await page.getByRole('button',{name:'启程 · 新游戏',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind?.().mode==='');
 await move(page,560,810);await page.keyboard.press('e');await page.getByRole('button',{name:'领取委托与启程补给',exact:true}).click();await page.getByRole('button',{name:'合上委托簿 Esc',exact:true}).click();
 for(const [shop,item,count] of [[VILLAGE_ANCHORS.general,'potion','3'],[VILLAGE_ANCHORS.smith,'ironSword','1']] as const){await move(page,shop.x,shop.y+65);await page.keyboard.press('e');await page.getByLabel('物品',{exact:true}).selectOption(item);await page.getByLabel('数量',{exact:true}).fill(count);await page.locator('#shop-review').click();await page.locator('#shop-confirm').click();await expect(page.locator('#shop-feedback')).toContainText('已完成');await page.keyboard.press('Escape');}
 await page.keyboard.press('Tab');await page.locator('.slot').filter({hasText:'铁剑'}).click();await page.locator('#equip').click();await page.waitForFunction(()=>(window as any).__farwind().state.equipment.weapon==='ironSword');await page.keyboard.press('Escape');
 const routes:Record<CampBossKind,number[][]>={'spore-heart':[[900,1900],[1050,2040],[1000,2450],[1250,2820]],'thorn-crown':[[820,120],[-80,120],[-140,1260],[-700,1340],[-1700,1490]],'crag-tusk':[[820,120],[560,-140],[1030,-260],[1480,-730]],'bound-branch':[[1980,1100],[2580,1100],[3710,1100]]};
 for(const [x,y] of routes[kind])await move(page,x,y);
 const camp=ENCOUNTERS.find(c=>c.id===CAMP_BOSSES[kind].camp)!;await fight(page,camp.members.filter(m=>!m.boss).map(m=>m.id));
 // 在预警期间正常步行到据点边缘，避免只验证贴脸技能。
 const choices=[[1,0],[-1,0],[0,1],[0,-1]].map(([x,y])=>({x:camp.x+x*290,y:camp.y+y*290})).filter(p=>!motionBlocked(p.x,p.y)&&clearMotionLine(camp,p));expect(choices.length).toBeGreaterThan(0);await move(page,choices[0].x,choices[0].y);
 return camp;
}
for(const kind of Object.keys(CAMP_BOSSES) as CampBossKind[])test(`stationary-${kind}`,async({page})=>{
 syncMapGeometry(false);const root=`docs/camp-bosses/evidence/accuracy/${stage}-${kind}`;mkdirSync(root,{recursive:true});const errors:string[]=[],report:any={说明:'关闭测试授予的正式构建。从真实新游戏领取补给、购买、装备、步行、清驻守；随后不移动、不攻击、不架剑，只正常服药和观察。玩家的受击推移也如实记录。诊断只读。',首领:CAMP_BOSSES[kind].name,招式:[],接触:[],弹丸:[],服药:[],错误:errors,结果:'进行中'},save=()=>writeFileSync(root+'/stationary.json',JSON.stringify(report,null,2));page.on('pageerror',e=>errors.push(e.message));
 try{
  const camp=await setup(page,kind),id='boss-'+kind,stopped=await read(page);expect(stopped.state.skills.swordWindStage).toBe(0);expect(stopped.state.xiaobao.task).toBe('free');report.停止输入={模拟毫秒:stopped.skillGrowth.sim,玩家:stopped.state.player};
  const attacks=new Map<string,any>(),contacts=new Set<string>(),moves=new Set<number>();let projectilePicture=false,lastPotion=-10000,start=stopped.skillGrowth.sim;
  while((await read(page)).skillGrowth.sim-start<40000){
   const s=await read(page),now=s.skillGrowth.sim,g=s.state.encounters.groups[camp.id],e=s.enemies.find((e:any)=>e.id===id),a=g.boss.combat?.attack;
   if(errors.length)throw Error(errors[0]);if(s.mode==='dialog'){await page.getByRole('button',{name:'继续 · E',exact:true}).click();continue;}expect(s.mode).toBe('');
   // 站桩死亡也是正确结果，严格核对回村与首领重置，不跨入下一轮挑战。
   if(g.boss.attempt!==0){expect(g.boss.attempt).toBe(1);expect(s.state.player).toMatchObject({x:670,y:720,hp:100});expect(g.members.slice(0,-1).every((m:any)=>m.defeated&&m.hp===0)).toBe(true);expect(g.members.at(-1).hp).toBe(CAMP_BOSSES[kind].hp);report.正常死亡重置={玩家:s.state.player,据点:g};break;}
   if(a&&!attacks.has(a.attackId)){const record={身份:a.attackId,技能:a.bossSkill,分段:a.bossPart,名称:CAMP_BOSSES[kind].skills[a.bossSkill],时刻:now,起手:a.startedAt+now,距离:Math.hypot(e.x-s.state.player.x,e.y-s.state.player.y),首领:{x:e.x,y:e.y},玩家:s.state.player,几何:a.bossGeometry,方向:a.direction};attacks.set(a.attackId,record);report.招式.push(record);if(record.起手>=start)moves.add(a.bossSkill);}
   for(const c of s.bossContacts??[]){if(c.at<start||contacts.has(c.id))continue;contacts.add(c.id);const known=[...attacks.entries()].find(([key])=>c.id===key||c.id.startsWith(key+':'))?.[1];report.接触.push({...c,技能:c.skill??known?.技能,分段:c.part??known?.分段});}
   const flying=g.boss.combat?.shots?.filter((v:any)=>v.state==='flying')??[];
   if(flying.length&&!projectilePicture){report.弹丸.push({模拟毫秒:now,飞行:flying,画面:s.bossProjectiles??null});await page.screenshot({path:root+'/projectiles.png'});projectilePicture=true;}
   if(s.state.player.hp<65&&now-lastPotion>1200&&s.state.bag.some((v:any)=>v?.id==='potion'&&v.count>0)){report.服药.push({时刻:now,之前生命:s.state.player.hp});await page.keyboard.press('1');lastPotion=now;}
   save();if(moves.size===4&&g.boss.combat?.battle.move===-1)break;await page.waitForTimeout(50);
  }
  const s=await read(page);report.结束={模拟毫秒:s.skillGrowth.sim,玩家:s.state.player,对象数量:s.skillGrowth.objects,纹理数量:s.skillGrowth.textures};expect([...moves].sort()).toEqual([0,1,2,3]);
  const hurt=report.接触.filter((c:any)=>c.result==='hurt');expect(hurt.length).toBeGreaterThan(0);
  if(kind==='spore-heart'||kind==='bound-branch'){expect(projectilePicture).toBe(true);expect(hurt.some((c:any)=>c.技能===(kind==='spore-heart'?0:1))).toBe(true);expect(report.弹丸[0].画面.some((v:any)=>v.visual?.texture==='boss-projectile-'+kind&&v.visual.width>=36)).toBe(true);}
  await page.screenshot({path:root+'/stationary-hit.png'});expect(errors).toEqual([]);report.结果='通过';
 }catch(error){report.结果='未通过';report.原因=(error as Error).message;report.失败状态=await read(page);await page.screenshot({path:root+'/failure.png'});throw error;}finally{save();const video=page.video();await page.close();if(video)await video.saveAs(root+'/stationary.webm');}
});
