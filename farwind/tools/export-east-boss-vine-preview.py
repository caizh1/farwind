"""按正式战斗时钟输出旧版与精修版同机位对照，禁止单帧造型修图。"""
import json
import subprocess
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1];DOC=ROOT/'docs/east-boss-vine-refinement';OLD=ROOT/'docs/east-boss-tier-five';OUT=DOC/'evidence';TMP=DOC/'source/preview-frames';TMP.mkdir(exist_ok=True)
records=[json.loads((d/'source/frames-0-1-2-3-4-5-6-7.json').read_text())['frames'] for d in [OLD,DOC]]
font=ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc',30);small=ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc',24)
cache={}
def pose(t):
    if t<850:return 'vine-enter',t/850*1200
    if t<1200:return 'vine-left',324+(t-850)
    if t<1320:return 'vine-left',674+(t-1200)
    if t<1550:return 'vine-left',794+(t-1320)*206/230
    if t<1850:return 'vine-right',(t-1550)*324/300
    if t<2200:return 'vine-right',324+(t-1850)
    if t<2320:return 'vine-right',674+(t-2200)
    return 'vine-exit',min(900,t-2320)
for n in range(round(3220*.06)):
    t=n*1000/60;clip,at=pose(t);canvas=Image.new('RGB',(1920,1080),(29,45,39));draw=ImageDraw.Draw(canvas)
    for col,d in enumerate([OLD,DOC]):
        fs=[f for f in records[col] if f['clip']==clip and f['direction']==0];f=max((f for f in fs if f['time']<=at),key=lambda f:f['time']);path=d/f['file']
        if path not in cache:cache[path]=Image.open(path).convert('RGBA').resize((920,920),Image.Resampling.LANCZOS)
        canvas.paste(cache[path],(20+col*960,130),cache[path]);draw.text((60+col*960,38),'现版 · 重复准备姿势' if col==0 else '精修 · 连续换手与根束出口',font=font,fill=(232,222,185))
    draw.line((960,30,960,1040),fill=(93,111,99),width=2);draw.text((60,91),'相同相机、背景、主体比例 · 关闭攻击特效 · 正式时序',font=small,fill=(157,190,169));draw.text((1480,91),f'战斗时间 {t:.0f} 毫秒',font=small,fill=(157,190,169));canvas.save(TMP/f'{n:05d}.png')
    if n==72:canvas.save(OUT/'pose-comparison.png')
subprocess.run(['ffmpeg','-y','-v','error','-framerate','60','-i',str(TMP/'%05d.png'),'-frames:v',str(round(3220*.06)),'-c:v','libx264','-crf','18','-pix_fmt','yuv420p',str(OUT/'pair-comparison-normal.mp4')],check=True)
subprocess.run(['ffmpeg','-y','-v','error','-i',str(OUT/'pair-comparison-normal.mp4'),'-vf','setpts=4*PTS','-r','60','-c:v','libx264','-crf','19','-pix_fmt','yuv420p',str(OUT/'pair-comparison-quarter.mp4')],check=True)
print('已输出真实战斗时序下的左右两刺对照及慢放。')
