import {test,expect,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {move} from './map-navigation';
import {fight} from './field-combat';
import {syncMapGeometry} from '../src/data/world';
const root='docs/first-map/evidence-m4/creatures',read=(p:Page)=>p.evaluate(()=>(window as any).__farwind());
test('FIRST-MAP-05',async({page})=>{
 test.setTimeout(600000);mkdirSync(root,{recursive:true});syncMapGeometry(false);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'启程 · 新游戏',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind?.().mode==='');
 const report:any={说明:'正式构建新游戏，实际键鼠准备、步行、躲避、战斗与保存；只读取诊断状态，不修改进度或角色',节点:[],错误:errors};
 const snap=async(name:string,file:string)=>{const s=await read(page);report.节点.push({名称:name,主角:s.state.player,遭遇:s.state.encounters,敌人:s.enemies,音频:s.feedback?.audio??null});writeFileSync(`${root}/browser.json`,JSON.stringify({...report,结果:'进行中'},null,2));await page.screenshot({path:`${root}/${file}.png`});};
 await move(page,560,810);await page.keyboard.press('e');await page.getByRole('button',{name:'领取委托与启程补给',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().state.fieldQuests['south-supply']==='active');await page.keyboard.press('Escape');
 await move(page,900,1010);await page.waitForFunction(()=>(window as any).__farwind().target==='service-general');await page.keyboard.press('e');await page.getByLabel('物品',{exact:true}).selectOption('potion');await page.getByLabel('数量',{exact:true}).fill('4');await page.getByRole('button',{name:'核对交易',exact:true}).click();await page.getByRole('button',{name:'确认购买',exact:true}).click();await expect(page.locator('#shop-feedback')).toContainText('交易已完成并保存');await page.keyboard.press('Escape');
 await move(page,820,120);await move(page,-80,120);await move(page,-140,1260);await move(page,-500,1340);
 await snap('旧道路边两只荆棘狼侧向接近','wolves');await fight(page,['wild-track-wolf-a','wild-track-wolf-b']);await snap('主角清理双狼并获得掉落','wolves-cleared');
 await move(page,-80,120);await move(page,560,-140);await move(page,1030,-260);await move(page,1130,-330);await snap('山口苔甲守卫正面与缓慢转身','guardian');
 await fight(page,['wild-pass-guardian']);await snap('连续攻击与重击完成苔甲守卫','guardian-cleared');
 await move(page,560,-140);await move(page,820,150);await move(page,900,1900);await move(page,1720,2200);await move(page,1730,2350);
 await page.keyboard.down('d');
 try { await page.waitForFunction(()=>{const s=(window as any).__farwind(),e=s.enemies.find((e:any)=>e.id==='wild-orchard-worm-a');return e?.behavior.attack&&!e.behavior.attack.cancelled&&e.behavior.attack.contactAt-s.skillGrowth.sim>800;}); } finally { await page.keyboard.up('d'); }
 // 截图先于大份状态序列化，确保拍到实际前摇而不是收招。
 await page.screenshot({path:`${root}/burrow-telegraph.png`});
 const before=(await read(page)).state.player.hp;await snap('潜地虫攻击前的地表预兆','burrow-warning');await page.keyboard.down('w');await page.waitForTimeout(650);await page.keyboard.up('w');await page.waitForTimeout(800);expect((await read(page)).state.player.hp).toBe(before);await snap('正常移动离开预警路径后未受伤','burrow-dodge');
 await move(page,1880,2340);await fight(page,['wild-orchard-worm-a','wild-orchard-worm-b']);await snap('潜地虫战斗结束与药草掉落','burrows-cleared');
 const s=(await read(page)).state;for(const id of ['west-track-pack','north-stone-watch','south-orchard-burrows'])expect(s.encounters.groups[id].cleared).toBe(true);expect(s.xiaobao.task).toBe('free');
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'保存旅途',exact:true}).click();await expect(page.locator('#toast')).toContainText('已保存');await page.reload();await page.getByRole('button',{name:'继续旅途',exact:true}).click();await page.waitForFunction(()=>(window as any).__farwind().mode==='');
 const restored=(await read(page)).state;for(const id of ['west-track-pack','north-stone-watch','south-orchard-burrows'])expect(restored.encounters.groups[id].cleared).toBe(true);expect(restored.bag).toEqual(s.bag);expect(errors).toEqual([]);await snap('保存重开后新敌人结果保持','reloaded');report.结果='通过';writeFileSync(`${root}/browser.json`,JSON.stringify(report,null,2));
});
