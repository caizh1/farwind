"""裁切真实生成帧、统一脚底画布、打包候选图集；不绘制或复制角色姿态。"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, hashlib, math, shutil

ROOT=Path(__file__).resolve().parents[1]
DOC=ROOT/'docs/enemy-combat-v1'
OUT=ROOT/'public/assets/enemies-v1'
FONT='/System/Library/Fonts/Hiragino Sans GB.ttc'
NAMES={'moss-slime':'苔团史莱姆','branch-reaper':'裂枝镰灵','ashen-spore':'灰冠孢卫','armored-boar':'棘甲林豕','dusk-raven':'暮羽鸦妖'}
DIRS={'down':'朝下','up':'朝上','right':'朝右；朝左由镜像生成'}
LABELS={'idle':'待机','walk':'移动','attack':'攻击','hurt':'受击','death':'死亡','parry':'被弹反','wall':'撞墙失衡'}
RECORDS=[]

def text(im,xy,t,size=20):
    ImageDraw.Draw(im).text(xy,t,font=ImageFont.truetype(FONT,size),fill='#254234')

def boundaries(im,count,axis):
    alpha=im.getchannel('A').point(lambda a:255 if a>65 else 0)
    n=im.size[axis];m=im.size[1-axis]
    counts=[sum(alpha.crop((p,0,p+1,m) if axis==0 else (0,p,m,p+1)).histogram()[1:]) for p in range(n)]
    return [0]+[min(range(round(n*k/count-n/count*.22),round(n*k/count+n/count*.22)+1),key=lambda p:(counts[p],abs(p-n*k/count))) for k in range(1,count)]+[n]

def split(path,cols=4,rows=6):
    im=Image.open(path).convert('RGBA');assert im.getchannel('A').getextrema()[0]==0,'源图必须透明'
    ys=boundaries(im,rows,1);result=[]
    for row in range(rows):
        xs=boundaries(im.crop((0,ys[row],im.width,ys[row+1])),cols,0)
        for col in range(cols):
            box=(xs[col],ys[row],xs[col+1],ys[row+1]);c=im.crop(box)
            tight=c.getchannel('A').point(lambda a:255 if a>25 else 0).getbbox();assert tight,'不能交付空帧'
            result.append((c.crop(tight),box,tight))
    return result

def normalize(c,scale):
    c=c.resize((round(c.width*scale),round(c.height*scale)),Image.Resampling.LANCZOS)
    assert c.width<630 and c.height<540,'生成帧须完整容纳在脚底画布'
    out=Image.new('RGBA',(640,640));band=c.getchannel('A').point(lambda a:255 if a>65 else 0).crop((0,round(c.height*.82),c.width,c.height)).getbbox();center=(band[0]+band[2])/2 if band else c.width/2;out.alpha_composite(c,(round(320-center),550-c.height));return out

def composite(im,frame,x,y,scale):
    c=frame.resize((round(640*scale),round(640*scale)),Image.Resampling.LANCZOS)
    im.paste(c,(round(x-320*scale),round(y-550*scale)),c)

def actions(enemy):
    if enemy=='moss-slime':return [('idle',0,4),('walk',4,12),('attack',12,24),('hurt',24,28),('death',28,36),('parry',36,48)]
    a=[('idle',0,4),('walk',4,8),('attack',8,16),('hurt',16,20),('death',20,24),('parry',24,36)]
    return a+[('wall',36,40)] if enemy=='armored-boar' else a

def timing(enemy,action,count):
    if action=='parry':return [20,25,30,35,55,90,90,60,50,50,45,50]
    if action=='death':return [90,100,120,150,180,200,220,240] if count==8 else [140,230,350,580]
    if action=='hurt':return [45,70,105,100]
    if action=='wall':return [100,180,360,210]
    if action=='attack':
        if enemy=='moss-slime':return [66,116,102,46,60,60,50,50,60,70,75,55]
        c,l,a,r={'branch-reaper':(500,150,130,320),'ashen-spore':(400,120,140,360),'armored-boar':(400,160,280,380),'dusk-raven':(330,120,170,380)}[enemy]
        return [round(c*.6),round(c*.4),round(l*.5),round(l*.5),round(a*.5),round(a*.5),round(r*.55),round(r*.45)]
    return [250]*count if action=='idle' else [100]*count

def build():
    OUT.mkdir(parents=True,exist_ok=True);(DOC/'boards').mkdir(exist_ok=True);(DOC/'animations').mkdir(exist_ok=True)
    wall=split(DOC/'source/armored-boar-wall.png',4,3)
    for enemy,name in NAMES.items():
        stride=48 if enemy=='moss-slime' else 40 if enemy=='armored-boar' else 36
        atlas=Image.new('RGBA',(1920,math.ceil(stride*3/12)*160))
        for di,direction in enumerate(DIRS):
            source=DOC/'source'/f'{enemy}-{direction}.png';items=[]
            if enemy=='moss-slime':
                for n in range(48):
                    p=ROOT/'docs/enemy-design-v2/slime-animation/frames'/direction/f'frame-{n+1:02}.png'
                    old=Image.open(p).convert('RGBA');canvas=Image.new('RGBA',(640,640));canvas.alpha_composite(old,(64,110));items.append((canvas,p,None,1))
            else:
                if enemy=='ashen-spore' and direction=='up':source=DOC/'source/ashen-spore-up-fix.png'
                if enemy=='armored-boar' and direction=='up':source=DOC/'source/armored-boar-up-fix.png'
                if enemy=='dusk-raven' and direction=='up':source=DOC/'source/dusk-raven-up-fix.png'
                cells=split(source);scale=240/cells[0][0].height
                items=[(normalize(c,scale),source,box,scale) for c,box,tight in cells]
                for n in range(12):
                    p=ROOT/'docs/enemy-design-v2/parry-animation/frames'/enemy/direction/f'frame-{n+1:02}.png'
                    old=Image.open(p).convert('RGBA');canvas=Image.new('RGBA',(640,640));canvas.alpha_composite(old,(64,110));items.append((canvas,p,None,1))
                if enemy=='armored-boar':
                    cells=wall[di*4:di*4+4];scale=240/cells[3][0].height
                    items.extend((normalize(c,scale),DOC/'source/armored-boar-wall.png',box,scale) for c,box,tight in cells)
            assert len(items)==stride
            board=Image.new('RGB',(1920,110+math.ceil(stride/8)*270),'#eee8d8')
            text(board,(25,15),name+'｜'+DIRS[direction]+'｜候选待审阅',28)
            text(board,(25,60),'真实独立姿态；相同脚底锚点；前摇包含锁向，姿态数量不等于等时播放',20)
            framepaths=[]
            for n,(frame,p,box,scale) in enumerate(items):
                bounds=frame.getchannel('A').point(lambda a:255 if a>25 else 0).getbbox()
                assert bounds and min(bounds[:2])>0 and max(bounds[2:])<640,'独立帧不得裁切'
                output=DOC/'frames'/enemy/direction/f'frame-{n+1:02}.png';output.parent.mkdir(parents=True,exist_ok=True);frame.save(output);framepaths.append(output)
                action,start,end=next(a for a in actions(enemy) if a[1]<=n<a[2]);duration=timing(enemy,action,end-start)[n-start]
                digest=hashlib.sha256(output.read_bytes()).hexdigest()
                RECORDS.append({'文件':str(output.relative_to(ROOT)),'角色':name,'方向':DIRS[direction],'动作':LABELS[action],'图集帧':di*stride+n,'建议时长':duration,'源图':str(p.relative_to(ROOT)),'源格边界':box,'统一缩放':scale,'脚底锚点':[320,550],'摘要':digest,'状态':'pending-review'})
                small=frame.resize((160,160),Image.Resampling.LANCZOS);atlas.alpha_composite(small,((di*stride+n)%12*160,(di*stride+n)//12*160))
                x=n%8*240+120;y=335+n//8*270;composite(board,frame,x,y,.6)
                text(board,(x-108,y+10),f'{n+1:02} {LABELS[action]} {n-start+1} · {duration}毫秒',17)
                ImageDraw.Draw(board).line((x-98,y+2,x+98,y+2),fill='#a1b4a0')
            board.save(DOC/'boards'/f'{enemy}-{direction}.png')
            for action,start,end in actions(enemy):
                pictures=[]
                for frame,*_ in items[start:end]:
                    im=Image.new('RGB',(320,350),'#eee8d8');text(im,(12,8),name+' · '+LABELS[action],17);composite(im,frame,160,300,.67);pictures.append(im)
                durations=timing(enemy,action,end-start)
                pictures[0].save(DOC/'animations'/f'{enemy}-{direction}-{action}.gif',save_all=True,append_images=pictures[1:],duration=durations,loop=0 if action in ['idle','walk','attack'] else 1,disposal=2)
        atlas.save(OUT/f'{enemy}.png')
    for name,(c,*_) in zip(['spore-projectile','spore-burst'],split(DOC/'source/spore-effects.png',2,1)):
        c.thumbnail((128,128),Image.Resampling.LANCZOS);im=Image.new('RGBA',(128,128));im.alpha_composite(c,((128-c.width)//2,(128-c.height)//2));im.save(OUT/f'{name}.png')
    assert len(RECORDS)==588 and len({r['摘要'] for r in RECORDS})==588,'不得复制角色帧凑数量'
    (DOC/'manifest.json').write_text(json.dumps({'说明':'正式流程使用候选动画，主观美术仍待用户审阅；帧表与原生成来源可追溯','参考提交':'70e11595e1d2cdf0472c3c40b80270cf73eaa7a5','状态':'pending-review','帧数':len(RECORDS),'帧':RECORDS},ensure_ascii=False,indent=2))
    print('完成588个独立姿态、五种图集、逐方向联系图和动作预览。')

if __name__=='__main__':build()
