import {expect,type Page} from '@playwright/test';
import {CAMP_BOSSES,type CampBossKind} from '../src/data/maps/windbell/campBosses';
import {ENCOUNTERS} from '../src/data/maps/windbell/encounters';
import {VILLAGE_ANCHORS} from '../src/data/maps/windbell/layout';
import {clearMotionLine,motionBlocked} from '../src/game/systems/obstacles';
import {move} from './map-navigation';
import {fight} from './field-combat';
export const readBossGame=(p:Page)=>p.evaluate(()=>(window as any).__farwind());
// 沿用正式路径：真实新游戏、补给与购买、装备、步行、清驻守。没有测试授予。
export async function startBossFight(page:Page,kind:CampBossKind,combat=fight){
 await page.goto('/');await page.getByRole('button',{name:'启程 · 新游戏',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind?.().mode==='');
 await move(page,560,810);await page.keyboard.press('e');await page.getByRole('button',{name:'领取委托与启程补给',exact:true}).click();await page.getByRole('button',{name:'合上委托簿 Esc',exact:true}).click();
 for(const [shop,item,count] of [[VILLAGE_ANCHORS.general,'potion','3'],[VILLAGE_ANCHORS.smith,'ironSword','1']] as const){await move(page,shop.x,shop.y+65);await page.keyboard.press('e');await page.getByLabel('物品',{exact:true}).selectOption(item);await page.getByLabel('数量',{exact:true}).fill(count);await page.locator('#shop-review').click();await page.locator('#shop-confirm').click();await expect(page.locator('#shop-feedback')).toContainText('已完成');await page.keyboard.press('Escape');}
 await page.keyboard.press('Tab');await page.locator('.slot').filter({hasText:'铁剑'}).click();await page.locator('#equip').click();await page.waitForFunction(()=>(window as any).__farwind().state.equipment.weapon==='ironSword');await page.keyboard.press('Escape');
 if(combat!==fight)return approachParryBoss(page,kind,combat);
 // 村中小宝当前位于东侧训练路口；走中央道路，避免旧路线穿过动态人物占地。
 const routes:Record<CampBossKind,number[][]>={'spore-heart':[[900,1900],[1050,2040],[1000,2450],[1250,2820]],'thorn-crown':[[720,120],[-80,120],[-140,1260],[-700,1340],[-1700,1490]],'crag-tusk':[[720,120],[560,-140],[1030,-260],[1480,-730]],'bound-branch':[[1980,1100],[2580,1100],[3710,1100]]};
 if(kind==='crag-tusk'){
  // 北路追兵会持续加入首领战；先按实际路径清理巡游和独立精英，再观察四招。
  await move(page,720,120);await move(page,560,-140);await move(page,400,-330);await combat(page,['wild-bent-boar']);
  await move(page,1130,-390);await combat(page,['wild-pass-guardian']);await move(page,900,-740);await combat(page,['wild-outpost-raven']);await move(page,1080,-990);await combat(page,['elite-rock-ram']);
  // 专项战斗操作者从营地外接敌；旧路径只走不战斗，会在抵达中心前被两名驻守击倒。
  if(combat===fight)await move(page,1480,-730);
 }else{
  const approach:Partial<Record<CampBossKind,number[]>>={'spore-heart':[1250,2430],'thorn-crown':[-1300,1490],'bound-branch':[3290,1100]};
  const path=routes[kind].map((p,i)=>combat!==fight&&i===routes[kind].length-1?approach[kind]??p:p);
  for(const [x,y] of path)await move(page,x,y);
 }
 const camp=ENCOUNTERS.find(c=>c.id===CAMP_BOSSES[kind].camp)!;await combat(page,camp.members.filter(m=>!m.boss).map(m=>m.id));
 const choices=[[1,0],[-1,0],[0,1],[0,-1]].map(([x,y])=>({x:camp.x+x*290,y:camp.y+y*290})).filter(p=>!motionBlocked(p.x,p.y)&&clearMotionLine(camp,p));expect(choices.length).toBeGreaterThan(0);await move(page,choices[0].x,choices[0].y);return camp;
}

// 面向长期追踪的专项实战路线：先清沿路追兵，再到营地边缘接敌。
export async function approachParryBoss(page:Page,kind:CampBossKind,combat:(page:Page,ids:string[])=>Promise<void>){
 const paths:Record<CampBossKind,{x:number;y:number;clear?:string[]}[]>={
  'spore-heart':[{x:900,y:1900},{x:1050,y:2040,clear:['wild-reed-slime']},{x:1000,y:2450,clear:['wild-herb-spore','wild-herb-slime']},{x:1250,y:2430}],
  'thorn-crown':[{x:720,y:120},{x:-80,y:120},{x:-140,y:1260},{x:-700,y:1340,clear:['wild-track-wolf-a','wild-track-wolf-b','wild-farm-reaper']},{x:-1100,y:1730,clear:['elite-thorn-alpha']},{x:-1300,y:1490}],
  'bound-branch':[{x:1980,y:1100},{x:2580,y:1100,clear:['slime-1','slime-2']},{x:3040,y:1100,clear:['leaf-1','leaf-2']},{x:3290,y:1100}],
  'crag-tusk':[{x:720,y:120},{x:560,y:-140},{x:400,y:-330,clear:['wild-bent-boar']},{x:1130,y:-390,clear:['wild-pass-guardian']},{x:900,y:-740,clear:['wild-outpost-raven']},{x:1080,y:-990,clear:['elite-rock-ram']}]};
 for(const node of paths[kind]){await move(page,node.x,node.y);if(node.clear)await combat(page,node.clear);}
 const camp=ENCOUNTERS.find(c=>c.id===CAMP_BOSSES[kind].camp)!;await combat(page,camp.members.filter(m=>!m.boss).map(m=>m.id));
 const choices=[[1,0],[-1,0],[0,1],[0,-1]].map(([x,y])=>({x:camp.x+x*290,y:camp.y+y*290})).filter(p=>!motionBlocked(p.x,p.y)&&clearMotionLine(camp,p));expect(choices.length).toBeGreaterThan(0);await move(page,choices[0].x,choices[0].y);return camp;
}
