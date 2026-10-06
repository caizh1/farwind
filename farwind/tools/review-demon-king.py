"""生成中文审阅图、源与交付一致性报告和交付清单。"""
import hashlib
import json
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFont

ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/demon-king-model-v1';PRE=OUT/'previews'
FONT='/System/Library/Fonts/STHeiti Medium.ttc'
PAPER=(224,216,199,255);INK=(44,43,45)
def font(size):return ImageFont.truetype(FONT,size)
def label(canvas,xy,text,size=25):ImageDraw.Draw(canvas).text(xy,text,font=font(size),fill=INK)
def subject(name):
    im=Image.open(PRE/name).convert('RGBA');box=im.getchannel('A').getbbox();assert box,name+'没有实际角色像素';return im.crop(box)
def put(canvas,im,center,top,height):
    im=im.resize((round(im.width*height/im.height),height),Image.Resampling.LANCZOS)
    canvas.alpha_composite(im,(round(center-im.width/2),top));return im
def save(canvas,name):canvas.convert('RGB').save(PRE/name)

reference=Image.open(ROOT/'docs/demon-king-design/demon-king-black-flame-v2.png').convert('RGBA')
canvas=Image.new('RGBA',(1480,1020),PAPER)
label(canvas,(60,32),'寂冠之王 · 原画与模型',46)
label(canvas,(60,96),'同主体高度对照｜工程检查与美术签收分别记录',24)
label(canvas,(170,150),'已确认黑焰原画',27);label(canvas,(950,150),'当前工程直接渲染',27)
put(canvas,reference.crop((488,77,1083,954)),365,205,735)
put(canvas,subject('reference-pose.png'),1100,205,735)
label(canvas,(60,970),'原画为绘画视角；右侧为固定近正面正交机位，姿态与笔触还原仍由美术审阅确认。',23)
save(canvas,'comparison.png')

canvas=Image.new('RGBA',(1640,930),PAPER);label(canvas,(45,25),'造型与分件检查',42)
for i,(name,title) in enumerate([('front.png','正面与黑焰'),('quarter-no-flame.png','关闭黑焰 · 斜面'),('grey-front.png','中性灰模'),('back-no-flame.png','背面结构')]):
    label(canvas,(i*410+36,94),title,25);put(canvas,subject(name),i*410+205,147,720)
save(canvas,'model-board.png')
canvas=Image.new('RGBA',(1600,980),PAPER);label(canvas,(35,25),'游戏机位 · 八方向直接渲染',40)
for i in range(8):
    row,col=divmod(i,4);label(canvas,(col*400+32,row*445+94),f'方向 {i+1} · {i*45} 度',23)
    put(canvas,subject(f'game-{i}.png'),col*400+200,row*445+135,330)
save(canvas,'directions.png')

for height in [256,384]:
    canvas=Image.new('RGBA',(1300,height+185),PAPER);label(canvas,(30,22),f'主体高度 {height} 像素 · 实际缩小预览',28)
    for i,name in enumerate(['front.png','quarter-left.png','side.png','game-0.png']):put(canvas,subject(name),160+i*325,95,height)
    save(canvas,f'scale-{height}.png')

# 场景合成使用真实游戏背景与主角透明素材，仅用于离线比例审阅。
scene_ref=ROOT/'docs/enemy-design-v2/references/visual-baseline.png'
bg=Image.open(scene_ref).convert('RGBA').crop((28,525,775,946));bg=bg.resize((1200,676),Image.Resampling.LANCZOS)
shade=Image.new('RGBA',bg.size,(14,19,20,65));bg.alpha_composite(shade)
canvas=Image.new('RGBA',(1200,820),PAPER);canvas.alpha_composite(bg,(0,84))
hero=Image.open(ROOT/'public/assets/animation/round-three/hero-motion.png').convert('RGBA').crop((0,0,128,128));hero=hero.crop(hero.getchannel('A').getbbox())
ground=530;put(canvas,hero,470,ground-90,90);put(canvas,subject('game-0.png'),765,ground-225,225)
label(canvas,(30,25),'离线场景比例合成 · 旅人 1 : 魔王约 2.5',30)
label(canvas,(30,canvas.height-45),'用于检查缩小比例与明暗；不是游戏接入或实际战斗截图。',23)
save(canvas,'scene-scale.png')

comparisons=[]
for source,target in [('front.png','front-delivery.png'),('quarter-left.png','quarter-delivery.png')]:
    a=np.asarray(Image.open(PRE/source).convert('RGBA')).astype(float);b=np.asarray(Image.open(PRE/target).convert('RGBA')).astype(float)
    mask=(a[:,:,3]>0)|(b[:,:,3]>0);diff=np.abs(a-b)
    result={'视角':source,'主体颜色平均差':float(diff[:,:,:3][mask].mean()),'主体颜色百分之九十九分位差':float(np.percentile(diff[:,:,:3][mask],99)),'透明度最大差':float(diff[:,:,3].max())}
    comparisons.append(result)
    assert result['主体颜色平均差']<1 and result['主体颜色百分之九十九分位差']<6 and result['透明度最大差']<=3,'交付渲染与源工程不一致'
(OUT/'evidence/render-consistency.json').write_text(json.dumps({'说明':'最后一次建模之后从两份工程独立渲染，同机位逐像素比较。','对照':comparisons,'结论':'通过'},ensure_ascii=False,indent=2))

for name,source in [('audit-source.json','demon-king-editable.blend'),('audit-delivery.json','demon-king-delivery.blend')]:
    r=json.loads((OUT/'evidence'/name).read_text());assert r['结论']=='通过',name+'尚未通过'
    assert r['工程摘要']==hashlib.sha256((OUT/'source'/source).read_bytes()).hexdigest(),name+'与当前工程不匹配'
records=[]
for path in sorted(OUT.rglob('*')):
    if not path.is_file() or path.suffix=='.blend1' or 'idle-frames' in path.parts or 'pressure-frames' in path.parts or path.name=='final-manifest.json':continue
    records.append({'文件':str(path.relative_to(OUT)),'字节数':path.stat().st_size,'摘要':hashlib.sha256(path.read_bytes()).hexdigest()})
scripts=[]
for name in ['prepare-demon-king-assets.py','build-demon-king.py','render-demon-king.py','audit-demon-king.py','review-demon-king.py']:
    path=ROOT/'tools'/name;scripts.append({'文件':str(path.relative_to(ROOT)),'摘要':hashlib.sha256(path.read_bytes()).hexdigest()})
(OUT/'evidence/final-manifest.json').write_text(json.dumps({'说明':'正式交付与审阅证据摘要；连续渲染母版目录另行保留。','文件':records,'制作工具':scripts},ensure_ascii=False,indent=2))
print('中文对照板、缩小预览、离线场景比例合成和源／交付一致性检查已完成。')
