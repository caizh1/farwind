"""整理真实操作记录、生成视频成品与性能汇总；不补写游戏事件。"""
import json,subprocess
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/east-boss-animation/evidence'
def run(args):subprocess.run(['ffmpeg','-y','-v','error',*args],check=True)
for name in ['full-battle-01','full-battle-02','full-battle-03','parry-gameplay','perfect-gameplay','death-gameplay','png-gameplay','ritual-gameplay','directions-first','directions-second','retreat-gameplay']:
 run(['-i',str(OUT/(name+'.webm')),'-r','60','-an','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',str(OUT/(name+'.mp4'))])
run(['-i',str(OUT/'full-battle-01.mp4'),'-i',str(OUT/'full-battle-02.mp4'),'-i',str(OUT/'full-battle-03.mp4'),'-filter_complex','[0:v]setpts=PTS-STARTPTS[a];[1:v]setpts=PTS-STARTPTS[b];[2:v]setpts=PTS-STARTPTS[c];[a][b][c]concat=n=3:v=1:a=0','-r','60','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart',str(OUT/'full-battle.mp4')])
run(['-ss','0','-t','4.5','-i',str(OUT/'new-comparison.mp4'),'-vf','setpts=4*PTS','-r','60','-c:v','libx264','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart',str(OUT/'game-quarter.mp4')])
# 对照记录只比较相同长度的前二十四秒；整场的保存停顿另行完整记录。
def stats(frames):
 s=sorted(frames);return {'样本数':len(s),'中位毫秒':s[len(s)//2],'百分之九十五毫秒':s[int(len(s)*.95)],'最大毫秒':max(s)}
def first_frames(d,limit):
 rows=[];t=0
 for dt in d['帧间隔原始']:
  t+=dt
  if t>limit:break
  rows.append(dt)
 return rows
names=['new-comparison','parry-gameplay','perfect-gameplay','roots-gameplay','shift-gameplay','ritual-gameplay','phase-two-gameplay','directions-first','directions-second','retreat-gameplay','death-gameplay','png-gameplay','full-battle-01','full-battle-02','full-battle-03']
summary={};directions=set();skills=set();phases=set();poses=set();peak=0;failures=0
for name in names:
 d=json.loads((OUT/(name+'.json')).read_text());rows=[r for r in d['采样'] if r['首领'] and r['首领']['动画']['continuous']['mode']=='八方向预渲染动画'];arts=[r['首领']['动画']['continuous'] for r in rows]
 for r in rows:
  a=r['首领']['动画']['continuous'];directions.add(a['pose']['direction']);poses.add(a['pose']['clip']);b=r['首领']['战斗'];phases.add(b['battle']['phase'])
  if b.get('attack'):skills.add(b['attack']['skill'])
 if arts:
  latest=arts[-1]['resources'];peak=max(peak,latest['peakBytes']);failures=max(failures,latest['failedPages']);summary[name]={'帧间隔':d['帧间隔'],'最后资源统计':latest,'首领初末生命':[rows[0]['首领']['生命'],rows[-1]['首领']['生命']],'结束据点阶段':d['采样'][-1]['据点']['stage']}
legacy=json.loads((OUT/'legacy-comparison.json').read_text());new=json.loads((OUT/'new-comparison.json').read_text())
full=[dt for name in ['full-battle-01','full-battle-02','full-battle-03'] for dt in json.loads((OUT/(name+'.json')).read_text())['帧间隔原始']]
report={'说明':'数据来自正式世界的只读记录和键鼠操作；使用独立初始存档，未在运行中修改生命、坐标、时钟或击杀结果。整场录像分三段，段间暂停归档。','设备':'Apple M5 Pro，48 GiB 内存，macOS 内置浏览器','视口':legacy['视口'],'画布':legacy['画布'],'同长度前二十四秒':{'旧版':stats(first_frames(legacy,24000)),'新版':stats(first_frames(new,24000))},'整场含胜利保存':stats(full),'已实际观察方向':sorted(directions),'已实际观察招式':sorted(skills),'已实际观察阶段':sorted(phases),'已实际观察片段':sorted(poses),'最大驻留及预载字节':peak,'加载失败页数':failures,'逐记录':summary,'边界':'并发纹理解包缓冲和图片解码计数不等于浏览器进程总内存。弱网、低端设备与独立显存分析器未验收；无损传输压缩之前的对照录像保留原始统计。'}
(OUT/'gameplay-summary.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
# 小型检查条带取自交付视频，不修改角色渲染。
film=Image.new('RGB',(1920,1080),(20,36,29));font=ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc',19);draw=ImageDraw.Draw(film)
for i,(name,t) in enumerate([('animation-normal',.1),('animation-normal',1.5),('animation-normal',1.94),('animation-normal',2.47),('animation-normal',2.94),('animation-normal',3.32),('animation-normal',4.4),('animation-normal',5.5),('animation-side',1.94),('animation-side',3.32),('death-gameplay',1.8),('perfect-gameplay',2.9)]):
 p=OUT/'inspection-frame.jpg';run(['-ss',str(t),'-i',str(OUT/(name+'.mp4')),'-frames:v','1',str(p)]);im=Image.open(p).resize((480,270));film.paste(im,((i%4)*480,(i//4)*360+40));draw.text(((i%4)*480+14,(i//4)*360+12),f'检查 {i+1} · {t} 秒',font=font,fill='white')
film.save(OUT/'motion-contact-sheet.jpg',quality=95)
print(json.dumps({k:v for k,v in report.items() if k!='逐记录'},ensure_ascii=False),flush=True)
