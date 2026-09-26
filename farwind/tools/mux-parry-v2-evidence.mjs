import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const dir='docs/parry-v2/evidence',raw='.parry-local/v2/recording';
const videos=[];
for(const name of ['success-combo','failure-rescue','adventure','two-enemies','visual-auto-only','visual-perfect-combo','visual-motion-muted','visual-dash-cancel']){
 const meta=JSON.parse(await readFile(`${dir}/${name}-media.json`)),offset=meta.音频偏移秒,path=`${dir}/${name}.mp4`;
 // 仅同步真实采集音轨并裁去加载片段；不改速度、音量，不补合成声音。
 const result=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',`${raw}/${name}-video.webm`,'-itsoffset',String(offset),'-i',`${raw}/${name}-audio.webm`,'-ss',String(offset),'-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','fast','-crf','24','-c:a','aac','-b:a','128k','-shortest','-movflags','+faststart',path],{encoding:'utf8'});
 if(result.status!==0)throw Error(`实际音轨同步失败：${name}，${result.stderr}`);
 const probe=JSON.parse(spawnSync('ffprobe',['-v','quiet','-show_streams','-show_format','-of','json',path],{encoding:'utf8'}).stdout),volume=spawnSync('ffmpeg',['-hide_banner','-i',path,'-af','volumedetect','-vn','-f','null','-'],{encoding:'utf8'}).stderr;
 videos.push({文件:path,说明:name==='visual-motion-muted'?'明确静音的纯视觉用例；零信号维持采集时钟，不作为带音轨示例':'正常速度，实际游戏音轨',时长秒:Number(probe.format.duration),大小字节:Number(probe.format.size),画面:probe.streams.filter(s=>s.codec_type==='video').map(s=>({宽:s.width,高:s.height,帧率:s.avg_frame_rate})),音轨:probe.streams.filter(s=>s.codec_type==='audio').map(s=>({编码:s.codec_name,采样率:s.sample_rate,声道:s.channels})),峰值分贝:Number(volume.match(/max_volume: ([\d.-]+) dB/)?.[1]??NaN),同步偏移秒:offset});
 console.log(`已核查正常速度及实际音轨：${name}`);
}
await writeFile(`${dir}/media-summary.json`,JSON.stringify({说明:'编码及信号检查；不代表人工试听舒适度或用户手感认可',录像:videos},null,2));
const validations=[];
for(const [name,path] of [['首次完整回归','.parry-local/v2/full-results.json'],['第二次完整回归','.parry-local/v2/full-second-results.json'],['第三次完整回归','.parry-local/v2/full-third-results.json'],['最终完整回归','.parry-local/v2/final-results.json'],['首次画面驱动测试','.parry-local/v2/visual-results.json'],['修复后的画面驱动测试','.parry-local/v2/visual-results-second.json'],['最终文案与表现复核','.parry-local/v2/visual-final-results.json'],['安全资格与攻防链复核','.parry-local/v2/delivery-results.json'],['并行代码共存复核','.parry-local/v2/coexistence-results.json'],['生产构建真实操作','.parry-local/v2/production-results.json'],['碰撞角修复后攻防链','.parry-local/v2/corner-final-results.json'],['碰撞角修复后生产操作','.parry-local/v2/corner-production-results.json']]){
 const j=JSON.parse(await readFile(path));validations.push({阶段:name,开始:j.stats.startTime,耗时毫秒:j.stats.duration,通过:j.stats.expected,失败:j.stats.unexpected,跳过:j.stats.skipped,重试通过:j.stats.flaky});
}
await writeFile(`${dir}/tests-summary.json`,JSON.stringify({说明:'真实运行结果；失败首因和原始追踪保留在忽略目录，没有自动重试',验证:validations},null,2));
