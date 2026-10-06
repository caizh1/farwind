"""完成静态材质连续性，并补齐扭转、单肩与展示姿势；不迁移正式动作。"""
import importlib.util
import math
import json
from pathlib import Path
import bpy
from mathutils import Vector,Quaternion
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('final_art',ROOT/'tools/build-east-boss-art-v2.py')
art=importlib.util.module_from_spec(spec);spec.loader.exec_module(art)
source=art.OUT/'source/east-boss-art-before-final-pass.blend'
assert source.exists(),'缺少收尾前快照'
bpy.ops.wm.open_mainfile(filepath=str(source));scene=bpy.context.scene;scene.frame_set(1)
rig=bpy.data.objects['缚枝祭主·可编辑骨架']
# 根据归一化地标调整纵向比例；同一连续映射用于网格与绑定静止位置。
# 头顶和脚底不动，提高肩胸、膝部并压缩冠枝占比，不改相机来掩盖比例。
levels=[(0,0),(.20,.20),(.90,1.18),(1.50,1.72),(2.30,2.55),(2.90,3.23),(3.05,3.40),(3.70,3.94),(4.36,4.36),(5,5)]
def height(z):
    for (a,b),(c,d) in zip(levels,levels[1:]):
        if a<=z<=c:return b+(d-b)*(z-a)/(c-a)
    return z
for ob in scene.objects:
    if ob.type!='MESH':continue
    inv=ob.matrix_world.inverted()
    for v in ob.data.vertices:
        p=ob.matrix_world@v.co;p.z=height(p.z);v.co=inv@p
before={b.name:{'头':list(b.head_local),'尾':list(b.tail_local),'父级':b.parent.name if b.parent else None} for b in rig.data.bones}
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
for b in rig.data.edit_bones:b.head.z=height(b.head.z);b.tail.z=height(b.tail.z)
bpy.ops.object.mode_set(mode='OBJECT')
after={b.name:{'头':list(b.head_local),'尾':list(b.tail_local),'父级':b.parent.name if b.parent else None} for b in rig.data.bones}
assert len(before)==len(after)==23 and all(before[n]['父级']==after[n]['父级'] for n in before)
(art.OUT/'evidence/rest-pose-changes.json').write_text(json.dumps({'说明':'静态比例修正；骨名和层级不变，静止位置按连续高度映射调整。正式六秒动作迁移时必须以本记录重新验证。','高度映射':levels,'调整前':before,'调整后':after},ensure_ascii=False,indent=2))
scene['眼腔检测高度']=height(3.535)
# 非线性比例调整后，将钩齿两端重新嵌入真实刃面，防止稀疏面片插值留下细缝。
for ob in list(scene.objects):
    if ob.type!='MESH' or '深木钩齿' not in ob.name:continue
    blade=bpy.data.objects[ob.name[0]+'镰刃分层截面'];blade.data.calc_loop_triangles()
    vs=[v.co.copy() for v in blade.data.vertices];fs=[tuple(t.vertices) for t in blade.data.loop_triangles];tree=BVHTree.FromPolygons(vs,fs,all_triangles=True)
    for front,back in [(0,5),(3,8)]:
        loc,n,idx,_=tree.find_nearest(ob.data.vertices[front].co);mid=sum((vs[k] for k in fs[idx]),Vector())/3
        loc=loc.lerp(mid,.06);ob.data.vertices[front].co=loc+n*.006;ob.data.vertices[back].co=loc-n*.01
# 木甲直接继承最近主根三角面的纹理坐标与材质，修正不同贴图区域造成的色块拼接。
for ob in list(scene.objects):
    if ob.type!='MESH' or '树皮转折甲' not in ob.name:continue
    side=ob.name[0];number=int(ob.name.split('树皮转折甲')[1]);prefix=side+('臂部主木束' if number<3 else '腿部扭转主根')
    verts=[];faces=[];uvs=[]
    for root in scene.objects:
        if root.type!='MESH' or not root.name.startswith(prefix):continue
        root.data.calc_loop_triangles();offset=len(verts);verts.extend(v.co.copy() for v in root.data.vertices)
        layer=root.data.uv_layers['手绘源坐标']
        for tri in root.data.loop_triangles:
            faces.append(tuple(offset+i for i in tri.vertices));uvs.append([Vector((*layer.data[i].uv,0)) for i in tri.loops])
    tree=BVHTree.FromPolygons(verts,faces,all_triangles=True);layer=ob.data.uv_layers['手绘源坐标']
    for loop in ob.data.loops:
        loc,_,index,_=tree.find_nearest(ob.data.vertices[loop.vertex_index].co)
        a,b,c=[verts[i] for i in faces[index]];ua,ub,uc=uvs[index]
        uv=barycentric_transform(loc,a,b,c,ua,ub,uc)
        layer.data[loop.index].uv=(max(0,min(1,uv.x)),max(0,min(1,uv.y)))
    ob.data.materials[0]=bpy.data.materials['树皮·主根暖棕']
# 减少全身相同强度的碎纹，保留转折处亮棱；不改变光源。
for name,amount in [('树皮·主根暖棕',.36),('树皮·生长亮棱',.21)]:
    mat=bpy.data.materials[name]
    for node in mat.node_tree.nodes:
        if node.type=='MIX_RGB':node.inputs[0].default_value=amount
scene.render.fps=30
poses={220:('躯干向左扭转',-22,None),240:('躯干向右扭转',22,None),260:('原画倾向展示',-8,None),280:('左肩单独抬起',0,'左'),300:('右肩单独抬起',0,'右'),320:('检查结束中立',0,None)}
for frame,(label,yaw,side) in poses.items():
    scene.frame_set(1)
    for pb in rig.pose.bones:
        pb.rotation_euler=(0,0,0)
        angle=yaw if pb.name=='胸' else -yaw*.22 if pb.name=='腰' else 0
        if angle:
            axis=pb.bone.matrix_local.to_3x3().inverted()@Vector((0,0,1))
            pb.rotation_euler=Quaternion(axis,math.radians(angle)).to_euler('XYZ')
        if side and pb.name in [side+'上臂',side+'肩叶']:
            angle=(60 if pb.name.endswith('上臂') else 24)*(1 if side=='左' else -1)
            axis=pb.bone.matrix_local.to_3x3().inverted()@Vector((0,1,0))
            pb.rotation_euler=Quaternion(axis,math.radians(angle)).to_euler('XYZ')
        if frame==260 and pb.name in ['左上臂','右上臂']:
            axis=pb.bone.matrix_local.to_3x3().inverted()@Vector((0,1,0))
            pb.rotation_euler=Quaternion(axis,math.radians(7 if pb.name.startswith('左') else -3)).to_euler('XYZ')
        pb.keyframe_insert('rotation_euler',frame=frame)
    scene.timeline_markers.new(label,frame=frame)
# 双镰交叉采用手臂整体前后错位，避免只平移刀片而断开镰根。
scene.frame_set(120)
rig.pose.bones['右前臂'].rotation_euler=(math.radians(-34),0,0)
rig.pose.bones['右前臂'].keyframe_insert('rotation_euler',frame=120)
corrections=[(120,24)]
original={}
for frame,_ in corrections:
    scene.frame_set(frame);original[frame]={n:rig.pose.bones[n].rotation_euler.copy() for n in ['左上臂','右上臂','左肩叶','右肩叶']}
for frame,angle in corrections:
    scene.frame_set(frame)
    for name in ['左上臂','右上臂','左肩叶','右肩叶']:
        pb=rig.pose.bones[name];axis=pb.bone.matrix_local.to_3x3().inverted()@Vector((0,0,1))
        q=Quaternion(axis,math.radians(angle*(.4 if name.endswith('肩叶') else 1)))
        pb.rotation_euler=(q@original[frame][name].to_quaternion()).to_euler('XYZ');pb.keyframe_insert('rotation_euler',frame=frame)
# 交叉过渡的两臂不能始终在同一深度面内；整体前后错开并用胸肩渐变权重承接。
for frame,amount in [(1,0),(30,.38),(80,.38),(100,.38),(120,.38),(140,0),(200,0),(320,0)]:
    scene.frame_set(frame)
    for name in ['左上臂','右上臂','左肩叶','右肩叶']:
        pb=rig.pose.bones[name];delta=Vector((0,amount*(-1 if name.startswith('左') else 1),0))
        if name.endswith('肩叶'):delta*=.45
        pb.location=pb.bone.matrix_local.to_3x3().inverted()@delta;pb.keyframe_insert('location',frame=frame)
for ob in scene.objects:
    if ob.type=='MESH' and ('落地主根' in ob.name or '落地二级分叉' in ob.name):
        for v in ob.data.vertices:v.co.z+=.003
scene.frame_end=320;scene.frame_set(1)
scene['静态交付说明']='材质衔接与关键姿态补齐；三百二十帧为变形检查时间线，不是正式六秒战斗动作。'
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(art.SOURCE))
print('材质连续性与补充姿势已保存。')
