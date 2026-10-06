"""同机位、同主体比例、无攻击特效的新旧动作对照。"""
import json,subprocess,bisect,hashlib
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1];NEW=ROOT/'docs/east-boss-motion-v2';OLD=ROOT/'docs/east-boss-animation';OUT=NEW/'evidence'
lookups=[]
for base in [OLD,NEW]:
 lookup={};digest=hashlib.sha256((base/'source/east-boss-animation-render.blend').read_bytes()).hexdigest()
 for path in (base/'source').glob('frames-*.json'):
  data=json.loads(path.read_text())
  if data.get('sourceHash')!=digest:continue
  for f in data['frames']:lookup.setdefault((f['clip'],f['direction']),{})[f['time']]=f
 lookups.append({key:sorted(value.values(),key=lambda f:f['time']) for key,value in lookup.items()})
font=ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc',28);small=ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc',22)
seqs=[ [('idle',400,0),('start',200,0),('walk',800,0),('turn-right',240,1),('walk',360,1),('cross-left',1170,1),('cross-link',160,1),('cross-right',1170,1),('exposed',600,1),('recover',300,1),('idle',600,1)], [('idle',400,0),('start',200,0),('walk',800,0),('walk-turn-right-left',200,0),('walk',400,1),('cross-left',1030,1),('cross-right',820,1),('exposed',1000,1),('recover',300,1),('idle',850,1)] ]
assert all(sum(v[1] for v in s)==6000 for s in seqs)
cache={}
def raster(version,clip,direction,time):
 fs=lookups[version][clip,direction];f=fs[max(0,bisect.bisect_right([f['time'] for f in fs],time)-1)];key=(version,f['file'])
 if key not in cache:
  im=Image.open([OLD,NEW][version]/f['file']).convert('RGBA');scale=.58;im=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS);cache[key]=(im,(round(f['root'][0]*scale),round(f['root'][1]*scale)))
 return cache[key]
def compose(direction,name,parry=False):
 proc=subprocess.Popen(['ffmpeg','-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s','1920x1080','-r','60','-i','-','-an','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-movflags','+faststart',str(OUT/name)],stdin=subprocess.PIPE)
 sequences=seqs if not parry else [[('cross-left',750,0),('perfect',1000,0),('recover',300,0),('idle',450,0),('cross-right',750,0),('parry',1000,0),('recover',300,0),('idle',450,0)],[('cross-left',750,0),('perfect-left',1000,0),('recover',300,0),('idle',450,0),('cross-right',400,0),('parry-right',1000,0),('recover',300,0),('idle',800,0)]]
 duration=sum(v[1] for v in sequences[0])
 for frame in range(round(duration*.06)):
  im=Image.new('RGB',(1920,1080),(25,36,33));draw=ImageDraw.Draw(im);draw.line((960,30,960,1050),fill=(85,110,95),width=2)
  for version in [0,1]:
   t=frame*1000/60
   for clip,length,d in sequences[version]:
    if t<length:break
    t-=length
   x=480+960*version;y=915;draw.ellipse((x-190,y-40,x+190,y+38),fill=(14,25,23));draw.line((version*960+30,y,version*960+930,y),fill=(62,80,68),width=2)
   body,root=raster(version,clip,(d+direction)%8,t);im.paste(body,(x-root[0],y-root[1]),body)
   draw.text((version*960+40,40),('现版' if version==0 else '精修版')+' · '+('侧面检查' if direction else '游戏机位'),font=font,fill=(218,232,213));draw.text((version*960+40,90),'相同主体比例；关闭攻击特效；采用各自实际时序',font=small,fill=(168,189,176));draw.text((version*960+40,1000),f'动作：{clip}    时间：{frame/60:.2f} 秒',font=small,fill=(205,220,203))
  proc.stdin.write(im.tobytes())
  if not parry and direction==0 and frame in [90,140,174,190,220]:im.save(OUT/f'comparison-{frame:03d}.jpg',quality=95)
 proc.stdin.close();assert proc.wait()==0;cache.clear()
compose(0,'motion-comparison-normal.mp4');compose(2,'motion-comparison-side.mp4');compose(0,'parry-comparison.mp4',True)
subprocess.run(['ffmpeg','-y','-v','error','-i',str(OUT/'motion-comparison-normal.mp4'),'-vf','setpts=4*PTS','-r','60','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(OUT/'motion-comparison-quarter.mp4')],check=True)
print('已输出正常、慢放、侧面和弹反对照。')
