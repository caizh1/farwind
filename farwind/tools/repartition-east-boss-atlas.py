"""将已有页重新切分，缩小双实体播放时单次上传和预取粒度；不改变帧像素或根点。"""
import concurrent.futures
import hashlib
import importlib.util
import json
import math
import gzip
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/assets/east-boss-motion-v2'
spec=importlib.util.spec_from_file_location('pack',ROOT/'tools/pack-east-boss-motion.py');pack=importlib.util.module_from_spec(spec);spec.loader.exec_module(pack)
def split(args):
    index,page,frames,base,argsStart=args
    original=Image.open(OUT/page['png']).convert('RGBA');groups=[];pending=[];x=y=row=width=height=0
    def flush():
        nonlocal pending,x,y,row,width,height
        if pending:groups.append((pending,width,height))
        pending=[];x=y=row=width=height=0
    # 常驻与动态帧分开，常驻页不夹带整个攻击段。
    previous=None
    for fid,f in sorted(frames,key=lambda v:(v[0] not in base,-v[1]['rect'][3],-v[1]['rect'][2])):
        pinned=fid in base
        if previous is not None and pinned!=previous:flush()
        previous=pinned;px,py,w,h=f['rect'];im=original.crop((px,py,px+w,py+h))
        if x+w>1024:x=0;y+=row;row=0
        if y+h>1024:flush()
        pending.append((fid,im,x,y));x+=w;row=max(row,h);width=max(width,x);height=max(height,y+h)
    flush();pages=[];placements={}
    for j,(entries,w,h) in enumerate(groups):
        w=math.ceil(w/4)*4;h=math.ceil(h/4)*4;image=Image.new('RGBA',(w,h));pageID=argsStart+index*32+j
        assert j<32
        for fid,im,px,py in entries:image.paste(im,(px,py));placements[fid]={'local':j,'rect':[px,py,im.width,im.height]}
        png=f'page-{pageID:04d}.png';ktx=f'page-{pageID:04d}.ktx';image.save(OUT/png,compress_level=6);data,_=pack.ktx(image);(OUT/ktx).write_bytes(data);gz=gzip.compress(data,compresslevel=6,mtime=0);(OUT/(ktx+'.gz')).write_bytes(gz)
        pages.append(dict(png=png,ktx=ktx,gzip=ktx+'.gz',gzipBytes=len(gz),width=w,height=h,bytes=w*h*4,compressedBytes=w*h))
    return index,pages,placements
if __name__=='__main__':
    m=json.loads((OUT/'index.json').read_text());assert not m.get('smallPages');old=m['pages'];base=set(m['baseFrames']);mapping={}
    for fid,f in m['frames'].items():mapping.setdefault(f['page'],[]).append((fid,f))
    start=max(int(p['png'][5:-4]) for p in old)+1
    source=ROOT/'docs/east-boss-tier-five/source/atlas-before-repartition.json';source.write_text(json.dumps(m,ensure_ascii=False))
    pages=[];digest=hashlib.sha256()
    with concurrent.futures.ProcessPoolExecutor(max_workers=4) as pool:
        for i,new,placements in pool.map(split,[(i,p,mapping[i],base,start) for i,p in enumerate(old)]):
            offset=len(pages)
            for fid,v in placements.items():m['frames'][fid].update(page=offset+v['local'],rect=v['rect'])
            pages+=new
            for p in new:digest.update((OUT/p['ktx']).read_bytes());digest.update((OUT/p['png']).read_bytes())
            if i%100==0:print('已重新分包',i,'/',len(old),flush=True)
    m['pages']=pages;m['smallPages']=1;digest.update(json.dumps(m,ensure_ascii=False,sort_keys=True).encode());m['assetHash']=digest.hexdigest();(OUT/'index.json').write_text(json.dumps(m,ensure_ascii=False,separators=(',',':'))+'\n')
    report={'说明':'所有帧像素保留，仅更改打包位置；常驻帧与动态帧分开。','旧页数':len(old),'新页数':len(pages),'常驻PNG字节':sum(pages[i]['bytes'] for i in set(m['frames'][f]['page'] for f in base)),'运行下载PNG字节':sum((OUT/p['png']).stat().st_size for p in pages),'运行下载压缩字节':sum(p['gzipBytes'] for p in pages),'资源内容版本':m['assetHash']};(ROOT/'docs/east-boss-tier-five/evidence/repartition.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False))
