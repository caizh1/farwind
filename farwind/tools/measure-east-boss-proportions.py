"""记录固定相机下的归一化地标；原画地标为人工近似标注，不作为自动美术评分。"""
import json
import os
from pathlib import Path
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT=Path(__file__).resolve().parents[1];OUT=Path(os.environ.get('EAST_BOSS_ART_OUT', ROOT/'docs/east-boss-art-v2')).resolve()
bpy.ops.wm.open_mainfile(filepath=str(OUT/'source/east-boss-art-editable.blend'))
scene=bpy.context.scene;rig=bpy.data.objects['缚枝祭主·可编辑骨架'];cam=bpy.data.objects['游戏视角']
references={'面具下缘':(670,328),'左肩连接':(511,323),'右肩连接':(777,364),'左肘转折':(337,564),'右肘转折':(924,607),'左镰尖':(514,1055),'右镰尖':(991,1078),'左膝':(487,827),'右膝':(785,851),'左踝':(436,1045),'右踝':(827,1045)}
records=[]
for frame,label in [(1,'中立造型'),(260,'原画倾向展示')]:
    scene.frame_set(frame);bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
    projected=[];focus={}
    for ob in scene.objects:
        if ob.type!='MESH':continue
        ev=ob.evaluated_get(deps);me=ev.to_mesh()
        for v in me.vertices:
            p=world_to_camera_view(scene,cam,ev.matrix_world@v.co);projected.append((p.x,1-p.y))
        if ob.name=='面具中央生长脊':
            v=min(me.vertices,key=lambda v:v.co.z);focus['面具下缘']=ev.matrix_world@v.co
        if '镰刃分层截面' in ob.name:
            v=min(me.vertices,key=lambda v:v.co.z);focus[ob.name[0]+'镰尖']=ev.matrix_world@v.co
        ev.to_mesh_clear()
    xmin=min(p[0] for p in projected);xmax=max(p[0] for p in projected);top=min(p[1] for p in projected);bottom=max(p[1] for p in projected);height=bottom-top;cx=(xmin+xmax)/2
    for side in ['左','右']:
        for labelpart,bone in [('肩连接','上臂'),('肘转折','前臂'),('膝','小腿'),('踝','脚')]:focus[side+labelpart]=rig.matrix_world@rig.pose.bones[side+bone].head
    values=[]
    for name,point in focus.items():
        p=world_to_camera_view(scene,cam,point);rx,ry=references[name]
        values.append({'地标':name,'模型横向位置':round((p.x-cx)/height,4),'模型距头顶高度':round((1-p.y-top)/height,4),'原画横向位置':round((rx-627.5)/1249,4),'原画距头顶高度':round((ry-1)/1249,4)})
    records.append({'姿态':label,'帧':frame,'主体画面边界':[xmin,top,xmax,bottom],'主体宽高比':(xmax-xmin)/height,'地标':values})
(OUT/'evidence/proportions.json').write_text(json.dumps({'方法':'以各图主体头顶为零、脚底为一，横坐标以主体中心为零并按主体高度归一化。模型来自固定主相机投影；原画为一千二百五十四像素图上的人工近似标注，误差约为主体高度的百分之一至二。原画透视与姿态不同，数值差异不等于造型错误，也不作为相似度评分。','原画主体边界近似':[67,1,1188,1250],'原画地标像素':references,'模型':records},ensure_ascii=False,indent=2))
print('中立与展示姿态归一化地标已记录。')
