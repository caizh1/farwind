import {ENCOUNTERS,encounterUnit} from "../src/data/maps/windbell/encounters";
import type {Page} from "@playwright/test";
const read=(page:Page)=>page.evaluate(()=>(window as any).__farwind());
// 只从诊断快照读取敌人位置；走路、攻击、喝药、领取任务均用正式键鼠。
export async function fight(page:Page,ids:string[]){
 for(let i=0;i<360;i++){
  const s=await read(page),targets=s.enemies.filter((e:any)=>ids.includes(e.id)&&e.hp>0).sort((a:any,b:any)=>Math.hypot(a.x-s.state.player.x,a.y-s.state.player.y)-Math.hypot(b.x-s.state.player.x,b.y-s.state.player.y));
  if(ids.every(id=>{const m=encounterUnit(id)!;return s.state.encounters.groups[m.group].members[ENCOUNTERS.find(d=>d.id===m.group)!.members.findIndex(u=>u.id===id)].defeated;}))return;
  if(!targets.length){await page.waitForTimeout(100);continue;}
  if(s.mode){throw Error(`战斗被界面中断：${s.mode}`);}
  const e=targets[0],p=s.state.player;
  if(p.hp<48){await page.keyboard.press("1");await page.waitForTimeout(80);}
  const dx=e.x-p.x,dy=e.y-p.y,key=Math.abs(dx)>Math.abs(dy)?dx<0?"a":"d":dy<0?"w":"s";
  await page.waitForFunction(()=>(window as any).__farwind().defenseSaving===false);
  await page.keyboard.down(key);await page.waitForTimeout(Math.hypot(dx,dy)>90?110:15);await page.keyboard.up(key);
  await page.keyboard.press("j");await page.waitForTimeout(155);
 }
 throw Error("正常攻击未能在限定操作数内清理遭遇。");
}
