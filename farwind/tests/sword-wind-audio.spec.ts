import {test,expect,type Page} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {setup,face,third,fourth,read,finish,dir} from './sword-wind-fixtures';

test.use({video:{mode:'on',size:{width:1280,height:720}}});

async function observe(page:Page){
 // 隔离测试标签仍访问实际实例；保留网络与游戏裁决，只屏蔽并行源码编辑的热更新通知。
 await page.routeWebSocket(/ws:\/\/127\.0\.0\.1:5173\//,socket=>{
  const server=socket.connectToServer();
  server.onMessage(message=>{if(typeof message==='string'){const event=JSON.parse(message);if(event.type==='update'||event.type==='full-reload')return;}socket.send(message);});
  socket.onMessage(message=>server.send(message));
 });
 await page.addInitScript(()=>{
  (window as any).__windSoundStarts=[];
  const start=AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start=function(...args:Parameters<typeof start>){
   if(this.buffer?.numberOfChannels===2&&Math.abs(this.buffer.duration-.46)<.001)(window as any).__windSoundStarts.push({时刻:this.context.currentTime,声道:this.buffer.numberOfChannels,帧数:this.buffer.length,采样率:this.buffer.sampleRate});
   return start.apply(this,args);
  };
 });
 await setup(page,0,0,true);await face(page,'d',3);
}
async function save(page:Page,name:string){
 const audioStart=await page.evaluate(()=>(performance.timeOrigin+(window as any).__audioStartedAt)/1000);
 const starts=await page.evaluate(()=>(window as any).__windSoundStarts);
 await finish(page,name);
 await writeFile(`${dir}/${name}-starts.json`,JSON.stringify({说明:'旁路记录真实声源启动，仅观察双声道风呼啸；不强制播放、不改变游戏裁决。',音频开始墙钟秒:audioStart,释放声源:starts},null,2)+'\n');
}
test('WIND-AUDIO-01 真实第四击使用预生成呼啸，首靶结算及音轨采集',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await observe(page);expect((await read(page)).feedback.audio.windCached).toBe(true);
 await third(page);expect((await read(page)).feedback.audio.windVoices).toBe(0);
 await fourth(page);await page.waitForFunction(()=>(window as any).__farwind().feedback.audio.windVoices===1);
 const starts=await page.evaluate(()=>(window as any).__windSoundStarts);expect(starts).toHaveLength(1);expect(starts[0].帧数/starts[0].采样率).toBeCloseTo(.46,4);
 await expect.poll(async()=>(await read(page)).swordWind.events[0]?.target).toBe('wind-arena-A');
 const s=await read(page);expect(s.enemies.find((e:any)=>e.id==='wind-arena-A').hp).toBe(12);expect(s.enemies.find((e:any)=>e.id==='wind-arena-B').hp).toBe(48);
 await expect.poll(async()=>(await read(page)).feedback.audio.windVoices).toBe(0);expect(errors).toEqual([]);
 await save(page,'wind-howl-game');
});
test('WIND-AUDIO-02 暂停停止呼啸，恢复不重播，静音不影响正式剑风裁决',async({page})=>{
 await observe(page);await third(page);await fourth(page);await page.waitForFunction(()=>(window as any).__farwind().feedback.audio.windVoices===1);
 await page.keyboard.press('Escape');await expect(page.getByRole('heading',{name:'在风中歇一会儿'})).toBeVisible();
 await expect.poll(async()=>(await read(page)).feedback.audio.windVoices).toBe(0);
 await page.keyboard.press('Escape');await expect.poll(async()=>(await read(page)).swordWind.events[0]?.target).toBe('wind-arena-A');
 expect(await page.evaluate(()=>(window as any).__windSoundStarts.length)).toBe(1);
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'设置',exact:true}).click();await page.locator('#volume').fill('0');await page.getByRole('button',{name:'返回',exact:true}).click();await page.keyboard.press('Escape');
 await page.waitForFunction(()=>(window as any).__farwind().session.combat.stage===0);
 await third(page);await fourth(page);await expect.poll(async()=>(await read(page)).swordWind.events.length).toBe(2);
 expect(await page.evaluate(()=>(window as any).__windSoundStarts.length)).toBe(1);expect((await read(page)).feedback.audio.windVoices).toBe(0);
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'保存并返回标题',exact:true}).click();expect((await read(page)).feedback.audio.windVoices).toBe(0);
 await save(page,'wind-howl-pause-mute');
});
