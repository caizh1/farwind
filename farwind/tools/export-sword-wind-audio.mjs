import {mkdir,writeFile} from 'node:fs/promises';
import {synthSwordWindHowl,SWORD_WIND_AUDIO} from '../src/game/systems/swordWindAudio.ts';
const dir='docs/sword-wind/assets/audio';await mkdir(dir,{recursive:true});
const samples=synthSwordWindHowl(),frames=samples[0].length;
// 按实际默认游戏音量导出，不用满幅归一化试听冒充游戏中的响度。
const gain=.25,buffer=Buffer.alloc(44+frames*4);
buffer.write('RIFF',0);buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(2,22);buffer.writeUInt32LE(SWORD_WIND_AUDIO.rate,24);buffer.writeUInt32LE(SWORD_WIND_AUDIO.rate*4,28);buffer.writeUInt16LE(4,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(frames*4,40);
let peak=0,energy=0;
for(let i=0;i<frames;i++)for(let channel=0;channel<2;channel++){const v=samples[channel][i]*gain;buffer.writeInt16LE(Math.round(v*32767),44+(i*2+channel)*2);peak=Math.max(peak,Math.abs(v));energy+=v*v;}
await writeFile(`${dir}/wind-howl.wav`,buffer);
await writeFile(`${dir}/howl-metadata.json`,JSON.stringify({说明:'原创程序合成风呼啸；48千赫双声道16位，按默认游戏音量导出。没有采样第三方录音；游戏直接预生成相同波形，不额外网络加载。用户音色认可待验。',文件:'wind-howl.wav',持续毫秒:SWORD_WIND_AUDIO.duration*1000,默认游戏音量:gain,采样峰值分贝:20*Math.log10(peak),均方根分贝:20*Math.log10(Math.sqrt(energy/(frames*2))),结构:['低频风压','卷起后掠走的变频共振风体','短刃缘气流','轻微立体宽度与快速尾部消隐'],源码:'src/game/systems/swordWindAudio.ts',生成命令:'node tools/export-sword-wind-audio.mjs'},null,2)+'\n');
console.log('风呼啸试听文件和中文制作元数据已生成。');
