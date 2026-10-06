"""追加第五档动作图集，既有页保持不变，共用透明边缘处理和压缩格式。"""
import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
from PIL import Image
import gzip

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'docs/east-boss-tier-five'
OUT=ROOT/'public/assets/east-boss-motion-v2'
spec=importlib.util.spec_from_file_location('pack',ROOT/'tools/pack-east-boss-motion.py')
pack=importlib.util.module_from_spec(spec);spec.loader.exec_module(pack);pack.SOURCE=SOURCE

def main():
    parser=argparse.ArgumentParser(description='追加第五档正式动作图集');parser.add_argument('--base-index',help='重建时指定保留的旧版清单');args=parser.parse_args()
    manifest=json.loads((Path(args.base_index) if args.base_index else OUT/'index.json').read_text())
    assert not manifest.get('tierFive'),'已追加第五档图集，不能重复追加'
    records=json.loads((SOURCE/'source/frames-0-1-2-3-4-5-6-7.json').read_text())['frames']
    definitions=json.loads((SOURCE/'source/clips.json').read_text())['clips']
    scale=512/1074;size=(round(1664*scale),round(1664*scale));start=len(manifest['pages']);digest=hashlib.sha256(manifest['assetHash'].encode());seen={};pending=[];x=y=row=width=height=0
    def flush():
        nonlocal x,y,row,width,height,pending
        if not pending:return
        w=math.ceil(width/4)*4;h=math.ceil(height/4)*4;image=Image.new('RGBA',(w,h));index=len(manifest['pages'])
        for fid,im,px,py in pending:image.paste(im,(px,py));manifest['frames'][fid].update(page=index,rect=[px,py,im.width,im.height])
        png=f'page-{index:04d}.png';ktx=f'page-{index:04d}.ktx';image.save(OUT/png,compress_level=6);data,_=pack.ktx(image);(OUT/ktx).write_bytes(data);gz=gzip.compress(data,compresslevel=6,mtime=0);(OUT/(ktx+'.gz')).write_bytes(gz);digest.update(data);digest.update((OUT/png).read_bytes())
        manifest['pages'].append(dict(png=png,ktx=ktx,gzip=ktx+'.gz',gzipBytes=len(gz),width=w,height=h,bytes=w*h*4,compressedBytes=len(data)-68));pending=[];x=y=row=width=height=0
    previous=None
    for n,f in enumerate(records):
        group=(f['clip'],f['direction'])
        if group!=previous:flush();previous=group
        f,im,pivot,sockets,key=pack.prepare_frame((f,size,scale));fid=seen.get(key)
        c=definitions[f['clip']];clip=manifest['clips'].setdefault(f['clip'],dict(duration=c['duration'],loop=False,markers=c['markers'],directions={}))
        if fid is None:
            fid=f"tier-five/{f['clip']}/{f['direction']}/{len(clip['directions'].get(str(f['direction']),[])):04d}";seen[key]=fid
            if x+im.width>1024:x=0;y+=row;row=0
            if y+im.height>1024:flush()
            manifest['frames'][fid]=dict(page=-1,rect=[],pivot=pivot,sockets=sockets);pending.append((fid,im,x,y));x+=im.width;row=max(row,im.height);width=max(width,x);height=max(height,y+im.height)
        clip['directions'].setdefault(str(f['direction']),[]).append(dict(at=f['time'],frame=fid))
        if n%300==0:print('第五档已处理母版',n,flush=True)
    flush();manifest['tierFive']=1;manifest['说明']='原有八方向动作及第五档分身、交替藤刺；共用纹理，主体比例固定。'
    for name in definitions:
        for direction in range(8):
            seq=manifest['clips'][name]['directions'][str(direction)];assert seq[0]['at']==0 and seq[-1]['at']==definitions[name]['duration']
    digest.update(json.dumps(manifest,ensure_ascii=False,sort_keys=True).encode());manifest['assetHash']=digest.hexdigest();(OUT/'index.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+'\n')
    report={'说明':'追加页可与旧页共用一个受预算约束的缓存；下载总量不等于驻留峰值。','母版帧数':len(records),'新增独立帧数':len(seen),'新增页起点':start,'新增页数':len(manifest['pages'])-start,'新增压缩纹理字节':sum(p['compressedBytes'] for p in manifest['pages'][start:]),'新增PNG解码字节':sum(p['bytes'] for p in manifest['pages'][start:]),'资源内容版本':manifest['assetHash']}
    (SOURCE/'evidence/packing.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False))

if __name__=='__main__':main()
