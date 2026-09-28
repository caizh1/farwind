import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {move} from './map-navigation';
const stage=process.env.SPORE_VALIDATION_STAGE??'after',dir=`docs/enemy-combat-v1/spore-hit-fix/${stage}`;
const read=(page:Page)=>page.evaluate(()=>(window as any).__farwind());
test.beforeAll(async()=>mkdir(dir,{recursive:true}));
test('stationary-player-brood-projectile',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'启程 · 新游戏',exact:true}).click();
 await page.waitForFunction(()=>(window as any).__farwind?.().mode==='');await expect(page.locator('#toast')).toContainText('风铃村欢迎你');
 await move(page,2550,2260);await move(page,3300,2270);
 const arrived=(await read(page)).session.sim;
 // 行程中锁向的旧弹仍可能命中；只验证停止移动后新开始瞄准的攻击。
 await page.waitForFunction(arrived=>{const e=(window as any).__farwind().enemies.find((e:any)=>e.id==='elite-ashen-brood');return e?.attack&&!e.attack.cancelled&&e.attack.startedAt>arrived;},arrived);
 const before=await read(page);await page.screenshot({path:`${dir}/stationary-before.png`});
 // 之后不发送移动、攻击或架剑输入，只观察正式游戏的实际接触。
 await page.waitForFunction(start=>(window as any).__farwind().session.sim-start>6500,before.session.sim,{timeout:15000});
 const after=await read(page),contacts=after.contacts.filter((c:any)=>c.at>before.session.sim&&c.id.startsWith('elite-ashen-brood')&&c.result==='hurt');
 await page.screenshot({path:`${dir}/stationary-after.png`});
 await writeFile(`${dir}/stationary-validation.json`,JSON.stringify({说明:'正常新游戏，以键盘步行到灰冠母孢；随后不移动、不攻击、不架剑。诊断只读，不注入角色或生命。',阶段:stage==='before'?'修复前缺陷复现':'修复后验证',之前:before,之后:after,母孢实际伤害接触:contacts,错误:errors},null,2));
 expect(errors).toEqual([]);
 if(stage==='before'){expect(contacts).toEqual([]);expect(after.state.player.hp).toBe(before.state.player.hp);}
 else {expect(contacts.length).toBeGreaterThanOrEqual(1);expect(after.state.player.hp).toBeLessThan(before.state.player.hp);}
});
