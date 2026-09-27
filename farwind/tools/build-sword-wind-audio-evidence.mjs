import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync,spawnSync} from 'node:child_process';

const dir='docs/sword-wind/evidence',raw='.sword-wind-local/recording';
const run=(command,args)=>execFileSync(`/opt/homebrew/bin/${command}`,args,{encoding:'utf8'});
const records=[];
for(const name of ['wind-howl-game','wind-howl-pause-mute']){
 const starts=JSON.parse(await readFile(`${dir}/${name}-starts.json`,'utf8'));
 const video=JSON.parse(run('ffprobe',['-v','quiet','-show_entries','format=duration:format_tags=creation_time','-of','json',`${raw}/${name}-video.webm`]));
 const origin=Date.parse(video.format.tags.creation_time)/1000,offset=starts.音频开始墙钟秒-origin;
 if(!Number.isFinite(offset)||offset<0)throw new Error('无法核对音视频墙钟起点');
 const output=`${dir}/${name}.mp4`;
 run('ffmpeg',['-y','-hide_banner','-loglevel','error','-i',`${raw}/${name}-video.webm`,'-itsoffset',String(offset),'-i',`${raw}/${name}-audio.webm`,'-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','fast','-crf','23','-c:a','aac','-b:a','160k','-af','apad','-t',video.format.duration,'-movflags','+faststart',output]);
 const media=JSON.parse(run('ffprobe',['-v','quiet','-show_streams','-show_format','-of','json',output]));
 const analysis=spawnSync('/opt/homebrew/bin/ffmpeg',['-hide_banner','-i',`${raw}/${name}-audio.webm`,'-af','volumedetect','-f','null','-'],{encoding:'utf8'});
 if(analysis.status!==0)throw new Error('实际音轨信号分析失败');
 const peak=Number(analysis.stderr.match(/max_volume:\s*([-\d.]+)/)?.[1]);
 const mean=Number(analysis.stderr.match(/mean_volume:\s*([-\d.]+)/)?.[1]);
 if(!Number.isFinite(peak)||peak>=0||!Number.isFinite(mean))throw new Error('实际音轨无有效信号或发生满幅削波');
 records.push({录像:output,说明:'实际五一七三实例的独立合法共线夹具；真实键盘和菜单，正常比例、正常速度。音轨来自游戏总线，没有后配试听文件。隔离测试标签屏蔽并行编辑的热更新通知。',音频墙钟偏移秒:offset,视频秒:Number(media.format.duration),画面:media.streams.filter(s=>s.codec_type==='video').map(s=>({宽:s.width,高:s.height,帧率:s.avg_frame_rate})),音轨:media.streams.filter(s=>s.codec_type==='audio').map(s=>({格式:s.codec_name,声道:s.channels,采样率:s.sample_rate})),总线峰值分贝:peak,总线均值分贝:mean,释放声源:starts.释放声源,主观音色试听:'当前环境不能主观听辨；等待用户试听判断。'});
 if(name==='wind-howl-game')run('ffmpeg',['-y','-hide_banner','-loglevel','error','-ss',String(offset+starts.释放声源[0].时刻+.07),'-i',output,'-frames:v','1',`${dir}/wind-howl-game.png`]);
}
await writeFile(`${dir}/wind-howl-media-check.json`,JSON.stringify({说明:'以浏览器录像创建时间和实际录音启动墙钟对齐；不使用导航后的性能计时作为录像起点。',记录:records},null,2)+'\n');
console.log('风呼啸实机录像及中文音轨检查索引已生成。');
