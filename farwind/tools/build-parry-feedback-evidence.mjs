import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync,spawnSync} from 'node:child_process';
const dir='docs/parry-feedback-v3/evidence',raw='.parry-local/v3/recording';
await mkdir(`${dir}/media`,{recursive:true});
await mkdir(`${raw}/screens`,{recursive:true});
const records=[];
for(const name of ['ab-A','ab-B','ab-C','ab-D','perfect-combo','cancel','wild-slime','wild-leaf','two-enemies','leaf-projection','defense','pause-reset','death-newgame']) {
 const media=JSON.parse(await readFile(`${dir}/${name}-media.json`,'utf8')),snapshot=JSON.parse(await readFile(`${dir}/${name}.json`,'utf8'));
 const probe=JSON.parse(execFileSync('ffprobe',['-v','quiet','-show_entries','format=duration:format_tags=creation_time','-of','json',`${raw}/${name}-video.webm`],{encoding:'utf8'}));
 const origin=Date.parse(probe.format.tags.creation_time)/1000,offset=media.音频开始墙钟秒-origin;
 if(!Number.isFinite(offset))throw Error(`${name}缺少录音墙钟，不能用页面时间冒充声画对齐`);
 const output=`${dir}/media/${name}.mp4`;
 execFileSync('ffmpeg',['-y','-hide_banner','-loglevel','error','-i',`${raw}/${name}-video.webm`,'-itsoffset',String(offset),'-i',`${raw}/${name}-audio.webm`,'-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','fast','-crf','23','-c:a','aac','-b:a','160k','-af','apad','-t',probe.format.duration,'-movflags','+faststart',output]);
 const analysis=spawnSync('ffmpeg',['-hide_banner','-i',`${raw}/${name}-audio.webm`,'-af','astats=metadata=1:reset=0,ebur128=peak=true','-f','null','-'],{encoding:'utf8'}).stderr;
 await writeFile(`.parry-local/v3/${name}-audio-analysis.log`,analysis);
 const last=(re)=>[...analysis.matchAll(re)].at(-1)?.[1]??null;
 const metrics={采样峰值分贝:last(/Peak level dB:\s*([\-\d.]+)/g),全片均方根分贝:last(/RMS level dB:\s*([\-\d.]+)/g),真峰值分贝:last(/Peak:\s*([\-\d.]+) dBFS/g),全片综合响度:last(/I:\s*([\-\d.]+) LUFS/g)};
 const pageOrigin=media.音频开始墙钟秒-media.页面相对偏移秒;
 const beats=snapshot.反馈.events.filter(e=>['parry-contact','parry-perfect-contact','counter-hit'].includes(e.kind)).map(e=>{const frame=snapshot.反馈.frames.find(f=>f.id===e.id),audio=snapshot.反馈.audio.events.find(f=>f.id===e.id);return {事件:e.kind,编号:e.id,模拟时间:e.at,画面提交帧:frame?.frame,视频位置秒:frame?pageOrigin+frame.wall/1000-origin:null,音频提交与画面提交差毫秒:audio&&frame?audio.submitted-frame.wall:null,设备报告输出延迟秒:audio?.latency??null};});
 for(const [index,beat] of beats.entries())if(beat.视频位置秒!==null&&index<2)execFileSync('ffmpeg',['-y','-hide_banner','-loglevel','error','-ss',String(beat.视频位置秒),'-i',output,'-frames:v','1',`${name.startsWith('ab-')||name==='perfect-combo'?dir:`${raw}/screens`}/${name}-beat-${index+1}.png`]);
 const clockDeltas=snapshot.反馈.audio.events.map(e=>Math.abs((e.submitted/1000-media.页面相对偏移秒)-(e.scheduled-(media.采集启动音频时刻??0)))*1000);
 records.push({场景:name,录像:output,正常速度:true,音频:'实际游戏输出，未补音',音频相对录像起点秒:offset,采集启动回调延迟毫秒:media.启动回调延迟毫秒,音频渲染时钟与墙钟最大差毫秒:clockDeltas.length?Math.max(...clockDeltas):null,测量:metrics,重拍:beats});
}
await writeFile(`${dir}/media-index.json`,JSON.stringify({说明:'视频25帧每秒、1280×720；原始游戏音轨按采集启动前渲染时钟映射到共同墙钟，不使用异步onstart通知到达时刻。提交时间并非扬声器出声时间，截图提取受视频帧间隔影响。真峰值为FFmpeg ebur128过采样估计；全片LUFS含菜单、静音和连击，不是主观等响验收。',记录:records},null,2));
const contacts=[];
for(const name of ['ab-A','ab-B','ab-C','ab-D']) {
 const snapshot=JSON.parse(await readFile(`${dir}/${name}.json`,'utf8')),media=JSON.parse(await readFile(`${dir}/${name}-media.json`,'utf8'));
 const event=snapshot.反馈.events.find(e=>e.kind==='parry-contact'),frame=snapshot.反馈.frames.find(f=>f.id===event.id),audio=snapshot.反馈.audio.events.find(a=>a.id===event.id);
 const offset=audio?audio.scheduled-media.采集启动音频时刻:frame.wall/1000-media.页面相对偏移秒;
 const pcm=execFileSync('ffmpeg',['-v','error','-ss',String(offset),'-i',`${raw}/${name}-audio.webm`,'-t','0.12','-f','f32le','-ac','1','-ar','48000','-']);
 let square=0,peak=0;for(let i=0;i<pcm.length;i+=4){const sample=pcm.readFloatLE(i);square+=sample*sample;peak=Math.max(peak,Math.abs(sample));}
 contacts.push({场景:name,取样起点秒:offset,观察毫秒:120,均方根分贝:20*Math.log10(Math.sqrt(square/(pcm.length/4))),采样峰值分贝:20*Math.log10(peak)});
}
await writeFile(`${dir}/contact-audio-metrics.json`,JSON.stringify({说明:'成功重拍起音后120毫秒实际输出窗口，包含同刻敌人出手；旧版以呈现提交近似声起点，新版采用音频渲染调度时刻。使用修正后的采集起点；采样峰值与窗口RMS不是主观响度或真峰值。',记录:contacts},null,2));
