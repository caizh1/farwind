"""用交付的透明渲染母版输出正常速度、慢放及八方向动作检查录像。"""
import json
import subprocess
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1];DOC=ROOT/'docs/east-boss-tier-five';OUT=DOC/'evidence';TMP=DOC/'source/preview-frames';TMP.mkdir(exist_ok=True)
records=json.loads((DOC/'source/frames-0-1-2-3-4-5-6-7.json').read_text())['frames'];defs=json.loads((DOC/'source/clips.json').read_text())['clips']
font=ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc',32)
sequence=['summon','vine-enter','vine-left','vine-right','vine-left','vine-right','vine-exit']
frames=0
for clip in sequence:
    source=sorted((f for f in records if f['clip']==clip and f['direction']==0),key=lambda f:f['time']);cache={};draw=ImageDraw.Draw(Image.new('RGB',(1,1)))
    for n in range(round(defs[clip]['duration']*.06)):
        t=n*1000/60;f=min(source,key=lambda f:abs(f['time']-t));path=DOC/f['file']
        if path not in cache:cache[path]=Image.open(path).convert('RGBA').resize((1080,1080),Image.Resampling.LANCZOS)
        bg=Image.new('RGB',(1920,1080),(29,45,39));bg.paste(cache[path],(420,0),cache[path]);d=ImageDraw.Draw(bg);d.text((55,45),'第五档缚枝祭主 · '+defs[clip]['label'],font=font,fill=(233,222,185));d.text((55,100),'交付工程直接渲染 · 关闭攻击特效 · 六十帧每秒',font=font,fill=(160,185,160));bg.save(TMP/f'{frames:05d}.png');frames+=1
subprocess.run(['ffmpeg','-y','-v','error','-framerate','60','-i',str(TMP/'%05d.png'),'-c:v','libx264','-crf','19','-pix_fmt','yuv420p',str(OUT/'animation-normal.mp4')],check=True)
subprocess.run(['ffmpeg','-y','-v','error','-i',str(OUT/'animation-normal.mp4'),'-vf','setpts=4*PTS','-r','60','-c:v','libx264','-crf','20','-pix_fmt','yuv420p',str(OUT/'animation-quarter.mp4')],check=True)
print('已输出正常动作和四分之一慢放。')
