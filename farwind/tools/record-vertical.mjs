import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const dir='docs/animation/round-three';
const browser=await chromium.launch({headless:false,channel:'chrome'});
const context=await browser.newContext({viewport:{width:1280,height:900},recordVideo:{dir:`${dir}/raw`,size:{width:1280,height:900}}});const page=await context.newPage();const samples=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5173/?animationDebug=1');await page.getByRole('button',{name:'启程 · 新游戏'}).click();await page.waitForTimeout(700);
const read=()=>page.evaluate(()=>window.__farwind());
async function hold(keys,ms){for(const k of keys)await page.keyboard.down(k);for(let i=0;i<ms/50;i++){await page.waitForTimeout(50);const s=await read();samples.push({按键:keys,时间:Date.now(),角色:s.animation,会话:s.session,体力:s.state.player.stamina});}for(const k of keys)await page.keyboard.up(k);}
await hold(['a'],470);await hold(['w'],650);
for(const keys of [['Shift','s'],[],['Shift','w'],[],['d','s'],['w','a'],['Shift','d'],['Shift','a'],[]]){await hold(keys,keys.length===0?2000:keys.includes('s')&&keys.includes('Shift')||keys.includes('w')&&keys.includes('Shift')?2000:650);}
await page.screenshot({path:`${dir}/vertical-end.png`});const video=page.video();await context.close();await video.saveAs(`${dir}/vertical-game.webm`);await video.delete();await browser.close();
const hashes={};for(const f of ['src/game/scenes/World.ts','src/game/systems/locomotion.ts','src/data/animation.ts','public/assets/animation/round-three/hero-motion.png','public/assets/animation/round-three/cat-motion.png'])hashes[f]=crypto.createHash('sha256').update(await fs.readFile(f)).digest('hex');await fs.writeFile(`${dir}/vertical-record.json`,JSON.stringify({说明:'真实游戏、有头Chrome、正常速度真实按键；1280×900窗口便于看清猫，不改变游戏HUD或角色尺寸；独立存档、无状态写入',浏览器:browser.version(),摘要:hashes,错误:errors,采样:samples},null,2));if(errors.length)throw Error(errors.join('\n'));
