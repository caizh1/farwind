import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const dir='docs/parry/evidence/native',raw='.parry-local/native-recording';
for(const name of ['success-combo','failure-rescue','adventure','two-enemies']){
 const meta=JSON.parse(await readFile(`${dir}/${name}-media.json`)),offset=meta.音频偏移秒;
 // 只同步实际采集音轨并裁去加载前片段，不调游戏速度、画面速度或声音增益。
 const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',`${raw}/${name}-video.webm`,'-itsoffset',String(offset),'-i',`${raw}/${name}-audio.webm`,'-ss',String(offset),'-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','fast','-crf','24','-c:a','aac','-b:a','128k','-shortest','-movflags','+faststart',`${dir}/${name}.mp4`],{stdio:'inherit'});
 if(r.status!==0)throw Error(`合成失败：${name}`);
 console.log(`已同步真实音轨：${name}`);
}
const validations=[];
for(const [name,path] of [['完整浏览器回归','.parry-local/final-results.json'],['原生渲染录制与失焦验收','.parry-local/native-results.json'],['无调试覆盖层的正常冒险示例','.parry-local/native-examples.json'],['生产包操作','.parry-local/production-results.json']]){
 const j=JSON.parse(await readFile(path));validations.push({阶段:name,开始:j.stats.startTime,耗时毫秒:j.stats.duration,通过:j.stats.expected,失败:j.stats.unexpected,跳过:j.stats.skipped,重试通过:j.stats.flaky});
}
await writeFile('docs/parry/evidence/tests-summary.json',JSON.stringify({说明:'实际运行结果；原始自动化报告留在忽略目录',验证:validations},null,2));
const probe=JSON.parse(await readFile('.parry-local/native-render-probe.json'));await writeFile('docs/parry/evidence/native-render.json',JSON.stringify({说明:probe.说明,采样墙钟毫秒:probe.after.墙钟-probe.before.墙钟,采样模拟毫秒:probe.after.模拟-probe.before.模拟,模拟墙钟比:probe.模拟墙钟比,限制:'仅核查录制环境短时正常推进，不是长期性能或目标设备验收'},null,2));
