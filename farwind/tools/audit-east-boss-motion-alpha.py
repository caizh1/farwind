"""检查重渲染图集的透明格式、内容摘要、传输副本与八方向边缘误差。"""
import gzip,hashlib,io,json
from pathlib import Path
from PIL import Image,ImageChops,ImageFilter
ROOT=Path(__file__).resolve().parents[1];ASSETS=ROOT/'public/assets/east-boss-motion-v2';OUT=ROOT/'docs/east-boss-motion-v2/evidence'
m=json.loads((ASSETS/'index.json').read_text());assert m['alphaMode']=={'png':'straight','ktx':'premultiplied'}
content=hashlib.sha256()
for page in m['pages']:
 png=(ASSETS/page['png']).read_bytes();data=(ASSETS/page['ktx']).read_bytes();content.update(png);content.update(data);assert gzip.decompress((ASSETS/page['gzip']).read_bytes())==data
unhashed={k:v for k,v in m.items() if k!='assetHash'};content.update(json.dumps(unhashed,ensure_ascii=False,sort_keys=True).encode());assert content.hexdigest()==m['assetHash']
cache={};rows=[]
for name in ['idle','walk','cross-left','cross-right','death']:
 for direction in range(8):
  seq=m['clips'][name]['directions'][str(direction)];f=m['frames'][seq[len(seq)//2]['frame']];page=m['pages'][f['page']]
  if f['page'] not in cache:
   png=Image.open(ASSETS/page['png']).convert('RGBA');buf=io.BytesIO();png.save(buf,format='DDS',pixel_format='DXT5');tex=Image.open(io.BytesIO(buf.getvalue()[:128]+(ASSETS/page['ktx']).read_bytes()[68:])).convert('RGBA').transpose(Image.Transpose.FLIP_TOP_BOTTOM);cache[f['page']]=(Image.frombytes('RGBA',png.size,png.convert('RGBa').tobytes()),tex)
  x,y,w,h=f['rect'];reference,tex=[im.crop((x,y,x+w,y+h)) for im in cache[f['page']]];a=reference.getchannel('A');edge=ImageChops.subtract(a.point(lambda v:255 if v else 0).filter(ImageFilter.MaxFilter(5)),a.point(lambda v:255 if v>=128 else 0));diff=ImageChops.difference(reference,tex);count=edge.histogram()[255];error=sum(sum(i*n for i,n in enumerate(ch.histogram(edge))) for ch in diff.split()[:3])/(max(1,count)*3);assert error<8
  rows.append({'动作':name,'方向':direction,'边缘预乘颜色平均误差':error})
report={'说明':'范围零至二百五十五；压缩页与正确预乘的透明图片比较。覆盖八方向五个动作中帧，不代替全部帧目检。','资源版本':m['assetHash'],'全部传输副本一致':True,'内容版本校验':True,'结果':rows}
(OUT/'alpha-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print('透明格式、内容摘要及四十组边缘抽样通过。')
