"""只替换藤刺四个片段；旧页保留为对照，透明格式及固定主体比例不变。"""
import argparse
import gzip
import hashlib
import importlib.util
import json
import math
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'docs/east-boss-vine-refinement'
spec=importlib.util.spec_from_file_location('pack',ROOT/'tools/pack-east-boss-motion.py');pack=importlib.util.module_from_spec(spec);spec.loader.exec_module(pack);pack.SOURCE=SOURCE

def material(output):
    image=Image.new('RGBA',(1024,256))
    for name,x,width in [('base',0,256),('shaft',256,512),('tip',768,256)]:
        part=Image.open(SOURCE/'source'/('vine-'+name+'.png')).convert('RGBA');box=part.getchannel('A').getbbox();assert box
        part=part.crop((box[0],0,box[2],256)).convert('RGBa').resize((width,256),Image.Resampling.LANCZOS).convert('RGBA');image.paste(part,(x,0))
    image=pack.bleed_edges(image);output.mkdir(parents=True,exist_ok=True);path=output/'vine-material-v1.png';image.save(path)
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    p=argparse.ArgumentParser(description='打包精修藤刺动作');p.add_argument('--output',required=True);a=p.parse_args();out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
    original=ROOT/'public/assets/east-boss-motion-v2/index.json';baseline=SOURCE/'source/atlas-before-refinement.json'
    if not baseline.exists():baseline.write_text(original.read_text())
    m=json.loads(baseline.read_text())
    assert all((out/p['png']).exists() and (out/p['ktx']).exists() and (out/p['gzip']).exists() for p in m['pages']),'独立打包目录缺少原有图集页'
    data=json.loads((SOURCE/'source/frames-0-1-2-3-4-5-6-7.json').read_text());defs=json.loads((SOURCE/'source/clips.json').read_text())['clips'];source_hash=hashlib.sha256((SOURCE/'source/east-boss-vine-refined.blend').read_bytes()).hexdigest();assert source_hash==data['sourceHash'],'母版与交付工程不一致'
    scale=512/1074;size=(round(1664*scale),)*2;seen={};pending=[];x=y=row=width=height=0
    next_id=max(int(path.stem.split('-')[1]) for path in (ROOT/'public/assets/east-boss-motion-v2').glob('page-*.png'))+1
    digest=hashlib.sha256(m['assetHash'].encode());start=len(m['pages']);old_frames=set()
    for name in defs:
        for seq in m['clips'][name]['directions'].values():old_frames.update(f['frame'] for f in seq)
        m['clips'][name]=dict(duration=defs[name]['duration'],loop=False,markers=defs[name]['markers'],directions={})
    def flush():
        nonlocal pending,x,y,row,width,height,next_id
        if not pending:return
        w=math.ceil(width/4)*4;h=math.ceil(height/4)*4;im=Image.new('RGBA',(w,h));page=len(m['pages'])
        for fid,frame,px,py in pending:im.paste(frame,(px,py));m['frames'][fid].update(page=page,rect=[px,py,frame.width,frame.height])
        stem=f'page-{next_id:04d}';next_id+=1;im.save(out/(stem+'.png'),compress_level=6);encoded,_=pack.ktx(im);(out/(stem+'.ktx')).write_bytes(encoded);z=gzip.compress(encoded,compresslevel=6,mtime=0);(out/(stem+'.ktx.gz')).write_bytes(z);digest.update(encoded);digest.update((out/(stem+'.png')).read_bytes())
        m['pages'].append(dict(png=stem+'.png',ktx=stem+'.ktx',gzip=stem+'.ktx.gz',gzipBytes=len(z),width=w,height=h,bytes=w*h*4,compressedBytes=w*h));pending=[];x=y=row=width=height=0
    last=None
    for n,f in enumerate(data['frames']):
        group=(f['clip'],f['direction'])
        if group!=last:flush();last=group
        f,im,pivot,sockets,key=pack.prepare_frame((f,size,scale));fid=seen.get(key)
        if fid is None:
            fid=f"vine-refined/{f['clip']}/{f['direction']}/{n:04d}";seen[key]=fid
            if x+im.width>1024:x=0;y+=row;row=0
            if y+im.height>1024:flush()
            m['frames'][fid]=dict(page=-1,rect=[],pivot=pivot,sockets=sockets);pending.append((fid,im,x,y));x+=im.width;row=max(row,im.height);width=max(width,x);height=max(height,y+im.height)
        m['clips'][f['clip']]['directions'].setdefault(str(f['direction']),[]).append(dict(at=f['time'],frame=fid))
        if n%200==0:print('已打包精修母版',n,flush=True)
    flush();new_pages=m['pages'][start:]
    used=set(m['baseFrames'])
    for clip in m['clips'].values():
        for seq in clip['directions'].values():used.update(f['frame'] for f in seq)
    for fid in old_frames-used:m['frames'].pop(fid,None)
    used_pages=sorted(set(f['page'] for f in m['frames'].values()));remap={old:new for new,old in enumerate(used_pages)};m['pages']=[m['pages'][i] for i in used_pages]
    for f in m['frames'].values():f['page']=remap[f['page']]
    version=material(out.parent/'boss-vine');m['vineRefinement']=1;m['vineMaterialHash']=version;m['sourceHash']=source_hash;m['说明']='已认可主体及原招式保留；藤刺包含交织根出口、独立发力曲线与连续换手。'
    digest.update(json.dumps(m,ensure_ascii=False,sort_keys=True).encode());m['assetHash']=digest.hexdigest();(out/'index.json').write_text(json.dumps(m,ensure_ascii=False,separators=(',',':'))+'\n')
    report={'说明':'旧文件未删除；清单只引用当前片段，新增长藤材质预留一兆纹理。','母版帧数':len(data['frames']),'独立帧数':len(seen),'新增页数':len(new_pages),'清单总页数':len(m['pages']),'新增PNG下载字节':sum((out/p['png']).stat().st_size for p in new_pages),'新增压缩下载字节':sum(p['gzipBytes'] for p in new_pages),'长藤材质纹理字节':1024*256*4,'长藤材质内容版本':version,'资源内容版本':m['assetHash']}
    evidence=SOURCE/'evidence';evidence.mkdir(exist_ok=True);(evidence/'packing.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False))

if __name__=='__main__':main()
