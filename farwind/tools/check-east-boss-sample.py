"""重新打开交付工程，检查脚部锁定、素材打包、时序和姿态跳变。"""
import json
import math
from pathlib import Path
import bpy

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/east-boss-motion'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'source/east-boss-motion.blend'))
scene=bpy.context.scene
rig=bpy.data.objects['缚枝祭主·动作骨架']
model=bpy.data.objects['缚枝祭主·完整蒙皮模型']
assert model.parent==rig,'蒙皮必须随骨架整体位移'
assert len(rig.data.bones)==21 and scene.render.fps==60 and scene.frame_end==360
assert all(image.packed_file for image in bpy.data.images if image.source=='FILE' and image.users),'使用中的外部图片必须打包'
metrics={'支撑脚最大漂移米':0,'左脚落地后最大漂移米':0,'脚部目标最大误差米':0,'骨骼相邻帧最大转角度':0}
fixed={};last_rot={};max_frame=0;max_bone=''
camera=bpy.data.objects['游戏视角'];view=camera.matrix_world.inverted();pixels=1920/camera.data.ortho_scale
bounds=[float('inf'),float('inf'),-float('inf'),-float('inf')]
for f in range(1,361):
    scene.frame_set(f);bpy.context.view_layer.update()
    for side in ['左','右']:
        foot=rig.matrix_world@rig.pose.bones[side+'脚'].head
        target=bpy.data.objects[side+'脚·控制器'].matrix_world.translation
        metrics['脚部目标最大误差米']=max(metrics['脚部目标最大误差米'],(foot-target).length)
        if side=='右' or f>=80:
            fixed.setdefault(side,foot.copy())
            key='支撑脚最大漂移米' if side=='右' else '左脚落地后最大漂移米'
            metrics[key]=max(metrics[key],(foot-fixed[side]).length)
    for bone in rig.pose.bones:
        q=bone.matrix.to_quaternion()
        if bone.name in last_rot:
            angle=math.degrees(last_rot[bone.name].rotation_difference(q).angle)
            angle=min(angle,360-angle)
            if angle>metrics['骨骼相邻帧最大转角度']:
                metrics['骨骼相邻帧最大转角度']=angle;max_frame=f;max_bone=bone.name
        last_rot[bone.name]=q
    evaluated=model.evaluated_get(bpy.context.evaluated_depsgraph_get());geometry=evaluated.to_mesh();transform=view@evaluated.matrix_world
    for vertex in geometry.vertices:
        point=transform@vertex.co;x=960+point.x*pixels;y=540-point.y*pixels
        bounds[0]=min(bounds[0],x);bounds[1]=min(bounds[1],y);bounds[2]=max(bounds[2],x);bounds[3]=max(bounds[3],y)
    evaluated.to_mesh_clear()
print(json.dumps({'测量':metrics,'最大变化帧':max_frame,'骨骼':max_bone},ensure_ascii=False))
assert metrics['脚部目标最大误差米']<.002,'落地求解误差超过两毫米'
assert metrics['支撑脚最大漂移米']<.002,'支撑脚出现滑移'
assert metrics['左脚落地后最大漂移米']<.002,'迈步落地后出现滑移'
assert metrics['骨骼相邻帧最大转角度']<30,'相邻帧存在明显骨骼翻转'
assert bounds[0]>=480 and bounds[2]<=1440,'角色超出对照画面的水平裁切范围'
assert bounds[1]>=14 and bounds[3]<=1062,'标题或时间轴可能遮挡角色'
baseline=json.loads((OUT/'source/baseline-provenance.json').read_text())
assert baseline['时序']['第一段']['命中']==2150
assert baseline['时序']['第二段']['命中']==3480
report={'结论':'通过','说明':'独立重新打开交付工程后检查全部三百六十帧；不代表全部网格无穿插或实战通过。','检查帧数':360,'检查骨骼数':len(rig.data.bones),'测量':metrics,'最大转角出现帧':max_frame,'正面完整动作投影范围':bounds,'图片均已打包':True,'正式命中时刻毫秒':[2150,3480]}
(OUT/'evidence/reopen-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))
