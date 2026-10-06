"""仅修正第四版检查序列的整臂避让；不改变静态轮廓或正式动作。"""
import hashlib
import json
import shutil
from pathlib import Path

import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/east-boss-art-v4'
source=OUT/'source/east-boss-art-editable.blend'
before=hashlib.sha256(source.read_bytes()).hexdigest()
shutil.copy2(source,OUT/f'source/east-boss-art-before-motion-{before[:12]}.blend')
bpy.ops.wm.open_mainfile(filepath=str(source))
scene=bpy.context.scene;rig=bpy.data.objects['缚枝祭主·可编辑骨架']
# 旧序列把右臂向身体后方推，弯肘过渡穿过腿部；改为从前方绕行。
# 左腿抬起和躯干扭转时，整条左臂主动让出根足运动范围。
depths={1:(0,0),20:(-.20,-.40),40:(-.38,-1.05),80:(-.38,-1.05),100:(-.38,-1.05),110:(-.38,-1.20),120:(-.38,-1.20),130:(-.30,-.80),140:(0,0),150:(-.28,0),160:(-.48,0),180:(-.30,-.20),200:(0,0),220:(-.32,0),240:(0,0),260:(-.20,0),280:(0,0),300:(-.22,0),320:(0,0)}
depths.update({45:(-.38,-1.05),55:(-.38,-1.05),60:(-.38,-1.05)})
for frame,values in depths.items():
    scene.frame_set(frame)
    for side,amount in zip(['左','右'],values):
        for suffix,factor in [('上臂',1),('肩叶',.45)]:
            pb=rig.pose.bones[side+suffix]
            # 逐帧测量确认左右弯肘换手在第四十八至五十三帧擦刃，向外绕过。
            spread=.50 if side=='右' and frame in [45,55] else 0
            pb.location=pb.bone.matrix_local.to_3x3().inverted()@Vector((spread*factor,amount*factor,0))
            pb.keyframe_insert('location',frame=frame)
scene.frame_set(1)
scene['第四版检查动作说明']='保留三百二十帧和原有转角；右臂改为前方绕行，左臂在抬腿与扭转时避让。不是正式战斗动画。'
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(source))
(OUT/'evidence/motion-correction.json').write_text(json.dumps({'说明':'针对刀腿穿插修正检查序列；保留原有旋转动作、腿部动作和静态第一帧。','修改前摘要':before,'修改后摘要':hashlib.sha256(source.read_bytes()).hexdigest(),'整臂前后位置':depths,'换手避让':'第四十五至五十五帧右臂向外移动零点五场景单位，第四十和六十帧回到原横向位置。'},ensure_ascii=False,indent=2)+'\n')
print('检查序列整臂避让已修正，必须重新验证完整三百二十帧。')
