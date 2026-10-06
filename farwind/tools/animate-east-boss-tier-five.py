"""在已认可的工程中追加分身与藤刺动作，输出真实八方向透明母版。"""
import argparse
import hashlib
import importlib.util
import json
import math
import sys
import time
from pathlib import Path
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/east-boss-tier-five'
spec = importlib.util.spec_from_file_location('base', ROOT / 'tools/animate-east-boss.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)

def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')

def clips():
    ready = base.pose(crouch=.06, left=[-48, 8, -10], right=[-48, -8, 10], lean=3)
    result = {'summon': dict(label='同源分身引根', duration=2400, keys=[(0,base.IDLE),(400,base.pose(crouch=.13,left=[-68,14,-12],right=[-68,-14,12],lean=6)),(1050,base.pose(crouch=.15,left=[-80,12,-9],right=[-82,-13,11],lean=5)),(1800,base.pose(crouch=.06,left=[-110,12,-8],right=[-110,-12,8],lean=-6)),(2100,base.pose(crouch=.03,left=[-83,15,-10],right=[-85,-15,10])),(2400,base.IDLE)]),
              'vine-enter': dict(label='八连藤刺聚藤',duration=1200,keys=[(0,base.IDLE),(420,base.pose(crouch=.13,left=[-42,16,-8],right=[-45,-16,8],lean=7)),(850,ready),(1200,ready)]),
              'vine-exit':dict(label='八连藤刺收势',duration=900,keys=[(0,ready),(330,base.pose(crouch=.09,left=[-30,12,-6],right=[-32,-12,6],lean=4)),(900,base.IDLE)])}
    for side in ['left','right']:
        sign=1 if side=='left' else -1
        load=base.pose(crouch=.11,twist=-sign*14,lean=3,left=[-35,12,-9],right=[-35,-12,9])
        load[side]=[-55,sign*18,-sign*12]
        hit=base.pose(crouch=.08,twist=sign*13,lean=11,left=[-48,8,-10],right=[-48,-8,10])
        hit[side]=[-106,-sign*8,-sign*3]
        hit['elbowL' if side=='left' else 'elbowR']=12
        recoil=base.pose(crouch=.07,twist=sign*6,lean=7,left=[-48,8,-10],right=[-48,-8,10])
        recoil[side]=[-84,sign*3,-sign*7]
        result['vine-'+side]=dict(label=('左' if side=='left' else '右')+'臂藤刺',duration=1000,keys=[(0,ready),(300,load),(610,load),(650,hit),(720,hit),(770,recoil),(1000,ready)])
    return result

def sample(keys,t):
    # 各部位独立延迟；快速出臂保持线性速度，枝叶余摆交给已有骨架控制。
    result={}
    for key in keys[0][1]:
        lag=24 if key in ['left','right','elbowL','elbowR'] else 42 if key=='head' else 0
        at=max(0,t-lag)
        for (a,p),(b,q) in zip(keys,keys[1:]):
            if at<=b:
                u=max(0,min(1,(at-a)/(b-a)))
                if b-a>100:u=u*u*(3-2*u)
                result[key]=[v+(q[key][i]-v)*u for i,v in enumerate(p[key])] if isinstance(p[key],list) else p[key]+(q[key]-p[key])*u
                break
        else:result[key]=keys[-1][1][key]
    return result

def build():
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/'docs/east-boss-motion-v2/source/east-boss-animation-render.blend'))
    s=bpy.context.scene;r=bpy.data.objects['缚枝祭主·可编辑骨架'];targets={side:bpy.data.objects[side+'脚落地控制'] for side in ['左','右']}
    definitions=clips();cursor=s.frame_end+60
    for name,c in definitions.items():
        count=round(c['duration']*.06);c.update(start=cursor,end=cursor+count,loop=False,attack=name in ['vine-left','vine-right'],markers={'contact':674,'end':794} if name in ['vine-left','vine-right'] else {})
        s.timeline_markers.new(c['label'],frame=cursor)
        for i in range(count+1):
            t=min(c['duration'],i*1000/60);base.apply(r,targets,sample(c['keys'],t),t,sample(c['keys'],max(0,t-95)))
            for b in r.pose.bones:b.keyframe_insert('rotation_quaternion',frame=cursor+i);b.keyframe_insert('location',frame=cursor+i)
            for ob in targets.values():ob.keyframe_insert('location',frame=cursor+i)
        cursor+=count+2
    s.frame_end=cursor-2;s.frame_set(definitions['summon']['start']);s.render.fps=60
    for ob in [r,*targets.values()]:
        for layer in ob.animation_data.action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        for key in curve.keyframe_points:
                            if key.co.x>=min(c['start'] for c in definitions.values()):key.interpolation='LINEAR'
    note=bpy.data.texts.new('第五档动作说明');note.write('保留既有模型和动作，在时间线末尾追加同源分身与左右手藤刺。身体、手臂、头部依次发力；长藤和分身生长由游戏按正式时钟绘制。源工程每秒六十帧，八方向不镜像。')
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'source/east-boss-tier-five-editable.blend'))
    write(OUT/'source/clips.json',{'说明':'在既有可编辑工程末尾追加五组正式动作。','clips':definitions})

def render(args):
    source=OUT/'source/east-boss-tier-five-editable.blend';bpy.ops.wm.open_mainfile(filepath=str(source))
    s=bpy.context.scene;r=bpy.data.objects['缚枝祭主·可编辑骨架'];orient=bpy.data.objects['八方向旋转根'];definitions=json.loads((OUT/'source/clips.json').read_text())['clips']
    s.render.engine='BLENDER_EEVEE';s.render.resolution_x=1664;s.render.resolution_y=1664;s.render.resolution_percentage=100;s.render.film_transparent=True;s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA';s.eevee.taa_render_samples=8
    project=lambda v:[(q:=world_to_camera_view(s,s.camera,v)).x*1664,(1-q.y)*1664]
    wanted=args.clips.split(',') if args.clips else list(definitions);records=[];start=time.time()
    for name in wanted:
        c=definitions[name];times=list(range(0,c['duration'],33))
        if c['attack']:times+=list(range(590,810,16))
        times=sorted(set(times+[c['duration'],*c['markers'].values()]))
        if args.probe:times=[0,c['duration']/2,c['duration']]
        for d in map(int,args.directions.split(',')):
            orient.rotation_euler.z=d*math.pi/4
            for i,t in enumerate(times):
                f=c['start']+t*.06;s.frame_set(int(f),subframe=f-int(f));bpy.context.view_layer.update()
                path=OUT/('probe' if args.probe else 'master')/name/str(d)/f'{i:04d}.png';path.parent.mkdir(parents=True,exist_ok=True)
                if not path.exists():s.render.filepath=str(path);bpy.ops.render.render(write_still=True)
                sockets={}
                for label,bone in [('left','左镰臂'),('right','右镰臂'),('core','胸'),('footL','左脚'),('footR','右脚'),('vineL','左前臂'),('vineR','右前臂')]:
                    b=r.pose.bones[bone];sockets[label]=project(r.matrix_world@(b.tail if label.startswith('vine') else b.head.lerp(b.tail,.45) if label=='core' else b.head))
                records.append(dict(clip=name,direction=d,time=t,file=str(path.relative_to(OUT)),root=project(orient.matrix_world@Vector((0,0,0))),sockets=sockets))
            print('已完成方向',name,d,'累计帧',len(records),flush=True)
    write(OUT/'source'/('probe-frames.json' if args.probe else 'frames-'+args.directions.replace(',','-')+'.json'),{'说明':'由交付工程直接渲染，未做单帧修图。','sourceHash':hashlib.sha256(source.read_bytes()).hexdigest(),'seconds':time.time()-start,'frames':records})

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('mode',choices=['build','render']);p.add_argument('--directions',default='0,1,2,3,4,5,6,7');p.add_argument('--clips');p.add_argument('--probe',action='store_true');a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);build() if a.mode=='build' else render(a)
