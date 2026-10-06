"""核验透明格式、图集布局、传输副本及真实压缩边缘误差。"""
import gzip,hashlib,io,json
from pathlib import Path
from PIL import Image,ImageChops,ImageFilter
ROOT=Path(__file__).resolve().parents[1];ASSETS=ROOT/'public/assets/east-boss-animation';OUT=ROOT/'docs/east-boss-animation/evidence/alpha-fix'
m=json.loads((ASSETS/'index.json').read_text());old=json.loads((OUT/'before-index.json').read_text())
assert m['frames']==old['frames'] and m['clips']==old['clips'],'帧尺寸、挂点或时序发生变化'
assert m['sourceHash']==old['sourceHash'],'源工程发生变化'
assert m['alphaMode']=={'png':'straight','ktx':'premultiplied'}
content=hashlib.sha256()
for page in m['pages']:
    png=(ASSETS/page['png']).read_bytes();data=(ASSETS/page['ktx']).read_bytes();content.update(png);content.update(data)
    assert gzip.decompress((ASSETS/page['gzip']).read_bytes())==data
unhashed={k:v for k,v in m.items() if k!='assetHash'};content.update(json.dumps(unhashed,ensure_ascii=False,sort_keys=True).encode());assert content.hexdigest()==m['assetHash']
def decode(png,ktx):
    im=Image.open(png).convert('RGBA');buf=io.BytesIO();im.save(buf,format='DDS',pixel_format='DXT5')
    return Image.open(io.BytesIO(buf.getvalue()[:128]+ktx.read_bytes()[68:])).convert('RGBA').transpose(Image.Transpose.FLIP_TOP_BOTTOM)
oldpng=Image.open(OUT/'before-page-0000.png').convert('RGBA');png=Image.open(ASSETS/'page-0000.png').convert('RGBA')
assert oldpng.getchannel('A').tobytes()==png.getchannel('A').tobytes(),'透明度发生变化'
oldtex=decode(OUT/'before-page-0000.png',OUT/'before-page-0000.ktx');tex=decode(ASSETS/'page-0000.png',ASSETS/'page-0000.ktx')
reference=Image.frombytes('RGBA',png.size,png.convert('RGBa').tobytes())
rows=[]
for direction in range(8):
    f=m['frames'][f'cocoon-enter/{direction}/0000'];x,y,w,h=f['rect'];box=(x,y,x+w,y+h)
    images=[im.crop(box) for im in [reference,oldtex,tex]];a=images[0].getchannel('A')
    edge=ImageChops.subtract(a.point(lambda v:255 if v>0 else 0).filter(ImageFilter.MaxFilter(5)),a.point(lambda v:255 if v>=128 else 0))
    def error(im):
        diff=ImageChops.difference(images[0],im);count=edge.histogram()[255]
        return sum(sum(i*n for i,n in enumerate(ch.histogram(edge))) for ch in diff.split()[:3])/(count*3)
    rows.append({'方向':direction,'原边缘颜色误差':error(images[1]),'修复后边缘颜色误差':error(images[2])})
    assert rows[-1]['修复后边缘颜色误差']<rows[-1]['原边缘颜色误差']*.15,'边缘亮色未充分消除'
report={'说明':'边缘误差为压缩后预乘颜色与透明图片正确预乘颜色的平均绝对差，范围零至二百五十五。透明度和所有帧坐标完全保持；不是全设备视觉验收。','资源版本':m['assetHash'],'页数':len(m['pages']),'全部传输副本一致':True,'帧坐标挂点时序一致':True,'八方向边缘对照':rows}
(OUT/'audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False))
