import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const version=process.argv[2]??'before';const query=process.argv[3]??'';
const dir=`docs/animation/${version}`;await fs.mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:false,channel:'chrome'});const browserVersion=browser.version();
const context=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:`${dir}/raw`,size:{width:1280,height:720}}});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173/?'+query);await page.getByRole('button',{name:'启程 · 新游戏'}).click();await page.waitForTimeout(800);
const samples=[];let done=false;const sample=async()=>{while(!done){const s=await page.evaluate(()=>window.__farwind());delete s.fps;samples.push({毫秒:Date.now(),...s});await page.waitForTimeout(50)}};const sampling=sample();
const route=[['d',1100],['',650],['a',1900],['d',2300],['',1600],['a',900],['',500],['w',600],['s',600],['',500],['Shift+d',900],['a',1300],['',1500]];
for(const [keys,ms]of route){const list=keys?keys.split('+'):[];for(const k of list)await page.keyboard.down(k);await page.waitForTimeout(ms);for(const k of list.reverse())await page.keyboard.up(k)}
done=true;await sampling;await page.screenshot({path:`${dir}/route-end.png`});const video=page.video();await context.close();await video.saveAs(`${dir}/same-route.webm`);await browser.close();
const files=['src/game/entities/actor.ts','src/game/scenes/World.ts','public/assets/hero.png','public/assets/cat.png','src/game/systems/locomotion.ts','src/game/systems/follower.ts','src/data/animation.ts','public/assets/animation/hero-motion.png','public/assets/animation/cat-motion.png','public/assets/animation/round-two/hero-motion.png','public/assets/animation/round-two/cat-motion.png'];const hashes={};for(const f of files)hashes[f]=crypto.createHash('sha256').update(await fs.readFile(f)).digest('hex');
await fs.writeFile(`${dir}/route-record.json`,JSON.stringify({版本:version,说明:'有头 Chrome，1280×720，真实按键，相同时间路线，正常速度录制；只读快照用于分析，未写游戏状态',浏览器:browserVersion,源码与资产校验:hashes,路线:route,错误:errors,采样:samples},null,2));console.log(`${version}：录制完成，${samples.length} 个状态样本`);
