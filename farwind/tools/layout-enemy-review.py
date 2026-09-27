# -*- coding: utf-8 -*-
"""用真实独立角色帧排版审阅图片；只添加文字、锚点和图解，不重绘角色。"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, shutil

ROOT=Path(__file__).resolve().parents[1]
DOC=ROOT/'docs/enemy-combat-v1'
FONT='/System/Library/Fonts/Hiragino Sans GB.ttc'
PROFILES=[('moss-slime','苔团史莱姆',44),('branch-reaper','裂枝镰灵',78),('ashen-spore','灰冠孢卫',72),('armored-boar','棘甲林豕',65),('dusk-raven','暮羽鸦妖',82)]
TIMES={'moss-slime':(450,120,100,260),'branch-reaper':(650,150,130,320),'ashen-spore':(520,120,140,360),'armored-boar':(560,160,280,380),'dusk-raven':(450,120,170,380)}

def label(im,xy,text,size=22,color='#264438'):
    ImageDraw.Draw(im).text(xy,text,font=ImageFont.truetype(FONT,size),fill=color)

def frame(kind,direction,n):
    return Image.open(DOC/'frames'/kind/direction/f'frame-{n+1:02}.png').convert('RGBA')

def actor(im,source,x,y,scale):
    art=source.resize((round(640*scale),round(640*scale)),Image.Resampling.LANCZOS)
    im.paste(art,(round(x-320*scale),round(y-550*scale)),art)

def hero(im,x,y,scale=1):
    source=Image.open(ROOT/'public/assets/animation/round-three/hero-motion.png').convert('RGBA')
    cols=source.width//128;art=source.crop((9%cols*128,9//cols*128,(9%cols+1)*128,(9//cols+1)*128)).resize((round(86*scale),round(92*scale)),Image.Resampling.LANCZOS)
    im.paste(art,(round(x-43*scale),round(y-92*124/128*scale)),art)

def overview():
    im=Image.new('RGB',(1280,760),'#eee8d8');draw=ImageDraw.Draw(im)
    label(im,(30,24),'五怪完整动作候选 · 等待美术审阅',32)
    label(im,(30,76),'二维俯视斜角；同一脚底基准；保留史莱姆，增加四种略有压迫感的森林敌人',22)
    xs=[110,320,525,735,945,1150]
    hero(im,xs[0],430,2)
    for x,(kind,name,h) in zip(xs[1:],PROFILES):actor(im,frame(kind,'down',0),x,430,h/240*2)
    draw.line((30,431,1250,431),fill='#9baa93',width=2)
    for x,name in zip(xs,['现有旅人']+[p[1]for p in PROFILES]):label(im,(x-75,450),name,21)
    label(im,(30,500),'上排：两倍放大审阅。下排：1280×720 游戏基准下的一倍显示尺寸。',21)
    hero(im,xs[0],665)
    for x,(kind,name,h) in zip(xs[1:],PROFILES):actor(im,frame(kind,'down',0),x,665,h/240)
    draw.line((30,666,1250,666),fill='#9baa93',width=1)
    label(im,(30,707),'候选状态：pending-review；技术通过不代表造型、方向或动作已获得用户验收。',21)
    im.save(DOC/'boards/overview.png')

def attacks():
    for kind,name,h in PROFILES:
        clean=Image.new('RGB',(1280,800),'#eee8d8')
        indexes=[12,14,16,17,18,19,20,23] if kind=='moss-slime' else list(range(8,16))
        for i,n in enumerate(indexes):actor(clean,frame(kind,'right',n),160+i%4*320,340+i//4*360,.5)
        clean.save(DOC/'boards'/f'{kind}-attack-clean.png')
        im=Image.new('RGB',(1280,1080),'#eee8d8');im.paste(clean,(0,0));draw=ImageDraw.Draw(im)
        label(im,(24,18),name+'｜招牌攻击：关键姿态与有效阶段',28)
        windup,lock,active,recovery=TIMES[kind]
        charge=windup-lock
        labels=['蓄力开始','最大蓄力','锁向开始','锁向末段','有效出手','有效伸展','收招破绽','恢复待机']
        durations=[round(charge*.6),round(charge*.4),lock//2,lock-lock//2,active//2,active-active//2,round(recovery*.55),round(recovery*.45)]
        if kind=='moss-slime':durations=[66+116,102+46,60,60,50,50,60+70+75,55]
        for i,(word,ms)in enumerate(zip(labels,durations)):
            x=160+i%4*320;y=340+i//4*360
            color='#ae6149' if i in [4,5] else '#264438'
            label(im,(x-136,y+16),f'{i+1} {word} · {ms}毫秒',19,color)
            draw.line((x-6,y,x+6,y),fill='#398a83',width=2);draw.line((x,y-6,x,y+6),fill='#398a83',width=2)
            draw.line((x,y+54,x+56,y+54),fill='#398a83',width=2);draw.polygon([(x+56,y+54),(x+48,y+49),(x+48,y+59)],fill='#398a83')
        label(im,(24, 62),f'前摇{windup}毫秒（含锁向{lock}毫秒）＋有效{active}毫秒＋收招{recovery}毫秒；青色十字为脚底锚点。',19)
        label(im,(24,90),'角色朝右；箭头为朝向；每格采用真实独立姿态，位移由战斗根节点控制。',19)
        step={'moss-slime':34,'branch-reaper':12,'ashen-spore':0,'armored-boar':210,'dusk-raven':95}[kind]
        tip,radius={'moss-slime':(12,28),'branch-reaper':(59,13),'ashen-spore':(24,14),'armored-boar':(29,23),'dusk-raven':(21,24)}[kind]
        label(im,(24,838),f'下图为游戏一倍尺寸轨迹示意：最大身体位移{step}像素；有效阶段{windup}～{windup+active}毫秒。',20)
        x,y=150,977
        if kind=='ashen-spore':
            draw.line((x+24,y,x+424,y),fill='#c8996a',width=28)
            label(im,(545,900),'孢子从前方24像素喷出，飞行速度250像素／秒。',20)
            label(im,(545,938),'独立弹丸有效至接触、障碍或1600毫秒寿命；弹反打散。',19)
        elif kind=='branch-reaper':
            draw.pieslice((x-72,y-72,x+72,y+72),-49,49,fill='#d9b595',outline='#b77754',width=2)
            label(im,(545,900),'双叶镰从负49度横扫至正49度；端点59像素、半径13。',19)
            label(im,(545,938),'侧胸与根足在收招时暴露；范围随锁定方向旋转。',19)
        else:
            draw.rounded_rectangle((x+tip-radius,y-radius,x+step+tip+radius,y+radius),radius=radius,fill='#d9b595',outline='#b77754',width=2)
            label(im,(545,900),f'攻击部位前偏{tip}像素，接触半径{radius}像素。',20)
            label(im,(545,938),'锁向后保持直线；只在有效段首次真实接触时结算。',19)
        actor(im,frame(kind,'right',0),x,y,h/240)
        draw.line((x,y+32,x+step,y+32),fill='#398a83',width=2)
        draw.line((x-5,y+26,x+5,y+38),fill='#398a83',width=2)
        draw.line((x+step-5,y+26,x+step+5,y+38),fill='#398a83',width=2)
        label(im,(24,1040),'橙色为危险范围示意；青色为起点与最大位移终点；实际接触按正式碰撞采样。',19)
        im.save(DOC/'boards'/f'{kind}-attack-annotated.png')

def parry_overview():
    images=[]
    for n in range(12):
        im=Image.new('RGB',(1280,700),'#eee8d8');draw=ImageDraw.Draw(im)
        label(im,(26,20),'五怪被弹反：打断、失衡、撑稳恢复',30)
        label(im,(26,72),'实际独立动画帧；普通600毫秒，精准800毫秒；候选等待美术审阅',21)
        label(im,(26,120),['冲击打断','失衡停滞','撑稳恢复'][0 if n<4 else 1 if n<7 else 2]+f'｜第{n+1}个姿态',22)
        for i,(kind,name,h)in enumerate(PROFILES):
            x=140+i*250;f=frame(kind,'right',(36 if kind=='moss-slime' else 24)+n)
            actor(im,f,x,420,h/240*2);actor(im,f,x,605,h/240)
            label(im,(x-78,439),name,21)
        draw.line((24,421,1256,421),fill='#9baa93');draw.line((24,606,1256,606),fill='#9baa93')
        label(im,(26,488),'上排两倍放大；下排为1280×720游戏基准的一倍尺寸。朝左允许镜像。',20)
        label(im,(26,647),'状态：pending-review；此为动画候选排版，不是游戏运行截图。',20)
        images.append(im)
    images[0].save(DOC/'animations/parry-overview.gif',save_all=True,append_images=images[1:],duration=[20,25,30,35,55,90,90,60,50,50,45,50],loop=0,disposal=2)

def feedback():
    for kind,name,h in PROFILES:
        slime=kind=='moss-slime';rows=[('普通受击',[24,25,26,27]if slime else[16,17,18,19]),('被弹反失衡与撑回',[36,39,43,47]if slime else[24,27,31,35]),('非血腥死亡',[28,30,33,35]if slime else[20,21,22,23])]
        if kind=='armored-boar':rows.append(('撞墙失衡',[36,37,38,39]))
        im=Image.new('RGB',(1280,120+len(rows)*330),'#eee8d8')
        label(im,(24,18),name+'｜反馈完整姿态：候选待审阅',28)
        label(im,(24,62),'普通弹反600毫秒，精准800毫秒；相同12个独立姿态按归一进度采样，均到达恢复末态。',20)
        for row,(title,ns)in enumerate(rows):
            label(im,(24,120+row*330),title,23)
            for col,n in enumerate(ns):
                x=160+col*320;y=405+row*330;actor(im,frame(kind,'right',n),x,y,.5)
                label(im,(x-95,y+9),f'原独立帧 {n+1:02}',18)
        im.save(DOC/'boards'/f'{kind}-feedback.png')

def health():
    backgrounds=[Image.open(p).convert('RGB').resize((1280,720),Image.Resampling.LANCZOS)for p in [DOC.parent/'enemy-design-v2/references/forest-day.webp',DOC.parent/'day-night/evidence/m2-fixed-forest.webp']]
    out=Image.new('RGB',(1280,1580),'#eee8d8')
    label(out,(24,20),'普通敌人血条｜白天与夜间的实际尺寸对照',30)
    label(out,(24,67),'设计合成图：仓库真实场景截图＋当前帧与布局参数；不是已实现状态的运行截图。',20)
    for row,bg in enumerate(backgrounds):
        im=bg.copy();draw=ImageDraw.Draw(im)
        for i,(kind,name,h)in enumerate(PROFILES):
            x=170+i*230;y=485 if row==0 else 400;hp=1 if i==0 else .62;ghost=1 if i==1 else .62;n=8 if i==2 else 16 if i==1 else 20 if i==4 else 0
            if kind=='moss-slime':n=0
            if i==2:draw.line((x,y,x+170,y),fill='#c8996a',width=7)
            actor(im,frame(kind,'right',n),x,y,h/240)
            if i!=4:
                top=y-h*1.45-15;draw.rounded_rectangle((x-25,top-2,x+25,top+7),radius=2,fill='#15372d',outline='#e9e4cd');draw.rectangle((x-23,top,x-23+46*ghost,top+5),fill='#d6bc7c');draw.rectangle((x-23,top,x-23+46*hp,top+5),fill='#c26a58')
            if i==2:draw.ellipse((x+38,y-h*.7-34,x+62,y-h*.7-10),outline='#b9f7e5',width=2)
            # 文本后期排在角色下方，血条与弹反圈使用正式游戏参数。
            label(im,(x-90,545),['满血警觉','受击＋伤害残影','前摇＋弹反提示','正常探索','死亡保留轮廓'][i],18,'#ffffff')
        label(im,(30,140),'明亮森林'if row==0 else'夜间森林',26,'#fff1d3')
        out.paste(im,(0,120+row*720))
    out.save(DOC/'boards/healthbar-layout.png')

def gallery():
    cards=[]
    for kind,name,h in PROFILES:
        directions=[]
        for direction,word in [('down','朝下'),('up','朝上'),('right','朝右；朝左镜像')]:
            gifs=''.join(f'<figure><img loading="lazy" src="animations/{kind}-{direction}-{a}.gif" alt="{name}{word}{w}"><figcaption>{w}</figcaption></figure>'for a,w in [('idle','待机'),('walk','移动'),('attack','攻击'),('hurt','受击'),('parry','被弹反'),('death','死亡')]+([('wall','撞墙失衡')]if kind=='armored-boar' else []))
            directions.append(f'<details><summary>{word}｜全部动作预览</summary><div class="gifs">{gifs}</div><a href="boards/{kind}-{direction}.png">查看所有独立帧与时长</a></details>')
        cards.append(f'<section><h2>{name} <small>pending-review</small></h2><div class="gifs"><figure><img src="animations/{kind}-right-attack.gif" alt="{name}攻击"><figcaption>招牌攻击</figcaption></figure><figure><img src="animations/{kind}-right-parry.gif" alt="{name}被弹反"><figcaption>被弹反完整恢复</figcaption></figure></div><p><a href="boards/{kind}-attack-clean.png">干净攻击板</a> · <a href="boards/{kind}-attack-annotated.png">时长与阶段标注板</a> · <a href="boards/{kind}-feedback.png">受击、弹反、死亡反馈板</a></p>'+''.join(directions)+'</section>')
    html=('''<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>五怪完整动画与实战审阅</title>
<style>body{margin:0;background:#eee8d8;color:#254234;font:16px/1.7 system-ui}main{max-width:1280px;margin:auto;padding:24px}h1{font-size:30px}h2{font-size:25px}a{color:#286d68}img,video{max-width:100%;height:auto}section{border-top:1px solid #a2b49c;padding:20px 0}small{font-size:14px;color:#996a4a}.gifs{display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start}figure{margin:0;flex:0 1 320px;min-width:0}figcaption{padding:6px 0}summary{cursor:pointer;padding:10px 0}p{max-width:1100px}details{padding-bottom:12px}</style>
<main>
<h1>五怪完整动画与实战审阅</h1>
<p>苔团史莱姆保留，裂枝镰灵、灰冠孢卫、棘甲林豕、暮羽鸦妖增加略有压迫感的轮廓。588个独立透明姿态，含五怪被弹反完整恢复。所有美术候选状态为 <b>pending-review</b>。</p>
<p>
<a href="README.md">交付说明</a> · <a href="REPORT.md">技术测试与审查报告</a> · <a href="manifest.json">帧、来源、时长和摘要清单</a> · <a href="../enemy-design-v2/index.html">此前造型设计</a> · <a href="http://127.0.0.1:5175/enemy-preview.html">四方向固定动作预览</a>
</p>
<img src="boards/overview.png" alt="五怪与主角实际尺寸对照">
<img loading="lazy" src="animations/parry-overview.gif" alt="五怪被弹反完整动画总览">'''+''.join(cards)+'''<section>
<h2>血条尺寸与日夜对照</h2>
<img loading="lazy" src="boards/healthbar-layout.png" alt="设计合成图，实际尺寸血条">
</section>
<section>
<h2>真实游戏验证</h2>
<p>下列图片来自实际运行；正常入口、键盘移动与可见练习按钮。固定预览及上方血条图解均单独标明。技术测试中读取接触预测调整输入时刻，不能替代玩家可读性或主观美术验收。</p>
<img loading="lazy" src="evidence/wild-spore-deflected.png" alt="森林孢子弹实际弹反">
<img loading="lazy" src="evidence/wild-boar-death.png" alt="森林林豕实际死亡">
<img loading="lazy" src="evidence/production-boar-parry.png" alt="生产构建林豕弹反">
<p>正常速度实战录屏：</p>
<video controls preload="metadata" src="evidence/wild-gameplay.webm">
</video>
<video controls preload="metadata" src="evidence/death-gameplay.webm">
</video>
<video controls preload="metadata" src="evidence/production-gameplay.webm">
</video>
</section>
</main>
</html>''')
    (DOC/'index.html').write_text(html)

if __name__=='__main__':
    overview();attacks();parry_overview();feedback();health();gallery()
    print('已排版总览、五种攻击与反馈板、日夜血条合成图和审阅索引。')
