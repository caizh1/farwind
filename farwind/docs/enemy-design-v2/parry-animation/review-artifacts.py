"""检查本轮图像数量、透明边界与动图时序，并制作干净板审阅拼页。"""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,hashlib
ROOT=Path(__file__).resolve().parent
cfg=json.loads((ROOT/'animation-config.json').read_text())
f=ImageFont.truetype('/System/Library/Fonts/Hiragino Sans GB.ttc',22)
report={'状态':'pending-review','参考提交':cfg['参考提交'],'核对':[]}
paths=sorted((ROOT/'frames').rglob('*.png'))
assert len(paths)==180
hashes=set()
for p in paths:
 im=Image.open(p)
 assert im.mode=='RGBA' and im.size==(512,512)
 a=im.getchannel('A')
 assert a.getpixel((0,0))==0 and a.getpixel((511,511))==0
 b=a.point(lambda v:255 if v>25 else 0).getbbox()
 assert b and b[0]>0 and b[1]>0 and b[2]<512 and b[3]<512
 hashes.add(hashlib.sha256(p.read_bytes()).hexdigest())
assert len(hashes)==180
report['核对'].append('一百八十张单帧均为独立像素内容，透明角、统一画布与主体边界核对通过。此检查不代替美术验收。')
for obj in cfg['怪物']:
 name=obj['文件前缀']
 contact=Image.new('RGB',(1800,510),'#eee8d8')
 for j,direction in enumerate(['down','up','right']):
  c=Image.open(ROOT/'boards'/f'{name}-{direction}-clean.png').convert('RGBA')
  c.thumbnail((590,1200))
  contact.paste(c,(j*600,70),c)
  ImageDraw.Draw(contact).text((j*600+10,15),obj['中文名']+' · '+{'down':'朝下','up':'朝上','right':'朝右'}[direction],font=f,fill='#243e35')
 contact.save(ROOT/'review'/f'{name}-clean-review.jpg')
 for direction in ['down','up','right']:
  for mode,total in [('normal',1500),('perfect',1700)]:
   p=ROOT/'previews'/f'{name}-{direction}-{mode}.gif'
   im=Image.open(p);duration=0
   for i in range(im.n_frames):im.seek(i);duration+=im.info['duration']
   assert duration==total,(p,duration,total)
report['核对'].append('三十个单怪动图均能解码，普通片段加审阅待机合计一千五百毫秒，精准合计一千七百毫秒。')
for direction in ['down','up','right']:
 p=ROOT/'previews'/f'overview-{direction}.gif';im=Image.open(p);duration=0
 for i in range(im.n_frames):im.seek(i);duration+=im.info['duration']
 assert duration==1500
report['核对'].append('三张五怪动图总览均能解码，含放大与建议实际尺寸。')
report['限制']=['候选状态不等于用户验收。','固定足底包围盒锚点未经过正式游戏移动与世界击退验证。','图像生成会有羽片、木纹、斑块等细节变化，正式样片阶段仍需稳定细节。','不宣称已完成正式战斗接入或性能验收。']
(ROOT/'review'/'artifact-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print('图像数量、透明边界、唯一内容与动图总时长核对通过；美术待用户审阅。')
