"""中文设计板后期排版；只裁切透明留白、缩放、合成和添加辅助说明。"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
from collections import deque
import json, math, hashlib

ROOT = Path(__file__).resolve().parent
FONT = '/System/Library/Fonts/Hiragino Sans GB.ttc'
NAMES = ['branch-reaper', 'ashen-spore', 'armored-boar', 'dusk-raven']
CN = ['裂枝镰灵', '灰冠孢卫', '棘甲林豕', '暮羽鸦妖']
HEIGHTS = [78, 72, 65, 82]
BG, INK = '#eee8d8', '#243e35'
PHASES = [
 ['预备转向','双镰后拉','转体蓄力','锁向停顿','蹬地起扫','横扫接触','惯性破绽','撑脚恢复'],
 ['预备','菌盖收紧','孢囊鼓胀','锁向停顿','喷射出手','喷后回缩','回气／弹反分支','恢复'],
 ['预备','前蹄刨地','低头蓄势','锁向停顿','蹬地冲出','低位冲锋','前蹄急停','四足恢复'],
 ['地面预备','屈腿展翼','收颈蓄势','锁向停顿','蹬地低跃','喙爪接触','落地破绽','收翼恢复']]
TIMES = [
 [0,100,220,360,460,530,610,810,1000],
 [0,100,250,400,520,580,660,840,1020],
 [0,100,260,400,560,660,840,1060,1220],
 [0,80,200,330,450,530,620,820,1000]]
MOVES = [[0,0,0,0,8,15,15,15],[0]*8,[0,0,0,0,48,112,124,124],[0,0,0,0,26,58,65,65]]
FEEDBACK = [
 ['普通受击：肩侧压','受击：根足撑稳','弹反：双镰反掀','弹反：根足错步','死亡：屈膝垂镰','死亡：前伏','死亡：双镰折合','遗留：落叶与木核'],
 ['普通受击：盖侧斜','受击：菌柄回稳','弹反：喷口反抬','弹反：根足错步','死亡：菌柄弯曲','死亡：侧伏','死亡：盖压低','遗留：闭盖与散孢'],
 ['普通受击：侧压','受击：四蹄撑稳','弹反：前蹄离地','弹反：后坐失衡','撞墙：缩颈低角','撞墙：侧跪撑地','死亡：四蹄弯下','死亡：侧伏棘甲垂落'],
 ['普通受击：翼护身','受击：双爪撑稳','弹反：颈翼后仰','弹反：足趾错步','死亡：屈腿垂喙','死亡：翼披塌落','死亡：羽翼折合','遗留：伏羽与散羽']]
NOTES = [
 '裂木面甲与窄眼｜双叶镰构成危险轮廓｜扭腰横扫后露出胸侧',
 '灰紫宽盖、窄眼、正前喷口｜左右各两枚孢囊｜菌盖收紧后喷射',
 '小头、厚肩、楔形冲角｜四足棘甲｜蹬出与急停有明确重心变化',
 '长钩喙、披翼、双足长爪｜展翼蓄势后低跃扑刺｜落地屈腿收招']

def font(size): return ImageFont.truetype(FONT,size)
def text(im,xy,s,size=22,fill=INK): ImageDraw.Draw(im).text(xy,s,font=font(size),fill=fill)
def clean(im):
 im=im.convert('RGBA'); b=im.getchannel('A').point(lambda v:255 if v>25 else 0).getbbox()
 assert b, '姿态不能为空'
 return im.crop((max(0,b[0]-2),max(0,b[1]-2),min(im.width,b[2]+2),min(im.height,b[3]+2)))
def put(im,c,x,foot,scale,lift=0):
 c=c.resize((max(1,round(c.width*scale)),max(1,round(c.height*scale))),Image.Resampling.LANCZOS)
 pos=(round(x-c.width/2),round(foot-c.height-lift));im.paste(c,pos,c)
 return (pos[0],pos[1],pos[0]+c.width,pos[1]+c.height)
def base(title,subtitle,w=1600,h=1080):
 im=Image.new('RGB',(w,h),BG);text(im,(38,22),title,37);text(im,(38,80),subtitle,21)
 text(im,(w-298,31),'候选 · 待用户审阅',22);return im
def arrow(d,a,b,color='#248b95',width=3):
 d.line([a,b],fill=color,width=width);ang=math.atan2(b[1]-a[1],b[0]-a[0]);r=9
 d.polygon([b,(b[0]-r*math.cos(ang-.5),b[1]-r*math.sin(ang-.5)),(b[0]-r*math.cos(ang+.5),b[1]-r*math.sin(ang+.5))],fill=color)
def save(im,file): im.save(ROOT/file)
def splits(im,count,axis):
 # 在预期格线附近寻找透明谷，避免切掉不等宽的叶镰、羽翼与弹丸。
 a=im.getchannel('A').point(lambda v:255 if v>65 else 0)
 size=im.size[axis];other=im.size[1-axis];counts=[]
 for p in range(size):
  box=(p,0,p+1,other) if axis==0 else (0,p,other,p+1)
  counts.append(sum(a.crop(box).histogram()[1:]))
 values=[0]
 for k in range(1,count):
  target=size*k/count;pad=size/count*.22
  candidates=range(round(target-pad),round(target+pad)+1)
  values.append(min(candidates,key=lambda p:(counts[p],abs(p-target))))
 return values+[size]
def cut_sheet(file,rows):
 im=Image.open(file).convert('RGBA');ys=splits(im,rows,1);out=[];boxes=[]
 for row in range(rows):
  strip=im.crop((0,ys[row],im.width,ys[row+1]));xs=splits(strip,4,0)
  for col in range(4):
   box=(xs[col],ys[row],xs[col+1],ys[row+1]);out.append(clean(im.crop(box)));boxes.append(box)
 return out,boxes

def cut_attack(file,name):
 # 透明区域提取属于排版裁切：保留原始角色像素，去除相邻格串入的轮廓。
 im=Image.open(file).convert('RGBA');ys=splits(im,2,1);out=[];boxes=[]
 for row in range(2):
  strip=im.crop((0,ys[row],im.width,ys[row+1]));w,h=strip.size
  threshold=235 if name=='dusk-raven' else 65
  data=bytearray(strip.getchannel('A').point(lambda v:1 if v>threshold else 0).tobytes());groups=[]
  for p in range(w*h):
   if not data[p]:continue
   q=deque([p]);data[p]=0;ids=[];xmin=w;ymin=h;xmax=ymax=0
   while q:
    k=q.popleft();ids.append(k);x=k%w;y=k//w;xmin=min(xmin,x);xmax=max(xmax,x);ymin=min(ymin,y);ymax=max(ymax,y)
    for j in (k-w if y else -1,k+w if y<h-1 else -1,k-1 if x else -1,k+1 if x<w-1 else -1):
     if j>=0 and data[j]:data[j]=0;q.append(j)
   if len(ids)>3:groups.append((ids,(xmin,ymin,xmax+1,ymax+1)))
  bodies=sorted(sorted(groups,key=lambda g:len(g[0]),reverse=True)[:4],key=lambda g:g[1][0])
  assert len(bodies)==4,f'攻击行必须有四个独立完整主体：{name}，行{row}，实际{len(groups)}个区域' 
  buckets=[list(g[0]) for g in bodies];body_ids={id(g[0]) for g in bodies}
  for ids,b in groups:
   if id(ids) in body_ids:continue
   cx,cy=(b[0]+b[2])/2,(b[1]+b[3])/2
   if name=='ashen-spore' and row==1 and 1050<cx<1235:index=2
   elif name=='ashen-spore' and row==1 and 700<cx<795:index=1
   elif name=='ashen-spore' and row==1 and 315<cx<415:index=0
   else:
    def distance(g):
     z=g[1];dx=max(z[0]-cx,0,cx-z[2]);dy=max(z[1]-cy,0,cy-z[3])
     return (dx*dx+dy*dy,abs((z[0]+z[2])/2-cx))
    index=min(range(4),key=lambda k:distance(bodies[k]))
   buckets[index].extend(ids)
  for ids in buckets:
   raw=bytearray(w*h)
   for p in ids:raw[p]=255
   mask=Image.frombytes('L',(w,h),bytes(raw)).filter(ImageFilter.MaxFilter(5))
   c=strip.copy();c.putalpha(ImageChops.multiply(strip.getchannel('A'),mask));b=c.getchannel('A').point(lambda v:255 if v>25 else 0).getbbox()
   out.append(clean(c));boxes.append((b[0],b[1]+ys[row],b[2],b[3]+ys[row]))
 return out,boxes

studies,attacks=[],[];crop_records=[]
for name in NAMES:
 for kind,rows in [('study',4),('attack',2)]:
  cells,boxes=cut_attack(ROOT/'source'/f'{name}-{kind}.png',name) if kind=='attack' else cut_sheet(ROOT/'source'/f'{name}-{kind}.png',rows)
  if kind=='study' and name=='ashen-spore':cells[2],cells[3]=cells[3],cells[2]
  if kind=='study' and name=='armored-boar':
   # 第九格下方混入下一行的一条独立轮廓；裁掉透明间隔后的残片，不触及本姿态蹄足。
   c=cells[8];cells[8]=clean(c.crop((0,0,c.width,c.height-12)))
  for k,c in enumerate(cells):c.save(ROOT/'cutouts'/f'{name}-{kind}-{k+1:02}.png')
  crop_records.append({'角色':name,'类型':kind,'裁切边界':boxes})
  (studies if kind=='study' else attacks).append(cells)

hero=clean(Image.open(ROOT/'references/hero-motion.png').crop((128,128,256,256)))
slime=clean(Image.open(ROOT/'cutouts/moss-slime-retained.png'))
im=base('保留史莱姆｜四种新怪物比例总览','实际主角与原史莱姆同框｜共同地面基准｜上排放大 4 倍，下排游戏实际大小',1800,1000)
xs=[150,450,750,1050,1350,1650];d=ImageDraw.Draw(im)
d.line((45,570,1755,570),fill='#a8b29c',width=2)
put(im,hero,xs[0],570,92/128*4);put(im,slime,xs[1],570,44/slime.height*4)
text(im,(78,606),'现有主角',25);text(im,(335,606),'苔团史莱姆 · 保留',25)
text(im,(335,647),'可见高约 44 像素',19)
for i in range(4):
 c=studies[i][0];put(im,c,xs[i+2],570,HEIGHTS[i]/c.height*4)
 text(im,(xs[i+2]-83,606),CN[i],25);text(im,(xs[i+2]-103,647),f'可见高约 {HEIGHTS[i]} 像素',19)
text(im,(55,726),'游戏实际大小（1 倍）',23);d.line((55,872,1745,872),fill='#a8b29c',width=1)
put(im,hero,xs[0],872,92/128);put(im,slime,xs[1],872,44/slime.height)
for i in range(4):put(im,studies[i][0],xs[i+2],872,HEIGHTS[i]/studies[i][0].height)
text(im,(55,936),'尺寸仅为设计建议；四种新怪物尚未接入游戏。史莱姆复用第一轮原稿，不重绘。',21)
save(im,Path('boards/overview.png'))

for i,name in enumerate(NAMES):
 im=base(CN[i]+'｜方向与移动',NOTES[i],1600,1050);scale=212/studies[i][0].height
 labels=['朝下待机','朝上背面','朝右俯视侧向','朝左俯视侧向','待机警觉','朝下移动','朝上移动','侧向移动']
 for k,c in enumerate(studies[i][:8]):
  x=k%4*400+200;foot=430+k//4*390;put(im,c,x,foot,scale)
  ImageDraw.Draw(im).line((x-145,foot+3,x+145,foot+3),fill='#adbaa5',width=2)
  text(im,(x-160,foot+27),labels[k],24);put(im,c,x+128,foot+120,HEIGHTS[i]/studies[i][0].height)
 text(im,(40,959),'左右允许镜像：轮廓与攻击部位对称；只镜像左右朝向，世界光照保持左上。',21)
 text(im,(40,997),'右下为游戏实际大小；朝上与朝下使用独立姿态，不能靠翻转互换。',21)
 save(im,Path('boards')/f'{name}-character.png')

 plain=Image.new('RGB',(1600,900),BG);scale=205/attacks[i][0].height;placements=[]
 for k,c in enumerate(attacks[i]):
  x=k%4*400+190;foot=395+k//4*425;lift=30 if i==3 and k in (4,5) else 0
  placements.append((x,foot,lift));put(plain,c,x,foot,scale,lift)
 save(plain,Path('boards')/f'{name}-attack-clean.png')
 ann=base(CN[i]+'｜招牌攻击','八个关键姿态说明完整动作；数量不等于最终帧数，各姿态不等时长。',1600,1150)
 ann.paste(plain,(0,130));d=ImageDraw.Draw(ann)
 for k,(x,foot,lift) in enumerate(placements):
  y=foot+130;active=k in (4,5);color='#b44e31' if active else '#9eab8e'
  d.line((x-145,y+3,x+145,y+3),fill='#b7bda5',width=1);d.ellipse((x-5,y-5,x+5,y+5),fill='#167e8b')
  arrow(d,(x+22,y+18),(x+70,y+18),'#567b61',2)
  if MOVES[i][k]:arrow(d,(x-48,y+18),(x-12,y+18),'#167e8b',2)
  if k in (2,3,4,5):
   if i==0:
    d.pieslice((x-50,y-45,x+145,y+35),-65,65,outline=color,width=4 if active else 2)
    if active:d.arc((x-100,y-170,x+160,y-12),230,355,fill='#c19638',width=4);arrow(d,(x+110,y-70),(x+130,y-52),'#c19638',3)
   elif i==1:
    arrow(d,(x+50,y-82),(x+145,y-82),'#c19638',3);d.ellipse((x+133,y-94,x+157,y-70),outline=color,width=3)
   elif i==2:
    d.rectangle((x+25,y-25,x+157,y+25),outline=color,width=4 if active else 2);arrow(d,(x+42,y-15),(x+145,y-15),'#c19638',3)
   else:
    d.ellipse((x+25,y-25,x+133,y+25),outline=color,width=4 if active else 2)
    if active:
     points=[(x-30+t*160,y-15-55*4*t*(1-t)) for t in [v/20 for v in range(21)]]
     d.line(points,fill='#c19638',width=3);arrow(d,points[-3],points[-1],'#c19638',3)
  text(ann,(x-168,y+38),f'{k+1:02} {PHASES[i][k]}',22)
  text(ann,(x-168,y+70),f'{TIMES[i][k]}–{TIMES[i][k+1]} 毫秒｜地面位移 +{MOVES[i][k]} 像素',17)
 w=TIMES[i][4];a=TIMES[i][6]-w;r=TIMES[i][8]-TIMES[i][6]
 text(ann,(40,1043),f'建议总时长 {w+a+r} 毫秒：前摇 {w}（含锁向）＋有效 {a}＋收招 {r}。',23)
 text(ann,(40,1082),'青点／箭头：脚底锚点／位移　绿箭头：朝向　金线：轨迹　灰框：预告　砖红：有效范围',19)
 text(ann,(40,1117),'弹丸飞行另计；第七格的打散效果只在弹反分支出现。' if i==1 else '范围、位移与时长为设计建议，尚未形成碰撞判定或正式参数。',19)
 save(ann,Path('boards')/f'{name}-attack-annotated.png')

 im=base(CN[i]+'｜受击、弹反与死亡','非血腥反馈｜形体失衡与地面遗留｜右下附游戏实际大小',1600,1080)
 scale=212/studies[i][0].height
 for k,c in enumerate(studies[i][8:]):
  x=k%4*400+200;foot=420+k//4*415;put(im,c,x,foot,scale)
  text(im,(x-175,foot+28),FEEDBACK[i][k],21);put(im,c,x+130,foot+132,HEIGHTS[i]/studies[i][0].height)
 text(im,(40,998),'普通受击建议 90–180 毫秒；弹反失衡 450–700 毫秒；死亡收束 500–800 毫秒。',21)
 text(im,(40,1038),'撞墙失衡建议 650–900 毫秒：角受阻→缩颈→侧跪→撑稳。' if i==2 else '反馈时长与遗留清理规则待设计确认后，再进入动画样片验证。',21)
 save(im,Path('boards')/f'{name}-feedback.png')

effect=Image.open(ROOT/'source/spore-effects.png').convert('RGBA')
parts=[clean(effect.crop((0,0,effect.width//2,effect.height))),clean(effect.crop((effect.width//2,0,effect.width,effect.height)))]
im=base('灰冠孢卫｜孢子弹与弹反打散','金核、灰紫壳｜喷口在菌盖下正前方｜下排为游戏实际大小',1200,650)
for j,(c,name) in enumerate(zip(parts,['spore-projectile','spore-deflected'])):
 c.save(ROOT/'cutouts'/f'{name}.png');x=300+j*600;put(im,c,x,425,230/c.height)
 text(im,(x-190,457),'完整孢子：约 12 像素' if j==0 else '弹反：裂壳、散核与淡青闪光',22)
 put(im,c,x,553,(12 if j==0 else 24)/c.height)
 text(im,(x-185,581),'上排放大审阅；下排游戏实际大小',19)
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
 if kind==0:d.pieslice((x-25,y-25,x+63,y+22),-65,65,outline='#f0bb7f',width=2)
 elif kind==1:arrow(d,(x+20,y-22),(x+65,y-22),'#f0bb7f',2)
 elif kind==2:d.rectangle((x+20,y-12,x+93,y+12),outline='#f0bb7f',width=2)
 else:d.ellipse((x+20,y-14,x+65,y+14),outline='#f0bb7f',width=2)

anchors=[(485,548),(850,490),(980,515),(1110,582)]
states=['exploration','attack','hurt','death'];statecn=['探索：警觉满血','攻击：血条、弹反与预警','受伤：即时血量与伤害残影','死亡：形体收束与遗留']
for state,title in zip(states,statecn):
 im=Image.open(ROOT/'references/village-day.webp').convert('RGB')
 # 史莱姆沿用原稿，放在同一地面上作为风格与体量参照。
 put(im,slime,730,552,44/slime.height)
 for i,(x,y) in enumerate(anchors):
  ref=studies[i][0];s=HEIGHTS[i]/ref.height
  if state=='attack':c=attacks[i][4];s=HEIGHTS[i]/attacks[i][0].height;put(im,c,x,y,s,8 if i==3 else 0);warning(im,x,y,i)
  elif state=='hurt':put(im,studies[i][8],x,y,s)
  elif state=='death':put(im,studies[i][15],x,y,s)
  else:put(im,ref,x,y,s)
  if state!='death':
   group=attacks[i] if state=='attack' else studies[i][:8]
   by=round(y-max(c.height*s for c in group)-18-(8 if i==3 and state=='attack' else 0))
   bar(im,x,by,.56 if state=='hurt' else 1,.87 if state=='hurt' else None)
   if state=='attack':parry(im,x+round(ref.width/ref.height*HEIGHTS[i]/2)+22,by+19)
  text(im,(x-38,y+14),CN[i],12,'#fff2cf')
 ImageDraw.Draw(im).rounded_rectangle((310,15,970,53),radius=6,fill='#173a30')
 text(im,(326,23),'设计合成图 · 尚未实现｜'+title,17,'#fff2cf')
 save(im,Path('scene')/f'game-{state}-day.png')

im=base('普通敌人血条｜明亮与夜间背景','设计合成图 · 尚未实现｜上排每个场景保持原始 1280×720，一倍显示',2560,1620)
for j,file in enumerate(['village-day.webp','village-night.webp']):
 scene=Image.open(ROOT/'references'/file).convert('RGB');put(scene,slime,730,552,44/slime.height)
 for i,(x,y) in enumerate(anchors):
  put(scene,studies[i][0],x,y,HEIGHTS[i]/studies[i][0].height)
  by=y-HEIGHTS[i]-18;bar(scene,x,by,1 if i==0 else .56,.87 if i==1 else None)
  if i>=2:parry(scene,x+48,by+16);warning(scene,x,y,i)
  text(scene,(x-35,y+14),['满血警觉','受击残影','提示并存','提示并存'][i],12,'#fff2cf')
 ImageDraw.Draw(scene).rounded_rectangle((355,16,913,52),radius=5,fill='#17382f')
 text(scene,(372,24),'设计合成图 · 尚未实现｜'+('白天' if j==0 else '夜间'),18,'#fff2cf')
 im.paste(scene,(1280*j,130));detail=scene.crop((780,330,1160,610)).resize((950,700),Image.Resampling.NEAREST)
 im.paste(detail,(1280*j+165,885));text(im,(1280*j+36,855),'下方局部 2.5 倍放大辅助审阅',20)
save(im,Path('scene/healthbar-day-night.png'))
im=base('场景状态对照｜探索、攻击、受伤、死亡','设计合成图 · 尚未实现｜真实运行截图背景，四个场景均为原始 1280×720',2560,1700)
for k,(state,title) in enumerate(zip(states,statecn)):
 x,y=k%2*1280,130+k//2*780;im.paste(Image.open(ROOT/'scene'/f'game-{state}-day.png'),(x,y));text(im,(x+26,y+728),title,25)
save(im,Path('scene/game-states-overview.png'))

files=list((ROOT/'boards').glob('*.png'))+list((ROOT/'scene').glob('*.png'))
entries=[{'文件':str(f.relative_to(ROOT)),'尺寸':Image.open(f).size,'状态':'pending-review','散列':hashlib.sha256(f.read_bytes()).hexdigest()} for f in files]
(ROOT/'review/image-manifest.json').write_text(json.dumps({'说明':'设计候选，不等于用户验收','图片':entries,'裁切记录':crop_records},ensure_ascii=False,indent=2))
print(f'已排版 {len(entries)} 张设计图，等待用户审阅。')
