"""将未修饰的Blender渲染排成审阅版面；只裁切透明留白、等比缩放和加中文标签。"""
import json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/east-boss-art'
E=OUT/'evidence'
FONT='/System/Library/Fonts/Supplemental/Arial Unicode.ttf'
BG=(22,32,28)


def font(size):return ImageFont.truetype(FONT,size)


def subject(path):
    im=Image.open(path).convert('RGBA')
    bbox=im.getchannel('A').point(lambda a:255 if a>12 else 0).getbbox()
    assert bbox,'图片主体为空：'+str(path)
    return im.crop(bbox),bbox


def board(filename,title,items,foot,box=(1120,1240),same_height=False):
    w=80+(box[0]+40)*len(items);h=box[1]+270
    result=Image.new('RGB',(w,h),BG);draw=ImageDraw.Draw(result)
    draw.text((55,30),title,font=font(43),fill='#e9ead8')
    images=[subject(path)[0] for label,path in items]
    common_height=min([box[1]]+[box[0]*im.height/im.width for im in images])
    for i,((label,path),im) in enumerate(zip(items,images)):
        x=60+i*(box[0]+40)
        draw.text((x,107),label,font=font(28),fill='#bfccaa')
        if filename=='structure-check.jpg' and i==1:
            draw.rectangle((x-12,155,x+box[0]+12,175+box[1]),fill='#dbe0cd')
        scale=common_height/im.height if same_height else min(box[0]/im.width,box[1]/im.height)
        im=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS)
        result.paste(im,(x+(box[0]-im.width)//2,165+box[1]-im.height),im)
    draw.text((55,h-67),foot,font=font(25),fill='#9eaf9d')
    result.save(E/filename,quality=95)


board('art-comparison.jpg','缚枝祭主 · 静态美术候选',[
    ('原画 · 造型与质感目标',ROOT/'docs/combat-v2/source/bound-branch-down-idle.png'),
    ('上一版 · 动作结构样片',E/'previous-neutral.png'),
    ('本轮 · 实体模型与手绘材质',E/'front.png')],
    '同背景、同主体展示高度；原画为二维设计。三维图直接渲染，无后期修饰。静态美术待确认。',same_height=True)
board('three-views.jpg','同一模型 · 三视角检查',[
    ('游戏视角',E/'front.png'),('侧面视角',E/'side.png'),('背面视角',E/'back.png')],
    '全部来自同一份 Blender 工程；侧背视角用于检查体积、支撑关系与枝叶层次。')
board('structure-check.jpg','去掉纹理 · 检查实体结构',[
    ('灰模 · 根系、镰刃与叶片体积',E/'clay.png'),('纯色轮廓 · 小尺寸识别',E/'silhouette.png')],
    '使用 Blender 材质覆盖直接渲染；没有用原画投影卡片替代主体网格。')
board('bend-check.jpg','肩肘弯曲 · 蒙皮检查样本',[
    ('左肩肘弯曲',E/'bend-left.png'),('静态定妆',E/'front.png'),('右肩肘弯曲',E/'bend-right.png')],
    '检查帧一、四十与八十；这些是关节检查姿势，尚未作为最终攻击动画。')
board('detail-board.jpg','局部细节 · 原始渲染',[
    ('面具与树冠',E/'mask.png'),('根系与风核',E/'roots.png'),('肩肘弯曲局部',E/'joint.png')],
    '不进行后期补画、锐化或模型缺陷遮盖；保留原始透明 PNG 供放大检查。',box=(1000,1000))
front,bbox=subject(E/'front.png')
im=Image.new('RGB',(1500,770),BG);d=ImageDraw.Draw(im)
d.text((40,25),'缩小后仍需看清：面具、双镰、风核与树冠',font=font(34),fill='#e5ead4')
for i,height in enumerate([256,384,512]):
    view=front.resize((round(front.width*height/front.height),height),Image.Resampling.LANCZOS)
    x=50+i*480+(440-view.width)//2;y=650-height
    im.paste(view,(x,y),view);d.text((90+i*480,684),f'主体高 {height} 像素',font=font(25),fill='#b5c9a5')
im.save(E/'readability.jpg',quality=95)
sizes={str(p.relative_to(OUT)):p.stat().st_size for p in sorted(OUT.rglob('*')) if p.is_file() and p.suffix in ['.blend','.png','.jpg']}
report={'说明':'对照版面只排版，不改变模型渲染内容。原画二维视角没有真实相机参数，不能宣称与三维镜头完全一致。','正面渲染尺寸':list(Image.open(E/'front.png').size),'正面主体包围盒':bbox,'正面主体像素高度':front.height,'文件字节':sizes}
assert front.height>=1024,'高清主体不足一千零二十四像素'
(E/'delivery-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print('审阅版面完成，正面主体高度：'+str(front.height))
