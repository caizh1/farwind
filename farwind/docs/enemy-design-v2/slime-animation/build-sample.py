"""仅裁切已生成姿态、统一画布和中文排版；不补画、平移或旋转凑帧。"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, hashlib, math

ROOT = Path(__file__).resolve().parent
FONT = '/System/Library/Fonts/Hiragino Sans GB.ttc'
BG = '#eee8d8'
INK = '#243e35'
DIRECTIONS = {'down': '朝下', 'up': '朝上', 'right': '朝右'}
TIMES = {'idle': [250]*4, 'walk': [32/60*1000/8]*8,
         'attack': [66, 116, 102, 46, 60, 60, 50, 50, 60, 70, 75, 55],
         'hurt': [45, 70, 105, 100], 'death': [90, 100, 120, 150, 180, 200, 220, 240],
         'parry': [20, 25, 30, 35, 55, 90, 90, 60, 50, 50, 45, 50]}
TITLES = {'idle':'待机呼吸','walk':'低速蠕动','attack':'短跳扑击','hurt':'普通受击','death':'死亡收束','parry':'被弹反'}
FRAMES = {}
RECORDS = []

def text(im, xy, s, size=20, color=INK):
    ImageDraw.Draw(im).text(xy, s, font=ImageFont.truetype(FONT, size), fill=color)

def boundaries(im, count, axis):
    # 沿透明谷值切格，沿用前轮弹反帧裁切方法，避免固定等分切掉倾斜叶芽。
    a=im.getchannel('A').point(lambda v:255 if v>65 else 0)
    length=im.size[axis]; other=im.size[1-axis]
    counts=[sum(a.crop((p,0,p+1,other) if axis==0 else (0,p,other,p+1)).histogram()[1:]) for p in range(length)]
    result=[0]
    for k in range(1,count):
        target=length*k/count; pad=length/count*.22
        result.append(min(range(round(target-pad),round(target+pad)+1),key=lambda p:(counts[p],abs(p-target))))
    return result+[length]

def split(path):
    im=Image.open(path).convert('RGBA'); ys=boundaries(im,3,1); cells=[]
    for row in range(3):
        xs=boundaries(im.crop((0,ys[row],im.width,ys[row+1])),4,0)
        for col in range(4):
            box=(xs[col],ys[row],xs[col+1],ys[row+1]); c=im.crop(box)
            tight=c.getchannel('A').point(lambda v:255 if v>25 else 0).getbbox()
            assert tight, '生成源图不能有空格'
            cells.append((c.crop(tight),box,tight))
    return cells

def paste(im, frame, x, foot, scale):
    c=frame.resize((round(512*scale),round(512*scale)),Image.Resampling.LANCZOS)
    im.paste(c,(round(x-256*scale),round(foot-440*scale)),c)

def setup():
    atlas=Image.new('RGBA',(1536,1536)); review_atlas=Image.new('RGBA',(3072,3072))
    for di,direction in enumerate(DIRECTIONS):
        items=[]
        for kind,normal in [('locomotion',0),('attack',0),('feedback',3)]:
            path=ROOT/'source'/f'{direction}-{kind}.png'; cells=split(path)
            if direction=='down' and kind=='feedback':
                cells[11]=split(ROOT/'review'/'down-feedback-death-fix.png')[11]
            scale=240/cells[normal][0].height
            assert max(c[0].height*scale for c in cells)<415 and max(c[0].width*scale for c in cells)<485, '姿态应在统一画布内完整保留'
            for index,(c,box,tight) in enumerate(cells):
                c=c.resize((round(c.width*scale),round(c.height*scale)),Image.Resampling.LANCZOS)
                frame=Image.new('RGBA',(512,512)); frame.alpha_composite(c,(round(256-c.width/2),440-c.height))
                source=f'source/{direction}-{kind}.png'
                if direction=='down' and kind=='feedback' and index==11: source='review/down-feedback-death-fix.png'
                items.append((frame,source,box,tight,scale))
        for index in range(12):
            path=ROOT.parent/'parry-animation'/'frames'/'moss-slime'/direction/f'frame-{index+1:02}.png'
            items.append((Image.open(path).convert('RGBA'),str(path.relative_to(ROOT.parent)),None,None,1))
        assert len(items)==48
        ranges=[('idle',0,4),('walk',4,12),('attack',12,24),('hurt',24,28),('death',28,36),('parry',36,48)]
        for action,start,end in ranges:
            FRAMES[(direction,action)]=[item[0] for item in items[start:end]]
        for index,(frame,source,box,tight,scale) in enumerate(items):
            output=ROOT/'frames'/direction/f'frame-{index+1:02}.png'; output.parent.mkdir(parents=True,exist_ok=True)
            temporary=output.with_name(output.stem+'.pending.png'); frame.save(temporary); temporary.replace(output)
            bounds=frame.getchannel('A').point(lambda v:255 if v>25 else 0).getbbox()
            assert bounds and min(bounds[:2])>0 and max(bounds[2:])<512, '独立帧不得裁切'
            action,start,end=next(r for r in ranges if r[1]<=index<r[2])
            RECORDS.append({'文件':str(output.relative_to(ROOT)),'方向':DIRECTIONS[direction], '动作':TITLES[action],
                '动作内帧':index-start+1,'图集帧':di*48+index,'源图':source,'源格边界':box,'源裁切':tight,
                '组内统一缩放':scale,'画布':[512,512],'建议地面根':[256,440],'状态':'pending-review',
                '摘要':hashlib.sha256(output.read_bytes()).hexdigest()})
            small=frame.resize((128,128),Image.Resampling.LANCZOS)
            atlas.alpha_composite(small,((di*48+index)%12*128,(di*48+index)//12*128))
            large=frame.resize((256,256),Image.Resampling.LANCZOS)
            review_atlas.alpha_composite(large,((di*48+index)%12*256,(di*48+index)//12*256))
        clean=Image.new('RGBA',(1920,1800)); board=Image.new('RGB',(1920,1920),BG)
        text(board,(28,15),'苔团史莱姆｜完整动画联系图｜'+DIRECTIONS[direction],30)
        text(board,(28,61),'待机4＋移动8＋扑击12＋受击4＋死亡8＋弹反12＝48帧｜候选 · 待美术验收',22)
        for index,(frame,*_) in enumerate(items):
            x=index%8*240+120; foot=330+index//8*300
            paste(board,frame,x,foot,.62); paste(clean,frame,x,250+index//8*300,.62)
            action,start,end=next(r for r in ranges if r[1]<=index<r[2])
            text(board,(x-106,foot+10),f'{index+1:02} {TITLES[action]} {index-start+1:02}',18)
            ImageDraw.Draw(board).line((x-95,foot+2,x+95,foot+2),fill='#a1b4a0')
        board.save(ROOT/'boards'/f'{direction}-contact.png'); clean.save(ROOT/'boards'/f'{direction}-clean.png')
    assert len(RECORDS)==144 and len({r['摘要'] for r in RECORDS})==144, '不得复制姿态凑帧'
    for name,im in [('slime-sample.png',atlas),('slime-sample-review.png',review_atlas)]:
        temporary=ROOT/(name+'.pending.png'); im.save(temporary); temporary.replace(ROOT/name)

def pose_index(action,elapsed):
    times=TIMES[action]; total=sum(times)
    t=elapsed%(total+(0 if action in ('idle','walk') else 900))
    for index,duration in enumerate(times):
        if t<duration:return index,t
        t-=duration
    return len(times)-1,total

def overview(elapsed):
    im=Image.new('RGB',(1800,1280),BG)
    text(im,(25,15),'苔团史莱姆｜完整动画样片｜三方向与六种动作',32)
    text(im,(25,63),'独立连续姿态 · 上下独立，左向由角色镜像 · 下排小图为游戏实际显示大小 · 待美术验收',22)
    actions=['idle','walk','attack','hurt','parry','death']
    for di,direction in enumerate(DIRECTIONS):
        top=135+di*375; text(im,(25,top),DIRECTIONS[direction],22)
        for col,action in enumerate(actions):
            x=col*300+150; index,_=pose_index(action,elapsed); frame=FRAMES[(direction,action)][index]
            paste(im,frame,x,top+220,.62)
            paste(im,frame,x,top+306,44/240)
            text(im,(x-112,top+326),TITLES[action]+f' · {index+1:02}/{len(FRAMES[(direction,action)]):02}',20)
    text(im,(25,1240),'动作样片，不代表正式敌人战斗接入或目标设备性能通过。普通弹反600毫秒，精准800毫秒。',21)
    return im

def build():
    setup()
    overview(450).save(ROOT/'boards'/'overview.png')
    seq=[overview(t) for t in range(0,3600,50)]
    seq[0].save(ROOT/'previews'/'overview.gif',save_all=True,append_images=seq[1:],duration=50,loop=0,optimize=False)
    for direction in DIRECTIONS:
        for action in TIMES:
            frames=FRAMES[(direction,action)]; seq=[]
            for index,frame in enumerate(frames):
                im=Image.new('RGB',(640,620),BG)
                text(im,(22,18),'苔团史莱姆 · '+DIRECTIONS[direction]+' · '+TITLES[action],26)
                paste(im,frame,320,410,1); paste(im,frame,320,535,44/240)
                text(im,(22,555),f'第{index+1}／{len(frames)}帧 · 下方为游戏大小 · 待美术验收',19)
                seq.append(im)
            # 动图以十毫秒累计边界量化，完整时间线保留在运行采样器中。
            durations=[]; total=0; previous=0
            for ms in TIMES[action]:
                total+=ms; edge=round(total/10)*10; durations.append(edge-previous); previous=edge
            if action in ('idle','walk'):
                seq[0].save(ROOT/'previews'/f'{direction}-{action}.gif',save_all=True,append_images=seq[1:],duration=durations,loop=0,optimize=False)
            else:
                seq[0].save(ROOT/'previews'/f'{direction}-{action}.gif',save_all=True,append_images=seq[1:]+[seq[-1]],duration=durations+[900],loop=0,optimize=False)
    (ROOT/'review'/'frame-manifest.json').write_text(json.dumps({'说明':'三方向共144张独立透明帧；36张沿用前轮弹反候选，108张本轮生成；左向不重复计数','状态':'pending-review','帧':RECORDS},ensure_ascii=False,indent=2))
    (ROOT/'review'/'packing-check.json').write_text(json.dumps({'状态':'pending-review','独立帧':len(RECORDS),'唯一摘要':len({r['摘要'] for r in RECORDS}),'图集尺寸':[1536,1536],'帧尺寸':[128,128],'固定根':[64,110],'普通可见高度':44,'攻击总毫秒':sum(TIMES['attack']),'普通弹反总毫秒':sum(TIMES['parry']),'限制':'锚点按整体足底包围盒对齐，仍是候选；缩放在动作组内固定，不逐帧归一化，图集仅供独立开发预览。'},ensure_ascii=False,indent=2))
    print('已打包144张透明帧、三方向联系图与十九个动画预览，等待真实浏览器与美术复审。')

if __name__=='__main__':build()
