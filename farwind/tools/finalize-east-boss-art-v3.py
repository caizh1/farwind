"""加载第三版当前工程，修复交叉动作过渡；不回退或重建静态造型。"""
import hashlib
import json
import math
import shutil
from pathlib import Path
import bpy
from mathutils import Vector, Quaternion

ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/east-boss-art-v3'
source=OUT/'source/east-boss-art-editable.blend'
before=hashlib.sha256(source.read_bytes()).hexdigest()
shutil.copy2(source,OUT/f'source/east-boss-art-before-motion-{before[:12]}.blend')
bpy.ops.wm.open_mainfile(filepath=str(source));scene=bpy.context.scene
rig=bpy.data.objects['缚枝祭主·可编辑骨架']
if not scene.get('第三版镰侧叶片嵌面修复',False):
    # 镰刃附近叶片被刃面切成绿色小碎片；从原接点逐渐抬出叶轴及整簇叶片。
    stems=[o for o in scene.objects if o.type=='MESH' and '臂侧覆叶簇' in o.name and o.name.endswith('叶轴')]
    for stem in stems:
        prefix=stem.name[:-2];start=sum((v.co for v in list(stem.data.vertices)[:6]),Vector())/6
        sign=-1 if '簇-1-' in stem.name else 1
        for ob in scene.objects:
            if ob.type!='MESH' or not ob.name.startswith(prefix):continue
            for v in ob.data.vertices:
                ramp=max(0,min(1,(start.z-v.co.z)/.24))
                v.co.y+=sign*.16*ramp
    scene['第三版镰侧叶片嵌面修复']=True
if not scene.get('第三版叶簇侧向体积修复',False):
    # 侧面不能只剩叶片的薄边；绕各自叶轴增加定向翻转，叶根和叶尖保持原位。
    candidates=sorted([o for o in scene.objects if o.type=='MESH' and '垂生簇' in o.name and ('叶片' in o.name or '末叶' in o.name)],key=lambda o:o.name)
    for index,ob in enumerate(candidates):
        vertices=list(ob.data.vertices)
        a=sum((v.co for v in vertices[:5]),Vector())/5
        b=sum((v.co for v in vertices[-5:]),Vector())/5
        axis=(b-a).normalized()
        angle=[0,38,-28,55,-42,18][index%6]*(1 if ob.name.startswith('左') else -1)
        if '腰侧' in ob.name:angle*=.65
        rotation=Quaternion(axis,math.radians(angle))
        for v in vertices:
            center=a+axis*(v.co-a).dot(axis)
            v.co=center+rotation@(v.co-center)
    scene['第三版叶簇侧向体积修复']=True
if not scene.get('第三版背侧根端修复',False):
    # 背面检查发现承重根下端仍露出截面；渐细并埋入腿根，保持上段路径不变。
    for ob in scene.objects:
        if not ob.name.startswith('躯干承重主根'):continue
        vertices=list(ob.data.vertices);rings=len(vertices)//12
        for row in range(rings):
            t=row/(rings-1)
            if t>=.19:continue
            ring=vertices[row*12:(row+1)*12];center=sum((v.co for v in ring),Vector())/12
            u=t/.19;blend=1-u*u*(3-2*u)
            shift=Vector((0,(.09-center.y)*blend,.16*blend))
            for v in ring:v.co=center+shift+(v.co-center)*(1-.82*blend)
    scene['第三版背侧根端修复']=True
if not scene.get('第三版镰尖高度修复',False):
    # 踝部提高不应连带抬高镰尖；仅沿镰臂下半段连续恢复尖端高度。
    for ob in scene.objects:
        if ob.type!='MESH':continue
        groups={g.index:g.name for g in ob.vertex_groups}
        for v in ob.data.vertices:
            for side,amount in [('左',.12),('右',.22)]:
                weight=sum(g.weight for g in v.groups if groups[g.group]==side+'镰臂')
                if weight:v.co.z-=amount*max(0,min(1,(1.50-v.co.z)/.90))**1.5*weight
    scene['第三版镰尖高度修复']=True
scene.frame_set(260)
pb=rig.pose.bones['左上臂'];axis=pb.bone.matrix_local.to_3x3().inverted()@Vector((0,1,0))
pb.rotation_euler=Quaternion(axis,math.radians(-7)).to_euler('XYZ');pb.keyframe_insert('rotation_euler',frame=260)
# 新镰尖弧线在第126帧擦过；延长整条手臂的前后分离，避免只移动刀片。
frame=130;amount=.30;scene.frame_set(frame)
for name in ['左上臂','右上臂','左肩叶','右肩叶']:
    pb=rig.pose.bones[name]
    delta=Vector((0,amount*(-1 if name.startswith('左') else 1),0))
    if name.endswith('肩叶'):delta*=.45
    pb.location=pb.bone.matrix_local.to_3x3().inverted()@delta
    pb.keyframe_insert('location',frame=frame)
scene.frame_set(1)
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(source))
(OUT/'evidence/motion-correction.json').write_text(json.dumps({'原因':'新镰尖弧线与肘部位置使第126帧双镰发生表面互穿；踝部高度映射同时抬高了镰尖。','修复':'第130帧保持整臂前后分离，肩叶随肩部移动；镰臂下半段连续恢复尖端高度；第260帧左臂向内形成原画倾向展示。','修改前摘要':before,'修改后摘要':hashlib.sha256(source.read_bytes()).hexdigest(),'后续':'必须重新运行全部320帧检查并重新烘焙。'},ensure_ascii=False,indent=2))
