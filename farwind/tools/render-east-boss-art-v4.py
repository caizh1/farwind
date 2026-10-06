"""第四版真实工程渲染，记录每次渲染来源摘要；复用现有相机和渲染器。"""
import argparse
import hashlib
import importlib.util
import json
import os
import sys
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view

ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/east-boss-art-v4'
os.environ['EAST_BOSS_ART_OUT']=str(OUT)
spec=importlib.util.spec_from_file_location('existing_art',ROOT/'tools/build-east-boss-art-v2.py')
art=importlib.util.module_from_spec(spec);spec.loader.exec_module(art)
parser=argparse.ArgumentParser(description='第四版真实工程渲染')
parser.add_argument('--mode',choices=['static','source','motion'],required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
source=OUT/'source/east-boss-art-editable.blend';delivery=OUT/'source/east-boss-art-delivery.blend'
records=[]
def render(path,mode,percent=100,folder=OUT):
    (folder/'evidence').mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(path));art.OUT=folder;art.art.RIG=bpy.data.objects['缚枝祭主·可编辑骨架']
    if path==source and mode=='front':
        scene=bpy.context.scene;scene.frame_set(1);bpy.context.view_layer.update()
        changes=json.loads((OUT/'evidence/scythe-changes.json').read_text())
        norm=changes['相机归一化'];cam=bpy.data.objects['游戏视角'];deps=bpy.context.evaluated_depsgraph_get()
        def project(p):
            q=world_to_camera_view(scene,cam,p)
            return [(q.x-norm['中心'])/norm['高度'],(1-q.y-norm['顶部'])/norm['高度']]
        curves={};landmarks={}
        for side in ['左','右']:
            ob=bpy.data.objects[side+'镰刃分层截面'];ev=ob.evaluated_get(deps);mesh=ev.to_mesh();rows=len(mesh.vertices)//10
            curves[side]={'外弧':[project(ev.matrix_world@mesh.vertices[i*10].co) for i in range(rows)],'内弧':[project(ev.matrix_world@mesh.vertices[i*10+4].co) for i in range(rows)]}
            landmarks[side+'镰尖']=curves[side]['外弧'][-1]
            landmarks[side+'镰根']=curves[side]['外弧'][0]
            landmarks[side+'最大外弧']=min(curves[side]['外弧'],key=lambda p:p[0]) if side=='左' else max(curves[side]['外弧'],key=lambda p:p[0])
            ev.to_mesh_clear()
            for label,bone in [('肩','上臂'),('肘','前臂')]:landmarks[side+label]=project(art.art.RIG.matrix_world@art.art.RIG.pose.bones[side+bone].head)
        for name,expected in changes['未修改网格摘要'].items():
            ob=bpy.data.objects[name]
            actual=hashlib.sha256(repr(([tuple(v.co) for v in ob.data.vertices],[tuple(p.vertices) for p in ob.data.polygons])).encode()).hexdigest()
            assert actual==expected,'范围外网格被修改：'+name
        (OUT/'evidence/scythe-projections.json').write_text(json.dumps({'说明':'最终源工程第一帧真实网格投影；固定第三版相机坐标系，避免叶片边界改变引起对齐漂移。','工程摘要':hashlib.sha256(source.read_bytes()).hexdigest(),'未修改网格数':len(changes['未修改网格摘要']),'弧线':curves,'地标':landmarks},ensure_ascii=False,indent=2)+'\n')
    art.render(mode,percent)
    records.append({'工程':str(path.relative_to(ROOT)),'摘要':hashlib.sha256(path.read_bytes()).hexdigest(),'视图':mode,'分辨率比例':percent,'目录':str(folder.relative_to(ROOT))})
if args.mode=='static':
    render(delivery,'all')
    for mode in ['clay','silhouette','neutral']:render(delivery,mode,50 if mode!='neutral' else 100)
elif args.mode=='source':
    for mode in ['front','quarter-left']:render(source,mode,100,OUT/'source-check')
    render(delivery,'quarter-left',100,OUT/'delivery-check')
else:
    render(delivery,'motion',25)
(OUT/'evidence'/f'render-{args.mode}.json').write_text(json.dumps({'说明':'直接从记录工程渲染，没有补画或锐化；连续片段仅为检查动作。','记录':records},ensure_ascii=False,indent=2)+'\n')
