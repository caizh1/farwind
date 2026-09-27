"""后期排版：只裁切透明留白、缩放和添加中文说明，不绘制或修改角色。"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, math, hashlib

ROOT = Path(__file__).resolve().parent
FONT = '/System/Library/Fonts/Hiragino Sans GB.ttc'
NAMES = ['moss-slime', 'leaf-blade', 'spore-mushroom', 'thorn-beast']
CN = ['苔团史莱姆', '叶刃灵', '孢子菇', '棘角兽']
BG, INK, MUTED = '#eee8d8', '#243e35', '#5c6b5c'
HEIGHTS = [44, 70, 62, 57]
BREAKS = {
 'moss-slime': [[0,428,912,1355,1774],[0,532,970,1346,1774]],
 'leaf-blade': [[0,478,920,1358,1774],[0,482,975,1395,1774]],
 'spore-mushroom': [[0,454,900,1340,1774],[0,439,912,1411,1774]],
 'thorn-beast': [[0,442,906,1322,1774],[0,493,929,1384,1774]]}
TIMES = [
 [(0,120),(120,260),(260,360),(360,420),(420,500),(500,600),(600,740),(740,880)],
 [(0,70),(70,190),(190,300),(300,400),(400,460),(460,540),(540,720),(720,900)],
 [(0,100),(100,250),(250,380),(380,500),(500,570),(570,620),(620,800),(800,1000)],
 [(0,120),(120,280),(280,430),(430,560),(560,650),(650,740),(740,900),(900,1140)]]
PHASES = [
 ['蓄力起始','压扁蓄力','锁向停顿','出手起跳','出手接触','收招落地','收招回弹','恢复'],
 ['侧向蓄势','叶臂后拉','转体蓄力','锁向停顿','出手起扫','出手横扫','收招破绽','恢复'],
 ['准备','菌盖收紧','菌柄鼓起','锁向停顿','出手喷射','喷后回缩','回气／弹反分支','恢复'],
 ['准备','前蹄刨地','低头蓄势','锁向停顿','出手蹬出','出手冲锋','急停破绽','恢复']]
TOTALS = [(360,140,380),(400,140,360),(500,120,380),(560,180,400)]
MOVES = [[0,0,0,8,34,34,34,34],[0,0,0,0,6,12,12,12],[0]*8,[0,0,0,0,52,112,124,124]]
FEEDBACK = [
 ['普通受击：凹陷','受击回弹','弹反：前缘折皱','弹反：贴地失衡','死亡：芽垂下','死亡：胶体摊开','死亡：凝成小团','地面遗留：胶珠与芽'],
 ['普通受击：护胸','受击回稳','弹反：肩胯后仰','弹反：根腿错步','死亡：跪落','死亡：根团塌散','死亡：叶与木核','地面遗留：两叶木核'],
 ['普通受击：盖侧压','受击：少量落孢子','弹反：喷口缩入','弹反：菌盖翻起','死亡：根脚跪下','死亡：菌柄缩短','死亡：菌盖闭合','地面遗留：无害小孢子'],
 ['普通受击：肩侧压','受击回稳','弹反：前足离地','弹反：后坐失衡','撞墙：角受阻缩颈','撞墙：侧跪失衡','死亡：四腿内收','死亡：趴伏叶落']]
NOTES = [
 '低圆凝胶体｜青绿、黑亮眼、粉色脸颊｜苔团双叶芽跟随形变',
 '浅木脸与根脚｜两条叶前臂是攻击部位｜收招低臂露胸',
 '橙赭菌盖与奶油菌柄｜盖下中央喷口｜孢子有金膜与绿核',
 '四足木皮背甲｜中央单角与三簇棘叶｜冲锋为低位楔形']

def font(size): return ImageFont.truetype(FONT,size)
def text(im, xy, s, size=22, fill=INK): ImageDraw.Draw(im).text(xy,s,font=font(size),fill=fill)
def clean(im):
 im=im.convert('RGBA'); mask=im.getchannel('A').point(lambda v:255 if v>25 else 0)
 b=mask.getbbox(); assert b, '空白姿态'
 return im.crop((max(0,b[0]-2),max(0,b[1]-2),min(im.width,b[2]+2),min(im.height,b[3]+2)))
def put(im, sprite, x, foot, scale, lift=0):
 s=sprite.resize((max(1,round(sprite.width*scale)),max(1,round(sprite.height*scale))),Image.Resampling.LANCZOS)
 pos=(round(x-s.width/2),round(foot-s.height-lift)); im.paste(s,pos,s)
 return (pos[0],pos[1],pos[0]+s.width,pos[1]+s.height)
def base(title, subtitle, width=1600, height=1080):
 im=Image.new('RGB',(width,height),BG)
 text(im,(38,24),title,38);text(im,(38,82),subtitle,22)
 text(im,(width-298,31),'候选 · 待用户审阅',22)
 return im
def arrow(draw,a,b,fill='#248b95',width=3):
 draw.line([a,b],fill=fill,width=width);ang=math.atan2(b[1]-a[1],b[0]-a[0]);r=9
 draw.polygon([b,(b[0]-r*math.cos(ang-.5),b[1]-r*math.sin(ang-.5)),(b[0]-r*math.cos(ang+.5),b[1]-r*math.sin(ang+.5))],fill=fill)
def save(im,path): im.save(ROOT/path)

studies,attacks,identities=[],[],[]
crop_checks=[]
for n in NAMES:
 im=Image.open(ROOT/'source'/f'{n}-study.png').convert('RGBA');cells=[]
 for k in range(16):
  x,y=k%4,k//4;box=(round(x*im.width/4),round(y*im.height/4),round((x+1)*im.width/4),round((y+1)*im.height/4))
  c=clean(im.crop(box));cells.append(c)
 if n=='thorn-beast':cells[2],cells[3]=cells[3],cells[2]
 for k,c in enumerate(cells):c.save(ROOT/'cutouts'/f'{n}-study-{k+1:02}.png')
 studies.append(cells)
 im=Image.open(ROOT/'source'/f'{n}-attack.png').convert('RGBA');cells=[]
 for k in range(8):
  row,col=k//4,k%4;b=BREAKS[n][row];box=(b[col],round(row*im.height/2),b[col+1],round((row+1)*im.height/2))
  c=clean(im.crop(box));cells.append(c);c.save(ROOT/'cutouts'/f'{n}-attack-{k+1:02}.png')
  crop_checks.append({'角色':n,'姿态':k+1,'源图裁切':box,'透明边界尺寸':c.size})
 attacks.append(cells)
 identities.append(clean(Image.open(ROOT/'cutouts'/f'{n}-identity.png')))

# 总览同时保留放大比例和一倍实际显示大小，主角直接取当前游戏图集。
hero=Image.open(ROOT/'references/hero-motion.png').convert('RGBA').crop((128,128,256,256))
hero_body=clean(hero);hero_h=hero_body.height*92/128
im=base('四怪造型与主角比例对照','实际素材主角同框｜共同地面基准｜上排放大 4 倍，下排为游戏一倍显示',1600,960)
xs=[170,475,790,1105,1420]
d=ImageDraw.Draw(im);d.line((44,565,1555,565),fill='#b5bda7',width=2)
put(im,hero_body,xs[0],565,92/128*4)
text(im,(95,595),'现有主角',27)
for i,c in enumerate(identities):
 put(im,c,xs[i+1],565,HEIGHTS[i]/c.height*4)
 text(im,(xs[i+1]-100,595),CN[i],27)
 text(im,(xs[i+1]-100,635),f'可见高度约 {HEIGHTS[i]} 像素',20)
text(im,(60,710),'游戏实际大小（1 倍）',23)
d.line((65,850,1535,850),fill='#a9b9a3',width=1)
put(im,hero_body,xs[0],850,92/128)
for i,c in enumerate(identities):put(im,c,xs[i+1],850,HEIGHTS[i]/c.height)
text(im,(55,908),'显示尺寸为设计建议；现有主角画布 86×92，敌人画布 75×75。新增怪物尚未接入游戏。',20)
save(im,Path('boards/overview.png'))

for i,n in enumerate(NAMES):
 # 角色设定板：不同朝向同一缩放，不按单姿态高度归一化。
 im=base(CN[i]+'｜方向与移动设定',NOTES[i],1600,1050)
 scale=215/studies[i][0].height
 labels=['朝下待机','朝上背面','朝右俯视侧向','朝左俯视侧向','待机起伏','朝下移动','朝上移动','侧向移动']
 for k,c in enumerate(studies[i][:8]):
  x=(k%4)*400+200;foot=440+(k//4)*390
  put(im,c,x,foot,scale)
  ImageDraw.Draw(im).line((x-145,foot+3,x+145,foot+3),fill='#adbaa5',width=2)
  text(im,(x-160,foot+26),labels[k],24)
  put(im,c,x+125,foot+105,HEIGHTS[i]/studies[i][0].height)
 text(im,(40,962),'左右允许镜像：对称轮廓与中央攻击部位；镜像时保持世界光照，不镜像朝上与朝下。',21)
 details=['苔团与双叶芽跟随胶体压缩、拉伸；两眼与脸颊始终沿同一表面。','两条叶臂允许交换左右；浅木脸、根脚与叶领保持同一角色身份。','喷口始终位于盖下正前方；菌盖斑点随盖体形变，背面不出现正面五官。','四足、中央单角与背部三簇棘叶保持一致；朝上姿态能看到背甲。']
 text(im,(40,1000),'每格右下为实际大小对照。'+details[i],20)
 save(im,Path('boards')/f'{n}-character.png')

 # 攻击的干净美术版只有八个姿态；标注版在完全相同素材上增加辅助层。
 plain=Image.new('RGB',(1600,900),BG)
 scale=205/attacks[i][0].height
 if i==2:scale=190/attacks[i][0].height
 placements=[]
 for k,c in enumerate(attacks[i]):
  x=(k%4)*400+185;foot=395+(k//4)*425
  lift=32 if i==0 and k in (3,4) else 0
  placements.append((x,foot,lift));put(plain,c,x,foot,scale,lift)
 save(plain,Path('boards')/f'{n}-attack-clean.png')
 ann=base(CN[i]+'｜招牌攻击关键姿态','八个关键姿态用于说明动作，数量不等于最终帧数，各姿态不等时长。',1600,1150)
 ann.paste(plain,(0,130))
 draw=ImageDraw.Draw(ann)
 for k,(x,foot,lift) in enumerate(placements):
  y=foot+130;start,end=TIMES[i][k]
  active=(k in (3,4) if i==0 else k in (4,5))
  color='#b44e31' if active else '#9eab8e'
  draw.line((x-145,y+3,x+145,y+3),fill='#b7bda5',width=1)
  draw.ellipse((x-5,y-5,x+5,y+5),fill='#167e8b')
  draw.line((x-11,y,x+11,y),fill='#167e8b',width=2)
  arrow(draw,(x+22,y+18),(x+70,y+18),'#567b61',2)
  if MOVES[i][k]>0:arrow(draw,(x-48,y+18),(x-12,y+18),'#167e8b',2)
  # 危险范围画在地面辅助层，蓄力用轮廓，生效阶段用粗线。
  if k in (2,3,4,5) and not (i==0 and k==5):
   if i==0:draw.ellipse((x+25,y-24,x+138,y+25),outline=color,width=4 if active else 2)
   elif i==1:
    draw.pieslice((x-80,y-48,x+155,y+45),-62,62,outline=color,width=4 if active else 2)
    if active:
     draw.arc((x-95,y-190,x+160,y-10),225,355,fill='#c19638',width=4)
     arrow(draw,(x+106,y-73),(x+130,y-56),'#c19638',3)
   elif i==2:
    arrow(draw,(x+50,y-82),(x+140,y-82),'#c19638',4)
    draw.ellipse((x+130,y-94,x+154,y-70),outline=color,width=3)
   else:
    draw.rectangle((x+35,y-25,x+160,y+25),outline=color,width=4 if active else 2)
    arrow(draw,(x+45,y-15),(x+146,y-15),'#c19638',3)
  if i==0 and active:
   points=[(x-48+t*148,y-14-60*4*t*(1-t)) for t in [v/20 for v in range(21)]]
   draw.line(points,fill='#c19638',width=3);arrow(draw,points[-3],points[-1],'#c19638',3)
  text(ann,(x-168,y+38),f'{k+1:02} {PHASES[i][k]}',22)
  text(ann,(x-168,y+70),f'{start}–{end} 毫秒｜地面位移 +{MOVES[i][k]} 像素',17)
 w,a,r=TOTALS[i]
 text(ann,(40,1045),f'建议总时长 {w+a+r} 毫秒：前摇 {w}（含锁向）＋有效 {a}＋收招 {r}。',23)
 text(ann,(40,1083),'青点／箭头：锚点／位移　绿箭头：朝向　金线：轨迹　灰框：预告　砖红框：有效范围',20)
 text(ann,(40,1118),'孢子打散仅在弹反时触发；弹丸飞行与碰撞另计。' if i==2 else '范围与位移均为设计建议，尚未形成碰撞判定或正式参数。',18)
 save(ann,Path('boards')/f'{n}-attack-annotated.png')

 im=base(CN[i]+'｜受击、弹反与死亡反馈','非血腥反馈｜保留形体变化与地面遗留｜右下附游戏实际大小',1600,1080)
 scale=215/studies[i][0].height
 for k,c in enumerate(studies[i][8:]):
  x=(k%4)*400+200;foot=420+(k//4)*415
  put(im,c,x,foot,scale)
  text(im,(x-175,foot+28),FEEDBACK[i][k],21)
  put(im,c,x+125,foot+130,HEIGHTS[i]/studies[i][0].height)
 text(im,(40,1000),'普通受击建议 90–180 毫秒；弹反失衡 450–700 毫秒；死亡收束 500–800 毫秒。',21)
 text(im,(40,1040),'撞墙失衡建议 650–900 毫秒，角部受阻→缩颈→侧跪→重新撑起。' if i==3 else '死亡后的地面遗留用于辨认结束状态；持续时间与清理规则留待正式接入确认。',20)
 save(im,Path('boards')/f'{n}-feedback.png')

# 提取独立孢子弹和打散效果，保留生成的形状，不用几何占位物替代。
spore=Image.open(ROOT/'source/spore-mushroom-attack.png').convert('RGBA')
ball=clean(spore.crop((752,445,903,887)))
scatter=clean(spore.crop((1180,445,1395,887)))
ball.save(ROOT/'cutouts/spore-projectile.png');scatter.save(ROOT/'cutouts/spore-deflected.png')
im=base('孢子弹｜完整与弹反打散','金膜、绿核、卫星点｜喷口位于菌盖下正前方｜打散后失去完整危险核',1200,640)
put(im,ball,280,440,230/ball.height);put(im,scatter,830,440,230/scatter.height)
text(im,(140,480),'完整孢子：本体约 10 像素，光晕约 18 像素',20)
text(im,(660,480),'弹反：金膜裂开，五六颗粒与淡青闪光',20)
put(im,ball,280,565,18/ball.height);put(im,scatter,830,565,24/scatter.height)
text(im,(50,590),'下排为建议游戏显示尺寸；光晕不等于伤害范围。',20)
save(im,Path('boards/spore-projectile.png'))

def bar(im,x,y,hp=1,trail=None):
 d=ImageDraw.Draw(im);d.rounded_rectangle((x-24,y-2,x+24,y+8),radius=3,fill='#16302b',outline='#eee5ba',width=1)
 d.rectangle((x-21,y,x+21,y+5),fill='#3e5145')
 if trail is not None:d.rectangle((x-21,y,x-21+round(42*trail),y+5),fill='#d6b479')
 if hp>0:d.rectangle((x-21,y,x-21+round(42*hp),y+5),fill='#c9785f')
def parry(im,x,y):
 d=ImageDraw.Draw(im);d.ellipse((x-9,y-9,x+9,y+9),outline='#172f2d',width=3)
 d.ellipse((x-8,y-8,x+8,y+8),outline='#ffedaf',width=2)
 d.polygon([(x,y-4),(x+4,y),(x,y+4),(x-4,y)],fill='#bcefe6')
def warning(im,x,y,kind):
 d=ImageDraw.Draw(im)
 if kind==0:d.ellipse((x+18,y-12,x+63,y+10),outline='#f0bb7f',width=2)
 elif kind==1:d.pieslice((x-23,y-24,x+58,y+22),-62,62,outline='#f0bb7f',width=2)
 elif kind==2:arrow(d,(x+20,y-22),(x+65,y-22),'#f0bb7f',2)
 else:d.rectangle((x+20,y-12,x+89,y+12),outline='#f0bb7f',width=2)

anchors=[(485,548),(850,490),(980,515),(1110,582)]
states=['exploration','attack','hurt','death'];statecn=['探索：警觉满血','攻击：血条、弹反与预警','受伤：即时血量与伤害残影','死亡：形体收束与遗留']
for state,title in zip(states,statecn):
 im=Image.open(ROOT/'references/village-day.webp').convert('RGB')
 for i,(x,y) in enumerate(anchors):
  ref=studies[i][0];s=HEIGHTS[i]/ref.height
  if state=='attack':
   c=attacks[i][4];s=HEIGHTS[i]/attacks[i][0].height;lift=7 if i==0 else 0
   put(im,c,x,y,s,lift);warning(im,x,y,i)
  elif state=='hurt':put(im,studies[i][8],x,y,s)
  elif state=='death':put(im,studies[i][14],x,y,s)
  else:put(im,studies[i][0],x,y,s)
  if state!='death':
   maxh=max([c.height*s for c in (attacks[i] if state=='attack' else studies[i][:8])])
   by=round(y-maxh-15);bar(im,x,by,.56 if state=='hurt' else 1,.87 if state=='hurt' else None)
   if state=='attack':parry(im,x+round(identities[i].width/identities[i].height*HEIGHTS[i]/2)+20,by+18)
  text(im,(x-43,y+14),CN[i],12,'#fff2cf')
 d=ImageDraw.Draw(im);d.rounded_rectangle((325,15,945,53),radius=6,fill='#173a30')
 text(im,(340,23),'设计合成图 · 尚未实现｜'+title,17,'#fff2cf')
 save(im,Path('scene')/f'game-{state}-day.png')

# 日夜血条对照使用仓库两张实际截图，不通过人为暗化替代夜间截图。
im=base('普通敌人血条｜日间与夜间实际大小','设计合成图 · 尚未实现｜每个场景 1280×720 原像素排入，不缩小',2560,1620)
for j,file in enumerate(['village-day.webp','village-night.webp']):
 scene=Image.open(ROOT/'references'/file).convert('RGB')
 for i,(x,y) in enumerate(anchors):
  put(scene,studies[i][0],x,y,HEIGHTS[i]/studies[i][0].height)
  by=y-HEIGHTS[i]-17
  bar(scene,x,by,1 if i==0 else .56,.87 if i==1 else None)
  if i>=2:parry(scene,x+48,by+16);warning(scene,x,y,i)
  text(scene,(x-35,y+14),['满血警觉','受击残影','提示并存','提示并存'][i],12,'#fff2cf')
 ImageDraw.Draw(scene).rounded_rectangle((355,16,913,52),radius=5,fill='#17382f')
 text(scene,(372,24),'设计合成图 · 尚未实现｜'+('白天' if j==0 else '夜间'),18,'#fff2cf')
 im.paste(scene,(1280*j,130))
 # 仅局部细节放大；上排仍保留真实一倍尺寸。
 detail=scene.crop((780,350,1160,630)).resize((950,700),Image.Resampling.NEAREST)
 im.paste(detail,(1280*j+165,885));text(im,(1280*j+36,855),'下方局部 2.5 倍放大辅助审阅',20)
save(im,Path('scene/healthbar-day-night.png'))

summary=base('场景状态对照｜探索、攻击、受伤、死亡','设计合成图 · 尚未实现｜背景来自真实运行截图，四个场景均保持原始 1280×720',2560,1700)
for k,(state,title) in enumerate(zip(states,statecn)):
 x,y=(k%2)*1280,130+(k//2)*780
 summary.paste(Image.open(ROOT/'scene'/f'game-{state}-day.png'),(x,y));text(summary,(x+26,y+728),title,25)
save(summary,Path('scene/game-states-overview.png'))

files=list((ROOT/'boards').glob('*.png'))+list((ROOT/'scene').glob('*.png'))
entries=[]
for f in files:
 image=Image.open(f);entries.append({'文件':str(f.relative_to(ROOT)),'尺寸':image.size,'状态':'pending-review','散列':hashlib.sha256(f.read_bytes()).hexdigest()})
(ROOT/'review/image-manifest.json').write_text(json.dumps({'说明':'设计候选清单；图像生成并不等于用户验收','图片':entries,'攻击裁切检查':crop_checks},ensure_ascii=False,indent=2))
print(f'已生成 {len(entries)} 张排版设计图，全部等待用户审阅。')
