"""把生成源图合成到浅色底，供实际逐图检查；不改动角色像素。"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parent
font=ImageFont.truetype('/System/Library/Fonts/Hiragino Sans GB.ttc',20)
for p in (ROOT/'source').glob('*.png'):
    raw=Image.open(p).convert('RGBA')
    raw.thumbnail((1000,1000))
    out=Image.new('RGB',(raw.width,raw.height+40),'#eee8d8')
    out.paste(raw,(0,40),raw)
    ImageDraw.Draw(out).text((15,8),p.stem,font=font,fill='#243e35')
    out.save(ROOT/'review'/f'{p.stem}-source-check.jpg')
