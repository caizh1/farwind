"""加载已保存工程，仅调整第二轮肩叶与根足，保留修改前快照。"""
import importlib.util
import math
from pathlib import Path
import bpy
from mathutils import Vector, Matrix

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('refinement',ROOT/'tools/build-east-boss-art-v2.py')
art=importlib.util.module_from_spec(spec);spec.loader.exec_module(art)
source=art.OUT/'source/east-boss-art-before-structure-round-two.blend'
assert source.exists(),'必须先保留修改前工程'
bpy.ops.wm.open_mainfile(filepath=str(source))
bpy.context.scene.frame_set(1)
art.art.RIG=bpy.data.objects['缚枝祭主·可编辑骨架']
art.M['wood']=bpy.data.materials['树皮·主根暖棕']
art.M['ridge']=bpy.data.materials['树皮·生长亮棱']
# 叶根保持原位，改变簇内长短与垂落角度，压低水平层层排列的边缘。
changed=0
for ob in list(bpy.data.objects):
    if ob.type!='MESH' or '肩部叶簇' not in ob.name:continue
    side=-1 if ob.name.startswith('左') else 1
    cluster=int(ob.name.split('肩部叶簇')[1].split('.')[0])
    suffix=int(ob.name.rsplit('.',1)[1]) if '.' in ob.name else 0
    anchor=sum((v.co for v in list(ob.data.vertices)[:5]),Vector())/5
    angle=([8,19,12,-9,5] if side<0 else [-4,11,26,8,-8])[cluster]
    angle += [-9,4,13,-3,7,-12,2][suffix%7]
    rotation=Matrix.Rotation(math.radians(side*angle),3,'Y')
    length=[.72,1.10,.84,1.22,.91,.78,1.04][suffix%7]
    for v in ob.data.vertices:
        d=rotation@(v.co-anchor)
        v.co=anchor+d*length
    changed+=1
# 每足四条主根从不同高度连续下行，落地后延展；侧分叉出现在途中。
for ob in list(bpy.data.objects):
    if ob.type=='MESH' and ('落地主根' in ob.name or '落地二级分叉' in ob.name):bpy.data.objects.remove(ob,do_unlink=True)
for s,side in [(-1,'左'),(1,'右')]:
    paths=[
      ([(.53,.02,.40),(.49,-.14,.22),(.32,-.32,.09),(.14,-.47,.06),(.01,-.55,.035)],[.105,.09,.055,.028,.002]),
      ([(.60,-.03,.33),(.67,-.23,.15),(.73,-.48,.07),(.59,-.72,.05),(.69,-.88,.034)],[.12,.095,.065,.033,.002]),
      ([(.68,.05,.38),(.82,-.08,.20),(1.00,-.22,.085),(1.22,-.24,.055),(1.34,-.38,.036)],[.095,.083,.06,.031,.002]),
      ([(.62,.12,.29),(.72,.30,.15),(.87,.46,.07),(1.01,.53,.038)],[.09,.075,.047,.002])]
    for j,(points,widths) in enumerate(paths):
        # 根条起点埋入腿内并渐扩，避免截面端盖形成脚踝外突的平台。
        points[0]=(.57,.045,.39)
        widths[0]=.025
        points=[(s*(x+(.025*math.sin(k*2+j) if s>0 else 0)),y*(.89 if s>0 else 1),z) for k,(x,y,z) in enumerate(points)]
        art.root(side+'落地主根'+str(j),points,widths,bone=side+'脚',depth=.52,twist=.8,offset=j*.12)
        start=Vector(points[2]);end=start+Vector((s*(.22 if j%2 else -.17),-.19 if j<3 else .18,-.035))
        end.z=max(end.z,.035)
        art.root(side+'落地二级分叉'+str(j),[start,start.lerp(end,.5)+Vector((s*.035,.015,0)),end],[widths[2]*.62,.025,.002],bone=side+'脚',depth=.5,material=art.M['ridge'])
for ob in bpy.data.objects:
    if ob.type=='MESH' and ('落地主根' in ob.name or '落地二级分叉' in ob.name):
        for v in ob.data.vertices:v.co.z+=.006
assert changed>80,'肩叶调整范围异常'
bpy.context.scene['第二轮精修']='仅调整肩叶长短方向与落地根路径；相机、灯光、材质及骨架保持原样。'
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(art.SOURCE))
print('第二轮结构调整完成，肩叶数量：',changed)
