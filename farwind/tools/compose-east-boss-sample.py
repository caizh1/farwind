"""将 Blender 渲染帧合成为中文审阅视频，并检查帧率、时长与高清主体尺寸。"""
import json
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'.east-boss-motion-local'
OUT=ROOT/'docs/east-boss-motion/evidence'
FONT='/System/Library/Fonts/Supplemental/Arial Unicode.ttf'
TITLE=ImageFont.truetype(FONT,36)
LABEL=ImageFont.truetype(FONT,27)
SMALL=ImageFont.truetype(FONT,23)
TIMELINE=json.loads((ROOT/'docs/east-boss-motion/source/timeline.json').read_text())['采样']


def annotate(image,frame,mode):
    # 统一缩入审阅区域，标题和时间轴不得盖住树冠或脚底。
    fitted=Image.new('RGB',(1920,1080),(15,28,24))
    fitted.paste(image.resize((1536,864),Image.Resampling.LANCZOS),(192,108))
    image=fitted
    overlay=Image.new('RGBA',image.size);d=ImageDraw.Draw(overlay)
    d.rectangle((0,0,1920,119),fill=(15,28,24,236))
    d.rectangle((0,958,1920,1080),fill=(15,28,24,236))
    if mode=='comparison':
        d.text((44,17),'原版 · 待机图网格变形',font=TITLE,fill='#efe7d4')
        d.text((1004,17),'Blender · 骨骼连续动作',font=TITLE,fill='#d5efbf')
        d.text((44,70),'当前游戏源码离线重建 · 原生主体 480 像素',font=SMALL,fill='#b9c4b7')
        d.text((1004,70),'同一背景、镜头、初始投影高度 · 无攻击特效',font=SMALL,fill='#b9c4b7')
        d.line((960,119,960,958),fill=(210,221,195,180),width=2)
    else:
        d.text((44,17),'缚枝祭主 · '+('侧面动作检查' if mode=='side' else '六秒连续动作样片'),font=TITLE,fill='#e2edcf')
        d.text((44,70),'警戒 → 转身迈步 → 双镰连斩 → 收势 → 风核暴露 → 恢复',font=SMALL,fill='#b9c4b7')
    item=TIMELINE[frame-1]
    d.text((44,976),f'{item["阶段"]}   {item["时间"]:.2f} / 6.00 秒',font=LABEL,fill='#f1ebd8')
    d.text((1110,978),'动作打样 · 尚未接入正式战斗',font=LABEL,fill='#b9c4b7')
    left,right=44,1876;y=1047
    d.rounded_rectangle((left,y,right,y+8),radius=4,fill='#435147')
    d.rounded_rectangle((left,y,left+(right-left)*frame/360,y+8),radius=4,fill='#b6d99a')
    for t in [2.15,3.48]:
        x=left+(right-left)*t/6;d.rectangle((x-2,y-8,x+2,y+12),fill='#ecc779')
    return Image.alpha_composite(image.convert('RGBA'),overlay).convert('RGB')


def encode(mode,filename):
    cmd=['ffmpeg','-hide_banner','-loglevel','error','-y','-f','rawvideo','-pixel_format','rgb24','-video_size','1920x1080','-framerate','60','-i','-','-an','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(OUT/filename)]
    process=subprocess.Popen(cmd,stdin=subprocess.PIPE)
    try:
        for frame in range(1,361):
            if mode=='comparison':
                with Image.open(CACHE/'baseline'/f'{frame:04d}.png') as old,Image.open(CACHE/'main'/f'{frame:04d}.png') as new:
                    canvas=Image.new('RGB',(1920,1080));canvas.paste(old.crop((480,0,1440,1080)),(0,0));canvas.paste(new.crop((480,0,1440,1080)),(960,0))
            else:
                with Image.open(CACHE/mode/f'{frame:04d}.png') as image:canvas=image.convert('RGB')
            final=annotate(canvas,frame,mode)
            if mode=='comparison' and frame in [1,130,139,210,219]:final.save(OUT/f'comparison-{frame:03d}.jpg',quality=94)
            if mode=='main' and frame==139:final.save(OUT/'east-boss-poster.jpg',quality=95)
            process.stdin.write(final.tobytes())
        process.stdin.close()
        if process.wait():raise RuntimeError('视频编码失败')
    except BaseException:
        process.kill();process.wait();raise
    print('已生成：'+filename,flush=True)


def main():
    OUT.mkdir(parents=True,exist_ok=True)
    for folder in ['main','side','baseline']:
        missing=[i for i in range(1,361) if not (CACHE/folder/f'{i:04d}.png').exists()]
        if missing:raise RuntimeError(f'{folder} 缺少渲染帧：{missing[:8]}')
    encode('main','east-boss-motion.mp4')
    encode('comparison','east-boss-comparison.mp4')
    encode('side','east-boss-side.mp4')
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(OUT/'east-boss-comparison.mp4'),'-vf','setpts=4*PTS','-r','15','-an','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(OUT/'east-boss-quarter.mp4')],check=True)
    checks=[]
    for name in ['east-boss-motion.mp4','east-boss-comparison.mp4','east-boss-side.mp4','east-boss-quarter.mp4']:
        p=OUT/name
        result=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=width,height,r_frame_rate,nb_frames:format=duration,size','-of','json',str(p)]))
        stream=result['streams'][0];slow='quarter' in name
        assert stream['width']==1920 and stream['height']==1080
        assert stream['r_frame_rate']==('15/1' if slow else '60/1')
        assert abs(float(result['format']['duration'])-(24 if slow else 6))<.1
        assert int(stream['nb_frames'])==360
        checks.append({'文件':name,'宽度':1920,'高度':1080,'帧率':stream['r_frame_rate'],'帧数':int(stream['nb_frames']),'秒数':float(result['format']['duration']),'文件字节':p.stat().st_size})
    with Image.open(OUT/'east-boss-detail.png') as im:
        box=im.getchannel('A').getbbox();height=box[3]-box[1]
        assert height>=1024
        detail={'文件':'east-boss-detail.png','图片尺寸':list(im.size),'主体包围盒':list(box),'主体像素高度':height}
    report={'说明':'正常样片每秒六十帧；四分之一慢放保持原始三百六十帧，播放帧率为十五帧，不使用补帧。','视频检查':checks,'高清检查':detail,'运行图集估算':{'说明':'完整六秒动作按每帧七百六十八乘一千零二十四像素、未压缩四通道计算；未包含图集留白。','单方向三百六十帧字节':768*1024*4*360,'八方向字节':768*1024*4*360*8,'当前首领解码上限字节':192*1024*1024}}
    (OUT/'delivery-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps(report,ensure_ascii=False,indent=2))


if __name__=='__main__':main()
