import {mkdir,writeFile} from 'node:fs/promises';
import {synthFeedback,FEEDBACK_AUDIO} from '../src/game/systems/feedbackAudio.ts';
const dir=process.env.FARWIND_AUDIO_EXPORT_DIR??'docs/parry-feedback-v3/assets/audio';await mkdir(dir,{recursive:true});
const records=[];
for(const kind of ['guard-start','enemy-charge','enemy-strike','parry-contact','parry-perfect-contact','deflect-release','counter-swing','counter-hit','afterguard'])for(const material of kind==='counter-hit'?['slime','leaf','straw']:['slime']){
 const samples=synthFeedback(kind,material,0),buffer=Buffer.alloc(44+samples.length*2);buffer.write('RIFF',0);buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(FEEDBACK_AUDIO.rate,24);buffer.writeUInt32LE(FEEDBACK_AUDIO.rate*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(samples.length*2,40);
 let peak=0,sum=0,max=0,early=0;for(let i=0;i<samples.length;i++){buffer.writeInt16LE(Math.round(samples[i]*32767),44+i*2);sum+=samples[i]**2;if(Math.abs(samples[i])>peak){peak=Math.abs(samples[i]);max=i;}if(i<FEEDBACK_AUDIO.rate*.02)early+=samples[i]**2;}
 const path=`${dir}/${kind}${kind==='counter-hit'?`-${material}`:''}.wav`;await writeFile(path,buffer);records.push({身份:kind,材质:material,文件:path,持续毫秒:samples.length/FEEDBACK_AUDIO.rate*1000,采样峰值分贝:20*Math.log10(peak),均方根分贝:20*Math.log10(Math.sqrt(sum/samples.length)),峰值位置毫秒:max/FEEDBACK_AUDIO.rate*1000,前20毫秒能量比例:early/sum});
}
await writeFile(`${dir}/index.json`,JSON.stringify({说明:'原创程序合成原型，48千赫单声道16位；未通过设备试听或用户音色验收。单独音色用于辨识对照，游戏录像仍使用实际AudioContext输出。这里是采样峰值，未称为真峰值。',记录:records},null,2));
console.log('已导出11份原创音色试听原型与采样指标');
