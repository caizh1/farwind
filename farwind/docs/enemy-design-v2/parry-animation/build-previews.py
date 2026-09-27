"""仅对已生成角色做透明裁切、统一画布、中文标注与播放预览；不补画或复制缺帧。"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
from collections import deque
import json, hashlib, math

ROOT=Path(__file__).resolve().parent
CFG=json.loads((ROOT/'animation-config.json').read_text())
FONT='/System/Library/Fonts/Hiragino Sans GB.ttc'
BG='#eee8d8'
INK='#243e35'
DIR_CN={'down':'朝下','up':'朝上','right':'朝右'}
DUR=CFG['正常逐帧毫秒']
STAGES=CFG['阶段']
FILES={}
RECORDS=[]
FRAMES={}

def txt(im,xy,s,size=20,color=INK):
    ImageDraw.Draw(im).text(xy,s,font=ImageFont.truetype(FONT,size),fill=color)

def gif_times(durations):
    # 动图格式只支持十毫秒粒度：量化累计边界，保持片段总长六百／八百毫秒。
    result=[];total=0;previous=0
    for duration in durations:
        total+=duration;boundary=round(total/10)*10
        result.append(boundary-previous);previous=boundary
    return result

def cuts(im,n,axis):
    a=im.getchannel('A').point(lambda v:255 if v>65 else 0)
    length=im.size[axis]
    other=im.size[1-axis]
    counts=[]
    for p in range(length):
        b=(p,0,p+1,other) if axis==0 else (0,p,other,p+1)
        counts.append(sum(a.crop(b).histogram()[1:]))
    result=[0]
    for k in range(1,n):
        target=length*k/n
        pad=length/n*.22
        result.append(min(range(round(target-pad),round(target+pad)+1),key=lambda p:(counts[p],abs(p-target))))
    return result+[length]

def split(file,rows):
    im=Image.open(file).convert('RGBA')
    ys=cuts(im,rows,1)
    cells=[]
    for row in range(rows):
        strip=im.crop((0,ys[row],im.width,ys[row+1]))
        xs=cuts(strip,4,0)
        for col in range(4):
            b=(xs[col],ys[row],xs[col+1],ys[row+1])
            c=im.crop(b)
            tight=c.getchannel('A').point(lambda v:255 if v>25 else 0).getbbox()
            assert tight, '每一格必须有实际角色'
            # 透明裁切只去掉留白；完整角色像素保留。
            c=c.crop(tight)
            cells.append((c,b,tight))
    return cells

def setup():
    for obj in CFG['怪物']:
        name=obj['文件前缀']
        if name in ('moss-slime','branch-reaper'):
            vertical=split(ROOT/'source'/f'{name}-vertical.png',6)
            FILES[(name,'down')]=vertical[:12]
            FILES[(name,'up')]=vertical[12:]
        else:
            for direction in ('down','up'):
                path=ROOT/'review'/'dusk-raven-up-initial.png' if name=='dusk-raven' and direction=='up' else ROOT/'source'/f'{name}-{direction}.png'
                FILES[(name,direction)]=split(path,3)
        FILES[(name,'right')]=split(ROOT/'source'/f'{name}-right.png',3)
    # 方向修正稿第一、十二格重新绘制为背面。只采用这两格，保留原稿其余十格，避免修正稿第四格翼尖被裁切。
    revised=split(ROOT/'review'/'dusk-raven-up-direction-fix.png',3)
    FILES[('dusk-raven','up')][0]=revised[0]
    FILES[('dusk-raven','up')][11]=revised[11]

def normalized(obj,direction):
    name=obj['文件前缀']
    cells=FILES[(name,direction)]
    if name=='branch-reaper' and direction=='up':
        # 末格上方有两块与主体断开的相邻格裁切残片，仅保留本格完整主体及其抗锯齿边缘。
        raw,box,tight=cells[11]
        w,h=raw.size
        data=bytearray(raw.getchannel('A').point(lambda v:1 if v>25 else 0).tobytes())
        groups=[]
        for p in range(w*h):
            if not data[p]:continue
            q=deque([p]);data[p]=0;ids=[]
            while q:
                k=q.popleft();ids.append(k);x=k%w;y=k//w
                for j in (k-w if y else -1,k+w if y<h-1 else -1,k-1 if x else -1,k+1 if x<w-1 else -1):
                    if j>=0 and data[j]:data[j]=0;q.append(j)
            groups.append(ids)
        mask=bytearray(w*h)
        for p in max(groups,key=len):mask[p]=255
        m=Image.frombytes('L',(w,h),bytes(mask)).filter(ImageFilter.MaxFilter(3))
        c=raw.copy();c.putalpha(ImageChops.multiply(raw.getchannel('A'),m))
        active=c.getchannel('A').point(lambda v:255 if v>25 else 0).getbbox()
        c=c.crop(active)
        tight=(tight[0]+active[0],tight[1]+active[1],tight[0]+active[2],tight[1]+active[3])
        cells[11]=(c,box,tight)
    assert len(cells)==12, '不得复制姿态凑帧'
    scale=240/cells[-1][0].height
    scale=min(scale,460/max(c[0].width for c in cells),400/max(c[0].height for c in cells))
    final_height=cells[-1][0].height*scale
    output=[]
    for k,(c,box,tight) in enumerate(cells):
        source=f'source/{name}-vertical.png' if name in ('moss-slime','branch-reaper') and direction in ('down','up') else f'source/{name}-{direction}.png'
        if name=='dusk-raven' and direction=='up':source='review/dusk-raven-up-direction-fix.png' if k in (0,11) else 'review/dusk-raven-up-initial.png'
        c=c.resize((max(1,round(c.width*scale)),max(1,round(c.height*scale))),Image.Resampling.LANCZOS)
        out=Image.new('RGBA',(512,512))
        # 候选画布以身体足底包围盒中心对齐；正式接入前仍需逐帧校准承重足锚点。
        x=round(256-c.width/2)
        y=440-c.height
        out.alpha_composite(c,(x,y))
        path=ROOT/'frames'/name/direction/f'frame-{k+1:02}.png'
        path.parent.mkdir(parents=True,exist_ok=True)
        # 原子替换，避免审阅页在重新排版时读到半张图片。
        temporary=path.with_name(path.stem+'.pending.png')
        out.save(temporary)
        temporary.replace(path)
        b=out.getchannel('A').point(lambda v:255 if v>25 else 0).getbbox()
        assert b and b[0]>0 and b[1]>0 and b[2]<512 and b[3]<512, '统一画布不能裁切角色'
        RECORDS.append({'文件':str(path.relative_to(ROOT)),'角色':obj['中文名'],'方向':DIR_CN[direction],
                        '帧':k+1,'阶段':STAGES[k],'普通持续毫秒':DUR[k],
                        '精准持续毫秒':CFG['精准逐帧毫秒'][k],
                        '画布':[512,512],'候选锚点':[256,440],
                        '源图':source,'源图格边界':box,'格内透明裁切':tight,
                        '方向内统一缩放':round(scale,6),'末帧可见高度':round(final_height,3),
                        '状态':'pending-review','摘要':hashlib.sha256(path.read_bytes()).hexdigest()})
        output.append(out)
    FRAMES[(name,direction)]=(output,final_height)
    if name=='dusk-raven' and direction=='up':
        # 精选源图保留十格原稿，并使用图像工具重新绘制的首尾两格；这里只作裁切合成。
        selected=Image.new('RGBA',(2048,1536))
        for k,frame in enumerate(output):selected.alpha_composite(frame,(k%4*512,k//4*512))
        selected.save(ROOT/'source'/'dusk-raven-up.png')

def paste_at(im,frame,x,foot,scale):
    c=frame.resize((round(512*scale),round(512*scale)),Image.Resampling.LANCZOS)
    im.paste(c,(round(x-256*scale),round(foot-440*scale)),c)

def make_board(obj,direction):
    name=obj['文件前缀']
    frames,standard=FRAMES[(name,direction)]
    im=Image.new('RGB',(1600,1670),BG)
    txt(im,(30,18),obj['中文名']+'｜被弹反连续帧｜'+DIR_CN[direction],34)
    txt(im,(30,70),'十二帧：打断 → 最大失衡 → 停滞 → 撑稳恢复｜独立新绘制的过渡姿态',21)
    txt(im,(1270,27),'候选 · 待用户审阅',20)
    t=0
    for k,frame in enumerate(frames):
        x=k%4*400+200
        foot=410+k//4*480
        paste_at(im,frame,x,foot,.78)
        d=ImageDraw.Draw(im)
        d.line((x-170,foot+2,x+170,foot+2),fill='#b0b89e',width=1)
        d.ellipse((x-4,foot-4,x+4,foot+4),fill='#167e8b')
        txt(im,(x-175,foot+16),f'{k+1:02} {STAGES[k]}',23)
        txt(im,(x-175,foot+51),f'{t}–{t+DUR[k]} 毫秒｜持续 {DUR[k]} 毫秒',18)
        paste_at(im,frame,x+125,foot+165,obj['建议可见高度']/standard)
        t+=DUR[k]
    txt(im,(30,1590),'普通总长 600 毫秒；精准总长 800 毫秒，仅延长第六、七帧的失衡停滞。',22)
    txt(im,(30,1630),'右下：游戏建议尺寸。青点：候选地面根；击退由世界根另行驱动。左右可镜像，上下独立。',19)
    im.save(ROOT/'boards'/f'{name}-{direction}-frames.png')
    clean=Image.new('RGBA',(1600,1110))
    for k,frame in enumerate(frames):
        paste_at(clean,frame,k%4*400+200,330+k//4*360,.78)
    clean.save(ROOT/'boards'/f'{name}-{direction}-clean.png')

def make_gif(obj,direction):
    name=obj['文件前缀']
    frames,standard=FRAMES[(name,direction)]
    seq=[]
    for k,frame in enumerate(frames):
        im=Image.new('RGB',(640,620),BG)
        txt(im,(22,16),obj['中文名']+' · '+DIR_CN[direction]+' · 被弹反',27)
        txt(im,(22,56),'连续帧候选 · 待用户审阅',18)
        paste_at(im,frame,320,408,1)
        ImageDraw.Draw(im).line((65,409,575,409),fill='#b0b89e')
        txt(im,(22,434),f'{k+1:02}／12  {STAGES[k]}',22)
        paste_at(im,frame,320,556,obj['建议可见高度']/standard)
        txt(im,(22,565),'下排：游戏建议尺寸｜循环间待机 900 毫秒',18)
        seq.append(im)
    for mode,durations in [('normal',DUR),('perfect',CFG['精准逐帧毫秒'])]:
        # 动画片段时长精确；循环间额外待机仅供审阅，不能计为游戏硬直。
        seq[0].save(ROOT/'previews'/f'{name}-{direction}-{mode}.gif',save_all=True,
                    append_images=seq[1:]+[seq[-1]],duration=gif_times(durations)+[900],loop=0,optimize=False)

def overview(direction):
    out=[]
    for k in range(12):
        im=Image.new('RGB',(1500,720),BG)
        txt(im,(28,18),'五种敌人｜被弹反连续帧样片｜'+DIR_CN[direction],34)
        txt(im,(28,73),'受力打断 → 最大失衡 → 停滞 → 撑稳恢复｜候选 · 待用户审阅',22)
        for i,obj in enumerate(CFG['怪物']):
            frames,standard=FRAMES[(obj['文件前缀'],direction)]
            x=i*300+150
            paste_at(im,frames[k],x,390,.72)
            txt(im,(x-90,418),obj['中文名'],24)
            paste_at(im,frames[k],x,584,obj['建议可见高度']/standard)
            txt(im,(x-95,608),f"建议可见高 {obj['建议可见高度']} 像素",18)
        ImageDraw.Draw(im).line((28,585,1472,585),fill='#a8b29c')
        txt(im,(28,663),f'{k+1:02}／12  {STAGES[k]}｜上排放大，下排游戏建议尺寸｜片段 600 毫秒，循环间待机 900 毫秒',21)
        out.append(im)
    out[0].save(ROOT/'previews'/f'overview-{direction}.gif',save_all=True,append_images=out[1:]+[out[-1]],duration=gif_times(DUR)+[900],loop=0,optimize=False)
    out[4].save(ROOT/'boards'/f'overview-{direction}-max-stagger.png')

setup()
for obj in CFG['怪物']:
    for direction in CFG['方向']:
        normalized(obj,direction)
        make_board(obj,direction)
        make_gif(obj,direction)
for direction in CFG['方向']:
    overview(direction)
(ROOT/'review'/'frame-manifest.json').write_text(json.dumps({'状态':'pending-review','说明':'每组十二帧，共十五组一百八十帧；源图逐格裁切，不通过复制补帧。','帧':RECORDS},ensure_ascii=False,indent=2))
(ROOT/'review'/'display-metrics.json').write_text(json.dumps([{'角色':obj['文件前缀'],'方向':direction,'末帧可见高度':FRAMES[(obj['文件前缀'],direction)][1]} for obj in CFG['怪物'] for direction in CFG['方向']],ensure_ascii=False,indent=2))
print('已排版十五组、一百八十张透明单帧、三十张设计板与三十三个播放预览。全部待用户审阅。')
