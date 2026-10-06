# 从正式键鼠录像裁剪完整招式；慢放只延长时间，不生成额外动作细节。
import json
import subprocess
from pathlib import Path
root=Path('docs/east-boss-combat-enhancement/evidence')
files=[]
def run(args):
 subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y',*args],check=True)
def settings(name):
 data=json.loads((root/(name+'.json')).read_text());samples=data['样本'];first=next(s for s in samples if (s.get('boss') or {}).get('attack'))
 start=max(0,first['录像时间毫秒']/1000-.15);duration=samples[-1]['录像时间毫秒']/1000-start+.15
 return start,duration
scale='scale=-2:1080,pad=1920:1080:(ow-iw)/2:0:color=black,setsar=1'
for name,out in [('baseline-continuous','baseline'),('laser-continuous','laser'),('scythe-continuous','scythe')]:
 start,duration=settings(name)
 for slow in ([1] if out=='baseline' else [1,4]):
  dest=root/(out+('-normal' if slow==1 else '-quarter')+'.mp4')
  run(['-ss',str(start),'-t',str(duration),'-i',str(root/(name+'.webm')),'-an','-vf',f'setpts={slow}*(PTS-STARTPTS),{scale},fps=60','-c:v','libx264','-preset','fast','-crf','21','-movflags','+faststart',str(dest)])
  files.append({'文件':dest.name,'字节':dest.stat().st_size,'时间倍率':slow});print('已导出',dest.name,flush=True)
old_start,old_duration=settings('baseline-continuous');new_start,new_duration=settings('laser-continuous')
for slow in [1,4]:
 dest=root/('combat-comparison'+('-quarter' if slow==4 else '')+'.mp4')
 graph=f'[0:v]setpts={slow}*(PTS-STARTPTS),scale=960:666,pad=960:1080:0:207:color=black,setsar=1,tpad=stop_mode=clone:stop_duration={new_duration*slow}[old];[1:v]setpts={slow}*(PTS-STARTPTS),scale=960:666,pad=960:1080:0:207:color=black,setsar=1[new];[old][new]hstack=inputs=2,fps=60[out]'
 run(['-ss',str(old_start),'-t',str(old_duration),'-i',str(root/'baseline-continuous.webm'),'-ss',str(new_start),'-t',str(new_duration),'-i',str(root/'laser-continuous.webm'),'-filter_complex',graph,'-map','[out]','-t',str(new_duration*slow),'-an','-c:v','libx264','-preset','fast','-crf','21','-movflags','+faststart',str(dest)])
 files.append({'文件':dest.name,'字节':dest.stat().st_size,'时间倍率':slow});print('已导出',dest.name,flush=True)
(root/'video-output.json').write_text(json.dumps({'说明':'原始浏览器录像为1440×1000、25帧每秒；输出1920×1080、60帧每秒。增加输出帧数仅重复已有录屏帧，不补间，不代表游戏内部帧率。对照左旧右新，旧版较早结束后保持末帧。','文件':files},ensure_ascii=False,indent=2))
