"""从第三轮前快照精修枝干截面、肩叶折叠与踝根连接，不重建全身。"""
import importlib.util
import math
import json
from pathlib import Path
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('junction_refinement',ROOT/'tools/build-east-boss-art-v2.py')
art=importlib.util.module_from_spec(spec);spec.loader.exec_module(art)
snapshot=art.OUT/'source/east-boss-art-before-structure-round-three.blend'
assert snapshot.exists(),'缺少本轮修改前快照'
bpy.ops.wm.open_mainfile(filepath=str(snapshot))
scene=bpy.context.scene;scene.frame_set(1)
rig=bpy.data.objects['缚枝祭主·可编辑骨架'];art.art.RIG=rig
art.M['wood']=bpy.data.materials['树皮·主根暖棕']
art.M['ridge']=bpy.data.materials['树皮·生长亮棱']
bones=[(b.name,b.parent.name if b.parent else None,tuple(b.head_local),tuple(b.tail_local)) for b in rig.data.bones]
cameras={o.name:tuple(tuple(row) for row in o.matrix_world) for o in scene.objects if o.type=='CAMERA'}
counts={'调整肩叶':0,'调整冠枝':0,'新增踝部连接根':0}
for ob in list(scene.objects):
    if ob.type!='MESH':continue
    if '肩部叶簇' in ob.name:
        verts=list(ob.data.vertices);assert len(verts)==75,'叶片拓扑发生变化'
        number=int(ob.name.rsplit('.',1)[1]) if '.' in ob.name else 0
        cluster=int(ob.name.split('肩部叶簇')[1].split('.')[0])
        kind=(number+cluster+(ob.name.startswith('右')))%5
        # 保留每行中脉，分别控制宽度、非对称折边和叶尖回卷。
        for row in range(15):
            t=row/14;wave=math.sin(math.pi*t)
            center=sum((verts[row*5+k].co for k in range(5)),Vector())/5
            width=[.61,.80,.94,.73,1.02][kind]
            for k in range(5):
                v=verts[row*5+k];d=v.co-center;across=(k-2)/2
                d*=width
                if kind in [0,3]:d.y+=(.055 if kind==0 else -.04)*wave*across*across
                if kind==2:d.y+=.045*wave*across
                v.co=center+d
                if kind==3:v.co.y+=.075*t**4;v.co.z+=.045*t**4
        counts['调整肩叶']+=1
    if ob.name.startswith(('树冠承重主枝','冠枝次级分叉','冠枝三级短梢','冠枝末端不规则短梢')):
        verts=list(ob.data.vertices);assert len(verts)%12==0,'冠枝截面不是十二边'
        rings=len(verts)//12
        for row in range(rings):
            ring=verts[row*12:(row+1)*12];center=sum((v.co for v in ring),Vector())/12
            t=row/max(1,rings-1)
            factor=(.91-.17*math.sin(math.pi*t)) if '承重主枝' in ob.name else .9
            for v in ring:v.co=center+(v.co-center)*factor
        # 所有冠枝使用同一空间形变，接点随之共同移动，增加前后层次。
        for v in verts:
            p=v.co;ramp=max(0,min(1,(p.z-3.45)/.65))
            p.y+=.12*math.sin((p.z-3.45)*2.4+p.x*2.0)*ramp
        counts['调整冠枝']+=1
for s,side in [(-1,'左'),(1,'右')]:
    for j,points in enumerate([
        [(.49,-.025,.61),(.51,-.055,.44),(.61,-.10,.26),(.69,-.24,.15),(.73,-.44,.085)],
        [(.52,.065,.55),(.59,.075,.37),(.72,.06,.24),(.84,-.07,.15),(1.0,-.20,.092)],
    ]):
        points=[(s*x,y,z) for x,y,z in points]
        art.root(side+'踝根连续过渡'+str(j),points,[.014,.058,.074,.046,.003],
                 weights=lambda t,side=side:art.base.blend_weights(side+'小腿',side+'脚',t,.48),
                 material=art.M['wood'],depth=.58,twist=.55,offset=.15*j)
        counts['新增踝部连接根']+=1
assert counts['调整肩叶']==112 and counts['调整冠枝']>=30
assert bones==[(b.name,b.parent.name if b.parent else None,tuple(b.head_local),tuple(b.tail_local)) for b in rig.data.bones]
assert cameras=={o.name:tuple(tuple(row) for row in o.matrix_world) for o in scene.objects if o.type=='CAMERA'}
scene['第三轮精修']='肩叶宽窄与折边、冠枝截面和纵深、踝部连续过渡；保留灯光材质相机与骨架。'
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(art.SOURCE))
(art.OUT/'evidence/structure-round-three/changes.json').write_text(json.dumps({'说明':'只统计实施范围，不代表视觉验收通过。','改动':counts,'骨架与相机':'前后数据一致'},ensure_ascii=False,indent=2))
print(json.dumps(counts,ensure_ascii=False))
