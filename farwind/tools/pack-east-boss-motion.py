"""正式渲染母版裁切、去重、分包；同时输出 PNG 与原生 DXT5/KTX1。"""
import argparse
import hashlib
import gzip
import io
import json
import math
import struct
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

from PIL import Image, ImageChops

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'docs/east-boss-motion-v2'
OUT=ROOT/'public/assets/east-boss-motion-v2'


def premultiply(im):
    # 压缩上传不会执行浏览器的预乘转换，必须离线写入预乘颜色。
    return Image.frombytes('RGBA',im.size,im.convert('RGBa').tobytes())


def bleed_edges(im):
    # 逐圈复制最近有效像素的整组颜色，不逐通道取最大值；透明度保持原样。
    alpha=im.getchannel('A');known=alpha.point(lambda a:255 if a else 0);rgb=im.convert('RGB')
    for _ in range(4):
        old_rgb,old_known=rgb.copy(),known.copy()
        for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]:
            shifted=Image.new('RGB',im.size);shifted.paste(old_rgb,(dx,dy))
            mask=Image.new('L',im.size);mask.paste(old_known,(dx,dy))
            take=ImageChops.subtract(mask,known);rgb.paste(shifted,(0,0),take)
            known=ImageChops.lighter(known,take)
    rgb.putalpha(alpha);return rgb


def ktx(im):
    im=premultiply(im)
    stream=io.BytesIO();im.transpose(Image.Transpose.FLIP_TOP_BOTTOM).save(stream,format='DDS',pixel_format='DXT5');dds=stream.getvalue();data=dds[128:]
    assert len(data)==math.ceil(im.width/4)*math.ceil(im.height/4)*16,'压缩块大小错误'
    header=b'\xabKTX 11\xbb\r\n\x1a\n'+struct.pack('<13I',0x04030201,0,1,0,0x83F3,0x1908,im.width,im.height,0,0,1,1,0)
    decoded=Image.open(io.BytesIO(dds)).convert('RGBA').transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    return header+struct.pack('<I',len(data))+data,decoded


def prepare_frame(args):
    f,size,scale=args
    image=Image.open(SOURCE/f['file']).convert('RGBA').convert('RGBa').resize(size,Image.Resampling.LANCZOS).convert('RGBA');box=image.getchannel('A').getbbox();assert box,'渲染为空'
    crop=image.crop(box);canvas=Image.new('RGBA',(crop.width+8,crop.height+8));canvas.paste(crop,(4,4))
    # 扩散透明区颜色，不改变透明度，降低块压缩和线性采样的黑边。
    canvas=bleed_edges(canvas)
    pivot=[round(f['root'][0]*scale-box[0]+4,4),round(f['root'][1]*scale-box[1]+4,4)]
    sockets={k:[round(v[0]*scale-box[0]+4,4),round(v[1]*scale-box[1]+4,4)] for k,v in f['sockets'].items()}
    digest=hashlib.sha256(canvas.tobytes()+str((canvas.size,pivot,sockets)).encode()).hexdigest()
    return f,canvas,pivot,sockets,digest

def prepared_frames(records,size,scale):
    # 有界批次并行处理大母版，避免全部解码结果同时驻留内存。
    with ProcessPoolExecutor(max_workers=4) as pool:
        for start in range(0,len(records),32):
            yield from pool.map(prepare_frame,[(f,size,scale) for f in records[start:start+32]])


def main():
    parser=argparse.ArgumentParser(description='东侧首领动画打包');parser.add_argument('--pilot',action='store_true');args=parser.parse_args()
    definitions=json.loads((SOURCE/'source/clips.json').read_text())['clips'];records=[];source_hash=hashlib.sha256((SOURCE/'source/east-boss-animation-render.blend').read_bytes()).hexdigest()
    for path in sorted((SOURCE/'source').glob('frames-*.json'),key=lambda p:p.stat().st_mtime_ns):
        metadata=json.loads(path.read_text())
        if metadata.get('sourceHash')==source_hash:records+=metadata['frames']
    records=list({(f['clip'],f['direction'],f['time']):f for f in records}.values())
    if args.pilot:records=[f for f in records if f['clip'] in ['idle','walk','cross-left','cross-link','cross-right']]
    assert records,'尚无正式母版'
    neutral=Image.open(SOURCE/'master/idle/0/0000.png').convert('RGBA');bbox=neutral.getchannel('A').point(lambda a:255 if a>=32 else 0).getbbox();native=bbox[3]-bbox[1]
    assert native>=1024,f'母版主体不足一千零二十四像素：{native}'
    scale=512/native;size=(round(neutral.width*scale),round(neutral.height*scale))
    OUT.mkdir(parents=True,exist_ok=True)
    manifest=dict(version=3,kind='bound-branch',referenceHeight=512,sourceHash=hashlib.sha256((SOURCE/'source/east-boss-animation-render.blend').read_bytes()).hexdigest(),alphaMode={'png':'straight','ktx':'premultiplied'},pages=[],frames={},clips={},说明='第四版真实八方向逐帧动画；固定主体比例，地面根点允许位于裁切框外。完整动作用于正式路径。',complete=not args.pilot)
    content_hash=hashlib.sha256()
    seen={};pending=[];page_x=page_y=row_height=0;page_w=page_h=0;colour_error=0;alpha_error=0;pixels=0
    def flush():
        nonlocal pending,page_x,page_y,row_height,page_w,page_h,colour_error,alpha_error,pixels
        if not pending:return
        w=math.ceil(page_w/4)*4;h=math.ceil(page_h/4)*4;im=Image.new('RGBA',(w,h));idx=len(manifest['pages'])
        for fid,frame,x,y in pending:
            im.paste(frame,(x,y));manifest['frames'][fid]['page']=idx;manifest['frames'][fid]['rect']=[x,y,frame.width,frame.height]
        png=f'page-{idx:04d}.png';compressed=f'page-{idx:04d}.ktx';im.save(OUT/png,compress_level=6)
        data,decoded=ktx(im);(OUT/compressed).write_bytes(data);gz=gzip.compress(data,compresslevel=6,mtime=0);(OUT/(compressed+'.gz')).write_bytes(gz)
        # 使用真实编码后解码的差值，透明像素不计入颜色误差。
        content_hash.update((OUT/png).read_bytes());content_hash.update(data)
        difference=ImageChops.difference(premultiply(im),decoded)
        mask=im.getchannel('A').point(lambda a:255 if a>=128 else 0)
        pixels+=mask.histogram()[255]
        for channel in difference.split()[:3]:colour_error+=sum(i*n for i,n in enumerate(channel.histogram(mask)))
        alpha_error+=sum(i*n for i,n in enumerate(difference.getchannel('A').histogram()))
        manifest['pages'].append(dict(png=png,ktx=compressed,gzip=compressed+'.gz',gzipBytes=len(gz),width=w,height=h,bytes=w*h*4,compressedBytes=len(data)-68))
        pending=[];page_x=page_y=row_height=page_w=page_h=0
    base_clips={'cross-left-planted','cross-right-planted','idle','entry','hurt','death','cross-left','cross-right','parry-left','parry-right','perfect-left','perfect-right',*[n for n in definitions if n.startswith('walk-turn-')]}
    previous=None
    ordered=sorted(records,key=lambda f:(0 if f['time']==0 and f['clip'] in base_clips else 1,f['clip'],f['direction'],f['time']))
    for n,(f,canvas,pivot,sockets,digest) in enumerate(prepared_frames(ordered,size,scale)):
        name=f['clip'];d=str(f['direction']);group=('基础',) if f['time']==0 and name in base_clips else (name,d)
        if group!=previous:flush();previous=group
        clip=manifest['clips'].setdefault(name,dict(duration=definitions[name]['duration'],loop=definitions[name]['loop'],directions={},**{k:definitions[name][k] for k in ['markers','support','turnDegrees','startPhase','endPhase'] if k in definitions[name]}))
        fid=seen.get(digest)
        if fid is None:
            fid=f'{name}/{d}/{len(clip["directions"].get(d,[])):04d}';seen[digest]=fid
            if page_x+canvas.width>2048:page_x=0;page_y+=row_height;row_height=0
            if page_y+canvas.height>2048:flush()
            assert canvas.width<=2048 and canvas.height<=2048,'单帧超过图集尺寸'
            manifest['frames'][fid]=dict(page=-1,rect=[],pivot=pivot,sockets=sockets)
            pending.append((fid,canvas,page_x,page_y));page_x+=canvas.width;row_height=max(row_height,canvas.height);page_w=max(page_w,page_x);page_h=max(page_h,page_y+canvas.height)
        clip['directions'].setdefault(d,[]).append(dict(at=f['time'],frame=fid))
        if n%200==0:print('已处理渲染帧',n,flush=True)
    flush()
    required=set(definitions) if not args.pilot else {'idle','walk','cross-left','cross-link','cross-right'}
    assert required<=manifest['clips'].keys(),'缺少动作'
    for name in required:
        assert set(manifest['clips'][name]['directions'])==set(map(str,range(8))),'缺少真实方向：'+name
    manifest['baseFrames']=sorted({c['directions'][str(d)][0]['frame'] for name,c in manifest['clips'].items() if name in base_clips for d in range(8)})
    content_hash.update(json.dumps(manifest,ensure_ascii=False,sort_keys=True).encode())
    manifest['assetHash']=content_hash.hexdigest()
    (OUT/'index.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+'\n')
    report={'说明':'压缩误差来自每页实际 DXT5 编解码，性能与动作验收另行实测。','母版主体高度':native,'运行时参考高度':512,'动作数':len(manifest['clips']),'采样帧数':len(records),'去重帧数':len(manifest['frames']),'页数':len(manifest['pages']),'无损传输压缩字节':sum(p['gzipBytes'] for p in manifest['pages']),'全部解码字节':sum(p['bytes'] for p in manifest['pages']),'全部压缩纹理字节':sum(p['compressedBytes'] for p in manifest['pages']),'主体颜色平均绝对误差':colour_error/max(1,pixels*3),'透明度累计误差':alpha_error,'文件字节':sum(p.stat().st_size for p in OUT.iterdir() if p.is_file())}
    (SOURCE/'evidence').mkdir(exist_ok=True);(SOURCE/'evidence/packing.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False),flush=True)


if __name__=='__main__':main()
