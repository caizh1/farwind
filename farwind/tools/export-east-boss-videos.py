"""用交付母版生成正常速度、四分之一慢放、侧面动作检查与八方向细节。"""
import json,subprocess,bisect
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'docs/east-boss-animation';OUT=BASE/'evidence'
records=json.loads((BASE/'source/frames-all-0-1-2-3-4-5-6-7.json').read_text())['frames']
lookup={}
for f in records:lookup.setdefault((f['clip'],f['direction']),[]).append(f)
for fs in lookup.values():fs.sort(key=lambda f:f['time'])
font=ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc',28)
small=ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc',22)
sequence=[('idle',400),('start',200),('walk',600),('cross-left',1170),('cross-link',160),('cross-right',1170),('exposed',1200),('recover',300),('idle',800)]
assert sum(d for _,d in sequence)==6000
cache={}
def raster(clip,direction,time,scale):
 fs=lookup[clip,direction];f=fs[max(0,bisect.bisect_right([f['time'] for f in fs],time)-1)];key=(f['file'],scale)
 if key not in cache:
  im=Image.open(BASE/f['file']).convert('RGBA');im=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS);cache[key]=(im,(round(f['root'][0]*scale),round(f['root'][1]*scale)))
 return cache[key]
def video(direction,name):
 cmd=['ffmpeg','-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s','1920x1080','-r','60','-i','-','-an','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-movflags','+faststart',str(OUT/name)]
 proc=subprocess.Popen(cmd,stdin=subprocess.PIPE)
 for frame in range(360):
  t=frame*1000/60
  for clip,duration in sequence:
   if t<duration:break
   t-=duration
  im=Image.new('RGB',(1920,1080),(25,36,33));draw=ImageDraw.Draw(im);draw.ellipse((710,840,1210,960),fill=(14,25,23));draw.line((120,910,1800,910),fill=(62,80,68),width=2)
  body,root=raster(clip,direction,t,.72);im.paste(body,(960-root[0],910-root[1]),body)
  draw.text((54,42),'东侧首领 · '+('游戏视角' if direction==0 else '侧面检查')+' · 母版动作序列',font=font,fill=(218,232,213));draw.text((54,91),'关闭攻击特效；用于检查动作，实战录像另行交付。',font=small,fill=(168,189,176));draw.text((54,1000),f'片段：{clip}    时间：{frame/60:.2f} 秒',font=small,fill=(205,220,203));proc.stdin.write(im.tobytes())
 proc.stdin.close();assert proc.wait()==0
video(0,'animation-normal.mp4');cache.clear();video(2,'animation-side.mp4')
subprocess.run(['ffmpeg','-y','-v','error','-i',str(OUT/'animation-normal.mp4'),'-vf','setpts=4*PTS','-r','60','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(OUT/'animation-quarter.mp4')],check=True)
contact=Image.new('RGB',(2400,1440),(25,36,33));draw=ImageDraw.Draw(contact)
for d in range(8):
 body,root=raster('idle',d,0,.47);x=(d%4)*600+300;y=(d//4)*720+640;contact.paste(body,(x-root[0],y-root[1]),body);draw.text((d%4*600+30,d//4*720+20),f'真实方向 {d+1}',font=font,fill=(218,232,213))
contact.save(OUT/'eight-directions.jpg',quality=95)
print('已输出三部 1080p／60fps 动作检查视频与八方向图。')
