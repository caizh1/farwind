import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync,spawnSync} from 'node:child_process';
const dir='docs/parry-ranged',raw='.parry-local/ranged/recording';
await mkdir(`${dir}/media`,{recursive:true});
const records=[];
for(const name of ['normal-training','perfect-combo','dash-cancel','wild-spore']){
 const media=JSON.parse(await readFile(`${dir}/${name}-media.json`,'utf8')),frames=JSON.parse(await readFile(`${raw}/${name}-frames.json`,'utf8'));
 const snapshot=JSON.parse(await readFile(`${dir}/${name}.json`,'utf8'));
 const unique=(key,id)=>[...new Map(frames.flatMap(key).map(e=>[id(e),e])).values()];
 snapshot.接触结果=unique(f=>f.接触,e=>e.id);snapshot.剑气事件=unique(f=>f.剑气.events,e=>`${e.id}:${e.at}`);snapshot.反馈事件=unique(f=>f.反馈.events,e=>e.id);
 snapshot.敌方生命变化=[];let previous='';
 for(const f of frames){const targets=f.敌人.map(e=>({编号:e.id,生命:e.hp}));const key=JSON.stringify(targets);if(key!==previous){snapshot.敌方生命变化.push({时间:f.时间,敌人:targets});previous=key;}}
 await writeFile(`${dir}/${name}.json`,JSON.stringify(snapshot,null,2));
 const video=JSON.parse(execFileSync('ffprobe',['-v','quiet','-show_entries','format=duration:format_tags=creation_time','-of','json',`${raw}/${name}-video.webm`],{encoding:'utf8'})),origin=Date.parse(video.format.tags.creation_time)/1000,offset=media.音频开始墙钟秒-origin;
 if(!Number.isFinite(offset))throw Error('录像或录音缺少共同墙钟，不能假设声画零延迟');
 const file=`${dir}/media/${name}.mp4`;
 execFileSync('ffmpeg',['-y','-hide_banner','-loglevel','error','-i',`${raw}/${name}-video.webm`,'-itsoffset',String(offset),'-i',`${raw}/${name}-audio.webm`,'-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-af','apad','-t',video.format.duration,'-movflags','+faststart',file]);
 const analysis=spawnSync('ffmpeg',['-hide_banner','-i',`${raw}/${name}-audio.webm`,'-af','volumedetect','-vn','-f','null','-'],{encoding:'utf8'}).stderr;
 await writeFile(`${raw}/${name}-audio-analysis.log`,analysis);
 const metrics={采样峰值分贝:analysis.match(/max_volume:\s*([\-\d.]+)/)?.[1]??null,全片平均幅度分贝:analysis.match(/mean_volume:\s*([\-\d.]+)/)?.[1]??null};
 const pageOrigin=media.音频开始墙钟秒-media.页面相对偏移秒;
 const beats=snapshot.反馈事件.filter(e=>['parry-contact','parry-perfect-contact','counter-hit'].includes(e.kind)).map(e=>{
  const f=frames.find(f=>f.反馈.events.some(x=>x.id===e.id));
  return {事件:e.kind,模拟时间:e.at,视频位置秒:f?pageOrigin+f.墙钟/1000-origin:null};
 });
 records.push({场景:name,录像:file,正常速度:true,音轨:'实际游戏输出，未补音',音频相对视频起点秒:offset,画面尺寸:'1280×720',重拍:beats,测量:metrics});
}
await writeFile(`${dir}/media-index.json`,JSON.stringify({说明:'以实际采集墙钟合成正常速度录像；峰值为采样峰值，未测真峰值或设备听感。提交时间与设备输出延迟不能视为零。A类按键由只读预测安排，不代表玩家可读性认可。',记录:records},null,2));
