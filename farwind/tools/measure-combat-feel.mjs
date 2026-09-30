import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';

// 有界、同装备、同策略对照。预设只建立初始条件，结果由真实键盘和正式伤害产生。
const baseline=process.env.COMBAT_FEEL_VERSION==='baseline',version=baseline?'baseline':'candidate',dir='docs/combat-feel/demo/validation';
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1280,height:720}}),results=[];
try{
 await page.goto(`http://127.0.0.1:${baseline?5213:5212}/?combatFeel=1&combatVersion=${version}`);await page.waitForFunction(()=>window.__combatFeel,null,{timeout:60000});
 for(const preset of ['slime','guardian','spore','boar']){
  await page.evaluate(async preset=>window.__combatFeel.reset(preset,false),preset);await page.waitForFunction(()=>window.__combatFeel.status().sim>120);
  const read=()=>page.evaluate(()=>window.__farwind()),first=await read(),id=first.enemies[0].id,start=first.session.sim,begun=Date.now(),samples=[],hits=[],attacks=new Set();let previous=null,idle=0,finish=null;
  while(Date.now()-begun<45000){
   const s=await read(),c=s.session.combat,e=s.enemies.find(e=>e.id===id),row={模拟:s.session.sim,墙钟:performance.now(),生命:e?.hp??0,玩家生命:s.state.player.hp,位置:{...s.state.player},阶段:c.phase,攻击序号:s.attackSerial,预约:c.buffered||!!c.parryBuffered,风步:c.dashRemaining,受击:!!c.hurt?.active};
   if(previous){if(row.生命<previous.生命){hits.push({模拟:row.模拟,实际损失:previous.生命-row.生命,攻击序号:row.攻击序号});attacks.add(row.攻击序号);}
    if(row.阶段==='idle'&&previous.阶段==='idle'&&!row.预约&&!previous.预约&&!row.风步&&!previous.风步&&!row.受击&&!previous.受击&&Math.hypot(row.位置.x-previous.位置.x,row.位置.y-previous.位置.y)<.5)idle+=Math.max(0,row.模拟-previous.模拟);}
   samples.push(row);previous=row;
   if(e?.hp===0||s.state.killed.includes(id)){finish=row.模拟;break;}
   if(s.mode||Math.hypot(s.state.player.x-first.state.player.x,s.state.player.y-first.state.player.y)>600){break;}
   if(c.hurt?.active){await page.waitForTimeout(50);continue;}
   const dx=e.x-s.state.player.x,dy=e.y-s.state.player.y,key=Math.abs(dx)>Math.abs(dy)?dx<0?'a':'d':dy<0?'w':'s',distance=Math.hypot(dx,dy);
   if(c.stage===0&&s.warnings.some(w=>w.id.startsWith(id)&&w.lead!==null&&w.lead>150&&w.lead<210)&&c.parryCooldownRemaining<=0)await page.keyboard.press('k');
   else if(distance>85&&c.stage===0&&!c.parry){await page.keyboard.down(key);if(c.dashLegalAt<=s.session.sim&&s.state.player.stamina>=20)await page.keyboard.press('l');await page.waitForTimeout(70);await page.keyboard.up(key);}
   else{if(c.stage===0){await page.keyboard.down(key);await page.waitForTimeout(20);await page.keyboard.up(key);}if(!c.buffered&&(c.stage<3||s.session.attackUntil-s.session.sim<140))await page.keyboard.press('j');}
   await page.waitForTimeout(60);
  }
  results.push({样板:preset,目标:id,初始生命:first.enemies[0].hp,剑风:false,装备:first.state.equipment??first.state.gear,有效伤害动作:attacks.size,实际发动攻击:(await read()).attackSerial-first.attackSerial,击杀模拟毫秒:finish===null?null:finish-start,采样空等模拟毫秒:idle,观察墙钟毫秒:Date.now()-begun,完成:finish!==null,伤害:hits,采样:samples});
  console.log(JSON.stringify({版本:version,样板:preset,完成:finish!==null,有效伤害动作:attacks.size,击杀模拟毫秒:finish===null?null:finish-start,采样空等模拟毫秒:idle}));
 }
 await writeFile(`${dir}/enemy-metrics-${version}.json`,JSON.stringify({说明:'四类单怪，同初始无装备加成、剑风关闭、同真实按键策略。生命差仅作观测，不写入状态；隔离单怪无伙伴/守卫伤害。有效动作按发生真实生命差的攻击序号去重；空等为相邻采样均无动作/预约/移动的模拟间隔，采样可能漏计，不能当作逐帧真值。45秒墙钟仍未击杀则保留未完成，不补写结果。每行墙钟由工具单独采集，仅同钟统计，不能和模拟时间混减。',版本:version,结果:results},null,2));
}finally{await browser.close();}
